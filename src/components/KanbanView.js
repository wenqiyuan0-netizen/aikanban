/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - Rebuilds the Kanban workspace UI to match the manual-first specification: swimlanes,
 *   sub-columns, quick filters, list view, export actions, and metrics cards.
 * - Keeps the existing chat panel while upgrading the board area into a flexible layout
 *   that supports WIP warnings and hover-based detail cards.
 *
 * Implementation Notes / 实现方式:
 * - 视图切换涵盖 Board/List/CFD/Burndown，其中 Board 视图会根据泳道策略动态渲染列网格，
 *   并兼容子列（如 In Progress → Doing/Ready for Review）。
 * - 快速筛选、搜索、泳道选择均通过 props 传入的 handler 更新上层状态，并同步到 prompt 上下文。
 * - 任务卡片采用 `group` + hover 面板显示详细描述、子任务进度、标签等，避免主界面信息噪音。
 *
 * Pending / 未完成:
 * - Calendar 视图尚未实现，仅预留按钮。
 * - 无障碍与键盘快捷操作仍待补充。
 *
 * Next Steps / 后续计划:
 * - 引入虚拟滚动优化大规模任务渲染，补充批量操作入口。
 */
import React from 'react';
import {
        Area,
        AreaChart,
        CartesianGrid,
        Legend,
        Line,
        LineChart,
        ResponsiveContainer,
        Tooltip,
        XAxis,
        YAxis,
} from 'recharts';
import { BOARD_EXPORT_OPTIONS, QUICK_FILTERS, SWIMLANE_STRATEGIES } from '../app/constants/board';
import { getAssigneeList } from '../app/constants/task';

const VIEW_TABS = [
        { key: 'board', label: '看板视图' },
        { key: 'list', label: '列表视图' },
        { key: 'cfd', label: '累积流图 (CFD)' },
        { key: 'burndown', label: '燃尽图 (Burndown)' },
];

