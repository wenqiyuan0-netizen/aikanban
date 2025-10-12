import { COLUMN_ORDER } from '../constants/colors';
import { clone } from '../utils/clone';
import { nowISO } from '../utils/dateUtils';

export function applyPatch(currentData, patches) {
        const nextData = clone(currentData);
        nextData.tasks = nextData.tasks || [];
        nextData.members = nextData.members || [];
        nextData.events = nextData.events || [];
        nextData.worldInfo = nextData.worldInfo || {};
        nextData.worldInfo.memberList = nextData.worldInfo.memberList || [];

        patches.forEach((patch) => {
                try {
                        if (!patch.type) return;

                        switch (patch.type) {
                                case 'task_update': {
                                        const taskIndex = nextData.tasks.findIndex((task) => task.id === patch.id);
                                        if (taskIndex !== -1 && patch.updates) {
                                                nextData.tasks[taskIndex] = { ...nextData.tasks[taskIndex], ...patch.updates };
                                                if (patch.updates.status === 'In Progress' && !nextData.tasks[taskIndex].started_at) {
                                                        nextData.tasks[taskIndex].started_at = nowISO();
                                                }
                                                if (patch.updates.status === 'Done' && !nextData.tasks[taskIndex].finished_at) {
                                                        nextData.tasks[taskIndex].finished_at = nowISO();
                                                }
                                        }
                                        break;
                                }
                                case 'task_add': {
                                        if (patch.details) {
                                                if (!patch.details.id) patch.details.id = `t-${Math.random().toString(36).slice(2, 8)}`;
                                                if (!patch.details.status) patch.details.status = 'To Do';
                                                if (!patch.details.created_at) patch.details.created_at = nowISO();
                                                if (!patch.details.level) patch.details.level = 'Task';
                                                if (!patch.details.depends_on) patch.details.depends_on = [];

                                                if (!nextData.tasks.some((task) => task.id === patch.details.id)) {
                                                        nextData.tasks.push(patch.details);
                                                }
                                        }
                                        break;
                                }
                                case 'member_add': {
                                        if (patch.details && patch.details.id) {
                                                if (!nextData.members.some((member) => member.id === patch.details.id)) {
                                                        nextData.members.push(patch.details);
                                                }
                                                const existsInWorld = nextData.worldInfo.memberList.some((member) => member.id === patch.details.id);
                                                if (!existsInWorld) {
                                                        nextData.worldInfo.memberList.push(patch.details);
                                                }
                                        }
                                        break;
                                }
                                case 'member_remove': {
                                        if (patch.id) {
                                                nextData.members = nextData.members.filter((member) => member.id !== patch.id);
                                                nextData.worldInfo.memberList = nextData.worldInfo.memberList.filter((member) => member.id !== patch.id);
                                        }
                                        break;
                                }
                                case 'event_add': {
                                        if (patch.details) {
                                                if (!patch.details.id) patch.details.id = `e-${(nextData.events.length || 0) + 1}`;
                                                nextData.events.push(patch.details);
                                        }
                                        break;
                                }
                                default: {
                                        console.warn(`Unknown patch type received: ${patch.type}`);
                                }
                        }
                } catch (error) {
                        console.error('Failed to apply patch:', patch, error);
                }
        });

        nextData.board.last_update = nowISO();
        return nextData;
}

export function enforceLinearWorkflow(task, nextStatus) {
        const fromIndex = COLUMN_ORDER.indexOf(task.status);
        const toIndex = COLUMN_ORDER.indexOf(nextStatus);
        if (toIndex > fromIndex + 1) {
                throw new Error(`任务不应跳过阶段直接进入 ${nextStatus}。请遵循线性工作流：${COLUMN_ORDER.join(' -> ')}`);
        }
}
