// src/components/UIComponents.js
/**
 * 🧩 UI Components for AI-Kanban App
 * -----------------------------------
 * 本文件仅包含纯前端 UI 组件（无业务逻辑、无状态依赖）。
 * 每个组件都是可独立复用的视图单元。
 *
 * 外部依赖项（请从上层导入）：
 * - getModuleColor(module)
 * - getTaskPoints(level)
 * - fmt(isoDate)
 */

import React, { useState } from 'react';

/* --------------------------------------------------------------------------
 * 🟦 Column（看板列容器）
 * - 接收 props: title, children, onDrop()
 * - 用于包裹任务卡片，可拖拽放置
 * -------------------------------------------------------------------------- */
export function Column({ title, children, onDrop }) {
	return (
		<div
			className="rounded-2xl bg-slate-50 border p-3 flex flex-col"
			onDragOver={(e) => e.preventDefault()}
			onDrop={onDrop}
		>
			<div className="font-semibold text-sm mb-2">{title}</div>
			<div className="flex-1 min-h-[200px]">{children}</div>
		</div>
	);
}

/* --------------------------------------------------------------------------
 * 🟩 Card（任务卡片）
 * - 接收 props: task, onDragStart, onEdit
 * - 展示任务主要信息、级别、阻塞、依赖、时间、负责人等
 * -------------------------------------------------------------------------- */
export function Card({ task, onDragStart, onEdit, getModuleColor, getTaskPoints, fmt }) {
	const colorClass = getModuleColor(task.module);

	return (
		<div
			draggable
			onDragStart={(e) => onDragStart(e, task.id)}
			className={`rounded-2xl shadow p-3 mb-3 cursor-grab border-2 hover:shadow-md transition ${colorClass}`}
		>
			{/* 标题与模块 */}
			<div className="flex items-center justify-between">
				<div className="text-sm font-semibold">{task.title}</div>
				<span className="text-[11px] px-2 py-0.5 rounded bg-gray-100">{task.module || '—'}</span>
			</div>

			{/* 任务级别与点数 */}
			{task.level && (
				<div className="text-[11px] text-gray-500 mt-1">
					级别: {task.level}（{getTaskPoints(task.level)}点）
				</div>
			)}

			{/* 阻塞提示 */}
			{task.block_reason && (
				<div className="flex items-center mt-1 text-[11px] text-red-600 font-semibold bg-red-50/50 p-1 rounded-lg border border-red-200">
					<svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 shrink-0" viewBox="0 0 20 20" fill="currentColor">
						<path
							fillRule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
							clipRule="evenodd"
						/>
					</svg>
					阻塞: {task.block_reason}
				</div>
			)}

			{/* 依赖关系 */}
			{task.depends_on?.length > 0 && (
				<div className="text-[11px] text-indigo-600 mt-1">依赖于: {task.depends_on.join(', ')}</div>
			)}

			{/* 时间与责任人 */}
			<div className="mt-1 text-[11px] text-gray-600">负责人：{(task.owner || []).join(', ') || '—'}</div>
			<div className="text-[11px] text-gray-500">创建：{fmt(task.created_at)}</div>
			{task.started_at && <div className="text-[11px] text-gray-500">开始：{fmt(task.started_at)}</div>}
			{task.finished_at && <div className="text-[11px] text-gray-500">完成：{fmt(task.finished_at)}</div>}
			{task.due_at && <div className="text-[11px] text-red-500">截止：{fmt(task.due_at)}</div>}

			{/* 编辑按钮 */}
			<div className="mt-2">
				<button
					onClick={() => onEdit(task)}
					className="text-[11px] px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
				>
					编辑
				</button>
			</div>
		</div>
	);
}

/* --------------------------------------------------------------------------
 * 🟨 Modal（通用模态框容器）
 * - 用于承载各种对话框内容
 * -------------------------------------------------------------------------- */
export function Modal({ children, onClose }) {
	return (
		<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
			<div
				className="bg-white w-full max-w-sm md:max-w-md rounded-xl p-6 shadow-2xl animate-fade-in"
				onClick={(e) => e.stopPropagation()}
			>
				{children}
			</div>
		</div>
	);
}

