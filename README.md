# AI Kanban System Overview · AI 看板系统总览

> 🇨🇳 说明：本 README 仍采用中英文对照形式，便于后续拆分为 `README.md`（中文）与 `README.en.md`（英文）。

## What this project is building · 项目愿景

This repository contains an AI-assisted project management workspace that combines a Kanban board with multiple conversational agents. The goal is to orchestrate a lightweight classifier agent, a world-information ("world info") planning agent, and a Kanban execution agent so users can switch projects, confirm AI actions, and keep structured histories without losing context.

本仓库正在打造一个多 Agent 协同的 AI 看板工作台：通过轻量级判定 Agent、世界信息配置 Agent、看板执行 Agent 的协作，让用户能够在不同项目之间切换、确认 AI 操作，并保持结构化的数据历史。

## Feature completion snapshot · 当前完成情况

| Area | Status | Notes |
| ---- | ------ | ----- |
| React entry point refactor | ✅ | `App.js` 已拆分为 orchestrator + 模块化子组件。|
| Workspace persistence | ✅ | 提供多项目数据结构骨架，支持本地存储读写与快照。|
| Project reset scaffolding | ✅ | 引入 `projectFlow` 状态机、确认弹窗钩子与世界信息界面切换逻辑。|
| Lightweight classifier gating | 🟡 | 现在在看板输入前触发判定并记录 `intentLog`，旧项目分支仍待对接 UI。|
| Module documentation | ✅ | 核心模块提供双语注释，说明职责与未完事项。|
| Multi-language toggle | ⏳ | UI 预留多语言切换位，尚未接入 `i18n` 工具链。|
| Agent prompt library | ⏳ | 初步列出 prompt 层级，仍需实现正式模板与版本管理。|
| Old project revival UX | ⏳ | 数据结构已预留 `archivedProjects`，界面切换与动画待完成。|
| World-info → Kanban hand-off | ✅ | 完成世界信息配置后，系统会自动触发看板欢迎 prompt，并仅在新增任务时引导补写世界信息。|

## Known bugs & gaps · 已知问题与缺口

- 🔧 **Chat panels still share layout plumbing**：看板与世界信息的聊天在 UI 层仍存在耦合，需要根据项目 ID 完整隔离滚动、历史渲染与输入框状态。
- ⚙️ **Classifier coverage gaps**：轻量判定 Agent 已接入看板对话，但旧项目视图、管理员命令等路径仍未真正落地。
- 🔧 **Colour harmonisation**：AI 返回的颜色尚未映射到“中国传统色色系”方案，需在本地增加色板校正逻辑。
- 🔧 **User preference model empty**：`userPreferences` 占位字段尚未填充，影响个性化 prompt。
- 🔧 **Archived project UX**：旧项目意图目前仅弹出信息提示，目录/动画/数据回填界面尚待实现。
- ⚙️ **Classifier false positives**：轻量 Agent 仍可能把小规模任务更新判断为新项目指令，后续需通过提示词与示例继续校准。
- 🚨 **Retroactive history conflicts（历史事件冲突风险）**：当看板 Agent 通过 `event_add` 或修改任务时间戳来“补写过去”时，存在与既有事件顺序矛盾的风险（例如在任务标记为 `Done` 之后，又插入该任务的“开始”事件）。目前已通过更严格的 Prompt 约束其在修改历史前必须验证时间线一致性，如需真正重写历史必须向用户确认；后续仍需加入自动回归测试与冲突检测。 

## Multi-agent focus · 多 Agent 协同重点

### 1. Roles & prompts · 角色与 Prompt 设计

| Agent | Responsibility | Prompt strategy |
| ----- | -------------- | --------------- |
| Lightweight classifier 轻量判定 Agent | 根据用户输入判定属于「新项目」「当前项目」「旧项目」（可扩展到“文字游戏”等模式）。 | 返回结构化 JSON：`{"intent":"NEW_PROJECT"|"CURRENT_PROJECT"|"ARCHIVED_PROJECT", "meta":{...}}`。 |
| World info planner 世界信息 Agent | 仅在新项目/重启项目时接管，引导头脑风暴、解析上传文件、补齐结构化项目信息。 | Prompt 强调无旧上下文、需生成完整世界信息摘要与确认提要。 |
| Kanban executor 看板 Agent | 管理日常任务、WIP、燃尽图、虚拟时间调整，并处理用户对旧项目的唤醒请求。 | Prompt 包含当前项目世界信息、近 5 条聊天、看板操控规则、用户习惯，要求输出人类回复与系统指令两部分。 |
| Internal brokers 内部协调 Agent | `kanbanOrchestrator`, `worldInfoBroker` 等内部脚本，负责验证 JSON、决定 UI 弹窗与数据迁移。 | 使用指令式模板，只输出机器可解析字段，不面向用户。 |

