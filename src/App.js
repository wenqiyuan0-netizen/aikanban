/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - Acts as the top-level orchestrator that wires workspace数据、聊天记录以及看板视图、世界信息配置等 UI 组件。
 * - Implements task CRUD、拖拽迁移、导入导出、以及与 AI 服务的异步交互（包括补丁生成与确认弹窗）。
 * - Manages本地状态（模态框、提示消息、正在思考标记等），同时复用 `useWorkspace` 钩子落地多项目存储骨架。
 *
 * Implementation Notes / 实现方式:
 * - 通过 `useWorkspace` 统一读取与更新当前项目数据，并追踪看板/世界信息双通道聊天。
 * - 使用 `useMemo` 与 `useCallback` 优化度量计算、列过滤、补丁应用等性能敏感逻辑。
 * - 借助多种模态组件（新增任务、编辑、删除确认、AI 任务确认等）完成用户操作闭环，并引入 `projectFlow` 状态机管理项目废弃/重启流。
 *
 * Pending / 未完成:
 * - 项目归档与旧项目恢复仍未实现（当前仅在内存中暂存快照）。
 * - 看板与世界信息聊天窗口的 UI 分离、美化、及多语言切换仍待实现。
 *
 * Next Steps / 后续计划:
 * - 将状态机与本地存储结合，真正归档旧项目并支持恢复/切换。
 * - 将世界信息 Agent 的结构化输出与看板初始提示对接，实现新项目的自动化接管流程。
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
        AddTaskModal,
        MessageBox,
        ResetConfirmModal,
        ClearTasksConfirmModal,
        DeleteConfirmModal,
        AiTaskConfirmModal,
} from './components/UIComponents';
import { WorldInfoSetup } from './components/WorldInfoSetup';
import { AppHeader } from './components/layout/AppHeader';
import { AppFooter } from './components/layout/AppFooter';
import { KanbanView } from './components/KanbanView';
import { EditTaskModal } from './components/EditTaskModal';
import { APP_MODES } from './app/constants/appModes';
import { getModuleColor } from './app/constants/colors';
import { getTaskPoints } from './app/constants/task';
import { DEFAULT_DATA } from './app/data/defaultData';
import { initialApiKey } from './app/config/apiConfig';
import { computeMetrics, buildInsights } from './app/logic/metrics';
import { calculateBurndownData, calculateCfdData } from './app/logic/charts';
import { applyPatch, enforceLinearWorkflow } from './app/logic/patches';
import { applyWorldPatch } from './app/logic/worldInfo';
import { PROJECT_FLOW_EVENTS, PROJECT_FLOW_STATES, createProjectFlowContext, reduceProjectFlow } from './app/logic/projectFlow';
import { classifyIntent, generatePatch } from './app/services/aiService';
import { clone } from './app/utils/clone';
import { nowISO, fmt, toUtcIso } from './app/utils/dateUtils';
import { useWorkspace } from './app/hooks/useWorkspace';
import { INITIAL_KANBAN_CHAT } from './app/constants/chat';
import { INTENTS, ARCHIVED_RESOLUTION } from './app/constants/intents';

