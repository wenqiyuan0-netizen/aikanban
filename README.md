# AI Kanban Roadmap · AI 看板计划

> 🇨🇳 建议：README 可以采用「双语结构」：先给出中文概要，再保留英文版；或者维护 `README.md`（中文） + `README.en.md`（英文）。本仓库先在同一份文档中提供双语说明，后续可按计划拆分成两个文件。

This repository hosts an experimental AI-assisted Kanban board. The current priority is to keep the React entry point small while we iteratively add localisation, prompt orchestration, and richer analytics.

## Current refactor status · 当前重构进度

- ✅ `App.js` 已拆分为 orchestrator（状态协调者），核心逻辑迁移至 `src/app/**` 目录。
- ✅ 默认数据、度量、AI 调用等模块完成初次抽离，可独立演进。
- 🔄 正在规划本地化、多语言切换、UI 美化等下一阶段工作。

## Upcoming milestones · 下一阶段计划

1. **Documentation localisation 文档本地化**
   - 在 `README.md` 中保持核心中文内容，补充「如何维护英文版」指南。
   - 产出 `README.en.md`（英文）或在 GitHub Wiki 中维护英文文档，预计 0.5 天完成。
2. **Prompt & API configuration 界面化 Prompt / API 配置**
   - 将当前写死在配置文件的 API Key / Prompt 迁移到「设置面板」，通过点击操作与表单填写。
   - 设计草图 + 表单组件开发 + 本地存储持久化，预计 1.5~2 天。
3. **In-app language switch 应用内多语言切换**
   - 采用 i18next + JSON 词条文件，将 UI 文案抽取到 `src/i18n/**`。
   - 入口 App 保留语言状态，提供顶部语言切换按钮，初期支持「中文 / English」。
   - 基础搭建与组件接入预计 2~3 天（含文案梳理与测试）。
4. **Kanban intelligence upgrades 看板智能升级**
   - 细化 Prompt：按任务等级（Epic/Story/Task）注入不同上下文，支持依赖分析。
   - 增加任务依赖关系的输入与可视化模块；提供阻塞提醒。
   - 阶段性交付，可拆成多次迭代，每次 2~3 天。
5. **UI & visual polish 界面美化**
   - 引入 Tailwind Design Token 或 CSS 变量统一色板。
   - 制作全局样式指南，优化卡片间距、阴影、交互动画。
   - 借助 Figma 打磨设计稿，再实施组件层面的调整，完整周期约 3~4 天。

## Recommended workflow 建议工作流

1. **Confirm localisation scope 明确本地化范围**：先列出所有需要翻译的界面 & 文案，生成词条清单。
2. **Set up i18n tooling 配置多语言工具链**：引入 `i18next`、`react-i18next`，创建语言资源文件。
3. **Refactor prompts & API UI 重构 Prompt / API 界面**：新建设置对话框或独立页面，支持表单输入、验证、预览。
4. **Iterate UI design 迭代界面设计**：先确定设计基调（颜色、排版），再逐步替换现有组件样式。
5. **Track progress with issues 使用 Issue 跟踪进度**：按里程碑拆分 Issue，确保计划落地。

## FAQ

### README 的中文写法建议？
采用「中文主文档 + 英文附录」或「双 README 文件」的结构。保持章节对应（Overview、Setup、Development、Roadmap），便于中英文同步维护。后续计划在仓库中补充 `README.en.md` 模板。

### 能否把 API Key / Prompt 设置做成「点击配置」？
可以，通过设置面板（Modal / Drawer）提供表单输入。提交后存入 `localStorage`，再由 `App.js` 读取。开发周期约 1.5~2 天，包括表单、校验、持久化、以及与现有 `aiService` 的对接。

### 多语言切换如何实现？需要多久？
首选 `i18next`，将界面文案抽离成语言包。顶层用 React Context 或 `useTranslation` hook 管理当前语言，并在 UI 中提供切换按钮。初次落地（含双语资源文件）约 2~3 天。

### 如何进一步美化 UI？
- 统一色彩与字号：建立设计令牌或 Tailwind 配置。
- 调整布局：优化卡片间距、列宽自适应、拖拽动效。
- 增添数据可视化：升级图表主题，增加提示信息、动画。
- 借助设计工具（Figma/Sketch）先出高保真稿，再根据稿件迭代 React 组件。

欢迎根据以上计划逐步推进，如需新增模块或调优方案，可在 Issue / PR 中继续讨论。
