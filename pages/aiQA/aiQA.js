const app = getApp()
const { aiGlobalQA } = require('../../utils/aiEngine')
const { storage } = require('../../utils/util')
const mockData = require('../../mock/data')

Page({
  data: {
    courseName: '',
    inputText: '',
    loading: false,
    result: null,
    history: [],
    quickQuestions: [
      '今日课堂重点是什么？',
      '本周有哪些未解决的问题？',
      '总结第三章核心知识点',
      '作业第3题怎么解？'
    ]
  },

  onLoad() {
    this.setData({
      courseName: app.globalData.courseName,
      history: storage.get('qa_history', [])
    })
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  async ask() {
    const question = this.data.inputText.trim()
    if (!question) {
      wx.showToast({ title: '请输入问题', icon: 'none' })
      return
    }

    this.setData({ loading: true, result: null })

    try {
      // 模拟基于课程知识库的AI问答
      const courseData = {
        publishes: storage.get('publishes', mockData.publishes),
        messages: storage.get('messages', mockData.messages),
        discussions: storage.get('discussions', mockData.discussions)
      }

      const result = await aiGlobalQA(question, courseData)

      this.setData({ result })

      // 保存历史
      const historyItem = {
        question,
        answer: result.answer.substring(0, 50) + '...',
        time: Date.now()
      }
      let history = storage.get('qa_history', [])
      history.unshift(historyItem)
      history = history.slice(0, 20)
      storage.set('qa_history', history)
      this.setData({ history })
    } catch (e) {
      wx.showToast({ title: 'AI问答失败', icon: 'none' })
    }

    this.setData({ loading: false })
  },

  quickAsk(e) {
    const question = e.currentTarget.dataset.question
    this.setData({ inputText: question }, () => this.ask())
  },

  clearHistory() {
    storage.set('qa_history', [])
    this.setData({ history: [] })
    wx.showToast({ title: '已清空', icon: 'success' })
  },

  clearResult() {
    this.setData({ result: null, inputText: '' })
  }
})