export default function App() {
        const {
                workspace,
                activeProject,
                activeProjectId,
                data,
                worldInfo,
                kanbanChatLog,
                setKanbanChatLog,
                worldChatLog,
                setWorldChatLog,
                chatLogsRef,
                appendChat,
                updateActiveProjectData,
                intentLog,
                recordIntentDecision,
        } = useWorkspace();

        const [dragId, setDragId] = useState(null);
        const [edit, setEdit] = useState(null);
        const [view, setView] = useState('kanban');
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
                },
                [appMode, dispatchProjectFlow, isAbortFlowActive],
        );

        const handleResetModalClose = useCallback(() => {
                setShowResetConfirm(false);
                dispatchProjectFlow(PROJECT_FLOW_EVENTS.CANCEL_ABORT);
                setAbortRequestContext(null);
                setIntentNotice(null);
        }, [dispatchProjectFlow, setAbortRequestContext, setIntentNotice]);

        const columns = useMemo(() => {
                const cols = (data.board?.columns || [])
                        .filter((column) => column.name !== 'Blocked')
                        .slice()
                        .sort((a, b) => (a.order || 0) - (b.order || 0));
                return cols.length
                        ? cols
                        : [
                                        { id: 'todo', name: 'To Do' },
                                        { id: 'doing', name: 'In Progress' },
                                        { id: 'review', name: 'Review' },
                                        { id: 'done', name: 'Done' },
                          ];
        }, [data.board]);

        const byStatus = useCallback((status) => (data.tasks || []).filter((task) => task.status === status), [data.tasks]);
        const metrics = useMemo(() => computeMetrics(data), [data]);
        const cfdData = useMemo(() => calculateCfdData(data), [data]);
        const burndownData = useMemo(() => calculateBurndownData(data), [data]);

        function handleDrop(status) {
                if (appMode === APP_MODES.WORLD_INFO_SETUP) return;
                if (!dragId) return;

                const next = clone(data);
                const task = next.tasks.find((item) => item.id === dragId);
                if (!task) return;
                const fromStatus = task.status;
                const toStatus = status;

                if (fromStatus === toStatus) return;

                try {
                        enforceLinearWorkflow(task, toStatus);
                } catch (error) {
                        setMessage({ title: '流程警告', body: error.message, type: 'error' });
                        return;
                }

                task.status = toStatus;

                if (toStatus === 'To Do') {
                        task.started_at = undefined;
                        task.finished_at = undefined;
                        task.block_reason = null;
                } else if (toStatus === 'In Progress') {
                        if (!task.started_at) task.started_at = nowISO();
                        task.finished_at = undefined;
                } else if (toStatus === 'Review') {
                        task.finished_at = undefined;
                } else if (toStatus === 'Done') {
                        if (!task.finished_at) task.finished_at = nowISO();
                        task.block_reason = null;
                }

                next.events = next.events || [];
                next.events.push({
                        id: `e-${(next.events.length || 0) + 1}`,
                        time: nowISO(),
                        type: 'move',
                        task_id: task.id,
                        from: fromStatus,
                        to: toStatus,
                        user: 'human',
                });
                next.board.last_update = nowISO();
                updateActiveProjectData(next);
                setDragId(null);
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
                updateActiveProjectData((prevData) => {
                        const nextData = clone(prevData);
                        nextData.tasks = [];
                        nextData.events = nextData.events || [];
                        nextData.events.push({
                                id: `e-${(nextData.events.length || 0) + 1}`,
                                time: nowISO(),
                                type: 'clear_all_tasks',
                                user: 'human',
                                notes: '所有任务被手动清空',
                        });
                        nextData.board.last_update = nowISO();
                        return nextData;
                });
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
                                updateActiveProjectData(parsed);
                        } catch (error) {
                                setMessage({ title: 'JSON 导入错误', body: 'JSON 解析失败：' + error.message, type: 'error' });
                        }
                };
                reader.readAsText(file);
                event.target.value = '';
        }

        function exportFile(name, content) {
                const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = name;
                anchor.click();
                URL.revokeObjectURL(url);
        }

        function exportBoard() {
                exportFile('kanban.json', data);
        }

        function exportChatLog() {
                exportFile('chat_log.json', chatLogsRef.current);
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

                setKanbanChatLog(INITIAL_KANBAN_CHAT);
                setWorldChatLog([]);
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
        }

        const enterWorldInfoSetup = useCallback(
                (context = {}) => {
                        const metadata = { ...context };
                        if (!metadata.requestedAt) metadata.requestedAt = nowISO();
                        setWorldInfoEntryContext(metadata);
                        setAppMode(APP_MODES.WORLD_INFO_SETUP);
                },
                [setAppMode, setWorldInfoEntryContext],
        );

        const handleWorldInfoAbort = useCallback(() => {
                dispatchProjectFlow(PROJECT_FLOW_EVENTS.CANCEL_ABORT);
                if (preResetSnapshot) {
                        updateActiveProjectData(() => clone(preResetSnapshot.data));
                        setKanbanChatLog(
                                preResetSnapshot.kanbanChat && preResetSnapshot.kanbanChat.length
                                        ? preResetSnapshot.kanbanChat
                                        : INITIAL_KANBAN_CHAT,
                        );
                setWorldChatLog(preResetSnapshot.worldChat || []);
                }
                setPreResetSnapshot(null);
                setAppMode(APP_MODES.KANBAN);
                setWorldInfoEntryContext(null);
                setAbortRequestContext(null);
                setIntentNotice(null);
                setMessage({ title: '已取消项目重置', body: '已恢复到之前的项目状态。', type: 'info' });
        }, [
                dispatchProjectFlow,
                preResetSnapshot,
                updateActiveProjectData,
                setKanbanChatLog,
                setWorldChatLog,
                setAppMode,
                setMessage,
                setWorldInfoEntryContext,
                setAbortRequestContext,
                setIntentNotice,
        ]);

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
                        setKanbanChatLog(INITIAL_KANBAN_CHAT);
                        setPreResetSnapshot(null);
                        setWorldInfoEntryContext(null);
                        setAbortRequestContext(null);
                        setIntentNotice(null);
                        dispatchProjectFlow(PROJECT_FLOW_EVENTS.RETURN_TO_KANBAN);
                },
                [
                        dispatchProjectFlow,
                        setAppMode,
                        setMessage,
                        setKanbanChatLog,
                        setWorldInfoEntryContext,
                        setAbortRequestContext,
                        setIntentNotice,
                ],
        );

        function handleDeleteTask(task) {
                setEdit(null);
                setTaskToDelete(task);
        }

        function handleDeleteTaskConfirm() {
                if (!taskToDelete) return;
                const next = clone(data);
                next.tasks = next.tasks.filter((task) => task.id !== taskToDelete.id);
                next.events = next.events || [];
                next.events.push({
                        id: `e-${(next.events.length || 0) + 1}`,
                        time: nowISO(),
                        type: 'delete',
                        task_id: taskToDelete.id,
                        user: 'human',
                        title: taskToDelete.title,
                });
                next.board.last_update = nowISO();
                updateActiveProjectData(next);
                setTaskToDelete(null);
        }

        function handleAddTaskSubmit(title) {
                const next = clone(data);
                const id = `t-${Math.random().toString(36).slice(2, 8)}`;
                next.tasks.push({
                        id,
                        title,
                        status: 'To Do',
                        created_at: nowISO(),
                        owner: [],
                        module: 'DEFAULT',
                        level: 'Task',
                        depends_on: [],
                });
                next.events = next.events || [];
                next.events.push({
                        id: `e-${(next.events.length || 0) + 1}`,
                        time: nowISO(),
                        type: 'new',
                        task_id: id,
                        user: 'human',
                });
                next.board.last_update = nowISO();
                updateActiveProjectData(next);
                setShowAddTaskModal(false);
        }

        function onEditSave() {
                const form = document.getElementById('editForm');
                const fd = new FormData(form);
                const next = clone(data);
                const task = next.tasks.find((item) => item.id === edit.id);
                if (!task) return;

                const saveDate = (key) => toUtcIso(fd.get(key));

                task.title = fd.get('title');
                task.module = fd.get('module') || undefined;
                task.status = fd.get('status');
                task.level = fd.get('level') || 'Task';
                task.depends_on = (fd.get('depends_on') || '').split(',').map((s) => s.trim()).filter(Boolean);
                task.owner = (fd.get('owner') || '').split(',').map((s) => s.trim()).filter(Boolean);

                task.created_at = saveDate('created_at') || task.created_at;
                task.started_at = saveDate('started_at');
                task.finished_at = saveDate('finished_at');
                task.due_at = saveDate('due_at');

                const newBlockReason = fd.get('block_reason') || undefined;
                task.block_reason = newBlockReason;

                if (task.status === 'To Do') {
                        task.started_at = undefined;
                        task.finished_at = undefined;
                } else if (task.status === 'In Progress' || task.status === 'Review') {
                        task.finished_at = undefined;
                } else if (task.status === 'Done' && !task.finished_at) {
                        task.finished_at = nowISO();
                }

                next.events = next.events || [];
                next.events.push({
                        id: `e-${(next.events.length || 0) + 1}`,
                        time: nowISO(),
                        type: 'update',
                        task_id: task.id,
                        user: 'human',
                });
                next.board.last_update = nowISO();
                updateActiveProjectData(next);
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
                                const normalizedPatches = patches.map((patch) => {
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

                                const deferredPatches = normalizedPatches.filter((patch) => patch.type !== 'task_add');
                                const baseData = clone(data);
                                const previewTasks = normalizedPatches
                                        .filter((patch) => patch.type === 'task_add' && patch.details)
                                        .map((patch) => patch.details);

                                setPendingTaskCreation({
                                        baseData,
                                        patches: deferredPatches,
                                        previewTasks,
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
                const { baseData, patches, previewTasks = [] } = pendingTaskCreation;
                const dataWithNewTasks = applyPatch(baseData, patches);
                updateActiveProjectData(dataWithNewTasks);
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
                }
                enterWorldInfoSetup({ source: 'ai_task_follow_up', previewCount: previewTasks.length });
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
                                                onChangeView={setView}
                                                columns={columns}
                                                byStatus={byStatus}
                                                onDropTask={handleDrop}
                                                onDragStart={handleCardDragStart}
                                                onEditTask={setEdit}
                                                getModuleColor={getModuleColor}
                                                getTaskPoints={getTaskPoints}
                                                fmt={fmt}
                                                cfdData={cfdData}
                                                burndownData={burndownData}
                                        />
                                )}
                        </div>

                        <AppFooter appMode={appMode} />

                        <EditTaskModal task={edit} onClose={() => setEdit(null)} onDelete={handleDeleteTask} onSave={onEditSave} />

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

                        {showAddTaskModal && <AddTaskModal onClose={() => setShowAddTaskModal(false)} onSave={handleAddTaskSubmit} />}

                        {message && <MessageBox message={message} onClose={() => setMessage(null)} />}
                </div>
        );
}
