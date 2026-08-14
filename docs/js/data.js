// 网页版 Mock 数据（由微信小程序版转换而来）
(function (global) {
  'use strict'

  var now = Date.now()
  var day = 24 * 60 * 60 * 1000

  // 课程基本信息（由教师创建，对应需求 2.1）
  var course = {
    id: 'course_math_3',
    name: '高等数学',
    className: '计科2401班',
    semester: '2025-2026学年第二学期',
    intro: '本课程涵盖极限与连续、导数与微分、积分学基础等内容，重点培养学生的数学思维与计算能力。',
    teacherName: '张教授',
    teacherRole: 'teacher',
    createdAt: now - 8 * day
  }

  // 教师基础配置（对应需求 2.1 基础配置）
  var config = {
    pageStyle: 'default',          // 页面展示样式
    messageReviewEnabled: false,   // 留言审核开关
    discussionPostEnabled: true,   // 讨论区发言权限
    aiAnswerEnabled: true          // AI 答疑开启/关闭
  }

  // 每日讨论总结（对应需求 2.2.3 AI周期总结）
  function fmtShort(t) {
    var d = new Date(t)
    function p(n) { return n < 10 ? '0' + n : '' + n }
    return p(d.getMonth() + 1) + '-' + p(d.getDate())
  }
  var dailyDiscussion = {
    date: fmtShort(now),
    keyPoints: ['极限的ε-δ定义', '两个重要极限', '等价无穷小替换'],
    commonDoubts: ['ε-δ定义的应用证明', '夹逼准则使用场景'],
    qualityViews: ['用打靶比喻理解ε-δ关系', '复利视角理解重要极限']
  }

  // 教师发布内容
  var publishes = [
    {
      id: 'pub_1',
      title: '第三章 极限与连续 - 教学重点梳理',
      category: 'keypoint',
      content: '本章节核心重点：1. 极限的ε-δ定义及其几何意义；2. 极限的四则运算法则；3. 两个重要极限；4. 连续函数的定义与性质。请同学们重点掌握极限的求解方法，特别是夹逼准则和单调有界准则的应用。',
      summary: '本章节涵盖极限定义、运算法则、重要极限及连续函数性质，重点掌握极限求解方法。',
      author: '张教授',
      createTime: now - 2 * 60 * 60 * 1000,
      isTop: true,
      views: 86,
      attachments: [{ name: '第三章课件.pdf', size: '2.3MB' }]
    },
    {
      id: 'pub_2',
      title: '【作业】第三章课后习题 1-10题',
      category: 'homework',
      content: '请同学们完成课本第三章课后习题第1-10题，要求写出完整解题过程。截止时间：本周五23:59。提交方式：拍照上传至小程序留言区，标题注明"学号-姓名-第三章作业"。',
      summary: '完成第三章课后习题1-10题，周五23:59前拍照提交。',
      author: '张教授',
      createTime: now - 5 * 60 * 60 * 1000,
      isTop: false,
      views: 72,
      deadline: now + 2 * day
    },
    {
      id: 'pub_3',
      title: '【通知】本周课堂时间调整',
      category: 'notice',
      content: '因学校活动安排，本周五（3月15日）的课堂调整至周六（3月16日）上午8:00-9:40，地点不变仍为教学楼A302。请同学们提前做好时间安排，相互转告。',
      summary: '周五课调至周六上午8:00-9:40，地点A302不变。',
      author: '张教授',
      createTime: now - day,
      isTop: false,
      views: 95
    },
    {
      id: 'pub_4',
      title: '知识点补充：等价无穷小替换表',
      category: 'knowledge',
      content: '常用等价无穷小（x→0时）：sinx~x, tanx~x, arcsinx~x, arctanx~x, 1-cosx~x²/2, e^x-1~x, ln(1+x)~x, (1+x)^a-1~ax。请同学们熟记并在求极限时灵活运用。',
      summary: '整理8个常用等价无穷小替换公式，求极限时灵活运用。',
      author: '张教授',
      createTime: now - 2 * day,
      isTop: false,
      views: 68
    },
    {
      id: 'pub_5',
      title: '课前预习：第四章 导数与微分',
      category: 'knowledge',
      content: '下周进入第四章学习，请同学们提前预习以下内容：1. 导数的定义及几何意义；2. 基本求导公式；3. 复合函数求导法则。建议参考课本P80-95页。',
      summary: '预习第四章导数与微分，参考课本P80-95页。',
      author: '张教授',
      createTime: now - 3 * day,
      isTop: false,
      views: 54
    }
  ]

  // 学生留言
  var messages = [
    {
      id: 'msg_1',
      studentName: '匿名同学',
      isAnonymous: true,
      type: 'knowledge',
      content: '老师，第三章中ε-δ定义我不是很理解，特别是怎么用定义去证明极限。能否课堂再讲一个例题？',
      createTime: now - 3 * 60 * 60 * 1000,
      replied: true,
      reply: '好的，下节课我会再用一个具体例题演示ε-δ定义的证明过程，请提前复习课本相关内容。',
      replyTime: now - 2 * 60 * 60 * 1000
    },
    {
      id: 'msg_2',
      studentName: '李明',
      isAnonymous: false,
      type: 'homework',
      content: '作业第3题的第二步变换没看懂，请问用的是哪个等价无穷小替换？',
      createTime: now - 6 * 60 * 60 * 1000,
      replied: true,
      reply: '第3题第二步用的是1-cosx~x²/2的等价替换，注意这里的x是指整个表达式趋近于0。',
      replyTime: now - 5 * 60 * 60 * 1000
    },
    {
      id: 'msg_3',
      studentName: '匿名同学',
      isAnonymous: true,
      type: 'suggest',
      content: '老师，觉得课堂节奏稍微有点快，能不能适当多留一点时间做课堂练习？',
      createTime: now - 8 * 60 * 60 * 1000,
      replied: false
    },
    {
      id: 'msg_4',
      studentName: '王小红',
      isAnonymous: false,
      type: 'knowledge',
      content: '夹逼准则和单调有界准则分别在什么情况下使用比较好？感觉容易混淆。',
      createTime: now - day,
      replied: false
    },
    {
      id: 'msg_5',
      studentName: '匿名同学',
      isAnonymous: true,
      type: 'homework',
      content: '作业第5题答案算出来是负数，感觉不太对，能确认一下吗？',
      createTime: now - day - 2 * 60 * 60 * 1000,
      replied: false
    }
  ]

  // 讨论区帖子
  var discussions = [
    {
      id: 'disc_1',
      author: '陈同学',
      avatar: '',
      category: 'question',
      title: '极限的ε-δ定义到底怎么理解？',
      content: '看了课本定义还是觉得抽象，有没有同学能用更通俗的语言解释一下？特别是ε和δ的关系。',
      createTime: now - 4 * 60 * 60 * 1000,
      likes: 15,
      liked: false,
      comments: [
        { author: '张同学', content: '我理解的是：ε是你要的精度，δ是自变量的范围，只要x足够接近（在δ范围内），函数值就一定在ε精度内。', createTime: now - 3 * 60 * 60 * 1000 },
        { author: '李同学', content: '可以想象成打靶，ε是靶心范围，δ是你站的位置范围。', createTime: now - 2 * 60 * 60 * 1000 }
      ],
      aiAnswer: null,
      aiAnswerTime: null
    },
    {
      id: 'disc_2',
      author: '王同学',
      avatar: '',
      category: 'exercise',
      title: '作业第3题求极限的方法分享',
      content: '第3题我用了等价无穷小替换和洛必达法则两种方法，得到一样的答案。分享一下我的解题过程，大家看看对不对。先用tanx~x替换，然后化简得到...',
      createTime: now - 7 * 60 * 60 * 1000,
      likes: 22,
      liked: false,
      comments: [
        { author: '赵同学', content: '方法很清晰！我也用这种方法做的。', createTime: now - 6 * 60 * 60 * 1000 }
      ],
      aiAnswer: '【考点分析】\n本题考查等价无穷小替换和洛必达法则的综合应用。\n\n【解题步骤】\n1. 识别极限类型为0/0型\n2. 优先使用等价无穷小替换简化\n3. 若替换后仍为0/0型，使用洛必达法则\n4. 化简得出最终结果\n\n【易错点】\n注意等价无穷小替换只能在乘除法中使用，加减法中不能直接替换。',
      aiAnswerTime: now - 6 * 60 * 60 * 1000
    },
    {
      id: 'disc_3',
      author: '刘同学',
      avatar: '',
      category: 'experience',
      title: '学习极限的一些心得体会',
      content: '学完第三章，我觉得最关键的是理解"无限趋近但不等于"这个概念。建议大家多做几道证明题，通过具体题目来理解抽象定义会比死记硬背效果好很多。',
      createTime: now - day,
      likes: 18,
      liked: false,
      comments: [],
      aiAnswer: null,
      aiAnswerTime: null
    },
    {
      id: 'disc_4',
      author: '孙同学',
      avatar: '',
      category: 'knowledge',
      title: '关于两个重要极限的推导疑问',
      content: '第二个重要极限 lim(1+1/n)^n = e，课本上用的是单调有界定理证明的。我想问的是，有没有更直观的理解方式？',
      createTime: now - day - 3 * 60 * 60 * 1000,
      likes: 9,
      liked: false,
      comments: [
        { author: '周同学', content: '可以从复利的角度理解，连续复利的极限就是e。', createTime: now - day - 2 * 60 * 60 * 1000 }
      ],
      aiAnswer: null,
      aiAnswerTime: null
    },
    {
      id: 'disc_5',
      author: '马同学',
      avatar: '',
      category: 'question',
      title: '连续函数一定可导吗？',
      content: '课本上说不一定，但我找不到反例。有没有同学能举一个连续但不可导的函数例子？',
      createTime: now - 2 * day,
      likes: 12,
      liked: false,
      comments: [
        { author: '吴同学', content: 'y=|x|在x=0处连续但不可导，最经典的例子。', createTime: now - 2 * day + 2 * 60 * 60 * 1000 },
        { author: '郑同学', content: '还有Weierstrass函数，处处连续处处不可导。', createTime: now - 2 * day + 3 * 60 * 60 * 1000 }
      ],
      aiAnswer: null,
      aiAnswerTime: null
    }
  ]

  // AI 周报
  var weeklyReport = {
    period: '2026年第8周（3月4日-3月10日）',
    sections: [
      {
        title: '本周教学重点',
        items: [
          '完成第三章极限与连续的全部内容教学',
          '重点讲解了ε-δ定义和两个重要极限',
          '布置课后习题1-10题，覆盖主要知识点'
        ]
      },
      {
        title: '作业汇总',
        items: [
          '第三章课后习题1-10题，已提交56人/共60人',
          '常见问题集中在第3题和第5题',
          '提交截止时间：3月15日23:59'
        ]
      },
      {
        title: '资料清单',
        items: [
          '第三章课件.pdf（已发布）',
          '等价无穷小替换表（已发布）',
          '第四章预习资料（已发布）'
        ]
      }
    ]
  }

  global.MockData = {
    course: course,
    config: config,
    dailyDiscussion: dailyDiscussion,
    publishes: publishes,
    messages: messages,
    discussions: discussions,
    weeklyReport: weeklyReport
  }
})(window)
