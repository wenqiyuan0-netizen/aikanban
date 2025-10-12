import { DEFAULT_DATA } from '../data/defaultData';
import { clone } from '../utils/clone';

const LS_KEY = 'ai_kanban_data_v1';

export const loadData = () => {
        try {
                const raw = localStorage.getItem(LS_KEY);
                const initialData = raw ? JSON.parse(raw) : clone(DEFAULT_DATA);

                if (!Array.isArray(initialData.tasks)) initialData.tasks = [];
                if (!Array.isArray(initialData.members)) initialData.members = clone(DEFAULT_DATA.members);
                if (!Array.isArray(initialData.events)) initialData.events = [];
                if (!initialData.worldInfo) initialData.worldInfo = clone(DEFAULT_DATA.worldInfo);

                if (initialData.worldInfo.memberList && initialData.worldInfo.memberList.length > 0) {
                        initialData.members = initialData.worldInfo.memberList;
                }

                initialData.tasks = initialData.tasks.map((task) => {
                        if (task.status === 'Blocked') {
                                task.block_reason = task.block_reason || '从旧版Blocked状态迁移';
                                task.status = 'In Progress';
                        }
                        if (!task.level) task.level = 'Task';
                        if (!task.depends_on) task.depends_on = [];
                        return task;
                });

                return initialData;
        } catch {
                return clone(DEFAULT_DATA);
        }
};

export const saveData = (data) => localStorage.setItem(LS_KEY, JSON.stringify(data, null, 2));

export const storageKey = LS_KEY;
