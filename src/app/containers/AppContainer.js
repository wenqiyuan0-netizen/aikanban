/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 保留原 `App` 组件的全部业务逻辑，但迁移到 `AppContainer`，供入口文件复用。
 * - 负责串联 workspace 数据、聊天记录、看板视图、世界信息配置等核心 UI 模块。
 * - 实现任务 CRUD、拖拽迁移、导入导出、AI 补丁确认以及项目重置状态机等流程。
 * - 在关键分支旁新增 “Logic Audit” 注释，记录当前仍需统一或待确认的业务规则，方便后续对齐文档。
 *
 * Implementation Notes / 实现方式:
 * - 通过 `useWorkspace` 统一读取与更新当前项目数据，并追踪看板/世界信息双通道聊天。
 * - 使用 `useMemo` 与 `useCallback` 优化度量计算、列过滤、补丁应用等性能敏感逻辑。
 * - 借助多种模态组件（新增任务、编辑、删除确认、AI 任务确认等）完成用户操作闭环，并引入 `projectFlow` 状态机管理项目废弃/重启流。
 *
 * Pending / 未完成:
 * - 项目归档与旧项目恢复仍未实现（当前仅在内存中暂存快照）。
 * - 看板与世界信息聊天窗口的 UI 分离、美化、及多语言切换仍待实现。
 * - 删除任务后仍缺少撤销/回收站机制，详见下方逻辑审计注释。
 *
 * Next Steps / 后续计划:
 * - 将状态机与本地存储结合，真正归档旧项目并支持恢复/切换。
 * - 将世界信息 Agent 的结构化输出与看板初始提示对接，实现新项目的自动化接管流程。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
        AddTaskModal,
        MessageBox,
        ResetConfirmModal,
        ClearTasksConfirmModal,
        DeleteConfirmModal,
        AiTaskConfirmModal,
} from '../../components/UIComponents';
import { WorldInfoSetup } from '../../components/WorldInfoSetup';
import { AppHeader } from '../../components/layout/AppHeader';
import { AppFooter } from '../../components/layout/AppFooter';
import { KanbanView } from '../../components/KanbanView';
import { EditTaskModal } from '../../components/EditTaskModal';
import { APP_MODES } from '../constants/appModes';
import { getModuleColor } from '../constants/colors';
import { getAssigneeList, getTaskPoints } from '../constants/task';
import { BOARD_VIEW_MODES, DEFAULT_BOARD_CONFIG } from '../constants/board';
import { DEFAULT_DATA } from '../data/defaultData';
import { initialApiKey } from '../config/apiConfig';
import { computeMetrics, buildInsights } from '../logic/metrics';
import { calculateBurndownData, calculateCfdData } from '../logic/charts';
import { applyPatch, enforceLinearWorkflow } from '../logic/patches';
import { applyWorldPatch } from '../logic/worldInfo';
import { PROJECT_FLOW_EVENTS, PROJECT_FLOW_STATES, createProjectFlowContext, reduceProjectFlow } from '../logic/projectFlow';
import { buildBoardModel } from '../logic/boardModel';
import { classifyIntent, generatePatch } from '../services/aiService';
import { clone } from '../utils/clone';
import { nowISO, fmt, toUtcIso } from '../utils/dateUtils';
import { useWorkspace } from '../hooks/useWorkspace';
import { INITIAL_KANBAN_CHAT } from '../constants/chat';
import { INTENTS, ARCHIVED_RESOLUTION } from '../constants/intents';

const arraysEqual = (a = [], b = []) => a.length === b.length && a.every((value, index) => value === b[index]);

