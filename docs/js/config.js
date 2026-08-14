// ============================================================
// 应用配置 —— 云端同步（Supabase，已配置）
// 数据存储在 courses/publishes/messages/discussions/course_config
// 五张表，表结构与开放读写策略见 js/supabase_schema.sql。
// publishable key 设计为可公开嵌入前端，安全由 RLS 策略保证。
// ============================================================
window.APP_CONFIG = {
  SUPABASE_URL: 'https://gqnnltplsiuebkdtwtuh.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_WxnadhdTGo0r9KL2TVbFqQ_kgNTCG8C'
}
