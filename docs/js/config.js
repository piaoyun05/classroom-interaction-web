// ============================================================
// 应用配置 —— 云端同步（Supabase）+ AI（DeepSeek）
//
// 【云端同步】已配置 Supabase（表结构与开放读写策略见 js/supabase_schema.sql）
//   publishable key 设计为可公开嵌入前端，安全由 RLS 策略保证。
//
// 【AI 大模型】DeepSeek（platform.deepseek.com，兼容 OpenAI 接口）
//   填入下方 DEEPSEEK_API_KEY 后，「AI 一键解答」「AI 全局问答」将调用
//   真实大模型；未填或调用失败时自动降级为内置模板。
//   注意：key 会随网页公开，建议注册后开启「账户余额/用量」提醒，
//   课堂演示用量极低；不用时可在 DeepSeek 平台重置 key。
// ============================================================
window.APP_CONFIG = {
  SUPABASE_URL: 'https://gqnnltplsiuebkdtwtuh.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_WxnadhdTGo0r9KL2TVbFqQ_kgNTCG8C',
  DEEPSEEK_API_KEY: ''
}
