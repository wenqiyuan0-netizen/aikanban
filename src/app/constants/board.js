/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - Defines shared board enumerations (task types, priorities, swimlane strategies,
 *   quick filters) so both the UI and prompt builders can reference a single
 *   source of truth when reasoning about the manual Kanban experience.
 *
 * Implementation Notes / 实现方式:
 * - 每一项常量都带有 `promptKey` 或描述，方便在生成给 Kanban Agent 的 prompt
 *   时直接引用字段名称，保持人机对齐。
 * - Swimlane 策略中的 `taskField` 对应任务对象字段，便于前端根据数据分组，
 *   同时也是后续传递给 AI 的上下文变量名（见 README 中的 Prompt 字典）。
 *
 * Pending / 未完成:
 * - 目前仅覆盖核心视图，未来需要补充列表视图配置、日历视图设置等。
 * - 快速筛选器尚未实现可配置化，仍是硬编码方案。
 *
 * Next Steps / 后续计划:
 * - 将这些常量抽离为可通过世界信息配置定制的模板，使不同项目能够自定义
 *   工作流、优先级字典与泳道策略。
 */

export const TASK_TYPES = [
        { value: 'Story', label: 'Story / 用户故事', promptKey: 'task.type' },
        { value: 'Task', label: 'Task / 基础任务', promptKey: 'task.type' },
        { value: 'Bug', label: 'Bug / 缺陷', promptKey: 'task.type' },
        { value: 'Spike', label: 'Spike / 技术预研', promptKey: 'task.type' },
        { value: 'Epic', label: 'Epic / 史诗', promptKey: 'task.type' },
];

export const TASK_PRIORITIES = [
        { value: 'Highest', label: '🔥 Highest', promptKey: 'task.priority' },
        { value: 'High', label: '⬆️ High', promptKey: 'task.priority' },
        { value: 'Medium', label: '⏺ Medium', promptKey: 'task.priority' },
        { value: 'Low', label: '⬇️ Low', promptKey: 'task.priority' },
        { value: 'Lowest', label: '🧊 Lowest', promptKey: 'task.priority' },
];

export const BOARD_STATUSES = [
        { value: 'To Do', label: '待办', promptKey: 'task.status' },
        { value: 'Designing', label: '设计中', promptKey: 'task.status' },
        { value: 'In Progress', label: '开发中', promptKey: 'task.status' },
        { value: 'Code Review', label: '代码评审', promptKey: 'task.status' },
        { value: 'QA', label: '测试中', promptKey: 'task.status' },
        { value: 'Done', label: '完成', promptKey: 'task.status' },
];

export const SWIMLANE_STRATEGIES = [
        {
                value: 'module',
                label: '按模块/史诗 (module)',
                taskField: 'module',
                promptKey: 'board.swimlane.module',
        },
        {
                value: 'assignee',
                label: '按负责人 (assignee)',
                taskField: 'assignees',
                promptKey: 'board.swimlane.assignee',
        },
        {
                value: 'priority',
                label: '按优先级 (priority)',
                taskField: 'priority',
                promptKey: 'board.swimlane.priority',
        },
        {
                value: 'type',
                label: '按任务类型 (type)',
                taskField: 'type',
                promptKey: 'board.swimlane.type',
        },
];

export const QUICK_FILTERS = [
        {
                id: 'mine',
                label: '只看我的任务',
                predicate: (task, context) =>
                        context.currentUser && task.assignees?.includes?.(context.currentUser),
                promptKey: 'board.filters.mine',
        },
        {
                id: 'highPriority',
                label: '高优先级',
                predicate: (task) => ['Highest', 'High'].includes(task.priority),
                promptKey: 'board.filters.highPriority',
        },
        {
                id: 'dueSoon',
                label: '3 天内到期',
                predicate: (task, _context, now = new Date()) => {
                        if (!task.due_at) return false;
                        const diff = new Date(task.due_at) - now;
                        return diff >= 0 && diff <= 3 * 24 * 3600 * 1000;
                },
                promptKey: 'board.filters.dueSoon',
        },
        {
                id: 'blocked',
                label: '查看阻塞任务',
                predicate: (task) => Boolean(task.block_reason),
                promptKey: 'board.filters.blocked',
        },
];

export const BOARD_VIEW_MODES = [
        { value: 'board', label: '看板视图', promptKey: 'board.view.board' },
        { value: 'list', label: '列表视图', promptKey: 'board.view.list' },
        { value: 'calendar', label: '日历视图', promptKey: 'board.view.calendar' },
];

export const BOARD_EXPORT_OPTIONS = [
        { value: 'json', label: '导出 JSON', promptKey: 'board.export.json' },
        { value: 'csv', label: '导出 CSV', promptKey: 'board.export.csv' },
];

export const DEFAULT_BOARD_CONFIG = {
        swimlaneStrategy: 'module',
        defaultViewMode: 'board',
};
