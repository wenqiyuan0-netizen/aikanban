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
