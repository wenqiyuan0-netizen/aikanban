/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 重新定义看板指标计算逻辑，使其匹配新版列模型（Designing、In Progress、Code Review、QA 等）。
 * - 输出更丰富的统计数据：按责任人聚合的工作量、列 WIP 告警、以及传递给 Prompt 的 `statusOrder`。
 *
 * Implementation Notes / 实现方式:
 * - 通过 `aggregateByAssignee` 与列配置动态推导统计项，避免硬编码。
 * - 保留 `issues` 列表供 AI 与人工 UI 共用，确保提示信息一致。
 *
 * Pending / 未完成:
 * - 尚未加入 SLA、吞吐量趋势预测等高级指标。
 * - 多项目聚合与虚拟时间轴尚未实现。
 *
 * Next Steps / 后续计划:
 * - 输出按泳道的吞吐量分析，结合世界信息 Agent 的模块规划。
 */
import { DURATION_THRESHOLDS, getAssigneeList, getTaskPoints } from '../constants/task';
import { COLUMN_ORDER } from '../constants/colors';
import { daysBetween, nowISO } from '../utils/dateUtils';

export function computeMetrics(data) {
        const tasks = data.tasks || [];
        const getPoints = (task) => getTaskPoints(task.level);

        const buckets = {
                done: tasks.filter((task) => task.status === 'Done'),
                todo: tasks.filter((task) => task.status === 'To Do'),
                designing: tasks.filter((task) => task.status === 'Designing'),
                inProgress: tasks.filter((task) => task.status === 'In Progress'),
                codeReview: tasks.filter((task) => task.status === 'Code Review'),
                qa: tasks.filter((task) => task.status === 'QA'),
        };

        const wipBuckets = [...buckets.designing, ...buckets.inProgress, ...buckets.codeReview, ...buckets.qa];

        const totalPoints = tasks.reduce((sum, task) => sum + getPoints(task), 0);
        const donePoints = buckets.done.reduce((sum, task) => sum + getPoints(task), 0);
        const designingPoints = buckets.designing.reduce((sum, task) => sum + getPoints(task), 0);
        const inProgressPoints = buckets.inProgress.reduce((sum, task) => sum + getPoints(task), 0);
        const reviewPoints = buckets.codeReview.concat(buckets.qa).reduce((sum, task) => sum + getPoints(task), 0);

        const average = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
        const leadDurations = buckets.done.map((task) => daysBetween(task.created_at, task.finished_at)).filter(Boolean);
        const cycleDurations = buckets.done
                .map((task) => daysBetween(task.started_at || task.created_at, task.finished_at))
                .filter(Boolean);

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        const throughput7d = buckets.done
                .filter((task) => task.finished_at && new Date(task.finished_at) >= sevenDaysAgo)
                .reduce((sum, task) => sum + getPoints(task), 0);

        const wipPoints = wipBuckets.reduce((sum, task) => sum + getPoints(task), 0);

        return {
                total: tasks.length,
                totalPoints,
                counts: {
                        done: buckets.done.length,
                        todo: buckets.todo.length,
                        designing: buckets.designing.length,
                        inProgress: buckets.inProgress.length,
                        review: buckets.codeReview.length + buckets.qa.length,
                        blocked: tasks.filter((task) => task.status !== 'Done' && task.block_reason).length,
                },
                points: {
                        done: donePoints,
                        designing: designingPoints,
                        inProgress: inProgressPoints,
                        review: reviewPoints,
                        todo: totalPoints - donePoints - designingPoints - inProgressPoints - reviewPoints,
                },
                avgLead: +average(leadDurations).toFixed(2),
                avgCycle: +average(cycleDurations).toFixed(2),
                throughput7d,
                wip: wipPoints,
                wipToTh: throughput7d ? +(wipPoints / throughput7d).toFixed(2) : null,
                workloadByAssignee: aggregateByAssignee(tasks),
                statusOrder: COLUMN_ORDER,
        };
}

