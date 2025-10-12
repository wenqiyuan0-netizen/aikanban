# AI Kanban Roadmap · AI 看板计划

> 🇨🇳 建议：README 可以采用「双语结构」：先给出中文概要，再保留英文版；或者维护 `README.md`（中文） + `README.en.md`（英文）。本仓库先在同一份文档中提供双语说明，后续可按计划拆分成两个文件。

This repository hosts an experimental AI-assisted Kanban board. The current priority is to keep the React entry point small while we iteratively add localisation, prompt orchestration, and richer analytics.

## Current refactor status · 当前重构进度

- ✅ `App.js` 已拆分为 orchestrator（状态协调者），核心逻辑迁移至 `src/app/**` 目录。
- ✅ 默认数据、度量、AI 调用等模块完成初次抽离，可独立演进。
- 🔄 正在推进「多项目管理 / 世界信息重启流程」的落地，确保后续界面与 Agent 配置保持一致。

## Active implementation plan · 当前迭代重点

> 目标：建立可维护的「多项目管理」骨架，让看板 Agent 与世界信息 Agent 在切换项目时拥有清晰的责任边界与 prompt 协议。

### 1. Prompt 层级划分

- **对话 Agent（面向用户）**：
  - 看板 Agent 负责用户可见的对话、任务确认、旧项目召回指令。
  - 世界信息 Agent 只在配置阶段暴露给用户，辅助完成结构化项目描述或头脑风暴。
- **内部协同 Agent（系统提示）**：
  - `kanbanOrchestrator`：接收看板 Agent 的结构化 JSON（如 `{"intent":"REQUEST_PROJECT_RESET"}`），决定是否弹窗、切换界面、读取存储。
  - `worldInfoBroker`：从世界信息 Agent 输出中筛选摘要、校验必填字段，生成供看板 Agent 复用的初始 prompt。
- **Prompt 控制策略**：
  - 面向用户的 prompt 要强调上下文来源、确认流程与用户可做的选择。
  - 内部协同 prompt 更多是指令式模板（无用户可见文案），确保结构化响应可被前端安全解析。

### 2. 状态机与事件梳理

| 状态 | 触发事件 | 说明 |
| --- | --- | --- |
| `KANBAN_ACTIVE` | 用户提出废弃/重启意图 | 看板 Agent 返回 `REQUEST_PROJECT_RESET`，前端弹窗确认 |
| `CONFIRM_ABORT` | 用户确认 | 本地归档当前项目，进入世界信息配置 |
| `WORLD_INFO_RESET` | 世界信息 Agent 输出完整配置 | 生成结构化摘要 + 对话日志快照 |
| `KANBAN_REBOOT` | 用户确认回到看板 | 清空 UI 聊天、注入新摘要、可选生成初始任务 |

### 3. 数据切面

- `currentProject`：当前活跃项目的任务列、聊天记录、指标缓存。
- `archivedProjects`：历史项目完整备份（用于未来唤醒）。
- `worldInfoSessions`：按项目 ID 存储配置阶段的聊天与结构化结果。
- `agentPrompts`：集中管理对话 Agent 与内部协同 Agent 的 prompt 模板，便于按语言或版本迭代。

### 4. 任务拆解

1. 扩充存储模块：支持多项目命名空间、读写归档数据。
2. 实现确认弹窗与状态迁移回调，断开旧项目 UI 聊天。（进行中：已引入 `projectFlow` 状态机与快照暂存，待归档落地。）
3. 构建世界信息配置向导：
   - 用户界面空白状态，无旧项目痕迹。
   - Agent 输出的结构化摘要需符合 schema 校验。
4. 在看板视图中读取新摘要，触发“AI 建议 vs 用户手动”分支。
5. 记录虚拟时间轴调整接口，为后续同步历史事件做好准备。

完成上述步骤后，将进入多语言、UI 美化等后续里程碑。

## Project reset & multi-board orchestration · 新旧项目切换与多看板调度

> Goal：在用户放弃当前项目、转而启动全新计划时，提供清晰的确认—配置—回到看板的三段式体验，同时为旧项目的后续唤醒做好数据准备。

### Target flow · 目标流程

1. **Abort confirmation 废弃确认**  
   - 看板 Agent 监听到“废弃当前项目 / 开启新项目”等意图后，向前端发出结构化指令。  
   - 前端弹窗展示风险提示（历史记录将归档但不会丢失），用户确认后进入下一步。
