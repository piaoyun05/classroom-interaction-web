const app = getApp()
const { storage, showToast, genId } = require('../../utils/util')
const { aiClassifyContent, aiSummarize } = require('../../utils/aiEngine')
const mockData = require('../../mock/data')

Page({
  data: {
    title: '',
    content: '',
    isTop: false,
    submitting: false,
    aiProcessing: false,
    aiResult: null
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  toggleTop() {
    this.setData({ isTop: !this.data.isTop })
  },

  // AI 智能分类和摘要
  async aiProcess() {
    if (!this.data.content.trim()) {
      showToast('请先输入内容')
      return
    }

    this.setData({ aiProcessing: true })

    try {
      const [classifyResult, summary] = await Promise.all([
        aiClassifyContent(this.data.content),
        aiSummarize(this.data.content)
      ])

      const labels = {
        notice: '课程通知',
        knowledge: '知识点资料',
        homework: '作业任务',
        keypoint: '教学重点'
      }

      this.setData({
        aiResult: {
          category: classifyResult.category,
          categoryLabel: labels[classifyResult.category],
          confidence: Math.round(classifyResult.confidence * 100),
          summary
        }
      })
    } catch (e) {
      showToast('AI处理失败，请重试')
    }

    this.setData({ aiProcessing: false })
  },

  async submit() {
    if (!this.data.title.trim()) {
      showToast('请输入标题')
      return
    }
    if (!this.data.content.trim()) {
      showToast('请输入内容')
      return
    }

    this.setData({ submitting: true })

    // 如果还没AI处理，自动处理
    let aiResult = this.data.aiResult
    if (!aiResult) {
      const [classifyResult, summary] = await Promise.all([
        aiClassifyContent(this.data.content),
        aiSummarize(this.data.content)
      ])
      const labels = {
        notice: '课程通知',
        knowledge: '知识点资料',
        homework: '作业任务',
        keypoint: '教学重点'
      }
      aiResult = {
        category: classifyResult.category,
        categoryLabel: labels[classifyResult.category],
        confidence: Math.round(classifyResult.confidence * 100),
        summary
      }
    }

    // 构建新发布
    const newPublish = {
      id: genId(),
      title: this.data.title,
      content: this.data.content,
      summary: aiResult.summary,
      category: aiResult.category,
      author: app.globalData.courseTeacher,
      createTime: Date.now(),
      isTop: this.data.isTop,
      views: 0
    }

    // 保存到本地存储
    let publishes = storage.get('publishes', mockData.publishes)
    publishes.unshift(newPublish)
    storage.set('publishes', publishes)

    this.setData({ submitting: false })
    showToast('发布成功', 'success')

    setTimeout(() => {
      wx.navigateBack()
    }, 1500)
  }
})
