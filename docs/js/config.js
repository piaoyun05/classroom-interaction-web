// ============================================================
// 应用配置 —— 云端同步（GitHub Gist）
// 使用步骤：
//   1. 登录 GitHub，新建一个 Gist（https://gist.github.com）
//      - 文件名填 data.json，内容填 {} 即可
//      - 勾选「Create a public gist」（公开，学生才能免 token 读取）
//   2. 创建后，从浏览器地址栏复制该 Gist 的 ID
//      （地址形如 https://gist.github.com/<用户名>/<这里就是ID>）
//   3. 生成一个「细粒度 Personal Access Token」：
//      GitHub → Settings → Developer settings → Personal access tokens
//      → Fine-grained tokens → 仅授权本仓库(classroom-interaction-web)，
//        权限只开 Contents: Read and write
//   4. 把下面 GIST_ID 与 GITHUB_TOKEN 填上，保存
//   5. 重新部署到 GitHub Pages，即可开启跨设备同步
//
// 安全说明：此 token 会随前端公开，必须为「细粒度 + 仅本仓库 + 仅 Contents」
//          权限，即使泄露也只影响本课程数据；建议演示后及时吊销。
// ============================================================
window.APP_CONFIG = {
  GIST_ID: '',          // 例如 a1b2c3d4e5f6...（公开 gist 的 ID）
  GITHUB_TOKEN: ''      // 细粒度 PAT，仅授权本仓库 Contents 读写
}
