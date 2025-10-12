/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - Builds a presentational model for the new Kanban board: sorted columns,
 *   swimlanes, filtered tasks, and WIP alerts that both the UI and prompt layer
 *   can consume.
 *
 * Implementation Notes / 实现方式:
 * - 支持根据 `SWIMLANE_STRATEGIES` 动态生成泳道；当策略为负责人时，任务会同时出现在
 *   多个泳道中（以 `laneId::taskId` 作为渲染 key），符合 Jira/Linear 的表现。
 * - 快速筛选器、搜索关键字会在构建模型时预处理，确保 UI 组件无需重复逻辑。
 * - 返回的 `promptContext` 字段预留给 Kanban Agent Prompt，标记当前泳道、过滤条件。
 *
 * Pending / 未完成:
 * - 日历/列表视图尚未内置在模型中，仅提供辅助数据。
 * - 未来需要支持自定义泳道顺序与持久化。
 *
 * Next Steps / 后续计划:
 * - 将泳道/过滤器设置与用户偏好（`userPreferences`) 对齐，实现跨设备一致性。
 */
import { QUICK_FILTERS, SWIMLANE_STRATEGIES } from '../constants/board';
import { getAssigneeList } from '../constants/task';
import { getModuleColor } from '../constants/colors';

export function buildBoardModel({
        board,
        tasks = [],
        members = [],
        searchText = '',
        activeQuickFilters = [],
        swimlaneStrategy,
        currentUser,
}) {
        const columns = (board?.columns || [])
                .slice()
                .sort((a, b) => (a.order || 0) - (b.order || 0));

        const laneConfig =
                SWIMLANE_STRATEGIES.find((strategy) => strategy.value === swimlaneStrategy) || SWIMLANE_STRATEGIES[0];

        const filters = QUICK_FILTERS.filter((filter) => activeQuickFilters.includes(filter.id));
        const normalisedSearch = searchText.trim().toLowerCase();

        const filteredTasks = tasks.filter((task) => {
                if (!task) return false;
                if (filters.length) {
                        const passedAll = filters.every((filter) =>
                                filter.predicate(task, { currentUser, members, column: board?.columns }),
                        );
                        if (!passedAll) return false;
                }
                if (normalisedSearch) {
                        const haystack = [
                                task.id,
                                task.title,
                                task.description,
                                task.module,
                                ...(task.tags || []),
                                ...(task.depends_on || []),
                        ]
                                .filter(Boolean)
                                .join(' ')
                                .toLowerCase();
                        if (!haystack.includes(normalisedSearch)) return false;
                }
                return true;
        });

        const laneMap = new Map();
        filteredTasks.forEach((task) => {
                        const laneKeys = computeLaneKeys(task, laneConfig, members);
                        laneKeys.forEach((laneKey) => {
                                const entry = laneMap.get(laneKey.id) || {
                                        id: laneKey.id,
                                        label: laneKey.label,
                                        color: laneKey.color,
                                        tasksByColumn: new Map(),
                                };
                                const columnTasks = entry.tasksByColumn.get(task.status) || [];
                                columnTasks.push(task);
                                entry.tasksByColumn.set(task.status, columnTasks);
                                laneMap.set(laneKey.id, entry);
                        });
        });

        const lanes = Array.from(laneMap.values()).sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans'));

        const wipAlerts = computeWipAlerts(columns, filteredTasks);

        const promptContext = {
                swimlaneStrategy: laneConfig.value,
                activeQuickFilters,
                searchText,
                lanes: lanes.map((lane) => ({ id: lane.id, label: lane.label })),
        };

        return {
                columns,
                lanes,
                wipAlerts,
                promptContext,
        };
}

function computeLaneKeys(task, laneConfig, members) {
        if (!laneConfig) return [{ id: 'default', label: '默认泳道', color: null }];
        switch (laneConfig.taskField) {
                case 'module': {
                        const label = task.module || '未分配模块';
                        return [
                                {
                                        id: `module:${label}`,
                                        label,
                                        color: getModuleColor(task.module),
                                },
                        ];
                }
                case 'priority': {
                        const label = task.priority || '未设置优先级';
                        return [{ id: `priority:${label}`, label }];
                }
                case 'type': {
                        const label = task.type || task.level || 'Task';
                        return [{ id: `type:${label}`, label }];
                }
                case 'assignees': {
                        const assignees = getAssigneeList(task);
                        if (!assignees.length) {
                                return [{ id: 'assignee:unassigned', label: '未分配' }];
                        }
                        return assignees.map((id) => {
                                const member = members.find((m) => m.id === id);
                                return {
                                        id: `assignee:${id}`,
                                        label: member ? `${member.name} (${member.role || '成员'})` : id,
                                };
                        });
                }
                default:
                        return [{ id: 'default', label: '默认泳道' }];
        }
}

function computeWipAlerts(columns, tasks) {
        const wipByColumn = new Map();
        tasks.forEach((task) => {
                const column = columns.find((col) => col.name === task.status);
                if (!column || !column.wip_limit) return;
                const current = wipByColumn.get(column.id) || 0;
                wipByColumn.set(column.id, current + 1);
        });

        return columns
                .filter((column) => column.wip_limit && (wipByColumn.get(column.id) || 0) > column.wip_limit)
                .map((column) => ({
                        column,
                        count: wipByColumn.get(column.id) || 0,
                }));
}