### 2. State transitions · 状态切换

```mermaid
stateDiagram-v2
    [*] --> LOGIN
    LOGIN --> DASHBOARD: 用户登录成功 / 语言切换
    state DASHBOARD {
        [*] --> CLASSIFY
        CLASSIFY --> WORLD_INFO: intent == NEW_PROJECT
        CLASSIFY --> KANBAN: intent == CURRENT_PROJECT
        CLASSIFY --> ARCHIVE_MENU: intent == ARCHIVED_PROJECT (目录)
        CLASSIFY --> ARCHIVE_DETAIL: intent == ARCHIVED_PROJECT (指定项目)
        WORLD_INFO --> CONFIRM_WORLD: agent 输出完成 + 用户确认
        CONFIRM_WORLD --> KANBAN: 初始化新项目
        ARCHIVE_MENU --> ARCHIVE_DETAIL: 用户选择具体旧项目
        ARCHIVE_DETAIL --> KANBAN: 激活旧项目 / 合并到当前
        KANBAN --> CLASSIFY: 用户下达新的高阶命令（废弃、切换等）
    }
    KANBAN --> [*]: 用户登出
```

### 3. Workspace layout · 数据结构

```mermaid
flowchart TD
    subgraph LocalStorage
        A[currentProjectId]
        B[currentProject]
        C[archivedProjects]
        D[worldInfoSessions]
        E[userPreferences]
        F[classifierIntentLog]
    end
    subgraph Agents
        L[Lightweight Classifier]
        W[World Info Planner]
        K[Kanban Executor]
    end
    UI[React UI / Hooks]
    A --> UI
    B --> UI
    C --> UI
    D --> UI
    E --> UI
    F --> UI
    UI --> L
    L -->|intent JSON| UI
    UI --> W
    W -->|world info summary + chat log| UI
    UI --> K
    K -->|system directives + human replies| UI
```

### 4. Prompt payload dictionary · Prompt 载荷字典

| 名称 | 来源 | 说明 |
| ---- | ---- | ---- |
| `worldInfo` | `workspace.projects[projectId].data.worldInfo` | 世界信息 Agent 生成的结构化项目摘要，含 `projectName`、`projectGoal`、`keyDeadline`、可选的 `moduleList`、`memberList`。|
| `worldChatLog` | `workspace.projects[projectId].chat.world` | 世界信息配置阶段的聊天原文；在看板 Prompt 中以“世界信息配置对话记录”传入，方便回顾头脑风暴细节。|
| `kanbanChatLog` | `workspace.projects[projectId].chat.kanban` | 看板日常对话记录。生成 prompt 时取最近若干条并附带系统消息、轻量判定结果。|
| `boardState` | `workspace.projects[projectId].data` | 当前项目的完整数据载荷，含 `board.columns`、`tasks`、`events`、阻塞信息等，是 Kanban Agent 执行补丁的依据。|
| `metrics` / `insights` | `buildInsights(data)` | 基于本地统计的健康度指标（如 WIP、阻塞告警、吞吐量），在 prompt 中提醒 AI 衡量风险。|
| `intentLog` | `workspace.projects[projectId].intentLog` | 轻量判定 Agent 的历史结果，帮助后续 prompt 调整语气或解释分类原因。|
| `userPreferences` | 预留字段 | 尚未填充的个性化设定，未来会同步到看板 prompt 中定义风格和提醒方式。|
| `worldInfoEntryContext` | `projectFlow` 上下文 | 触发世界信息流程的来源（新项目/AI 新任务/手动进入），在 prompt 中提示 AI 避免引用旧项目上下文。|

