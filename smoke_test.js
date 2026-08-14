// 冒烟测试：验证网页版所有路由渲染不报错
'use strict'

const fs = require('fs')
const path = require('path')
const vm = require('vm')

// ---- Mock localStorage ----
const storageData = {}
const localStorageMock = {
  getItem: (k) => (k in storageData ? storageData[k] : null),
  setItem: (k, v) => { storageData[k] = String(v) },
  removeItem: (k) => { delete storageData[k] }
}

// ---- Mock element ----
function createElement(id) {
  return {
    id,
    _innerHTML: '',
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    set innerHTML(v) { this._innerHTML = String(v) },
    get innerHTML() { return this._innerHTML },
    value: '',
    checked: false,
    textContent: '',
    getAttribute() { return null },
    setAttribute() {},
    focus() {},
    scrollIntoView() {},
    appendChild() {}
  }
}

const elements = {}
function getElement(id) {
  if (!elements[id]) elements[id] = createElement(id)
  return elements[id]
}

const eventHandlers = {}
const doc = {
  readyState: 'complete',
  getElementById: getElement,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: (type, fn) => { eventHandlers[type] = fn }
}

// ---- Mock window ----
let currentHash = '#/'
const win = {
  location: {
    get hash() { return currentHash },
    set hash(v) { currentHash = v }
  },
  localStorage: localStorageMock,
  scrollTo: () => {},
  addEventListener: (type, fn) => { eventHandlers['w_' + type] = fn },
  history: { length: 1, back: () => {} },
  confirm: () => true
}

const sandbox = {
  window: win,
  document: doc,
  localStorage: localStorageMock,
  console: console,
  Date: Date,
  Math: Math,
  setTimeout: (fn) => { /* 不执行异步 */ },
  clearTimeout: () => {},
  Promise: Promise
}
sandbox.global = sandbox

// ---- 加载脚本 ----
function loadScript(rel) {
  const code = fs.readFileSync(path.join(__dirname, 'docs', rel), 'utf8')
  vm.runInNewContext(code, sandbox, { filename: rel })
}

loadScript('js/util.js')
loadScript('js/data.js')
loadScript('js/aiEngine.js')

// 先设置课程，让首页可完整渲染
const mockData = win.MockData
localStorageMock.setItem('web_course', JSON.stringify(mockData.course))
localStorageMock.setItem('web_user', JSON.stringify({ name: '张教授', role: 'teacher' }))
// 开启留言审核，并注入一条待审核留言（app.js loadState 时即读取）
localStorageMock.setItem('web_config', JSON.stringify({ messageReviewEnabled: true }))
const seedMsgs = JSON.parse(JSON.stringify(mockData.messages || []))
seedMsgs.unshift({ id: 'msg_pending', studentName: '测试同学', isAnonymous: false, type: 'knowledge', content: '这是一条待审核留言', createTime: Date.now(), replied: false, status: 'pending' })
localStorageMock.setItem('web_messages', JSON.stringify(seedMsgs))

loadScript('js/app.js')

// ---- 渲染测试 ----
const appEl = getElement('app')

function renderRoute(hash) {
  currentHash = hash
  eventHandlers['w_hashchange'] && eventHandlers['w_hashchange']()
  return appEl._innerHTML
}

const routes = [
  '#/', '#/createCourse', '#/teacherConfig',
  '#/publish', '#/publishDetail/pub_1', '#/publishNew',
  '#/message', '#/messageNew',
  '#/discussion', '#/discussionDetail/disc_1', '#/discussionNew',
  '#/ai', '#/aiSummary', '#/personalStudy', '#/review', '#/profile'
]

let pass = 0
let fail = 0
const outputs = {}

for (const r of routes) {
  try {
    const html = renderRoute(r)
    if (!html || html.length < 50) throw new Error('渲染内容为空或过短')
    outputs[r] = { ok: true, len: html.length, snippet: html.substring(0, 40).replace(/\n/g, '') }
    pass++
  } catch (e) {
    outputs[r] = { ok: false, err: e.message }
    fail++
  }
}

// ---- 输出 ----
console.log('=== 路由渲染测试 ===')
for (const r of routes) {
  const o = outputs[r]
  if (o.ok) console.log(`✅ ${r}  (${o.len}字符) ${o.snippet}...`)
  else console.log(`❌ ${r}  ${o.err}`)
}

// 关键内容检查
function contentCheck(html, keyword, label) {
  const ok = html && html.indexOf(keyword) !== -1
  console.log(`${ok ? '✅' : '❌'} ${label}: ${ok ? '找到「' + keyword + '」' : '未找到「' + keyword + '」'}`)
  return ok
}

console.log('\n=== 关键功能内容检查 ===')
const homeHtml = renderRoute('#/')
contentCheck(homeHtml, '核心板块', '首页核心板块')
contentCheck(homeHtml, 'AI 教学周报', '首页周报入口')
contentCheck(homeHtml, '个性化学习梳理', '首页个性化学习入口')
contentCheck(homeHtml, '基础配置', '首页教师配置入口')

renderRoute('#/publish')
contentCheck(appEl._innerHTML, 'AI 已自动将发布内容分类', '发布区AI分类条')

renderRoute('#/publishNew')
contentCheck(appEl._innerHTML, '发布格式', '多格式发布')
contentCheck(appEl._innerHTML, '截止查看时间', '截止时间字段')

renderRoute('#/message')
contentCheck(appEl._innerHTML, 'AI 问题汇总表', '留言区AI汇总表')

// 开启留言审核后，教师应看到审核按钮（种子数据已在上方注入）
renderRoute('#/message')
contentCheck(appEl._innerHTML, '待审核', '留言审核状态')
contentCheck(appEl._innerHTML, '通过', '审核通过按钮')
renderRoute('#/discussion')
contentCheck(appEl._innerHTML, 'AI 每日讨论总结', '讨论区每日总结入口')

renderRoute('#/discussionDetail/disc_1')
contentCheck(appEl._innerHTML, 'AI 一键解答', 'AI解答按钮')

renderRoute('#/review')
contentCheck(appEl._innerHTML, '教师复核权限', '答疑复核中心')

renderRoute('#/aiSummary')
contentCheck(appEl._innerHTML, 'AI 内容智能总结', 'AI总结中心')

renderRoute('#/profile')
contentCheck(appEl._innerHTML, 'AI 答疑复核', '个人中心教师菜单')

console.log(`\n=== 结果: ${pass} 通过 / ${fail} 失败 ===`)
process.exit(fail > 0 ? 1 : 0)
