// ============================================================
// 应用配置 —— 云端同步（Supabase）
// 当前为「纯本地演示」模式（下方凭据为空，零配置即可使用）：
// 学生扫码后看到课程示例，发帖/留言仅保存在各自设备的浏览器中。
//
// 如需开启跨设备同步（老师/学生实时互通），步骤：
//   1. 打开 supabase.com/dashboard，用 GitHub 账号登录（你已有）
//   2. New project，区域选 Singapore（中国访问最佳），免费版
//   3. SQL Editor 粘贴执行 js/supabase_schema.sql（建表+开放读写权限）
//   4. Settings → API 复制 Project URL 和 anon public key，填入下方
//   5. 重新部署到 GitHub Pages 即生效
//
// 说明：anon key 设计为可公开嵌入前端，安全由 RLS 策略保证。
// ============================================================
window.APP_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: ''
}
