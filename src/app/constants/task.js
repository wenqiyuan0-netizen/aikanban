/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - Extends task sizing constants to cover新的类型（Bug、Spike），并暴露点数与默认工期阈值，
 *   供指标计算与 Prompt 生成共用。
 *
 * Implementation Notes / 实现方式:
 * - `TASK_POINTS` 与 `DURATION_THRESHOLDS` 使用相同键名，便于统一引用。
 * - 额外导出 `getAssigneeList`，在 UI 层兼容旧字段 `owner`。
 *
 * Pending / 未完成:
 * - 点数映射尚未支持项目级覆盖；未来可由世界信息 Agent 动态返回。
 * - 未针对子任务提供独立点数策略。
 *
 * Next Steps / 后续计划:
 * - 引入“团队速度”配置，根据历史吞吐量调整默认点数。
 */
export const TASK_POINTS = {
        Task: 1,
        Story: 3,
        Epic: 8,
        Bug: 2,
        Spike: 2,
        DEFAULT: 1,
};

export const getTaskPoints = (levelOrType) => TASK_POINTS[levelOrType] || TASK_POINTS.DEFAULT;

export const DURATION_THRESHOLDS = {
        Epic: 21,
        Story: 10,
        Task: 3,
        Bug: 2,
        Spike: 5,
        DEFAULT: 5,
};

export const getAssigneeList = (task) => {
        if (!task) return [];
        if (Array.isArray(task.assignees) && task.assignees.length) return task.assignees;
        if (Array.isArray(task.owner) && task.owner.length) return task.owner;
        if (typeof task.owner === 'string' && task.owner) return task.owner.split(',').map((s) => s.trim());
        return [];
};
