# AI赋能课堂互动平台

基于《AI赋能课堂互动微信小程序方案设计》实现的互动学习平台，包含 **微信小程序版** 和 **网页版** 两套实现。

## 目录结构

```
classroom-interaction-copy/
├── web/                      # 网页版（静态页面，可部署到 GitHub Pages）
│   ├── index.html            # 入口页面
│   ├── css/style.css         # 样式
│   └── js/
│       ├── util.js           # 工具函数
│       ├── data.js           # Mock 数据
│       ├── aiEngine.js       # AI 模拟引擎（可替换为真实大模型）
│       └── app.js            # 路由 + 页面渲染 + 交互
├── pages/                    # 微信小程序页面（保留原版）
├── utils/                    # 微信小程序工具
├── mock/                     # 微信小程序 Mock 数据
└── app.js / app.json ...     # 微信小程序配置
```

## 网页版功能

- **首页**：三大板块入口（教师信息发布区 / 学生留言区 / 学生讨论区）、最新动态、AI 周报、AI 问答入口
- **教师信息发布区**：AI 自动分类、发布新内容（AI 自动生成摘要）
- **学生留言区**：匿名/实名留言、AI 问题汇总
- **学生讨论区**：发帖、评论、点赞、分类筛选、**AI 一键解答**
- **AI 智能问答**：全局问答助手、快捷问题、聊天历史
- **个人中心**：数据统计、菜单导航

数据通过 `localStorage` 持久化，右上角「个人中心 → 重置演示数据」可恢复初始 Mock 数据。

## 本地预览

直接双击 `web/index.html` 即可打开；或启动本地服务器：

```bash
cd web
python -m http.server 8080
# 浏览器访问 http://localhost:8080
```

## 部署到 GitHub Pages

1. 在 GitHub 新建仓库（建议仓库名如 `classroom-interaction`）
2. 将本项目推送至仓库，或仅推送 `web/` 目录内容到仓库根目录
3. 仓库 Settings → Pages → Source 选择 `main` 分支的根目录
4. 等待 1-2 分钟即可通过 `https://<用户名>.github.io/<仓库名>/` 访问

> 注意：网页版全部为静态资源，使用相对路径引用，可直接部署，无需构建。
> 依赖的 `gh` 或 git 凭据以实际环境为准；推送到 GitHub 需先配置好 Git 身份与凭据。
