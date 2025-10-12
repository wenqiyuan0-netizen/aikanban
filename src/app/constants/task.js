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
