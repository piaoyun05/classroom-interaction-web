// 网页版工具函数（由微信小程序版转换而来）
(function (global) {
  'use strict'

  function padZero(n) {
    return n < 10 ? '0' + n : '' + n
  }

  // 格式化时间
  function formatTime(date) {
    if (typeof date === 'number') date = new Date(date)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hour = date.getHours()
    const minute = date.getMinutes()
    return `${year}-${padZero(month)}-${padZero(day)} ${padZero(hour)}:${padZero(minute)}`
  }

  function formatDate(date) {
    if (typeof date === 'number') date = new Date(date)
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${padZero(month)}-${padZero(day)}`
  }

  // 相对时间
  function timeAgo(timestamp) {
    const now = Date.now()
    const diff = now - timestamp
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour

    if (diff < minute) return '刚刚'
    if (diff < hour) return Math.floor(diff / minute) + '分钟前'
    if (diff < day) return Math.floor(diff / hour) + '小时前'
    if (diff < 7 * day) return Math.floor(diff / day) + '天前'
    return formatTime(new Date(timestamp))
  }

  // 生成唯一ID
  function genId() {
    return 'id_' + Date.now() + '_' + Math.floor(Math.random() * 10000)
  }

  // 内容分类映射
  const CATEGORY_MAP = {
    notice: { label: '课程通知', color: 'tag-notice' },
    knowledge: { label: '知识点资料', color: 'tag-knowledge' },
    homework: { label: '作业任务', color: 'tag-homework' },
    keypoint: { label: '教学重点', color: 'tag-keypoint' }
  }

  const DISCUSSION_CATEGORY_MAP = {
    knowledge: { label: '知识点讨论', color: 'tag-notice' },
    exercise: { label: '习题答疑', color: 'tag-homework' },
    experience: { label: '学习经验', color: 'tag-knowledge' },
    question: { label: '课堂疑问', color: 'tag-keypoint' }
  }

  const MESSAGE_TYPE_MAP = {
    knowledge: '知识点疑问',
    suggest: '教学建议',
    homework: '作业问题',
    other: '其他'
  }

  // 浏览器版本地存储
  const storage = {
    get(key, defaultVal) {
      try {
        const val = localStorage.getItem(key)
        return val ? JSON.parse(val) : defaultVal
      } catch (e) {
        return defaultVal
      }
    },
    set(key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val))
      } catch (e) {
        console.error('Storage set error:', e)
      }
    }
  }

  // 显示提示
  function showToast(title, icon) {
    const t = document.getElementById('toast')
    if (!t) return
    t.textContent = title
    t.classList.add('show')
    if (icon === 'success') t.classList.add('toast-success')
    setTimeout(function () {
      t.classList.remove('show')
      t.classList.remove('toast-success')
    }, 2000)
  }

  // 模拟AI请求延迟
  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms || 800)
    })
  }

  // HTML 转义
  function escapeHtml(str) {
    if (!str) return ''
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  // 文本换行转 <br/>
  function nl2br(str) {
    if (!str) return ''
    return escapeHtml(str).replace(/\n/g, '<br/>')
  }

  global.Util = {
    formatTime: formatTime,
    formatDate: formatDate,
    timeAgo: timeAgo,
    genId: genId,
    delay: delay,
    showToast: showToast,
    storage: storage,
    escapeHtml: escapeHtml,
    nl2br: nl2br,
    CATEGORY_MAP: CATEGORY_MAP,
    DISCUSSION_CATEGORY_MAP: DISCUSSION_CATEGORY_MAP,
    MESSAGE_TYPE_MAP: MESSAGE_TYPE_MAP
  }
})(window)
