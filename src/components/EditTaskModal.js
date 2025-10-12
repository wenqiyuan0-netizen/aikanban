/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 渲染任务编辑模态窗，允许修改任务基础字段、阻塞原因、负责人等。
 * - 提供删除、保存、关闭等回调入口。
 *
 * Implementation Notes / 实现方式:
 * - 采用受控状态维护表单，便于动态展示列/子列以及负责人多选列表，并直接将解析后的结果传回上层。
 * - 点击遮罩关闭模态，避免事件冒泡干扰。
 *
 * Pending / 未完成:
 * - 未增加表单验证或错误提示。
 * - 尚未提供多语言标签与更友好的布局适配。
 *
 * Next Steps / 后续计划:
 * - 接入表单校验、字段描述、以及与 AI 建议的联动（如自动填充估算）。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { BOARD_STATUSES, TASK_PRIORITIES, TASK_TYPES } from '../app/constants/board';
import { getAssigneeList } from '../app/constants/task';

const toInputValue = (iso) => (iso ? iso.slice(0, 16) : '');

const parseChecklist = (raw) =>
        raw
                .split('\n')
                .map((line, index) => line.trim())
                .filter(Boolean)
                .map((line, index) => ({
                        id: `chk-${index}`,
                        title: line.replace(/^\[(x|X| )\]\s*/i, ''),
                        done: /^\[(x|X)\]/.test(line),
                }));

const buildFormState = (task) => {
        const safeTask = task || {};
        return {
                title: safeTask.title || '',
                description: safeTask.description || '',
                module: safeTask.module || '',
                status: safeTask.status || 'To Do',
                subStatus: safeTask.subStatus || '',
                type: safeTask.type || safeTask.level || 'Task',
                level: safeTask.level || safeTask.type || 'Task',
                priority: safeTask.priority || 'Medium',
                assignees: getAssigneeList(safeTask),
                created_at: toInputValue(safeTask.created_at),
                started_at: toInputValue(safeTask.started_at),
                finished_at: toInputValue(safeTask.finished_at),
                due_at: toInputValue(safeTask.due_at),
                tags: (safeTask.tags || []).join(', '),
                depends_on: (safeTask.depends_on || []).join(', '),
                block_reason: safeTask.block_reason || '',
                checklist: (safeTask.checklist || [])
                        .map((item) => `${item.done ? '[x]' : '[ ]'} ${item.title}`.trim())
                        .join('\n'),
        };
};

