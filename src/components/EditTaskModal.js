/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 渲染任务编辑模态窗，允许修改任务基础字段、阻塞原因、负责人等。
 * - 提供删除、保存、关闭等回调入口。
 *
 * Implementation Notes / 实现方式:
 * - 使用受控表单 ID (`editForm`) 供外部通过原生 FormData 读取，避免在组件内部维护大量状态。
 * - 点击遮罩关闭模态，避免事件冒泡干扰。
 *
 * Pending / 未完成:
 * - 未增加表单验证或错误提示。
 * - 尚未提供多语言标签与更友好的布局适配。
 *
 * Next Steps / 后续计划:
 * - 接入表单校验、字段描述、以及与 AI 建议的联动（如自动填充估算）。
 */
import React from 'react';

export function EditTaskModal({ task, onClose, onDelete, onSave }) {
        if (!task) return null;

        return (
                <div className='fixed inset-0 bg-black/40 flex items-end md:items-center md:justify-center z-50' onClick={onClose}>
                        <div className='bg-white w-full md:w-[560px] rounded-t-2xl md:rounded-2xl p-6 shadow-2xl' onClick={(e) => e.stopPropagation()}>
                                <div className='text-xl font-bold mb-4 text-slate-800'>
                                        编辑任务 <span className='text-sm font-normal text-gray-500'>({task.id})</span>
                                </div>
                                <form id='editForm' className='grid grid-cols-2 gap-4'>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                标题
                                                <input name='title' defaultValue={task.title} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm' />
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                模块
                                                <input name='module' defaultValue={task.module || ''} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm' />
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                状态
                                                <select name='status' defaultValue={task.status} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'>
                                                        <option>To Do</option>
                                                        <option>In Progress</option>
                                                        <option>Review</option>
                                                        <option>Done</option>
                                                </select>
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                级别
                                                <select name='level' defaultValue={task.level || 'Task'} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'>
                                                        <option>Task</option>
                                                        <option>Story</option>
                                                        <option>Epic</option>
                                                </select>
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                负责人（逗号分隔）
                                                <input name='owner' defaultValue={(task.owner || []).join(', ')} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm' />
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                创建
                                                <input type='datetime-local' name='created_at' defaultValue={task.created_at ? task.created_at.slice(0, 16) : ''} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm' />
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                开始
                                                <input type='datetime-local' name='started_at' defaultValue={task.started_at ? task.started_at.slice(0, 16) : ''} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm' />
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                完成
                                                <input type='datetime-local' name='finished_at' defaultValue={task.finished_at ? task.finished_at.slice(0, 16) : ''} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm' />
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                截止
                                                <input type='datetime-local' name='due_at' defaultValue={task.due_at ? task.due_at.slice(0, 16) : ''} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm' />
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                依赖任务 ID（逗号分隔）
                                                <input name='depends_on' defaultValue={(task.depends_on || []).join(', ')} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm' />
                                        </label>
                                        <label className='col-span-2 text-xs block font-medium text-gray-700'>
                                                阻塞原因（清除内容以解除阻塞）
                                                <input name='block_reason' defaultValue={task.block_reason || ''} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm' />
                                        </label>
                                </form>
                                <div className='mt-6 flex justify-between'>
                                        <button className='px-4 py-2 rounded-lg bg-rose-100 text-rose-600 hover:bg-rose-200 text-sm font-semibold transition' onClick={() => onDelete(task)}>
                                                删除任务
                                        </button>
                                        <div className='flex gap-3'>
                                                <button className='px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-sm font-semibold transition' onClick={onClose}>
                                                        取消
                                                </button>
                                                <button className='px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold transition' onClick={onSave}>
                                                        保存
                                                </button>
                                        </div>
                                </div>
                        </div>
                </div>
        );
}
