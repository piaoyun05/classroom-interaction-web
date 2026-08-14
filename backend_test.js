// backend.js 单元验证：mock CloudBase SDK（内存文档库 + 匿名登录），
// 验证「集合 courses 每课程一文档」同步管线（无需真实腾讯云）。
'use strict'
const fs = require('fs')
const path = require('path')
const vm = require('vm')

// ---- 内存 CloudBase mock ----
let docs = {}
let watchers = []

function makeApp() {
  return {
    auth() { return { signInAnonymously: () => Promise.resolve({}) } },
    database() {
      return {
        command: { push: (arr) => ({ __op: 'push', arr }) },
        collection() {
          return {
            doc(id) {
              return {
                get() { return Promise.resolve({ data: docs[id] ? [Object.assign({ _id: id }, JSON.parse(JSON.stringify(docs[id])))] : [] }) },
                set(obj) { docs[id] = JSON.parse(JSON.stringify(obj)); return Promise.resolve({}) },
                update(obj) {
                  docs[id] = docs[id] || {}
                  Object.keys(obj).forEach(k => {
                    const v = obj[k]
                    if (v && v.__op === 'push') {
                      docs[id][k] = (docs[id][k] || []).concat(JSON.parse(JSON.stringify(v.arr)))
                    } else {
                      docs[id][k] = JSON.parse(JSON.stringify(v))
                    }
                  })
                  return Promise.resolve({})
                },
                watch(cfg) { watchers.push(cfg); return { close() { watchers = [] } } }
              }
            }
          }
        }
      }
    }
  }
}

const win = { APP_CONFIG: { CLOUDBASE_ENV: 'aiclass-test' } }
const sandbox = {
  window: win,
  console: console,
  Promise: Promise,
  JSON: JSON,
  Object: Object,
  Array: Array,
  String: String,
  Date: Date,
  Math: Math,
  setInterval: () => 0,
  clearInterval: () => {},
  cloudbase: { init: () => makeApp() }
}
sandbox.global = sandbox
sandbox.window.cloudbase = sandbox.cloudbase

vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'docs', 'js', 'backend.js'), 'utf8'), sandbox, { filename: 'backend.js' })

const B = win.Backend
let pass = 0, fail = 0
function ck(cond, label) { if (cond) { pass++; console.log('✅ ' + label) } else { fail++; console.log('❌ ' + label) } }

;(async function run() {
  ck(B.init() === true, 'Backend.init 返回 true（CLOUDBASE_ENV 已配置 + SDK 存在）')
  await B.ready
  ck(B.isEnabled() === true, '匿名登录完成后 isEnabled 为 true')

  // 课程（创建文档）
  let ok = await B.upsert('courses', { id: 'c1', name: '高等数学', className: '计科1班', semester: '2026', teacherName: '张老师', intro: '微积分', createdAt: 1 })
  ck(ok === true, 'upsert courses 成功')
  ck(docs.c1 && docs.c1.meta && docs.c1.meta.name === '高等数学' && docs.c1.meta.className === '计科1班', 'courses 存入 meta 字段（camelCase）')
  ck(Array.isArray(docs.c1.publishes) && Array.isArray(docs.c1.discussions), '建课程时初始化空数组')

  // 新增发布（原子追加）
  ok = await B.upsert('publishes', { id: 'p1', courseId: 'c1', title: '作业', category: 'homework', content: 'x', createTime: 1, isTop: false, views: 0, attachments: [] })
  ck(ok === true && docs.c1.publishes.length === 1 && docs.c1.publishes[0].title === '作业', 'publishes 新增写入')

  // 讨论（含 comments 数组）
  ok = await B.upsert('discussions', { id: 'd1', courseId: 'c1', author: '陈同学', title: '提问', content: 'c', category: 'question', createTime: 1, likes: 0, comments: [{ author: '李', content: '好' }], aiAnswer: null })
  ck(ok === true && docs.c1.discussions[0].comments[0].author === '李', 'discussions.comments 数组原样保留')

  // 留言
  ok = await B.upsert('messages', { id: 'm1', courseId: 'c1', studentName: '小明', isAnonymous: false, type: 'knowledge', content: 'q', createTime: 1, replied: false, status: 'approved' })
  ck(ok === true && docs.c1.messages[0].studentName === '小明', 'messages 写入')

  // 配置（剥离 courseId）
  ok = await B.upsert('course_config', Object.assign({ courseId: 'c1' }, { pageStyle: 'compact', messageReviewEnabled: true, discussionPostEnabled: true, aiAnswerEnabled: true }))
  ck(ok === true && docs.c1.config.pageStyle === 'compact' && !('courseId' in docs.c1.config), 'course_config 写入且剥离 courseId')

  // 更新已有条目（不重复追加）
  ok = await B.upsert('publishes', { id: 'p1', courseId: 'c1', title: '作业v2', category: 'homework', content: 'y', createTime: 1, isTop: false, views: 0, attachments: [] })
  ck(ok === true && docs.c1.publishes.length === 1 && docs.c1.publishes[0].title === '作业v2', 'upsert 同 id 更新而非重复追加')

  // loadGist 聚合
  const shared = await B.loadGist('c1')
  ck(shared && shared.course.name === '高等数学', 'loadGist 返回课程 meta')
  ck(shared.publishes.length === 1 && shared.publishes[0].title === '作业v2', 'loadGist publishes')
  ck(shared.messages.length === 1 && shared.messages[0].studentName === '小明', 'loadGist messages')
  ck(shared.discussions.length === 1 && Array.isArray(shared.discussions[0].comments), 'loadGist discussions.comments 为数组')
  ck(shared.config && shared.config.messageReviewEnabled === true, 'loadGist config')
  ck(await B.loadGist('not_exist') === null, 'loadGist 未知课程返回 null')

  // 删除
  ok = await B.remove('discussions', 'd1', 'c1')
  ck(ok === true && docs.c1.discussions.length === 0, 'remove discussions 生效')

  // 实时订阅（watch）
  let changed = 0
  B.subscribe('c1', () => { changed++ })
  await B.ready
  ck(watchers.length === 1, 'subscribe 注册了 watch')
  watchers[0].onChange()
  ck(changed === 1, 'watch onChange 触发回调')
  B.unsubscribe()
  ck(watchers.length === 0, 'unsubscribe 关闭 watch')

  console.log(`\n=== CloudBase 后端管线测试: ${pass} 通过 / ${fail} 失败 ===`)
  process.exit(fail > 0 ? 1 : 0)
})().catch(e => { console.error('测试异常:', e); process.exit(1) })
