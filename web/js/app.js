// 网页版主应用 - hash 路由 + 页面渲染 + 交互
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
    user: 'web_user'
  }

  var state = {
    publishes: [],
    messages: [],
    discussions: [],
    weeklyReport: {},
    aiHistory: [],
    user: { name: '小明同学', role: 'student' }
  }

  function loadState() {
    var mock = global.MockData
    state.publishes = Util.storage.get(STORAGE_KEYS.publishes, mock.publishes)
    state.messages = Util.storage.get(STORAGE_KEYS.messages, mock.messages)
    state.discussions = Util.storage.get(STORAGE_KEYS.discussions, mock.discussions)
    state.weeklyReport = Util.storage.get(STORAGE_KEYS.weeklyReport, mock.weeklyReport)
    state.aiHistory = Util.storage.get(STORAGE_KEYS.aiHistory, [])
    state.user = Util.storage.get(STORAGE_KEYS.user, { name: '小明同学', role: 'student' })
  }

  function saveState() {
    Util.storage.set(STORAGE_KEYS.publishes, state.publishes)
    Util.storage.set(STORAGE_KEYS.messages, state.messages)
    Util.storage.set(STORAGE_KEYS.discussions, state.discussions)
    Util.storage.set(STORAGE_KEYS.weeklyReport, state.weeklyReport)
    Util.storage.set(STORAGE_KEYS.aiHistory, state.aiHistory)
    Util.storage.set(STORAGE_KEYS.user, state.user)
  }

  function resetData() {
    var mock = global.MockData
    state.publishes = JSON.parse(JSON.stringify(mock.publishes))
    state.messages = JSON.parse(JSON.stringify(mock.messages))
    state.discussions = JSON.parse(JSON.stringify(mock.discussions))
    state.weeklyReport = JSON.parse(JSON.stringify(mock.weeklyReport))
    state.aiHistory = []
    saveState()
    renderApp()
  }

  // ========== 路由 ==========
  function parseRoute() {
    var hash = window.location.hash || '#/'
    var parts = hash.replace(/^#\/?/, '').split('/')
    return { page: parts[0] || 'home', id: parts[1] }
  }

  function isTabPage(page) {
    return ['home', 'discussion', 'ai', 'profile'].indexOf(page) !== -1
  }

  var TAB_ITEMS = [
    { key: 'home', label: '首页', icon: '🏠', hash: '#/' },
    { key: 'discussion', label: '讨论区', icon: '💬', hash: '#/discussion' },
    { key: 'ai', label: 'AI问答', icon: '🤖', hash: '#/ai' },
    { key: 'profile', label: '我的', icon: '👤', hash: '#/profile' }
  ]

  function activeTabKey(route) {
    if (route.page === 'home' || route.page.indexOf('publish') === 0 || route.page.indexOf('message') === 0) return 'home'
    if (route.page === 'discussion' || route.page.indexOf('discussion') === 0) return 'discussion'
    if (route.page === 'ai') return 'ai'
    if (route.page === 'profile') return 'profile'
    return 'home'
  }

  // ========== 通用组件 ==========
  var PAGE_TITLES = {
    home: 'AI赋能课堂互动',
    publish: '教师信息发布区',
    publishDetail: '内容详情',
    publishNew: '发布新内容',
    message: '学生留言区',
    messageNew: '留言',
    discussion: '学生讨论区',
    discussionDetail: '讨论详情',
    discussionNew: '发起讨论',
    ai: 'AI智能问答',
    profile: '个人中心'
  }

  function getTitle(page) {
    return PAGE_TITLES[page] || 'AI赋能课堂互动'
  }

  function renderHeader(route) {
    var back = isTabPage(route.page) ? '' :
      '<div class="header-back" data-action="go-back">‹</div>'
    var extra = ''
    if (route.page === 'publish' || route.page === 'message' || route.page === 'discussion') {
      var publishBtn = ''
      if (route.page === 'publish') publishBtn = '<div class="header-action" data-action="new-publish">＋ 发布</div>'
      if (route.page === 'message') publishBtn = '<div class="header-action" data-action="new-message">＋ 留言</div>'
      if (route.page === 'discussion') publishBtn = '<div class="header-action" data-action="new-discussion">＋ 发帖</div>'
      extra = publishBtn
    }
    return '<header class="header">' + back + '<h1 class="header-title">' + getTitle(route.page) + '</h1>' + extra + '</header>'
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
  function renderTag(catMap, key) {
    var item = catMap[key] || { label: key, color: '' }
    return '<span class="tag ' + item.color + '">' + item.label + '</span>'
  }

  function renderPublishCard(p) {
    var tag = renderTag(Util.CATEGORY_MAP, p.category)
    var top = p.isTop ? '<span class="badge-top">置顶</span>' : ''
    var deadline = p.deadline ? '<div class="pub-deadline">⏰ 截止：' + Util.formatDate(p.deadline) + '</div>' : ''
    return '<div class="card pub-card" data-action="open-publish-detail" data-id="' + p.id + '">' +
      '<div class="card-top">' + tag + top + '<span class="card-time">' + Util.timeAgo(p.createTime) + '</span></div>' +
      '<h3 class="card-title">' + Util.escapeHtml(p.title) + '</h3>' +
      '<p class="card-summary">' + Util.escapeHtml(p.summary || p.content) + '</p>' +
      '<div class="card-meta">' + deadline +
      '<span>👨‍🏫 ' + Util.escapeHtml(p.author) + '</span>' +
      '<span>👁 ' + p.views + '</span></div></div>'
  }

  function renderMessageCard(m) {
    var tag = renderTag(Util.MESSAGE_TYPE_MAP, m.type)
    var replied = m.replied ?
      '<div class="reply-box"><div class="reply-label">教师回复</div><div class="reply-text">' + Util.escapeHtml(m.reply) + '</div></div>' :
      '<div class="reply-pending">⏳ 待教师回复</div>'
    return '<div class="card msg-card">' +
      '<div class="card-top">' + tag + '<span class="card-time">' + Util.timeAgo(m.createTime) + '</span></div>' +
      '<div class="msg-name">' + (m.isAnonymous ? '🕶 匿名同学' : Util.escapeHtml(m.studentName)) + '</div>' +
      '<p class="msg-content">' + Util.escapeHtml(m.content) + '</p>' +
      replied +
      '</div>'
  }

  function renderDiscussionCard(d) {
    var tag = renderTag(Util.DISCUSSION_CATEGORY_MAP, d.category)
    var aiBadge = d.aiAnswer ? '<span class="badge-ai">🤖 已解答</span>' : ''
    return '<div class="card disc-card" data-action="open-discussion-detail" data-id="' + d.id + '">' +
      '<div class="card-top">' + tag + aiBadge + '<span class="card-time">' + Util.timeAgo(d.createTime) + '</span></div>' +
      '<h3 class="card-title">' + Util.escapeHtml(d.title) + '</h3>' +
      '<p class="card-summary">' + Util.escapeHtml(d.content) + '</p>' +
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

  // ========== 页面渲染 ==========
  function renderHome() {
    var unrepliedCount = state.messages.filter(function (m) { return !m.replied }).length
    var aiDiscussed = state.discussions.filter(function (d) { return d.aiAnswer }).length
    return '<div class="page home-page">' +
      // 顶部问候
      '<div class="home-hero">' +
      '<div class="hero-greet">早上好，' + Util.escapeHtml(state.user.name) + ' 👋</div>' +
      '<div class="hero-sub">高等数学 · 第三章「极限与连续」</div>' +
      '<div class="hero-ai" data-action="open-weekly"><span class="hero-ai-icon">✨</span> 查看本周 AI 教学周报</div>' +
      '</div>' +

      // 三大板块
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

      // 最新动态
      '<div class="section-title">最新动态</div>' +
      '<div class="latest-list">' +
      latestItems() +
      '</div>' +

      // AI 快速入口
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
    state.publishes.slice(0, 2).forEach(function (p) {
      items.push('<div class="latest-item" data-action="open-publish-detail" data-id="' + p.id + '">' +
        '<span class="latest-icon">📢</span>' +
        '<div class="latest-body"><div class="latest-title">' + Util.escapeHtml(p.title) + '</div>' +
        '<div class="latest-time">' + Util.timeAgo(p.createTime) + '</div></div></div>')
    })
    state.discussions.slice(0, 2).forEach(function (d) {
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
    var list = state.publishes
    if (current !== 'all') list = list.filter(function (p) { return p.category === current })

    var tabHtml = tabs.map(function (t) {
      return '<div class="filter-tab ' + (current === t.key ? 'active' : '') + '" data-action="filter-publish" data-key="' + t.key + '">' + t.label + '</div>'
    }).join('')

    var listHtml = list.length
      ? list.map(renderPublishCard).join('')
      : '<div class="empty">暂无内容</div>'

    return '<div class="page">' +
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

    return '<div class="page">' +
      '<div class="detail-card card">' +
      '<div class="card-top">' + renderTag(Util.CATEGORY_MAP, p.category) +
      (p.isTop ? '<span class="badge-top">置顶</span>' : '') +
      '<span class="card-time">' + Util.formatTime(p.createTime) + '</span></div>' +
      '<h2 class="detail-title">' + Util.escapeHtml(p.title) + '</h2>' +
      '<div class="detail-author">👨‍🏫 ' + Util.escapeHtml(p.author) + ' · 👁 ' + p.views + ' 次浏览</div>' +
      (p.deadline ? '<div class="pub-deadline">⏰ 截止：' + Util.formatTime(p.deadline) + '</div>' : '') +
      '<div class="detail-content">' + Util.nl2br(p.content) + '</div>' +
      (attachments ? '<div class="attach-list">' + attachments + '</div>' : '') +
      '</div>' +
      (p.category === 'homework'
        ? '<div class="homework-tip" data-action="new-message">📝 提交作业 → 前往留言区提交</div>'
        : '') +
      '</div>'
  }

  function renderPublishNew() {
    return '<div class="page form-page">' +
      '<div class="form-card card">' +
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
      '<div class="form-ai-hint">✨ AI 将自动为你生成摘要并归类</div>' +
      '<button class="btn-primary" data-action="submit-publish">发 布</button>' +
      '</div></div>'
  }

  function renderMessageList() {
    var summary = aiMessageSummary
    var summaryCard = ''
    if (summary) {
      summaryCard = '<div class="ai-summary-card">' +
        '<div class="ai-summary-header"><span>🤖 AI 问题汇总</span><span class="ai-summary-close" data-action="close-ai-summary">✕</span></div>' +
        '<div class="ai-summary-text">' + Util.escapeHtml(summary.summary) + '</div>' +
        '<div class="ai-summary-stats">总 ' + summary.total + ' 条 · 待回复 ' + summary.unsolved + ' 条</div>' +
        '<div class="ai-summary-top">高频问题：</div>' +
        summary.topIssues.map(function (t) {
          return '<div class="ai-summary-issue">' + t.rank + '. ' + Util.escapeHtml(t.question) + ' <span class="ai-count">×' + t.count + '</span></div>'
        }).join('') +
        '</div>'
    }

    var listHtml = state.messages.length
      ? state.messages.map(renderMessageCard).join('')
      : '<div class="empty">暂无留言</div>'

    return '<div class="page">' +
      '<div class="ai-summary-entry" data-action="ai-message-summary">' +
      '<span class="ai-entry-icon">🤖</span>' +
      '<div class="ai-entry-body"><div class="ai-entry-title">AI 问题汇总</div>' +
      '<div class="ai-entry-desc">智能梳理 ' + state.messages.length + ' 条留言，' + unrepliedCountNow() + ' 条待回复</div></div>' +
      '<span class="ai-entry-arrow">›</span>' +
      '</div>' +
      summaryCard +
      '<div class="list-area">' + listHtml + '</div>' +
      '</div>'
  }

  function unrepliedCountNow() {
    return state.messages.filter(function (m) { return !m.replied }).length
  }

  function renderMessageNew() {
    return '<div class="page form-page">' +
      '<div class="form-card card">' +
      '<div class="form-label">留言类型 <span class="form-required">*</span></div>' +
      '<div class="form-tags">' +
      '<div class="form-tag active" data-action="pick-msg-type" data-key="knowledge">知识点疑问</div>' +
      '<div class="form-tag" data-action="pick-msg-type" data-key="homework">作业问题</div>' +
      '<div class="form-tag" data-action="pick-msg-type" data-key="suggest">教学建议</div>' +
      '<div class="form-tag" data-action="pick-msg-type" data-key="other">其他</div>' +
      '</div>' +
      '<div class="form-label">留言内容 <span class="form-required">*</span></div>' +
      '<textarea id="msg-content" class="form-textarea" placeholder="请描述你的问题或建议"></textarea>' +
      '<div class="form-anon">' +
      '<label class="anon-label"><input type="checkbox" id="msg-anon"/> 匿名留言（仅教师可见你的信息）</label>' +
      '</div>' +
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
    var list = state.discussions
    if (current !== 'all') list = list.filter(function (d) { return d.category === current })

    var tabHtml = tabs.map(function (t) {
      return '<div class="filter-tab ' + (current === t.key ? 'active' : '') + '" data-action="filter-discussion" data-key="' + t.key + '">' + t.label + '</div>'
    }).join('')

    var aiHot = state.discussions.filter(function (d) { return d.aiAnswer }).length

    var listHtml = list.length
      ? list.map(renderDiscussionCard).join('')
      : '<div class="empty">暂无讨论帖</div>'

    return '<div class="page">' +
      '<div class="disc-hot">🔥 讨论区活跃 ' + state.discussions.length + ' 帖 · AI 已解答 ' + aiHot + ' 帖</div>' +
      '<div class="filter-bar">' + tabHtml + '</div>' +
      '<div class="list-area">' + listHtml + '</div>' +
      '</div>'
  }

  function renderDiscussionDetail(id) {
    var d = state.discussions.find(function (x) { return x.id === id })
    if (!d) return '<div class="page"><div class="empty">帖子不存在或已删除</div></div>'

    var commentsHtml = (d.comments || []).map(function (c) {
      return '<div class="comment-item"><div class="comment-avatar">' + Util.escapeHtml(c.author[0]) + '</div>' +
        '<div class="comment-body"><div class="comment-name">' + Util.escapeHtml(c.author) +
        ' <span class="comment-time">' + Util.timeAgo(c.createTime) + '</span></div>' +
        '<div class="comment-text">' + Util.escapeHtml(c.content) + '</div></div></div>'
    }).join('') || '<div class="empty-small">还没有评论，快来抢沙发～</div>'

    var aiBlock = ''
    if (d.aiAnswer) {
      aiBlock = '<div class="ai-answer-card">' +
        '<div class="ai-answer-header"><span>🤖 AI 智能解答</span><span class="ai-answer-time">' + Util.timeAgo(d.aiAnswerTime) + '</span></div>' +
        '<div class="ai-answer-content">' + Util.nl2br(d.aiAnswer) + '</div></div>'
    } else {
      aiBlock = '<button class="btn-ai" id="ai-answer-btn" data-action="ai-answer" data-id="' + d.id + '">' +
        '<span class="btn-ai-icon">🤖</span> AI 一键解答</button>' +
        '<div id="ai-loading" class="ai-loading" style="display:none">AI 思考中<span class="dots">…</span></div>'
    }

    var likeClass = d.liked ? ' liked' : ''
    var likeText = d.liked ? '已赞' : '点赞'

    return '<div class="page">' +
      '<div class="detail-card card">' +
      '<div class="card-top">' + renderTag(Util.DISCUSSION_CATEGORY_MAP, d.category) +
      '<span class="card-time">' + Util.formatTime(d.createTime) + '</span></div>' +
      '<h2 class="detail-title">' + Util.escapeHtml(d.title) + '</h2>' +
      '<div class="detail-author">👤 ' + Util.escapeHtml(d.author) + '</div>' +
      '<div class="detail-content">' + Util.nl2br(d.content) + '</div>' +
      '<div class="detail-actions">' +
      '<div class="detail-like' + likeClass + '" data-action="like-discussion" data-id="' + d.id + '">👍 ' + likeText + ' (' + d.likes + ')</div>' +
      '</div>' +
      '</div>' +

      aiBlock +

      '<div class="section-title-inline">评论 ' + (d.comments || []).length + '</div>' +
      '<div class="comments-list">' + commentsHtml + '</div>' +

      '<div class="comment-input-bar">' +
      '<input id="comment-input" class="comment-input" data-id="' + d.id + '" placeholder="写下你的评论…" maxlength="200"/>' +
      '<button class="btn-comment" data-action="add-comment" data-id="' + d.id + '">发送</button>' +
      '</div>' +
      '</div>'
  }

  function renderDiscussionNew() {
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
      '<div class="form-label">内容 <span class="form-required">*</span></div>' +
      '<textarea id="disc-content" class="form-textarea" placeholder="请输入讨论内容"></textarea>' +
      '<button class="btn-primary" data-action="submit-discussion">发 布 帖 子</button>' +
      '</div></div>'
  }

  function renderAI() {
    var quick = ['极限的ε-δ定义如何理解？', '如何判断函数的连续性？', '导数和微分的关系是什么？', '作业第3题怎么解？']
    var quickHtml = quick.map(function (q) {
      return '<div class="quick-item" data-action="quick-ask" data-q="' + Util.escapeHtml(q) + '">' + Util.escapeHtml(q) + '</div>'
    }).join('')

    var chatHtml = state.aiHistory.map(function (h) {
      return '<div class="chat-item chat-ask"><div class="chat-bubble bubble-ask">' + Util.escapeHtml(h.question) + '</div></div>' +
        '<div class="chat-item chat-answer"><div class="chat-bubble bubble-answer">' + Util.nl2br(h.answer) + '</div></div>'
    }).join('')

    if (!chatHtml) {
      chatHtml = '<div class="chat-empty">🤖 我是 AI 学习助手，关于课程的任何问题都可以问我</div>'
    }

    return '<div class="page ai-page">' +
      '<div class="quick-row">' + quickHtml + '</div>' +
      '<div class="chat-area" id="chat-area">' + chatHtml + '</div>' +
      '<div class="chat-input-bar">' +
      '<input id="ai-input" class="chat-input" placeholder="输入你的问题…" maxlength="200"/>' +
      '<button class="btn-chat" data-action="send-ai">发送</button>' +
      '</div>' +
      '</div>'
  }

  function renderProfile() {
    var u = state.user
    var myPosts = state.discussions.filter(function (d) { return d.author === '小明同学' }).length
    return '<div class="page">' +
      '<div class="profile-header">' +
      '<div class="profile-avatar">' + Util.escapeHtml((u.name || '小')[0]) + '</div>' +
      '<div class="profile-info">' +
      '<div class="profile-name">' + Util.escapeHtml(u.name) + '</div>' +
      '<div class="profile-role">' + (u.role === 'teacher' ? '教师' : '学生') + '</div>' +
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
      '<div class="menu-item" data-action="open-weekly">📊 AI 教学周报<span class="menu-arrow">›</span></div>' +
      '<div class="menu-item" data-action="reset-data">🔄 重置演示数据<span class="menu-arrow">›</span></div>' +
      '</div>' +
      '<div class="profile-footer">AI赋能课堂互动 · 网页演示版</div>' +
      '</div>'
  }

  // ========== 表单临时状态 ==========
  var tabState = {
    publishFilter: 'all',
    discussionFilter: 'all'
  }
  var formState = {
    publishCat: 'homework',
    msgType: 'knowledge',
    discCat: 'question'
  }
  var aiMessageSummary = null

  // ========== 渲染入口 ==========
  function renderApp() {
    var route = parseRoute()
    var app = document.getElementById('app')
    var content = ''
    var page = route.page

    if (page === '' || page === 'home') content = renderHome()
    else if (page === 'publish') content = renderPublishList()
    else if (page === 'publishDetail') content = renderPublishDetail(route.id)
    else if (page === 'publishNew') content = renderPublishNew()
    else if (page === 'message') content = renderMessageList()
    else if (page === 'messageNew') content = renderMessageNew()
    else if (page === 'discussion') content = renderDiscussionList()
    else if (page === 'discussionDetail') content = renderDiscussionDetail(route.id)
    else if (page === 'discussionNew') content = renderDiscussionNew()
    else if (page === 'ai') content = renderAI()
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

  function pickPublishCat(key) {
    formState.publishCat = key
    var tags = document.querySelectorAll('.form-tag[data-action="pick-publish-cat"]')
    tags.forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-key') === key)
    })
  }

  function pickMsgType(key) {
    formState.msgType = key
    var tags = document.querySelectorAll('.form-tag[data-action="pick-msg-type"]')
    tags.forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-key') === key)
    })
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

    Util.showToast('AI 正在整理内容…')
    var classify = await AIEngine.aiClassifyContent(content)
    var summary = await AIEngine.aiSummarize(content)

    state.publishes.unshift({
      id: Util.genId(),
      title: title,
      category: formState.publishCat,
      content: content,
      summary: summary,
      author: '张教授',
      createTime: Date.now(),
      isTop: false,
      views: 0
    })
    saveState()
    Util.showToast('发布成功', 'success')
    navigate('#/publish')
  }

  function submitMessage() {
    var content = document.getElementById('msg-content').value.trim()
    if (!content) { Util.showToast('请输入留言内容'); return }
    var isAnon = document.getElementById('msg-anon').checked

    state.messages.unshift({
      id: Util.genId(),
      studentName: isAnon ? '匿名同学' : state.user.name,
      isAnonymous: isAnon,
      type: formState.msgType,
      content: content,
      createTime: Date.now(),
      replied: false
    })
    saveState()
    Util.showToast('留言已提交', 'success')
    navigate('#/message')
  }

  function submitDiscussion() {
    var title = document.getElementById('disc-title').value.trim()
    var content = document.getElementById('disc-content').value.trim()
    if (!title) { Util.showToast('请输入标题'); return }
    if (!content) { Util.showToast('请输入内容'); return }

    state.discussions.unshift({
      id: Util.genId(),
      author: state.user.name,
      avatar: '',
      category: formState.discCat,
      title: title,
      content: content,
      createTime: Date.now(),
      likes: 0,
      liked: false,
      comments: [],
      aiAnswer: null,
      aiAnswerTime: null
    })
    saveState()
    Util.showToast('帖子已发布', 'success')
    navigate('#/discussion')
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
    renderApp()
  }

  function addComment(id) {
    var input = document.getElementById('comment-input')
    if (!input) return
    var content = input.value.trim()
    if (!content) { Util.showToast('请输入评论内容'); return }
    var d = state.discussions.find(function (x) { return x.id === id })
    if (!d) return
    d.comments.push({ author: state.user.name, content: content, createTime: Date.now() })
    saveState()
    Util.showToast('评论成功', 'success')
    renderApp()
  }

  async function aiAnswer(id) {
    var d = state.discussions.find(function (x) { return x.id === id })
    if (!d) return
    // 显示加载状态
    var btn = document.getElementById('ai-answer-btn')
    var loading = document.getElementById('ai-loading')
    if (btn) btn.style.display = 'none'
    if (loading) loading.style.display = 'block'

    var result = await AIEngine.aiAnswer(d.title + ' ' + d.content, '高等数学-第三章')

    d.aiAnswer = result.answer
    d.aiAnswerTime = Date.now()
    saveState()
    Util.showToast('AI 解答完成', 'success')
    renderApp()
  }

  async function aiMessageSummary() {
    Util.showToast('AI 正在分析留言…')
    aiMessageSummary = await AIEngine.aiSummarizeMessages(state.messages)
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
    var weekly = await AIEngine.aiWeeklySummary(state.publishes, state.messages, state.discussions)
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

  async function sendAI() {
    var input = document.getElementById('ai-input')
    if (!input) return
    var q = input.value.trim()
    if (!q) { Util.showToast('请输入问题'); return }
    input.value = ''
    state.aiHistory.push({ question: q, answer: '…' })
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
    state.aiHistory.push({ question: q, answer: '…' })
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
      case 'pick-msg-type': pickMsgType(key); break
      case 'pick-disc-cat': pickDiscCat(key); break
      case 'submit-publish': submitPublish(); break
      case 'submit-message': submitMessage(); break
      case 'submit-discussion': submitDiscussion(); break
      case 'like-discussion': likeDiscussion(id); break
      case 'add-comment': addComment(id); break
      case 'ai-answer': aiAnswer(id); break
      case 'ai-message-summary': aiMessageSummary(); break
      case 'close-ai-summary': closeAiSummary(); break
      case 'open-weekly': openWeekly(); break
      case 'quick-ask': quickAsk(e); break
      case 'send-ai': sendAI(); break
      case 'reset-data': resetData(); break
      case 'close-modal': hideModal(); break
    }
  }

  function bindEvents() {
    document.addEventListener('click', function (e) {
      // 事件委托：向上找最近的 [data-action]
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

    // 回车发送 AI 问题
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
  function init() {
    loadState()
    bindEvents()
    renderApp()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})(window)
