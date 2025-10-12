/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 提供顶层工作区（workspace）状态钩子，负责加载、保存、以及更新当前项目数据与聊天记录。
 * - 支持多项目骨架：当前项目、归档项目、聊天分通道（看板 / 世界信息）。
 * - 自动同步聊天引用，确保模态/AI 调用拿到最新日志，同时将变更持久化到本地存储。
 *
 * Implementation Notes / 实现方式:
 * - `loadWorkspace` / `saveWorkspace` 从 localStorage 读取/写入，并通过 `clone` 保持不可变性。
 * - 利用 `useEffect` 侦听聊天变动更新 workspace，并通过 `chatLogsRef` 暴露最新快照。
 * - `appendChat` 根据模式写入对应通道，并触发滚动到底的 UI 行为。
 *
 * Pending / 未完成:
 * - 尚未暴露项目归档、恢复、或多项目索引的操作接口。
 * - 未存储世界信息配置的结构化输出摘要（仅保留聊天原文）。
 *
 * Next Steps / 后续计划:
 * - 扩展为返回状态机驱动的项目流控制句柄，帮助 App 组件在废弃/切换项目时共享逻辑。
 * - 引入 `worldInfoSessions` 的 CRUD API，便于在世界信息配置完成后生成摘要并归档。
 */
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
                intentLog: [],
        };
        const data = activeProject.data;
        const intentLog = Array.isArray(activeProject.intentLog) ? activeProject.intentLog : [];

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
                intentLog,
                recordIntentDecision: useCallback(
                        (entry) => {
                                setWorkspace((previous) => {
                                        const project = previous.projects[previous.currentProjectId];
                                        if (!project) return previous;

                                        const nextWorkspace = clone(previous);
                                        const nextProject = nextWorkspace.projects[nextWorkspace.currentProjectId];
                                        const safeEntry = {
                                                ...entry,
                                                recordedAt: entry?.recordedAt || nowISO(),
                                        };
                                        const nextLog = Array.isArray(nextProject.intentLog) ? nextProject.intentLog.slice() : [];
                                        nextLog.push(safeEntry);
                                        nextProject.intentLog = nextLog;
                                        nextProject.updatedAt = nowISO();
                                        return nextWorkspace;
                                });
                        },
                        [],
                ),
        };
}