/* --------------------------------------------------------------------------
 * 🟢 AddTaskModal（新建任务弹窗）
 * - 输入任务标题 -> 调用 onSave(title)
 * -------------------------------------------------------------------------- */
export function AddTaskModal({ onClose, onSave }) {
	const [title, setTitle] = useState('');

	const handleSubmit = () => {
		if (title.trim()) onSave(title.trim());
	};

	return (
		<Modal onClose={onClose}>
			<h3 className="text-lg font-bold mb-4">新建任务</h3>
			<label className="block text-sm font-medium text-gray-700">
				任务标题
				<input
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="输入新任务标题"
					className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
					onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
					autoFocus
				/>
			</label>
			<div className="mt-6 flex justify-end gap-3">
				<button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm">
					取消
				</button>
				<button onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm">
					创建
				</button>
			</div>
		</Modal>
	);
}

/* --------------------------------------------------------------------------
 * 🔵 MessageBox（消息弹窗）
 * - 展示操作成功或错误提示
 * -------------------------------------------------------------------------- */
export function MessageBox({ message, onClose }) {
	if (!message) return null;

	const isSuccess = message.type === 'success';
	const colorClass = isSuccess ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700';
	const titleColor = isSuccess ? 'text-emerald-600' : 'text-red-600';

	return (
		<Modal onClose={onClose}>
			<h3 className={`text-lg font-bold mb-4 ${titleColor}`}>{message.title}</h3>
			<p className="text-sm text-gray-700 whitespace-pre-wrap">{message.body}</p>
			<div className="mt-6 flex justify-end">
				<button onClick={onClose} className={`px-4 py-2 rounded-lg text-white text-sm ${colorClass}`}>
					{isSuccess ? '好的' : '关闭'}
				</button>
			</div>
		</Modal>
	);
}

/* --------------------------------------------------------------------------
 * 🔴 ResetConfirmModal（重置看板确认框）
 * -------------------------------------------------------------------------- */
export function ResetConfirmModal({ onClose, onConfirm }) {
	return (
		<Modal onClose={onClose}>
			<h3 className="text-lg font-bold mb-4 text-rose-600">⚠️ 确认重置看板</h3>
			<p className="text-sm text-gray-700">
				确定要将看板重置为默认样例吗？
				<span className="font-semibold block mt-1">所有自定义数据都将丢失。</span>
			</p>
			<div className="mt-6 flex justify-end gap-3">
				<button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm">
					取消
				</button>
				<button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-sm">
					确认重置
				</button>
			</div>
		</Modal>
	);
}

/* --------------------------------------------------------------------------
 * 🟠 ClearTasksConfirmModal（清空任务确认框）
 * -------------------------------------------------------------------------- */
export function ClearTasksConfirmModal({ onClose, onConfirm }) {
	return (
		<Modal onClose={onClose}>
			<h3 className="text-lg font-bold mb-4 text-rose-600">❌ 确认清空所有任务</h3>
			<p className="text-sm text-gray-700">
				确定要清空看板上的所有任务吗？<br />
				<span className="font-semibold mt-1">此操作不可撤销，但项目配置和成员信息将保留。</span>
			</p>
			<div className="mt-6 flex justify-end gap-3">
				<button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm">
					取消
				</button>
				<button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-sm">
					确认清空
				</button>
			</div>
		</Modal>
	);
}

/* --------------------------------------------------------------------------
 * ⚫ DeleteConfirmModal（删除任务确认框）
 * -------------------------------------------------------------------------- */
export function DeleteConfirmModal({ task, onClose, onConfirm }) {
	if (!task) return null;

	return (
		<Modal onClose={onClose}>
			<h3 className="text-lg font-bold mb-4 text-rose-600">❌ 确认删除任务</h3>
			<p className="text-sm text-gray-700">
				确定要永久删除任务
				<span className="font-semibold"> [{task.id}] {task.title}</span> 吗？
				<span className="font-semibold block mt-1">此操作不可撤销。</span>
			</p>
			<div className="mt-6 flex justify-end gap-3">
				<button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm">
					取消
				</button>
				<button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-sm">
					确认删除
				</button>
			</div>
		</Modal>
	);
}
