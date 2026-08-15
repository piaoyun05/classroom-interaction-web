// ============================================================
// 云端同步层（Supabase）
// - 未配置 APP_CONFIG 或未加载 supabase-js 时，enabled=false，
//   全部方法静默降级，应用继续走本地 localStorage（不影响演示/测试）。
// - 配置后：课程数据写入 Supabase，跨设备（老师/学生）实时同步。
// - 表结构与宽松 RLS 策略见 js/supabase_schema.sql
// ============================================================
(function (global) {
  'use strict'

  var TABLES = {
    courses: {
      pk: 'id',
      courseField: null,
      map: { id: 'id', name: 'name', className: 'class_name', semester: 'semester', intro: 'intro', teacherName: 'teacher_name', createdAt: 'created_at' }
    },
    publishes: {
      pk: 'id',
      courseField: 'courseId',
      map: { id: 'id', courseId: 'course_id', title: 'title', category: 'category', content: 'content', summary: 'summary', author: 'author', createTime: 'create_time', isTop: 'is_top', views: 'views', deadline: 'deadline', attachments: 'attachments' }
    },
    messages: {
      pk: 'id',
      courseField: 'courseId',
      map: { id: 'id', courseId: 'course_id', studentName: 'student_name', isAnonymous: 'is_anonymous', type: 'type', content: 'content', createTime: 'create_time', replied: 'replied', reply: 'reply', replyTime: 'reply_time', status: 'status' }
    },
    discussions: {
      pk: 'id',
      courseField: 'courseId',
      map: { id: 'id', courseId: 'course_id', author: 'author', avatar: 'avatar', category: 'category', title: 'title', content: 'content', createTime: 'create_time', likes: 'likes', liked: 'liked', comments: 'comments', aiAnswer: 'ai_answer', aiAnswerTime: 'ai_answer_time', aiPinned: 'ai_pinned', reviewed: 'reviewed' }
    },
    course_config: {
      pk: 'courseId',
      courseField: 'courseId',
      map: { courseId: 'course_id', pageStyle: 'page_style', messageReviewEnabled: 'message_review_enabled', discussionPostEnabled: 'discussion_post_enabled', aiAnswerEnabled: 'ai_answer_enabled' }
    },
    app_config: {
      pk: 'id',
      courseField: null,
      map: { id: 'id', aiKey: 'ai_key' }
    }
  }

  var client = null
  var enabled = false

  function cfg() {
    return (typeof global.APP_CONFIG === 'object' && global.APP_CONFIG) ? global.APP_CONFIG : null
  }

  function init() {
    var c = cfg()
    if (!c || !c.SUPABASE_URL || !c.SUPABASE_ANON_KEY) return false
    if (typeof global.supabase === 'undefined' || !global.supabase.createClient) return false
    try {
      client = global.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY)
      enabled = true
      return true
    } catch (e) {
      enabled = false
      return false
    }
  }

  // JS 对象 -> 数据库列
  function toDb(table, row) {
    var m = TABLES[table].map
    var out = {}
    Object.keys(m).forEach(function (jsKey) {
      var dbKey = m[jsKey]
      var v = row[jsKey]
      if (v === undefined) return
      // jsonb 字段序列化
      if (dbKey === 'attachments' || dbKey === 'comments') {
        out[dbKey] = (v === null || v === undefined) ? '[]' : JSON.stringify(v)
      } else {
        out[dbKey] = v
      }
    })
    return out
  }

  // 数据库行 -> JS 对象
  function fromDb(table, row) {
    var m = TABLES[table].map
    var out = {}
    Object.keys(m).forEach(function (jsKey) {
      var dbKey = m[jsKey]
      var v = row[dbKey]
      if (v === undefined || v === null) return
      if (dbKey === 'attachments' || dbKey === 'comments') {
        try { out[jsKey] = typeof v === 'string' ? JSON.parse(v) : v } catch (e) { out[jsKey] = [] }
      } else {
        out[jsKey] = v
      }
    })
    return out
  }

  // 写入（插入或更新）
  function upsert(table, row) {
    if (!enabled || !client) return Promise.resolve(false)
    var dbRow = toDb(table, row)
    return client.from(table).upsert(dbRow).then(function (r) {
      if (r.error) { console.warn('[backend] upsert', table, r.error.message); return false }
      return true
    }).catch(function (e) { console.warn('[backend] upsert', table, e); return false })
  }

  function remove(table, id) {
    if (!enabled || !client) return Promise.resolve(false)
    var pk = TABLES[table].pk
    var col = (TABLES[table].map && TABLES[table].map[pk]) || pk
    return client.from(table).delete().eq(col, id).then(function (r) {
      if (r.error) { console.warn('[backend] remove', table, r.error.message); return false }
      return true
    }).catch(function (e) { console.warn('[backend] remove', table, e); return false })
  }

  // 按 courseId 拉取某张表全部数据
  function loadByCourse(table, courseId) {
    if (!enabled || !client) return Promise.resolve(null)
    var cf = TABLES[table].courseField
    var dbCol = cf ? TABLES[table].map[cf] : null
    var q = client.from(table).select('*')
    if (dbCol) q = q.eq(dbCol, courseId)
    return q.then(function (r) {
      if (r.error) { console.warn('[backend] load', table, r.error.message); return null }
      return (r.data || []).map(function (row) { return fromDb(table, row) })
    }).catch(function (e) { console.warn('[backend] load', table, e); return null })
  }

  // 拉取课程本身
  function loadCourse(courseId) {
    if (!enabled || !client) return Promise.resolve(null)
    return client.from('courses').select('*').eq('id', courseId).single().then(function (r) {
      if (r.error || !r.data) return null
      return fromDb('courses', r.data)
    }).catch(function () { return null })
  }

  // 一次性拉取某课程的全部共享数据
  function loadAll(courseId) {
    if (!enabled || !client) return Promise.resolve(null)
    return Promise.all([
      loadByCourse('publishes', courseId),
      loadByCourse('messages', courseId),
      loadByCourse('discussions', courseId),
      loadByCourse('course_config', courseId)
    ]).then(function (res) {
      return {
        course: null, // 由 loadCourse / QR meta 提供
        publishes: res[0] || [],
        messages: res[1] || [],
        discussions: res[2] || [],
        config: (res[3] && res[3][0]) ? res[3][0] : null
      }
    })
  }

  // Realtime 订阅：某课程任意表变更时回调
  var channel = null
  function subscribe(courseId, onChange) {
    if (!enabled || !client || !courseId) return
    unsubscribe()
    var tables = ['courses', 'publishes', 'messages', 'discussions', 'course_config']
    channel = client.channel('course-sync-' + courseId)
    tables.forEach(function (t) {
      var filter = ''
      var cf = TABLES[t].courseField
      if (t === 'courses') filter = 'id=eq.' + courseId
      else if (cf) filter = 'course_id=eq.' + courseId
      channel.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: filter }, function () {
        onChange && onChange(t)
      })
    })
    channel.subscribe(function (status) {
      if (status !== 'SUBSCRIBED') console.warn('[backend] realtime', status)
    })
  }

  // 读取全局配置（如云端共享的 AI key）：id='global'
  function loadAppConfig() {
    if (!enabled || !client) return Promise.resolve(null)
    return client.from('app_config').select('*').eq('id', 'global').single().then(function (r) {
      if (r.error || !r.data) return null
      return fromDb('app_config', r.data)
    }).catch(function () { return null })
  }

  function unsubscribe() {
    if (client && channel) { client.removeChannel(channel); channel = null }
  }

  global.Backend = {
    init: init,
    isEnabled: function () { return enabled },
    upsert: upsert,
    remove: remove,
    loadCourse: loadCourse,
    loadAll: loadAll,
    loadGist: loadAll, // 兼容 app.js 的学生视角调用
    loadAppConfig: loadAppConfig,
    subscribe: subscribe,
    unsubscribe: unsubscribe
  }
})(window)
