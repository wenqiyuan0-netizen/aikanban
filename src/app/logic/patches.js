/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 解析并应用 AI 返回的结构化补丁指令，包括任务新增、更新、移动以及成员/世界信息调整。
 * - 提供线性流程约束检查，阻止不合法的列顺序调整。
 *
 * Implementation Notes / 实现方式:
 * - `applyPatch` 逐条遍历补丁，根据类型写入任务、成员、事件记录等。
 * - `enforceLinearWorkflow` 结合列顺序常量，确保任务只能单向推进或回退。
 *
 * Pending / 未完成:
 * - 尚未覆盖所有补丁类型（如项目级配置、指标修正等）。
 * - 缺少事务性回滚或冲突检测机制。
 *
 * Next Steps / 后续计划:
 * - 为项目废弃/重启引入专用补丁类型，结合状态机触发流程。
 * - 增加补丁校验与审计日志，便于追踪 AI 操作来源。
 */
import { COLUMN_ORDER } from '../constants/colors';
import { getAssigneeList } from '../constants/task';
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
                                                const merged = { ...nextData.tasks[taskIndex], ...patch.updates };
                                                if (patch.updates.status && COLUMN_ORDER.includes(patch.updates.status)) {
                                                        merged.status = patch.updates.status;
                                                        if (merged.status === 'In Progress' && !merged.started_at) {
                                                                merged.started_at = nowISO();
                                                        }
                                                        if (merged.status === 'Done' && !merged.finished_at) {
                                                                merged.finished_at = nowISO();
                                                        }
                                                }
                                                if (!merged.assignees && merged.owner) {
                                                        merged.assignees = getAssigneeList(merged);
                                                }
                                                nextData.tasks[taskIndex] = merged;
                                        }
                                        break;
                                }
                                case 'task_add': {
                                        if (patch.details) {
                                                if (!patch.details.id) patch.details.id = `t-${Math.random().toString(36).slice(2, 8)}`;
                                                if (!patch.details.status || !COLUMN_ORDER.includes(patch.details.status)) {
                                                        patch.details.status = 'To Do';
                                                }
                                                if (!patch.details.created_at) patch.details.created_at = nowISO();
                                                if (!patch.details.level) patch.details.level = patch.details.type || 'Task';
                                                if (!patch.details.depends_on) patch.details.depends_on = [];
                                                if (!patch.details.assignees && patch.details.owner) {
                                                        patch.details.assignees = getAssigneeList(patch.details);
                                                }

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
        if (fromIndex === -1 || toIndex === -1) return;
        if (toIndex > fromIndex + 1) {
                throw new Error(`任务不应跳过阶段直接进入 ${nextStatus}。请遵循线性工作流：${COLUMN_ORDER.join(' -> ')}`);
        }
}
