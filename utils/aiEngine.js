// AI 模拟引擎 - 模拟AI智能整理、分类、答疑功能

const { delay } = require('./util')

// AI 内容分类
async function aiClassifyContent(content) {
  await delay(600)
  const keywords = {
    notice: ['通知', '公告', '注意', '重要', '截止', '时间', '地点'],
    knowledge: ['知识点', '概念', '定理', '公式', '定义', '原理'],
    homework: ['作业', '练习', '题目', '提交', '截止', '完成'],
    keypoint: ['重点', '考点', '关键', '核心', '必考', '复习']
  }

  let bestMatch = 'notice'
  let maxScore = 0

  for (const [cat, words] of Object.entries(keywords)) {
    let score = 0
    for (const w of words) {
      if (content.includes(w)) score++
    }
    if (score > maxScore) {
      maxScore = score
      bestMatch = cat
    }
  }

  return {
    category: bestMatch,
    confidence: 0.85 + Math.random() * 0.14
  }
}

// AI 内容摘要
async function aiSummarize(content) {
  await delay(500)
  // 模拟摘要生成
  const sentences = content.split(/[。！？\n]/).filter(s => s.trim().length > 5)
  if (sentences.length <= 1) return content.substring(0, 50) + (content.length > 50 ? '...' : '')

  // 取前两句作为摘要
  let summary = sentences.slice(0, 2).join('。')
  if (summary.length > 80) summary = summary.substring(0, 80) + '...'
  return summary
}

// AI 解答生成
async function aiAnswer(question, courseContext) {
  await delay(1200)

  // 模拟AI解答
  const answers = {
    math: `【考点分析】\n本题考查的是核心知识点的综合运用，需要结合课堂讲授的基本概念进行推导。\n\n【解题步骤】\n1. 首先明确题目给出的已知条件和要求的目标\n2. 运用相关定理/公式建立等量关系\n3. 逐步化简求解\n4. 验证结果合理性\n\n【核心知识点】\n本题涉及的关键知识点为第三章第2节内容，建议复习课本P45-52页相关例题。\n\n【易错点提示】\n注意符号问题和边界条件的处理，这是同学们最容易出错的地方。`,

    general: `【问题理解】\n根据您的提问，这是一个关于课程核心概念的问题。\n\n【解题思路】\n1. 回顾相关基础知识点的定义和性质\n2. 分析题目中的关键条件\n3. 选择合适的方法进行推导或计算\n4. 得出结论并验证\n\n【知识链接】\n本题与教师发布的"教学重点"板块第3条相关，建议结合课堂笔记第2章内容理解。\n\n【延伸建议】\n建议课后完成教材对应章节的练习题以巩固此知识点。`
  }

  // 简单判断题目类型
  const mathKeywords = ['计算', '求', '证明', '方程', '函数', '积分', '导数', '矩阵']
  const isMath = mathKeywords.some(k => question.includes(k))

  return {
    answer: isMath ? answers.math : answers.general,
    relatedTopics: ['第三章 核心定理', '课后习题第5题', '课堂笔记P23'],
    confidence: 0.92
  }
}

// AI 留言问题汇总
async function aiSummarizeMessages(messages) {
  await delay(800)

  const typeCount = { knowledge: 0, suggest: 0, homework: 0, other: 0 }
  messages.forEach(m => {
    if (typeCount[m.type] !== undefined) typeCount[m.type]++
  })

  const total = messages.length
  const unsolved = messages.filter(m => !m.replied).length

  // 模拟高频问题
  const topIssues = [
    { rank: 1, question: '第三章定理的证明过程不太理解', count: 8, type: 'knowledge' },
    { rank: 2, question: '作业第3题的解题思路', count: 6, type: 'homework' },
    { rank: 3, question: '课堂节奏偏快，希望多讲例题', count: 4, type: 'suggest' }
  ]

  return {
    total,
    unsolved,
    typeDistribution: typeCount,
    topIssues,
    summary: `本周共收到 ${total} 条学生留言，其中知识点疑问 ${typeCount.knowledge} 条、作业问题 ${typeCount.homework} 条、教学建议 ${typeCount.suggest} 条。高频问题集中在第三章定理理解和作业第3题。建议下次课堂重点回顾相关内容。`
  }
}

// AI 讨论区整理
async function aiOrganizeDiscussion(posts) {
  await delay(700)

  const categories = {
    knowledge: [],
    exercise: [],
    experience: [],
    question: []
  }

  posts.forEach(p => {
    if (categories[p.category]) categories[p.category].push(p)
  })

  return {
    categories,
    todayHighlight: '今日讨论热点集中在"极限的ε-δ定义"相关题目，同学们对定义的理解存在共性疑惑，建议教师课堂重点讲解。',
    qualityPosts: posts.filter(p => p.likes > 3).slice(0, 3)
  }
}

// AI 周期总结
async function aiWeeklySummary(publishes, messages, discussions) {
  await delay(1000)

  return {
    period: '本周',
    publishCount: publishes.length,
    messageCount: messages.length,
    discussionCount: discussions.length,
    highlights: [
      `本周教师发布 ${publishes.length} 条课程内容，涵盖知识点资料和作业任务`,
      `学生留言反馈 ${messages.length} 条，高频问题集中在第三章`,
      `讨论区活跃，共 ${discussions.length} 条讨论帖，AI解答 ${Math.floor(discussions.length * 0.6)} 次`
    ],
    suggestion: '建议下周课堂重点回顾第三章核心定理，并增加相关例题讲解。同时关注作业第3题的共性问题。'
  }
}

// AI 全局问答
async function aiGlobalQA(question, courseData) {
  await delay(1000)

  return {
    answer: `根据本课程的知识库内容，为您解答如下：\n\n${question}是一个很好的问题。结合教师发布的课程资料和同学们的讨论记录，这个问题可以从以下几个角度理解：\n\n1. 基础概念层面：回顾课本对应章节的定义和性质\n2. 实际应用层面：参考教师发布的知识点资料中的例题\n3. 常见误区：注意同学们在讨论区提到的易错点\n\n建议结合课堂笔记第2章和教师发布的"教学重点"内容进行综合理解。`,
    sources: [
      { type: '教师发布', title: '第三章 教学重点梳理' },
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

module.exports = {
  aiClassifyContent,
  aiSummarize,
  aiAnswer,
  aiSummarizeMessages,
  aiOrganizeDiscussion,
  aiWeeklySummary,
  aiGlobalQA
}
