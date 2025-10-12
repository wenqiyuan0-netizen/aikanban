import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_MODES } from '../constants/appModes';
import { INITIAL_KANBAN_CHAT } from '../constants/chat';
import { DEFAULT_DATA } from '../data/defaultData';
import { loadWorkspace, saveWorkspace } from '../storage/localStorage';
import { clone } from '../utils/clone';
import { nowISO } from '../utils/dateUtils';

export function useWorkspace() {
        const [workspace, setWorkspace] = useState(() => loadWorkspace());
        const activeProjectId = workspace.currentProjectId;
        const activeProject = workspace.projects[activeProjectId] || {
                id: activeProjectId,
                data: clone(DEFAULT_DATA),
                chat: { kanban: INITIAL_KANBAN_CHAT, world: [] },
        };
        const data = activeProject.data;

        const [kanbanChatLog, setKanbanChatLog] = useState(() =>
                activeProject.chat?.kanban?.length ? activeProject.chat.kanban : INITIAL_KANBAN_CHAT,
        );
        const [worldChatLog, setWorldChatLog] = useState(() => activeProject.chat?.world || []);
        const chatLogsRef = useRef({ kanban: kanbanChatLog, world: worldChatLog });

        useEffect(() => {
                chatLogsRef.current = {
                        kanban: kanbanChatLog,
                        world: worldChatLog,
                };
        }, [kanbanChatLog, worldChatLog]);

        useEffect(() => {
                setWorkspace((previous) => {
                        const project = previous.projects[previous.currentProjectId];
                        if (!project) return previous;
                        if (project.chat?.kanban === kanbanChatLog && project.chat?.world === worldChatLog) {
                                return previous;
                        }
                        const nextWorkspace = clone(previous);
                        const nextProject = nextWorkspace.projects[nextWorkspace.currentProjectId];
                        nextProject.chat = {
                                kanban: kanbanChatLog,
                                world: worldChatLog,
                        };
                        nextProject.updatedAt = nowISO();
                        return nextWorkspace;
                });
        }, [kanbanChatLog, worldChatLog]);

        useEffect(() => {
                saveWorkspace(workspace);
        }, [workspace]);

        const updateActiveProjectData = useCallback((updater) => {
                setWorkspace((previous) => {
                        const project = previous.projects[previous.currentProjectId];
                        if (!project) return previous;

                        const baseData = project.data;
                        const nextData = typeof updater === 'function' ? updater(clone(baseData)) : updater;
                        if (!nextData) return previous;

                        const nextWorkspace = clone(previous);
                        const nextProject = nextWorkspace.projects[nextWorkspace.currentProjectId];
                        nextProject.data = nextData;
                        nextProject.updatedAt = nowISO();
                        return nextWorkspace;
                });
        }, []);

        const appendChat = useCallback(
                (message, mode = APP_MODES.KANBAN) => {
                        if (mode === APP_MODES.WORLD_INFO_SETUP) {
                                setWorldChatLog((current) => {
                                        const next = [...current, message];
                                        chatLogsRef.current = {
                                                ...chatLogsRef.current,
                                                world: next,
                                        };
                                        return next;
                                });
                        } else {
                                setKanbanChatLog((current) => {
                                        const next = [...current, message];
                                        chatLogsRef.current = {
                                                ...chatLogsRef.current,
                                                kanban: next,
                                        };
                                        return next;
                                });
                        }
                        setTimeout(() => {
                                const selector =
                                        mode === APP_MODES.WORLD_INFO_SETUP
                                                ? '.world-chat-window'
                                                : '.kanban-chat-window';
                                const chatWindow = document.querySelector(selector);
                                if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
                        }, 50);
                },
                [],
        );

        return {
                workspace,
                activeProject,
                activeProjectId,
                data,
                worldInfo: data.worldInfo,
                kanbanChatLog,
                setKanbanChatLog,
                worldChatLog,
                setWorldChatLog,
                chatLogsRef,
                appendChat,
                updateActiveProjectData,
        };
}
