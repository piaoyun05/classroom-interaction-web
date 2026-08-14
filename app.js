App({
  globalData: {
    userInfo: null,
    role: 'student', // 'teacher' or 'student'
    courseName: '高等数学（2026春季学期）',
    courseTeacher: '张教授',
    courseId: 'MATH2026',
    apiBase: 'http://localhost:3000/api'
  },
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 获取系统信息
    const systemInfo = wx.getSystemInfoSync()
    this.globalData.systemInfo = systemInfo
    this.globalData.statusBarHeight = systemInfo.statusBarHeight
    this.globalData.platform = systemInfo.platform
  }
})
