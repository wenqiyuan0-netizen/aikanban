import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, Area, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import {
        Column,
        Card,
        AddTaskModal,
        MessageBox,
        ResetConfirmModal,
        ClearTasksConfirmModal,
        DeleteConfirmModal,
        AiTaskConfirmModal,
} from './components/UIComponents';
import { WorldInfoSetup } from './components/WorldInfoSetup';
import { APP_MODES } from './app/constants/appModes';
import { getModuleColor, COLUMN_COLORS, COLUMN_ORDER } from './app/constants/colors';
import { getTaskPoints } from './app/constants/task';
import { DEFAULT_DATA } from './app/data/defaultData';
import { initialApiKey } from './app/config/apiConfig';
import { computeMetrics, buildInsights } from './app/logic/metrics';
import { calculateBurndownData, calculateCfdData } from './app/logic/charts';
import { applyPatch, enforceLinearWorkflow } from './app/logic/patches';
import { applyWorldPatch } from './app/logic/worldInfo';
import { loadWorkspace, saveWorkspace } from './app/storage/localStorage';
import { clone } from './app/utils/clone';
import { nowISO, fmt, toUtcIso } from './app/utils/dateUtils';
import { generatePatch } from './app/services/aiService';

const INITIAL_KANBAN_CHAT = [
        {
                role: 'system',
                text: 'AI-Agent 已连接，已升级为【增量补丁模式】。**Blocked 状态已移除**，请使用 `block_reason` 属性来标记任务阻塞。',
        },
];

/**
 * AI-Kanban 一体化网页（聊天 + 看板）
 * - 状态：已引入【appMode】状态机：'kanban' (看板操作) 和 'worldInfoSetup' (引导设置模式)。
 * - 智能洞察：新增【任务分级 (Epic/Story/Task)】、【WIP 时长预警】、【任务依赖关系】及【依赖阻塞预警】。
 * - Agent升级：发送完整看板数据，Agent 以“专业看板经理”身份决策，并接收【世界信息】。
 * - 核心：在 WorldInfoSetup 模式下，Agent 专注于【引导用户补全项目元数据】。
 * - **更新**：所有 size 相关的指标和图表计算均基于【任务点数 (Story Points)】。
 * * --- WARNING: API已切换至 DEEPSEEK (兼容OpenAI) ---
 */

