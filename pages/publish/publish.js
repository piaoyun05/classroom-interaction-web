const { timeAgo, storage } = require('../../utils/util')
const mockData = require('../../mock/data')

Page({
  data: {
    publishes: [],
    filter: 'all',
    filters: [
      { key: 'all', label: '全部' },
      { key: 'notice', label: '课程通知' },
      { key: 'knowledge', label: '知识点资料' },
      { key: 'homework', label: '作业任务' },
      { key: 'keypoint', label: '教学重点' }
    ]
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    let publishes = storage.get('publishes', mockData.publishes)
    publishes = publishes.map(p => ({ ...p, timeText: timeAgo(p.createTime) }))

    if (this.data.filter !== 'all') {
      publishes = publishes.filter(p => p.category === this.data.filter)
    }

    this.setData({ publishes })
  },

  switchFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.key }, () => this.loadData())
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/publishDetail/publishDetail?id=${id}` })
  },

  goNew() {
    wx.navigateTo({ url: '/pages/publishNew/publishNew' })
  }
})
