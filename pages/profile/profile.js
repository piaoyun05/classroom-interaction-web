const app = getApp()
const { storage } = require('../../utils/util')
const mockData = require('../../mock/data')

Page({
  data: {
    role: 'student',
    courseName: '',
    courseTeacher: '',
    stats: {},
    menuItems: []
  },

  onLoad() {
    this.setData({
      role: app.globalData.role,
      courseName: app.globalData.courseName,
      courseTeacher: app.globalData.courseTeacher
    })
    this.loadStats()
    this.buildMenu()
  },

  onShow() {
    this.loadStats()
  },

  loadStats() {
    const publishes = storage.get('publishes', mockData.publishes)
    const messages = storage.get('messages', mockData.messages)
    const discussions = storage.get('discussions', mockData.discussions)

    this.setData({
      stats: {
        publishCount: publishes.length,
        messageCount: messages.length,
        discussionCount: discussions.length,
        unansweredCount: messages.filter(m => !m.replied).length
      }
    })
  },

  buildMenu() {
    const teacherMenu = [
      { icon: '📝', label: '我的发布', path: '/pages/publish/publish' },
      { icon: '📊', label: 'AI教学周报', path: '' },
      { icon: '👥', label: '学生管理', path: '' },
      { icon: '⚙️', label: '课程设置', path: '' },
      { icon: '📤', label: '导出数据', path: '' }
    ]
    const studentMenu = [
      { icon: '💬', label: '我的留言', path: '/pages/message/message' },
      { icon: '💭', label: '我的讨论', path: '/pages/discussion/discussion' },
      { icon: '🤖', label: 'AI学习建议', path: '' },
      { icon: '📚', label: '课程知识库', path: '' },
      { icon: '📋', label: '学习记录', path: '' }
    ]

    this.setData({
      menuItems: this.data.role === 'teacher' ? teacherMenu : studentMenu
    })
  },

  switchRole() {
    const newRole = this.data.role === 'teacher' ? 'student' : 'teacher'
    app.globalData.role = newRole
    this.setData({ role: newRole }, () => {
      this.buildMenu()
    })
    wx.showToast({
      title: newRole === 'teacher' ? '已切换为教师端' : '已切换为学生端',
      icon: 'none'
    })
  },

  goMenu(e) {
    const path = e.currentTarget.dataset.path
    if (path) {
      // tabBar 页面必须用 switchTab 跳转
      const tabPages = ['/pages/index/index', '/pages/discussion/discussion', '/pages/aiQA/aiQA', '/pages/profile/profile']
      if (tabPages.includes(path)) {
        wx.switchTab({ url: path })
      } else {
        wx.navigateTo({ url: path })
      }
    } else {
      wx.showToast({ title: '功能开发中', icon: 'none' })
    }
  },

  about() {
    wx.showModal({
      title: '关于',
      content: 'AI赋能课堂互动微信小程序 v1.0\n\n基于课程专属互动场景，集成AI智能整理、答疑、总结功能。',
      showCancel: false
    })
  }
})
