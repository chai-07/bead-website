# bead-website

🔗 在线访问：https://chai-07.github.io/bead-website/
免费在线拼豆图纸生成网站

## ✨ 功能清单

- ✅ 完全免费在线使用
- ✅ 自定义图纸尺寸
- ✅ 最大颜色数量限制
- ✅ 图片预处理（增强 / 量化 / 裁剪）
- ✅ 画布手动修图（画笔 / 对称 / 挂件模板 / 取色 / 魔棒）
- ✅ MARD 拼豆色号自动标注
- ✅ 工艺评审报告（风险检测 + 整改）
- ✅ 草稿暂存 / 读取 / 导入导出
- ✅ 效果图 + 打印图纸 + CSV 耗材清单 + 一键打包

适合拼豆爱好者一键将图片转为可制作的拼豆图纸。如果你觉得项目好用，欢迎点亮 ⭐ Star！

---

## 📁 项目结构

纯前端、无构建步骤、无外部依赖。访问入口是 **`index.html`（版本选择页）**，选完电脑版/手机版后跳转 **`app.html?mode=desktop|mobile`**（共用应用页）；移动端样式与选择页样式各自独立成文件。

```
bead-website/
├── index.html          # 版本选择独立页（电脑版 / 手机版卡片 + 记住选择 + 自动跳转）
├── app.html            # 共用应用页（完整拼豆程序，无选择浮层；按 ?mode 决定布局）
├── css/
│   ├── style.css       # 桌面端基础样式 + force-desktop 强制桌面布局
│   ├── mobile.css      # 手机版排版（@media + body.layout-mobile 两套规则，仅 app.html 加载）
│   └── choose.css      # 版本选择页专用样式（仅 index.html 加载）
└── js/
    ├── data.js         # 配色数据：MARD / Perler / Hama / Artkal 四套色板 + 品牌映射（纯数据）
    ├── color.js        # 取色：笔刷选择 / 品牌色板切换 / 颜色数学（RGB↔Lab 距离等）
    ├── render.js       # 画布渲染 + 工具函数：图像处理、绘制、缩放、画笔、裁剪、原图浮窗、
    │                   #   杂点清理、挂件模板、高亮叠加、撤销/重做、参数绑定与事件监听
    ├── draft.js        # 草稿系统：暂存 / 读取 / 删除 / 导入导出（含 localStorage 兜底）
    ├── review.js       # 工艺评审：像素扫描分析引擎 + 多版面报告 + 交互式整改
    ├── export.js       # 导出：彩色 PDF / 黑白轮廓 PDF / CSV 耗材清单 / 一键打包
    └── ui.js           # 抽屉交互 / 移动端适配 / 按 ?mode 固定布局 / 增强组按钮 / 切换版本跳回选择页
```

## 📜 脚本加载顺序

`app.html` 用经典 `<script>` 依次引入（共享全局作用域，**不要改成 `type="module"`**，否则页面内联 `onclick="..."` 会找不到函数）：

```
data.js → color.js → render.js → draft.js → review.js → export.js → ui.js
```

- `data.js` 最先，提供全局色板常量；
- `color.js` 在 `render.js` 之前，保证 `initMardFullGrid()` 调用时 `selectBrush` 已定义；
- `ui.js` 最后，启动时会读取 `?mode` 固定布局，运行时 `openSheet` / `buildReview` / `fitZoom` 均已就绪。

`index.html`（选择页）不加载上述业务脚本，仅用内联脚本处理选择与 localStorage 记忆。

## 🚀 本地预览

启动静态服务器后，先打开 `index.html` 选择版本（或直接访问 `app.html?mode=desktop` / `app.html?mode=mobile`）：

```bash
python3 -m http.server 8080   # 然后打开 http://localhost:8080  （默认进入选择页）
```

> 部分能力（选择文件夹保存、本地存储、选择页"记住我的选择"）依赖浏览器环境；沙盒受限时会自动降级为内存存储并提示，不影响核心生成。

## 🛠 二次开发约定

- **新增全局状态变量**：放在 `render.js` 顶部全局 `var` 声明区或对应模块顶部。
- **新增函数**：按职责放入对应文件；保持上面的加载顺序，跨文件互相调用即可（函数均经事件在运行时触发，不依赖文件间声明顺序）。
- **改样式**：
  - 桌面端 → 改 `css/style.css`（桌面基础 + `body.force-desktop` 强制桌面块）；
  - 手机端 → 改 `css/mobile.css`（含 `body:not(.force-desktop)` 的 `@media` 块与 `body.layout-mobile` 块，两套需保持一致）；
  - 选择页 → 改 `css/choose.css`。
- **配色数据**：只在 `data.js` 维护四套色板与 `BRAND_PALETTES`。
- **新增版本/布局**：移动端与桌面端共用 `app.html` 一套 DOM，仅通过 `?mode` 与 CSS 区分，不建议再拆成两份 HTML。