export default function App() {
        const [workspace, setWorkspace] = useState(() => loadWorkspace());
        const activeProjectId = workspace.currentProjectId;
        const activeProject = workspace.projects[activeProjectId] || {
                id: activeProjectId,
                data: clone(DEFAULT_DATA),
                chat: { kanban: INITIAL_KANBAN_CHAT, world: [] },
        };
        const data = activeProject.data;
        const [dragId, setDragId] = useState(null);
        const [edit, setEdit] = useState(null);
        const [view, setView] = useState('kanban');
        const [appMode, setAppMode] = useState(APP_MODES.KANBAN);

        const [showResetConfirm, setShowResetConfirm] = useState(false);
        const [showClearTasksConfirm, setShowClearTasksConfirm] = useState(false);
        const [showAddTaskModal, setShowAddTaskModal] = useState(false);
        const [message, setMessage] = useState(null);
        const [taskToDelete, setTaskToDelete] = useState(null);

        const [apiKey] = useState(initialApiKey);
        const [isAiThinking, setIsAiThinking] = useState(false);

        const [kanbanChatLog, setKanbanChatLog] = useState(
                activeProject.chat?.kanban?.length ? activeProject.chat.kanban : INITIAL_KANBAN_CHAT,
        );
        const [worldChatLog, setWorldChatLog] = useState(activeProject.chat?.world || []);
        const chatLogsRef = useRef({ kanban: kanbanChatLog, world: worldChatLog });
        const inputRef = useRef(null);

        const worldInfo = data.worldInfo;

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

        const [pendingTaskCreation, setPendingTaskCreation] = useState(null);

        useEffect(() => {
                saveWorkspace(workspace);
        }, [workspace]);

        const updateActiveProjectData = useCallback(
                (updater) => {
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
                },
                [],
        );

        const setWorldInfo = (newWorldPatch) => {
                updateActiveProjectData((previous) => applyWorldPatch(previous, newWorldPatch));
        };

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

        const byStatus = (status) => (data.tasks || []).filter((task) => task.status === status);
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
                setShowResetConfirm(true);
        }

        function handleResetConfirm() {
                updateActiveProjectData(clone(DEFAULT_DATA));
                setKanbanChatLog(INITIAL_KANBAN_CHAT);
                setWorldChatLog([]);
                setAppMode(APP_MODES.KANBAN);
                setShowResetConfirm(false);
        }

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

                const userMessage = { role: 'user', text, time: new Date().toLocaleTimeString() };
                appendChat(userMessage, APP_MODES.KANBAN);
                inputRef.current.value = '';
                setIsAiThinking(true);

                try {
                        const kanbanChat = chatLogsRef.current.kanban || [];
                        const worldChat = chatLogsRef.current.world || [];
                        const insights = buildInsights(data);
                        const fullBoardState = clone(data);
                        const world = fullBoardState.worldInfo || {};
                        const chatHistory = [...kanbanChat, userMessage]
                                .map((m) => `[${m.role}]: ${m.text}`)
                                .join('\n');
                        const worldHistory = worldChat.length
                                ? worldChat.map((m) => `[${m.role}]: ${m.text}`).join('\n')
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
                                                                        `t-${Math.random().toString(36).slice(2, 8)}${Date.now()}`,
                                                        },
                                                };
                                        }
                                        return patch;
                                });

                                const newTaskIds = new Set();
                                const immediatePatches = [];
                                const deferredPatches = [];

                                normalizedPatches.forEach((patch) => {
                                        if (patch.type === 'task_add' && patch.details?.id) {
                                                newTaskIds.add(patch.details.id);
                                                deferredPatches.push(patch);
                                                return;
                                        }

                                        if (patch.type === 'task_update' && newTaskIds.has(patch.id)) {
                                                deferredPatches.push(patch);
                                                return;
                                        }

                                        if (patch.type === 'event_add' && newTaskIds.has(patch.details?.task_id)) {
                                                deferredPatches.push(patch);
                                                return;
                                        }

                                        immediatePatches.push(patch);
                                });

                                let baseData = data;
                                if (immediatePatches.length > 0) {
                                        baseData = applyPatch(data, immediatePatches);
                                        updateActiveProjectData(baseData);
                                }

                                if (deferredPatches.length > 0) {
                                        const previewTasks = deferredPatches
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

        const appendChat = useCallback((message, mode = APP_MODES.KANBAN) => {
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
        }, []);

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
                setAppMode(APP_MODES.WORLD_INFO_SETUP);
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
                        <header className='shrink-0 bg-white border-b shadow-md'>
                                <div className='max-w-7xl mx-auto px-4 py-2 flex items-center justify-between'>
                                        <div className='text-xl font-extrabold text-indigo-700'>AI-Kanban 一体化控制台</div>
                                        <div className='flex items-center gap-3 text-sm'>
                                                {appMode === APP_MODES.KANBAN && (
                                                        <>
                                                                <label className='text-gray-500 text-xs'>
                                                                        <input type='file' accept='application/json' onChange={importJSON} className='hidden' id='fileImport' />
                                                                        <button
                                                                                onClick={() => document.getElementById('fileImport').click()}
                                                                                className='px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition'
                                                                        >
                                                                                导入 JSON
                                                                        </button>
                                                                </label>
                                                                <button onClick={exportBoard} className='px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition'>
                                                                        导出看板
                                                                </button>
                                                                <button onClick={exportChatLog} className='px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition'>
                                                                        导出聊天
                                                                </button>
                                                                <button
                                                                        onClick={() => setAppMode(APP_MODES.WORLD_INFO_SETUP)}
                                                                        className='px-3 py-1.5 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition'
                                                                >
                                                                        设置项目世界
                                                                </button>
                                                                <button onClick={openAddTaskModal} className='px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition'>
                                                                        + 新任务
                                                                </button>
                                                                <button onClick={clearAllTasks} className='px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition'>
                                                                        清空任务
                                                                </button>
                                                                <button onClick={resetAll} className='px-3 py-1.5 rounded-lg bg-rose-900 text-white hover:bg-rose-800 transition'>
                                                                        重置所有
                                                                </button>
                                                        </>
                                                )}
                                                {appMode === APP_MODES.WORLD_INFO_SETUP && <div className='text-sm text-purple-600 font-semibold'>项目设置中...</div>}
                                        </div>
                                </div>
                        </header>

                        <div className='flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-4 p-4 overflow-auto'>
                                {appMode === APP_MODES.WORLD_INFO_SETUP ? (
                                        <WorldInfoSetup
                                                currentWorldInfo={worldInfo}
                                                setWorldInfo={setWorldInfo}
                                                setAppMode={setAppMode}
                                                isAiThinking={isAiThinking}
                                                setIsAiThinking={setIsAiThinking}
                                                apiKey={apiKey}
                                                setMessage={setMessage}
                                                worldChat={worldChatLog}
                                                appendChat={appendChat}
                                                inputRef={inputRef}
                                        />
                                ) : (
                                        <section className='rounded-2xl bg-white border shadow-xl flex flex-col overflow-hidden h-[80vh] md:h-full'>
                                                <div className='px-4 py-3 border-b text-base font-semibold text-slate-700 bg-gray-50'>AI 对话区（增量 Agent）</div>
                                                <div className='kanban-chat-window flex-1 p-4 overflow-y-auto flex flex-col'>
                                                        {kanbanChatLog.map((m, i) => (
                                                                <div key={i} className={`mb-3 p-2 rounded-lg max-w-[90%] ${m.role === 'user' ? 'bg-indigo-50 text-slate-900 self-end ml-auto' : 'bg-gray-100 text-slate-700 self-start mr-auto'}`}>
                                                                        <div className='text-[13px]'>
                                                                                <span className={`font-bold ${m.role === 'user' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                                                                                        {m.role === 'user' ? '你' : 'AI'}：
                                                                                </span>
                                                                                {m.text}
                                                                        </div>
                                                                        {m.time && <span className='text-[10px] text-gray-400 block mt-0.5'>{m.time}</span>}
                                                                </div>
                                                        ))}

                                                        {isAiThinking && (
                                                                <div className='flex items-center text-sm text-indigo-500 mt-2 p-2 self-start'>
                                                                        <svg className='animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'>
                                                                                <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
                                                                                <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
                                                                        </svg>
                                                                        AI 正在处理看板更新和智能提醒...
                                                                </div>
                                                        )}
                                                </div>
                                                <div className='p-3 border-t flex gap-2 bg-gray-50'>
                                                        <input
                                                                ref={inputRef}
                                                                disabled={isAiThinking || !apiKey}
                                                                className='flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm disabled:bg-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                                                                placeholder={isAiThinking ? '请等待 AI 响应...' : !apiKey ? '请先配置 API Key' : '输入你的需求，如：t-003 被外部依赖阻塞'}
                                                                onKeyDown={(e) => e.key === 'Enter' && sendMsg()}
                                                        />
                                                        <button
                                                                onClick={sendMsg}
                                                                disabled={isAiThinking || !apiKey}
                                                                className='px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition disabled:bg-gray-400'
                                                        >
                                                                发送
                                                        </button>
                                                </div>
                                        </section>
                                )}

                                <section className='md:col-span-2 rounded-2xl bg-white border shadow-xl flex flex-col h-[80vh] md:h-full'>
                                        <div className='px-5 py-4 border-b bg-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
                                                <div>
                                                        <h2 className='text-lg font-bold text-slate-800'>看板总览</h2>
                                                        <p className='text-xs text-gray-500'>结合世界信息 + Agent 的智能策略，实时掌握任务健康度。</p>
                                                </div>
                                                <div className='flex gap-3 text-xs'>
                                                        <div className='rounded-xl bg-white shadow-lg p-4 transition-transform hover:scale-[1.02]'>
                                                                <div className='text-xs text-gray-500'>总任务 / Story Points</div>
                                                                <div className='text-3xl font-bold text-slate-800 mt-1'>
                                                                        {metrics.total} / <span className='text-indigo-600'>{metrics.totalPoints}</span>
                                                                </div>
                                                        </div>
                                                        <div className='rounded-xl bg-white shadow-lg p-4 transition-transform hover:scale-[1.02]'>
                                                                <div className='text-xs text-gray-500'>平均 Lead / Cycle（天/任务）</div>
                                                                <div className='text-3xl font-bold text-indigo-600 mt-1'>
                                                                        {metrics.avgLead} / {metrics.avgCycle}
                                                                </div>
                                                        </div>
                                                        <div className='rounded-xl bg-white shadow-lg p-4 transition-transform hover:scale-[1.02]'>
                                                                <div className='text-xs text-gray-500'>吞吐量 (7天/点数)</div>
                                                                <div className='text-3xl font-bold text-emerald-600 mt-1'>{metrics.throughput7d}</div>
                                                                <div className='text-xs text-gray-600 mt-1'>WIP/TH: {metrics.wipToTh || '—'}</div>
                                                        </div>
                                                        <div className='rounded-xl bg-white shadow-lg p-4 transition-transform hover:scale-[1.02]'>
                                                                <div className='text-xs text-gray-500'>WIP (点数) / 阻塞任务数</div>
                                                                <div className='text-3xl font-bold text-amber-600 mt-1'>
                                                                        {metrics.wip} / <span className={metrics.counts.blocked > 0 ? 'text-red-500' : 'text-green-500'}>{metrics.counts.blocked}</span>
                                                                </div>
                                                        </div>
                                                </div>
                                        </div>

                                        <div className='flex border-b border-gray-200 bg-white rounded-t-xl p-2 shadow-sm'>
                                                {['kanban', 'cfd', 'burndown'].map((v) => (
                                                        <button
                                                                key={v}
                                                                onClick={() => setView(v)}
                                                                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-150 ease-in-out ${v === view ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
                                                        >
                                                                {v === 'kanban' && '看板视图'}
                                                                {v === 'cfd' && '累积流图 (CFD)'}
                                                                {v === 'burndown' && '燃尽图 (Burndown)'}
                                                        </button>
                                                ))}
                                        </div>

                                        <div className='flex-1 overflow-y-auto bg-white rounded-b-2xl shadow-xl p-4'>
                                                {view === 'kanban' && (
                                                        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
                                                                {columns.map((col) => (
                                                                        <Column key={col.id} title={col.name} onDrop={() => handleDrop(col.name)}>
                                                                                {byStatus(col.name).map((task) => (
                                                                                        <Card
                                                                                                key={task.id}
                                                                                                task={task}
                                                                                                onDragStart={(e, id) => setDragId(id)}
                                                                                                onEdit={setEdit}
                                                                                                getModuleColor={getModuleColor}
                                                                                                getTaskPoints={getTaskPoints}
                                                                                                fmt={fmt}
                                                                                        />
                                                                                ))}
                                                                        </Column>
                                                                ))}
                                                        </div>
                                                )}
                                                {view === 'cfd' && (
                                                        <div className='min-h-[400px] flex flex-col'>
                                                                <h3 className='font-bold text-xl mb-2 text-slate-700'>累积流图 (Cumulative Flow Diagram, CFD)</h3>
                                                                <p className='text-sm text-gray-500 mb-4'>Y轴代表 <strong>Story Points</strong>。线条变宽表示流动健康，水平线表示瓶颈。</p>
                                                                <ResponsiveContainer width='100%' height={350}>
                                                                        <AreaChart data={cfdData}>
                                                                                <CartesianGrid strokeDasharray='3 3' stroke='#e0e0e0' />
                                                                                <XAxis dataKey='date' tickLine={false} style={{ fontSize: '10px' }} />
                                                                                <YAxis style={{ fontSize: '10px' }} />
                                                                                <Tooltip
                                                                                        labelFormatter={(label) => `日期: ${label}`}
                                                                                        formatter={(value, name) => [`${value} 点`, name]}
                                                                                        contentStyle={{ fontSize: '12px', padding: '8px', borderRadius: '8px', border: '1px solid #ccc' }}
                                                                                />
                                                                                <Legend iconType='square' wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                                                                {COLUMN_ORDER.slice().reverse().map((colName) => {
                                                                                        const colorConfig = COLUMN_COLORS[colName];
                                                                                        return <Area key={colName} type='monotone' dataKey={colName} stackId='1' stroke={colorConfig.color} fill={colorConfig.color} fillOpacity={0.8} name={colName} />;
                                                                                })}
                                                                        </AreaChart>
                                                                </ResponsiveContainer>
                                                        </div>
                                                )}
                                                {view === 'burndown' && (
                                                        <div className='min-h-[400px] flex flex-col'>
                                                                <h3 className='font-bold text-xl mb-2 text-slate-700'>燃尽图 (Burndown Chart)</h3>
                                                                <p className='text-sm text-gray-500 mb-4'>Y轴代表剩余工作量 (<strong>Story Points</strong>)。实际曲线应保持在范围线下方。</p>
                                                                <ResponsiveContainer width='100%' height={350}>
                                                                        <LineChart data={burndownData}>
                                                                                <CartesianGrid strokeDasharray='3 3' stroke='#e0e0e0' />
                                                                                <XAxis dataKey='date' tickLine={false} style={{ fontSize: '10px' }} />
                                                                                <YAxis style={{ fontSize: '10px' }} />
                                                                                <Tooltip labelFormatter={(label) => `日期: ${label}`} formatter={(value, name) => [`${value} 点`, name]} />
                                                                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                                                                <Line type='monotone' dataKey='scope' stroke='#CBD5F5' strokeWidth={2} dot={false} name='计划范围 (Story Points)' />
                                                                                <Line type='monotone' dataKey='remaining' stroke='#6366F1' strokeWidth={3} dot={false} name='剩余工作量 (Story Points)' />
                                                                        </LineChart>
                                                                </ResponsiveContainer>
                                                        </div>
                                                )}
                                        </div>
                                </section>
                        </div>

                        <footer className='shrink-0 bg-white border-t text-[12px] text-gray-600'>
                                <div className='max-w-7xl mx-auto px-4 py-2 space-x-2'>
                                        <span>💡 提示：当前模式：{appMode === APP_MODES.KANBAN ? '看板管理' : '世界信息设置'}。</span>
                                        <span>→ **请务必在代码中替换 `HARDCODED_API_KEY` 为您的 DeepSeek API Key。**</span>
                                </div>
                        </footer>

                        {edit && (
                                <div className='fixed inset-0 bg-black/40 flex items-end md:items-center md:justify-center z-50' onClick={() => setEdit(null)}>
                                        <div className='bg-white w-full md:w-[560px] rounded-t-2xl md:rounded-2xl p-6 shadow-2xl' onClick={(e) => e.stopPropagation()}>
                                                <div className='text-xl font-bold mb-4 text-slate-800'>
                                                        编辑任务 <span className='text-sm font-normal text-gray-500'>({edit.id})</span>
                                                </div>
                                                <form id='editForm' className='grid grid-cols-2 gap-4'>
                                                        <label className='text-xs block font-medium text-gray-700'>
                                                                标题
                                                                <input name='title' defaultValue={edit.title} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm' />
                                                        </label>
                                                        <label className='text-xs block font-medium text-gray-700'>
                                                                模块
                                                                <input name='module' defaultValue={edit.module || ''} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm' />
                                                        </label>
                                                        <label className='text-xs block font-medium text-gray-700'>
                                                                状态
                                                                <select name='status' defaultValue={edit.status} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'>
                                                                        <option>To Do</option>
                                                                        <option>In Progress</option>
                                                                        <option>Review</option>
                                                                        <option>Done</option>
                                                                </select>
                                                        </label>
                                                        <label className='text-xs block font-medium text-gray-700'>
                                                                级别
                                                                <select name='level' defaultValue={edit.level || 'Task'} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'>
                                                                        <option>Task</option>
                                                                        <option>Story</option>
                                                                        <option>Epic</option>
                                                                </select>
                                                        </label>
                                                        <label className='text-xs block font-medium text-gray-700'>
                                                                负责人（逗号分隔）
                                                                <input name='owner' defaultValue={(edit.owner || []).join(', ')} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm' />
                                                        </label>
                                                        <label className='text-xs block font-medium text-gray-700'>
                                                                创建
                                                                <input type='datetime-local' name='created_at' defaultValue={edit.created_at ? edit.created_at.slice(0, 16) : ''} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm' />
                                                        </label>
                                                        <label className='text-xs block font-medium text-gray-700'>
                                                                开始
                                                                <input type='datetime-local' name='started_at' defaultValue={edit.started_at ? edit.started_at.slice(0, 16) : ''} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm' />
                                                        </label>
                                                        <label className='text-xs block font-medium text-gray-700'>
                                                                完成
                                                                <input type='datetime-local' name='finished_at' defaultValue={edit.finished_at ? edit.finished_at.slice(0, 16) : ''} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm' />
                                                        </label>
                                                        <label className='text-xs block font-medium text-gray-700'>
                                                                截止
                                                                <input type='datetime-local' name='due_at' defaultValue={edit.due_at ? edit.due_at.slice(0, 16) : ''} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm' />
                                                        </label>
                                                        <label className='text-xs block font-medium text-gray-700'>
                                                                依赖任务 ID（逗号分隔）
                                                                <input name='depends_on' defaultValue={(edit.depends_on || []).join(', ')} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm' />
                                                        </label>
                                                        <label className='col-span-2 text-xs block font-medium text-gray-700'>
                                                                阻塞原因（清除内容以解除阻塞）
                                                                <input name='block_reason' defaultValue={edit.block_reason || ''} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm' />
                                                        </label>
                                                </form>
                                                <div className='mt-6 flex justify-between'>
                                                        <button className='px-4 py-2 rounded-lg bg-rose-100 text-rose-600 hover:bg-rose-200 text-sm font-semibold transition' onClick={() => handleDeleteTask(edit)}>
                                                                删除任务
                                                        </button>
                                                        <div className='flex gap-3'>
                                                                <button className='px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-sm font-semibold transition' onClick={() => setEdit(null)}>
                                                                        取消
                                                                </button>
                                                                <button className='px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold transition' onClick={onEditSave}>
                                                                        保存
                                                                </button>
                                                        </div>
                                                </div>
                                        </div>
                                </div>
                        )}

                        {showResetConfirm && <ResetConfirmModal onClose={() => setShowResetConfirm(false)} onConfirm={handleResetConfirm} />}

                        {showClearTasksConfirm && <ClearTasksConfirmModal onClose={() => setShowClearTasksConfirm(false)} onConfirm={handleClearTasksConfirm} />}

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
