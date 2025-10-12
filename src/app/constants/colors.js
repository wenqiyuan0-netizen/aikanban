/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 维护模块与列的颜色映射，帮助 UI 组件根据模块/列名渲染统一的 Tailwind 样式与图表颜色。
 *
 * Implementation Notes / 实现方式:
 * - `MODULE_COLORS`、`COLUMN_COLORS`、`COLUMN_ORDER` 均以对象/数组形式导出，供 Kanban 视图与图表模块复用。
 * - `getModuleColor` 提供安全回退，避免未知模块导致样式缺失。
 *
 * Pending / 未完成:
 * - 尚未支持暗色模式 / 自定义主题。
 * - 缺少多语言映射（列名硬编码为英文）。
 *
 * Next Steps / 后续计划:
 * - 将颜色配置纳入主题系统，允许管理员动态调整。
 * - 与国际化方案结合，为列名提供键值映射而非直接字符串。
 */
export const MODULE_COLORS = {
        IIOT: 'border-blue-400 bg-blue-50/50',
        TT: 'border-green-400 bg-green-50/50',
        GET: 'border-purple-400 bg-purple-50/50',
        WS: 'border-yellow-400 bg-yellow-50/50',
        EMS: 'border-red-400 bg-red-50/50',
        DEFAULT: 'border-gray-200 bg-white',
};

export const getModuleColor = (module) => MODULE_COLORS[module] || MODULE_COLORS.DEFAULT;

export const COLUMN_COLORS = {
        'To Do': { key: 'todo', color: '#64748B' },
        'In Progress': { key: 'doing', color: '#3B82F6' },
        'Review': { key: 'review', color: '#F59E0B' },
        'Done': { key: 'done', color: '#10B981' },
};

export const COLUMN_ORDER = ['To Do', 'In Progress', 'Review', 'Done'];
