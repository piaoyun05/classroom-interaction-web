// 网页版主应用 - hash 路由 + 页面渲染 + 交互
// 完整实现方案需求：课程创建/权限/配置 + 三大板块 + AI解答 + 全局AI问答
(function (global) {
  'use strict'

  var Util = global.Util
  var AIEngine = global.AIEngine

  // ========== 全局状态 ==========
  var STORAGE_KEYS = {
    publishes: 'web_publishes',
    messages: 'web_messages',
    discussions: 'web_discussions',
    weeklyReport: 'web_weekly_report',
    aiHistory: 'web_ai_history',
    user: 'web_user',
    course: 'web_course',
    config: 'web_config',
    dailyReport: 'web_daily_report'
  }

  var DEFAULT_CONFIG = {
    pageStyle: 'default',
    messageReviewEnabled: false,
    discussionPostEnabled: true,
    aiAnswerEnabled: true
  }

  // 教师切到学生视角时暂存的数据，切回教师视角时恢复
  var studentDataCache = null

  var state = {
    publishes: [],
    messages: [],
    discussions: [],
    weeklyReport: {},
    dailyReport: {},
    aiHistory: [],
    user: { name: '小明同学', role: 'student' },
    course: null,
    config: JSON.parse(JSON.stringify(DEFAULT_CONFIG))
  }

  function loadState() {
    var mock = global.MockData
    state.publishes = Util.storage.get(STORAGE_KEYS.publishes, mock.publishes)
    state.messages = Util.storage.get(STORAGE_KEYS.messages, mock.messages)
    state.discussions = Util.storage.get(STORAGE_KEYS.discussions, mock.discussions)
    state.weeklyReport = Util.storage.get(STORAGE_KEYS.weeklyReport, mock.weeklyReport)
    state.dailyReport = Util.storage.get(STORAGE_KEYS.dailyReport, {})
    state.aiHistory = Util.storage.get(STORAGE_KEYS.aiHistory, [])
    state.user = Util.storage.get(STORAGE_KEYS.user, { name: '小明同学', role: 'student' })
    state.course = Util.storage.get(STORAGE_KEYS.course, null)
    state.config = Object.assign({}, DEFAULT_CONFIG, Util.storage.get(STORAGE_KEYS.config, {}))
  }

  function saveState() {
    Util.storage.set(STORAGE_KEYS.publishes, state.publishes)
    Util.storage.set(STORAGE_KEYS.messages, state.messages)
    Util.storage.set(STORAGE_KEYS.discussions, state.discussions)
    Util.storage.set(STORAGE_KEYS.weeklyReport, state.weeklyReport)
    Util.storage.set(STORAGE_KEYS.dailyReport, state.dailyReport)
    Util.storage.set(STORAGE_KEYS.aiHistory, state.aiHistory)
    Util.storage.set(STORAGE_KEYS.user, state.user)
    Util.storage.set(STORAGE_KEYS.course, state.course)
    Util.storage.set(STORAGE_KEYS.config, state.config)
  }

  // 重置课程：密码校验（与切换视角同一密码）→ 先导出PDF → 完成后重置
  function resetData() {
    if (!isTeacher()) return
    var pwd = Util.storage.get('web_role_pwd', '') || ''
    if (pwd) {
      var html =
        '<div class="modal-title">🗑️ 重置课程</div>' +
        '<div class="modal-sub">将先导出课程PDF，再清空课程数据。请输入切换视角密码：</div>' +
        '<input id="reset-pwd-input" class="form-input" type="password" placeholder="输入密码" style="width:100%;margin:12px 0"/>' +
        '<div class="modal-actions">' +
        '<button class="btn-primary modal-btn" data-action="confirm-reset-data">确认重置</button>' +
        '<button class="btn-ghost modal-btn" data-action="close-modal">取消</button>' +
        '</div>'
      showModal(html)
      return
    }
    exportThenReset()
  }

  function confirmResetData() {
    var input = document.getElementById('reset-pwd-input')
    var pwd = Util.storage.get('web_role_pwd', '') || ''
    if (!input || input.value.trim() !== pwd) { Util.showToast('密码错误'); return }
    hideModal()
    exportThenReset()
  }

  // 先打开导出PDF打印窗口，打印完成后回调 doResetCourse
  function exportThenReset() {
    exportCoursePdf(true)
  }

  function doResetCourse() {
    if (!isTeacher()) return
    // 重置为完全空白：不保留原课程数据，也不回填示例数据
    state.publishes = []
    state.messages = []
    state.discussions = []
    state.weeklyReport = {}
    state.dailyReport = {}
    state.aiHistory = []
    state.course = null
    state.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG))
    saveState()
    Util.showToast('课程已重置', 'success')
    renderApp()
  }

  // ========== 课程信息 PDF 导出（在当前窗口渲染，完全避免弹窗拦截） ==========
  var EXPORT_CSS = '.export-content{font-family:"Microsoft YaHei","PingFang SC",sans-serif;padding:28px;color:#333;line-height:1.6}' +
    '.export-content h1{font-size:22px;border-bottom:2px solid #4a7cff;padding-bottom:8px;margin-bottom:6px}' +
    '.export-content h2{font-size:16px;color:#4a7cff;margin:22px 0 8px;border-left:4px solid #4a7cff;padding-left:8px}' +
    '.export-content .meta{color:#888;font-size:12px;margin:2px 0}' +
    '.export-content .item{margin:8px 0;padding:10px;border:1px solid #e5e7eb;border-radius:6px;page-break-inside:avoid}' +
    '.export-content .item .t{font-weight:bold}' +
    '.export-content .item .m{color:#888;font-size:12px;margin:2px 0}' +
    '.export-content .item .c{margin-top:4px;white-space:pre-wrap;font-size:13px}' +
    '.export-content .tag{display:inline-block;background:#eef2ff;color:#4a7cff;font-size:11px;border-radius:4px;padding:1px 6px;margin-right:4px}'

  function buildExportBodyHTML() {
    var c = state.course || {}
    var esc = Util.escapeHtml
    var fmt = function (t) { return t ? Util.formatDate(t) : '' }
    var parts = []

    parts.push('<h1>' + esc(c.name || '课程信息') + '</h1>')
    parts.push('<p class="meta">导出时间：' + new Date().toLocaleString() + '</p>')
    parts.push('<p class="meta">班级：' + esc(c.className || '-') + ' ｜ 学期：' + esc(c.semester || '-') + ' ｜ 教师：' + esc(c.teacherName || '-') + '</p>')

    parts.push('<h2>概览</h2>')
    parts.push('<p>教师发布 <b>' + state.publishes.length + '</b> 条 ｜ 学生留言 <b>' + state.messages.length + '</b> 条 ｜ 讨论帖 <b>' + state.discussions.length + '</b> 条</p>')

    parts.push('<h2>一、课程信息</h2>')
    parts.push('<div class="item"><p>课程名称：' + esc(c.name || '-') + '</p><p>授课班级：' + esc(c.className || '-') + '</p><p>授课学期：' + esc(c.semester || '-') + '</p><p>任课教师：' + esc(c.teacherName || '-') + '</p><p>课程简介：' + esc(c.intro || '暂无') + '</p></div>')

    parts.push('<h2>二、教师发布内容（' + state.publishes.length + ' 条）</h2>')
    if (!state.publishes.length) parts.push('<p>暂无发布内容</p>')
    state.publishes.forEach(function (p) {
      var cat = (Util.CATEGORY_MAP[p.category] && Util.CATEGORY_MAP[p.category].label) || p.category || ''
      parts.push('<div class="item"><div class="t">' + esc(p.title || '') + (p.isTop ? '（置顶）' : '') + '</div>' +
        '<div class="m">' + esc(cat) + ' ｜ 发布：' + esc(p.author || '') + ' ｜ ' + fmt(p.createTime) + (p.deadline ? ' ｜ 截止：' + fmt(p.deadline) : '') + '</div>' +
        '<div class="c">' + esc(p.content || p.summary || '') + '</div></div>')
    })

    parts.push('<h2>三、学生留言（' + state.messages.length + ' 条）</h2>')
    if (!state.messages.length) parts.push('<p>暂无留言</p>')
    state.messages.forEach(function (m) {
      var st = m.status === 'pending' ? '待审核' : (m.status === 'rejected' ? '已驳回' : (m.replied ? '已回复' : '未回复'))
      parts.push('<div class="item"><div class="t">' + esc(m.studentName || '匿名') + ' ｜ ' + esc(m.type || '') + '</div>' +
        '<div class="m">' + fmt(m.createTime) + ' ｜ ' + st + '</div>' +
        '<div class="c">' + esc(m.content || '') + '</div>' +
        (m.reply ? '<div class="c">教师回复：' + esc(m.reply) + '</div>' : '') + '</div>')
    })

    parts.push('<h2>四、学生讨论（' + state.discussions.length + ' 条）</h2>')
    if (!state.discussions.length) parts.push('<p>暂无讨论</p>')
    state.discussions.forEach(function (d) {
      var dcat = (Util.DISCUSSION_CATEGORY_MAP[d.category] && Util.DISCUSSION_CATEGORY_MAP[d.category].label) || d.category || ''
      var commentsHtml = (d.comments && d.comments.length)
        ? '<div class="c">' + d.comments.map(function (cm) { return '💬 ' + esc(cm.author || '') + '：' + esc(cm.content || '') }).join('<br/>') + '</div>'
        : ''
      parts.push('<div class="item"><div class="t">' + esc(d.title || '') + '</div>' +
        '<div class="m">' + esc(d.author || '') + ' ｜ ' + esc(dcat) + ' ｜ ' + fmt(d.createTime) + (d.likes ? ' ｜ 👍 ' + d.likes : '') + '</div>' +
        '<div class="c">' + esc(d.content || '') + '</div>' +
        commentsHtml +
        (d.aiAnswer ? '<div class="c">🤖 AI 解答：' + esc(d.aiAnswer) + '</div>' : '') + '</div>')
    })

    var cfg = state.config || {}
    parts.push('<h2>五、课程配置</h2>')
    parts.push('<div class="item"><p>页面样式：' + (cfg.pageStyle === 'compact' ? '紧凑风格' : '默认风格') + '</p>' +
      '<p>留言审核开关：' + (cfg.messageReviewEnabled ? '开启' : '关闭') + '</p>' +
      '<p>讨论区发言权限：' + (cfg.discussionPostEnabled ? '开启' : '关闭') + '</p>' +
      '<p>AI 答疑开关：' + (cfg.aiAnswerEnabled ? '开启' : '关闭') + '</p></div>')

    return parts.join('')
  }

  // 在当前窗口渲染导出页面（顶部工具栏：打印/确认重置/关闭），完全避开弹窗拦截
  function exportCoursePdf(withReset) {
    var app = document.getElementById('app')
    var header = document.querySelector('.header')
    var tabbar = document.querySelector('.tabbar')
    // 隐藏主界面头部与底部 Tab，避免打印时混入
    if (header) header.style.display = 'none'
    if (tabbar) tabbar.style.display = 'none'

    var resetBtn = withReset
      ? '<button data-action="confirm-reset-export" style="padding:10px 18px;background:#e11d48;color:#fff;border:none;border-radius:6px;cursor:pointer;margin-left:8px;font-size:14px">✅ 已导出，确认重置课程</button>'
      : ''

    app.innerHTML = '<style>' + EXPORT_CSS + '</style>' +
      '<div style="background:#fff;min-height:100vh;padding:0 0 40px">' +
      '<div style="position:sticky;top:0;z-index:50;background:#fff;padding:14px 18px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:8px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">' +
      '<button data-action="do-print" style="padding:10px 20px;background:#4a7cff;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">🖨️ 打印 / 另存为PDF</button>' +
      resetBtn +
      '<button data-action="close-export" style="margin-left:auto;padding:10px 16px;background:#f3f4f6;border:none;border-radius:6px;cursor:pointer">关闭返回</button>' +
      '</div>' +
      '<div class="export-content">' + buildExportBodyHTML() + '</div>' +
      '</div>'
    window.scrollTo(0, 0)
  }

  // ========== 云端同步（GitHub Gist） ==========
  // 后端未配置时 backendOn() 为 false，以下方法全部静默降级为本地存储。
  function backendOn() {
    return (typeof Backend !== 'undefined') && Backend && Backend.isEnabled()
  }
  function syncPush(table, row) {
    if (!backendOn() || !state.course) return
    var r = Object.assign({}, row)
    if (table !== 'courses') r.courseId = state.course.id
    Backend.upsert(table, r)
  }
  function syncDelete(table, id) {
    if (!backendOn() || !state.course) return
    Backend.remove(table, id, state.course.id)
  }
  // 从云端拉取当前课程的共享数据并覆盖本地
  function syncFromBackend() {
    if (!backendOn() || !state.course) return
    Backend.loadAll(state.course.id).then(function (shared) {
      if (!shared) return
      if (shared.publishes && shared.publishes.length) state.publishes = shared.publishes
      if (shared.messages && shared.messages.length) state.messages = shared.messages
      if (shared.discussions && shared.discussions.length) state.discussions = shared.discussions
      if (shared.config) state.config = Object.assign({}, DEFAULT_CONFIG, shared.config)
      saveState()
      renderApp()
    })
  }
  // 开启实时订阅：云端任意变更后自动刷新
  function startRealtime() {
    if (!backendOn() || !state.course) return
    Backend.unsubscribe()
    Backend.subscribe(state.course.id, function () {
      syncFromBackend()
    })
  }
  // 将当前演示内容同步到云端，使云端成为唯一真相源（师生视图一致）
  function seedToBackend() {
    if (!backendOn() || !state.course) return
    ;(state.publishes || []).forEach(function (p) { syncPush('publishes', p) })
    ;(state.messages || []).forEach(function (m) { syncPush('messages', m) })
    ;(state.discussions || []).forEach(function (d) { syncPush('discussions', d) })
  }

  function isTeacher() {
    return state.user.role === 'teacher'
  }

  // ========== 路由 ==========
  function parseRoute() {
    var hash = window.location.hash || '#/'
    var raw = hash.replace(/^#\/?/, '')
    var queryIdx = raw.indexOf('?')
    var query = {}
    var pathPart = raw
    if (queryIdx !== -1) {
      pathPart = raw.substring(0, queryIdx)
      var qs = raw.substring(queryIdx + 1)
      qs.split('&').forEach(function (pair) {
        var kv = pair.split('=')
        if (kv[0]) query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '')
      })
    }
    var parts = pathPart.split('/')
    return { page: parts[0] || 'home', id: parts[1], query: query }
  }

  function isTabPage(page) {
    return ['home', 'discussion', 'ai', 'profile'].indexOf(page) !== -1
  }

  var TAB_ITEMS = [
    { key: 'home', label: '首页', icon: '🏠', hash: '#/' },
    { key: 'discussion', label: '讨论区', icon: '💬', hash: '#/discussion' },
    { key: 'message', label: '留言区', icon: '💌', hash: '#/message' },
    { key: 'ai', label: 'AI问答', icon: '🤖', hash: '#/ai' },
    { key: 'profile', label: '我的', icon: '👤', hash: '#/profile' }
  ]

  function activeTabKey(route) {
    if (route.page === 'home' || route.page.indexOf('publish') === 0 || route.page === 'createCourse' || route.page === 'courseCreated' || route.page === 'teacherConfig' || route.page === 'aiSummary' || route.page === 'personalStudy') return 'home'
    if (route.page === 'message' || route.page.indexOf('message') === 0) return 'message'
    if (route.page === 'discussion' || route.page.indexOf('discussion') === 0 || route.page === 'review') return 'discussion'
    if (route.page === 'ai') return 'ai'
    if (route.page === 'profile') return 'profile'
    return 'home'
  }

  // ========== 通用组件 ==========
  var PAGE_TITLES = {
    home: 'AI赋能课堂互动',
    createCourse: '创建课程小程序',
    courseCreated: '课程创建成功',
    student: '加入课程',
    teacherConfig: '教师基础配置',
    publish: '教师信息发布区',
    publishDetail: '内容详情',
    publishNew: '发布新内容',
    message: '学生留言区',
    messageNew: '留言',
    discussion: '学生讨论区',
    discussionDetail: '讨论详情',
    discussionNew: '发起讨论',
    ai: 'AI智能问答',
    aiSummary: 'AI 内容总结',
    personalStudy: '个性化学习梳理',
    profile: '个人中心',
    review: 'AI 答疑复核中心'
  }

  function getTitle(page) {
    return PAGE_TITLES[page] || 'AI赋能课堂互动'
  }

  function renderHeader(route) {
    var back = isTabPage(route.page) ? '' :
      '<div class="header-back" data-action="go-back">‹</div>'
    var extra = ''
    if (route.page === 'publish' && isTeacher()) {
      extra = '<div class="header-action" data-action="new-publish">＋ 发布</div>'
    }
    if (route.page === 'message') {
      extra = '<div class="header-action" data-action="new-message">＋ 留言</div>'
    }
    if (route.page === 'discussion') {
      var canPost = isTeacher() || state.config.discussionPostEnabled
      if (canPost) extra = '<div class="header-action" data-action="new-discussion">＋ 发帖</div>'
    }
    var title = getTitle(route.page)
    if (route.page === 'home' && state.course) title = state.course.name
    return '<header class="header">' + back + '<h1 class="header-title">' + title + '</h1>' + extra + '</header>'
  }

  function renderTabBar(route) {
    var active = activeTabKey(route)
    var items = TAB_ITEMS.map(function (t) {
      return '<a class="tab-item ' + (active === t.key ? 'active' : '') + '" href="' + t.hash + '">' +
        '<span class="tab-icon">' + t.icon + '</span>' +
        '<span class="tab-label">' + t.label + '</span></a>'
    }).join('')
    return '<nav class="tabbar">' + items + '</nav>'
  }

  // ========== 工具渲染函数 ==========
  // 按时间就近排布：发表时间最近的排在顶部（降序）
  function sortByTimeDesc(arr) {
    return (arr || []).slice().sort(function (a, b) {
      return (b.createTime || 0) - (a.createTime || 0)
    })
  }

  // 读取图片文件并压缩为 dataURL（限制尺寸与体积，避免撑爆 localStorage/云端）
  function compressImageFile(file, maxW, quality) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader()
      reader.onerror = function () { reject(new Error('读取文件失败')) }
      reader.onload = function (e) {
        var img = new Image()
        img.onerror = function () { reject(new Error('图片解析失败')) }
        img.onload = function () {
          var w = img.width
          var h = img.height
          var scale = Math.min(1, maxW / w)
          var canvas = document.createElement('canvas')
          canvas.width = Math.round(w * scale)
          canvas.height = Math.round(h * scale)
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', quality))
        }
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
    })
  }

  // 表单图片选择区：已选图片缩略图 + 上传按钮
  function renderImagePicker(list, actionPrefix, maxCount) {
    var html = ''
    if (list && list.length) {
      html = '<div class="img-picker-preview">' + list.map(function (src, i) {
        return '<div class="img-picker-item"><img src="' + src + '" alt="已选图片"/>' +
          '<span class="img-picker-del" data-action="' + actionPrefix + '-remove" data-id="' + i + '">✕</span></div>'
      }).join('') + '</div>'
    }
    var canAdd = !list || list.length < maxCount
    html += '<div class="img-picker-row">' +
      (canAdd ? '<button type="button" class="btn-ghost img-picker-btn" data-action="' + actionPrefix + '-pick">📷 上传图片' +
        (maxCount > 1 ? '（' + (list ? list.length : 0) + '/' + maxCount + '）' : '') + '</button>' : '') +
      '</div>'
    return html
  }

  // 文件/视频附件列表：显示已选文件名+大小 + 上传按钮
  function renderFilePicker(list, actionPrefix, pickerAction) {
    var html = ''
    if (list && list.length) {
      html = '<div class="file-picker-list">' + list.map(function (f, i) {
        return '<div class="file-picker-item"><span class="file-picker-icon">📄</span>' +
          '<span class="file-picker-name">' + Util.escapeHtml(f.name) + '</span>' +
          '<span class="file-picker-size">' + Util.escapeHtml(f.size || '') + '</span>' +
          '<span class="file-picker-del" data-action="' + actionPrefix + '-remove" data-id="' + i + '">✕</span></div>'
      }).join('') + '</div>'
    }
    html += '<button type="button" class="btn-ghost img-picker-btn" data-action="' + (pickerAction || (actionPrefix + '-pick')) + '">📎 选择文件</button>'
    return html
  }

  function renderTag(catMap, key) {
    var item = catMap[key]
    // 兜底：未匹配 key、key 为空/对象格式缺失时，显示安全文本
    if (!item || typeof item.label !== 'string') {
      var fb = (typeof key === 'string' && key) ? key : '未分类'
      return '<span class="tag">' + fb + '</span>'
    }
    return '<span class="tag ' + (item.color || '') + '">' + item.label + '</span>'
  }

  function renderPublishCard(p) {
    var tag = renderTag(Util.CATEGORY_MAP, p.category)
    var top = p.isTop ? '<span class="badge-top">置顶</span>' : ''
    var deadline = p.deadline ? '<div class="pub-deadline">⏰ 截止：' + Util.formatDate(p.deadline) + '</div>' : ''
    var typeIcon = (Util.CONTENT_TYPE_MAP[p.type] || Util.CONTENT_TYPE_MAP.text).icon + ' '
    var imgs = (p.images || []).map(function (img) {
      return '<img class="msg-img" src="' + img + '" alt="发布图片" data-action="view-image" data-src="' + img + '"/>'
    }).join('')
    return '<div class="card pub-card" data-action="open-publish-detail" data-id="' + p.id + '">' +
      '<div class="card-top">' + tag + top + '<span class="card-time">' + Util.timeAgo(p.createTime) + '</span></div>' +
      '<h3 class="card-title">' + typeIcon + Util.escapeHtml(p.title) + '</h3>' +
      '<p class="card-summary">' + Util.escapeHtml(p.summary || p.content) + '</p>' +
      imgs +
      '<div class="card-meta">' + deadline +
      '<span>👨‍🏫 ' + Util.escapeHtml(p.author) + '</span>' +
      '<span>👁 ' + p.views + '</span>' +
      (isTeacher() ? '<span class="pub-admin" data-action="toggle-publish-top" data-id="' + p.id + '">' + (p.isTop ? '取消置顶' : '置顶') + '</span>' +
        '<span class="pub-admin pub-del" data-action="delete-publish" data-id="' + p.id + '">删除</span>' : '') +
      '</div></div>'
  }

  function renderMessageCard(m) {
    var tag = renderTag(Util.MESSAGE_TYPE_MAP, m.type)
    var status = ''
    var reviewBtns = ''
    if (m.status === 'pending') {
      status = '<span class="msg-pending">⏳ 待审核</span>'
      if (isTeacher()) {
        reviewBtns = '<div class="reply-actions"><button class="btn-reply btn-approve" data-action="approve-message" data-id="' + m.id + '">通过</button>' +
          '<button class="btn-reject" data-action="reject-message" data-id="' + m.id + '">拒绝</button></div>'
      }
    } else if (m.status === 'rejected') {
      status = '<span class="msg-rejected">🚫 未通过</span>'
    }
    var replied = ''
    if (m.replied) {
      replied = '<div class="reply-box"><div class="reply-label">教师回复</div><div class="reply-text">' + Util.escapeHtml(m.reply) + '</div></div>'
    } else if (m.status !== 'rejected') {
      replied = isTeacher()
        ? '<div class="reply-actions"><span class="reply-pending">⏳ 待回复</span><button class="btn-reply" data-action="reply-message" data-id="' + m.id + '">回复</button></div>'
        : '<div class="reply-pending">⏳ 待教师回复</div>'
    }
    var images = (m.images || []).map(function (img) {
      return '<img class="msg-img" src="' + img + '" alt="留言图片" data-action="view-image" data-src="' + img + '"/>'
    }).join('')
    return '<div class="card msg-card">' +
      '<div class="card-top">' + tag + status + '<span class="card-time">' + Util.timeAgo(m.createTime) + '</span></div>' +
      '<div class="msg-name">' + (m.isAnonymous ? '🕶 匿名同学' : Util.escapeHtml(m.studentName)) + '</div>' +
      '<p class="msg-content">' + Util.escapeHtml(m.content) + '</p>' +
      images +
      replied +
      reviewBtns +
      '</div>'
  }

  function renderDiscussionCard(d) {
    var tag = renderTag(Util.DISCUSSION_CATEGORY_MAP, d.category)
    var aiBadge = d.aiAnswer ? '<span class="badge-ai">🤖 已解答</span>' : ''
    var hot = (d.aiAnswer && d.likes > 10) ? '<span class="badge-hot">🔥 高频</span>' : ''
    var top = d.isTop ? '<span class="badge-top">置顶</span>' : ''
    var imgs = (d.images || []).map(function (img) {
      return '<img class="msg-img msg-img-sm" src="' + img + '" alt="讨论图片" data-action="view-image" data-src="' + img + '"/>'
    }).join('')
    return '<div class="card disc-card" data-action="open-discussion-detail" data-id="' + d.id + '">' +
      '<div class="card-top">' + tag + top + aiBadge + hot + '<span class="card-time">' + Util.timeAgo(d.createTime) + '</span></div>' +
      '<h3 class="card-title">' + Util.escapeHtml(d.title) + '</h3>' +
      '<p class="card-summary">' + Util.escapeHtml(d.content) + '</p>' +
      imgs +
      '<div class="card-meta">' +
      '<span>👤 ' + Util.escapeHtml(d.author) + '</span>' +
      '<span>👍 ' + d.likes + '</span>' +
      '<span>💬 ' + (d.comments || []).length + '</span>' +
      '</div></div>'
  }

  // ========== 弹窗 ==========
  function showModal(html) {
    var modal = document.getElementById('modal')
    if (!modal) return
    modal.innerHTML = '<div class="modal-mask" data-action="close-modal"></div>' +
      '<div class="modal-panel">' + html + '</div>'
    modal.style.display = 'block'
  }

  function hideModal() {
    var modal = document.getElementById('modal')
    if (modal) modal.style.display = 'none'
  }

  // 查看大图（点击缩略图放大）
  function viewImage(src) {
    if (!src) return
    showModal('<div class="view-image-wrap"><img class="view-image" src="' + src + '" alt="查看图片"/></div>' +
      '<div class="modal-actions"><button class="btn-primary modal-btn" data-action="close-modal">关闭</button></div>')
  }

  // ========== 页面渲染 ==========
  function renderCreateCourse() {
    return '<div class="page">' +
      '<div class="course-create-hero">' +
      '<div class="cc-icon">🎓</div>' +
      '<div class="cc-title">创建你的专属课程小程序</div>' +
      '<div class="cc-sub">本平台无通用首页，每位教师创建专属课程互动空间</div>' +
      '</div>' +
      '<div class="form-card card">' +
      '<div class="form-label">课程名称 <span class="form-required">*</span></div>' +
      '<input id="course-name" class="form-input" placeholder="如：高等数学" maxlength="20"/>' +
      '<div class="form-label">授课班级 <span class="form-required">*</span></div>' +
      '<input id="course-class" class="form-input" placeholder="如：计科2401班" maxlength="20"/>' +
      '<div class="form-label">授课学期 <span class="form-required">*</span></div>' +
      '<input id="course-semester" class="form-input" placeholder="如：2025-2026学年第二学期" maxlength="30"/>' +
      '<div class="form-label">教师姓名 <span class="form-required">*</span></div>' +
      '<input id="course-teacher" class="form-input" placeholder="如：张教授" maxlength="20"/>' +
      '<div class="form-label">课程简介</div>' +
      '<textarea id="course-intro" class="form-textarea" style="min-height:80px" placeholder="简要介绍课程内容与学习目标"></textarea>' +
      '<div class="form-ai-hint">✨ 创建后你将拥有课程管理权限（发布/审核/置顶/配置）</div>' +
      '<button class="btn-primary" data-action="create-course">创 建 课 程</button>' +
      '<button class="btn-ghost" data-action="use-sample-course">使用示例课程快速体验</button>' +
      '</div></div>'
  }

  function renderCourseCreated() {
    var c = state.course
    var data = Util.b64Encode({ id: c.id, name: c.name, className: c.className, semester: c.semester, teacherName: c.teacherName, intro: c.intro })
    var baseUrl = window.location.href.split('#')[0]
    var studentUrl = baseUrl + '#/student?d=' + data
    var qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=' + encodeURIComponent(studentUrl)
    return '<div class="page">' +
      '<div class="qr-success-hero">' +
      '<div class="qr-success-icon">✅</div>' +
      '<div class="qr-success-title">课程创建成功！</div>' +
      '<div class="qr-success-sub">学生扫描下方二维码即可加入课程</div>' +
      '</div>' +
      '<div class="card qr-card">' +
      '<div class="qr-course-name">📚 ' + Util.escapeHtml(c.name) + '</div>' +
      '<div class="qr-course-info">' +
      '<div>🏫 ' + Util.escapeHtml(c.className) + ' · ' + Util.escapeHtml(c.semester) + '</div>' +
      '<div>👨‍🏫 授课教师：' + Util.escapeHtml(c.teacherName) + '</div>' +
      '</div>' +
      '<div class="qr-img-box"><img class="qr-img" src="' + qrSrc + '" alt="课程二维码"/></div>' +
      '<div class="qr-tip">📱 学生用手机扫码即可进入学生视角</div>' +
      '<div class="qr-link-box">' +
      '<input id="student-url" class="qr-link-input" value="' + Util.escapeHtml(studentUrl) + '" readonly/>' +
      '<button class="btn-primary qr-copy-btn" data-action="copy-student-url">复制链接</button>' +
      '</div>' +
      '</div>' +
      '<button class="btn-primary" data-action="enter-course">进入课程首页 →</button>' +
      '</div>'
  }

  function renderTeacherConfig() {
    var cfg = state.config
    var aiKey = Util.storage.get('web_ai_key', '') || ''
    var aiStatus = aiKey
      ? '<div class="config-desc">✅ AI key 已配置（本浏览器生效）</div>'
      : '<div class="config-desc">⚠️ 未配置，AI 使用内置模板回复</div>'
    var rolePwd = Util.storage.get('web_role_pwd', '') || ''
    var rolePwdStatus = rolePwd
      ? '<div class="config-desc">✅ 切换视角密码已设置（本浏览器生效）</div>'
      : '<div class="config-desc">⚠️ 未设置，切换视角无需密码</div>'
    return '<div class="page">' +
      '<div class="form-card card">' +
      '<div class="config-title">⚙️ 课程基础配置</div>' +
      '<div class="config-sub">以下设置仅超级管理员可见</div>' +
      '<div class="form-label">课程信息</div>' +
      '<div class="config-info">' +
      '<div>📚 ' + Util.escapeHtml(state.course.name) + '</div>' +
      '<div>🏫 ' + Util.escapeHtml(state.course.className) + ' · ' + Util.escapeHtml(state.course.semester) + '</div>' +
      '<div>👨‍🏫 ' + Util.escapeHtml(state.course.teacherName || '未设置') + '</div>' +
      '</div>' +
      '<div class="form-label">页面展示样式</div>' +
      '<div class="config-row">' +
      '<button class="config-btn ' + (cfg.pageStyle === 'default' ? 'active' : '') + '" data-action="set-style" data-val="default">默认风格</button>' +
      '<button class="config-btn ' + (cfg.pageStyle === 'compact' ? 'active' : '') + '" data-action="set-style" data-val="compact">紧凑风格</button>' +
      '</div>' +
      '<div class="config-switch-row">' +
      '<div><div class="config-label">留言审核开关</div><div class="config-desc">开启后学生留言需教师审核通过才展示</div></div>' +
      '<div class="switch ' + (cfg.messageReviewEnabled ? 'on' : '') + '" data-action="toggle-config" data-key="messageReviewEnabled"><div class="switch-knob"></div></div>' +
      '</div>' +
      '<div class="config-switch-row">' +
      '<div><div class="config-label">讨论区发言权限</div><div class="config-desc">开启后学生可自由发帖讨论</div></div>' +
      '<div class="switch ' + (cfg.discussionPostEnabled ? 'on' : '') + '" data-action="toggle-config" data-key="discussionPostEnabled"><div class="switch-knob"></div></div>' +
      '</div>' +
      '<div class="config-switch-row">' +
      '<div><div class="config-label">AI 答疑开关</div><div class="config-desc">控制讨论区「AI一键解答」按钮是否可用</div></div>' +
      '<div class="switch ' + (cfg.aiAnswerEnabled ? 'on' : '') + '" data-action="toggle-config" data-key="aiAnswerEnabled"><div class="switch-knob"></div></div>' +
      '</div>' +
      '<div class="form-label">AI 大模型配置（DeepSeek）</div>' +
      '<div class="config-desc">用于「AI一键解答」「AI全局问答」。key 仅保存在本浏览器本地，不会上传。</div>' +
      '<div class="config-row">' +
      '<input id="ai-key-input" class="form-input" type="password" placeholder="sk-..." value="' + Util.escapeHtml(aiKey) + '" style="flex:1;min-width:0"/>' +
      '<button class="config-btn active" data-action="save-ai-key" style="flex:0 0 auto">保存</button>' +
      '</div>' +
      aiStatus +
      '<div class="form-label">切换视角密码</div>' +
      '<div class="config-desc">学生/教师视角相互切换时需验证。留空保存即清除密码。</div>' +
      '<div class="config-row">' +
      '<input id="role-pwd-input" class="form-input" type="password" placeholder="设置切换视角密码" style="flex:1;min-width:0"/>' +
      '<button class="config-btn active" data-action="save-role-pwd" style="flex:0 0 auto">保存</button>' +
      '</div>' +
      rolePwdStatus +
      '</div></div>'
  }

  function renderHome() {
    if (!state.course) return renderCreateCourse()
    var unrepliedCount = state.messages.filter(function (m) { return !m.replied && m.status !== 'rejected' }).length
    var aiDiscussed = state.discussions.filter(function (d) { return d.aiAnswer }).length
    return '<div class="page home-page">' +
      '<div class="home-hero">' +
      '<div class="hero-greet">' + (isTeacher() ? '教师您好，' : '你好，') + Util.escapeHtml(state.user.name) + ' 👋</div>' +
      '<div class="hero-sub">' + Util.escapeHtml(state.course.name) + ' · ' + Util.escapeHtml(state.course.className) +
      ' · ' + Util.escapeHtml(state.course.semester) + '</div>' +
      (isTeacher() ? '<div class="hero-ai" data-action="open-weekly"><span class="hero-ai-icon">✨</span> 查看本周 AI 教学周报</div>' : '') +
      '</div>' +
      '<div class="section-title">核心板块</div>' +
      '<div class="module-grid">' +
      '<div class="module-card" data-action="go-publish">' +
      '<div class="module-icon icon-publish">📢</div>' +
      '<div class="module-name">教师信息发布区</div>' +
      '<div class="module-desc">' + state.publishes.length + ' 条内容 · AI 自动分类</div>' +
      '</div>' +
      '<div class="module-card" data-action="go-message">' +
      '<div class="module-icon icon-message">💌</div>' +
      '<div class="module-name">学生留言区</div>' +
      '<div class="module-desc">' + unrepliedCount + ' 条待回复 · AI 问题汇总</div>' +
      '</div>' +
      '<div class="module-card" data-action="go-discussion">' +
      '<div class="module-icon icon-discussion">💬</div>' +
      '<div class="module-name">学生讨论区</div>' +
      '<div class="module-desc">' + state.discussions.length + ' 个帖子 · AI 一键解答</div>' +
      '</div>' +
      '</div>' +
      '<div class="section-title">AI 智能服务</div>' +
      '<div class="ai-service-grid">' +
      '<div class="ai-service-card" data-action="go-ai">' +
      '<div class="ai-service-icon">🤖</div><div class="ai-service-name">全局智能问答</div>' +
      '<div class="ai-service-desc">基于课程知识库精准作答</div></div>' +
      '<div class="ai-service-card" data-action="go-summary-today">' +
      '<div class="ai-service-icon">📅</div><div class="ai-service-name">今日课堂重点</div>' +
      '<div class="ai-service-desc">一键总结今日学习内容</div></div>' +
      '<div class="ai-service-card" data-action="go-summary-errors">' +
      '<div class="ai-service-icon">📌</div><div class="ai-service-name">高频错题知识点</div>' +
      '<div class="ai-service-desc">梳理易错点与薄弱环节</div></div>' +
      '<div class="ai-service-card" data-action="go-personal-study">' +
      '<div class="ai-service-icon">🎯</div><div class="ai-service-name">个性化学习梳理</div>' +
      '<div class="ai-service-desc">针对个人学习记录生成建议</div></div>' +
      '</div>' +
      '<div class="section-title">最新动态</div>' +
      '<div class="latest-list">' + latestItems() + '</div>' +
      '<div class="ai-quick-entry" data-action="go-ai">' +
      '<div class="ai-quick-icon">🤖</div>' +
      '<div class="ai-quick-info">' +
      '<div class="ai-quick-title">AI 智能问答助手</div>' +
      '<div class="ai-quick-desc">已解答 ' + aiDiscussed + ' 个讨论问题 · 随时提问</div>' +
      '</div><div class="ai-quick-arrow">›</div>' +
      '</div>' +
      '</div>'
  }

  function latestItems() {
    var items = []
    sortByTimeDesc(state.publishes).slice(0, 2).forEach(function (p) {
      items.push('<div class="latest-item" data-action="open-publish-detail" data-id="' + p.id + '">' +
        '<span class="latest-icon">📢</span>' +
        '<div class="latest-body"><div class="latest-title">' + Util.escapeHtml(p.title) + '</div>' +
        '<div class="latest-time">' + Util.timeAgo(p.createTime) + '</div></div></div>')
    })
    sortByTimeDesc(state.discussions).slice(0, 2).forEach(function (d) {
      items.push('<div class="latest-item" data-action="open-discussion-detail" data-id="' + d.id + '">' +
        '<span class="latest-icon">💬</span>' +
        '<div class="latest-body"><div class="latest-title">' + Util.escapeHtml(d.title) + '</div>' +
        '<div class="latest-time">' + Util.timeAgo(d.createTime) + '</div></div></div>')
    })
    if (!items.length) return '<div class="empty">暂无动态</div>'
    return items.join('')
  }

  function renderPublishList() {
    var tabs = [
      { key: 'all', label: '全部' },
      { key: 'notice', label: '课程通知' },
      { key: 'knowledge', label: '知识点' },
      { key: 'homework', label: '作业' },
      { key: 'keypoint', label: '重点' }
    ]
    var current = tabState.publishFilter || 'all'
    var list = sortByTimeDesc(state.publishes)
    if (current !== 'all') list = list.filter(function (p) { return p.category === current })

    var tabHtml = tabs.map(function (t) {
      return '<div class="filter-tab ' + (current === t.key ? 'active' : '') + '" data-action="filter-publish" data-key="' + t.key + '">' + t.label + '</div>'
    }).join('')

    var listHtml = list.length
      ? list.map(renderPublishCard).join('')
      : '<div class="empty">暂无内容</div>'

    return '<div class="page">' +
      '<div class="ai-org-bar">🤖 AI 已自动将发布内容分类为 通知 / 知识点 / 作业 / 重点</div>' +
      '<div class="filter-bar">' + tabHtml + '</div>' +
      '<div class="list-area">' + listHtml + '</div>' +
      '</div>'
  }

  function renderPublishDetail(id) {
    var p = state.publishes.find(function (x) { return x.id === id })
    if (!p) return '<div class="page"><div class="empty">内容不存在或已删除</div></div>'
    var attachments = (p.attachments || []).map(function (a) {
      return '<div class="attach-item">📎 ' + Util.escapeHtml(a.name) + ' <span class="attach-size">' + a.size + '</span></div>'
    }).join('')
    var images = (p.images || []).map(function (img) {
      return '<img class="detail-img" src="' + img + '" alt="内容图片" data-action="view-image" data-src="' + img + '"/>'
    }).join('')
    var link = p.link ? '<div class="attach-item">🔗 <a href="' + Util.escapeHtml(p.link) + '" target="_blank" rel="noopener">' + Util.escapeHtml(p.linkTitle || p.link) + '</a></div>' : ''
    var video = p.video ? '<div class="video-box"><div class="video-placeholder">🎬 ' + Util.escapeHtml(p.videoTitle || '课程视频') + '</div><div class="video-link">' + Util.escapeHtml(p.video) + '</div></div>' : ''

    return '<div class="page">' +
      '<div class="detail-card card">' +
      '<div class="card-top">' + renderTag(Util.CATEGORY_MAP, p.category) +
      (p.isTop ? '<span class="badge-top">置顶</span>' : '') +
      '<span class="card-time">' + Util.formatTime(p.createTime) + '</span></div>' +
      '<h2 class="detail-title">' + Util.escapeHtml(p.title) + '</h2>' +
      '<div class="detail-author">👨‍🏫 ' + Util.escapeHtml(p.author) + ' · 👁 ' + p.views + ' 次浏览</div>' +
      (p.deadline ? '<div class="pub-deadline">⏰ 截止查看：' + Util.formatTime(p.deadline) + '</div>' : '') +
      '<div class="detail-content">' + Util.nl2br(p.content) + '</div>' +
      images + link + video +
      (attachments ? '<div class="attach-list">' + attachments + '</div>' : '') +
      '</div>' +
      (p.category === 'homework'
        ? '<div class="homework-tip" data-action="new-message">📝 提交作业 → 前往留言区提交</div>'
        : '') +
      '</div>'
  }

  function renderPublishNew() {
    var types = [
      { key: 'text', label: '📝 文字' },
      { key: 'image', label: '🖼️ 图片' },
      { key: 'file', label: '📎 文件' },
      { key: 'link', label: '🔗 链接' },
      { key: 'video', label: '🎬 视频' }
    ]
    var typeHtml = types.map(function (t) {
      return '<div class="form-tag ' + (formState.publishType === t.key ? 'active' : '') + '" data-action="pick-publish-type" data-key="' + t.key + '">' + t.label + '</div>'
    }).join('')

    var typeExtras = ''
    if (formState.publishType === 'image') {
      typeExtras = '<div class="form-label">图片（可上传或填链接）</div>' +
        renderImagePicker(formState.pubImages, 'pub-img', 3) +
        '<input type="file" id="pub-img-file" accept="image/*" multiple style="display:none"/>' +
        '<div class="form-label" style="margin-top:8px">或粘贴图片链接</div>' +
        '<input id="pub-image" class="form-input" placeholder="https://example.com/image.jpg"/>'
    } else if (formState.publishType === 'file') {
      typeExtras = '<div class="form-label">文件附件</div>' +
        renderFilePicker(formState.pubFiles, 'pub-file') +
        '<input type="file" id="pub-file-input" style="display:none"/>' +
        '<div class="form-ai-hint">📎 可选择课件/PDF/Word 等附件；超过云端限制的文件请上传到网盘后粘贴链接</div>' +
        '<div class="form-label" style="margin-top:8px">或填写附件信息</div>' +
        '<div class="form-row" style="gap:8px"><input id="pub-file-name" class="form-input" placeholder="如：第三章课件.pdf" style="flex:2"/><input id="pub-file-size" class="form-input" placeholder="大小（2.3MB）" style="flex:1"/></div>'
    } else if (formState.publishType === 'link') {
      typeExtras = '<div class="form-label">链接地址 <span class="form-required">*</span></div>' +
        '<input id="pub-link" class="form-input" placeholder="https://..."/>' +
        '<div class="form-label">链接标题</div>' +
        '<input id="pub-link-title" class="form-input" placeholder="链接显示名称"/>'
    } else if (formState.publishType === 'video') {
      typeExtras = '<div class="form-label">视频文件（仅记录信息）</div>' +
        renderFilePicker(formState.pubFiles, 'pub-file', 'pub-video-pick') +
        '<input type="file" id="pub-video-input" accept="video/*" style="display:none"/>' +
        '<div class="form-ai-hint">🎬 视频文件较大，建议上传到 B 站/YouTube 后粘贴链接（下方必填）</div>' +
        '<div class="form-label" style="margin-top:8px">视频链接 <span class="form-required">*</span></div>' +
        '<input id="pub-video" class="form-input" placeholder="https://..."/>' +
        '<div class="form-label">视频标题</div>' +
        '<input id="pub-video-title" class="form-input" placeholder="如：课堂讲解录像"/>'
    }

    return '<div class="page form-page">' +
      '<div class="form-card card">' +
      '<div class="form-label">发布格式 <span class="form-required">*</span></div>' +
      '<div class="form-tags">' + typeHtml + '</div>' +
      '<div class="form-label">标题 <span class="form-required">*</span></div>' +
      '<input id="pub-title" class="form-input" placeholder="请输入标题" maxlength="50"/>' +
      '<div class="form-label">内容分类 <span class="form-required">*</span></div>' +
      '<div class="form-tags">' +
      '<div class="form-tag" data-action="pick-publish-cat" data-key="notice">课程通知</div>' +
      '<div class="form-tag" data-action="pick-publish-cat" data-key="knowledge">知识点资料</div>' +
      '<div class="form-tag active" data-action="pick-publish-cat" data-key="homework">作业任务</div>' +
      '<div class="form-tag" data-action="pick-publish-cat" data-key="keypoint">教学重点</div>' +
      '</div>' +
      '<div class="form-label">内容 <span class="form-required">*</span></div>' +
      '<textarea id="pub-content" class="form-textarea" placeholder="请输入详细内容"></textarea>' +
      typeExtras +
      '<div class="form-row">' +
      '<div class="form-label" style="margin-top:0">置顶状态</div>' +
      '<div class="switch ' + (formState.publishIsTop ? 'on' : '') + '" data-action="toggle-publish-top-new"><div class="switch-knob"></div></div>' +
      '</div>' +
      '<div class="form-label">截止查看时间（可选）</div>' +
      '<input id="pub-deadline" class="form-input" type="date"/>' +
      '<div class="form-ai-hint">✨ AI 将自动为你生成摘要并归类</div>' +
      '<button class="btn-primary" data-action="submit-publish">发 布</button>' +
      '</div></div>'
  }

  function renderMessageList() {
    var summary = aiMessageSummary
    var summaryCard = ''
    if (summary && isTeacher()) {
      summaryCard = '<div class="ai-summary-card">' +
        '<div class="ai-summary-header"><span>🤖 AI 问题汇总表</span><span class="ai-summary-close" data-action="close-ai-summary">✕</span></div>' +
        '<div class="ai-summary-text">' + Util.escapeHtml(summary.summary) + '</div>' +
        '<div class="ai-summary-stats">总 ' + summary.total + ' 条 · 未解决 ' + summary.unsolved + ' 条</div>' +
        '<div class="ai-summary-top">📊 高频问题 TOP' + summary.topIssues.length + '：</div>' +
        summary.topIssues.map(function (t) {
          return '<div class="ai-summary-issue">' + t.rank + '. ' + Util.escapeHtml(t.question) + ' <span class="ai-count">×' + t.count + '</span></div>'
        }).join('') +
        '<div class="ai-summary-top" style="margin-top:8px">🕐 未解决问题清单：</div>' +
        summary.unsolvedList.map(function (u) {
          return '<div class="ai-summary-issue">· ' + Util.escapeHtml(u.question) + ' <span class="ai-count">' + Util.escapeHtml(u.time) + '</span></div>'
        }).join('') +
        '</div>'
    }

    var list = sortByTimeDesc(state.messages.filter(function (m) {
      // 未开启审核：全部显示；开启审核：学生只看已通过，教师看全部
      if (!state.config.messageReviewEnabled) return m.status !== 'rejected'
      if (isTeacher()) return true
      return m.status !== 'pending' && m.status !== 'rejected'
    }))

    var listHtml = list.length
      ? list.map(renderMessageCard).join('')
      : '<div class="empty">暂无留言</div>'

    var reviewTip = state.config.messageReviewEnabled && isTeacher()
      ? '<div class="review-tip">🔔 留言审核已开启，共 ' + state.messages.filter(function (m) { return m.status === 'pending' }).length + ' 条待审核</div>'
      : ''

    // AI 问题汇总表入口仅教师可见可用（学生视角禁用）
    var summaryEntry = isTeacher()
      ? '<div class="ai-summary-entry" data-action="ai-message-summary">' +
        '<span class="ai-entry-icon">🤖</span>' +
        '<div class="ai-entry-body"><div class="ai-entry-title">AI 问题汇总表</div>' +
        '<div class="ai-entry-desc">智能梳理 ' + state.messages.length + ' 条留言，' + unrepliedCountNow() + ' 条待回复</div></div>' +
        '<span class="ai-entry-arrow">›</span>' +
        '</div>'
      : ''

    return '<div class="page">' +
      reviewTip +
      summaryEntry +
      summaryCard +
      '<div class="list-area">' + listHtml + '</div>' +
      '</div>'
  }

  function unrepliedCountNow() {
    return state.messages.filter(function (m) { return !m.replied && m.status !== 'rejected' }).length
  }

  function renderMessageNew() {
    var anon = formState.msgMode === 'anon'
    return '<div class="page form-page">' +
      '<div class="form-card card">' +
      '<div class="form-label">留言类型 <span class="form-required">*</span></div>' +
      '<div class="form-tags">' +
      '<div class="form-tag active" data-action="pick-msg-type" data-key="knowledge">知识点疑问</div>' +
      '<div class="form-tag" data-action="pick-msg-type" data-key="homework">作业问题</div>' +
      '<div class="form-tag" data-action="pick-msg-type" data-key="suggest">教学建议</div>' +
      '<div class="form-tag" data-action="pick-msg-type" data-key="other">其他</div>' +
      '</div>' +
      '<div class="form-label">身份 <span class="form-required">*</span></div>' +
      '<div class="form-tags">' +
      '<div class="form-tag' + (anon ? '' : ' active') + '" data-action="pick-msg-mode" data-key="real">实名</div>' +
      '<div class="form-tag' + (anon ? ' active' : '') + '" data-action="pick-msg-mode" data-key="anon">匿名</div>' +
      '</div>' +
      (anon ? '' :
        '<div class="form-label">你的姓名 <span class="form-required">*</span></div>' +
        '<input id="msg-name" class="form-input" placeholder="请输入你的真实姓名" maxlength="20"/>') +
      '<div class="form-label">留言内容 <span class="form-required">*</span></div>' +
      '<textarea id="msg-content" class="form-textarea" placeholder="请描述你的问题或建议"></textarea>' +
      '<div class="form-label">图片（可选，最多3张）</div>' +
      renderImagePicker(formState.msgImages, 'msg-img', 3) +
      '<input type="file" id="msg-img-file" accept="image/*" style="display:none"/>' +
      (state.config.messageReviewEnabled ? '<div class="form-ai-hint">🔔 留言将先经教师审核后展示</div>' : '') +
      '<button class="btn-primary" data-action="submit-message">提 交 留 言</button>' +
      '</div></div>'
  }

  function renderDiscussionList() {
    var tabs = [
      { key: 'all', label: '全部' },
      { key: 'question', label: '课堂疑问' },
      { key: 'exercise', label: '习题答疑' },
      { key: 'knowledge', label: '知识点' },
      { key: 'experience', label: '学习经验' }
    ]
    var current = tabState.discussionFilter || 'all'
    var list = sortByTimeDesc(state.discussions)
    if (current !== 'all') list = list.filter(function (d) { return d.category === current })

    var tabHtml = tabs.map(function (t) {
      return '<div class="filter-tab ' + (current === t.key ? 'active' : '') + '" data-action="filter-discussion" data-key="' + t.key + '">' + t.label + '</div>'
    }).join('')

    var aiHot = state.discussions.filter(function (d) { return d.aiAnswer }).length
    var folded = state.discussions.filter(function (d) { return d.folded }).length

    var listHtml = list.length
      ? list.map(renderDiscussionCard).join('')
      : '<div class="empty">暂无讨论帖</div>'

    return '<div class="page">' +
      '<div class="disc-hot">🔥 讨论区活跃 ' + state.discussions.length + ' 帖 · AI 已解答 ' + aiHot + ' 帖' +
      (folded ? ' · 已折叠 ' + folded + ' 条重复' : '') + '</div>' +
      '<div class="ai-summary-entry" data-action="open-daily-discussion" style="margin-bottom:8px">' +
      '<span class="ai-entry-icon">📋</span>' +
      '<div class="ai-entry-body"><div class="ai-entry-title">AI 每日讨论总结</div>' +
      '<div class="ai-entry-desc">梳理今日核心知识点、共性疑惑与优质观点</div></div>' +
      '<span class="ai-entry-arrow">›</span>' +
      '</div>' +
      '<div class="filter-bar">' + tabHtml + '</div>' +
      '<div class="list-area">' + listHtml + '</div>' +
      '</div>'
  }

  function renderDiscussionDetail(id) {
    var d = state.discussions.find(function (x) { return x.id === id })
    if (!d) return '<div class="page"><div class="empty">帖子不存在或已删除</div></div>'

    var commentsHtml = (d.comments || []).map(function (c) {
      var replyTo = c.replyTo ? '<span class="comment-reply-to">回复 @' + Util.escapeHtml(c.replyTo) + '：</span>' : ''
      return '<div class="comment-item">' +
        '<div class="comment-avatar">' + Util.escapeHtml(c.author[0]) + '</div>' +
        '<div class="comment-body">' +
        '<div class="comment-name">' + Util.escapeHtml(c.author) +
        ' <span class="comment-time">' + Util.timeAgo(c.createTime) + '</span></div>' +
        '<div class="comment-text">' + replyTo + Util.escapeHtml(c.content) + '</div>' +
        '<div class="comment-reply-btn" data-action="reply-comment" data-id="' + d.id + '" data-author="' + Util.escapeHtml(c.author) + '">回复</div>' +
        '</div></div>'
    }).join('') || '<div class="empty-small">还没有评论，快来抢沙发～</div>'

    var aiBlock = ''
    if (d.aiAnswer) {
      // 已有 AI 解答：教师/学生都可查看
      aiBlock = '<div class="ai-answer-card">' +
        '<div class="ai-answer-header"><span>🤖 AI 智能解答' + (d.aiPinned ? ' ⭐' : '') + (d.aiReviewed ? ' · 教师已复核' : '') + '</span>' +
        '<span class="ai-answer-time">' + Util.timeAgo(d.aiAnswerTime) + '</span></div>' +
        '<div class="ai-answer-content">' + Util.nl2br(d.aiAnswer) + '</div>' +
        (isTeacher() ? '<div class="ai-admin-actions"><button class="btn-sm" data-action="review-ai" data-id="' + d.id + '">✏️ 复核/修改</button>' +
          '<button class="btn-sm" data-action="pin-ai" data-id="' + d.id + '">' + (d.aiPinned ? '取消置顶' : '置顶答疑') + '</button></div>' : '') +
        '</div>'
    } else if (isTeacher() && state.config.aiAnswerEnabled) {
      // AI 一键解答仅教师可见可用（学生视角禁用）
      aiBlock = '<button class="btn-ai" id="ai-answer-btn" data-action="ai-answer" data-id="' + d.id + '">' +
        '<span class="btn-ai-icon">🤖</span> AI 一键解答</button>' +
        '<div id="ai-loading" class="ai-loading" style="display:none">AI 思考中<span class="dots">…</span></div>'
    } else if (isTeacher()) {
      aiBlock = '<div class="ai-off-tip">🤖 AI 答疑已由教师关闭</div>'
    }

    var likeClass = d.liked ? ' liked' : ''
    var likeText = d.liked ? '已赞' : '点赞'
    var replyHint = pendingReplyAuthor ? '<div class="reply-hint">回复 @' + Util.escapeHtml(pendingReplyAuthor) + ' <span class="reply-cancel" data-action="cancel-reply">取消</span></div>' : ''

    return '<div class="page">' +
      '<div class="detail-card card">' +
      '<div class="card-top">' + renderTag(Util.DISCUSSION_CATEGORY_MAP, d.category) +
      (d.isTop ? '<span class="badge-top">置顶</span>' : '') +
      '<span class="card-time">' + Util.formatTime(d.createTime) + '</span></div>' +
      '<h2 class="detail-title">' + Util.escapeHtml(d.title) + '</h2>' +
      '<div class="detail-author">👤 ' + Util.escapeHtml(d.author) + '</div>' +
      '<div class="detail-content">' + Util.nl2br(d.content) + '</div>' +
      '<div class="detail-images">' + (d.images || []).map(function (img) {
        return '<img class="detail-img" src="' + img + '" alt="讨论图片" data-action="view-image" data-src="' + img + '"/>'
      }).join('') + '</div>' +
      '<div class="detail-actions">' +
      '<div class="detail-like' + likeClass + '" data-action="like-discussion" data-id="' + d.id + '">👍 ' + likeText + ' (' + d.likes + ')</div>' +
      '</div>' +
      '</div>' +

      aiBlock +

      '<div class="section-title-inline">评论 ' + (d.comments || []).length + '</div>' +
      '<div class="comments-list">' + commentsHtml + '</div>' +

      replyHint +
      '<div class="comment-input-bar">' +
      '<input id="comment-input" class="comment-input" data-id="' + d.id + '" placeholder="写下你的评论…" maxlength="200"/>' +
      '<button class="btn-comment" data-action="add-comment" data-id="' + d.id + '">发送</button>' +
      '</div>' +
      '</div>'
  }

  function renderDiscussionNew() {
    var anon = formState.discMode === 'anon'
    return '<div class="page form-page">' +
      '<div class="form-card card">' +
      '<div class="form-label">标题 <span class="form-required">*</span></div>' +
      '<input id="disc-title" class="form-input" placeholder="请输入标题" maxlength="50"/>' +
      '<div class="form-label">帖子分类 <span class="form-required">*</span></div>' +
      '<div class="form-tags">' +
      '<div class="form-tag active" data-action="pick-disc-cat" data-key="question">课堂疑问</div>' +
      '<div class="form-tag" data-action="pick-disc-cat" data-key="exercise">习题答疑</div>' +
      '<div class="form-tag" data-action="pick-disc-cat" data-key="knowledge">知识点讨论</div>' +
      '<div class="form-tag" data-action="pick-disc-cat" data-key="experience">学习经验</div>' +
      '</div>' +
      '<div class="form-label">身份 <span class="form-required">*</span></div>' +
      '<div class="form-tags">' +
      '<div class="form-tag' + (anon ? '' : ' active') + '" data-action="pick-disc-mode" data-key="real">实名</div>' +
      '<div class="form-tag' + (anon ? ' active' : '') + '" data-action="pick-disc-mode" data-key="anon">匿名</div>' +
      '</div>' +
      (anon ? '' :
        '<div class="form-label">你的姓名 <span class="form-required">*</span></div>' +
        '<input id="disc-name" class="form-input" placeholder="请输入你的真实姓名" maxlength="20"/>') +
      '<div class="form-label">内容 <span class="form-required">*</span></div>' +
      '<textarea id="disc-content" class="form-textarea" placeholder="请输入讨论内容"></textarea>' +
      '<div class="form-label">图片（可选，最多3张）</div>' +
      renderImagePicker(formState.discImages, 'disc-img', 3) +
      '<input type="file" id="disc-img-file" accept="image/*" style="display:none"/>' +
      '<div class="form-ai-hint">🤖 AI 将自动过滤违规内容</div>' +
      '<button class="btn-primary" data-action="submit-discussion">发 布 帖 子</button>' +
      '</div></div>'
  }

  function renderAI() {
    var quick = ['极限的ε-δ定义如何理解？', '如何判断函数的连续性？', '导数和微分的关系是什么？', '作业第3题怎么解？']
    var quickHtml = quick.map(function (q) {
      return '<div class="quick-item" data-action="quick-ask" data-q="' + Util.escapeHtml(q) + '">' + Util.escapeHtml(q) + '</div>'
    }).join('')

    // 每次问答以条目形式显示，标题即问题本身；最新问答排在顶部
    var chatHtml = sortByTimeDesc(state.aiHistory).map(function (h) {
      return '<div class="qa-card card">' +
        '<div class="qa-title">❓ ' + Util.escapeHtml(h.question) + '</div>' +
        '<div class="qa-answer">' + Util.nl2br(h.answer) + '</div>' +
        '</div>'
    }).join('')

    if (!chatHtml) {
      chatHtml = '<div class="chat-empty">🤖 我是 AI 学习助手，关于' + (state.course ? Util.escapeHtml(state.course.name) : '课程') + '的任何问题都可以问我</div>'
    }

    return '<div class="page ai-page">' +
      '<div class="ai-summary-entry" data-action="go-summary-center" style="flex-shrink:0">' +
      '<span class="ai-entry-icon">📊</span>' +
      '<div class="ai-entry-body"><div class="ai-entry-title">AI 内容智能总结中心</div>' +
      '<div class="ai-entry-desc">今日重点 · 本周内容 · 未解决问题 · 高频错题</div></div>' +
      '<span class="ai-entry-arrow">›</span>' +
      '</div>' +
      '<div class="quick-row">' + quickHtml + '</div>' +
      '<div class="chat-area" id="chat-area">' + chatHtml + '</div>' +
      '<div class="chat-input-bar">' +
      '<input id="ai-input" class="chat-input" placeholder="输入你的问题…" maxlength="200"/>' +
      '<button class="btn-chat" data-action="send-ai">发送</button>' +
      '</div>' +
      '</div>'
  }

  function renderAISummary(type) {
    var quickSummaries = aiSummaryResult
    if (!quickSummaries) {
      // 等待用户点击触发
      quickSummaries = { type: type, title: 'AI 内容总结', items: ['点击下方按钮生成总结…'], suggestion: '' }
    }
    var itemsHtml = quickSummaries.items.map(function (i) {
      return '<div class="summary-item">• ' + Util.escapeHtml(i) + '</div>'
    }).join('')

    return '<div class="page">' +
      '<div class="form-card card">' +
      '<div class="config-title">🤖 AI 内容智能总结</div>' +
      '<div class="config-sub">基于课程全部发布内容、留言、讨论数据生成</div>' +
      '<div class="summary-btn-grid">' +
      '<button class="summary-btn" data-action="do-summary" data-type="today">📅 今日课堂重点</button>' +
      '<button class="summary-btn" data-action="do-summary" data-type="week">📚 本周学习内容</button>' +
      '<button class="summary-btn" data-action="do-summary" data-type="unsolved">🕐 未解决问题</button>' +
      '<button class="summary-btn" data-action="do-summary" data-type="errors">📌 高频错题知识点</button>' +
      '</div>' +
      '<div class="summary-result">' +
      '<div class="summary-result-title">' + Util.escapeHtml(quickSummaries.title) + '</div>' +
      itemsHtml +
      (quickSummaries.suggestion ? '<div class="weekly-suggest">💡 ' + Util.escapeHtml(quickSummaries.suggestion) + '</div>' : '') +
      '</div>' +
      '</div></div>'
  }

  function renderPersonalStudy() {
    var data = personalStudyData
    if (!data) {
      data = { userName: state.user.name, myMessageCount: 0, myPostCount: 0, weakPoints: [], suggestions: [], studyPlan: '' }
    }
    var weakHtml = data.weakPoints.length
      ? data.weakPoints.map(function (w) { return '<div class="weak-item">⚠️ ' + Util.escapeHtml(w) + '</div>' }).join('')
      : '<div class="empty-small">暂无薄弱点数据</div>'
    var sugHtml = data.suggestions.length
      ? data.suggestions.map(function (s) { return '<div class="sug-item">✅ ' + Util.escapeHtml(s) + '</div>' }).join('')
      : '<div class="empty-small">暂无建议</div>'

    return '<div class="page">' +
      '<div class="form-card card">' +
      '<div class="config-title">🎯 个性化学习梳理</div>' +
      '<div class="config-sub">基于 ' + Util.escapeHtml(data.userName) + ' 的留言与提问记录生成</div>' +
      '<div class="personal-stats">' +
      '<div class="stat-item"><div class="stat-num">' + data.myMessageCount + '</div><div class="stat-label">我的留言</div></div>' +
      '<div class="stat-item"><div class="stat-num">' + data.myPostCount + '</div><div class="stat-label">我的帖子</div></div>' +
      '</div>' +
      '<div class="form-label">📉 个人薄弱知识点</div>' + weakHtml +
      '<div class="form-label">📝 个性化学习建议</div>' + sugHtml +
      '<div class="weekly-suggest">📖 学习计划：' + Util.escapeHtml(data.studyPlan || '') + '</div>' +
      '</div></div>'
  }

  function renderProfile() {
    var u = state.user
    var myPosts = state.discussions.filter(function (d) { return d.author === u.name }).length
    var roleLabel = u.role === 'teacher' ? '教师 · 超级管理员' : '学生'
    var teacherMenu = isTeacher()
      ? '<div class="menu-item" data-action="go-share-qr">📱 分享课程二维码<span class="menu-arrow">›</span></div>' +
        '<div class="menu-item" data-action="go-teacher-config">⚙️ 课程基础配置<span class="menu-arrow">›</span></div>' +
        '<div class="menu-item" data-action="go-review">🛡️ AI 答疑复核<span class="menu-arrow">›</span></div>' +
        '<div class="menu-item" data-action="open-daily">📅 AI 每日日报<span class="menu-arrow">›</span></div>'
      : ''
    return '<div class="page">' +
      '<div class="profile-header">' +
      '<div class="profile-avatar">' + Util.escapeHtml((u.name || '小')[0]) + '</div>' +
      '<div class="profile-info">' +
      '<div class="profile-name">' + Util.escapeHtml(u.name) + '</div>' +
      '<div class="profile-role">' + roleLabel + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="profile-stats">' +
      '<div class="stat-item"><div class="stat-num">' + myPosts + '</div><div class="stat-label">我的帖子</div></div>' +
      '<div class="stat-item"><div class="stat-num">' + state.aiHistory.length + '</div><div class="stat-label">AI提问</div></div>' +
      '<div class="stat-item"><div class="stat-num">' + state.messages.length + '</div><div class="stat-label">留言区</div></div>' +
      '</div>' +
      '<div class="menu-list">' +
      '<div class="menu-item" data-action="go-publish">📢 教师信息发布区<span class="menu-arrow">›</span></div>' +
      '<div class="menu-item" data-action="go-message">💌 学生留言区<span class="menu-arrow">›</span></div>' +
      '<div class="menu-item" data-action="go-discussion">💬 我的讨论<span class="menu-arrow">›</span></div>' +
      teacherMenu +
      '<div class="menu-item" data-action="go-personal-study">🎯 个性化学习梳理<span class="menu-arrow">›</span></div>' +
      (isTeacher()
        ? '<div class="menu-item" data-action="open-weekly">📊 AI 教学周报<span class="menu-arrow">›</span></div>' +
          '<div class="menu-item" data-action="export-course">📄 导出课程信息(PDF)<span class="menu-arrow">›</span></div>' +
          '<div class="menu-item" data-action="reset-data">🗑️ 重置课程<span class="menu-arrow">›</span></div>'
        : '') +
      '<div class="menu-item" data-action="toggle-role">🔄 切换为' + (isTeacher() ? '学生视角' : '教师视角') + '<span class="menu-arrow">›</span></div>' +
      '</div>' +
      '<div class="profile-footer">AI赋能课堂互动 · 网页演示版</div>' +
      '</div>'
  }

  function renderReview() {
    var withAnswer = state.discussions.filter(function (d) { return d.aiAnswer })
    var listHtml = withAnswer.length
      ? withAnswer.map(function (d) {
        return '<div class="card review-card">' +
          '<div class="card-top">' + renderTag(Util.DISCUSSION_CATEGORY_MAP, d.category) +
          (d.aiPinned ? '<span class="badge-top">置顶</span>' : '') +
          '<span class="card-time">' + Util.timeAgo(d.createTime) + '</span></div>' +
          '<div class="review-q">❓ ' + Util.escapeHtml(d.title) + '</div>' +
          '<div class="review-a">🤖 ' + Util.escapeHtml((d.aiAnswer || '').substring(0, 80)) + '…</div>' +
          '<div class="ai-admin-actions">' +
          '<button class="btn-sm" data-action="review-ai" data-id="' + d.id + '">✏️ 复核/修改</button>' +
          '<button class="btn-sm" data-action="pin-ai" data-id="' + d.id + '">' + (d.aiPinned ? '取消置顶' : '置顶答疑') + '</button>' +
          '<button class="btn-sm btn-danger" data-action="delete-ai" data-id="' + d.id + '">🗑️ 删除答疑</button>' +
          '</div>' +
          '</div>'
      }).join('')
      : '<div class="empty">暂无可复核的 AI 答疑</div>'

    return '<div class="page">' +
      '<div class="review-tip">🛡️ 教师复核权限：可修改、补充、置顶优质答疑，删除错误答疑</div>' +
      listHtml +
      '</div>'
  }

  // ========== 表单临时状态 ==========
  var tabState = {
    publishFilter: 'all',
    discussionFilter: 'all'
  }
  var formState = {
    publishCat: 'homework',
    publishType: 'text',
    publishIsTop: false,
    msgType: 'knowledge',
    discCat: 'question',
    msgMode: 'real',
    discMode: 'real',
    msgImages: [],
    discImages: [],
    pubImages: [],
    pubFiles: []
  }
  var aiMessageSummary = null
  var aiSummaryResult = null
  var personalStudyData = null
  var pendingReplyAuthor = null

  // ========== 渲染入口 ==========
  function renderApp() {
    var route = parseRoute()
    var app = document.getElementById('app')
    var content = ''
    var page = route.page

    // 未创建课程时强制进入创建页（允许停留在创建页和扫码加入页）
    if (!state.course && page !== 'createCourse' && page !== 'student') {
      content = renderCreateCourse()
      app.innerHTML = renderHeader({ page: 'createCourse' }) + content + renderTabBar({ page: 'createCourse' })
      window.scrollTo(0, 0)
      return
    }

    // 学生视角禁止访问教师专属页面
    if (!isTeacher() && (page === 'review' || page === 'teacherConfig' || page === 'courseCreated')) {
      content = renderHome()
      app.innerHTML = renderHeader({ page: 'home' }) + content + renderTabBar({ page: 'home' })
      window.scrollTo(0, 0)
      return
    }

    if (page === '' || page === 'home') content = renderHome()
    else if (page === 'createCourse') content = renderCreateCourse()
    else if (page === 'courseCreated') content = renderCourseCreated()
    else if (page === 'student') { initStudentView(route.query.d); return }
    else if (page === 'teacherConfig') content = renderTeacherConfig()
    else if (page === 'publish') content = renderPublishList()
    else if (page === 'publishDetail') content = renderPublishDetail(route.id)
    else if (page === 'publishNew') content = renderPublishNew()
    else if (page === 'message') content = renderMessageList()
    else if (page === 'messageNew') content = renderMessageNew()
    else if (page === 'discussion') content = renderDiscussionList()
    else if (page === 'discussionDetail') content = renderDiscussionDetail(route.id)
    else if (page === 'discussionNew') content = renderDiscussionNew()
    else if (page === 'ai') content = renderAI()
    else if (page === 'aiSummary') content = renderAISummary(route.id || 'today')
    else if (page === 'personalStudy') content = renderPersonalStudy()
    else if (page === 'review') content = renderReview()
    else if (page === 'profile') content = renderProfile()
    else content = renderHome()

    app.innerHTML = renderHeader(route) + content + renderTabBar(route)
    window.scrollTo(0, 0)

    // AI 页自动滚到底部
    if (page === 'ai') {
      setTimeout(function () {
        var chat = document.getElementById('chat-area')
        if (chat) chat.scrollTop = chat.scrollHeight
      }, 50)
    }
  }

  // ========== 业务操作 ==========
  function navigate(hash) {
    if (window.location.hash === hash) {
      renderApp()
    } else {
      window.location.hash = hash
    }
  }

  function goBack() {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      navigate('#/')
    }
  }

  function createCourse() {
    if (state.course && !isTeacher()) { Util.showToast('学生不可创建课程'); return }
    var name = document.getElementById('course-name').value.trim()
    var className = document.getElementById('course-class').value.trim()
    var semester = document.getElementById('course-semester').value.trim()
    var teacher = document.getElementById('course-teacher').value.trim()
    var intro = document.getElementById('course-intro').value.trim()
    if (!name) { Util.showToast('请输入课程名称'); return }
    if (!className) { Util.showToast('请输入授课班级'); return }
    if (!semester) { Util.showToast('请输入授课学期'); return }
    if (!teacher) { Util.showToast('请输入教师姓名'); return }

    state.course = {
      id: Util.genId(),
      name: name,
      className: className,
      semester: semester,
      teacherName: teacher,
      intro: intro || '暂无课程简介',
      createdAt: Date.now()
    }
    state.user.role = 'teacher'
    state.user.name = teacher
    saveState()
    // 写入云端，供学生扫码同步
    syncPush('courses', state.course)
    Backend && Backend.isEnabled && Backend.upsert('course_config', Object.assign({ courseId: state.course.id }, state.config))
    seedToBackend()
    startRealtime()
    Util.showToast('课程小程序创建成功', 'success')
    navigate('#/courseCreated')
  }

  function useSampleCourse() {
    var mock = global.MockData
    state.course = JSON.parse(JSON.stringify(mock.course))
    state.user.role = 'teacher'
    state.user.name = mock.course.teacherName || '张教授'
    saveState()
    syncPush('courses', state.course)
    Backend && Backend.isEnabled && Backend.upsert('course_config', Object.assign({ courseId: state.course.id }, state.config))
    seedToBackend()
    startRealtime()
    Util.showToast('已加载示例课程', 'success')
    navigate('#/courseCreated')
  }

  function applyStudentData(course, shared) {
    state.course = course
    state.user = { name: '同学', role: 'student' }
    // 学生视角只显示云端真实数据；云端无数据时保持空白（不显示示例/原课程数据）
    state.publishes = (shared && shared.publishes) ? shared.publishes : []
    state.messages = (shared && shared.messages) ? shared.messages : []
    state.discussions = (shared && shared.discussions) ? shared.discussions : []
    if (shared && shared.config) state.config = Object.assign({}, DEFAULT_CONFIG, shared.config)
    state.dailyDiscussion = {}
    state.aiHistory = []
    saveState()
    Util.showToast('已加入「' + course.name + '」', 'success')
    navigate('#/')
  }

  function initStudentView(data) {
    var course
    try {
      course = Util.b64Decode(data)
    } catch (e) {
      var app = document.getElementById('app')
      app.innerHTML = renderHeader({ page: 'home' }) +
        '<div class="page"><div class="card"><div class="empty">⚠️ 二维码数据无效，请重新扫码</div></div></div>' +
        renderTabBar({ page: 'home' })
      return
    }
    // 尝试从云端拉取真实课程与共享数据（按课程 id 同步）
    if (backendOn()) {
      Backend.loadGist(course.id).then(function (shared) {
        var real = (shared && shared.course) ? shared.course : course
        applyStudentData(real, shared)
        startRealtime()
      }).catch(function () { applyStudentData(course, null) })
    } else {
      applyStudentData(course, null)
    }
  }

  function copyStudentUrl() {
    var input = document.getElementById('student-url')
    if (!input) return
    input.select()
    try {
      document.execCommand('copy')
      Util.showToast('链接已复制到剪贴板', 'success')
    } catch (e) {
      Util.showToast('复制失败，请手动选择复制')
    }
  }

  function pickPublishCat(key) {
    formState.publishCat = key
    var tags = document.querySelectorAll('.form-tag[data-action="pick-publish-cat"]')
    tags.forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-key') === key)
    })
  }

  function pickPublishType(key) {
    formState.publishType = key
    renderApp()
  }

  function pickMsgType(key) {
    formState.msgType = key
    var tags = document.querySelectorAll('.form-tag[data-action="pick-msg-type"]')
    tags.forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-key') === key)
    })
  }

  function pickMsgMode(key) {
    formState.msgMode = key
    renderApp()
  }

  function pickDiscMode(key) {
    formState.discMode = key
    renderApp()
  }

  // 触发隐藏文件选择框
  function pickMsgImage() {
    var input = document.getElementById('msg-img-file')
    if (input) input.click()
  }
  function pickDiscImage() {
    var input = document.getElementById('disc-img-file')
    if (input) input.click()
  }
  function pickPubImage() {
    var input = document.getElementById('pub-img-file')
    if (input) input.click()
  }
  function pickPubFile() {
    var input = document.getElementById('pub-file-input')
    if (input) input.click()
  }
  function pickPubVideo() {
    var input = document.getElementById('pub-video-input')
    if (input) input.click()
  }

  // 文件选择后压缩并加入列表
  function onMsgImageChosen(file) {
    if (!file || !/^image\//.test(file.type)) { Util.showToast('请选择图片文件'); return }
    if ((formState.msgImages || []).length >= 3) { Util.showToast('最多上传3张图片'); return }
    compressImageFile(file, 900, 0.75).then(function (dataUrl) {
      formState.msgImages = formState.msgImages || []
      formState.msgImages.push(dataUrl)
      renderApp()
    }).catch(function () { Util.showToast('图片处理失败，请换一张') })
  }
  function onDiscImageChosen(file) {
    if (!file || !/^image\//.test(file.type)) { Util.showToast('请选择图片文件'); return }
    if ((formState.discImages || []).length >= 3) { Util.showToast('最多上传3张图片'); return }
    compressImageFile(file, 900, 0.75).then(function (dataUrl) {
      formState.discImages = formState.discImages || []
      formState.discImages.push(dataUrl)
      renderApp()
    }).catch(function () { Util.showToast('图片处理失败，请换一张') })
  }
  function onPubImageChosen(file) {
    if (!file || !/^image\//.test(file.type)) { Util.showToast('请选择图片文件'); return }
    if (formState.pubImages.length >= 3) { Util.showToast('最多上传3张图片'); return }
    compressImageFile(file, 900, 0.75).then(function (dataUrl) {
      formState.pubImages.push(dataUrl)
      renderApp()
    }).catch(function () { Util.showToast('图片处理失败，请换一张') })
  }

  // 文件/视频附件：只读元数据（不读取文件内容）
  function onPubFileChosen(file) {
    if (!file) { Util.showToast('请选择文件'); return }
    if (formState.pubFiles.length >= 5) { Util.showToast('最多5个附件'); return }
    formState.pubFiles.push({ name: file.name, size: formatFileSize(file.size) })
    renderApp()
  }
  function onPubVideoChosen(file) {
    if (!file) { Util.showToast('请选择视频文件'); return }
    if (formState.pubFiles.length >= 3) { Util.showToast('最多3个视频附件'); return }
    formState.pubFiles.push({ name: file.name, size: formatFileSize(file.size) })
    renderApp()
  }
  function formatFileSize(bytes) {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
  }

  function removeMsgImage(index) {
    formState.msgImages.splice(index, 1)
    renderApp()
  }
  function removeDiscImage(index) {
    formState.discImages.splice(index, 1)
    renderApp()
  }
  function removePubImage(index) {
    formState.pubImages.splice(index, 1)
    renderApp()
  }
  function removePubFile(index) {
    formState.pubFiles.splice(index, 1)
    renderApp()
  }

  function pickDiscCat(key) {
    formState.discCat = key
    var tags = document.querySelectorAll('.form-tag[data-action="pick-disc-cat"]')
    tags.forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-key') === key)
    })
  }

  async function submitPublish() {
    var title = document.getElementById('pub-title').value.trim()
    var content = document.getElementById('pub-content').value.trim()
    if (!title) { Util.showToast('请输入标题'); return }
    if (!content) { Util.showToast('请输入内容'); return }

    // 多格式字段
    var type = formState.publishType
    var pub = {
      id: Util.genId(),
      title: title,
      category: formState.publishCat,
      content: content,
      author: state.user.name || '张教授',
      createTime: Date.now(),
      isTop: formState.publishIsTop,
      views: 0,
      type: type
    }
    var deadlineVal = document.getElementById('pub-deadline')
    if (deadlineVal && deadlineVal.value) {
      pub.deadline = new Date(deadlineVal.value).getTime()
    }
    if (type === 'image') {
      // 上传的图片（base64）+ 可选链接
      if (formState.pubImages.length) pub.images = formState.pubImages.slice()
      var img = document.getElementById('pub-image').value.trim()
      if (img && pub.images) pub.images.push(img)
      else if (img) pub.images = [img]
    } else if (type === 'file') {
      // 上传的附件元数据 + 手动填写兜底
      var atts = formState.pubFiles.slice()
      var fname = document.getElementById('pub-file-name').value.trim()
      if (fname) atts.push({ name: fname, size: document.getElementById('pub-file-size').value.trim() || '未知' })
      if (atts.length) pub.attachments = atts
    } else if (type === 'link') {
      var link = document.getElementById('pub-link').value.trim()
      if (link) {
        pub.link = link
        pub.linkTitle = document.getElementById('pub-link-title').value.trim() || link
      }
    } else if (type === 'video') {
      var vlink = document.getElementById('pub-video').value.trim()
      if (!vlink) { Util.showToast('请输入视频链接'); return }
      pub.video = vlink
      pub.videoTitle = document.getElementById('pub-video-title').value.trim() || '课程视频'
      if (formState.pubFiles.length) pub.attachments = formState.pubFiles.slice()
    }

    Util.showToast('AI 正在整理内容…')
    var classify = await AIEngine.aiClassifyContent(content)
    if (classify.confidence > 0.8 && classify.category !== formState.publishCat) {
      // 仅提示，不强制覆盖教师选择
    }
    var summary = await AIEngine.aiSummarize(content)
    pub.summary = summary
    state.publishes.unshift(pub)
    saveState()
    syncPush('publishes', pub)
    Util.showToast('发布成功', 'success')
    navigate('#/publish')
  }

  function submitMessage() {
    var content = document.getElementById('msg-content').value.trim()
    if (!content) { Util.showToast('请输入留言内容'); return }
    // 实名/匿名：实名需输入姓名，匿名使用占位名
    var realName = ''
    if (formState.msgMode === 'real') {
      var nameInput = document.getElementById('msg-name')
      realName = nameInput ? nameInput.value.trim() : ''
      if (!realName) { Util.showToast('请输入你的真实姓名'); return }
    }
    var isAnon = formState.msgMode !== 'real'
    var images = formState.msgImages || []

    var msg = {
      id: Util.genId(),
      studentName: isAnon ? '匿名同学' : realName,
      isAnonymous: isAnon,
      type: formState.msgType,
      content: content,
      createTime: Date.now(),
      replied: false
    }
    if (images.length) msg.images = images
    if (state.config.messageReviewEnabled) {
      msg.status = 'pending'
    } else {
      msg.status = 'approved'
    }

    state.messages.unshift(msg)
    saveState()
    syncPush('messages', msg)
    if (state.config.messageReviewEnabled) {
      Util.showToast('留言已提交，等待教师审核', 'success')
    } else {
      Util.showToast('留言已提交', 'success')
    }
    navigate('#/message')
  }

  function submitDiscussion() {
    var title = document.getElementById('disc-title').value.trim()
    var content = document.getElementById('disc-content').value.trim()
    if (!title) { Util.showToast('请输入标题'); return }
    if (!content) { Util.showToast('请输入内容'); return }

    // AI 违规过滤
    AIEngine.aiFilterContent(title + ' ' + content).then(function (res) {
      if (!res.pass) {
        Util.showToast(res.reason || '内容包含违规词，请修改', '')
        return
      }
      // 实名/匿名：实名需输入姓名，匿名使用占位名
      var realName = ''
      if (formState.discMode === 'real') {
        var nameInput = document.getElementById('disc-name')
        realName = nameInput ? nameInput.value.trim() : ''
        if (!realName) { Util.showToast('请输入你的真实姓名'); return }
      }
      var d = {
        id: Util.genId(),
        author: formState.discMode === 'real' ? realName : '匿名同学',
        avatar: '',
        images: formState.discImages || [],
        category: formState.discCat,
        title: title,
        content: content,
        createTime: Date.now(),
        likes: 0,
        liked: false,
        comments: [],
        aiAnswer: null,
        aiAnswerTime: null
      }
      state.discussions.unshift(d)
      saveState()
      syncPush('discussions', d)
      Util.showToast('帖子已发布', 'success')
      navigate('#/discussion')
    })
  }

  function likeDiscussion(id) {
    var d = state.discussions.find(function (x) { return x.id === id })
    if (!d) return
    if (d.liked) {
      d.likes--
      d.liked = false
      Util.showToast('已取消点赞')
    } else {
      d.likes++
      d.liked = true
      Util.showToast('点赞成功', 'success')
    }
    saveState()
    syncPush('discussions', d)
    renderApp()
  }

  function addComment(id) {
    var input = document.getElementById('comment-input')
    if (!input) return
    var content = input.value.trim()
    if (!content) { Util.showToast('请输入评论内容'); return }
    var d = state.discussions.find(function (x) { return x.id === id })
    if (!d) return
    var comment = { author: state.user.name, content: content, createTime: Date.now() }
    if (pendingReplyAuthor) {
      comment.replyTo = pendingReplyAuthor
      pendingReplyAuthor = null
    }
    d.comments.push(comment)
    saveState()
    syncPush('discussions', d)
    Util.showToast('评论成功', 'success')
    renderApp()
  }

  function replyComment(id, author) {
    pendingReplyAuthor = author
    renderApp()
    setTimeout(function () {
      var input = document.getElementById('comment-input')
      if (input) {
        input.placeholder = '回复 @' + author + '…'
        input.focus()
      }
    }, 50)
  }

  function cancelReply() {
    pendingReplyAuthor = null
    renderApp()
  }

  async function aiAnswer(id) {
    // AI 一键解答仅教师可用
    if (!isTeacher()) { Util.showToast('AI 一键解答仅教师可用'); return }
    var d = state.discussions.find(function (x) { return x.id === id })
    if (!d) return
    var btn = document.getElementById('ai-answer-btn')
    var loading = document.getElementById('ai-loading')
    if (btn) btn.style.display = 'none'
    if (loading) loading.style.display = 'block'

    var result = await AIEngine.aiAnswer(d.title + ' ' + d.content, state.course ? state.course.name : '高等数学-第三章')

    d.aiAnswer = result.answer
    d.aiAnswerTime = Date.now()
    saveState()
    syncPush('discussions', d)
    Util.showToast('AI 解答完成', 'success')
    renderApp()
  }

  async function aiMessageSummary() {
    // AI 问题汇总仅教师可用
    if (!isTeacher()) { Util.showToast('AI 问题汇总仅教师可用'); return }
    Util.showToast('AI 正在分析留言…')
    aiMessageSummary = await AIEngine.aiSummarizeMessages(state.messages)
    var unsolved = await AIEngine.aiUnsolvedList(state.messages)
    aiMessageSummary.unsolvedList = unsolved.items
    renderApp()
    setTimeout(function () {
      var card = document.querySelector('.ai-summary-card')
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  function closeAiSummary() {
    aiMessageSummary = null
    renderApp()
  }

  async function openWeekly() {
    Util.showToast('AI 正在生成周报…')
    var weekly = await AIEngine.aiWeeklySummary(state.publishes, state.messages, state.discussions, 'weekly')
    var html =
      '<div class="modal-title">🤖 AI 教学周报</div>' +
      '<div class="modal-sub">' + weekly.period + '</div>' +
      '<div class="modal-body">' +
      weekly.highlights.map(function (h) { return '<div class="weekly-item">• ' + Util.escapeHtml(h) + '</div>' }).join('') +
      '<div class="weekly-suggest">💡 ' + Util.escapeHtml(weekly.suggestion) + '</div>' +
      '</div>' +
      '<div class="modal-actions"><button class="btn-primary modal-btn" data-action="close-modal">知道了</button></div>'
    showModal(html)
  }

  async function openDaily() {
    Util.showToast('AI 正在生成日报…')
    var daily = await AIEngine.aiWeeklySummary(state.publishes, state.messages, state.discussions, 'daily')
    state.dailyReport = daily
    saveState()
    var html =
      '<div class="modal-title">📅 AI 教学日报</div>' +
      '<div class="modal-sub">' + daily.period + ' · 自动生成</div>' +
      '<div class="modal-body">' +
      daily.highlights.map(function (h) { return '<div class="weekly-item">• ' + Util.escapeHtml(h) + '</div>' }).join('') +
      '<div class="weekly-suggest">💡 ' + Util.escapeHtml(daily.suggestion) + '</div>' +
      '</div>' +
      '<div class="modal-actions"><button class="btn-primary modal-btn" data-action="close-modal">知道了</button></div>'
    showModal(html)
  }

  async function openDailyDiscussion() {
    Util.showToast('AI 正在生成每日讨论总结…')
    var result = await AIEngine.aiDailyDiscussionSummary(state.discussions)
    var html =
      '<div class="modal-title">📋 AI 每日讨论总结</div>' +
      '<div class="modal-sub">' + result.period + '</div>' +
      '<div class="modal-body">' +
      '<div class="summary-block-title">📌 核心讨论知识点</div>' +
      result.keyPoints.map(function (k) { return '<div class="weekly-item">• ' + Util.escapeHtml(k) + '</div>' }).join('') +
      '<div class="summary-block-title">❓ 共性疑惑</div>' +
      result.commonDoubts.map(function (k) { return '<div class="weekly-item">• ' + Util.escapeHtml(k) + '</div>' }).join('') +
      '<div class="summary-block-title">💡 优质学习观点</div>' +
      result.qualityViews.map(function (k) { return '<div class="weekly-item">• ' + Util.escapeHtml(k) + '</div>' }).join('') +
      '</div>' +
      '<div class="modal-actions"><button class="btn-primary modal-btn" data-action="close-modal">知道了</button></div>'
    showModal(html)
  }

  async function sendAI() {
    var input = document.getElementById('ai-input')
    if (!input) return
    var q = input.value.trim()
    if (!q) { Util.showToast('请输入问题'); return }
    input.value = ''
    state.aiHistory.push({ question: q, answer: '…', createTime: Date.now() })
    renderApp()

    var result = await AIEngine.aiGlobalQA(q, state)
    var last = state.aiHistory[state.aiHistory.length - 1]
    if (last && last.question === q) {
      last.answer = result.answer
      saveState()
    }
    renderApp()
  }

  function quickAsk(e) {
    var q = e.currentTarget.getAttribute('data-q')
    if (!q) return
    state.aiHistory.push({ question: q, answer: '…', createTime: Date.now() })
    renderApp()
    AIEngine.aiGlobalQA(q, state).then(function (result) {
      var last = state.aiHistory[state.aiHistory.length - 1]
      if (last && last.question === q) {
        last.answer = result.answer
        saveState()
      }
      renderApp()
    })
  }

  async function doSummary(type) {
    Util.showToast('AI 正在生成总结…')
    aiSummaryResult = await AIEngine.aiQuickSummary(type, state.publishes, state.messages, state.discussions)
    renderApp()
  }

  async function goPersonalStudy() {
    Util.showToast('AI 正在梳理学习记录…')
    personalStudyData = await AIEngine.aiPersonalStudy(state.user.name, state.messages, state.discussions)
    navigate('#/personalStudy')
  }

  function reviewAI(id) {
    var d = state.discussions.find(function (x) { return x.id === id })
    if (!d) return
    var html =
      '<div class="modal-title">✏️ 复核 AI 答疑</div>' +
      '<div class="modal-sub">❓ ' + Util.escapeHtml(d.title) + '</div>' +
      '<textarea id="review-text" class="form-textarea" style="min-height:160px">' + Util.escapeHtml(d.aiAnswer || '') + '</textarea>' +
      '<div class="modal-actions">' +
      '<button class="btn-primary modal-btn" data-action="save-review" data-id="' + d.id + '">保存修改</button>' +
      '<button class="btn-ghost modal-btn" data-action="close-modal">取消</button>' +
      '</div>'
    showModal(html)
  }

  function saveReview(id) {
    var d = state.discussions.find(function (x) { return x.id === id })
    if (!d) return
    var text = document.getElementById('review-text')
    if (!text) return
    var content = text.value.trim()
    if (!content) { Util.showToast('内容不能为空'); return }
    d.aiAnswer = content
    d.aiReviewed = true
    saveState()
    syncPush('discussions', d)
    hideModal()
    Util.showToast('答疑已更新', 'success')
    renderApp()
  }

  function pinAI(id) {
    var d = state.discussions.find(function (x) { return x.id === id })
    if (!d) return
    d.aiPinned = !d.aiPinned
    saveState()
    syncPush('discussions', d)
    Util.showToast(d.aiPinned ? '答疑已置顶' : '已取消置顶')
    renderApp()
  }

  function deleteAI(id) {
    var d = state.discussions.find(function (x) { return x.id === id })
    if (!d) return
    if (!window.confirm('确认删除该 AI 答疑？')) return
    d.aiAnswer = null
    d.aiAnswerTime = null
    d.aiReviewed = false
    d.aiPinned = false
    saveState()
    syncPush('discussions', d)
    Util.showToast('答疑已删除')
    renderApp()
  }

  function replyMessage(id) {
    var m = state.messages.find(function (x) { return x.id === id })
    if (!m) return
    var html =
      '<div class="modal-title">回复留言</div>' +
      '<div class="modal-sub">' + (m.isAnonymous ? '🕶 匿名同学' : Util.escapeHtml(m.studentName)) + ' · ' + Util.escapeHtml(m.content) + '</div>' +
      '<textarea id="reply-text" class="form-textarea" placeholder="输入回复内容…"></textarea>' +
      '<div class="modal-actions">' +
      '<button class="btn-primary modal-btn" data-action="save-message-reply" data-id="' + m.id + '">回复</button>' +
      '<button class="btn-ghost modal-btn" data-action="close-modal">取消</button>' +
      '</div>'
    showModal(html)
  }

  function saveMessageReply(id) {
    var m = state.messages.find(function (x) { return x.id === id })
    if (!m) return
    var text = document.getElementById('reply-text')
    if (!text || !text.value.trim()) { Util.showToast('请输入回复内容'); return }
    m.reply = text.value.trim()
    m.replied = true
    m.replyTime = Date.now()
    saveState()
    syncPush('messages', m)
    hideModal()
    Util.showToast('回复成功', 'success')
    renderApp()
  }

  function approveMessage(id) {
    var m = state.messages.find(function (x) { return x.id === id })
    if (!m) return
    m.status = 'approved'
    saveState()
    syncPush('messages', m)
    Util.showToast('留言已通过', 'success')
    renderApp()
  }

  function rejectMessage(id) {
    var m = state.messages.find(function (x) { return x.id === id })
    if (!m) return
    m.status = 'rejected'
    saveState()
    syncPush('messages', m)
    Util.showToast('留言已拒绝')
    renderApp()
  }

  function togglePublishTop(id) {
    var p = state.publishes.find(function (x) { return x.id === id })
    if (!p) return
    p.isTop = !p.isTop
    saveState()
    syncPush('publishes', p)
    Util.showToast(p.isTop ? '已置顶' : '已取消置顶')
    renderApp()
  }

  function deletePublish(id) {
    var p = state.publishes.find(function (x) { return x.id === id })
    if (!p) return
    if (!window.confirm('确认删除该发布内容？')) return
    state.publishes = state.publishes.filter(function (x) { return x.id !== id })
    saveState()
    syncDelete('publishes', id)
    Util.showToast('已删除')
    renderApp()
  }

  function saveAiKey() {
    var input = document.getElementById('ai-key-input')
    if (!input) return
    var key = input.value.trim()
    if (!key) { Util.showToast('请输入 DeepSeek API key'); return }
    Util.storage.set('web_ai_key', key)
    // 上传云端（app_config 单行 global），学生端可自动获取并使用真实 AI
    if (backendOn()) {
      Backend.upsert('app_config', { id: 'global', aiKey: key }).then(function (ok) {
        Util.showToast(ok ? 'AI key 已保存并同步云端' : 'AI key 已保存（云端同步失败）', ok ? 'success' : '')
      })
    } else {
      Util.showToast('AI key 已保存到本浏览器', 'success')
    }
    renderApp()
  }

  // 从云端拉取共享 AI key 写入本地，供学生端直接使用真实 AI
  function syncAiKeyFromCloud() {
    if (!backendOn() || !Backend.loadAppConfig) return
    Backend.loadAppConfig().then(function (cfg) {
      if (!cfg || !cfg.aiKey) return
      var local = Util.storage.get('web_ai_key', '') || ''
      if (!local) {
        Util.storage.set('web_ai_key', cfg.aiKey)
      }
    })
  }

  function setStyle(val) {
    state.config.pageStyle = val
    saveState()
    syncPush('course_config', Object.assign({ courseId: state.course.id }, state.config))
    applyPageStyle()
    renderApp()
  }

  function toggleConfig(key) {
    state.config[key] = !state.config[key]
    saveState()
    syncPush('course_config', Object.assign({ courseId: state.course.id }, state.config))
    Util.showToast('配置已更新', 'success')
    renderApp()
  }

  function applyPageStyle() {
    var style = state.config.pageStyle
    var app = document.querySelector('.app')
    if (app) {
      if (style === 'compact') {
        app.classList.add('compact')
      } else {
        app.classList.remove('compact')
      }
    }
  }

  // 切换视角（学生↔教师），若设置了密码则需验证
  function toggleRole() {
    var pwd = Util.storage.get('web_role_pwd', '') || ''
    if (!pwd) { doToggleRole(); return }
    var html =
      '<div class="modal-title">🔒 切换视角</div>' +
      '<div class="modal-sub">请输入切换视角密码（可在基础配置中修改）</div>' +
      '<input id="toggle-pwd-input" class="form-input" type="password" placeholder="输入密码" style="width:100%;margin:12px 0"/>' +
      '<div class="modal-actions">' +
      '<button class="btn-primary modal-btn" data-action="confirm-toggle-role">确认切换</button>' +
      '<button class="btn-ghost modal-btn" data-action="close-modal">取消</button>' +
      '</div>'
    showModal(html)
  }

  function confirmToggleRole() {
    var input = document.getElementById('toggle-pwd-input')
    var pwd = Util.storage.get('web_role_pwd', '') || ''
    if (!input || input.value.trim() !== pwd) { Util.showToast('密码错误'); return }
    hideModal()
    doToggleRole()
  }

  function doToggleRole() {
    var isT = isTeacher()
    var newRole = isT ? 'student' : 'teacher'
    var newName = state.user.name || '同学'
    if (!isT && state.course && state.course.teacherName) newName = state.course.teacherName
    state.user = { name: newName, role: newRole }
    if (newRole === 'student') {
      // 切到学生视角：暂存教师数据，学生视角显示空白（不显示原课程数据）
      studentDataCache = {
        publishes: state.publishes,
        messages: state.messages,
        discussions: state.discussions,
        weeklyReport: state.weeklyReport,
        dailyReport: state.dailyReport,
        aiHistory: state.aiHistory,
        config: state.config
      }
      state.publishes = []
      state.messages = []
      state.discussions = []
      state.weeklyReport = {}
      state.dailyReport = {}
      state.aiHistory = []
    } else if (studentDataCache) {
      // 切回教师视角：恢复教师数据
      state.publishes = studentDataCache.publishes
      state.messages = studentDataCache.messages
      state.discussions = studentDataCache.discussions
      state.weeklyReport = studentDataCache.weeklyReport
      state.dailyReport = studentDataCache.dailyReport
      state.aiHistory = studentDataCache.aiHistory
      state.config = studentDataCache.config
      studentDataCache = null
    }
    saveState()
    Util.showToast('已切换为' + (newRole === 'teacher' ? '教师视角' : '学生视角'), 'success')
    renderApp()
  }

  function saveRolePwd() {
    var input = document.getElementById('role-pwd-input')
    if (!input) return
    var pwd = input.value.trim()
    Util.storage.set('web_role_pwd', pwd)
    Util.showToast(pwd ? '切换视角密码已保存' : '已清除切换视角密码', 'success')
    renderApp()
  }

  // ========== 全局事件委托 ==========
  function handleAction(action, el, e) {
    var id = el.getAttribute('data-id')
    var key = el.getAttribute('data-key')
    switch (action) {
      case 'go-back': goBack(); break
      case 'go-publish': navigate('#/publish'); break
      case 'go-message': navigate('#/message'); break
      case 'go-discussion': navigate('#/discussion'); break
      case 'go-ai': navigate('#/ai'); break
      case 'go-teacher-config': navigate('#/teacherConfig'); break
      case 'go-review': navigate('#/review'); break
      case 'go-personal-study': goPersonalStudy(); break
      case 'go-summary-center': navigate('#/aiSummary'); break
      case 'go-summary-today': navigate('#/aiSummary/today'); break
      case 'go-summary-errors': navigate('#/aiSummary/errors'); break
      case 'open-publish-detail': navigate('#/publishDetail/' + id); break
      case 'open-discussion-detail': navigate('#/discussionDetail/' + id); break
      case 'new-publish': navigate('#/publishNew'); break
      case 'new-message': navigate('#/messageNew'); break
      case 'new-discussion': navigate('#/discussionNew'); break
      case 'filter-publish':
        tabState.publishFilter = key
        renderApp(); break
      case 'filter-discussion':
        tabState.discussionFilter = key
        renderApp(); break
      case 'pick-publish-cat': pickPublishCat(key); break
      case 'pick-publish-type': pickPublishType(key); break
      case 'pick-msg-type': pickMsgType(key); break
      case 'pick-msg-mode': pickMsgMode(key); break
      case 'pick-disc-cat': pickDiscCat(key); break
      case 'pick-disc-mode': pickDiscMode(key); break
      case 'msg-img-pick': pickMsgImage(); break
      case 'disc-img-pick': pickDiscImage(); break
      case 'msg-img-remove': removeMsgImage(parseInt(id || '0', 10) || 0); break
      case 'disc-img-remove': removeDiscImage(parseInt(id || '0', 10) || 0); break
      case 'pub-img-pick': pickPubImage(); break
      case 'pub-img-remove': removePubImage(parseInt(id || '0', 10) || 0); break
      case 'pub-file-pick': pickPubFile(); break
      case 'pub-file-remove': removePubFile(parseInt(id || '0', 10) || 0); break
      case 'pub-video-pick': pickPubVideo(); break
      case 'view-image': viewImage(el.getAttribute('data-src')); break
      case 'toggle-publish-top-new':
        formState.publishIsTop = !formState.publishIsTop
        renderApp(); break
      case 'toggle-publish-top': togglePublishTop(id); break
      case 'delete-publish': deletePublish(id); break
      case 'submit-publish': submitPublish(); break
      case 'submit-message': submitMessage(); break
      case 'submit-discussion': submitDiscussion(); break
      case 'like-discussion': likeDiscussion(id); break
      case 'add-comment': addComment(id); break
      case 'reply-comment': replyComment(id, el.getAttribute('data-author')); break
      case 'cancel-reply': cancelReply(); break
      case 'ai-answer': aiAnswer(id); break
      case 'ai-message-summary': aiMessageSummary(); break
      case 'close-ai-summary': closeAiSummary(); break
      case 'open-weekly': openWeekly(); break
      case 'open-daily': openDaily(); break
      case 'open-daily-discussion': openDailyDiscussion(); break
      case 'quick-ask': quickAsk(e); break
      case 'send-ai': sendAI(); break
      case 'do-summary': doSummary(key); break
      case 'review-ai': reviewAI(id); break
      case 'save-review': saveReview(id); break
      case 'pin-ai': pinAI(id); break
      case 'delete-ai': deleteAI(id); break
      case 'reply-message': replyMessage(id); break
      case 'save-message-reply': saveMessageReply(id); break
      case 'approve-message': approveMessage(id); break
      case 'reject-message': rejectMessage(id); break
      case 'set-style': setStyle(el.getAttribute('data-val')); break
      case 'toggle-config': toggleConfig(key); break
      case 'save-ai-key': saveAiKey(); break
      case 'save-role-pwd': saveRolePwd(); break
      case 'confirm-toggle-role': confirmToggleRole(); break
      case 'create-course': createCourse(); break
      case 'use-sample-course': useSampleCourse(); break
      case 'enter-course': navigate('#/'); break
      case 'copy-student-url': copyStudentUrl(); break
      case 'go-share-qr': navigate('#/courseCreated'); break
      case 'toggle-role': toggleRole(); break
      case 'reset-data': resetData(); break
      case 'confirm-reset-data': confirmResetData(); break
      case 'export-course': exportCoursePdf(false); break
      case 'do-print': window.print(); break
      case 'close-export': renderApp(); break
      case 'confirm-reset-export': doResetCourse(); renderApp(); break
      case 'close-modal': hideModal(); break
    }
  }

  function bindEvents() {
    document.addEventListener('click', function (e) {
      var el = e.target
      while (el && el !== document) {
        var action = el.getAttribute && el.getAttribute('data-action')
        if (action) {
          handleAction(action, el, e)
          return
        }
        el = el.parentNode
      }
    })

    // 图片/文件选择
    document.addEventListener('change', function (e) {
      var t = e.target
      if (!t || !t.files || !t.files.length) return
      if (t.id === 'msg-img-file') onMsgImageChosen(t.files[0])
      else if (t.id === 'disc-img-file') onDiscImageChosen(t.files[0])
      else if (t.id === 'pub-img-file') { for (var i = 0; i < t.files.length; i++) onPubImageChosen(t.files[i]) }
      else if (t.id === 'pub-file-input') onPubFileChosen(t.files[0])
      else if (t.id === 'pub-video-input') onPubVideoChosen(t.files[0])
      t.value = ''
    })

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.id === 'ai-input') {
        sendAI()
      }
      if (e.key === 'Enter' && e.target && e.target.id === 'comment-input') {
        var id = e.target.getAttribute('data-id')
        addComment(id)
      }
    })

    window.addEventListener('hashchange', renderApp)
  }

  // ========== 初始化 ==========
  function startBackendSync() {
    if (!backendOn()) return
    syncAiKeyFromCloud()
    syncFromBackend()
    startRealtime()
  }
  function init() {
    if (typeof Backend !== 'undefined' && Backend) Backend.init()
    loadState()
    bindEvents()
    applyPageStyle()
    renderApp()
    // 已配置云端：拉取共享数据并开启实时同步
    // CloudBase 匿名登录为异步，等 Backend.ready 就绪后再启用同步
    if (typeof Backend !== 'undefined' && Backend && Backend.ready && typeof Backend.ready.then === 'function') {
      Backend.ready.then(function () { startBackendSync() })
    } else {
      startBackendSync()
    }
  }

  // 暴露给外部（测试/重置导出流程）
  global.doResetCourse = doResetCourse

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})(window)
