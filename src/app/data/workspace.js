/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 定义工作区（workspace）与项目（project）的默认结构、生成方法以及旧版数据迁移策略。
 * - 负责在缺失字段时补齐默认值（列、成员、任务字段），并记录项目创建/更新时间戳。
 * - 提供工具函数：创建项目记录、生成工作区骨架、迁移单项目数据、以及生成唯一项目 ID。
 *
 * Implementation Notes / 实现方式:
 * - `normaliseProjectData` 会深度复制默认数据，逐项覆盖传入值以确保数据完整性。
 * - 通过 `ensureArray`、`normaliseTasks` 等函数解决旧版本 schema 差异（如 Blocked → In Progress）。
 * - `createWorkspaceSkeleton` 将提示版本等元数据集中管理，为未来 prompt 版本控制做准备。
 *
 * Pending / 未完成:
 * - 尚未包含对 `archivedProjects`、`worldInfoSessions` 等结构的高级操作（仅初始化）。
 * - 未实现虚拟时间轴或项目标签等扩展字段的生成策略。
 *
 * Next Steps / 后续计划:
 * - 增加针对归档项目的 helper（如 `archiveProject`, `restoreProject`）。
 * - 与状态机结合，为废弃/重启流程提供原子化的数据迁移 API。
 */
import { DEFAULT_DATA } from './defaultData';
import { clone } from '../utils/clone';
import { nowISO } from '../utils/dateUtils';

const DEFAULT_PROJECT_ID = 'project-1';

const ensureArray = (value, fallback) => {
        if (Array.isArray(value)) return value;
        return clone(fallback);
};

const ensureIntentLog = (log) => {
        if (!Array.isArray(log)) return [];
        return log.map((entry) => ({
                ...entry,
                recordedAt: entry.recordedAt || nowISO(),
        }));
};

const normaliseTasks = (tasks) =>
        ensureArray(tasks, DEFAULT_DATA.tasks).map((task) => {
                const nextTask = { ...task };
                if (nextTask.status === 'Blocked') {
                        nextTask.block_reason = nextTask.block_reason || '从旧版Blocked状态迁移';
                        nextTask.status = 'In Progress';
                }
                if (!nextTask.level) nextTask.level = 'Task';
                if (!Array.isArray(nextTask.depends_on)) nextTask.depends_on = [];
                return nextTask;
        });

const normaliseMembers = (members, worldInfo) => {
        if (Array.isArray(members) && members.length > 0) return members;
        if (worldInfo?.memberList && worldInfo.memberList.length > 0) return worldInfo.memberList;
        return clone(DEFAULT_DATA.members);
};

const normaliseBoard = (board) => {
        const nextBoard = { ...clone(DEFAULT_DATA.board), ...(board || {}) };
        if (!Array.isArray(nextBoard.columns) || nextBoard.columns.length === 0) {
                nextBoard.columns = clone(DEFAULT_DATA.board.columns);
        }
        nextBoard.last_update = nextBoard.last_update || nowISO();
        return nextBoard;
};

export const normaliseProjectData = (raw = {}) => {
        const base = Object.keys(raw).length === 0 ? clone(DEFAULT_DATA) : { ...clone(DEFAULT_DATA), ...raw };

        const worldInfo = base.worldInfo
                ? { ...clone(DEFAULT_DATA.worldInfo), ...base.worldInfo }
                : clone(DEFAULT_DATA.worldInfo);

        return {
                worldInfo,
                board: normaliseBoard(base.board),
                members: normaliseMembers(base.members, worldInfo),
                tasks: normaliseTasks(base.tasks),
                events: ensureArray(base.events, []),
        };
};

export const createProjectRecord = ({
        id = DEFAULT_PROJECT_ID,
        data,
        title,
        createdAt,
        updatedAt,
        chat,
        intentLog,
        status = 'active',
} = {}) => {
        const initialData = normaliseProjectData(data);
        const timestamp = nowISO();

        return {
                id,
                title: title || initialData.worldInfo?.projectName || '未命名项目',
                createdAt: createdAt || timestamp,
                updatedAt: updatedAt || timestamp,
                status,
                data: initialData,
                chat: {
                        kanban: ensureArray(chat?.kanban, []),
                        world: ensureArray(chat?.world, []),
                },
                intentLog: ensureIntentLog(intentLog),
        };
};

export const createWorkspaceSkeleton = ({
        projectId = DEFAULT_PROJECT_ID,
        project,
        archivedProjects,
        worldInfoSessions,
        promptVersions,
} = {}) => {
        const projectRecord = createProjectRecord({ id: projectId, ...(project || {}) });

        return {
                currentProjectId: projectRecord.id,
                projects: {
                        [projectRecord.id]: projectRecord,
                },
                archivedProjects: archivedProjects || {},
                worldInfoSessions: worldInfoSessions || {},
                intentLogVersion: 1,
                agentPrompts: {
                        conversation: 1,
                        internal: 1,
                        ...(promptVersions || {}),
                },
        };
};

export const migrateLegacyDataToWorkspace = (legacyData) => {
        const projectRecord = createProjectRecord({
                id: DEFAULT_PROJECT_ID,
                data: legacyData,
        });

        return createWorkspaceSkeleton({
                projectId: projectRecord.id,
                project: projectRecord,
        });
};

export const ensureProjectRecord = (workspace, projectId) => {
        if (!workspace.projects[projectId]) {
                workspace.projects[projectId] = createProjectRecord({ id: projectId });
        }
        return workspace.projects[projectId];
};

export const generateProjectId = () => `project-${Date.now()}`;