2. **World-info reset 全局信息重置**  
   - 切换到「世界信息配置」界面，且不携带旧项目任何上下文。  
   - 世界信息 Agent 根据 prompt 引导用户：若已有完整方案则快速填充；若信息不足则进入头脑风暴对话，直至结构化字段（目标、里程碑、截止时间、依赖等）被填满。  
   - 所有对话被写入“新项目配置”独立日志，旧项目日志仅归档不参与此次会话。
3. **Commit & handoff 提交与交接**  
   - 用户确认配置完成后，世界信息 Agent 输出：
     - 结构化的项目摘要（供看板 Agent 作为初始 prompt）。  
     - 可选的附件或聊天记录引用。  
   - 前端触发状态机：清空看板聊天面板、初始化列/任务（可空白或根据 Agent 建议创建样板），记录“虚拟时间同步”标记，允许用户后续补录历史事件。
4. **Kanban re-entry 回到看板**  
   - 看板 Agent 读取刚刚生成的项目摘要与聊天上下文，以此询问用户是「自行创建第一批任务」还是「由 AI 建议初始看板」。  
   - 若用户请求 AI 规划，则在本地生成草稿任务列表并再次走确认弹窗。

### Data retention strategy · 数据保留策略

- **Current project 当前项目**：在“废弃”动作后将任务、指标、聊天记录转存至 `archivedProjects`（本地索引），但不再主动推送给任何 Agent。  
- **Archived projects 历史项目**：保留完整结构（世界信息、看板状态、聊天记录）。后续可通过看板 Agent 的多轮判定「旧项目 / 当前项目」进行唤醒：
  1. 第一次请求仅返回判定 JSON（旧项目名或“仍属当前项目”）。  
  2. 若选择旧项目，前端再发送二次请求携带旧项目所有资料，Agent 负责挑选正确的项目并确认。  
  3. 非当前路径时，这些内部判定信息不暴露给用户，只反馈必要的提示。
- **Virtual timeline 虚拟时间轴**：保留字段供看板 Agent 在新项目启动时重写，用于对齐历史叙事或导入用户口述的先前事件。

### Next implementation steps · 下一步实现建议

1. **State diagram 状态图**：梳理状态机（`KANBAN_ACTIVE → CONFIRM_ABORT → WORLD_INFO_RESET → KANBAN_REBOOT`）。  
2. **Agent contract 协议定义**：为看板/世界信息 Agent 设计结构化指令（JSON schema），规范“废弃确认”、“项目摘要输出”、“旧项目索引查询”等交互。  
3. **Storage layering 存储分层**：扩展本地存储模块，添加 `archivedProjects`、`currentProjectId`、`worldInfoSessions` 等命名空间。  
4. **UI integration UI 接入**：实现弹窗、提示条、空状态界面，确保双聊天窗互不干扰并按项目隔离。  
5. **Telemetry & QA 观测与验收**：为关键节点埋点（确认点击、摘要生成、旧项目唤醒），并编写端到端脚本验证状态清空与数据迁移是否符合预期。

通过上述步骤，既能保障“新项目”流程干净利落，又为未来的旧项目恢复功能预留完整数据链路。

## Build log · 构建记录

- 2025-05-28 · Step 1：为 `src/app/**` 与 `src/components/**` 关键文件补充模块级注释，明确已完成功能、实现方式与待办事项，方便后续协作与代码审阅。
- 2025-05-28 · Step 2：引入 `projectFlow` 状态机与项目快照机制，接管“废弃项目 → 世界信息重置 → 回到看板”的流程开端，并在 UI 中触发世界信息配置的干净上下文。

## Recommended workflow 建议工作流

1. **Confirm localisation scope 明确本地化范围**：先列出所有需要翻译的界面 & 文案，生成词条清单。
2. **Set up i18n tooling 配置多语言工具链**：引入 `i18next`、`react-i18next`，创建语言资源文件。
3. **Refactor prompts & API UI 重构 Prompt / API 界面**：新建设置对话框或独立页面，支持表单输入、验证、预览。
4. **Iterate UI design 迭代界面设计**：先确定设计基调（颜色、排版），再逐步替换现有组件样式。
5. **Track progress with issues 使用 Issue 跟踪进度**：按里程碑拆分 Issue，确保计划落地。

欢迎根据以上计划逐步推进，如需新增模块或调优方案，可在 Issue / PR 中继续讨论。
