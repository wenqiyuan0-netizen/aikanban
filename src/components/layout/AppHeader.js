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