> 📌 提示：看板 Agent 的 prompt 在迎接用户回到看板时会收到以上所有字段；当世界信息 Agent 完成配置后，系统会主动发送欢迎语，并强制要求本回合的 `patch_instructions` 为空数组，避免未确认的自动改动。

## End-to-end usage walkthrough · 用户使用流程

1. **Login & language selection 登录与语言切换**  
   用户打开应用后进入登录界面，可切换中英等语言。登录成功即进入看板聊天界面。
2. **Initial command -> classifier 首次指令走轻量判定**
   所有高阶指令（新项目 / 当前项目 / 旧项目）先由轻量 Agent 分类；判定结果与置信度写入 `intentLog` 供调试。若未来扩展“文字游戏”等功能，可在 JSON 中预留字段。
3. **New project -> world info 新项目流程**
   - 轻量 Agent 判定为 `NEW_PROJECT` 时，触发世界信息配置界面。
   - 世界信息 Agent 引导头脑风暴或解析上传的计划书，补齐项目结构化信息（目标、阶段、依赖、截止时间等）。
   - 完成后弹出确认弹窗，展示 Agent 整理的摘要，用户确认即保存并返回看板。
4. **Hand-off to Kanban 交接至看板**
   - 看板界面清空旧聊天，加载新世界信息与完整配置对话记录，并由系统自动发送欢迎语。
   - 看板 Agent 自动接收到一条「返回看板欢迎」prompt，要求它总结世界信息并确认是否需要自动规划；本回合 `patch_instructions` 会被强制设为空数组，待用户明确授权后再执行任务拆分。
   - 若 AI 生成初始任务，将通过增量补丁写入任务列，并且仅在新增任务时才跳转到世界信息补写流程。
5. **Daily operations 日常操作**
   - 每次重要命令（如废弃项目、切换旧项目、合并项目）都先通过轻量 Agent 判定。
   - 看板 Agent 的 Prompt 持续包含：阻塞信息、当前任务列、世界信息摘要、用户习惯（占位）、操控规则、最近聊天片段。
6. **Project completion or abandon 项目完成/废弃**
   - 用户表达“完成”或“不做了”时，轻量 Agent 识别为 `NEW_PROJECT` 流程，触发二次确认和世界信息重置。
   - 世界信息配置完成后回到看板，旧对话与任务被清空，但保留归档，可在未来唤醒；系统会自动推送欢迎 prompt，提醒用户新世界信息已生效。
7. **Reviving archived projects 唤醒旧项目**
   - 轻量 Agent 判定为 `ARCHIVED_PROJECT`。若用户仅提到“给我旧项目列表”，则跳转到旧项目目录界面；若指明具体名称，直接载入对应看板。
   - 用户确认继续时，旧项目成为当前项目；若仅查看后退出，则保持现状。
   - 合并项目通过本地 UI 封闭式提问与关键词判断，无需 AI 参与。
8. **Colour management 颜色管理**
   - 看板 Agent 返回的配色将映射到预设的中国传统色板，确保视觉一致性。

## Implementation roadmap · 实施路线图

### File plan before coding · 开工前的文件定位

> ✅ 已按指示巡览当前代码结构（`src/app/**`, `src/components/**` 等目录）。下面记录后续每一项改动将触及的模块，方便在真正动手前对照。

1. **Classifier loop hardening 轻量判定闭环加固**
   - 预计调整文件：`src/app/logic/projectFlow.js`（扩展状态机）、`src/app/services/aiService.js`（新增判定请求）、`src/app/data/workspace.js`（为判定日志预留存储字段）、`src/components/KanbanView.js` 与 `src/components/WorldInfoSetup.js`（在交互入口调用判定）。
   - 重点功能：统一从登录后入口、世界信息返回、旧项目唤醒等路径触发轻量 Agent；在本地记录 `intent` 历史。

2. **World info session isolation 世界信息会话隔离**
   - 预计调整文件：`src/components/WorldInfoSetup.js`（重构 UI 容器与头脑风暴/上传分支）、`src/app/logic/worldInfo.js`（整理 prompt 片段）、`src/app/storage/localStorage.js` 与 `src/app/data/workspace.js`（新建世界信息会话快照）。
   - 重点功能：清空旧聊天、支持文件解析占位、生成确认弹窗数据结构。

