import React from 'react';
import {
        AreaChart,
        Area,
        CartesianGrid,
        Legend,
        Line,
        LineChart,
        ResponsiveContainer,
        Tooltip,
        XAxis,
        YAxis,
} from 'recharts';
import { Column, Card } from './UIComponents';
import { COLUMN_COLORS, COLUMN_ORDER } from '../app/constants/colors';

const VIEW_TABS = [
        { key: 'kanban', label: '看板视图' },
        { key: 'cfd', label: '累积流图 (CFD)' },
        { key: 'burndown', label: '燃尽图 (Burndown)' },
];

export function KanbanView({
        kanbanChatLog,
        isAiThinking,
        apiKey,
        inputRef,
        onSendMessage,
        metrics,
        view,
        onChangeView,
        columns,
        byStatus,
        onDropTask,
        onDragStart,
        onEditTask,
        getModuleColor,
        getTaskPoints,
        fmt,
        cfdData,
        burndownData,
}) {
        return (
                <>
                        <section className='rounded-2xl bg-white border shadow-xl flex flex-col overflow-hidden h-[80vh] md:h-full'>
                                <div className='px-4 py-3 border-b text-base font-semibold text-slate-700 bg-gray-50'>AI 对话区（增量 Agent）</div>
                                <div className='kanban-chat-window flex-1 p-4 overflow-y-auto flex flex-col'>
                                        {kanbanChatLog.map((m, i) => (
                                                <div
                                                        key={i}
                                                        className={`mb-3 p-2 rounded-lg max-w-[90%] ${
                                                                m.role === 'user'
                                                                        ? 'bg-indigo-50 text-slate-900 self-end ml-auto'
                                                                        : 'bg-gray-100 text-slate-700 self-start mr-auto'
                                                        }`}
                                                >
                                                        <div className='text-[13px]'>
                                                                <span
                                                                        className={`font-bold ${
                                                                                m.role === 'user' ? 'text-indigo-600' : 'text-emerald-600'
                                                                        }`}
                                                                >
                                                                        {m.role === 'user' ? '你' : 'AI'}：
                                                                </span>
                                                                {m.text}
                                                        </div>
                                                        {m.time && <span className='text-[10px] text-gray-400 block mt-0.5'>{m.time}</span>}
                                                </div>
                                        ))}

                                        {isAiThinking && (
                                                <div className='flex items-center text-sm text-indigo-500 mt-2 p-2 self-start'>
                                                        <svg
                                                                className='animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500'
                                                                xmlns='http://www.w3.org/2000/svg'
                                                                fill='none'
                                                                viewBox='0 0 24 24'
                                                        >
                                                                <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
                                                                <path
                                                                        className='opacity-75'
                                                                        fill='currentColor'
                                                                        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                                                                ></path>
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
                                </div>

                                <div className='flex-1 overflow-y-auto bg-white rounded-b-2xl shadow-xl p-4'>
                                        {view === 'kanban' && (
                                                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
                                                        {columns.map((col) => (
                                                                <Column key={col.id} title={col.name} onDrop={() => onDropTask(col.name)}>
                                                                        {byStatus(col.name).map((task) => (
                                                                                <Card
                                                                                        key={task.id}
                                                                                        task={task}
                                                                                        onDragStart={onDragStart}
                                                                                        onEdit={onEditTask}
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
                                                                                return (
                                                                                        <Area
                                                                                                key={colName}
                                                                                                type='monotone'
                                                                                                dataKey={colName}
                                                                                                stackId='1'
                                                                                                stroke={colorConfig.color}
                                                                                                fill={colorConfig.color}
                                                                                                fillOpacity={0.8}
                                                                                                name={colName}
                                                                                        />
                                                                                );
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
                </>
        );
}
