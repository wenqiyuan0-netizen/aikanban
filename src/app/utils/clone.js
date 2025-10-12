/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 提供最简单的深拷贝实现，保证状态更新不直接修改原对象。
 *
 * Implementation Notes / 实现方式:
 * - 基于 `JSON.stringify/parse`，适用于无函数/循环引用的数据结构。
 *
 * Pending / 未完成:
 * - 对于含日期、Map/Set、循环引用的对象存在局限。
 *
 * Next Steps / 后续计划:
 * - 视需要替换为更健壮的深拷贝实现或引入 Immer 等不可变工具库。
 */
export const clone = (value) => JSON.parse(JSON.stringify(value));
