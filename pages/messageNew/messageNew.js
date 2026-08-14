const { storage, showToast, genId } = require('../../utils/util')
const mockData = require('../../mock/data')

Page({
  data: {
    content: '',
    isAnonymous: true,
    type: 'knowledge',
    types: [
      { key: 'knowledge', label: '知识点疑问' },
      { key: 'homework', label: '作业问题' },
      { key: 'suggest', label: '教学建议' },
      { key: 'other', label: '其他' }
    ],
    submitting: false
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  toggleAnonymous() {
    this.setData({ isAnonymous: !this.data.isAnonymous })
  },

  selectType(e) {
    this.setData({ type: e.currentTarget.dataset.key })
  },

  submit() {
    if (!this.data.content.trim()) {
      showToast('请输入留言内容')
      return
    }

    this.setData({ submitting: true })

    const newMessage = {
      id: genId(),
      studentName: this.data.isAnonymous ? '匿名同学' : '我',
      isAnonymous: this.data.isAnonymous,
      type: this.data.type,
      content: this.data.content,
      createTime: Date.now(),
      replied: false
    }

    let messages = storage.get('messages', mockData.messages)
    messages.unshift(newMessage)
    storage.set('messages', messages)

    this.setData({ submitting: false })
    showToast('留言已提交', 'success')

    setTimeout(() => {
      wx.navigateBack()
    }, 1500)
  }
})
