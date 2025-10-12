import { createWorkspaceSkeleton, createProjectRecord, migrateLegacyDataToWorkspace, ensureProjectRecord } from '../data/workspace';
import { clone } from '../utils/clone';

const WORKSPACE_KEY = 'ai_kanban_workspace_v1';
const LEGACY_KEY = 'ai_kanban_data_v1';

const rebuildWorkspace = (rawWorkspace) => {
        const safeWorkspace = rawWorkspace && typeof rawWorkspace === 'object' ? rawWorkspace : {};
        const currentProjectId = safeWorkspace.currentProjectId;

        const projects = Object.entries(safeWorkspace.projects || {}).reduce((acc, [projectId, projectValue]) => {
                acc[projectId] = createProjectRecord({
                        id: projectId,
                        data: projectValue?.data,
                        title: projectValue?.title,
                        createdAt: projectValue?.createdAt,
                        updatedAt: projectValue?.updatedAt,
                        chat: projectValue?.chat,
                        status: projectValue?.status,
                });
                return acc;
        }, {});

        if (Object.keys(projects).length === 0) {
                const skeleton = createWorkspaceSkeleton();
                return skeleton;
        }

        const workspace = {
                currentProjectId: currentProjectId && projects[currentProjectId] ? currentProjectId : Object.keys(projects)[0],
                projects,
                archivedProjects: safeWorkspace.archivedProjects || {},
                worldInfoSessions: safeWorkspace.worldInfoSessions || {},
                agentPrompts: {
                        conversation: 1,
                        internal: 1,
                        ...(safeWorkspace.agentPrompts || {}),
                },
        };

        ensureProjectRecord(workspace, workspace.currentProjectId);
        return workspace;
};

const persistWorkspace = (workspace) => {
        localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace, null, 2));
};

export const loadWorkspace = () => {
        try {
                const rawWorkspace = localStorage.getItem(WORKSPACE_KEY);
                if (rawWorkspace) {
                        const parsed = JSON.parse(rawWorkspace);
                        return rebuildWorkspace(parsed);
                }

                const legacyRaw = localStorage.getItem(LEGACY_KEY);
                if (legacyRaw) {
                        const legacyParsed = JSON.parse(legacyRaw);
                        const migrated = migrateLegacyDataToWorkspace(legacyParsed);
                        persistWorkspace(migrated);
                        localStorage.removeItem(LEGACY_KEY);
                        return migrated;
                }

                const skeleton = createWorkspaceSkeleton();
                persistWorkspace(skeleton);
                return skeleton;
        } catch (error) {
                console.warn('[storage] loadWorkspace fallback triggered', error);
                const fallback = createWorkspaceSkeleton();
                persistWorkspace(fallback);
                return fallback;
        }
};

export const saveWorkspace = (workspace) => {
        const safeWorkspace = workspace ? clone(workspace) : createWorkspaceSkeleton();
        persistWorkspace(safeWorkspace);
};

export const storageKey = WORKSPACE_KEY;
