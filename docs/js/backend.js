// ============================================================
// 云端同步层（腾讯云开发 CloudBase）
// - 集合 courses：每个课程一条文档，_id=courseId，字段：
//   meta(course)、publishes[]、messages[]、discussions[]、config{}
// - 匿名登录（signInAnonymously），数据库安全规则由控制台设置
//   { "read": true, "write": true }（所有用户可读可写）
// - 新增用 db.command.push 原子追加；修改用读-改-写更新字段
// - 实时同步用 doc.watch（实时推送），watch 不可用时降级 20s 轮询
// - 未配置 CLOUDBASE_ENV 或未加载 js-sdk 时 enabled=false，降级 localStorage
// ============================================================
(function (global) {
  'use strict'

  var env = null
  var region = null
  var app = null
  var db = null
  var enabled = false
  var authReady = Promise.resolve(true) // 未启用时为已就绪
  var watcher = null
  var pollTimer = null

  function cfg() {
    return (typeof global.APP_CONFIG === 'object' && global.APP_CONFIG) ? global.APP_CONFIG : null
  }

  function init() {
    var c = cfg()
    if (!c || !c.CLOUDBASE_ENV) return false
    if (typeof global.cloudbase === 'undefined' || !global.cloudbase.init) return false
    env = c.CLOUDBASE_ENV
    if (c.CLOUDBASE_REGION) region = c.CLOUDBASE_REGION
    try {
      var initOpts = { env: env }
      if (region) initOpts.region = region
      app = global.cloudbase.init(initOpts)
      db = app.database()
      var auth = app.auth()
      if (auth && typeof auth.signInAnonymously === 'function') {
        authReady = auth.signInAnonymously().then(function () {
          enabled = true
          return true
        }).catch(function (e) {
          console.warn('[backend] CloudBase 匿名登录失败', e)
          enabled = false
          return false
        })
      } else if (auth && typeof auth.anonymousAuthProvider === 'function') {
        authReady = auth.anonymousAuthProvider().signIn().then(function () {
          enabled = true
          return true
        }).catch(function (e) {
          console.warn('[backend] CloudBase 匿名登录失败', e)
          enabled = false
          return false
        })
      } else {
        enabled = true
      }
      return true
    } catch (e) {
      console.warn('[backend] CloudBase init 失败', e)
      enabled = false
      return false
    }
  }

  function objWith(key, val) {
    var o = {}
    o[key] = val
    return o
  }

  function collectionDoc(courseId) {
    return db.collection('courses').doc(courseId)
  }

  function getDoc(courseId) {
    return collectionDoc(courseId).get().then(function (res) {
      var d = res && res.data
      if (!d) return null
      if (Array.isArray(d)) return d.length ? d[0] : null
      return d
    }).catch(function (e) { console.warn('[backend] getDoc', e); return null })
  }

  // 课程维度拉取全部共享数据
  function loadGist(courseId) {
    if (!enabled) return Promise.resolve(null)
    return authReady.then(function () {
      if (!enabled) return null
      return getDoc(courseId)
    }).then(function (doc) {
      if (!doc || !doc.meta) return null
      return {
        course: doc.meta,
        publishes: doc.publishes || [],
        messages: doc.messages || [],
        discussions: doc.discussions || [],
        config: doc.config || null
      }
    }).catch(function (e) { console.warn('[backend] loadGist', e); return null })
  }

  // 写入（插入/更新）。row 需带 courseId（courses 表用 row.id）
  function upsert(table, row) {
    if (!enabled) return Promise.resolve(false)
    var courseId = (table === 'courses') ? row.id : row.courseId
    if (!courseId) return Promise.resolve(false)
    return authReady.then(function () {
      if (!enabled) return false
      if (table === 'courses') {
        return getDoc(courseId).then(function (doc) {
          if (!doc) {
            return collectionDoc(courseId).set({ meta: row, publishes: [], messages: [], discussions: [], config: {} }).then(function () { return true })
          }
          return collectionDoc(courseId).update({ meta: row }).then(function () { return true })
        })
      }
      var field = (table === 'course_config') ? 'config' : table
      return getDoc(courseId).then(function (doc) {
        if (!doc) {
          // 文档不存在：初始化
          var init = { publishes: [], messages: [], discussions: [], config: {} }
          if (field === 'config') {
            var conf0 = Object.assign({}, row)
            delete conf0.courseId
            init.config = conf0
          } else {
            init[field] = [row]
          }
          return collectionDoc(courseId).set(init).then(function () { return true })
        }
        if (field === 'config') {
          var conf = Object.assign({}, row)
          delete conf.courseId
          return collectionDoc(courseId).update({ config: conf }).then(function () { return true })
        }
        var list = doc[field] || []
        var idx = -1
        for (var i = 0; i < list.length; i++) { if (list[i].id === row.id) { idx = i; break } }
        if (idx >= 0) {
          list[idx] = row
          return collectionDoc(courseId).update(objWith(field, list)).then(function () { return true })
        }
        // 新增：原子追加，避免并发覆盖
        return collectionDoc(courseId).update(objWith(field, db.command.push([row]))).then(function () { return true })
      })
    }).catch(function (e) { console.warn('[backend] upsert', table, e); return false })
  }

  function remove(table, id, courseId) {
    if (!enabled || !courseId) return Promise.resolve(false)
    return authReady.then(function () {
      if (!enabled) return false
      var field = (table === 'course_config') ? 'config' : table
      return getDoc(courseId).then(function (doc) {
        if (!doc) return false
        if (field === 'config') {
          return collectionDoc(courseId).update({ config: {} }).then(function () { return true })
        }
        var list = (doc[field] || []).filter(function (x) { return x.id !== id })
        return collectionDoc(courseId).update(objWith(field, list)).then(function () { return true })
      })
    }).catch(function (e) { console.warn('[backend] remove', table, e); return false })
  }

  // 实时同步：doc.watch 优先，watch 报错则降级 20s 轮询
  function subscribe(courseId, onChange) {
    if (!enabled) return
    unsubscribe()
    authReady.then(function () {
      if (!enabled) return
      var polling = false
      function startPoll() {
        if (polling) return
        polling = true
        pollTimer = setInterval(function () { onChange && onChange() }, 20000)
      }
      try {
        watcher = collectionDoc(courseId).watch({
          onChange: function () { onChange && onChange() },
          onError: function (err) {
            console.warn('[backend] watch 不可用，降级轮询', err)
            if (watcher) { try { watcher.close() } catch (e2) { watcher = null } }
            startPoll()
          }
        })
      } catch (e) {
        startPoll()
      }
    })
  }

  function unsubscribe() {
    if (watcher) { try { watcher.close() } catch (e) {} watcher = null }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }

  global.Backend = {
    init: init,
    isEnabled: function () { return enabled },
    // 匿名登录完成后再算可用；供 app 在就绪后触发首次同步
    get ready() { return authReady },
    upsert: upsert,
    remove: remove,
    loadGist: loadGist,
    loadAll: loadGist, // 兼容旧调用
    subscribe: subscribe,
    unsubscribe: unsubscribe
  }
})(window)
