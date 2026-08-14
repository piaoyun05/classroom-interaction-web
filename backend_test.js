// backend.js 单元验证：用内存 mock 模拟 GitHub Contents API（fetch），
// 验证「仓库 data 分支」同步管线（无需真实网络/账号）。
'use strict'
const fs = require('fs')
const path = require('path')
const vm = require('vm')

// 内存中的 course-data.json 内容
let store = { courses: {}, data: {} }
let shaVer = 0
const getSha = () => 'sha_v' + shaVer

const sandbox = {
  console: console,
  Promise: Promise,
  JSON: JSON,
  Object: Object,
  Array: Array,
  String: String,
  Date: Date,
  Math: Math,
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  // 捕获 setInterval 以便手动触发轮询
  __pollCb: null,
  setInterval: function (fn) { sandbox.__pollCb = fn; return 1 },
  clearInterval: function () { sandbox.__pollCb = null }
}
sandbox.fetch = function (url, opts) {
  if (!opts || opts.method !== 'PUT') {
    // GET contents -> base64 content + sha
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ content: Buffer.from(JSON.stringify(store)).toString('base64'), sha: getSha() })
    })
  }
  // PUT contents -> 写入并更新 sha
  const body = JSON.parse(opts.body)
  store = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'))
  shaVer++
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ content: { path: 'course-data.json' }, sha: getSha() }) })
}

const win = {
  APP_CONFIG: { GITHUB_TOKEN: 'test-token' }
}
sandbox.window = win
sandbox.global = sandbox
sandbox.window.fetch = sandbox.fetch

vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'docs', 'js', 'backend.js'), 'utf8'), sandbox, { filename: 'backend.js' })

const B = win.Backend
let pass = 0, fail = 0
function ck(cond, label) { if (cond) { pass++; console.log('✅ ' + label) } else { fail++; console.log('❌ ' + label) } }

ck(B.init() === true, 'Backend.init 成功启用（GITHUB_TOKEN 已配置）')
ck(B.isEnabled() === true, 'isEnabled 为 true')

// 课程
B.upsert('courses', { id: 'c1', name: '高等数学', className: '计科1班', semester: '2026', teacherName: '张老师', intro: '微积分', createdAt: 1 }).then(() => {
  ck(store.courses.c1 && store.courses.c1.name === '高等数学' && store.courses.c1.className === '计科1班', 'courses 写入并保留 camelCase 字段')

  // 发布
  return B.upsert('publishes', { id: 'p1', courseId: 'c1', title: '作业', category: 'homework', content: 'x', createTime: 1, isTop: false, views: 0, attachments: [] })
}).then(() => {
  ck(store.data.c1 && store.data.c1.publishes[0].title === '作业', 'publishes 按 courseId 归属写入')

  // 讨论（含 comments 数组，直接存对象）
  return B.upsert('discussions', { id: 'd1', courseId: 'c1', author: '陈同学', title: '提问', content: 'c', category: 'question', createTime: 1, likes: 0, comments: [{ author: '李', content: '好' }], aiAnswer: null })
}).then(() => {
  ck(store.data.c1.discussions[0].comments[0].author === '李', 'discussions.comments 数组原样保留')

  // 留言
  return B.upsert('messages', { id: 'm1', courseId: 'c1', studentName: '小明', isAnonymous: false, type: 'knowledge', content: 'q', createTime: 1, replied: false, status: 'approved' })
}).then(() => {
  ck(store.data.c1.messages[0].studentName === '小明', 'messages 写入')

  // 配置
  return B.upsert('course_config', Object.assign({ courseId: 'c1' }, { pageStyle: 'compact', messageReviewEnabled: true, discussionPostEnabled: true, aiAnswerEnabled: true }))
}).then(() => {
  ck(store.data.c1.config && store.data.c1.config.pageStyle === 'compact' && !('courseId' in store.data.c1.config), 'course_config 写入且剥离 courseId')

  // 读取聚合
  return B.loadGist('c1')
}).then((shared) => {
  ck(shared && shared.course.name === '高等数学' && shared.course.className === '计科1班', 'loadGist 返回课程 meta')
  ck(shared.publishes.length === 1 && shared.publishes[0].title === '作业', 'loadGist publishes')
  ck(shared.messages.length === 1 && shared.messages[0].studentName === '小明', 'loadGist messages')
  ck(shared.discussions.length === 1 && Array.isArray(shared.discussions[0].comments), 'loadGist discussions.comments 为数组')
  ck(shared.config && shared.config.messageReviewEnabled === true, 'loadGist config')
  return B.loadGist('not_exist')
}).then((r) => {
  ck(r === null, 'loadGist 未知课程返回 null')

  // 删除
  return B.remove('discussions', 'd1', 'c1')
}).then(() => {
  ck(store.data.c1.discussions.length === 0, 'remove discussions 生效')

  // 轮询订阅：SHA 变化应触发 onChange（fetch 为异步，需等待微任务）
  let changed = 0
  B.subscribe('c1', () => { changed++ })
  ck(typeof sandbox.__pollCb === 'function', 'subscribe 注册了轮询')
  sandbox.__pollCb() // 首次轮询（异步）
  return new Promise(function (resolve) {
    setTimeout(function () {
      const before = changed
      shaVer++ // 模拟他人写入（SHA 变化）
      sandbox.__pollCb() // 再次轮询（异步）
      setTimeout(function () {
        ck(changed > before, 'SHA 变化后触发 onChange')
        B.unsubscribe()
        ck(sandbox.__pollCb === null, 'unsubscribe 清除轮询')
        console.log(`\n=== Contents API 后端管线测试: ${pass} 通过 / ${fail} 失败 ===`)
        process.exit(fail > 0 ? 1 : 0)
      }, 20)
    }, 20)
  })
}).catch(e => { console.error('测试异常:', e); process.exit(1) })
