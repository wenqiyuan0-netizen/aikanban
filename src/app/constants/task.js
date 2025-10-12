/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 定义任务等级对应的点数与预估时长阈值，供指标计算与 UI 展示使用。
 *
 * Implementation Notes / 实现方式:
 * - 通过简单对象映射并提供 `getTaskPoints` 帮助函数，确保未知等级可回落到默认值。
 *
 * Pending / 未完成:
 * - 未根据团队差异提供可配置化入口。
 * - `DURATION_THRESHOLDS` 尚未在 UI 中充分展示。
 *
 * Next Steps / 后续计划:
 * - 与世界信息配置联动，让 AI 根据项目类型调整点数与时长阈值。
 */
export const TASK_POINTS = {
        Task: 1,
        Story: 3,
        Epic: 5,
        DEFAULT: 1,
};

export const getTaskPoints = (level) => TASK_POINTS[level] || TASK_POINTS.DEFAULT;

export const DURATION_THRESHOLDS = {
        Epic: 14,
        Story: 7,
        Task: 3,
        DEFAULT: 5,
};
