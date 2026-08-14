// backend.js 单元验证：用内存 mock 模拟 supabase 客户端，验证同步管线
// 不联网、不依赖真实 Supabase，仅验证字段映射与读写逻辑。
'use strict'
const fs = require('fs')
const path = require('path')
const vm = require('vm')

// ---- 内存表存储 ----
const store = {}        // table -> { idKey: row }
const realtimeEvents = []

function tableApi(name) {
  store[name] = store[name] || {}
  const rows = store[name]
  const api = {
    _name: name,
    select() { return api },
    eq(col, val) {
      api._filter = { col, val }
      return api
    },
    single() { api._singleExpected = true; return api },
    order() { return api },
    upsert(row) {
      const key = row.id || row.course_id
      rows[key] = JSON.parse(JSON.stringify(row))
      return Promise.resolve({ error: null })
    },
    delete() { return api },
    insert(row) {
      const key = row.id || row.course_id
      rows[key] = JSON.parse(JSON.stringify(row))
      return Promise.resolve({ error: null })
    },
    then(cb) {
      // select/eq/single 的最终求值
      let data
      if (api._filter) {
        data = Object.values(rows).filter(r => String(r[api._filter.col]) === String(api._filter.val))
      } else {
        data = Object.values(rows)
      }
      if (name === 'courses' && api._singleExpected) data = data[0] || null
      const result = cb({ data, error: null })
      return Promise.resolve(result)
    }
  }
  return api
}

function makeClient() {
  return {
    from(table) { return tableApi(table) },
    channel(name) {
      return {
        on(evt, cfg, cb) { realtimeEvents.push({ name, cfg, cb }); return this },
        subscribe(cb) { cb && cb('SUBSCRIBED'); return this }
      }
    },
    removeChannel() {}
  }
}

const win = {
  supabase: { createClient: () => makeClient() },
  APP_CONFIG: { SUPABASE_URL: 'https://demo.supabase.co', SUPABASE_ANON_KEY: 'test-key' }
}
const sandbox = { window: win, console: console, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Date: Date, Math: Math }
sandbox.global = sandbox
sandbox.window.supabase = win.supabase

vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'docs', 'js', 'backend.js'), 'utf8'), sandbox, { filename: 'backend.js' })

const B = win.Backend
let pass = 0, fail = 0
function ck(cond, label) { if (cond) { pass++; console.log('✅ ' + label) } else { fail++; console.log('❌ ' + label) } }

// 初始化（应使用 mock client，enabled=true）
ck(B.init() === true, 'Backend.init 成功启用')
ck(B.isEnabled() === true, 'backendOn 为 true')

// upsert discussions（验证 camelCase -> snake_case + courseId + comments jsonb）
B.upsert('discussions', { id: 'd1', author: '陈同学', title: '测试帖', content: '内容', category: 'question', createTime: 1700000000000, likes: 5, comments: [{ author: '李', content: '好' }], aiAnswer: null, aiPinned: false }).then(() => {
  const row = store.discussions['d1']
  ck(row !== undefined, 'discussions 写入成功')
  ck(row.course_id === undefined, 'discussions upsert 不加 courseId（由 syncPush 注入）')
  ck(row.author === '陈同学' && row.title === '测试帖', '基本字段映射正确')
  ck(row.create_time === 1700000000000, 'createTime -> create_time')
  ck(typeof row.comments === 'string' && JSON.parse(row.comments)[0].author === '李', 'comments 序列化为 jsonb 字符串')

  // 注入 course_id 后 upsert（模拟 app.syncPush）
  const withCourse = Object.assign({}, JSON.parse(JSON.stringify(store.discussions['d1'])))
  withCourse.course_id = 'course_x'
  store.discussions['d1'] = withCourse

  // loadCourse
  store.courses = store.courses || {}
  store.courses['course_x'] = { id: 'course_x', name: '高数', class_name: '计科1班', semester: '2026', teacher_name: '张老师', created_at: 1 }
  return B.loadCourse('course_x').then(c => {
    ck(c && c.className === '计科1班' && c.teacherName === '张老师', 'loadCourse 反向映射 snake->camel 正确')

    // loadAll（验证按 course_id 过滤 + 反向映射）
    store.publishes = { p1: { id: 'p1', course_id: 'course_x', title: '作业', category: 'homework', content: 'x', create_time: 1, is_top: false, views: 0, attachments: '[]' } }
    store.messages = { m1: { id: 'm1', course_id: 'course_x', student_name: '小明', is_anonymous: false, type: 'knowledge', content: 'q', create_time: 1, replied: false, status: 'approved' } }
    store.discussions = { d1: withCourse }
    store.course_config = { course_x: { course_id: 'course_x', page_style: 'compact', message_review_enabled: true, discussion_post_enabled: true, ai_answer_enabled: true } }
    console.log('PRE-LOADALL course_config=', JSON.stringify(store.course_config))
    return B.loadAll('course_x')
  }).then(shared => {
    console.log('DEBUG discussions.len=', shared.discussions.length, 'config=', JSON.stringify(shared.config))
    ck(shared.publishes.length === 1 && shared.publishes[0].title === '作业', 'loadAll publishes 数量正确')
    ck(shared.messages.length === 1 && shared.messages[0].studentName === '小明', 'loadAll messages 反向映射正确')
    ck(shared.discussions.length === 1 && Array.isArray(shared.discussions[0].comments), 'loadAll discussions comments 反序列化为数组')
    ck(shared.config && shared.config.pageStyle === 'compact' && shared.config.messageReviewEnabled === true, 'loadAll config 反向映射正确')

    // subscribe 验证（courses/discussions 等表注册了 postgres_changes）
    B.subscribe('course_x', () => {})
    ck(realtimeEvents.length === 5, 'subscribe 为 5 张表注册了实时监听')
    ck(realtimeEvents.some(e => e.cfg.table === 'discussions' && /course_id=eq\.course_x/.test(e.cfg.filter)), 'discussions 监听带 course_id 过滤')

    // remove
    return B.remove('discussions', 'd1').then(() => { ck(true, 'remove 调用不报错') })
  })
}).then(() => {
  console.log(`\n=== 后端管线测试: ${pass} 通过 / ${fail} 失败 ===`)
  process.exit(fail > 0 ? 1 : 0)
}).catch(e => { console.error('测试异常:', e); process.exit(1) })
