/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 提供常用的日期时间工具函数：当前时间、UTC 转换、本地化格式化、日期差值。
 *
 * Implementation Notes / 实现方式:
 * - 封装错误捕获，保证当传入非法日期时返回 `undefined`/`null` 而不会抛错。
 *
 * Pending / 未完成:
 * - 未考虑时区设定、工作日计算等高级需求。
 *
 * Next Steps / 后续计划:
 * - 引入虚拟时间轴支持，允许根据项目历史对日期进行偏移。
 */
export const nowISO = () => new Date().toISOString();

export const toUtcIso = (localDt) => {
        if (!localDt) return undefined;
        try {
                const date = new Date(localDt);
                return isNaN(date.getTime()) ? undefined : date.toISOString();
        } catch {
                return undefined;
        }
};

export const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

export const daysBetween = (a, b) => {
        try {
                const x = new Date(a);
                const y = new Date(b);
                if (isNaN(x) || isNaN(y)) return null;
                return (y - x) / 86400000;
        } catch {
                return null;
        }
};
