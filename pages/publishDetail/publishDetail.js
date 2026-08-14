const { formatTime, storage, showToast } = require('../../utils/util')
const mockData = require('../../mock/data')

Page({
  data: {
    publish: null,
    categoryLabel: ''
  },

  onLoad(options) {
    const id = options.id
    let publishes = storage.get('publishes', mockData.publishes)
    let publish = publishes.find(p => p.id === id)

    if (publish) {
      publish.timeText = formatTime(new Date(publish.createTime))
      const labels = {
        notice: '课程通知',
        knowledge: '知识点资料',
        homework: '作业任务',
        keypoint: '教学重点'
      }
      this.setData({
        publish,
        categoryLabel: labels[publish.category] || ''
      })

      // 增加浏览量
      publish.views = (publish.views || 0) + 1
      const idx = publishes.findIndex(p => p.id === id)
      publishes[idx] = publish
      storage.set('publishes', publishes)
    }
  },

  previewAttachment() {
    showToast('附件预览功能开发中')
  }
})
