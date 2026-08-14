const { timeAgo, formatTime, storage, showToast, genId } = require('../../utils/util')
const { aiAnswer } = require('../../utils/aiEngine')
const mockData = require('../../mock/data')

Page({
  data: {
    discussion: null,
    commentText: '',
    aiLoading: false,
    liked: false
  },

  onLoad(options) {
    this.discussionId = options.id
    this.loadDiscussion()
  },

  onShow() {
    this.loadDiscussion()
  },

  loadDiscussion() {
    let discussions = storage.get('discussions', mockData.discussions)
    let discussion = discussions.find(d => d.id === this.discussionId)

    if (discussion) {
      discussion.timeText = timeAgo(discussion.createTime)
      discussion.comments = discussion.comments.map(c => ({
        ...c,
        timeText: timeAgo(c.createTime)
      }))
      if (discussion.aiAnswerTime) {
        discussion.aiAnswerTimeText = formatTime(new Date(discussion.aiAnswerTime))
      }
      this.setData({ discussion, liked: discussion.liked || false })
    }
  },

  // 点赞
  toggleLike() {
    let discussions = storage.get('discussions', mockData.discussions)
    const idx = discussions.findIndex(d => d.id === this.discussionId)
    if (idx === -1) return

    const liked = !this.data.liked
    discussions[idx].liked = liked
    discussions[idx].likes = liked ? discussions[idx].likes + 1 : discussions[idx].likes - 1
    storage.set('discussions', discussions)

    this.setData({
      liked,
      'discussion.likes': discussions[idx].likes
    })
  },

  // 评论输入
  onCommentInput(e) {
    this.setData({ commentText: e.detail.value })
  },

  // 提交评论
  submitComment() {
    if (!this.data.commentText.trim()) {
      showToast('请输入评论内容')
      return
    }

    let discussions = storage.get('discussions', mockData.discussions)
    const idx = discussions.findIndex(d => d.id === this.discussionId)
    if (idx === -1) return

    const newComment = {
      author: '我',
      content: this.data.commentText,
      createTime: Date.now()
    }

    discussions[idx].comments.push(newComment)
    storage.set('discussions', discussions)

    this.setData({ commentText: '' })
    this.loadDiscussion()
    showToast('评论成功', 'success')
  },

  // 核心：AI解答按钮
  async getAiAnswer() {
    if (this.data.discussion.aiAnswer) {
      showToast('AI已解答，请查看下方')
      return
    }

    this.setData({ aiLoading: true })

    try {
      const result = await aiAnswer(this.data.discussion.title + ' ' + this.data.discussion.content, {})

      // 保存AI解答
      let discussions = storage.get('discussions', mockData.discussions)
      const idx = discussions.findIndex(d => d.id === this.discussionId)
      if (idx !== -1) {
        discussions[idx].aiAnswer = result.answer
        discussions[idx].aiAnswerTime = Date.now()
        storage.set('discussions', discussions)
      }

      this.loadDiscussion()
      showToast('AI解答完成', 'success')
    } catch (e) {
      showToast('AI解答失败，请重试')
    }

    this.setData({ aiLoading: false })
  }
})
