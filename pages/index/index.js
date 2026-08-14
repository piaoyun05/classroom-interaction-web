const app = getApp()
const { timeAgo, storage, CATEGORY_MAP } = require('../../utils/util')
const mockData = require('../../mock/data')

Page({
  data: {
    courseName: '',
    courseTeacher: '',
    role: 'student',
    activeTab: 0,
    tabs: ['信息发布', '学生留言', '讨论区'],
    publishes: [],
    messages: [],
    discussions: [],
    aiWeeklySummary: null,
    showAiSummary: false
  },

  onLoad() {
    this.setData({
      courseName: app.globalData.courseName,
      courseTeacher: app.globalData.courseTeacher,
      role: app.globalData.role
    })
    this.loadData()
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    // 从本地存储读取，没有则用mock数据
    let publishes = storage.get('publishes', mockData.publishes)
    let messages = storage.get('messages', mockData.messages)
    let discussions = storage.get('discussions', mockData.discussions)

    // 格式化时间
    publishes = publishes.map(p => ({ ...p, timeText: timeAgo(p.createTime) }))
    messages = messages.map(m => ({ ...m, timeText: timeAgo(m.createTime) }))
    discussions = discussions.map(d => ({ ...d, timeText: timeAgo(d.createTime) }))

    // 预计算待回复留言数（WXML 不支持 filter 等方法调用）
    const unrepliedCount = messages.filter(m => !m.replied).length

    this.setData({ publishes, messages, discussions, unrepliedCount })
  },

  switchTab(e) {
    const idx = e.currentTarget.dataset.idx
    this.setData({ activeTab: idx })
  },

  swiperChange(e) {
    this.setData({ activeTab: e.detail.current })
  },

  // 跳转到发布详情
  goPublishDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/publishDetail/publishDetail?id=${id}` })
  },

  // 跳转到新建发布
  goPublishNew() {
    wx.navigateTo({ url: '/pages/publishNew/publishNew' })
  },

  // 跳转到留言详情
  goMessageNew() {
    wx.navigateTo({ url: '/pages/messageNew/messageNew' })
  },

  // 跳转到讨论详情
  goDiscussionDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/discussionDetail/discussionDetail?id=${id}` })
  },

  // 跳转到新建讨论
  goDiscussionNew() {
    wx.navigateTo({ url: '/pages/discussionNew/discussionNew' })
  },

  // AI 周报查看
  viewAiWeekly() {
    this.setData({ showAiSummary: true })
  },

  closeAiSummary() {
    this.setData({ showAiSummary: false })
  },

  // 阻止弹窗内容区域点击冒泡到遮罩层
  stopPropagation() {},

  // 切换角色（演示用）
  switchRole() {
    const newRole = this.data.role === 'teacher' ? 'student' : 'teacher'
    app.globalData.role = newRole
    this.setData({ role: newRole })
    wx.showToast({
      title: newRole === 'teacher' ? '已切换为教师端' : '已切换为学生端',
      icon: 'none'
    })
  },

  getCategoryLabel(cat) {
    return CATEGORY_MAP[cat] ? CATEGORY_MAP[cat].label : cat
  }
})
