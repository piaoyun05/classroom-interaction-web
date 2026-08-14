// ============================================================
// 云端同步层（GitHub Gist）
// - 单共享 gist 存放全部课程数据：data.json = { courses:{id:meta},
//   data:{ courseId:{ publishes:[], messages:[], discussions:[], config:{} } } }
// - 未配置 APP_CONFIG.GIST_ID / GITHUB_TOKEN 时 enabled=false，
//   全部方法静默降级，应用继续走本地 localStorage（不影响演示/测试）。
// - 读：GET /gists/{id}（公开 gist 无需 token 即可读）
// - 写：PATCH /gists/{id}（需细粒度 PAT，仅授权本仓库 Contents 读写）
// - 实时：轮询（默认 15s）比对 gist updated_at，变化时回调刷新
// ============================================================
(function (global) {
  'use strict'

  var API = 'https://api.github.com'
  var gistId = null
  var token = null
  var enabled = false
  var pollTimer = null

  function cfg() {
    return (typeof global.APP_CONFIG === 'object' && global.APP_CONFIG) ? global.APP_CONFIG : null
  }

  function init() {
    var c = cfg()
    if (!c || !c.GIST_ID || !c.GITHUB_TOKEN) return false
    gistId = c.GIST_ID
    token = c.GITHUB_TOKEN
    enabled = true
    return true
  }

  function readHeaders() {
    return { 'Accept': 'application/vnd.github+json' }
  }
  function writeHeaders() {
    return {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    }
  }

  // 读取共享 gist -> { courses:{}, data:{ courseId:{...} } }
  function readStore() {
    return fetch(API + '/gists/' + gistId, { headers: readHeaders() })
      .then(function (r) {
        if (!r.ok) throw new Error('read ' + r.status)
        return r.json()
      })
      .then(function (g) {
        var content = (g.files && g.files['data.json']) ? g.files['data.json'].content : '{}'
        try { return JSON.parse(content) } catch (e) { return { courses: {}, data: {} } }
      })
  }

  function writeStore(store) {
    return fetch(API + '/gists/' + gistId, {
      method: 'PATCH',
      headers: writeHeaders(),
      body: JSON.stringify({ files: { 'data.json': { content: JSON.stringify(store, null, 2) } } })
    }).then(function (r) {
      if (!r.ok) throw new Error('write ' + r.status)
      return true
    })
  }

  // 课程维度拉取全部共享数据
  function loadGist(courseId) {
    if (!enabled) return Promise.resolve(null)
    return readStore().then(function (store) {
      var course = store.courses && store.courses[courseId]
      if (!course) return null
      var d = store.data && store.data[courseId] || {}
      return {
        course: course,
        publishes: d.publishes || [],
        messages: d.messages || [],
        discussions: d.discussions || [],
        config: d.config || null
      }
    }).catch(function (e) { console.warn('[backend] loadGist', e); return null })
  }

  // 写入（插入/更新）。row 需带 courseId（courses 表用 row.id）。
  function upsert(table, row) {
    if (!enabled) return Promise.resolve(false)
    var courseId = (table === 'courses') ? row.id : row.courseId
    if (!courseId) return Promise.resolve(false)
    return readStore().then(function (store) {
      if (table === 'courses') {
        store.courses = store.courses || {}
        store.courses[row.id] = row
        return writeStore(store)
      }
      store.data = store.data || {}
      store.data[courseId] = store.data[courseId] || { publishes: [], messages: [], discussions: [], config: {} }
      var bucket = store.data[courseId]
      if (table === 'course_config') {
        var conf = Object.assign({}, row)
        delete conf.courseId
        bucket.config = conf
        return writeStore(store)
      }
      var list = bucket[table] || []
      var idx = -1
      for (var i = 0; i < list.length; i++) { if (list[i].id === row.id) { idx = i; break } }
      if (idx >= 0) list[idx] = row; else list.unshift(row)
      bucket[table] = list
      return writeStore(store)
    }).then(function () { return true }).catch(function (e) { console.warn('[backend] upsert', table, e); return false })
  }

  function remove(table, id, courseId) {
    if (!enabled || !courseId) return Promise.resolve(false)
    return readStore().then(function (store) {
      var bucket = store.data && store.data[courseId]
      if (!bucket) return false
      if (table === 'course_config') {
        bucket.config = null
        return writeStore(store)
      }
      var list = bucket[table] || []
      bucket[table] = list.filter(function (x) { return x.id !== id })
      return writeStore(store)
    }).then(function () { return true }).catch(function (e) { console.warn('[backend] remove', table, e); return false })
  }

  // 轮询式实时同步：gist updated_at 变化时回调
  function subscribe(courseId, onChange) {
    if (!enabled) return
    unsubscribe()
    var last = null
    pollTimer = setInterval(function () {
      fetch(API + '/gists/' + gistId, { headers: readHeaders() })
        .then(function (r) { return r.json() })
        .then(function (g) {
          if (g && g.updated_at && g.updated_at !== last) {
            last = g.updated_at
            onChange && onChange()
          } else if (g && g.updated_at) {
            last = g.updated_at
          }
        })
        .catch(function () {})
    }, 15000)
  }

  function unsubscribe() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }

  global.Backend = {
    init: init,
    isEnabled: function () { return enabled },
    upsert: upsert,
    remove: remove,
    loadGist: loadGist,
    loadAll: loadGist, // 兼容旧调用
    subscribe: subscribe,
    unsubscribe: unsubscribe
  }
})(window)
