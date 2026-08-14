const app = getApp()
const { timeAgo, storage } = require('../../utils/util')
const { aiSummarizeMessages } = require('../../utils/aiEngine')
const mockData = require('../../mock/data')

Page({
  data: {
    messages: [],
    role: 'student',
    showAiSummary: false,
    aiSummary: null,
    aiLoading: false
  },

  onLoad() {
    this.setData({ role: app.globalData.role })
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    let messages = storage.get('messages', mockData.messages)
    messages = messages.map(m => ({ ...m, timeText: timeAgo(m.createTime) }))
    this.setData({ messages })
  },

  goNew() {
    wx.navigateTo({ url: '/pages/messageNew/messageNew' })
  },

  async viewAiSummary() {
    this.setData({ showAiSummary: true, aiLoading: true })

    let messages = storage.get('messages', mockData.messages)
    const summary = await aiSummarizeMessages(messages)

    this.setData({ aiSummary: summary, aiLoading: false })
  },

  closeAiSummary() {
    this.setData({ showAiSummary: false })
  },

  // 阻止弹窗内容区域点击冒泡到遮罩层
  stopPropagation() {}
})