export function KanbanView({
        kanbanChatLog,
        isAiThinking,
        apiKey,
        inputRef,
        onSendMessage,
        intentNotice,
        metrics,
        view,
        onChangeView,
        boardModel,
        board,
        tasks,
        members,
        onDropTask,
        onDragStart,
        onEditTask,
        getModuleColor,
        getTaskPoints,
        fmt,
        cfdData,
        burndownData,
        quickFilters,
        onToggleQuickFilter,
        searchText,
        onSearchTextChange,
        swimlaneStrategy,
        onChangeSwimlane,
        onExportBoard,
}) {
        const flattenedFilteredTasks = flattenLaneTasks(boardModel?.lanes || []);

        return (
                <>
                        <section className='rounded-2xl bg-white border shadow-xl flex flex-col overflow-hidden h-[80vh] md:h-full'>
                                <div className='px-4 py-3 border-b text-base font-semibold text-slate-700 bg-gray-50'>AI 对话区（增量 Agent）</div>
                                <div className='kanban-chat-window flex-1 p-4 overflow-y-auto flex flex-col'>
                                        {intentNotice && <IntentNotice notice={intentNotice} />}
                                        {kanbanChatLog.map((m, i) => (
                                                <ChatBubble key={i} message={m} />
                                        ))}
                                        {isAiThinking && <ThinkingBubble />}
                                </div>
                                <div className='p-3 border-t flex gap-2 bg-gray-50'>
                                        <input
                                                ref={inputRef}
                                                disabled={isAiThinking || !apiKey}
                                                className='flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm disabled:bg-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                                                placeholder={
                                                        isAiThinking
                                                                ? '请等待 AI 响应...'
                                                                : !apiKey
                                                                ? '请先配置 API Key'
                                                                : '输入你的需求，如：t-003 被外部依赖阻塞'
                                                }
                                                onKeyDown={(e) => e.key === 'Enter' && onSendMessage()}
                                        />
                                        <button
                                                onClick={onSendMessage}
                                                disabled={isAiThinking || !apiKey}
                                                className='px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition disabled:bg-gray-400'
                                        >
                                                发送
                                        </button>
                                </div>
                        </section>

                        <section className='md:col-span-2 rounded-2xl bg-white border shadow-xl flex flex-col h-[80vh] md:h-full'>
                                <div className='px-5 py-4 border-b bg-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
                                        <div>
                                                <h2 className='text-lg font-bold text-slate-800'>看板总览</h2>
                                                <p className='text-xs text-gray-500'>结合世界信息 + Agent 的智能策略，实时掌握任务健康度。</p>
                                        </div>
                                        <MetricsSummary metrics={metrics} />
                                </div>

                                <div className='px-5 py-3 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white'>
                                        <div className='flex flex-wrap items-center gap-2'>
                                                {QUICK_FILTERS.map((filter) => (
                                                        <button
                                                                key={filter.id}
                                                                onClick={() => onToggleQuickFilter(filter.id)}
                                                                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition border ${
                                                                        quickFilters.includes(filter.id)
                                                                                ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                                                                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                                                }`}
                                                        >
                                                                {filter.label}
                                                        </button>
                                                ))}
                                        </div>
                                        <div className='flex flex-wrap items-center gap-3'>
                                                <select
                                                        value={swimlaneStrategy}
                                                        onChange={(e) => onChangeSwimlane(e.target.value)}
                                                        className='border rounded-lg px-3 py-1.5 text-xs text-gray-600'
                                                >
                                                        {SWIMLANE_STRATEGIES.map((strategy) => (
                                                                <option key={strategy.value} value={strategy.value}>
                                                                        泳道：{strategy.label}
                                                                </option>
                                                        ))}
                                                </select>
                                                <input
                                                        value={searchText}
                                                        onChange={(e) => onSearchTextChange(e.target.value)}
                                                        placeholder='搜索任务/标签/依赖'
                                                        className='border rounded-lg px-3 py-1.5 text-xs text-gray-600'
                                                />
                                                <div className='relative'>
                                                        <select
                                                                className='border rounded-lg px-3 py-1.5 text-xs text-gray-600'
                                                                onChange={(e) => e.target.value && onExportBoard(e.target.value)}
                                                                defaultValue=''
                                                        >
                                                                <option value='' disabled>
                                                                        导出看板
                                                                </option>
                                                                {BOARD_EXPORT_OPTIONS.map((option) => (
                                                                        <option key={option.value} value={option.value}>
                                                                                {option.label}
                                                                        </option>
                                                                ))}
                                                        </select>
                                                </div>
                                        </div>
                                </div>

                                <div className='flex border-b border-gray-200 bg-white rounded-t-xl p-2 shadow-sm'>
                                        {VIEW_TABS.map((tab) => (
                                                <button
                                                        key={tab.key}
                                                        onClick={() => onChangeView(tab.key)}
                                                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-150 ease-in-out ${
                                                                tab.key === view ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
                                                        }`}
                                                >
                                                        {tab.label}
                                                </button>
                                        ))}
                                        <button
                                                onClick={() => onChangeView('calendar')}
                                                className={`ml-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-150 ease-in-out ${
                                                        view === 'calendar' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:bg-gray-50'
                                                }`}
                                                disabled
                                        >
                                                日历视图（即将推出）
                                        </button>
                                </div>

                                <div className='p-5 flex-1 overflow-hidden flex flex-col'>
                                        {boardModel?.wipAlerts?.length > 0 && <WipAlerts alerts={boardModel.wipAlerts} />}

                                        {view === 'board' && (
                                                <BoardLanes
                                                        lanes={boardModel.lanes}
                                                        columns={boardModel.columns}
                                                        onDropTask={onDropTask}
                                                        onDragStart={onDragStart}
                                                        onEditTask={onEditTask}
                                                        getModuleColor={getModuleColor}
                                                        getTaskPoints={getTaskPoints}
                                                        fmt={fmt}
                                                />
                                        )}

                                        {view === 'list' && <TaskList tasks={flattenedFilteredTasks} fmt={fmt} members={members} />}

                                        {view === 'cfd' && <CfdChart data={cfdData} />}
                                        {view === 'burndown' && <BurndownChart data={burndownData} />}
                                </div>
                        </section>
                </>
        );
}

