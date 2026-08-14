// 网页版 AI 模拟引擎（由微信小程序版转换而来）
// 内部实现可整体替换为真实大模型 API 调用
(function (global) {
  'use strict'

  var Util = global.Util

  // ---------- 真实大模型（DeepSeek，兼容 OpenAI 接口） ----------
  // key 优先级：浏览器 localStorage（web_ai_key，设置页填写）> APP_CONFIG.DEEPSEEK_API_KEY
  // 未配置 key 或调用失败返回 null，由调用方降级为本地模板
  async function realAiCall(system, user) {
    var c = (typeof global.APP_CONFIG === 'object' && global.APP_CONFIG) ? global.APP_CONFIG : null
    var key = ''
    try {
      key = (typeof Util !== 'undefined' && Util.storage) ? (Util.storage.get('web_ai_key', '') || '') : ''
    } catch (e) { key = '' }
    if (!key && c && c.DEEPSEEK_API_KEY) key = c.DEEPSEEK_API_KEY
    if (!key) return null
    try {
      var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null
      var timer = null
      if (controller) timer = setTimeout(function () { controller.abort() }, 30000)
      var res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: system || '你是课堂互动助教，用简体中文、条理清晰、分步骤地解答学生的课程问题。' },
            { role: 'user', content: user || '' }
          ],
          max_tokens: 800,
          temperature: 0.7,
          stream: false
        }),
        signal: controller ? controller.signal : undefined
      })
      if (timer) clearTimeout(timer)
      if (!res.ok) return null
      var data = await res.json()
      var text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
      return (text && text.trim()) ? text.trim() : null
    } catch (e) {
      return null
    }
  }

  // AI 内容分类
  async function aiClassifyContent(content) {
    await Util.delay(600)
    var keywords = {
      notice: ['通知', '公告', '注意', '重要', '截止', '时间', '地点'],
      knowledge: ['知识点', '概念', '定理', '公式', '定义', '原理'],
      homework: ['作业', '练习', '题目', '提交', '截止', '完成'],
      keypoint: ['重点', '考点', '关键', '核心', '必考', '复习']
    }

    var bestMatch = 'notice'
    var maxScore = 0

    for (var cat in keywords) {
      if (keywords.hasOwnProperty(cat)) {
        var words = keywords[cat]
        var score = 0
        for (var i = 0; i < words.length; i++) {
          if (content.indexOf(words[i]) !== -1) score++
        }
        if (score > maxScore) {
          maxScore = score
          bestMatch = cat
        }
      }
    }

    return {
      category: bestMatch,
      confidence: 0.85 + Math.random() * 0.14
    }
  }

  // AI 内容摘要
  async function aiSummarize(content) {
    await Util.delay(500)
    var sentences = content.split(/[。！？\n]/).filter(function (s) {
      return s.trim().length > 5
    })
    if (sentences.length <= 1) return content.substring(0, 50) + (content.length > 50 ? '...' : '')

    var summary = sentences.slice(0, 2).join('。')
    if (summary.length > 80) summary = summary.substring(0, 80) + '...'
    return summary
  }

  // AI 解答生成（优先真实大模型，失败降级模板）
  async function aiAnswer(question, courseContext) {
    var courseName = (typeof courseContext === 'string' && courseContext) ? courseContext : '本课程'
    var real = await realAiCall(
      '你是《' + courseName + '》的课程助教。请针对学生的提问给出准确、条理清晰、分步骤的解答；如果题目信息不足，请说明需要补充什么条件。',
      '学生提问：' + question
    )
    if (real) {
      return {
        answer: real,
        relatedTopics: [],
        confidence: 1,
        fromAI: true
      }
    }

    await Util.delay(1200)

    var answers = {
      math: '【考点分析】\n本题考查的是核心知识点的综合运用，需要结合课堂讲授的基本概念进行推导。\n\n【解题步骤】\n1. 首先明确题目给出的已知条件和要求的目标\n2. 运用相关定理/公式建立等量关系\n3. 逐步化简求解\n4. 验证结果合理性\n\n【核心知识点】\n本题涉及的关键知识点为第三章第2节内容，建议复习课本P45-52页相关例题。\n\n【易错点提示】\n注意符号问题和边界条件的处理，这是同学们最容易出错的地方。',
      general: '【问题理解】\n根据您的提问，这是一个关于课程核心概念的问题。\n\n【解题思路】\n1. 回顾相关基础知识点的定义和性质\n2. 分析题目中的关键条件\n3. 选择合适的方法进行推导或计算\n4. 得出结论并验证\n\n【知识链接】\n本题与教师发布的"教学重点"板块第3条相关，建议结合课堂笔记第2章内容理解。\n\n【延伸建议】\n建议课后完成教材对应章节的练习题以巩固此知识点。'
    }

    var mathKeywords = ['计算', '求', '证明', '方程', '函数', '积分', '导数', '矩阵']
    var isMath = mathKeywords.some(function (k) {
      return question.indexOf(k) !== -1
    })

    return {
      answer: isMath ? answers.math : answers.general,
      relatedTopics: ['第三章 核心定理', '课后习题第5题', '课堂笔记P23'],
      confidence: 0.92
    }
  }

  // AI 留言问题汇总
  async function aiSummarizeMessages(messages) {
    await Util.delay(800)

    var typeCount = { knowledge: 0, suggest: 0, homework: 0, other: 0 }
    messages.forEach(function (m) {
      if (typeCount[m.type] !== undefined) typeCount[m.type]++
    })

    var total = messages.length
    var unsolved = messages.filter(function (m) {
      return !m.replied
    }).length

    // 基于真实留言内容做关键词统计，而非纯硬编码
    var issueKeywords = {
      knowledge: ['定义', '定理', '证明', '理解', '概念', '公式'],
      homework: ['作业', '第', '题', '算', '答案'],
      suggest: ['节奏', '讲', '建议', '课堂', '练习']
    }
    var counts = {}
    messages.forEach(function (m) {
      var c = m.content || ''
      for (var type in issueKeywords) {
        if (issueKeywords.hasOwnProperty(type)) {
          issueKeywords[type].forEach(function (kw) {
            if (c.indexOf(kw) !== -1) {
              var key = type + '_' + kw
              counts[key] = (counts[key] || 0) + 1
            }
          })
        }
      }
    })

    var topRaw = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] }).slice(0, 5)
    var topIssues = topRaw.map(function (key, i) {
      var parts = key.split('_')
      return {
        rank: i + 1,
        question: parts[1],
        count: counts[key],
        type: parts[0]
      }
    })
    if (!topIssues.length) {
      topIssues = [
        { rank: 1, question: '第三章定理的证明过程不太理解', count: 8, type: 'knowledge' },
        { rank: 2, question: '作业第3题的解题思路', count: 6, type: 'homework' },
        { rank: 3, question: '课堂节奏偏快，希望多讲例题', count: 4, type: 'suggest' }
      ]
    }

    return {
      total: total,
      unsolved: unsolved,
      typeDistribution: typeCount,
      topIssues: topIssues,
      summary: '本周共收到 ' + total + ' 条学生留言，其中知识点疑问 ' + typeCount.knowledge + ' 条、作业问题 ' + typeCount.homework + ' 条、教学建议 ' + typeCount.suggest + ' 条。高频问题集中在第三章定理理解和作业第3题。建议下次课堂重点回顾相关内容。'
    }
  }

  // AI 违规内容过滤（对应需求 2.2.3）
  async function aiFilterContent(content) {
    await Util.delay(400)
    var keywords = Util.VIOLATION_KEYWORDS
    var hits = keywords.filter(function (k) {
      return (content || '').indexOf(k) !== -1
    })
    return {
      pass: hits.length === 0,
      hits: hits,
      reason: hits.length ? '检测到敏感词：' + hits.join('、') + '，请修改后重试' : ''
    }
  }

  // AI 每日讨论总结（对应需求 2.2.3）
  async function aiDailyDiscussionSummary(discussions) {
    await Util.delay(800)
    var today = discussions.filter(function (d) {
      return Date.now() - d.createTime < 24 * 60 * 60 * 1000
    })
    var list = today.length ? today : discussions.slice(0, 4)
    var keyPoints = list.map(function (d) { return d.title }).slice(0, 3)
    var commonDoubts = list.filter(function (d) {
      return d.category === 'question' || d.category === 'exercise'
    }).map(function (d) { return d.title }).slice(0, 3)
    if (!commonDoubts.length) commonDoubts = ['极限的ε-δ定义', '两个重要极限', '等价无穷小替换']
    var qualityViews = list.filter(function (d) { return d.likes > 3 }).map(function (d) { return d.title }).slice(0, 3)
    if (!qualityViews.length) qualityViews = ['用打靶比喻理解ε-δ关系', '复利视角理解重要极限']

    return {
      period: Util.formatDate(new Date()),
      keyPoints: keyPoints,
      commonDoubts: commonDoubts,
      qualityViews: qualityViews
    }
  }

  // AI 讨论区整理（归档 + 折叠重复 + 置顶高频）
  async function aiOrganizeDiscussion(posts) {
    await Util.delay(700)

    var categories = {
      knowledge: [],
      exercise: [],
      experience: [],
      question: []
    }

    posts.forEach(function (p) {
      if (categories[p.category]) categories[p.category].push(p)
    })

    // 折叠重复内容：同分类且标题前6字相同视为重复
    var folded = 0
    var seen = {}
    posts.forEach(function (p) {
      var sig = (p.category || '') + '|' + (p.title || '').substring(0, 6)
      if (seen[sig]) {
        p.folded = true
        folded++
      } else {
        seen[sig] = true
      }
    })

    return {
      categories: categories,
      folded: folded,
      todayHighlight: '今日讨论热点集中在"极限的ε-δ定义"相关题目，同学们对定义的理解存在共性疑惑，建议教师课堂重点讲解。',
      qualityPosts: posts.filter(function (p) {
        return p.likes > 3
      }).slice(0, 3)
    }
  }

  // AI 周期总结（日报 + 周报，对应需求 2.2.1）
  async function aiWeeklySummary(publishes, messages, discussions, type) {
    await Util.delay(1000)
    var isDaily = type === 'daily'
    var period = isDaily ? '今日' : '本周'

    return {
      period: period,
      type: type || 'weekly',
      publishCount: publishes.length,
      messageCount: messages.length,
      discussionCount: discussions.length,
      highlights: [
        period + '教师发布 ' + publishes.length + ' 条课程内容，涵盖知识点资料和作业任务',
        '学生留言反馈 ' + messages.length + ' 条，高频问题集中在第三章',
        '讨论区活跃，共 ' + discussions.length + ' 条讨论帖，AI解答 ' + Math.floor(discussions.length * 0.6) + ' 次'
      ],
      suggestion: isDaily
        ? '今日教学进展顺利，建议明日课堂重点回顾第三章核心定理，并关注作业共性问题。'
        : '建议下周课堂重点回顾第三章核心定理，并增加相关例题讲解。同时关注作业第3题的共性问题。'
    }
  }

  // AI 未解决问题清单（对应需求 2.2.2）
  async function aiUnsolvedList(messages) {
    await Util.delay(500)
    var unsolved = messages.filter(function (m) { return !m.replied })
    return {
      total: unsolved.length,
      items: unsolved.map(function (m, i) {
        return { rank: i + 1, type: m.type, question: m.content, time: Util.timeAgo(m.createTime) }
      })
    }
  }

  // AI 个性化学习梳理（对应需求 2.4）
  async function aiPersonalStudy(userName, messages, discussions) {
    await Util.delay(900)
    var myMessages = messages.filter(function (m) {
      return !m.isAnonymous && m.studentName === userName
    })
    var myPosts = discussions.filter(function (d) { return d.author === userName })

    var weakPoints = ['极限的ε-δ定义', '两个重要极限的应用', '等价无穷小替换']
    var suggestions = [
      '建议重点复习极限的ε-δ定义及证明方法，可参考教师发布的《教学重点梳理》',
      '完成第三章课后习题1-5题，重点关注等价无穷小替换的适用条件',
      '课前预习第四章内容，提前理解导数定义'
    ]
    var myQuestions = myMessages.map(function (m) { return m.content }).slice(0, 3)
    if (myQuestions.length) {
      weakPoints[0] = '你对「' + myQuestions[0].substring(0, 18) + '」相关知识点掌握不够'
    }

    return {
      userName: userName,
      myMessageCount: myMessages.length,
      myPostCount: myPosts.length,
      weakPoints: weakPoints,
      suggestions: suggestions,
      studyPlan: '每日建议学习 60 分钟：概念复习 20 分钟 + 例题练习 30 分钟 + 错题回顾 10 分钟'
    }
  }

  // AI 一键总结中心（对应需求 2.4 内容智能总结）
  async function aiQuickSummary(type, publishes, messages, discussions) {
    await Util.delay(800)
    var result = { type: type }
    if (type === 'today') {
      result.title = '今日课堂重点'
      result.items = [
        '今日教学主题：第三章「极限与连续」核心内容',
        '重点讲解：极限的ε-δ定义与两个重要极限',
        '布置作业：课后习题1-10题，截止本周五',
        '今日讨论热点：' + discussions[0].title
      ]
      result.suggestion = '建议今日课后复习ε-δ定义，并完成前3题作业巩固。'
    } else if (type === 'week') {
      result.title = '本周学习内容'
      result.items = [
        '发布内容 ' + publishes.length + ' 条：含教学重点、作业、通知',
        '收到留言 ' + messages.length + ' 条，已回复 ' + messages.filter(function (m) { return m.replied }).length + ' 条',
        '讨论区共 ' + discussions.length + ' 个帖子，AI已解答 ' + discussions.filter(function (d) { return d.aiAnswer }).length + ' 个'
      ]
      result.suggestion = '本周知识密度较高，建议周末系统梳理第三章知识框架。'
    } else if (type === 'unsolved') {
      var unsolved = await aiUnsolvedList(messages)
      result.title = '未解决问题清单'
      result.items = unsolved.items.map(function (i) {
        return i.rank + '. ' + i.question + '（' + i.time + '）'
      })
      if (!unsolved.items.length) result.items = ['暂无未解决问题 🎉']
      result.suggestion = '建议尽快回复学生留言，提升学习体验。'
    } else if (type === 'errors') {
      result.title = '高频错题知识点'
      result.items = [
        '1. 极限的ε-δ定义证明（高频出错）',
        '2. 等价无穷小替换的加减法误用（高频出错）',
        '3. 夹逼准则与单调有界准则的选择'
      ]
      result.suggestion = '建议针对以上知识点增加专题讲解与专项练习。'
    }
    return result
  }

  // AI 全局问答（优先真实大模型，失败降级模板）
  async function aiGlobalQA(question, courseData) {
    var course = courseData.course || {}
    var courseName = course.name || '本课程'

    var real = await realAiCall(
      '你是《' + courseName + '》的课程助教，请结合课程知识点，用简体中文准确、清晰地回答学生的提问。',
      '学生提问：' + (question || '')
    )
    if (real) {
      return {
        answer: real,
        courseName: courseName,
        sources: [],
        relatedQuestions: [],
        fromAI: true
      }
    }

    await Util.delay(1000)

    var q = question || ''
    var answer = ''
    if (q.indexOf('ε-δ') !== -1 || q.indexOf('极限') !== -1 && q.indexOf('定义') !== -1) {
      answer = '关于极限的ε-δ定义，可以从以下角度理解：\n\n1. 直观含义：当自变量x无限接近x₀时，函数值f(x)无限接近某个常数L\n2. 严格定义：对任意给定的ε>0，总存在δ>0，使得当0<|x-x₀|<δ时，恒有|f(x)-L|<ε\n3. 理解技巧：ε代表允许的误差范围，δ代表自变量的活动范围——"对任意误差，都能找到合适的范围"'
    } else if (q.indexOf('连续') !== -1) {
      answer = '判断函数连续性：\n\n1. 函数在x₀处有定义\n2. 极限lim(x→x₀) f(x)存在\n3. 极限值等于函数值f(x₀)\n\n三个条件缺一不可。可导必连续，但连续不一定可导（如y=|x|在x=0处）。'
    } else if (q.indexOf('导数') !== -1 || q.indexOf('微分') !== -1) {
      answer = '导数的本质是函数在该点的瞬时变化率：\n\nf\'(x₀) = lim(Δx→0) [f(x₀+Δx)-f(x₀)]/Δx\n\n几何意义是曲线在该点的切线斜率。微分是函数增量的线性主部，dy = f\'(x)dx。'
    } else {
      answer = '根据本课程的专属知识库，为您解答如下：\n\n结合' + courseName + '的课程资料与同学们的讨论记录，这个问题可以从以下角度理解：\n\n1. 基础概念层面：回顾课本对应章节的定义和性质\n2. 实际应用层面：参考教师发布的知识点资料中的例题\n3. 常见误区：注意同学们在讨论区提到的易错点\n\n建议结合课堂笔记和教师发布的教学重点内容进行综合理解。'
    }

    return {
      answer: answer,
      courseName: courseName,
      sources: [
        { type: '教师发布', title: courseName + ' 教学重点梳理' },
        { type: '讨论区', title: '关于极限定义的讨论帖' },
        { type: 'AI答疑', title: '作业第3题AI解答' }
      ],
      relatedQuestions: [
        '极限的ε-δ定义如何理解？',
        '如何判断函数的连续性？',
        '导数和微分的关系是什么？'
      ]
    }
  }

  global.AIEngine = {
    aiClassifyContent: aiClassifyContent,
    aiSummarize: aiSummarize,
    aiAnswer: aiAnswer,
    aiSummarizeMessages: aiSummarizeMessages,
    aiOrganizeDiscussion: aiOrganizeDiscussion,
    aiWeeklySummary: aiWeeklySummary,
    aiGlobalQA: aiGlobalQA,
    aiFilterContent: aiFilterContent,
    aiDailyDiscussionSummary: aiDailyDiscussionSummary,
    aiUnsolvedList: aiUnsolvedList,
    aiPersonalStudy: aiPersonalStudy,
    aiQuickSummary: aiQuickSummary
  }
})(window)
