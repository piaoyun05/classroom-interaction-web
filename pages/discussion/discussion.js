const { timeAgo, storage } = require('../../utils/util')
const mockData = require('../../mock/data')

Page({
  data: {
    discussions: [],
    filter: 'all',
    filters: [
      { key: 'all', label: '全部' },
      { key: 'knowledge', label: '知识点' },
      { key: 'exercise', label: '习题答疑' },
      { key: 'experience', label: '学习经验' },
      { key: 'question', label: '课堂疑问' }
    ]
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    let discussions = storage.get('discussions', mockData.discussions)
    discussions = discussions.map(d => ({ ...d, timeText: timeAgo(d.createTime) }))

    if (this.data.filter !== 'all') {
      discussions = discussions.filter(d => d.category === this.data.filter)
    }

    this.setData({ discussions })
  },

  switchFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.key }, () => this.loadData())
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/discussionDetail/discussionDetail?id=${id}` })
  },

  goNew() {
    wx.navigateTo({ url: '/pages/discussionNew/discussionNew' })
  },

  // 预览图片等操作可扩展
  onShareAppMessage() {
    return {
      title: `${this.data.courseName || '课堂互动'} - 讨论区`,
      path: '/pages/discussion/discussion'
    }
  }
})