function flattenLaneTasks(lanes) {
        const map = new Map();
        lanes.forEach((lane) => {
                lane.tasksByColumn.forEach((tasks) => {
                        tasks.forEach((task) => {
                                if (!map.has(task.id)) {
                                        map.set(task.id, task);
                                }
                        });
                });
        });
        return Array.from(map.values());
}

function IntentNotice({ notice }) {
        const intentTitleMap = {
                new_project: '新项目流程触发',
                archived_project: '旧项目唤醒提示',
                unknown: '判定不确定',
        };
        return (
                <div className='mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-700'>
                        <div className='font-semibold'>{intentTitleMap[notice.type] || '意图判定提示'}</div>
                        <p className='mt-1 leading-relaxed whitespace-pre-wrap'>{notice.message}</p>
                        {notice.meta?.targetProjectName && (
                                <p className='mt-1 text-[11px] text-amber-600'>可能的项目名称：{notice.meta.targetProjectName}</p>
                        )}
                </div>
        );
}

function ChatBubble({ message }) {
        return (
                <div
                        className={`mb-3 p-2 rounded-lg max-w-[90%] ${
                                message.role === 'user'
                                        ? 'bg-indigo-50 text-slate-900 self-end ml-auto'
                                        : 'bg-gray-100 text-slate-700 self-start mr-auto'
                        }`}
                >
                        <div className='text-[13px]'>
                                <span className={`font-bold ${message.role === 'user' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                                        {message.role === 'user' ? '你' : 'AI'}：
                                </span>
                                {message.text}
                        </div>
                        {message.time && <span className='text-[10px] text-gray-400 block mt-0.5'>{message.time}</span>}
                </div>
        );
}

function ThinkingBubble() {
        return (
                <div className='flex items-center text-sm text-indigo-500 mt-2 p-2 self-start'>
                        <svg className='animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'>
                                <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
                                <path
                                        className='opacity-75'
                                        fill='currentColor'
                                        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                                ></path>
                        </svg>
                        AI 正在处理看板更新和智能提醒...
                </div>
        );
}

function MetricsSummary({ metrics }) {
        if (!metrics) return null;
        return (
                <div className='flex gap-3 text-xs flex-wrap justify-end'>
                        <MetricCard title='总任务 / Story Points' value={`${metrics.total} / ${metrics.totalPoints}`} accent='text-indigo-600' />
                        <MetricCard title='平均 Lead / Cycle（天/任务）' value={`${metrics.avgLead} / ${metrics.avgCycle}`} accent='text-slate-700' />
                        <MetricCard title='吞吐量 (7天/点数)' value={metrics.throughput7d} accent='text-emerald-600' sub={`WIP/TH: ${metrics.wipToTh || '—'}`} />
                        <MetricCard
                                title='在制品 (Designing+执行+测试)' value={metrics.wip} accent='text-amber-600'
                                sub={`阻塞任务：${metrics.counts.blocked}`}
                        />
                </div>
        );
}

function MetricCard({ title, value, accent, sub }) {
        return (
                <div className='rounded-xl bg-white shadow-lg p-4 transition-transform hover:scale-[1.02] min-w-[150px]'>
                        <div className='text-xs text-gray-500'>{title}</div>
                        <div className={`text-3xl font-bold mt-1 ${accent}`}>{value}</div>
                        {sub && <div className='text-[11px] text-gray-500 mt-1'>{sub}</div>}
                </div>
        );
}

function WipAlerts({ alerts }) {
        return (
                <div className='mb-4 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg p-3'>
                        <div className='font-semibold mb-1'>⚠️ WIP 限制告警</div>
                        <ul className='space-y-1 list-disc list-inside'>
                                {alerts.map((alert) => (
                                        <li key={alert.column.id}>
                                                {alert.column.name} 当前 {alert.count} 项，超过上限 {alert.column.wip_limit}。请优先清理瓶颈。
                                        </li>
                                ))}
                        </ul>
                </div>
        );
}

function BoardLanes({ lanes, columns, onDropTask, onDragStart, onEditTask, getModuleColor, getTaskPoints, fmt }) {
        if (!lanes || lanes.length === 0) {
                        return <EmptyState message='当前筛选条件下没有任务。尝试清除筛选或创建新任务吧。' />;
        }
        const columnCount = columns.length || 1;
        return (
                <div className='flex-1 overflow-y-auto pr-2'>
                        {lanes.map((lane) => (
                                <div key={lane.id} className='mb-6'>
                                        <div className='flex items-center justify-between mb-2'>
                                                <h3 className='text-sm font-semibold text-slate-700'>{lane.label}</h3>
                                                <span className='text-[11px] text-gray-500'>任务数：{countLaneTasks(lane)}</span>
                                        </div>
                                        <div
                                                className='grid gap-4'
                                                style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(240px, 1fr))` }}
                                        >
                                                {columns.map((column) => (
                                                        <BoardColumn
                                                                key={`${lane.id}-${column.id}`}
                                                                lane={lane}
                                                                column={column}
                                                                onDropTask={onDropTask}
                                                                onDragStart={onDragStart}
                                                                onEditTask={onEditTask}
                                                                getModuleColor={getModuleColor}
                                                                getTaskPoints={getTaskPoints}
                                                                fmt={fmt}
                                                        />
                                                ))}
                                        </div>
                                </div>
                        ))}
                </div>
        );
}

