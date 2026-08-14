// ============================================================
// 应用配置 —— 云端同步（Supabase）
// 使用步骤：
//   1. 在 https://supabase.com 免费创建一个项目
//   2. 进入 SQL Editor，粘贴并执行 js/supabase_schema.sql
//   3. 进入 Project Settings → API，复制 Project URL 和 anon public key
//   4. 填入下方对应位置并保存
//   5. 重新部署到 GitHub Pages 即可开启跨设备同步
//
// 注意：anon public key 设计为可公开嵌入前端，数据安全由数据库
//       RLS 策略保证（演示版为宽松策略，生产请加 teacher_token 限制）。
// ============================================================
window.APP_CONFIG = {
  SUPABASE_URL: '',        // 例如 https://xxxx.supabase.co
  SUPABASE_ANON_KEY: ''    // 例如 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
}
