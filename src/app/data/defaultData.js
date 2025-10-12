/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - Provides the canonical default payload for a fresh project, including
 *   structured world info, a production-grade Kanban workflow (columns, swimlanes,
 *   WIP limits) and rich sample tasks that exercise all manual features.
 *
 * Implementation Notes / 实现方式:
 * - 任务字段对齐 README 所述的卡片规范：类型、优先级、负责人、标签、子任务、附件、
 *   评论与活动时间线均已就绪，方便演示非 AI 的本地交互。
 * - `board.settings` 记录泳道策略与快速筛选配置；这些键值也会被 prompt 构建器引用，
 *   变量名称请参见 README 的 Prompt 字典（例如 `boardState.columns`, `boardState.swimlanes`).
 *
 * Pending / 未完成:
 * - 目前示例仍是单项目模板，尚未针对不同行业/团队输出多套初始看板。
 * - 附件字段仅存储元数据，缺少真实上传实现。
 *
 * Next Steps / 后续计划:
 * - 结合世界信息 Agent 的结果动态生成默认列与泳道。
 * - 为项目恢复/归档流程提供更多示例任务，覆盖跨项目合并情境。
 */
export const DEFAULT_DATA = {
        worldInfo: {
                projectName: 'AI 看板重构计划',
                projectGoal:
                        '搭建一个兼容 AI 与人工操作的高级看板，支持多项目切换、世界信息同步与Prompt治理。',
                keyDeadline: '2025-12-31T23:59:59.000Z',
                moduleList: ['Prompt 系统', '看板引擎', '美术风格', '本地存储'],
                memberList: [
                        { id: 'pm', name: 'PM 周', role: '产品经理' },
                        { id: 'fe', name: 'FE 李', role: '前端开发' },
                        { id: 'ux', name: 'UX 王', role: '设计' },
                        { id: 'qa', name: 'QA 陈', role: '测试' },
                ],
        },
        board: {
                name: 'AI Kanban Launch Board',
                created_at: '2025-04-10',
                last_update: '2025-05-30',
                columns: [
                        { id: 'todo', name: 'To Do', order: 1, wip_limit: null, color: '#64748B' },
                        { id: 'design', name: 'Designing', order: 2, wip_limit: 4, color: '#7C3AED' },
                        {
                                id: 'in_progress',
                                name: 'In Progress',
                                order: 3,
                                wip_limit: 6,
                                color: '#2563EB',
                                subColumns: [
                                        { id: 'in_progress_doing', name: 'Doing', order: 1 },
                                        { id: 'in_progress_ready', name: 'Ready for Review', order: 2 },
                                ],
                        },
                        { id: 'code_review', name: 'Code Review', order: 4, wip_limit: 3, color: '#F97316' },
                        { id: 'qa', name: 'QA', order: 5, wip_limit: 3, color: '#0EA5E9' },
                        { id: 'done', name: 'Done', order: 6, wip_limit: null, color: '#10B981' },
                ],
                swimlanes: {
                        defaultStrategy: 'module',
                        laneOrder: [],
                        customLanes: [],
                },
                filters: {
                        quick: [],
                        searchText: '',
                },
        },
        members: [
                { id: 'pm', name: 'PM 周', role: '产品经理' },
                { id: 'fe', name: 'FE 李', role: '前端开发' },
                { id: 'ux', name: 'UX 王', role: '设计' },
                { id: 'qa', name: 'QA 陈', role: '测试' },
        ],
        tasks: [
                {
                        id: 'KAN-101',
                        title: '世界信息 → 看板 Prompt 字典整理',
                        description:
                                '列出看板 Agent 需要的所有上下文变量，确保 Prompt 版本治理与 UI 同步。',
                        status: 'Designing',
                        subStatus: null,
                        module: 'Prompt 系统',
                        type: 'Story',
                        level: 'Story',
                        priority: 'High',
                        assignees: ['pm', 'fe'],
                        tags: ['prompt', 'documentation'],
                        created_at: '2025-04-10T09:00:00.000Z',
                        started_at: '2025-04-11T10:00:00.000Z',
                        due_at: '2025-05-05T18:00:00.000Z',
                        depends_on: [],
                        block_reason: null,
                        checklist: [
                                { id: 'KAN-101-1', title: '整理 prompt 变量', done: true },
                                { id: 'KAN-101-2', title: '校对 README 字典', done: false },
                        ],
                        attachments: [
                                {
                                        id: 'att-101',
                                        name: 'prompt-matrix.xlsx',
                                        type: 'link',
                                        url: 'https://example.com/prompt-matrix.xlsx',
                                },
                        ],
                        comments: [
                                {
                                        id: 'c-101-1',
                                        author: 'pm',
                                        time: '2025-04-12T09:30:00.000Z',
                                        body: '需要记录所有 Agent 的 prompt key，避免遗漏。',
                                },
                        ],
                        activity: [
                                {
                                        id: 'a-101-1',
                                        type: 'status_change',
                                        from: 'To Do',
                                        to: 'Designing',
                                        actor: 'pm',
                                        time: '2025-04-11T10:00:00.000Z',
                                },
                        ],
                },
                {
                        id: 'KAN-102',
                        title: '看板列模型重构',
                        description:
                                '重写看板列定义，支持自定义 WIP、子列、泳道与导出，保证手动拖拽体验。',
                        status: 'In Progress',
                        subStatus: 'in_progress_doing',
                        module: '看板引擎',
                        type: 'Epic',
                        level: 'Epic',
                        priority: 'Highest',
                        assignees: ['fe'],
                        tags: ['kanban-core'],
                        created_at: '2025-04-10T09:30:00.000Z',
                        started_at: '2025-04-15T09:00:00.000Z',
                        due_at: '2025-06-01T12:00:00.000Z',
                        depends_on: ['KAN-101'],
                        block_reason: null,
                        checklist: [
                                { id: 'KAN-102-1', title: '列出所有列与子列', done: true },
                                { id: 'KAN-102-2', title: '实现泳道渲染', done: false },
                                { id: 'KAN-102-3', title: '设计导出按钮', done: false },
                        ],
                        attachments: [],
                        comments: [
                                {
                                        id: 'c-102-1',
                                        author: 'fe',
                                        time: '2025-04-18T14:00:00.000Z',
                                        body: '需要兼容 AI 补丁与手动拖拽，考虑加入事务日志。',
                                },
                        ],
                        activity: [
                                {
                                        id: 'a-102-1',
                                        type: 'status_change',
                                        from: 'Designing',
                                        to: 'In Progress',
                                        actor: 'fe',
                                        time: '2025-04-15T09:00:00.000Z',
                                },
                        ],
                },
                {
                        id: 'KAN-103',
                        title: 'UI 色板与 hover 详情卡',
                        description:
                                '将卡片信息在悬停时显示为信息卡片，避免界面拥挤，并映射中国传统色。',
                        status: 'Code Review',
                        subStatus: null,
                        module: '美术风格',
                        type: 'Task',
                        level: 'Task',
                        priority: 'Medium',
                        assignees: ['ux'],
                        tags: ['ui'],
                        created_at: '2025-04-12T08:00:00.000Z',
                        started_at: '2025-04-20T10:00:00.000Z',
                        due_at: '2025-05-10T10:00:00.000Z',
                        finished_at: null,
                        depends_on: ['KAN-102'],
                        block_reason: null,
                        checklist: [
                                { id: 'KAN-103-1', title: '颜色映射表', done: true },
                                { id: 'KAN-103-2', title: 'Hover 卡片设计', done: false },
                        ],
                        attachments: [],
                        comments: [],
                        activity: [
                                {
                                        id: 'a-103-1',
                                        type: 'status_change',
                                        from: 'In Progress',
                                        to: 'Code Review',
                                        actor: 'ux',
                                        time: '2025-05-01T17:00:00.000Z',
                                },
                        ],
                },
                {
                        id: 'KAN-104',
                        title: '本地存储迁移脚本',
                        description: '迁移旧项目任务结构，保留聊天记录，并支持归档恢复。',
                        status: 'QA',
                        subStatus: null,
                        module: '本地存储',
                        type: 'Story',
                        level: 'Story',
                        priority: 'High',
                        assignees: ['fe', 'qa'],
                        tags: ['storage'],
                        created_at: '2025-04-18T09:00:00.000Z',
                        started_at: '2025-05-05T09:30:00.000Z',
                        due_at: '2025-05-20T10:00:00.000Z',
                        depends_on: ['KAN-102'],
                        block_reason: '等待 QA 用例准备',
                        checklist: [
                                { id: 'KAN-104-1', title: '导出旧结构', done: true },
                                { id: 'KAN-104-2', title: '转换任务字段', done: true },
                                { id: 'KAN-104-3', title: 'QA 核对', done: false },
                        ],
                        attachments: [],
                        comments: [
                                {
                                        id: 'c-104-1',
                                        author: 'qa',
                                        time: '2025-05-15T12:00:00.000Z',
                                        body: '需要更多样例任务验证迁移。',
                                },
                        ],
                        activity: [],
                },
                {
                        id: 'KAN-105',
                        title: '世界信息导出 API',
                        description: '提供 REST 接口导出世界信息，供外部系统调用。',
                        status: 'Done',
                        subStatus: null,
                        module: 'Prompt 系统',
                        type: 'Task',
                        level: 'Task',
                        priority: 'Low',
                        assignees: ['fe'],
                        tags: ['api'],
                        created_at: '2025-04-05T09:00:00.000Z',
                        started_at: '2025-04-07T10:00:00.000Z',
                        finished_at: '2025-04-15T16:00:00.000Z',
                        depends_on: [],
                        block_reason: null,
                        checklist: [],
                        attachments: [],
                        comments: [],
                        activity: [
                                {
                                        id: 'a-105-1',
                                        type: 'status_change',
                                        from: 'Code Review',
                                        to: 'Done',
                                        actor: 'pm',
                                        time: '2025-04-15T16:00:00.000Z',
                                },
                        ],
                },
        ],
        events: [
                { id: 'e-1', time: '2025-04-11T10:00:00.000Z', type: 'move', task_id: 'KAN-101', from: 'To Do', to: 'Designing', user: 'pm' },
                { id: 'e-2', time: '2025-04-15T09:00:00.000Z', type: 'move', task_id: 'KAN-102', from: 'Designing', to: 'In Progress', user: 'fe' },
                { id: 'e-3', time: '2025-05-01T17:00:00.000Z', type: 'move', task_id: 'KAN-103', from: 'In Progress', to: 'Code Review', user: 'ux' },
                { id: 'e-4', time: '2025-05-05T09:30:00.000Z', type: 'move', task_id: 'KAN-104', from: 'Designing', to: 'In Progress', user: 'fe' },
                { id: 'e-5', time: '2025-04-15T16:00:00.000Z', type: 'complete', task_id: 'KAN-105', from: 'Code Review', to: 'Done', user: 'pm' },
        ],
};