function BoardColumn({ lane, column, onDropTask, onDragStart, onEditTask, getModuleColor, getTaskPoints, fmt }) {
        const tasks = lane.tasksByColumn.get(column.name) || [];
        const subColumns = column.subColumns || [];
        const handleDrop = (event, subStatus) => {
                event.preventDefault();
                onDropTask({
                        status: column.name,
                        subStatus: subStatus || null,
                        lane: { id: lane.id, label: lane.label, field: lane.field, value: lane.value },
                });
        };

        return (
                <div className='rounded-2xl bg-slate-50 border p-3 flex flex-col min-h-[260px]'>
                        <div className='flex items-center justify-between text-sm font-semibold text-slate-700 mb-2'>
                                <span>{column.name}</span>
                                {column.wip_limit && (
                                        <span className='text-[11px] text-gray-500'>限制 {column.wip_limit}</span>
                                )}
                        </div>
                        {subColumns.length > 0 ? (
                                <div className='space-y-3 flex-1'>
                                        {subColumns.map((sub) => {
                                                const subTasks = tasks.filter((task) => task.subStatus === sub.id);
                                                return (
                                                        <div key={sub.id} className='bg-white rounded-xl border border-dashed border-slate-200 p-2 flex-1'
                                                                onDragOver={(e) => e.preventDefault()}
                                                                onDrop={(e) => handleDrop(e, sub.id)}
                                                        >
                                                                <div className='text-[11px] font-semibold text-gray-500 mb-1'>{sub.name}</div>
                                                                <div className='space-y-2'>
                                                                        {subTasks.map((task) => (
                                                                                <TaskCard
                                                                                        key={`${lane.id}-${sub.id}-${task.id}`}
                                                                                        task={task}
                                                                                        onDragStart={onDragStart}
                                                                                        onEditTask={onEditTask}
                                                                                        getModuleColor={getModuleColor}
                                                                                        getTaskPoints={getTaskPoints}
                                                                                        fmt={fmt}
                                                                                />
                                                                        ))}
                                                                </div>
                                                        </div>
                                                );
                                        })}
                                        {tasks.filter((task) => !task.subStatus).length > 0 && (
                                                <div
                                                        className='bg-white rounded-xl border border-dashed border-slate-200 p-2'
                                                        onDragOver={(e) => e.preventDefault()}
                                                        onDrop={(e) => handleDrop(e, null)}
                                                >
                                                        <div className='text-[11px] font-semibold text-gray-500 mb-1'>未分配子列</div>
                                                        <div className='space-y-2'>
                                                                {tasks
                                                                        .filter((task) => !task.subStatus)
                                                                        .map((task) => (
                                                                                <TaskCard
                                                                                        key={`${lane.id}-unassigned-${task.id}`}
                                                                                        task={task}
                                                                                        onDragStart={onDragStart}
                                                                                        onEditTask={onEditTask}
                                                                                        getModuleColor={getModuleColor}
                                                                                        getTaskPoints={getTaskPoints}
                                                                                        fmt={fmt}
                                                                                />
                                                                        ))}
                                                        </div>
                                                </div>
                                        )}
                                </div>
                        ) : (
                                <div
                                        className='flex-1 bg-white rounded-xl border border-dashed border-slate-200 p-2 space-y-2'
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => handleDrop(e, null)}
                                >
                                        {tasks.map((task) => (
                                                <TaskCard
                                                        key={`${lane.id}-${task.id}`}
                                                        task={task}
                                                        onDragStart={onDragStart}
                                                        onEditTask={onEditTask}
                                                        getModuleColor={getModuleColor}
                                                        getTaskPoints={getTaskPoints}
                                                        fmt={fmt}
                                                />
                                        ))}
                                </div>
                        )}
                </div>
        );
}