export function AppContainer() {
        const {
                workspace,
                activeProject,
                activeProjectId,
                data,
                worldInfo,
                kanbanChatLog,
                replaceKanbanChatLog,
                worldChatLog,
                replaceWorldChatLog,
                chatLogsRef,
                appendChat,
                updateActiveProjectData,
                intentLog,
                recordIntentDecision,
                logDebugEvent,
        } = useWorkspace();

        const [dragId, setDragId] = useState(null);
        const [edit, setEdit] = useState(null);
        const [view, setView] = useState(
                data.board?.view || data.board?.defaultView || DEFAULT_BOARD_CONFIG.defaultViewMode || 'board',
        );
        const [swimlaneStrategy, setSwimlaneStrategy] = useState(
                data.board?.swimlanes?.defaultStrategy || DEFAULT_BOARD_CONFIG.swimlaneStrategy,
        );
        const [quickFilters, setQuickFilters] = useState(data.board?.filters?.quick || []);
        const [searchText, setSearchText] = useState(data.board?.filters?.searchText || '');
        const [appMode, setAppMode] = useState(APP_MODES.KANBAN);

        const [projectFlow, setProjectFlow] = useState(createProjectFlowContext());
        const [preResetSnapshot, setPreResetSnapshot] = useState(null);
        const isAbortFlowActive = projectFlow.state !== PROJECT_FLOW_STATES.KANBAN_ACTIVE;

        const [showResetConfirm, setShowResetConfirm] = useState(false);
        const [showClearTasksConfirm, setShowClearTasksConfirm] = useState(false);
        const [showAddTaskModal, setShowAddTaskModal] = useState(false);
        const [message, setMessage] = useState(null);
        const [taskToDelete, setTaskToDelete] = useState(null);
        const [pendingTaskCreation, setPendingTaskCreation] = useState(null);
        const [intentNotice, setIntentNotice] = useState(null);
        const [abortRequestContext, setAbortRequestContext] = useState(null);
        const [worldInfoEntryContext, setWorldInfoEntryContext] = useState(null);

        const [apiKey] = useState(initialApiKey);
        const [isAiThinking, setIsAiThinking] = useState(false);

        const inputRef = useRef(null);

        const dispatchProjectFlow = useCallback((type, payload = {}) => {
                setProjectFlow((previous) => reduceProjectFlow(previous, { type, payload }));
        }, []);

        const beginProjectAbortFlow = useCallback(
                (context = {}) => {
                        if (appMode === APP_MODES.WORLD_INFO_SETUP || isAbortFlowActive) return;
                        const metadata = { ...context, requestedAt: nowISO() };
                        setAbortRequestContext(metadata);
                        dispatchProjectFlow(
                                PROJECT_FLOW_EVENTS.REQUEST_ABORT,
                                { metadata: { requestContext: metadata } },
                        );
                        setShowResetConfirm(true);
                        logDebugEvent({
                                event: 'project-reset:requested',
                                mode: appMode,
                                source: metadata.source || 'unknown',
                        });
                },
                [appMode, dispatchProjectFlow, isAbortFlowActive, logDebugEvent],
        );

        const handleResetModalClose = useCallback(() => {
                setShowResetConfirm(false);
                dispatchProjectFlow(PROJECT_FLOW_EVENTS.CANCEL_ABORT);
                setAbortRequestContext(null);
                setIntentNotice(null);
        }, [dispatchProjectFlow, setAbortRequestContext, setIntentNotice]);

        const toggleQuickFilter = useCallback((filterId) => {
                setQuickFilters((previous) =>
                        previous.includes(filterId)
                                ? previous.filter((item) => item !== filterId)
                                : [...previous, filterId],
                );
        }, []);

        const handleSearchChange = useCallback((value) => {
                setSearchText(value);
        }, []);

        const handleSwimlaneChange = useCallback((value) => {
                setSwimlaneStrategy(value);
        }, []);

        const handleViewChange = useCallback((nextView) => {
                const allowedViews = [...BOARD_VIEW_MODES.map((mode) => mode.value), 'cfd', 'burndown'];
                if (allowedViews.includes(nextView)) {
                        setView(nextView);
                }
        }, []);

        useEffect(() => {
                const targetView = data.board?.view || data.board?.defaultView || DEFAULT_BOARD_CONFIG.defaultViewMode || 'board';
                setView((previous) => (previous === targetView ? previous : targetView));
                setSwimlaneStrategy(
                        data.board?.swimlanes?.defaultStrategy || DEFAULT_BOARD_CONFIG.swimlaneStrategy,
                );
                setQuickFilters(data.board?.filters?.quick || []);
                setSearchText(data.board?.filters?.searchText || '');
        }, [data.board]);

        useEffect(() => {
                updateActiveProjectData((previous) => {
                        const next = clone(previous);
                        next.board = next.board || {};
                        const filters = next.board.filters || {};
                        const swimlanes = next.board.swimlanes || {};
                        let changed = false;

                        if (!arraysEqual(filters.quick || [], quickFilters) || (filters.searchText || '') !== searchText) {
                                next.board.filters = { ...filters, quick: quickFilters, searchText };
                                changed = true;
                        }

                        if ((swimlanes.defaultStrategy || DEFAULT_BOARD_CONFIG.swimlaneStrategy) !== swimlaneStrategy) {
                                next.board.swimlanes = { ...swimlanes, defaultStrategy: swimlaneStrategy };
                                changed = true;
                        }

                        if ((next.board.view || DEFAULT_BOARD_CONFIG.defaultViewMode) !== view) {
                                next.board.view = view;
                                changed = true;
                        }

                        if (!changed) return previous;
                        next.board.last_update = nowISO();
                        return next;
                });
        }, [quickFilters, searchText, swimlaneStrategy, view, updateActiveProjectData]);

        const boardModel = useMemo(
                () =>
                        buildBoardModel({
                                board: data.board,
                                tasks: data.tasks,
                                members: data.members,
                                searchText,
                                activeQuickFilters: quickFilters,
                                swimlaneStrategy,
                                currentUser: workspace.currentUserId || null,
                        }),
                [data.board, data.tasks, data.members, searchText, quickFilters, swimlaneStrategy, workspace.currentUserId],
        );
        const metrics = useMemo(() => computeMetrics(data), [data]);
        const cfdData = useMemo(() => calculateCfdData(data), [data]);
        const burndownData = useMemo(() => calculateBurndownData(data), [data]);

        function handleDrop({ status, subStatus = null, lane }) {
                if (appMode === APP_MODES.WORLD_INFO_SETUP) return;
                if (!dragId) return;

                const outcome = { updated: false, error: null };

                updateActiveProjectData(
                        (draft) => {
                                const task = draft.tasks.find((item) => item.id === dragId);
                                if (!task) {
                                        outcome.error = '未找到对应任务，拖拽被忽略。';
                                        return null;
                                }

                                const fromStatus = task.status;
                                const fromSubStatus = task.subStatus || null;
                                const toStatus = status;

                                if (fromStatus === toStatus && fromSubStatus === (subStatus || null)) {
                                        return null;
                                }

                                try {
                                        enforceLinearWorkflow(task, toStatus);
                                } catch (error) {
                                        outcome.error = error.message;
                                        return null;
                                }

                                task.status = toStatus;
                                task.subStatus = subStatus || null;

                                if (lane?.field) {
                                        applyLaneFieldUpdate(task, lane);
                                }

                                if (toStatus === 'To Do') {
                                        task.started_at = undefined;
                                        task.finished_at = undefined;
                                        task.block_reason = null;
                                } else if (['Designing', 'In Progress', 'Code Review', 'QA'].includes(toStatus)) {
                                        if (!task.started_at) task.started_at = nowISO();
                                        task.finished_at = undefined;
                                } else if (toStatus === 'Done') {
                                        if (!task.finished_at) task.finished_at = nowISO();
                                        task.block_reason = null;
                                }

                                draft.events = draft.events || [];
                                draft.events.push({
                                        id: `e-${(draft.events.length || 0) + 1}`,
                                        time: nowISO(),
                                        type: 'move',
                                        task_id: task.id,
                                        from: fromStatus,
                                        to: toStatus,
                                        meta: { subStatus: subStatus || null },
                                        user: 'human',
                                });
                                draft.board.last_update = nowISO();
                                outcome.updated = true;
                                return draft;
                        },
                        { reason: 'drag-drop', taskId: dragId, toStatus: status, lane: lane?.field || null },
                );

                if (outcome.error) {
                        logDebugEvent({
                                event: 'drag-drop:error',
                                taskId: dragId,
                                message: outcome.error,
                        });
                        setMessage({ title: '流程警告', body: outcome.error, type: 'error' });
                        return;
                }

                if (outcome.updated) {
                        logDebugEvent({
                                event: 'drag-drop:completed',
                                taskId: dragId,
                                toStatus: status,
                                lane: lane?.field || null,
                        });
                        setDragId(null);
                }
        }

        function applyLaneFieldUpdate(task, lane) {
                // Logic Audit · 逻辑审计：跨泳道拖拽目前只同步一个字段（module/priority/type/assignee）。
                // 多责任人泳道仍以复制方式呈现，如需保持多选，需要在后续版本扩展 lane 元数据与本地更新策略。
                switch (lane.field) {
                        case 'module': {
                                task.module = lane.value || null;
                                break;
                        }
                        case 'priority': {
                                task.priority = lane.value || null;
                                break;
                        }
                        case 'type': {
                                task.type = lane.value || (task.level || task.type || 'Task');
                                task.level = task.type;
                                break;
                        }
                        case 'assignees': {
                                if (lane.value) {
                                        task.assignees = [lane.value];
                                } else {
                                        task.assignees = [];
                                }
                                break;
                        }
                        default:
                                break;
                }
        }

        function openAddTaskModal() {
                if (appMode === APP_MODES.WORLD_INFO_SETUP) return;
                setShowAddTaskModal(true);
        }

        function clearAllTasks() {
                if (appMode === APP_MODES.WORLD_INFO_SETUP) return;
                setShowClearTasksConfirm(true);
        }

        function handleClearTasksConfirm() {
                updateActiveProjectData(
                        (draft) => {
                                draft.tasks = [];
                                draft.events = draft.events || [];
                                draft.events.push({
                                        id: `e-${(draft.events.length || 0) + 1}`,
                                        time: nowISO(),
                                        type: 'clear_all_tasks',
                                        user: 'human',
                                        notes: '所有任务被手动清空',
                                });
                                draft.board.last_update = nowISO();
                                return draft;
                        },
                        { reason: 'clear-all-tasks' },
                );
                setShowClearTasksConfirm(false);
                setMessage({ title: '清空成功', body: '看板任务已全部清空，项目配置和成员信息已保留。', type: 'success' });
        }

        function importJSON(event) {
                const file = event.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                        try {
                                const parsed = JSON.parse(reader.result);
                                if (!parsed.board) parsed.board = clone(DEFAULT_DATA.board);
                                if (!parsed.board.columns) parsed.board.columns = clone(DEFAULT_DATA.board.columns);
                                if (!Array.isArray(parsed.tasks)) parsed.tasks = [];
                                if (!Array.isArray(parsed.members)) parsed.members = clone(DEFAULT_DATA.members);
                                if (!parsed.worldInfo) parsed.worldInfo = clone(DEFAULT_DATA.worldInfo);
                                parsed.board.last_update = nowISO();
                                updateActiveProjectData(() => clone(parsed), {
                                        reason: 'import-json',
                                        fileName: file.name,
                                });
                        } catch (error) {
                                setMessage({ title: 'JSON 导入错误', body: 'JSON 解析失败：' + error.message, type: 'error' });
                        }
                };
                reader.readAsText(file);
                event.target.value = '';
        }

        function exportFile(name, content, mimeType = 'application/json') {
                const blob = new Blob([content], { type: mimeType });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = name;
                anchor.click();
                URL.revokeObjectURL(url);
        }

        const handleBoardExport = useCallback(
                (format = 'json') => {
                        if (format === 'csv') {
                                const headers = ['ID', 'Title', 'Status', 'Priority', 'Assignees', 'Due', 'Module', 'Type', 'Points'];
                                const rows = (data.tasks || []).map((task) => {
                                        const assignees = getAssigneeList(task).join(' | ');
                                        const values = [
                                                task.id,
                                                task.title,
                                                task.status,
                                                task.priority || '',
                                                assignees,
                                                task.due_at ? fmt(task.due_at) : '',
                                                task.module || '',
                                                task.type || '',
                                                getTaskPoints(task.level),
                                        ];
                                        return values
                                                .map((value) => (value ?? '').toString().replace(/"/g, '""'))
                                                .map((value) => `"${value}"`)
                                                .join(',');
                                });
                                const csv = [headers.join(','), ...rows].join('\n');
                                exportFile(`kanban-board-${Date.now()}.csv`, csv, 'text/csv;charset=utf-8;');
                                return;
                        }

                        const payload = {
                                worldInfo,
                                board: data.board,
                                tasks: data.tasks,
                                members: data.members,
                                metrics: metrics,
                        };
                        exportFile(
                                `kanban-board-${Date.now()}.json`,
                                JSON.stringify(payload, null, 2),
                                'application/json',
                        );
                },
                [data.board, data.members, data.tasks, metrics, worldInfo],
        );

        function exportBoard() {
                handleBoardExport('json');
        }

        function exportChatLog() {
                exportFile('chat_log.json', JSON.stringify(chatLogsRef.current, null, 2));
        }

        function resetAll() {
                beginProjectAbortFlow({ source: 'manualResetButton' });
        }

        const setWorldInfo = useCallback(
                (newWorldPatch) => {
                        updateActiveProjectData((previous) => applyWorldPatch(previous, newWorldPatch));
                },
                [updateActiveProjectData],
        );

        function handleResetConfirm() {
                const snapshot = {
                        data: clone(data),
                        kanbanChat: [...(chatLogsRef.current.kanban || [])],
                        worldChat: [...(chatLogsRef.current.world || [])],
                };
                setPreResetSnapshot(snapshot);

                const entryContext = abortRequestContext
                        ? abortRequestContext
                        : { source: 'manualReset', requestedAt: nowISO() };
                setWorldInfoEntryContext(entryContext);

                dispatchProjectFlow(
                        PROJECT_FLOW_EVENTS.CONFIRM_ABORT,
                        {
                                metadata: {
                                        preResetSummary: {
                                                title: data.worldInfo?.projectName || '未命名项目',
                                                taskCount: data.tasks?.length || 0,
                                                capturedAt: nowISO(),
                                        },
                                },
                        },
                );

                updateActiveProjectData(() => {
                        const blank = clone(DEFAULT_DATA);
                        blank.tasks = [];
                        blank.events = [];
                        blank.worldInfo = {};
                        blank.board.last_update = nowISO();
                        return blank;
                });

                // Logic Audit · 逻辑审计：此处重置世界信息为 `{}`，默认假设世界信息 Agent 会在下一步完整填充。
                // 如果未来支持“取消配置但保留部分旧信息”，需要在状态机中添加分支以避免直接清空。

                replaceKanbanChatLog(INITIAL_KANBAN_CHAT, { reason: 'project-reset:init-kanban-chat' });
                replaceWorldChatLog([], { reason: 'project-reset:clear-world-chat' });
                setPendingTaskCreation(null);
                setIntentNotice(null);

                const isClassifierNewProject = entryContext?.source === 'classifier:new_project';
                const messageTitle = isClassifierNewProject ? '开启新项目配置' : '进入世界信息配置';
                const messageBody = isClassifierNewProject
                        ? `检测到你想启动新项目。${entryContext?.classifierMeta?.reason || '已保存旧项目快照，准备引导新的世界信息。'}`
                        : '已保存旧项目快照，请重新填写新项目的世界信息，以便看板 AI 接管。';

                setMessage({
                        title: messageTitle,
                        body: messageBody,
                        type: 'info',
                });

                setAppMode(APP_MODES.WORLD_INFO_SETUP);
                setShowResetConfirm(false);
                setAbortRequestContext(null);
                logDebugEvent({
                        event: 'project-reset:confirmed',
                        previousTaskCount: data.tasks?.length || 0,
                        entrySource: entryContext?.source || 'manual',
                });
        }

        const enterWorldInfoSetup = useCallback(
                (context = {}) => {
                        const metadata = { ...context };
                        if (!metadata.requestedAt) metadata.requestedAt = nowISO();
                        setWorldInfoEntryContext(metadata);
                        setAppMode(APP_MODES.WORLD_INFO_SETUP);
                        logDebugEvent({
                                event: 'world-info:entered',
                                source: metadata.source || 'manual',
                                previewCount: metadata.previewCount || 0,
                        });
                },
                [logDebugEvent, setAppMode, setWorldInfoEntryContext],
        );

        const processKanbanPatchResponse = useCallback(
                ({ baseData, patchInstructions, source = 'kanban', onNoNewTasksApplied }) => {
                        if (!Array.isArray(patchInstructions) || patchInstructions.length === 0) {
                                setPendingTaskCreation(null);
                                return { previewCount: 0 };
                        }

                        // Logic Audit · 逻辑审计：目前默认“仅新增任务时才触发世界信息补写”。
                        // 如果未来允许 AI 在没有新增任务的情况下也要求补写世界信息，需要调整此处的条件与 UI 提示。

                        const normalizedPatches = patchInstructions.map((patch) => {
                                if (patch?.type === 'task_add' && patch.details) {
                                        return {
                                                ...patch,
                                                details: {
                                                        ...patch.details,
                                                        id:
                                                                patch.details.id ||
                                                                `t-${Math.random().toString(36).slice(2, 8)}`,
                                                        status: patch.details.status || 'To Do',
                                                        created_at: patch.details.created_at || nowISO(),
                                                },
                                        };
                                }
                                return patch;
                        });

                        const previewTasks = normalizedPatches
                                .filter((patch) => patch.type === 'task_add' && patch.details)
                                .map((patch) => patch.details);

                        if (previewTasks.length === 0) {
                                updateActiveProjectData(
                                        (draft) => applyPatch(draft, normalizedPatches),
                                        { reason: 'ai-patch:auto-apply', source },
                                );
                                setPendingTaskCreation(null);
                                if (typeof onNoNewTasksApplied === 'function') {
                                        onNoNewTasksApplied();
                                }
                                return { previewCount: 0 };
                        }

                        setPendingTaskCreation({
                                baseData,
                                patches: normalizedPatches,
                                previewTasks,
                                source,
                        });

                        return { previewCount: previewTasks.length };
                },
                [updateActiveProjectData],
        );

        const handleWorldInfoAbort = useCallback(() => {
                dispatchProjectFlow(PROJECT_FLOW_EVENTS.CANCEL_ABORT);
                if (preResetSnapshot) {
                        updateActiveProjectData(() => clone(preResetSnapshot.data), {
                                reason: 'project-reset:restore-data',
                        });
                        replaceKanbanChatLog(
                                preResetSnapshot.kanbanChat && preResetSnapshot.kanbanChat.length
                                        ? preResetSnapshot.kanbanChat
                                        : INITIAL_KANBAN_CHAT,
                                { reason: 'project-reset:restore-kanban-chat' },
                        );
                        replaceWorldChatLog(preResetSnapshot.worldChat || [], {
                                reason: 'project-reset:restore-world-chat',
                        });
                }
                setPreResetSnapshot(null);
                setAppMode(APP_MODES.KANBAN);
                setWorldInfoEntryContext(null);
                setAbortRequestContext(null);
                setIntentNotice(null);
                setMessage({ title: '已取消项目重置', body: '已恢复到之前的项目状态。', type: 'info' });
                logDebugEvent({ event: 'project-reset:aborted', restoredSnapshot: Boolean(preResetSnapshot) });
                // Logic Audit · 逻辑审计：当存在多项目快照时，仅恢复 `preResetSnapshot`，后续需要与正式归档/恢复机制打通。
        }, [
                dispatchProjectFlow,
                preResetSnapshot,
                updateActiveProjectData,
                replaceKanbanChatLog,
                replaceWorldChatLog,
                setAppMode,
                setMessage,
                setWorldInfoEntryContext,
                setAbortRequestContext,
                setIntentNotice,
                logDebugEvent,
        ]);

        const kickoffKanbanAfterWorldInfo = useCallback(
                async ({ worldPatch, entryContext }) => {
                        const baseBoard = worldPatch ? applyWorldPatch(clone(data), worldPatch) : clone(data);
                        const worldHistory = (chatLogsRef.current.world || [])
                                .map((message) => `[${message.role}]: ${message.text}`)
                                .join('\n');
                        const friendlyWorldHistory = worldHistory || '（本次配置之前没有对话记录）';

                        const introPrefix = (() => {
                                if (entryContext?.source === 'classifier:new_project') {
                                        return '系统：已根据你的请求启动全新项目，并完成世界信息初始化。';
                                }
                                if (entryContext?.source === 'ai_task_follow_up') {
                                        return '系统：AI 新增任务后已补充世界信息，现在回到看板界面。';
                                }
                                if (entryContext?.source === 'manualEntry') {
                                        return '系统：世界信息更新完成。';
                                }
                                return '系统：世界信息配置流程结束。';
                        })();

                        const kickoffMessage = {
                                role: 'system',
                                text: `${introPrefix}请确认是否需要我帮忙规划初始任务，或自行安排看板。`,
                                time: new Date().toLocaleTimeString(),
                        };

                        await new Promise((resolve) => setTimeout(resolve, 0));
                        appendChat(kickoffMessage, APP_MODES.KANBAN);

                        if (!apiKey) {
                                setMessage({
                                        title: '需要手动继续',
                                        body: '世界信息已更新，但尚未配置 API Key。请手动与看板 AI 对话或完成 API Key 配置后再试。',
                                        type: 'info',
                                });
                                return;
                        }

                        setIsAiThinking(true);

                        try {
                                const prompt = `
                                        【世界信息 World Info】:
                                        ${JSON.stringify(baseBoard.worldInfo || {}, null, 2)}
                                        ---
                                        【世界信息配置对话记录】:
                                        ${friendlyWorldHistory}
                                        ---
                                        【当前看板状态】:
                                        ${JSON.stringify(baseBoard, null, 2)}
                                        ---
                                        现在世界信息已更新，请你执行以下要求：
                                        1. 以专业且亲切的语气欢迎用户回到看板，并确认是否需要由你来草拟初始看板，或由用户手动创建任务。
                                        2. 简要复述世界信息中的项目目标、里程碑或模块信息，提醒用户模块列表（moduleList）可用于标记并行的任务块。
                                        3. 本回合请不要主动修改看板，也不要新增任务。请让 patch_instructions 返回一个空数组。
                                        4. 提醒用户：只有在用户明确要求时，才会进入自动拆分任务流程。
                                        5. 如果用户提到希望查看旧项目或切换项目，请礼貌说明需要通过轻量判定流程触发。
                                        6. ai_response 面向用户，保持中英混合友好语气；patch_instructions 若为空，请返回 []。
                                        `;

                                const kickoffResponse = await generatePatch(apiKey, APP_MODES.KANBAN, prompt);

                                appendChat(
                                        {
                                                role: 'ai',
                                                text: kickoffResponse.ai_response || '（AI 未返回欢迎语）',
                                                time: new Date().toLocaleTimeString(),
                                        },
                                        APP_MODES.KANBAN,
                                );

                                processKanbanPatchResponse({
                                        baseData: baseBoard,
                                        patchInstructions: kickoffResponse.patch_instructions,
                                        source: 'world_info_kickoff',
                                        onNoNewTasksApplied: () => {
                                                if (
                                                        Array.isArray(kickoffResponse.patch_instructions) &&
                                                        kickoffResponse.patch_instructions.length > 0
                                                ) {
                                                        setMessage({
                                                                title: 'AI 调整已同步',
                                                                body: '看板 AI 在欢迎流程中返回了结构化调整，已自动应用。',
                                                                type: 'info',
                                                        });
                                                }
                                        },
                                });
                        } catch (error) {
                                console.error('[CONSOLE_ERROR] Kanban kickoff failed:', error);
                                setMessage({
                                        title: '看板初始化失败',
                                        body: '尝试让看板 AI 接管新项目时出错，请手动发送指令或稍后再试。',
                                        type: 'error',
                                });
                        } finally {
                                setIsAiThinking(false);
                        }
                },
                [apiKey, appendChat, chatLogsRef, data, processKanbanPatchResponse, setMessage],
        );

        const handleWorldInfoComplete = useCallback(
                (result) => {
                        dispatchProjectFlow(
                                PROJECT_FLOW_EVENTS.WORLD_INFO_COMPLETE,
                                {
                                        metadata: {
                                                newProjectName: result?.worldPatch?.projectName,
                                                completedAt: nowISO(),
                                        },
                                },
                        );
                        setAppMode(APP_MODES.KANBAN);
                        setMessage({
                                title: '新项目准备完成',
                                body: result?.worldPatch?.projectName
                                        ? `世界信息配置完成：${result.worldPatch.projectName}。要不要我来规划第一批任务？`
                                        : '世界信息配置完成，开始新的看板对话吧！',
                                type: 'success',
                        });
                        replaceKanbanChatLog(INITIAL_KANBAN_CHAT, {
                                reason: 'world-info-complete:seed-kanban-chat',
                        });
                        setPreResetSnapshot(null);
                        setWorldInfoEntryContext(null);
                        setAbortRequestContext(null);
                        setIntentNotice(null);
                        dispatchProjectFlow(PROJECT_FLOW_EVENTS.RETURN_TO_KANBAN);
                        logDebugEvent({
                                event: 'world-info:completed',
                                projectName: result?.worldPatch?.projectName || null,
                        });

                        // Logic Audit · 逻辑审计：假设世界信息 Agent 会返回 `worldPatch`，若为空则沿用当前 data。
                        // 后续需结合 prompt 版本管理，避免因 prompt 失效导致看板接管缺乏上下文。

                        kickoffKanbanAfterWorldInfo({
                                worldPatch: result?.worldPatch,
                                entryContext: worldInfoEntryContext,
                        });
                },
                [
                        dispatchProjectFlow,
                        kickoffKanbanAfterWorldInfo,
                        setAppMode,
                        setMessage,
                        replaceKanbanChatLog,
                        setWorldInfoEntryContext,
                        setAbortRequestContext,
                        setIntentNotice,
                        logDebugEvent,
                        worldInfoEntryContext,
                ],
        );

        function handleDeleteTask(task) {
                setEdit(null);
                setTaskToDelete(task);
        }

        function handleDeleteTaskConfirm() {
                if (!taskToDelete) return;
                updateActiveProjectData(
                        (draft) => {
                                if (!draft.tasks.some((task) => task.id === taskToDelete.id)) {
                                        return null;
                                }
                                draft.tasks = draft.tasks.filter((task) => task.id !== taskToDelete.id);
                                draft.events = draft.events || [];
                                draft.events.push({
                                        id: `e-${(draft.events.length || 0) + 1}`,
                                        time: nowISO(),
                                        type: 'delete',
                                        task_id: taskToDelete.id,
                                        user: 'human',
                                        title: taskToDelete.title,
                                });
                                draft.board.last_update = nowISO();
                                return draft;
                        },
                        { reason: 'delete-task', taskId: taskToDelete.id },
                );
                setTaskToDelete(null);
                // Logic Audit · 逻辑审计：删除任务后没有回退机制，后续需要在补丁协议与本地 UI 中引入“撤销/回收站”能力。
        }

        function handleAddTaskSubmit(payload) {
                if (!payload || !payload.title) return;
                const id = `t-${Math.random().toString(36).slice(2, 8)}`;
                const createdAt = nowISO();
                const dueAt = payload.due_at ? toUtcIso(payload.due_at) : undefined;
                const status = payload.status || 'To Do';
                const assignees = Array.isArray(payload.assignees) ? payload.assignees : [];
                const tags = Array.isArray(payload.tags) ? payload.tags : [];

                const newTask = {
                        id,
                        title: payload.title.trim(),
                        description: payload.description || '',
                        status,
                        subStatus: payload.subStatus || null,
                        module: payload.module || '未分配模块',
                        type: payload.type || 'Task',
                        level: payload.type || 'Task',
                        priority: payload.priority || 'Medium',
                        assignees,
                        owner: assignees,
                        created_at: createdAt,
                        started_at: status === 'To Do' ? undefined : createdAt,
                        finished_at: status === 'Done' ? createdAt : undefined,
                        due_at: dueAt,
                        depends_on: [],
                        checklist: [],
                        attachments: [],
                        comments: [],
                        tags,
                };

                updateActiveProjectData(
                        (draft) => {
                                draft.tasks = draft.tasks || [];
                                draft.tasks.push(newTask);
                                draft.events = draft.events || [];
                                draft.events.push({
                                        id: `e-${(draft.events.length || 0) + 1}`,
                                        time: nowISO(),
                                        type: 'new',
                                        task_id: id,
                                        user: 'human',
                                });
                                draft.board.last_update = nowISO();
                                return draft;
                        },
                        { reason: 'manual-add-task', taskId: id },
                );
                setShowAddTaskModal(false);
        }

        function onEditSave(payload) {
                if (!payload || !edit) return;
                updateActiveProjectData(
                        (draft) => {
                                const task = draft.tasks.find((item) => item.id === edit.id);
                                if (!task) return null;

                                task.title = payload.title;
                                task.description = payload.description;
                                task.module = payload.module || undefined;
                                task.status = payload.status;
                                task.subStatus = payload.subStatus || null;
                                task.type = payload.type || task.type;
                                task.level = payload.level || payload.type || task.level || 'Task';
                                task.priority = payload.priority || 'Medium';
                                task.assignees = Array.isArray(payload.assignees) ? payload.assignees : [];
                                task.owner = task.assignees;
                                task.tags = payload.tags;
                                task.depends_on = payload.depends_on;
                                task.block_reason = payload.block_reason || undefined;
                                task.checklist = payload.checklist;

                                const saveDate = (value, fallback) => (value ? toUtcIso(value) : fallback);
                                task.created_at = saveDate(payload.created_at, task.created_at);
                                task.started_at = saveDate(payload.started_at, task.started_at);
                                task.finished_at = saveDate(payload.finished_at, task.finished_at);
                                task.due_at = saveDate(payload.due_at, task.due_at);

                                if (task.status === 'To Do') {
                                        task.started_at = undefined;
                                        task.finished_at = undefined;
                                } else if (['Designing', 'In Progress', 'Code Review', 'QA'].includes(task.status)) {
                                        if (!task.started_at) task.started_at = nowISO();
                                        task.finished_at = undefined;
                                } else if (task.status === 'Done' && !task.finished_at) {
                                        task.finished_at = nowISO();
                                }

                                draft.events = draft.events || [];
                                draft.events.push({
                                        id: `e-${(draft.events.length || 0) + 1}`,
                                        time: nowISO(),
                                        type: 'update',
                                        task_id: task.id,
                                        user: 'human',
                                });
                                draft.board.last_update = nowISO();
                                return draft;
                        },
                        { reason: 'manual-edit-task', taskId: edit.id },
                );
                setEdit(null);
        }

        async function sendMsg() {
                if (appMode !== APP_MODES.KANBAN) return;

                const text = (inputRef.current?.value || '').trim();
                if (!text || isAiThinking) return;

                if (!apiKey) {
                        setMessage({ title: 'API Key 缺失', body: '请在 App.jsx 文件中配置 DeepSeek API 密钥。', type: 'error' });
                        return;
                }

                const timestamp = new Date().toLocaleTimeString();
                const userMessage = { role: 'user', text, time: timestamp };
                const nextKanbanHistory = [...(chatLogsRef.current.kanban || []), userMessage];
                const worldChatHistory = chatLogsRef.current.world || [];

                appendChat(userMessage, APP_MODES.KANBAN);
                inputRef.current.value = '';
                setIsAiThinking(true);

                try {
                        const archivedSummaries = Object.values(workspace.archivedProjects || {}).map((project) => ({
                                id: project.id,
                                title: project.title,
                                status: project.status,
                        }));
                        const classifierResult = await classifyIntent(apiKey, {
                                userInput: text,
                                currentProject: {
                                        id: activeProjectId,
                                        title: activeProject?.title || worldInfo?.projectName || '未命名项目',
                                        status: activeProject?.status || 'active',
                                },
                                worldInfo,
                                archivedProjects: archivedSummaries,
                                previousIntents: intentLog.slice(-5),
                        });

                        recordIntentDecision({
                                projectId: activeProjectId,
                                userInput: text,
                                ...classifierResult,
                        });

                        if (classifierResult.intent === INTENTS.NEW_PROJECT) {
                                setIntentNotice({
                                        type: 'new_project',
                                        message: classifierResult.reason || '轻量判定 Agent 判断需要创建新项目。',
                                        meta: classifierResult.meta,
                                });
                                beginProjectAbortFlow({
                                        source: 'classifier:new_project',
                                        userInput: text,
                                        classifierMeta: classifierResult,
                                });
                                return;
                        }

                        if (classifierResult.intent === INTENTS.ARCHIVED_PROJECT) {
                                setIntentNotice({
                                        type: 'archived_project',
                                        message: classifierResult.reason || '命令涉及旧项目，等待旧项目模块接管。',
                                        meta: classifierResult.meta,
                                });
                                const archivedMessage = classifierResult.meta?.archivedResolution === ARCHIVED_RESOLUTION.LIST
                                        ? '轻量判定 Agent 认为你想查看旧项目目录，该功能将在后续迭代中启用。'
                                        : '系统识别到旧项目相关指令，旧项目唤醒功能尚未完成。';
                                const confidenceText =
                                        typeof classifierResult.confidence === 'number'
                                                ? `\n分类置信度：${classifierResult.confidence.toFixed(2)}`
                                                : '';
                                setMessage({
                                        title: '旧项目功能开发中',
                                        body: archivedMessage + confidenceText,
                                        type: 'info',
                                });
                                return;
                        }

                        if (classifierResult.intent === INTENTS.UNKNOWN) {
                                setIntentNotice({
                                        type: 'unknown',
                                        message: classifierResult.reason || '判定结果不确定，暂按当前项目处理。',
                                        meta: classifierResult.meta,
                                });
                        } else {
                                setIntentNotice(null);
                        }

                        const insights = buildInsights(data);
                        const fullBoardState = clone(data);
                        const world = fullBoardState.worldInfo || {};
                        const chatHistory = nextKanbanHistory.map((m) => `[${m.role}]: ${m.text}`).join('\n');
                        const worldHistory = worldChatHistory.length
                                ? worldChatHistory.map((m) => `[${m.role}]: ${m.text}`).join('\n')
                                : '（暂无世界信息配置对话记录）';

                        const fullPrompt = `
                                【世界信息 World Info】: 这描述了项目的基本规则、目标和背景。
                                ${JSON.stringify(world, null, 2)}
                                ---
                                【世界信息配置对话记录】:
                                ${worldHistory}
                                ---
                                历史对话:\n${chatHistory}\n
                                ---
                                当前看板的健康状态分析（请参考此分析来识别风险，但只有在高风险时才主动建议）：\n${JSON.stringify(insights, null, 2)}\n\n
                                当前看板的完整 Board State (包含 tasks, members, columns)：\n${JSON.stringify(fullBoardState, null, 2)}\n\n
                                ---
                                用户指令：${text}`;

                        const parsedResponse = await generatePatch(apiKey, APP_MODES.KANBAN, fullPrompt);

                        appendChat(
                                {
                                        role: 'ai',
                                        text: parsedResponse.ai_response || '（AI 未返回回复文本）',
                                        time: new Date().toLocaleTimeString(),
                                },
                                APP_MODES.KANBAN,
                        );

                        const patches = parsedResponse.patch_instructions;
                        if (Array.isArray(patches) && patches.length > 0) {
                        processKanbanPatchResponse({
                                baseData: clone(data),
                                patchInstructions: patches,
                                source: 'kanban_chat',
                                onNoNewTasksApplied: () => {
                                        setMessage({
                                                title: 'AI 调整已同步',
                                                body: '已根据 AI 建议更新当前看板（未新增任务）。',
                                                type: 'success',
                                        });
                                },
                        });
                } else {
                        setPendingTaskCreation(null);
                }
                } catch (error) {
                        console.error('[CONSOLE_ERROR] AI API Error:', error);
                        const errorBody = error.message.includes('Authentication Failed')
                                ? 'DeepSeek API 认证失败，请检查您的密钥。'
                                : '调用 DeepSeek 服务时发生错误：' + (error.message || '未知错误');
                        setMessage({ title: 'AI 连接错误', body: errorBody, type: 'error' });
                } finally {
                        setIsAiThinking(false);
                }
        }

        const handleCardDragStart = useCallback((_, id) => setDragId(id), []);

        function handleConfirmAiTaskAdds() {
                if (!pendingTaskCreation) return;
                const { patches, previewTasks = [], source } = pendingTaskCreation;
                logDebugEvent({
                        event: 'ai-patch:accepted',
                        patchCount: patches?.length || 0,
                        previewCount: previewTasks.length,
                        source: source || 'kanban_chat',
                });
                updateActiveProjectData(
                        (draft) => applyPatch(draft, patches),
                        {
                                reason: 'ai-patch:confirmed',
                                source: source || 'kanban_chat',
                                previewCount: previewTasks.length,
                        },
                );
                setPendingTaskCreation(null);
                setMessage({
                        title: 'AI 新任务已添加',
                        body: '根据 AI 建议完成新任务创建，请继续在“项目世界信息设置”中补充上下文。',
                        type: 'success',
                });
                if (previewTasks.length > 0) {
                        const summary = previewTasks
                                .map((task) => `${task.title || '未命名任务'}（${task.level || 'Task'}）`)
                                .join('，');
                        appendChat(
                                {
                                        role: 'system',
                                        text: `看板 AI 已新增任务：${summary}。请在世界信息设置中补充这些任务的背景、依赖和优先级。`,
                                        time: new Date().toLocaleTimeString(),
                                },
                                APP_MODES.WORLD_INFO_SETUP,
                        );
                        // Logic Audit · 逻辑审计：这里强制跳转到世界信息配置。
                        // 如果未来允许直接接受任务而无需补充世界信息，需要新增用户确认分支。
                        enterWorldInfoSetup({
                                source: source || 'ai_task_follow_up',
                                previewCount: previewTasks.length,
                        });
                }
        }

        function handleCancelAiTaskAdds() {
                setPendingTaskCreation(null);
                setMessage({
                        title: '已取消 AI 新任务创建',
                        body: '已保留其他看板调整，未添加新的任务条目。',
                        type: 'info',
                });
        }

        return (
                <div className='h-screen flex flex-col bg-slate-50 font-sans'>
                        <AppHeader
                                appMode={appMode}
                                onImportJson={importJSON}
                                onExportBoard={exportBoard}
                                onExportChatLog={exportChatLog}
                                onEnterWorldInfo={() => enterWorldInfoSetup({ source: 'manualEntry' })}
                                onOpenAddTask={openAddTaskModal}
                                onClearTasks={clearAllTasks}
                                onResetAll={resetAll}
                        />

                        <div className='flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-4 p-4 overflow-auto'>
                                {appMode === APP_MODES.WORLD_INFO_SETUP ? (
                                        <WorldInfoSetup
                                                currentWorldInfo={worldInfo}
                                                setWorldInfo={setWorldInfo}
                                                isAiThinking={isAiThinking}
                                                setIsAiThinking={setIsAiThinking}
                                                apiKey={apiKey}
                                                setMessage={setMessage}
                                                worldChat={worldChatLog}
                                                appendChat={appendChat}
                                                inputRef={inputRef}
                                                onFlowAbort={handleWorldInfoAbort}
                                                onFlowComplete={handleWorldInfoComplete}
                                                entryContext={worldInfoEntryContext}
                                        />
                                ) : (
                                        <KanbanView
                                                kanbanChatLog={kanbanChatLog}
                                                isAiThinking={isAiThinking}
                                                apiKey={apiKey}
                                                inputRef={inputRef}
                                                onSendMessage={sendMsg}
                                                intentNotice={intentNotice}
                                                metrics={metrics}
                                                view={view}
                                                onChangeView={handleViewChange}
                                                boardModel={boardModel}
                                                board={data.board}
                                                tasks={data.tasks}
                                                members={data.members}
                                                onDropTask={handleDrop}
                                                onDragStart={handleCardDragStart}
                                                onEditTask={setEdit}
                                                getModuleColor={getModuleColor}
                                                getTaskPoints={getTaskPoints}
                                                fmt={fmt}
                                                cfdData={cfdData}
                                                burndownData={burndownData}
                                                quickFilters={quickFilters}
                                                onToggleQuickFilter={toggleQuickFilter}
                                                searchText={searchText}
                                                onSearchTextChange={handleSearchChange}
                                                swimlaneStrategy={swimlaneStrategy}
                                                onChangeSwimlane={handleSwimlaneChange}
                                                onExportBoard={handleBoardExport}
                                        />
                                )}
                        </div>

                        <AppFooter appMode={appMode} />

                        <EditTaskModal
                                task={edit}
                                columns={boardModel.columns}
                                members={data.members}
                                onClose={() => setEdit(null)}
                                onDelete={handleDeleteTask}
                                onSave={onEditSave}
                        />

                        {showResetConfirm && (
                                <ResetConfirmModal
                                        context={abortRequestContext}
                                        onClose={handleResetModalClose}
                                        onConfirm={handleResetConfirm}
                                />
                        )}

                        {showClearTasksConfirm && (
                                <ClearTasksConfirmModal onClose={() => setShowClearTasksConfirm(false)} onConfirm={handleClearTasksConfirm} />
                        )}

                        {taskToDelete && <DeleteConfirmModal task={taskToDelete} onClose={() => setTaskToDelete(null)} onConfirm={handleDeleteTaskConfirm} />}

                        {pendingTaskCreation && (
                                <AiTaskConfirmModal
                                        tasks={pendingTaskCreation.previewTasks}
                                        onConfirm={handleConfirmAiTaskAdds}
                                        onCancel={handleCancelAiTaskAdds}
                                />
                        )}

                        {showAddTaskModal && (
                                <AddTaskModal
                                        onClose={() => setShowAddTaskModal(false)}
                                        onSave={handleAddTaskSubmit}
                                        columns={boardModel.columns}
                                        members={data.members}
                                />
                        )}

                        {message && <MessageBox message={message} onClose={() => setMessage(null)} />}
                </div>
        );
}

export default AppContainer;
