import { COLUMN_ORDER } from '../constants/colors';
import { DURATION_THRESHOLDS, getTaskPoints } from '../constants/task';
import { daysBetween, nowISO } from '../utils/dateUtils';

export function computeMetrics(data) {
        const tasks = data.tasks || [];
        const getPoints = (task) => getTaskPoints(task.level);

        const done = tasks.filter((task) => task.status === 'Done');
        const doing = tasks.filter((task) => task.status === 'In Progress');
        const todo = tasks.filter((task) => task.status === 'To Do');
        const review = tasks.filter((task) => task.status === 'Review');
        const blocked = tasks.filter((task) => task.status !== 'Done' && task.block_reason);

        const totalPoints = tasks.reduce((sum, task) => sum + getPoints(task), 0);
        const donePoints = done.reduce((sum, task) => sum + getPoints(task), 0);
        const doingPoints = doing.reduce((sum, task) => sum + getPoints(task), 0);
        const reviewPoints = review.reduce((sum, task) => sum + getPoints(task), 0);

        const average = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
        const leadDurations = done.map((task) => daysBetween(task.created_at, task.finished_at)).filter(Boolean);
        const cycleDurations = done
                .map((task) => daysBetween(task.started_at || task.created_at, task.finished_at))
                .filter(Boolean);

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        const throughput7d = done
                .filter((task) => task.finished_at && new Date(task.finished_at) >= sevenDaysAgo)
                .reduce((sum, task) => sum + getPoints(task), 0);

        return {
                total: tasks.length,
                totalPoints,
                counts: {
                        done: done.length,
                        doing: doing.length,
                        todo: todo.length,
                        review: review.length,
                        blocked: blocked.length,
                },
                points: {
                        done: donePoints,
                        doing: doingPoints,
                        todo: totalPoints - donePoints - reviewPoints - doingPoints,
                        review: reviewPoints,
                },
                avgLead: +average(leadDurations).toFixed(2),
                avgCycle: +average(cycleDurations).toFixed(2),
                throughput7d,
                wip: doingPoints + reviewPoints,
                wipToTh: throughput7d ? +((doingPoints + reviewPoints) / throughput7d).toFixed(2) : null,
        };
}

export function buildInsights(data) {
        const metrics = computeMetrics(data);
        const issues = [];
        const generatedAt = nowISO();
        const now = new Date();
        const threeDaysFuture = new Date(now.getTime() + 3 * 24 * 3600 * 1000);

        const doingColumn = data.board?.columns?.find((column) => column.name === 'In Progress');
        if (doingColumn?.wip_limit && metrics.wip > doingColumn.wip_limit) {
                        issues.push({
                                type: 'wip_limit_breach',
                                column: 'WIP (Doing + Review)',
                                wip: metrics.wip,
                                limit: doingColumn.wip_limit,
                                suggestion: '暂停拉取新任务，先清空在制品（WIP 以 Story Points 计算）',
                        });
        }

        const blockedTaskIds = new Set(
                (data.tasks || [])
                        .filter((task) => task.block_reason && task.status !== 'Done')
                        .map((task) => task.id),
        );

        (data.tasks || []).forEach((task) => {
                if (task.status === 'Done') return;

                if (task.status === 'In Progress' || task.status === 'Review') {
                        const startTime = task.started_at || task.created_at;
                        const daysInWip = daysBetween(startTime, generatedAt);
                        const taskLevel = task.level || 'Task';
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
                                suggestion: '协调资源或改用mock',
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