function TaskCard({ task, onDragStart, onEditTask, getModuleColor, getTaskPoints, fmt }) {
        const assignees = getAssigneeList(task);
        const checklist = task.checklist || [];
        const completedChecklist = checklist.filter((item) => item.done).length;
        const checklistSummary = checklist.length ? `${completedChecklist}/${checklist.length}` : null;
        const className = `group rounded-2xl shadow p-3 cursor-grab border-2 hover:shadow-md transition bg-white ${
                getModuleColor(task.module)
        }`;
        return (
                <div
                        draggable
                        onDragStart={(e) => onDragStart(e, task.id)}
                        className={className}
                >
                        <div className='flex items-start justify-between gap-2'>
                                <div>
                                        <div className='text-sm font-semibold text-slate-800'>{task.title}</div>
                                        <div className='text-[11px] text-gray-500 mt-0.5'>#{task.id} · {task.type} · {getTaskPoints(task.level)} 点</div>
                                </div>
                                <span className='text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700'>{task.priority || 'Medium'}</span>
                        </div>
                        <div className='mt-2 text-[11px] text-gray-600 space-y-1'>
                                <div>负责人：{assignees.length ? assignees.join(', ') : '待分配'}</div>
                                {task.due_at && <div>截止：{fmt(task.due_at)}</div>}
                                {task.block_reason && (
                                        <div className='text-red-500'>阻塞：{task.block_reason}</div>
                                )}
                                {checklistSummary && <div>子任务进度：{checklistSummary}</div>}
                                {task.tags?.length > 0 && (
                                        <div className='flex flex-wrap gap-1'>
                                                {task.tags.map((tag) => (
                                                        <span key={tag} className='px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-500 rounded'>
                                                                #{tag}
                                                        </span>
                                                ))}
                                        </div>
                                )}
                        </div>
                        <div className='mt-2 flex items-center justify-between text-[11px] text-gray-400'>
                                <span>模块：{task.module || '未指定'}</span>
                                <button
                                        className='text-indigo-600 hover:text-indigo-800'
                                        onClick={() => onEditTask(task)}
                                >
                                        编辑
                                </button>
                        </div>
                        <div className='hidden group-hover:block mt-3 border-t pt-2 text-[11px] text-slate-600 whitespace-pre-wrap leading-relaxed'>
                                {task.description || '暂无描述'}
                        </div>
                </div>
        );
}

