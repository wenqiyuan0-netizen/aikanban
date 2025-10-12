/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 渲染全局头部：提供导入导出、进入世界信息、添加任务、清空、重置等操作按钮。
 * - 根据模式（看板/世界信息）动态隐藏不适用的操作。
 *
 * Implementation Notes / 实现方式:
 * - 通过 props 接入所有事件处理函数，保持组件无业务状态。
 * - 使用隐藏的文件输入控件实现 JSON 导入。
 *
 * Pending / 未完成:
 * - 缺少多语言支持与管理员/普通用户区分。
 * - 尚未显示当前项目名称、状态或用户信息。
 *
 * Next Steps / 后续计划:
 * - 接入项目状态机与多项目导航，显示当前项目及切换入口。
 * - 根据权限控制按钮可见性。
 */
import React from 'react';
import { APP_MODES } from '../../app/constants/appModes';

export function AppHeader({
        appMode,
        onImportJson,
        onExportBoard,
        onExportChatLog,
        onEnterWorldInfo,
        onOpenAddTask,
        onClearTasks,
        onResetAll,
}) {
        return (
                <header className='shrink-0 bg-white border-b shadow-md'>
                        <div className='max-w-7xl mx-auto px-4 py-2 flex items-center justify-between'>
                                <div className='text-xl font-extrabold text-indigo-700'>AI-Kanban 一体化控制台</div>
                                <div className='flex items-center gap-3 text-sm'>
                                        {appMode === APP_MODES.KANBAN && (
                                                <>
                                                        <label className='text-gray-500 text-xs'>
                                                                <input
                                                                        type='file'
                                                                        accept='application/json'
                                                                        onChange={onImportJson}
                                                                        className='hidden'
                                                                        id='fileImport'
                                                                />
                                                                <button
                                                                        onClick={() => document.getElementById('fileImport').click()}
                                                                        className='px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition'
                                                                >
                                                                        导入 JSON
                                                                </button>
                                                        </label>
                                                        <button
                                                                onClick={onExportBoard}
                                                                className='px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition'
                                                        >
                                                                导出看板
                                                        </button>
                                                        <button
                                                                onClick={onExportChatLog}
                                                                className='px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition'
                                                        >
                                                                导出聊天
                                                        </button>
                                                        <button
                                                                onClick={onEnterWorldInfo}
                                                                className='px-3 py-1.5 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition'
                                                        >
                                                                设置项目世界
                                                        </button>
                                                        <button
                                                                onClick={onOpenAddTask}
                                                                className='px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition'
                                                        >
                                                                + 新任务
                                                        </button>
                                                        <button
                                                                onClick={onClearTasks}
                                                                className='px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition'
                                                        >
                                                                清空任务
                                                        </button>
                                                        <button
                                                                onClick={onResetAll}
                                                                className='px-3 py-1.5 rounded-lg bg-rose-900 text-white hover:bg-rose-800 transition'
                                                        >
                                                                重置所有
                                                        </button>
                                                </>
                                        )}
                                        {appMode === APP_MODES.WORLD_INFO_SETUP && (
                                                <div className='text-sm text-purple-600 font-semibold'>项目设置中...</div>
                                        )}
                                </div>
                        </div>
                </header>
        );
}