3. **Kanban reboot handshake 看板接管流程**
   - 预计调整文件：`src/components/KanbanView.js`（添加初始看板生成/手动创建分支）、`src/app/logic/patches.js`（扩展增量补丁类型）、`src/app/services/aiSchemas.js`（描述双通道响应 schema）。
   - 重点功能：AI 输出区分「对人类的话」与「系统指令」；虚拟时间同步入口；回退/确认弹窗。

4. **Archived project explorer 旧项目总览**
   - 预计调整文件：`src/app/data/workspace.js`（完善 `archivedProjects` 模型）、`src/components/KanbanView.js` & `src/components/UIComponents.js`（目录视图、动画）、`src/app/logic/projectFlow.js`（状态转换到目录/具体项目）、`src/app/logic/metrics.js`（合并项目统计）。
   - 重点功能：旧项目列表与具体看板切换、合并流程的本地关键词检测。

5. **i18n & UI polish 多语言与美化**
   - 预计调整文件：`src/index.js` / `src/App.js`（引入 `i18next`）、`src/components/layout/AppHeader.js`（语言切换）、`src/app/constants/colors.js`（传统色映射规则）、`src/app/logic/charts.js`（燃尽图/累积流图美化）。
   - 重点功能：语言资源包加载、主题色校正、图表样式统一。

> 在执行每一阶段开发前，将再次核对本清单并视情况增补文件位置，以保持 README 与实际改动同步。

1. **Finalize classifier loop**：✅（2025-05-29）首轮接入完成，已在看板输入前调用 `classifyIntent`、落地 `intentLog`、触发新项目/旧项目提示。
   - Next：补齐登录入口、管理员命令、归档目录等分支，扩充 `meta` 字段校验与埋点可视化。
   **完成后更新 README：** （进行中）后续将追加判定覆盖率统计与示例 JSON。
   - Build log（2025-05-30）：修正轻量判定导致的误触发——仅当 AI 新增任务时才进入世界信息补写；取消后不再清空当前看板。
2. **World info session isolation**：构建全新 UI 容器、清空旧聊天、实现上传解析与头脑风暴模式切换。
   - Next：确保确认弹窗返回看板后立即触发看板欢迎 prompt（已完成）、并强化判定示例以避免普通任务触发世界信息流。
   **完成后更新 README：** 附上字段校验列表与成功示例。
3. **Kanban reboot handshake**：实现世界信息 -> 看板的 prompt 交接、初始任务生成确认、虚拟时间同步入口。
   **完成后更新 README：** 说明初始任务生成策略与用户覆盖选项。
   - Build log（2025-05-30）：新增自动欢迎流程与 `patch_instructions=[]` 约束，避免世界信息确认后仍需手动发送指令。
4. **Archived project explorer**：实现目录视图、旧项目动画切换、合并流程；补齐 `archivedProjects` schema。
   **完成后更新 README：** 发布旧项目唤醒 UX 截图与数据结构示例。
5. **i18n integration & UI polish**：导入 `i18next`，实现主题色映射、组件美化与可视化（燃尽图、CDF、WIP 等）优化。
   **完成后更新 README：** 更新多语言配置方法与设计指引。
6. **Prompt governance & telemetry**：收敛多 Agent Prompt 模板版本、记录轻量 Agent/看板 Agent 的响应结构，并为未来的策略调优输出埋点。
   - Next：建立 prompt 版本号、落地自动化回归（snapshot prompt + mock response）以避免误改。

## Toward the paid desktop suite · 向付费桌面端套件迈进

> 🎯 目标：在当前单机原型完成后，演进为支持多人协作、账号体系、内部论坛/知识库的跨平台桌面付费软件。
>
> The following list captures major capability gaps, suggested technical stacks, and integration notes needed to evolve this project into a commercial-grade, multi-user desktop product.