function TaskList({ tasks, fmt, members }) {
        const memberName = (id) => members.find((member) => member.id === id)?.name || id;
        if (!tasks.length) return <EmptyState message='暂无任务，或筛选条件不匹配。' />;
        return (
                <div className='overflow-auto rounded-xl border border-slate-200'>
                        <table className='min-w-full text-xs text-left text-slate-600'>
                                <thead className='bg-slate-100 text-[11px] uppercase tracking-wide'>
                                        <tr>
                                                <th className='px-3 py-2'>ID</th>
                                                <th className='px-3 py-2'>标题</th>
                                                <th className='px-3 py-2'>状态</th>
                                                <th className='px-3 py-2'>优先级</th>
                                                <th className='px-3 py-2'>负责人</th>
                                                <th className='px-3 py-2'>截止</th>
                                                <th className='px-3 py-2'>模块</th>
                                        </tr>
                                </thead>
                                <tbody>
                                        {tasks.map((task) => (
                                                <tr key={task.id} className='border-t border-slate-100 hover:bg-slate-50'>
                                                        <td className='px-3 py-2 font-mono text-[11px]'>{task.id}</td>
                                                        <td className='px-3 py-2'>{task.title}</td>
                                                        <td className='px-3 py-2'>{task.status}</td>
                                                        <td className='px-3 py-2'>{task.priority || '—'}</td>
                                                        <td className='px-3 py-2'>{getAssigneeList(task).map(memberName).join(', ') || '—'}</td>
                                                        <td className='px-3 py-2'>{task.due_at ? fmt(task.due_at) : '—'}</td>
                                                        <td className='px-3 py-2'>{task.module || '—'}</td>
                                                </tr>
                                        ))}
                                </tbody>
                        </table>
                </div>
        );
}

function CfdChart({ data }) {
        if (!data || data.length === 0) return <EmptyState message='暂无 CFD 数据' />;
        return (
                <div className='flex-1 min-h-[320px]'>
                        <ResponsiveContainer width='100%' height='100%'>
                                <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <defs>
                                                <linearGradient id='colorToDo' x1='0' y1='0' x2='0' y2='1'>
                                                        <stop offset='5%' stopColor='#94a3b8' stopOpacity={0.8} />
                                                        <stop offset='95%' stopColor='#94a3b8' stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id='colorDoing' x1='0' y1='0' x2='0' y2='1'>
                                                        <stop offset='5%' stopColor='#6366f1' stopOpacity={0.8} />
                                                        <stop offset='95%' stopColor='#6366f1' stopOpacity={0} />
                                                </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray='3 3' />
                                        <XAxis dataKey='date' />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Area type='monotone' dataKey='To Do' stackId='1' stroke='#94a3b8' fillOpacity={1} fill='url(#colorToDo)' />
                                        <Area type='monotone' dataKey='In Progress' stackId='1' stroke='#6366f1' fillOpacity={1} fill='url(#colorDoing)' />
                                        <Area type='monotone' dataKey='Done' stackId='1' stroke='#10b981' fill='#bbf7d0' />
                                </AreaChart>
                        </ResponsiveContainer>
                </div>
        );
}

function BurndownChart({ data }) {
        if (!data || data.length === 0) return <EmptyState message='暂无燃尽图数据' />;
        return (
                <div className='flex-1 min-h-[320px]'>
                        <ResponsiveContainer width='100%' height='100%'>
                                <LineChart data={data}>
                                        <CartesianGrid strokeDasharray='3 3' />
                                        <XAxis dataKey='date' />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line type='monotone' dataKey='scope' stroke='#94a3b8' name='总范围' />
                                        <Line type='monotone' dataKey='remaining' stroke='#f97316' name='剩余工作量' />
                                </LineChart>
                        </ResponsiveContainer>
                </div>
        );
}

function EmptyState({ message }) {
        return (
                <div className='flex-1 flex items-center justify-center text-sm text-gray-400 border border-dashed border-slate-200 rounded-xl p-6 bg-slate-50'>
                        {message}
                </div>
        );
}

function countLaneTasks(lane) {
        let count = 0;
        lane.tasksByColumn.forEach((tasks) => {
                count += tasks.length;
        });
        return count;
}
