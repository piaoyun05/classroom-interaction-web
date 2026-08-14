// ============================================================
// 应用配置 —— 云端同步（Supabase）+ AI（DeepSeek）
//
// 【云端同步】已配置 Supabase（表结构与开放读写策略见 js/supabase_schema.sql）
//   publishable key 设计为可公开嵌入前端，安全由 RLS 策略保证。
//
// 【AI 大模型】DeepSeek（platform.deepseek.com，兼容 OpenAI 接口）
//   key 不在代码里写死，而是在教师「基础配置」页的「AI 大模型配置」
//   输入框填写，仅保存在该浏览器的 localStorage（web_ai_key）。
//   下方 DEEPSEEK_API_KEY 留空即可；仅当需要把 key 共享给所有设备
//   （公开嵌入）时才在此填入（不建议）。
//   配置后「AI 一键解答」「AI 全局问答」调用真实大模型；
//   未配置或调用失败时自动降级为内置模板。
// ============================================================
window.APP_CONFIG = {
  SUPABASE_URL: 'https://gqnnltplsiuebkdtwtuh.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_WxnadhdTGo0r9KL2TVbFqQ_kgNTCG8C',
  DEEPSEEK_API_KEY: ''
}