| 能力 Capability | 所需工作 Items | 技术对接建议 Technical alignment |
| ---------------- | ------------- | -------------------------------- |
| **账号与权限体系 Authentication & roles** | - 拆分普通用户/管理员登录流程<br>- 接入 OAuth2 / 邮件注册、重置密码<br>- 实现项目级别的角色与权限矩阵 | - 采用 `Keycloak`/`Auth0` 等身份服务或自建 `NestJS + JWT`<br>- 在前端引入 `react-query` 同步 session 状态<br>- 扩展轻量判定 Agent 的 `meta` 字段，区分管理员指令 |
| **实时协作 Real-time board sync** | - 支持多人同时编辑任务、拖拽列<br>- 冲突检测与变更审计 | - 后端使用 `WebSocket`/`WebRTC` 或 `Supabase Realtime`<br>- 客户端采用 CRDT（如 `Yjs`）包装看板数据，确保离线合并 |
| **多端发布 Desktop distribution** | - 打包为 Windows/macOS/Linux 桌面端<br>- 自动更新、崩溃报告 | - 使用 `Electron` 或 `Tauri` 封装 React 前端<br>- 集成 `Sentry` 收集错误，使用 `electron-updater` 推送更新 |
| **内部论坛 & 知识库 Internal forum / wiki** | - 项目公告、讨论区、文档版本管理<br>- 任务与讨论帖互联 | - 选型 `Discourse` API / 自建 `Next.js` SSR 微服务<br>- 将论坛贴子的摘要纳入世界信息 Agent prompt，提供知识回溯 |
| **多语言运营 Localization at scale** | - 完整的 i18n 资源库、翻译工作流<br>- 管理后台编辑多语言世界信息模板 | - 使用 `i18next` + `locize`/`Phrase` 管理翻译<br>- 在 prompt 库中增加语言代码字段，后端按语言动态生成提示词 |
| **审计与合规 Audit & compliance** | - 聊天记录加密存储、可导出<br>- 行为日志与操作留痕 | - 后端数据库采用 `PostgreSQL` + 行级加密<br>- 记录所有 Agent 请求/响应 hash，方便合规审计 |
| **计费与许可证 Billing & licensing** | - 订阅管理、团队配额、试用期控制 | - 集成 `Stripe`/`Paddle` 支付，使用许可服务校验客户端<br>- 在前端维护离线许可缓存，失联后限定功能 |

### 技术接口协同摘要 Summary for technical handoff

1. **服务划分**：推荐拆分为前端（React + Electron/Tauri）、后端 API（NestJS/Express + PostgreSQL）、身份服务、实时协作服务、论坛服务五个子系统，通过 gRPC/REST 约定接口。
2. **Agent 网关**：引入集中式 Agent Orchestrator（可选 `LangChain`/`Semantic Kernel`），统一调度轻量判定、看板、世界信息等模型，并暴露可监控的 HTTP Endpoint 供前端调用。
3. **数据契约**：使用 `OpenAPI`/`JSON Schema` 发布板数据、世界信息、增量补丁、论坛同步等合同，前后端共享 TypeScript 类型（`ts-json-schema-generator`）。
4. **安全策略**：要求所有 Agent 请求携带用户/项目上下文的签名 Token，结合操作日志写入审计库，满足企业级合规需求。
5. **部署路径**：建议采用容器化（Docker + Kubernetes）部署后端服务，结合 CI/CD（GitHub Actions）自动执行单元测试、Prompt 回归与桌面打包流水线。

> 后续在逐步完成当前单机版路线图时，请同步更新本节，标注哪些能力已具备、哪些仍待引入，以便为商业化阶段预留接口。

## Build log · 构建记录

- 2025-05-30 · Step 5：更新 Prompt 管理计划，梳理向桌面付费套件演进所需的账号、实时协作、论坛、计费等技术路线。
- 2025-05-29 · Step 4：接入轻量判定 Agent，记录判定日志，按意图触发新项目确认与旧项目提示，并在 UI 显示意图 Banner。
- 2025-05-28 · Step 3：整理多 Agent 工作流、补充状态图与数据图，归档已知缺口，并删除过时 FAQ。
- 2025-05-28 · Step 2：引入 `projectFlow` 状态机与项目快照机制，接管“废弃项目 → 世界信息重置 → 回到看板”的流程开端。
- 2025-05-28 · Step 1：为 `src/app/**` 与 `src/components/**` 关键文件补充模块级注释，明确已完成功能、实现方式与待办事项。

如需进一步讨论实现细节或测试策略，欢迎继续提出要求。下一次完成关键节点时，请记得同步更新本文档，保持团队共享认知。
