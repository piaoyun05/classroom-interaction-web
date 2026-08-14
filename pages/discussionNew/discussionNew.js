const { storage, showToast, genId } = require('../../utils/util')
const mockData = require('../../mock/data')

Page({
  data: {
    title: '',
    content: '',
    category: 'question',
    categories: [
      { key: 'knowledge', label: '知识点讨论' },
      { key: 'exercise', label: '习题答疑' },
      { key: 'experience', label: '学习经验' },
      { key: 'question', label: '课堂疑问' }
    ],
    submitting: false
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  selectCategory(e) {
    this.setData({ category: e.currentTarget.dataset.key })
  },

  submit() {
    if (!this.data.title.trim()) {
      showToast('请输入标题')
      return
    }
    if (!this.data.content.trim()) {
      showToast('请输入内容')
      return
    }

    this.setData({ submitting: true })

    const newDiscussion = {
      id: genId(),
      author: '我',
      avatar: '',
      category: this.data.category,
      title: this.data.title,
      content: this.data.content,
      createTime: Date.now(),
      likes: 0,
      liked: false,
      comments: [],
      aiAnswer: null,
      aiAnswerTime: null
    }

    let discussions = storage.get('discussions', mockData.discussions)
    discussions.unshift(newDiscussion)
    storage.set('discussions', discussions)

    this.setData({ submitting: false })
    showToast('发布成功', 'success')

    setTimeout(() => {
      wx.navigateBack()
    }, 1500)
  }
})