export function buildInsights(data) {
        const metrics = computeMetrics(data);
        const issues = [];
        const generatedAt = nowISO();
        const now = new Date();
        const threeDaysFuture = new Date(now.getTime() + 3 * 24 * 3600 * 1000);

        const wipColumns = (data.board?.columns || []).filter((column) => column.wip_limit);
        const wipByColumn = new Map();
        (data.tasks || []).forEach((task) => {
                const column = (data.board?.columns || []).find((col) => col.name === task.status);
                if (!column || !column.wip_limit) return;
                const current = wipByColumn.get(column.id) || 0;
                wipByColumn.set(column.id, current + getTaskPoints(task.level));
        });

        wipColumns.forEach((column) => {
                const columnWip = wipByColumn.get(column.id) || 0;
                if (column.wip_limit && columnWip > column.wip_limit) {
                        issues.push({
                                type: 'wip_limit_breach',
                                column: column.name,
                                wip: columnWip,
                                limit: column.wip_limit,
                                suggestion: '暂停拉取新任务，先清空在制品（WIP 以 Story Points 计算）',
                        });
                }
        });

        const blockedTaskIds = new Set(
                (data.tasks || [])
                        .filter((task) => task.block_reason && task.status !== 'Done')
                        .map((task) => task.id),
        );

        (data.tasks || []).forEach((task) => {
                if (task.status === 'Done') return;

                if (['Designing', 'In Progress', 'Code Review', 'QA'].includes(task.status)) {
                        const startTime = task.started_at || task.created_at;
                        const daysInWip = daysBetween(startTime, generatedAt);
                        const taskLevel = task.level || task.type || 'Task';
                        const threshold = DURATION_THRESHOLDS[taskLevel] || DURATION_THRESHOLDS.DEFAULT;

                        if (daysInWip !== null && daysInWip > threshold) {
                                issues.push({
                                        type: 'long_duration_warning',
                                        task_id: task.id,
                                        title: task.title,
                                        level: taskLevel,
                                        status: task.status,
                                        days: daysInWip.toFixed(1),
                                        threshold,
                                        suggestion: `任务已在 ${task.status} 状态停留 ${daysInWip.toFixed(1)} 天 (${taskLevel} 阈值: ${threshold} 天)。请检查是否需要拆分或解除阻塞。`,
                                });
                        }
                }

                const dependencies = task.depends_on || [];
                const blockedDependencies = dependencies.filter((depId) => blockedTaskIds.has(depId));

                if (blockedDependencies.length > 0) {
                        issues.push({
                                type: 'dependency_blocked',
                                task_id: task.id,
                                title: task.title,
                                dependencies: blockedDependencies,
                                suggestion: `该任务被其依赖项 [${blockedDependencies.join(', ')}] 阻塞。请优先解除上游阻塞。`,
                        });
                }

                if (task.due_at && new Date(task.due_at) < now) {
                        issues.push({
                                type: 'overdue',
                                task_id: task.id,
                                title: task.title,
                                due_at: task.due_at,
                                suggestion: '拆分降范围，尽快交付一个子任务',
                        });
                }
                if (task.due_at && new Date(task.due_at) >= now && new Date(task.due_at) <= threeDaysFuture) {
                        issues.push({
                                type: 'due_soon',
                                task_id: task.id,
                                title: task.title,
                                due_at: task.due_at,
                                days_left: daysBetween(generatedAt, task.due_at).toFixed(1),
                        });
                }
                if (task.block_reason) {
                        issues.push({
                                type: 'blocked_self',
                                task_id: task.id,
                                title: task.title,
                                reason: task.block_reason,
                                suggestion: '协调资源或改用 mock 数据，解除阻塞。',
                        });
                }
                if (!task.due_at && task.status !== 'Done' && task.status !== 'To Do') {
                        issues.push({
                                type: 'missing_due_date',
                                task_id: task.id,
                                title: task.title,
                                suggestion: '请为进行中的任务设置截止日期。',
                        });
                }
        });

        return { generated_at: generatedAt, board: data.board?.name, metrics, issues };
}

function aggregateByAssignee(tasks) {
        const map = new Map();
        tasks.forEach((task) => {
                const assignees = getAssigneeList(task);
                const points = getTaskPoints(task.level);
                if (assignees.length === 0) {
                        const current = map.get('unassigned') || { assignee: 'unassigned', points: 0, tasks: 0 };
                        current.points += points;
                        current.tasks += 1;
                        map.set('unassigned', current);
                } else {
                        assignees.forEach((id) => {
                                const current = map.get(id) || { assignee: id, points: 0, tasks: 0 };
                                current.points += points;
                                current.tasks += 1;
                                map.set(id, current);
                        });
                }
        });
        return Array.from(map.values());
}
