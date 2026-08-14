// ============================================================
// 云端同步层（GitHub Contents API）
// - 数据直接存本仓库独立的 data 分支上的 course-data.json：
//   { courses:{id:meta}, data:{ courseId:{ publishes:[], messages:[],
//     discussions:[], config:{} } } }
// - 独立 data 分支不会触发 GitHub Pages 重建，也不会影响网站文件。
// - 读：GET /repos/{repo}/contents/{path}?ref=data（公开仓库+token 均可）
// - 写：PUT contents（带文件 SHA 乐观锁，冲突自动重读重写一次）
// - 实时：轮询（默认 30s）比对文件 SHA，变化时回调刷新
// - 未配置 APP_CONFIG.GITHUB_TOKEN 时 enabled=false，静默降级 localStorage
// ============================================================
(function (global) {
  'use strict'

  var API = 'https://api.github.com'
  var token = null
  var repo = 'piaoyun05/classroom-interaction-web'
  var branch = 'data'
  var dataPath = 'course-data.json'
  var enabled = false
  var pollTimer = null

  function cfg() {
    return (typeof global.APP_CONFIG === 'object' && global.APP_CONFIG) ? global.APP_CONFIG : null
  }

  function init() {
    var c = cfg()
    if (!c || !c.GITHUB_TOKEN) return false
    token = c.GITHUB_TOKEN
    if (c.REPO) repo = c.REPO
    if (c.BRANCH) branch = c.BRANCH
    if (c.DATA_PATH) dataPath = c.DATA_PATH
    enabled = true
    return true
  }

  function headers() {
    return {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    }
  }

  function decodeContent(b64) {
    if (typeof atob === 'function') { return decodeURIComponent(escape(atob(b64))) }
    if (typeof global.Buffer !== 'undefined') { return new global.Buffer(b64, 'base64').toString('utf8') }
    return b64
  }
  function encodeContent(str) {
    if (typeof btoa === 'function') { return btoa(unescape(encodeURIComponent(str))) }
    if (typeof global.Buffer !== 'undefined') { return new global.Buffer(str, 'utf8').toString('base64') }
    return str
  }

  // 读取数据文件 -> { store, sha }
  function readStore() {
    var url = API + '/repos/' + repo + '/contents/' + dataPath + '?ref=' + branch
    return fetch(url, { headers: headers() }).then(function (r) {
      if (!r.ok) throw new Error('read ' + r.status)
      return r.json()
    }).then(function (d) {
      var store = {}
      if (d.content) {
        try { store = JSON.parse(decodeContent(d.content)) || {} } catch (e) { store = {} }
      }
      return { store: store, sha: d.sha || null }
    })
  }

  function writeStore(store, sha) {
    var payload = {
      message: 'sync ' + new Date().toISOString(),
      branch: branch,
      content: encodeContent(JSON.stringify(store, null, 2))
    }
    if (sha) payload.sha = sha
    return fetch(API + '/repos/' + repo + '/contents/' + dataPath, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) {
        if (r.status === 409) return false // SHA 冲突，由 updateStore 重试
        throw new Error('write ' + r.status)
      }
      return true
    })
  }

  // 读-改-写（带乐观锁冲突重试）
  function updateStore(fn) {
    return readStore().then(function (rs) {
      if (fn(rs.store) === false) return false
      return writeStore(rs.store, rs.sha).then(function (ok) {
        if (ok) return true
        // 409 冲突：重读最新数据后重写一次
        return readStore().then(function (rs2) {
          if (fn(rs2.store) === false) return false
          return writeStore(rs2.store, rs2.sha).then(function (ok2) { return !!ok2 })
        })
      })
    }).catch(function (e) { console.warn('[backend] update', e); return false })
  }

  // 课程维度拉取全部共享数据
  function loadGist(courseId) {
    if (!enabled) return Promise.resolve(null)
    return readStore().then(function (rs) {
      var store = rs.store
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
    return updateStore(function (store) {
      if (table === 'courses') {
        store.courses = store.courses || {}
        store.courses[row.id] = row
        return true
      }
      store.data = store.data || {}
      store.data[courseId] = store.data[courseId] || { publishes: [], messages: [], discussions: [], config: {} }
      var bucket = store.data[courseId]
      if (table === 'course_config') {
        var conf = Object.assign({}, row)
        delete conf.courseId
        bucket.config = conf
        return true
      }
      var list = bucket[table] || []
      var idx = -1
      for (var i = 0; i < list.length; i++) { if (list[i].id === row.id) { idx = i; break } }
      if (idx >= 0) list[idx] = row; else list.unshift(row)
      bucket[table] = list
      return true
    })
  }

  function remove(table, id, courseId) {
    if (!enabled || !courseId) return Promise.resolve(false)
    return updateStore(function (store) {
      var bucket = store.data && store.data[courseId]
      if (!bucket) return false
      if (table === 'course_config') {
        bucket.config = null
        return true
      }
      var list = bucket[table] || []
      bucket[table] = list.filter(function (x) { return x.id !== id })
      return true
    })
  }

  // 轮询式实时同步：数据文件 SHA 变化时回调
  function subscribe(courseId, onChange) {
    if (!enabled) return
    unsubscribe()
    var last = null
    var url = API + '/repos/' + repo + '/contents/' + dataPath + '?ref=' + branch
    pollTimer = setInterval(function () {
      fetch(url, { headers: headers() }).then(function (r) {
        return r.ok ? r.json() : null
      }).then(function (d) {
        if (!d || !d.sha) return
        if (d.sha !== last) {
          last = d.sha
          onChange && onChange()
        }
      }).catch(function () {})
    }, 30000)
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