export function EditTaskModal({ task, columns = [], members = [], onClose, onDelete, onSave }) {
        const [form, setForm] = useState(() => buildFormState(task));

        useEffect(() => {
                if (task) {
                        setForm(buildFormState(task));
                }
        }, [task]);

        const availableSubColumns = useMemo(() => {
                return columns.find((column) => column.name === form.status)?.subColumns || [];
        }, [columns, form.status]);

        const handleChange = (key, value) => {
                setForm((prev) => ({ ...prev, [key]: value }));
        };

        const handleStatusChange = (value) => {
                const hasSubColumns = (columns.find((column) => column.name === value)?.subColumns || []).length > 0;
                setForm((prev) => ({ ...prev, status: value, subStatus: hasSubColumns ? prev.subStatus : '' }));
        };

        const handleSubmit = () => {
                onSave({
                        ...form,
                        assignees: form.assignees,
                        tags: form.tags
                                .split(',')
                                .map((item) => item.trim())
                                .filter(Boolean),
                        depends_on: form.depends_on
                                .split(',')
                                .map((item) => item.trim())
                                .filter(Boolean),
                        checklist: parseChecklist(form.checklist),
                });
        };

        if (!task) return null;

        return (
                <div className='fixed inset-0 bg-black/40 flex items-end md:items-center md:justify-center z-50' onClick={onClose}>
                        <div className='bg-white w-full md:w-[720px] rounded-t-2xl md:rounded-2xl p-6 shadow-2xl' onClick={(e) => e.stopPropagation()}>
                                <div className='text-xl font-bold mb-4 text-slate-800'>
                                        编辑任务 <span className='text-sm font-normal text-gray-500'>({task.id})</span>
                                </div>
                                <div className='grid grid-cols-2 gap-4'>
                                        <label className='text-xs block font-medium text-gray-700 col-span-2'>
                                                标题
                                                <input
                                                        value={form.title}
                                                        onChange={(e) => handleChange('title', e.target.value)}
                                                        className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'
                                                />
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700 col-span-2'>
                                                描述
                                                <textarea
                                                        value={form.description}
                                                        onChange={(e) => handleChange('description', e.target.value)}
                                                        className='mt-1 w-full border rounded-lg px-3 py-2 text-sm h-28'
                                                />
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                模块
                                                <input
                                                        value={form.module}
                                                        onChange={(e) => handleChange('module', e.target.value)}
                                                        className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'
                                                />
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                优先级
                                                <select
                                                        value={form.priority}
                                                        onChange={(e) => handleChange('priority', e.target.value)}
                                                        className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'
                                                >
                                                        {TASK_PRIORITIES.map((item) => (
                                                                <option key={item.value} value={item.value}>
                                                                        {item.label}
                                                                </option>
                                                        ))}
                                                </select>
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                类型
                                                <select
                                                        value={form.type}
                                                        onChange={(e) => handleChange('type', e.target.value)}
                                                        className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'
                                                >
                                                        {TASK_TYPES.map((item) => (
                                                                <option key={item.value} value={item.value}>
                                                                        {item.label}
                                                                </option>
                                                        ))}
                                                </select>
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                点数/级别
                                                <select
                                                        value={form.level}
                                                        onChange={(e) => handleChange('level', e.target.value)}
                                                        className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'
                                                >
                                                        {TASK_TYPES.map((item) => (
                                                                <option key={item.value} value={item.value}>
                                                                        {item.value}
                                                                </option>
                                                        ))}
                                                </select>
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                状态
                                                <select
                                                        value={form.status}
                                                        onChange={(e) => handleStatusChange(e.target.value)}
                                                        className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'
                                                >
                                                        {BOARD_STATUSES.map((status) => (
                                                                <option key={status.value} value={status.value}>
                                                                        {status.label}
                                                                </option>
                                                        ))}
                                                </select>
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                子列
                                                <select
                                                        value={form.subStatus}
                                                        onChange={(e) => handleChange('subStatus', e.target.value)}
                                                        className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'
                                                        disabled={!availableSubColumns.length}
                                                >
                                                        <option value=''>{availableSubColumns.length ? '选择子列' : '无子列'}</option>
                                                        {availableSubColumns.map((sub) => (
                                                                <option key={sub.id} value={sub.id}>
                                                                        {sub.name}
                                                                </option>
                                                        ))}
                                                </select>
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                负责人
                                                <select
                                                        multiple
                                                        value={form.assignees}
                                                        onChange={(e) =>
                                                                handleChange(
                                                                        'assignees',
                                                                        Array.from(e.target.selectedOptions).map((opt) => opt.value),
                                                                )
                                                        }
                                                        className='mt-1 w-full border rounded-lg px-3 py-2 text-sm h-28'
                                                >
                                                        {members.map((member) => (
                                                                <option key={member.id} value={member.id}>
                                                                        {member.name} · {member.role || '成员'}
                                                                </option>
                                                        ))}
                                                </select>
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                创建时间
                                                <input
                                                        type='datetime-local'
                                                        value={form.created_at}
                                                        onChange={(e) => handleChange('created_at', e.target.value)}
                                                        className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'
                                                />
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                开始时间
                                                <input
                                                        type='datetime-local'
                                                        value={form.started_at}
                                                        onChange={(e) => handleChange('started_at', e.target.value)}
                                                        className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'
                                                />
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                完成时间
                                                <input
                                                        type='datetime-local'
                                                        value={form.finished_at}
                                                        onChange={(e) => handleChange('finished_at', e.target.value)}
                                                        className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'
                                                />
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700'>
                                                截止日期
                                                <input
                                                        type='datetime-local'
                                                        value={form.due_at}
                                                        onChange={(e) => handleChange('due_at', e.target.value)}
                                                        className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'
                                                />
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700 col-span-2'>
                                                标签（逗号分隔）
                                                <input
                                                        value={form.tags}
                                                        onChange={(e) => handleChange('tags', e.target.value)}
                                                        className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'
                                                />
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700 col-span-2'>
                                                依赖任务 ID（逗号分隔）
                                                <input
                                                        value={form.depends_on}
                                                        onChange={(e) => handleChange('depends_on', e.target.value)}
                                                        className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'
                                                />
                                        </label>
                                        <label className='text-xs block font-medium text-gray-700 col-span-2'>
                                                子任务清单（每行一个，前缀 [ ] 或 [x] 表示完成）
                                                <textarea
                                                        value={form.checklist}
                                                        onChange={(e) => handleChange('checklist', e.target.value)}
                                                        className='mt-1 w-full border rounded-lg px-3 py-2 text-sm h-28'
                                                />
                                        </label>
                                        <label className='col-span-2 text-xs block font-medium text-gray-700'>
                                                阻塞原因（清除内容以解除阻塞）
                                                <input
                                                        value={form.block_reason}
                                                        onChange={(e) => handleChange('block_reason', e.target.value)}
                                                        className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'
                                                />
                                        </label>
                                </div>
                                <div className='mt-6 flex justify-between'>
                                        <button
                                                className='px-4 py-2 rounded-lg bg-rose-100 text-rose-600 hover:bg-rose-200 text-sm font-semibold transition'
                                                onClick={() => onDelete(task)}
                                        >
                                                删除任务
                                        </button>
                                        <div className='flex gap-3'>
                                                <button className='px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-sm font-semibold transition' onClick={onClose}>
                                                        取消
                                                </button>
                                                <button
                                                        className='px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold transition'
                                                        onClick={handleSubmit}
                                                >
                                                        保存
                                                </button>
                                        </div>
                                </div>
                        </div>
                </div>
        );
}
