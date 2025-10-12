/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 声明轻量判定 Agent 可返回的意图常量，供前端状态机与日志使用。
 *
 * Implementation Notes / 实现方式:
 * - 提供中文注释，描述每个意图在业务中的含义，避免魔法字符串散落。
 *
 * Pending / 未完成:
 * - 未来需补充更多细分子类型（如旧项目目录/具体项目、合并分支等）。
 *
 * Next Steps / 后续计划:
 * - 与 prompt 模板和状态机同步维护，确保新增意图时前后端一致。
 */
export const INTENTS = {
        NEW_PROJECT: 'NEW_PROJECT',
        CURRENT_PROJECT: 'CURRENT_PROJECT',
        ARCHIVED_PROJECT: 'ARCHIVED_PROJECT',
        UNKNOWN: 'UNKNOWN',
};

export const ARCHIVED_RESOLUTION = {
        LIST: 'LIST',
        SPECIFIC: 'SPECIFIC',
        MERGE: 'MERGE',
        NONE: 'NONE',
};
