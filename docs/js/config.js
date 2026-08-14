// ============================================================
// 应用配置 —— 云端同步（腾讯云开发 CloudBase）
// 已配置 CloudBase 环境（匿名登录 + 数据库公开读写）。
// 数据存储在集合 courses 中，每个课程一条文档。
//
// 说明：CLOUDBASE_ENV 仅是环境标识，不是密钥，可公开嵌入网页。
// ============================================================
window.APP_CONFIG = {
  CLOUDBASE_ENV: 'aiclass-d7ghnvfp4262bca32',
  // 环境所在区域（上海 ap-shanghai / 广州 ap-guangzhou / 香港 ap-hongkong），
  // 默认上海；若你的环境不在上海，请填入对应区域，否则 SDK 会初始化失败。
  CLOUDBASE_REGION: ''
}
