/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - Maintains colour palettes for modules and column statuses so the new Kanban
 *   board can render consistent styling, WIP warnings, and hover tooltips.
 *
 * Implementation Notes / 实现方式:
 * - 增加了与 README 描述一致的列顺序（To Do → Designing → In Progress → Code Review → QA → Done）。
 * - `COLUMN_PALETTE` 采用中国传统色色系近似值，AI 若返回自定义颜色时可映射到该表。
 *
 * Pending / 未完成:
 * - 暂未引入暗色模式与动态主题。
 * - 模块颜色仍为静态映射，未来可结合世界信息自动生成。
 *
 * Next Steps / 后续计划:
 * - 构建颜色校正器，根据 AI 反馈的十六进制颜色映射到最近的传统色。
 */
export const MODULE_COLORS = {
        'Prompt 系统': 'border-amber-400 bg-amber-50/60',
        '看板引擎': 'border-indigo-400 bg-indigo-50/60',
        '美术风格': 'border-rose-300 bg-rose-50/60',
        '本地存储': 'border-emerald-400 bg-emerald-50/60',
        DEFAULT: 'border-gray-200 bg-white',
};

export const getModuleColor = (module) => MODULE_COLORS[module] || MODULE_COLORS.DEFAULT;

export const COLUMN_COLORS = {
        'To Do': { key: 'todo', color: '#5C6F82' },
        Designing: { key: 'design', color: '#7C3AED' },
        'In Progress': { key: 'in_progress', color: '#2563EB' },
        'Code Review': { key: 'code_review', color: '#F97316' },
        QA: { key: 'qa', color: '#0EA5E9' },
        Done: { key: 'done', color: '#10B981' },
};

export const COLUMN_ORDER = ['To Do', 'Designing', 'In Progress', 'Code Review', 'QA', 'Done'];
