/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 声明前端应用的核心模式常量（看板视图 / 世界信息配置）。
 *
 * Implementation Notes / 实现方式:
 * - 使用常量对象确保模式字符串一致，避免硬编码散落在组件中。
 *
 * Pending / 未完成:
 * - 未来还需扩展出管理员、归档浏览等模式枚举。
 *
 * Next Steps / 后续计划:
 * - 在状态机接入后，扩展更多语义化模式常量并配合类型提示。
 */
export const APP_MODES = {
        KANBAN: 'kanban',
        WORLD_INFO_SETUP: 'worldInfoSetup'
};
