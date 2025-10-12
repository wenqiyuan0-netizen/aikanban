import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, Area, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

/**
 * AI-Kanban 一体化网页（聊天 + 看板）
 * - 状态：已引入【appMode】状态机：'kanban' (看板操作) 和 'worldInfoSetup' (引导设置模式)。
 * - 智能洞察：新增【任务分级 (Epic/Story/Task)】、【WIP 时长预警】、【任务依赖关系】及【依赖阻塞预警】。
 * - Agent升级：发送完整看板数据，Agent 以“专业看板经理”身份决策，并接收【世界信息】。
 * - 核心：在 WorldInfoSetup 模式下，Agent 专注于【引导用户补全项目元数据】。
 * - **更新**：所有 size 相关的指标和图表计算均基于【任务点数 (Story Points)】。
 * * --- WARNING: API已切换至 DEEPSEEK (兼容OpenAI) ---
 */

// --- 全局配置与工具函数 ---
const nowISO = () => new Date().toISOString();
const toUtcIso = (localDt) => {
	if (!localDt) return undefined;
	try {
		const date = new Date(localDt); 
		return isNaN(date.getTime()) ? undefined : date.toISOString(); 
	} catch {
		return undefined;
	}
};
const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : '—');
const daysBetween = (a, b) => { try { const x = new Date(a), y = new Date(b); if (isNaN(x) || isNaN(y)) return null; return (y - x) / 86400000; } catch { return null; } };
const clone = (x) => JSON.parse(JSON.stringify(x));

// --- 模式和常量 ---
const APP_MODES = {
	KANBAN: 'kanban',
	WORLD_INFO_SETUP: 'worldInfoSetup'
};

// --- NEW: 任务点数权重 (Story Points) ---
const TASK_POINTS = {
	Task: 1,
	Story: 3,
	Epic: 5,
	DEFAULT: 1
};
const getTaskPoints = (level) => TASK_POINTS[level] || TASK_POINTS.DEFAULT;


// --- 模块颜色映射 (用于 Epic/Story 分级) ---
const MODULE_COLORS = {
	IIOT: 'border-blue-400 bg-blue-50/50',
	TT: 'border-green-400 bg-green-50/50',
	GET: 'border-purple-400 bg-purple-50/50',
	WS: 'border-yellow-400 bg-yellow-50/50',
	EMS: 'border-red-400 bg-red-50/50',
	DEFAULT: 'border-gray-200 bg-white',
};
const getModuleColor = (module) => MODULE_COLORS[module] || MODULE_COLORS.DEFAULT;

// --- 看板列颜色映射 (用于 CFD 图表) ---
const COLUMN_COLORS = {
	'To Do': { key: 'todo', color: '#64748B' },		// Slate
	'In Progress': { key: 'doing', color: '#3B82F6' }, // Blue
	'Review': { key: 'review', color: '#F59E0B' },	// Amber
	'Done': { key: 'done', color: '#10B981' }		// Emerald
};
const COLUMN_ORDER = ['To Do', 'In Progress', 'Review', 'Done'];	

// --- WIP 阻塞时长阈值 (天) ---
const DURATION_THRESHOLDS = {
	Epic: 14,	// 史诗级任务允许停留 14 天
	Story: 7,	// 用户故事允许停留 7 天
	Task: 3,	// 最小工作单元只允许停留 3 天
	DEFAULT: 5
};

// --- 初始数据 (不变) ---
const DEFAULT_DATA = {
	// --- World Information (项目元规则) ---
	worldInfo: { 
		projectName: '实习项目看板',
		projectGoal: '完成五个模块的学习、报告和最终的结业展示 (Abschlusspräsentation)。',
		keyDeadline: '2025-12-31T23:59:59.000Z',
		moduleList: ['WS', 'IIOT', 'EMS', 'TT', 'GET'],
		memberList: [ // 更新为详细对象数组
			{ id: 'A', name: 'A', role: '报告撰写' },
			{ id: 'B', name: 'B', role: '报告撰写' },
			{ id: 'C', name: 'C', role: '预习与资料整理' }
		],
	},
	board: {
		name: '实习项目看板',
		created_at: '2025-10-06',
		last_update: '2025-10-13',
		columns: [
			{ id: 'todo', name: 'To Do', order: 1 },
			{ id: 'doing', name: 'In Progress', order: 2, wip_limit: 10 }, // *** 修改点: 从 3 改为 10 ***
			{ id: 'review', name: 'Review', order: 3 },
			{ id: 'done', name: 'Done', order: 4 }
		]
	},
	members: [ // 保持与 worldInfo.memberList 同步
		{ id: 'A', name: 'A', role: '报告撰写' },
		{ id: 'B', name: 'B', role: '报告撰写' },
		{ id: 'C', name: 'C', role: '预习与资料整理' }
	],
	tasks: [
		{
			id: 't-001', module: 'IIOT', title: 'IIOT 第一次课', status: 'Done', owner: ['A', 'B', 'C'],
			created_at: '2025-10-06T09:00:00.000Z', finished_at: '2025-10-08T10:00:00.000Z', notes: '已完成', level: 'Task', depends_on: []
		},
		{
			id: 't-002', module: 'TT', title: 'TT 第一次课 报告撰写', status: 'In Progress', owner: ['A', 'B'],
			created_at: '2025-10-13T08:00:00.000Z', started_at: '2025-10-13T12:00:00.000Z', due_at: '2025-10-20T23:59:59.000Z', notes: '报告进行中', level: 'Story', depends_on: ['t-003']
		},
		{
			id: 't-003', module: 'TT', title: 'TT 预习整理', status: 'In Progress', owner: ['C'],
			created_at: '2025-10-13T08:00:00.000Z', started_at: '2025-10-13T13:00:00.000Z', due_at: '2025-10-20T23:59:59.000Z', level: 'Task', depends_on: []
		},
		{
			id: 't-004', module: 'GET', title: 'GET 第一次课 预习', status: 'To Do', owner: ['C'],
			created_at: '2025-10-13T09:00:00.000Z', planned_start: '2025-10-14T09:00:00.000Z', level: 'Task', depends_on: []
		},
		{
			id: 't-005', module: 'WS', title: 'WS 报告 等待结果', status: 'Review', owner: ['A', 'B', 'C'],
			created_at: '2025-10-06T10:00:00.000Z', submitted_at: '2025-10-10T16:00:00.000Z', 
			block_reason: '等待教授回复', // 此任务被阻塞
			notes: '已上交，等待教授回复', level: 'Story', depends_on: []
		},
		{
			id: 't-006', module: 'EMS', title: 'EMS 自学准备', status: 'In Progress', owner: ['A', 'B', 'C'],
			created_at: '2025-10-06T09:30:00:00.000Z', planned_meeting: '2025-10-27T10:00:00.000Z', level: 'Epic', depends_on: ['t-005']
		}
	],
	events: [
		{ id: 'e-1', time: '2025-10-08T10:00:00.000Z', type: 'complete', task_id: 't-001', user: 'A' },
		{ id: 'e-2', time: '2025-10-13T12:00:00.000Z', type: 'move', task_id: 't-002', from: 'To Do', to: 'In Progress', user: 'B' },
		{ id: 'e-3', time: '2025-10-13T13:00:00.000Z', type: 'move', task_id: 't-003', from: 'To Do', to: 'In Progress', user: 'C' }
	]
};

// --- API Key 配置 (已按要求写死) ---
const HARDCODED_API_KEY = "sk-20b70ca073e84df1a951e4e942dc6856"; // 请替换为你实际的 DeepSeek API Key
const initialApiKey = HARDCODED_API_KEY; 

// --- DEEPSEEK CONFIG ---
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';
// --- END DEEPSEEK CONFIG ---


// --- API Service Logic: 通用补丁生成器 ---

// 1. Kanban Patch Schema (用于常规看板操作)
const KANBAN_PATCH_SCHEMA = {
	type: "OBJECT",
	properties: {
		ai_response: { type: "STRING", description: "A friendly, concise, conversational summary of the changes made or any advice based on the request. MUST use an intimate/friendly tone (亲昵的语气) and be in Chinese." },
		patch_instructions: {
			type: "ARRAY",
			description: "An array of instructions to modify the kanban board state incrementally.",
			items: {
				type: "OBJECT",
				properties: {
					type: { type: "STRING", enum: ["task_add", "task_update", "member_add", "member_remove", "event_add"] },
					id: { type: "STRING", description: "Target ID for update/remove operations." },
					updates: {
						type: "OBJECT",
						description: "Fields to update for task_update operation (only include changed fields).",
						properties: {
							title: { type: "STRING" }, status: { type: "STRING", enum: ["To Do", "In Progress", "Review", "Done"] },
							owner: { type: "ARRAY", items: { type: "STRING" } }, block_reason: { type: "STRING", nullable: true, description: "Set to non-null string to block, or null/undefined to unblock." }, 
							due_at: { type: "STRING" }, level: { type: "STRING", enum: ["Epic", "Story", "Task"] },
							depends_on: { type: "ARRAY", items: { type: "STRING" } }
						}
					},
					details: {
						type: "OBJECT",
						description: "Full details for task_add, member_add, or event_add.",
						properties: {
							id: { type: "STRING" }, name: { type: "STRING" }, role: { type: "STRING" }, title: { type: "STRING" },
							status: { type: "STRING", enum: ["To Do", "In Progress", "Review", "Done"] }, owner: { type: "ARRAY", items: { type: "STRING" } }, module: { type: "STRING" },
							time: { type: "STRING" }, type: { type: "STRING" }, task_id: { type: "STRING" },
							level: { type: "STRING", enum: ["Epic", "Story", "Task"] }, depends_on: { type: "ARRAY", items: { type: "STRING" } },
							created_at: { type: "STRING" }
						}
					}
				},
				required: ["type"]
			}
		}
	},
	required: ["ai_response", "patch_instructions"]
};

// 2. World Info Patch Schema (用于引导模式，只更新世界信息)
const WORLD_INFO_SCHEMA = {
	type: "OBJECT",
	properties: {
		ai_response: { type: "STRING", description: "A friendly, conversational response in Chinese. Should contain the next question or completion confirmation. MUST use an intimate/friendly tone (亲昵的语气)." },
		status: { type: "STRING", enum: ["INCOMPLETE", "COMPLETE"], description: "Marks if all required world info fields have been gathered." },
		world_patch: {
			type: "OBJECT",
			description: "The partial or complete world information structure based on user input.",
			properties: {
				projectName: { type: "STRING", description: "Project name (e.g., 实习项目看板)" },
				projectGoal: { type: "STRING", description: "Overall project goal or mission (e.g., 完成结业展示)" },
				keyDeadline: { type: "STRING", description: "Main project deadline in UTC ISO 8601 format." },
				moduleList: { type: "ARRAY", items: { type: "STRING" }, description: "List of key modules or departments (e.g., WS, IIOT)." },
				memberList: { 
					type: "ARRAY", 
					items: { 
						type: "OBJECT",
						properties: {
							id: { type: "STRING", description: "Unique member ID, usually the name." },
							name: { type: "STRING", description: "Team member's display name." },
							role: { type: "STRING", description: "Team member's main role or focus." }
						},
						required: ["id", "name"]
					}, 
					description: "List of all team members with their IDs/Names and Roles." 
				}
			},
			required: ["projectName", "projectGoal", "keyDeadline", "moduleList", "memberList"] // 告诉 AI 哪些是必须收集的
		}
	},
	required: ["ai_response", "status"]
};


const generatePatch = async (apiKey, mode, fullPrompt) => {
	const useApiKey = apiKey || HARDCODED_API_KEY; 
	const API_URL = DEEPSEEK_BASE_URL;

	let systemPrompt, responseSchema, model = DEEPSEEK_MODEL;
	
	const controller = new AbortController();
	const timeoutMs = 25000; // 25 seconds
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	if (mode === APP_MODES.WORLD_INFO_SETUP) {
		responseSchema = WORLD_INFO_SCHEMA;
		systemPrompt = `
			你是一个【项目元数据配置助理AI】。你的唯一任务是：根据用户输入和当前【世界信息】，引导用户补全或修正项目元数据。
			
			**核心规则:**
			1. \`ai_response\` 必须使用**亲昵、鼓励和支持的语气**。
			2. 如果信息不完整，\`status\` 设为 "INCOMPLETE"，并提出下一个**清晰、具体**的追问。
			3. 如果信息完整且无矛盾，\`status\` 设为 "COMPLETE"，并生成完整的 \`world_patch\` 结构。
			4. 所有日期字段必须是 UTC ISO 8601 格式。
			5. \`world_patch.memberList\` 必须是包含 \`id\`, \`name\`, \`role\` 对象的数组。
		`;

	} else { // KANBAN Mode
		responseSchema = KANBAN_PATCH_SCHEMA;
		systemPrompt = `
			你是一个专业的敏捷看板经理AI (Kanban Manager Agent)。你的任务是根据用户指令和当前看板的**完整状态**和**世界信息**，运用专业的看板管理知识，生成**增量补丁指令 (patch_instructions)**，以及一段**友好的对话回复 (ai_response)**。
  
			**核心规则:**
			1.  **世界信息应用:** 你现在接收【世界信息 World Info】。请根据其中的项目目标、截止日期和规则，对用户指令做出更专业的推演和判断。
			2.  **看板管理专业性:** a) **任务拆分 (Decomposition):** 建议将大的 Epic/Story 拆分为 Task (task_add)。你需要自主判断，用户给出的任务属于epic/story/task，并写在‘level’中。
				b) **依赖关系:** 任务包含 \`depends_on\` 字段，用于指定前置任务ID。请使用 \`insights\` 中的 \`dependency_blocked\` 预警，主动提醒用户解决上游阻塞问题。
			3.  **智能预警与决策:**
				a) 根据 \`insights\` 中提供的 **WIP时长预警** 和 **依赖阻塞预警**，主动建议用户采取行动。
				b) 你的回复 (\`ai_response\`) 必须具有专业性，并结合看板数据进行解释。
			4.  **处理阻塞:** 如果用户要求阻塞任务，使用 \`task_update\` 设置 \`block_reason\` 字段，**不要**更改 \`status\` 字段。

			**工作流约束:** 任务移动必须遵循 **To Do -> In Progress -> Review -> Done** 的线性顺序。**禁止跳过阶段，除非用户明确要求。**
		`;
	}
	
	// --- DEEPSEEK Payload Construction (OpenAI Compatible) ---
	// We inject the schema requirement into the user message to enforce JSON structure
	const messages = [
		{ 
			role: 'system', 
			content: systemPrompt + 
			"\n\n--- STRUCTURE INSTRUCTION ---\n你的回复必须且仅包含一个 raw JSON 对象，严格遵循以下 JSON Schema 的定义。不得包含任何额外的前缀、后缀文本或 Markdown JSON 格式。结构内容如下:\n" + 
			JSON.stringify(responseSchema, null, 2)
		},
		{ 
			role: 'user', 
			content: fullPrompt + "\n\n请严格返回 JSON 对象。" 
		}
	];
	
	const payload = {
		model: model,
		messages: messages,
		temperature: 0.1,
		// DeepSeek supports response_format: json_object for structured output
		response_format: { type: "json_object" } 
	};

	try {
		const response = await fetch(API_URL, {
			method: 'POST',
			// --- NEW: Bearer Token Authentication ---
			headers: { 
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${useApiKey}`
			},
			body: JSON.stringify(payload),
			signal: controller.signal // Pass the signal to fetch
		});
		
		// Clear the timeout if fetch succeeds
		clearTimeout(timeoutId);

		if (!response.ok) {
			const errorText = await response.text();
			// 增强错误信息，便于用户诊断 DeepSeek API 错误
			if (response.status === 401) {
				throw new Error(`Authentication Failed (401). Please check your DeepSeek API Key: ${errorText}`);
			}
			throw new Error(`API returned status ${response.status}: ${errorText}`);
		}

		const result = await response.json();
		
		// --- NEW RESPONSE PARSING for DeepSeek/OpenAI ---
		const jsonString = result.choices?.[0]?.message?.content;
		
		if (!jsonString) {
			throw new Error("AI response content is empty or malformed. DeepSeek model might not have returned JSON.");
		}
		
		const parsedJson = JSON.parse(jsonString);
		
		// 基础验证：确保 AI 返回了核心字段
		if (!parsedJson.ai_response) {
			throw new Error("AI response validation failed. Missing ai_response.");
		}
		
		if (mode === APP_MODES.KANBAN && !Array.isArray(parsedJson.patch_instructions)) {
			throw new Error("Kanban mode validation failed. Missing patch_instructions array.");
		}
		if (mode === APP_MODES.WORLD_INFO_SETUP && !parsedJson.status) {
			throw new Error("Setup mode validation failed. Missing status field.");
		}

		return parsedJson;

	} catch (error) {
		// Clear the timeout even if an error occurs
		clearTimeout(timeoutId);
		
		// Check if the error is due to abortion/timeout
		if (error.name === 'AbortError') {
			// Log a specific error for the user to see
			console.error(`[CONSOLE_ERROR] AI Request Timed Out (超过 ${timeoutMs / 1000} 秒未响应).`);
			throw new Error(`AI Request Timed Out (超过 ${timeoutMs / 1000} 秒未响应).`);
		}
		
		console.error("[CONSOLE_ERROR] Error in generatePatch:", error);
		throw new Error(`AI Communication Failure: ${error.message}`);
	}
};


// --- 数据持久化、指标计算和核心函数 ---
const LS_KEY = 'ai_kanban_data_v1';
const loadData = () => {
	try {
		const raw = localStorage.getItem(LS_KEY);
		const initialData = raw ? JSON.parse(raw) : clone(DEFAULT_DATA);
		
		if (!Array.isArray(initialData.tasks)) initialData.tasks = [];
		if (!Array.isArray(initialData.members)) initialData.members = clone(DEFAULT_DATA.members);
		if (!Array.isArray(initialData.events)) initialData.events = [];
		if (!initialData.worldInfo) initialData.worldInfo = clone(DEFAULT_DATA.worldInfo);

		// 确保 members 和 worldInfo.memberList 同步
		if (initialData.worldInfo.memberList && initialData.worldInfo.memberList.length > 0) {
			initialData.members = initialData.worldInfo.memberList;
		}

		initialData.tasks = initialData.tasks.map(t => {
			if (t.status === 'Blocked') {
				t.block_reason = t.block_reason || '从旧版Blocked状态迁移';
				t.status = 'In Progress'; 
			}
			if (!t.level) t.level = 'Task';
			if (!t.depends_on) t.depends_on = [];
			return t;
		});
		
		return initialData;
	} catch { return clone(DEFAULT_DATA); }
}
const saveData = (d) => localStorage.setItem(LS_KEY, JSON.stringify(d, null, 2));

/**
 * NEW: Metrics calculated based on Story Points (size).
 */
function computeMetrics(data) {
	const tasks = data.tasks || [];
	
	// 计算 Story Points
	const getPoints = (t) => getTaskPoints(t.level);
	
	const done = tasks.filter(t => t.status === 'Done');
	const doing = tasks.filter(t => t.status === 'In Progress');
	const todo = tasks.filter(t => t.status === 'To Do');
	const review = tasks.filter(t => t.status === 'Review');
	const blocked = tasks.filter(t => t.status !== 'Done' && t.block_reason); 
	
	const totalPoints = tasks.reduce((sum, t) => sum + getPoints(t), 0);
	const donePoints = done.reduce((sum, t) => sum + getPoints(t), 0);
	const doingPoints = doing.reduce((sum, t) => sum + getPoints(t), 0);
	const reviewPoints = review.reduce((sum, t) => sum + getPoints(t), 0);

	const avg = (arr) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
	// Lead time and Cycle time still calculated in days (per task, not per point)
	const leadArr = done.map(t => daysBetween(t.created_at, t.finished_at)).filter(Boolean);
	const cycleArr = done.map(t => daysBetween(t.started_at || t.created_at, t.finished_at)).filter(Boolean);
	
	const now = new Date();
	const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
	// Throughput (Points per 7 days)
	const th7Points = done.filter(t => t.finished_at && new Date(t.finished_at) >= sevenDaysAgo)
						.reduce((sum, t) => sum + getPoints(t), 0);


	return {
		total: tasks.length,
		totalPoints: totalPoints, // NEW
		counts: { done: done.length, doing: doing.length, todo: todo.length, review: review.length, blocked: blocked.length },
		points: { done: donePoints, doing: doingPoints, todo: totalPoints - donePoints - reviewPoints - doingPoints, review: reviewPoints }, // Points in each column
		avgLead: +avg(leadArr).toFixed(2),
		avgCycle: +avg(cycleArr).toFixed(2),
		throughput7d: th7Points, // Now in points
		wip: doingPoints + reviewPoints, // Now in points
		wipToTh: th7Points ? +((doingPoints + reviewPoints) / th7Points).toFixed(2) : null
	};
}

/**
 * NEW: 智能洞察生成器，基于 Story Points 计算风险和建议。
 */
function buildInsights(data) {
	const m = computeMetrics(data);
	const issues = [];
	const nowISOString = nowISO();
	const now = new Date();
	const threeDaysFuture = new Date(now.getTime() + 3 * 24 * 3600 * 1000);

	const doingCol = data.board?.columns?.find(c => c.name === 'In Progress');
	// WIP Limit based on Points now
	if (doingCol?.wip_limit && m.wip > doingCol.wip_limit) {
		issues.push({ type: 'wip_limit_breach', column: 'WIP (Doing + Review)', wip: m.wip, limit: doingCol.wip_limit, suggestion: '暂停拉取新任务，先清空在制品（WIP 以 Story Points 计算）' });
	}
	
	const blockedTaskIds = new Set(data.tasks
		.filter(t => t.block_reason && t.status !== 'Done')
		.map(t => t.id)
	);

	(data.tasks || []).forEach(t => {
		if (t.status === 'Done') return; 

		// A. WIP 时长预警
		if (t.status === 'In Progress' || t.status === 'Review') {
				const startTime = t.started_at || t.created_at;
				const daysInWIP = daysBetween(startTime, nowISOString);
				const taskLevel = t.level || 'Task';
				const threshold = DURATION_THRESHOLDS[taskLevel] || DURATION_THRESHOLDS['DEFAULT'];

				if (daysInWIP !== null && daysInWIP > threshold) {
						issues.push({ 
								type: 'long_duration_warning', 
								task_id: t.id, 
								title: t.title, 
								level: taskLevel,
								status: t.status,
								days: daysInWIP.toFixed(1),
								threshold: threshold,
								suggestion: `任务已在 ${t.status} 状态停留 ${daysInWIP.toFixed(1)} 天 (${taskLevel} 阈值: ${threshold} 天)。请检查是否需要拆分或解除阻塞。` 
						});
				}
		}
		
		// B. 依赖阻塞检查
		const dependencies = t.depends_on || [];
		const blockedDependencies = dependencies.filter(depId => blockedTaskIds.has(depId));
		
		if (blockedDependencies.length > 0) {
				issues.push({ 
						type: 'dependency_blocked', 
						task_id: t.id, 
						title: t.title, 
						dependencies: blockedDependencies,
						suggestion: `该任务被其依赖项 [${blockedDependencies.join(', ')}] 阻塞。请优先解除上游阻塞。` 
				});
		}

		// C. 截止日期检查
		if (t.due_at && new Date(t.due_at) < now) {
			issues.push({ type: 'overdue', task_id: t.id, title: t.title, due_at: t.due_at, suggestion: '拆分降范围，尽快交付一个子任务' });
		}
		if (t.due_at && new Date(t.due_at) >= now && new Date(t.due_at) <= threeDaysFuture) {
			issues.push({ type: 'due_soon', task_id: t.id, title: t.title, due_at: t.due_at, days_left: daysBetween(nowISOString, t.due_at).toFixed(1) });
		}
		// D. 自我阻塞
		if (t.block_reason) {
			issues.push({ type: 'blocked_self', task_id: t.id, title: t.title, reason: t.block_reason, suggestion: '协调资源或改用mock' });
		}
		// E. 缺少截止日期
		if (!t.due_at && t.status !== 'Done' && t.status !== 'To Do') {
				issues.push({ type: 'missing_due_date', task_id: t.id, title: t.title, suggestion: '请为进行中的任务设置截止日期。' });
		}
	});

	return { generated_at: nowISOString, board: data.board?.name, metrics: m, issues };
}


/**
 * 核心函数：安全地应用 Agent 返回的增量补丁指令。
 */
function applyPatch(currentData, patches) {
	const nextData = clone(currentData);
	nextData.tasks = nextData.tasks || [];
	
	patches.forEach(patch => {
		try {
			if (!patch.type) return;

			switch (patch.type) {
				case 'task_update': {
					const taskIndex = nextData.tasks.findIndex(t => t.id === patch.id);
					if (taskIndex !== -1 && patch.updates) {
						nextData.tasks[taskIndex] = { ...nextData.tasks[taskIndex], ...patch.updates };
						// 虚拟时间保护
						if (patch.updates.status === 'In Progress' && !nextData.tasks[taskIndex].started_at) { nextData.tasks[taskIndex].started_at = nowISO(); }
						if (patch.updates.status === 'Done' && !nextData.tasks[taskIndex].finished_at) { nextData.tasks[taskIndex].finished_at = nowISO(); }
					}
					break;
				}
				case 'task_add': {
					if (patch.details) {
						if (!patch.details.id) patch.details.id = `t-${Math.random().toString(36).slice(2, 8)}`;
						if (!patch.details.status) patch.details.status = 'To Do';
						if (!patch.details.created_at) patch.details.created_at = nowISO();
						if (!patch.details.level) patch.details.level = 'Task';
						if (!patch.details.depends_on) patch.details.depends_on = []; 
						
						if (!nextData.tasks.some(t => t.id === patch.details.id)) {
							nextData.tasks.push(patch.details);
						}
					}
					break;
				}
				case 'member_add': {
					if (patch.details && patch.details.id) {
						if (!nextData.members.some(m => m.id === patch.details.id)) {
							nextData.members.push(patch.details);
						}
						// 保持 worldInfo 同步 (简单添加)
						const existsInWorld = nextData.worldInfo.memberList.some(m => m.id === patch.details.id);
						if (!existsInWorld) {
								nextData.worldInfo.memberList.push(patch.details);
						}
					}
					break;
				}
				case 'member_remove': {
					if (patch.id) {
						nextData.members = nextData.members.filter(m => m.id !== patch.id);
						// 保持 worldInfo 同步 (移除)
						nextData.worldInfo.memberList = nextData.worldInfo.memberList.filter(m => m.id !== patch.id);
					}
					break;
				}
				case 'event_add': {
					if (patch.details) {
						if (!patch.details.id) patch.details.id = `e-${(nextData.events.length || 0) + 1}`;
						nextData.events.push(patch.details);
					}
					break;
				}
				default:
					console.warn(`Unknown patch type received: ${patch.type}`);
			}
		} catch (e) {
			console.error('Failed to apply patch:', patch, e);
		}
	});

	nextData.board.last_update = nowISO();
	return nextData;
}

/**
 * NEW: 安全地应用 AI 返回的世界信息补丁，并同步成员列表。
 */
function applyWorldPatch(currentData, worldPatch) {
		const nextData = clone(currentData);
		
		// 1. 合并新的 World Info
		nextData.worldInfo = { ...nextData.worldInfo, ...worldPatch };
		
		// 2. 增强成员列表同步逻辑 (基于 id 完全同步)
		const newMembersList = worldPatch.memberList || [];
		const updatedMembers = [];
		const existingMembersMap = new Map(nextData.members.map(m => [m.id, m]));

		newMembersList.forEach(newMember => {
				const existingMember = existingMembersMap.get(newMember.id);
				if (existingMember) {
						// 更新现有成员信息（如角色）
						updatedMembers.push({ ...existingMember, ...newMember });
				} else {
						// 添加新成员
						updatedMembers.push(newMember);
				}
		});

		// 3. 移除旧的、不再列表中的成员 (如果需要严格同步)
		// 这一步是确保本地 data.members 与 worldInfo.memberList 严格一致
		nextData.members = updatedMembers;
		nextData.worldInfo.memberList = updatedMembers; // 确保 worldInfo 也使用干净的列表

		nextData.board.last_update = nowISO();
		return nextData;
}


// --- CFD / Burndown Chart Functions (使用 Story Points) ---
function calculateCfdData(data) {
	const allEvents = data.events || [];
	const initialTasks = data.tasks || [];
	
	if (initialTasks.length === 0) return [];

	const validTimestamps = initialTasks
		.map(t => new Date(t.created_at).getTime())
		.concat(allEvents.map(e => new Date(e.time).getTime()))
		.filter(t => !isNaN(t));

	if (validTimestamps.length === 0) return [];
	
	const startTime = new Date(Math.min(...validTimestamps));
	startTime.setHours(0, 0, 0, 0);
	const now = new Date();
	now.setHours(0, 0, 0, 0);

	const dates = [];
	let currentDate = startTime;

	while (currentDate.getTime() <= now.getTime()) {
		dates.push(currentDate.toISOString().slice(0, 10));
		currentDate.setDate(currentDate.getDate() + 1);
	}

	const tasksLog = {};
	initialTasks.forEach(t => {
		if (!COLUMN_ORDER.includes(t.status)) return;
		if (!t.created_at || isNaN(new Date(t.created_at).getTime())) return; 
		tasksLog[t.id] = {
			status: t.status,
			created_at: t.created_at,
			statusHistory: [{ date: t.created_at.slice(0, 10), status: t.status }],
			level: t.level // 携带级别信息
		};
	});

	const moveEvents = allEvents
		.filter(e => e.type === 'move' || e.type === 'complete' || e.type === 'new')
		.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

	moveEvents.forEach(e => {
		const task = tasksLog[e.task_id];
		if (task) {
			const newStatus = e.to || (e.type === 'complete' ? 'Done' : null);
			if (newStatus && COLUMN_ORDER.includes(newStatus) && newStatus !== task.status && e.time) { 
				task.statusHistory.push({ date: e.time.slice(0, 10), status: newStatus });
				task.status = newStatus;
			}
		}
	});

	const cfdData = dates.map(dateStr => {
		const dayData = { date: dateStr };
		const dateLimit = new Date(dateStr).getTime() + 86400000;
		
		COLUMN_ORDER.forEach(col => dayData[col] = 0);

		Object.values(tasksLog).forEach(task => {
			const createdTime = new Date(task.created_at).getTime();

			if (createdTime > dateLimit) return;
			
			let statusOnDay = null;
			task.statusHistory.forEach(history => {
				if (new Date(history.date).getTime() < dateLimit) {
					statusOnDay = history.status;
				}
			});
			
			if (statusOnDay && COLUMN_ORDER.includes(statusOnDay) && dayData.hasOwnProperty(statusOnDay)) {
				// **核心修改：按点数累加**
				dayData[statusOnDay] += getTaskPoints(task.level);
			}
		});

		return dayData;
	});

	return cfdData;
}


function calculateBurndownData(data) { 
	const tasks = data.tasks || [];
	const events = data.events || [];
	
	const allDates = tasks
		.map(t => t.created_at ? new Date(t.created_at).getTime() : null)
		.filter(t => !isNaN(t));

	if (allDates.length === 0) return [];
	
	const projectStartDay = new Date(Math.min(...allDates));
	projectStartDay.setHours(0, 0, 0, 0);
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const dates = [];
	let currentDate = projectStartDay;

	while (currentDate.getTime() <= today.getTime()) {
		dates.push(currentDate.toISOString().slice(0, 10));
		currentDate.setDate(currentDate.getDate() + 1);
	}

	const taskCompletionTimes = {};
	
	tasks.forEach(t => {
			if (t.finished_at && t.status === 'Done') {
				taskCompletionTimes[t.id] = t.finished_at;
			}
	});
	
	events.filter(e => e.type === 'complete' || (e.type === 'move' && e.to === 'Done')).forEach(e => {
			if (e.task_id) taskCompletionTimes[e.task_id] = e.time;
	});

	const burndownData = dates.map(dateStr => {
			const dayLimit = new Date(dateStr).getTime() + 86400000;
			
			let scopeOnDay = 0;
			tasks.forEach(t => {
				if (t.created_at && new Date(t.created_at).getTime() < dayLimit) {
						// **核心修改：按点数累加**
						scopeOnDay += getTaskPoints(t.level);
				}
			});

			let completedOnDay = 0;
			Object.keys(taskCompletionTimes).forEach(taskId => {
					const completionTime = new Date(taskCompletionTimes[taskId]).getTime();
					if (completionTime < dayLimit) {
							// **核心修改：按点数累加**
							const completedTask = tasks.find(t => t.id === taskId);
							if (completedTask) {
									completedOnDay += getTaskPoints(completedTask.level);
							}
					}
			});
			
			const remaining = scopeOnDay - completedOnDay;
			
			return {
					date: dateStr,
					remaining: remaining > 0 ? remaining : 0,
					scope: scopeOnDay,
			};
	});
	
	return burndownData;
}


// --- 模态框组件 (新增 ClearTasksConfirmModal) ---
function Column({ title, children, onDrop }) { 
	return (
		<div className='rounded-2xl bg-slate-50 border p-3 flex flex-col' onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
			<div className='font-semibold text-sm mb-2'>{title}</div>
			<div className='flex-1 min-h-[200px]'>{children}</div>
		</div>
	);
}

function Card({ task, onDragStart, onEdit }) { 
	const colorClass = getModuleColor(task.module);
	
	return (
		<div draggable onDragStart={(e) => onDragStart(e, task.id)}
			className={`rounded-2xl shadow p-3 mb-3 cursor-grab border-2 hover:shadow-md transition ${colorClass}`}>
			<div className='flex items-center justify-between'>
				<div className='text-sm font-semibold'>{task.title}</div>
				<span className='text-[11px] px-2 py-0.5 rounded bg-gray-100'>{task.module || '—'}</span>
			</div>
			
			{/* 任务级别显示 (新增点数显示) */}
			{task.level && <div className='text-[11px] text-gray-500 mt-1'>级别: {task.level} ({getTaskPoints(task.level)}点)</div>}

			{/* 阻塞图标和原因显示 */}
			{task.block_reason && (
					<div className='flex items-center mt-1 text-[11px] text-red-600 font-semibold bg-red-50/50 p-1 rounded-lg border border-red-200'>
							<svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 shrink-0" viewBox="0 0 20 20" fill="currentColor">
									<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
							</svg>
							阻塞: {task.block_reason}
					</div>
			)}
			
			{/* 依赖项显示 (简单显示) */}
			{(task.depends_on && task.depends_on.length > 0) && (
					<div className='text-[11px] text-indigo-600 mt-1'>
							依赖于: {task.depends_on.join(', ')}
					</div>
			)}

			<div className='mt-1 text-[11px] text-gray-600'>负责人：{(task.owner || []).join(', ') || '—'}</div>
			<div className='text-[11px] text-gray-500'>创建：{fmt(task.created_at)}</div>
			{task.started_at && <div className='text-[11px] text-gray-500'>开始：{fmt(task.started_at)}</div>}
			{task.finished_at && <div className='text-[11px] text-gray-500'>完成：{fmt(task.finished_at)}</div>}
			{task.due_at && <div className='text-[11px] text-red-500'>截止：{fmt(task.due_at)}</div>}
			<div className='mt-2'>
				<button onClick={() => onEdit(task)} className='text-[11px] px-2 py-1 rounded bg-gray-100 hover:bg-gray-200'>编辑</button>
			</div>
		</div>
	);
}

function Modal({ children, onClose }) { 
	return (
		<div className='fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4' onClick={onClose}>
			<div 
				className='bg-white w-full max-w-sm md:max-w-md rounded-xl p-6 shadow-2xl animate-fade-in' 
				onClick={(e) => e.stopPropagation()}>
				{children}
			</div>
		</div>
	);
}

function AddTaskModal({ onClose, onSave }) { 
	const [title, setTitle] = useState('');

	const handleSubmit = () => {
		if (title.trim()) {
			onSave(title.trim());
		}
	};

	return (
		<Modal onClose={onClose}>
			<h3 className='text-lg font-bold mb-4'>新建任务</h3>
			<label className='block text-sm font-medium text-gray-700'>
				任务标题
				<input 
					type='text' 
					value={title} 
					onChange={(e) => setTitle(e.target.value)} 
					placeholder='输入新任务标题'
					className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'
					onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
					autoFocus
				/>
			</label>
			<div className='mt-6 flex justify-end gap-3'>
				<button onClick={onClose} className='px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm'>
					取消
				</button>
				<button onClick={handleSubmit} className='px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm'>
					创建
				</button>
			</div>
		</Modal>
	);
}

function MessageBox({ message, onClose }) { 
	if (!message) return null;

	return (
		<Modal onClose={onClose}>
			<h3 className={`text-lg font-bold mb-4 ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
				{message.title}
			</h3>
			<p className='text-sm text-gray-700 whitespace-pre-wrap'>{message.body}</p>
			<div className='mt-6 flex justify-end'>
				<button 
					onClick={onClose} 
					className={`px-4 py-2 rounded-lg text-white text-sm ${message.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
				>
					{message.type === 'success' ? '好的' : '关闭'}
				</button>
			</div>
		</Modal>
	);
}

function ResetConfirmModal({ onClose, onConfirm }) { 
	return (
		<Modal onClose={onClose}>
			<h3 className='text-lg font-bold mb-4 text-rose-600'>⚠️ 确认重置看板</h3>
			<p className='text-sm text-gray-700'>
				确定要将看板重置为默认样例吗？
				<span className='font-semibold block mt-1'>所有自定义的看板数据（任务、事件）都将丢失。</span>
			</p>
			<div className='mt-6 flex justify-end gap-3'>
				<button onClick={onClose} className='px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm'>
					取消
				</button>
				<button onClick={onConfirm} className='px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-sm'>
					确认重置
				</button>
			</div>
		</Modal>
	);
}

// --- NEW: 清空任务确认模态框 ---
function ClearTasksConfirmModal({ onClose, onConfirm }) {
	return (
		<Modal onClose={onClose}>
			<h3 className='text-lg font-bold mb-4 text-rose-600'>❌ 确认清空所有任务</h3>
			<p className='text-sm text-gray-700'>
				确定要清空看板上的所有任务吗？<br />
				<span className='font-semibold mt-1'>此操作不可撤销，但项目配置和成员信息将保留。</span>
			</p>
			<div className='mt-6 flex justify-end gap-3'>
				<button onClick={onClose} className='px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm'>取消</button>
				<button onClick={onConfirm} className='px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-sm'>确认清空</button>
			</div>
		</Modal>
	);
}

function DeleteConfirmModal({ task, onClose, onConfirm }) { 
	if (!task) return null;

	return (
		<Modal onClose={onClose}>
			<h3 className='text-lg font-bold mb-4 text-rose-600'>❌ 确认删除任务</h3>
			<p className='text-sm text-gray-700'>
				确定要永久删除任务 
				<span className='font-semibold'>[{task.id}] {task.title}</span> 吗？
				<span className='font-semibold block mt-1'>此操作不可撤销。</span>
			</p>
			<div className='mt-6 flex justify-end gap-3'>
				<button onClick={onClose} className='px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm'>
					取消
				</button>
				<button onClick={onConfirm} className='px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-sm'>
					确认删除
				</button>
			</div>
		</Modal>
	);
}

// --- NEW COMPONENT: World Info Setup Mode ---
function WorldInfoSetup({ currentWorldInfo, setWorldInfo, setAppMode, isAiThinking, setIsAiThinking, apiKey, setMessage, chat, appendChat, inputRef }) {
	
	// 初始化对话，引导用户开始
	useEffect(() => {
		if (chat.length === 0) {
			appendChat({ 
				role: 'ai', 
				text: '嘿，朋友！欢迎进入项目世界信息设置模式。请告诉我您的**项目名称**、**目标**和**主要截止日期**，我会用最亲昵的方式帮助您初始化项目规则。', 
				time: new Date().toLocaleTimeString() 
			});
		}
	}, [chat.length, appendChat]);

	async function sendWorldMsg() {
		const text = (inputRef.current?.value || '').trim();
		if (!text || isAiThinking) return;

		const userMessage = { role: 'user', text, time: new Date().toLocaleTimeString() };
		appendChat(userMessage);
		inputRef.current.value = '';
		setIsAiThinking(true);

		try {
			// 构造专用的 Prompt
			const chatHistory = chat.slice(-3).map(m => `[${m.role}]: ${m.text}`).join('\n');
			const fullPrompt = `
				【当前世界信息】: 这是您已经收集到的项目元数据。
				${JSON.stringify(currentWorldInfo, null, 2)}
				---
				历史对话 (最近三轮):\n${chatHistory}\n
				---
				用户输入：${text}
			`;

			const parsedResponse = await generatePatch(apiKey, APP_MODES.WORLD_INFO_SETUP, fullPrompt);

			// 1. 更新聊天
			appendChat({ role: 'ai', text: parsedResponse.ai_response, time: new Date().toLocaleTimeString() });

			// 2. 检查状态并应用补丁
			if (parsedResponse.status === 'COMPLETE' && parsedResponse.world_patch) {
				setWorldInfo(parsedResponse.world_patch);
				setMessage({ title: '项目世界信息已完成！', body: 'Agent 成功收集到所有项目元数据，看板管理模式已激活。', type: 'success' });
				setAppMode(APP_MODES.KANBAN); // 切换回看板模式
			} else if (parsedResponse.status === 'INCOMPLETE' && parsedResponse.world_patch) {
				// 如果是 INCOMPLETE，Agent 可能返回了部分信息，我们先合并，再继续提问
				setWorldInfo(parsedResponse.world_patch);
			}

		} catch (e) {
			console.error("[CONSOLE_ERROR] AI API Error (Setup Mode):", e);
			setMessage({ title: 'AI 连接错误', body: '设置模式下调用 AI 失败: ' + (e.message || '未知错误'), type: 'error' });
		} finally {
			setIsAiThinking(false);
		}
	}
	
	// UI 渲染
	return (
		<section className='rounded-2xl bg-white border shadow-xl flex flex-col overflow-hidden h-[80vh] md:h-full'>
			<div className='px-4 py-3 border-b text-base font-semibold text-purple-700 bg-purple-50 flex justify-between items-center'>
				项目世界信息设置
				<button 
					onClick={() => setAppMode(APP_MODES.KANBAN)} 
					className='text-xs px-2 py-1 rounded bg-purple-200 hover:bg-purple-300'
				>
					返回看板 (不保存)
				</button>
			</div>
			<div className='flex-1 p-4 overflow-y-auto flex flex-col'>
				{/* 聊天内容 */}
				{chat.map((m, i) => (
					<div key={i} className={`mb-3 p-2 rounded-lg max-w-[90%] ${m.role === 'user' ? 'bg-indigo-50 text-slate-900 self-end ml-auto' : 'bg-gray-100 text-slate-700 self-start mr-auto'}`}>
						<div className='text-[13px]'>
							<span className={`font-bold ${m.role === 'user' ? 'text-indigo-600' : 'text-purple-600'}`}>{m.role === 'user' ? '你' : '配置 AI'}：</span>
							{m.text}
						</div>
						{m.time && <span className='text-[10px] text-gray-400 block mt-0.5'>{m.time}</span>}
					</div>
				))}
				
				{isAiThinking && (
					<div className='flex items-center text-sm text-indigo-500 mt-2 p-2 self-start'>
						<svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
							<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						配置 AI 正在分析信息...
					</div>
				)}
			</div>
			<div className='p-3 border-t flex gap-2 bg-gray-50'>
				<input 
					ref={inputRef} 
					disabled={isAiThinking || !apiKey} 
					className='flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm disabled:bg-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500' 
					placeholder={isAiThinking ? "请等待 AI 响应..." : "输入项目信息 (如: 项目名是XXX)"} 
					onKeyDown={(e) => e.key === 'Enter' && sendWorldMsg()}
				/>
				<button 
					onClick={sendWorldMsg} 
					disabled={isAiThinking || !apiKey} 
					className='px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition disabled:bg-gray-400'
				>
					发送
				</button>
			</div>
		</section>
	);
}


// --- 主应用组件 ---

export default function App() {
	const [data, setData] = useState(loadData());
	const [dragId, setDragId] = useState(null);
	const [edit, setEdit] = useState(null); 
	const [view, setView] = useState('kanban'); 
	const [appMode, setAppMode] = useState(APP_MODES.KANBAN); 
	
	// Custom Modal States
	const [showResetConfirm, setShowResetConfirm] = useState(false);
	const [showClearTasksConfirm, setShowClearTasksConfirm] = useState(false); // NEW
	const [showAddTaskModal, setShowAddTaskModal] = useState(false);
	const [message, setMessage] = useState(null); 
	const [taskToDelete, setTaskToDelete] = useState(null); 
	
	// API Key State
	const [apiKey, setApiKey] = useState(initialApiKey);
	
	// AI 状态
	const [isAiThinking, setIsAiThinking] = useState(false);
	
	// 用于发送给 AI 的历史记录
	const [chat, setChat] = useState([{ role: 'system', text: 'AI-Agent 已连接，已升级为【增量补丁模式】。**Blocked 状态已移除**，请使用 `block_reason` 属性来标记任务阻塞。' }]);
	const inputRef = useRef(null);
	
	const worldInfo = data.worldInfo;

	useEffect(() => { saveData(data); }, [data]);

	// 更新 data.worldInfo 的函数，并触发成员同步
	const setWorldInfo = (newWorldPatch) => {
			setData(d => applyWorldPatch(d, newWorldPatch));
	};
	
	/* // BUG FIX: 移除此段代码，防止切换模式时清空聊天记录。
	// 聊天记录应在组件初始化时设置一次，并在 WorldInfoSetup 成功完成后重置（如果需要的话，但目前逻辑是保留的）。
	useEffect(() => {
			if (appMode === APP_MODES.KANBAN) {
					setChat([{ role: 'system', text: 'AI-Agent 已连接，已切换到看板管理模式。请开始输入你的指令，我会以亲昵的语气给你专业建议。' }]);
			} else {
					setChat([]);
			}
	}, [appMode]); 
	*/


	const columns = useMemo(() => {
		const cols = (data.board?.columns || []).filter(c => c.name !== 'Blocked').slice().sort((a, b) => (a.order || 0) - (b.order || 0));
		return cols.length ? cols : [
			{ id: 'todo', name: 'To Do' }, { id: 'doing', name: 'In Progress' }, { id: 'review', name: 'Review' }, { id: 'done', name: 'Done' }
		];
	}, [data.board]);

	const by = (status) => (data.tasks || []).filter(t => t.status === status);
	const metrics = useMemo(() => computeMetrics(data), [data]);
	const cfdData = useMemo(() => calculateCfdData(data), [data]);
	const burndownData = useMemo(() => calculateBurndownData(data), [data]);


	// --- 看板操作函数 (Drag & Drop, Add, Delete, Edit) ---
	
	function handleDrop(status) {
		if (appMode === APP_MODES.WORLD_INFO_SETUP) return;

		if (!dragId) return;
		const next = clone(data);
		const t = next.tasks.find(x => x.id === dragId);
		if (!t) return;
		const from = t.status, to = status;
		if (from === to) return;
		
		// --- 流程检查更新 (遵循 To Do -> In Progress -> Review -> Done 线性流) ---
		// 允许退回 To Do 或上一步 (如 Review -> In Progress)
		const fromIndex = COLUMN_ORDER.indexOf(from);
		const toIndex = COLUMN_ORDER.indexOf(to);
		
		// 强制阻止跳跃前进（例如 To Do -> Review/Done）
		if (toIndex > fromIndex + 1) {
				setMessage({ title: '流程警告', body: `任务不应跳过阶段直接进入 ${to}。请遵循线性工作流：${COLUMN_ORDER.join(' -> ')}`, type: 'error' });
				return;
		}
		
		t.status = to;

		// --- 时间戳和属性清理/设置 (虚拟时间保护机制) ---

		if (to === 'To Do') {
			t.started_at = undefined;
			t.finished_at = undefined;
			t.block_reason = null;
		} 
		else if (to === 'In Progress') {
			if (!t.started_at) t.started_at = nowISO();
			t.finished_at = undefined; 
		} 
		else if (to === 'Review') {
			t.finished_at = undefined;
		} 
		else if (to === 'Done') {
			if (!t.finished_at) t.finished_at = nowISO();
			t.block_reason = null;
		}
		
		next.events = next.events || [];
		next.events.push({ id: `e-${(next.events.length || 0) + 1}`, time: nowISO(), type: 'move', task_id: t.id, from, to, user: 'human' });
		next.board.last_update = nowISO();
		setData(next); setDragId(null);
	}
	
	function openAddTaskModal() {
		if (appMode === APP_MODES.WORLD_INFO_SETUP) return;
		setShowAddTaskModal(true);
	}
	
	// NEW: 清空所有任务的逻辑
	function clearAllTasks() {
		if (appMode === APP_MODES.WORLD_INFO_SETUP) return;
		setShowClearTasksConfirm(true);
	}
	
	function handleClearTasksConfirm() {
			setData(prevData => {
					const nextData = clone(prevData);
					nextData.tasks = []; // 清空任务列表
					nextData.events = nextData.events || [];
					nextData.events.push({
							id: `e-${(nextData.events.length || 0) + 1}`,
							time: nowISO(),
							type: 'clear_all_tasks',
							user: 'human',
							notes: '所有任务被手动清空'
					});
					nextData.board.last_update = nowISO();
					return nextData;
			});
			setShowClearTasksConfirm(false);
			setMessage({ title: '清空成功', body: '看板任务已全部清空，项目配置和成员信息已保留。', type: 'success' });
	}

	// ... (其他操作函数不变)
	function importJSON(e) {
		const f = e.target.files?.[0]; if (!f) return;
		const r = new FileReader();
		r.onload = () => {
			try {
				const obj = JSON.parse(r.result);
				if (!obj.board) obj.board = clone(DEFAULT_DATA.board);
				if (!obj.board.columns) obj.board.columns = clone(DEFAULT_DATA.board.columns);
				if (!Array.isArray(obj.tasks)) obj.tasks = [];
				if (!Array.isArray(obj.members)) obj.members = clone(DEFAULT_DATA.members);
				if (!obj.worldInfo) obj.worldInfo = clone(DEFAULT_DATA.worldInfo); // 确保 worldInfo 存在
				obj.board.last_update = nowISO();
				setData(obj);
			} catch (err) { 
				setMessage({ title: 'JSON 导入错误', body: 'JSON 解析失败：' + err.message, type: 'error' });
			}
		};
		r.readAsText(f);
		e.target.value = '';
	}

	function exportFile(name, content) {
		const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
	}

	function exportBoard() { exportFile('kanban.json', data); }
	function exportChatLog() {
		exportFile('chat_log.json', chat);
	}
	
	function resetAll() { 
		setShowResetConfirm(true); 
	}
	
	function handleResetConfirm() {
		setData(clone(DEFAULT_DATA));
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
		
		next.tasks = next.tasks.filter(t => t.id !== taskToDelete.id);
		
		next.events = next.events || [];
		next.events.push({ 
			id: `e-${(next.events.length || 0) + 1}`, 
			time: nowISO(), 
			type: 'delete', 
			task_id: taskToDelete.id, 
			user: 'human',
			title: taskToDelete.title 
		});
		next.board.last_update = nowISO();
		setData(next);
		setTaskToDelete(null);
	}

	function handleAddTaskSubmit(title) {
		const next = clone(data);
		const id = `t-${Math.random().toString(36).slice(2, 8)}`;
		next.tasks.push({ id, title, status: 'To Do', created_at: nowISO(), owner: [], module: 'DEFAULT', level: 'Task', depends_on: [] }); 
		next.events = next.events || [];
		next.events.push({ id: `e-${(next.events.length || 0) + 1}`, time: nowISO(), type: 'new', task_id: id, user: 'human' });
		next.board.last_update = nowISO();
		setData(next);
		setShowAddTaskModal(false);
	}

	function onEditSave() {
		const form = document.getElementById('editForm');
		const fd = new FormData(form);
		const next = clone(data);
		const t = next.tasks.find(x => x.id === edit.id);
		if (!t) return;
		
		const saveDate = (key) => toUtcIso(fd.get(key));

		t.title = fd.get('title');
		t.module = fd.get('module') || undefined; 
		t.status = fd.get('status');
		t.level = fd.get('level') || 'Task';
		t.depends_on = (fd.get('depends_on') || '').split(',').map(s => s.trim()).filter(Boolean); 

		t.owner = (fd.get('owner') || '').split(',').map(s => s.trim()).filter(Boolean);
		
		t.created_at = saveDate('created_at') || t.created_at; 
		t.started_at = saveDate('started_at');
		t.finished_at = saveDate('finished_at');
		t.due_at = saveDate('due_at');
		
		const newBlockReason = fd.get('block_reason') || undefined;
		t.block_reason = newBlockReason;

		// 清理时间戳：如果状态退回，清除后续时间戳
		if (t.status === 'To Do') {
			t.started_at = undefined;
			t.finished_at = undefined;
		} else if (t.status === 'In Progress' || t.status === 'Review') {
			t.finished_at = undefined;
		} else if (t.status === 'Done' && !t.finished_at) {
			t.finished_at = nowISO();
		}
		
		next.events = next.events || [];
		next.events.push({ id: `e-${(next.events.length || 0) + 1}`, time: nowISO(), type: 'update', task_id: t.id, user: 'human' });
		next.board.last_update = nowISO();
		setData(next);
		setEdit(null);
	}


	// --- AI Agent 核心逻辑 (看板模式) ---
	
	async function sendMsg() {
		if (appMode !== APP_MODES.KANBAN) return;
		
		const text = (inputRef.current?.value || '').trim();
		if (!text || isAiThinking) return;
		
		if (!apiKey) {
			setMessage({ title: 'API Key 缺失', body: '请在 App.jsx 文件中配置 DeepSeek API 密钥。', type: 'error' });
			return;
		}
		
		const userMessage = { role: 'user', text, time: new Date().toLocaleTimeString() };
		appendChat(userMessage);
		inputRef.current.value = '';
		setIsAiThinking(true);
		
		try {
			const insights = buildInsights(data); 
			const fullBoardState = clone(data);
			const worldInfo = fullBoardState.worldInfo || {};

			const chatHistory = chat.slice(-3).map(m => `[${m.role}]: ${m.text}`).join('\n');
			
			// 增强后的 Prompt，包含了所有约束信息（在 System Prompt 中）和详细的上下文
			const fullPrompt = `
				【世界信息 World Info】: 这描述了项目的基本规则、目标和背景。
				${JSON.stringify(worldInfo, null, 2)}
				---
				历史对话 (最近三轮):\n${chatHistory}\n
				---
				当前看板的健康状态分析（请参考此分析来识别风险，但只有在高风险时才主动建议）：\n${JSON.stringify(insights, null, 2)}\n\n
				当前看板的完整 Board State (包含 tasks, members, columns)：\n${JSON.stringify(fullBoardState, null, 2)}\n\n
				---
				用户指令：${text}`;

			const parsedResponse = await generatePatch(apiKey, APP_MODES.KANBAN, fullPrompt);

			appendChat({ role: 'ai', text: parsedResponse.ai_response || '（AI 未返回回复文本）', time: new Date().toLocaleTimeString() });
			
			const patches = parsedResponse.patch_instructions;
			if (Array.isArray(patches) && patches.length > 0) {
				const updatedData = applyPatch(data, patches);
				setData(updatedData);
			}
			
		} catch (e) {
			console.error("[CONSOLE_ERROR] AI API Error:", e);
			const errorBody = e.message.includes('Authentication Failed') 
					? 'DeepSeek API 认证失败，请检查您的密钥。'
					: '调用 DeepSeek 服务时发生错误：' + (e.message || '未知错误');

			setMessage({ title: 'AI 连接错误', body: errorBody, type: 'error' });
			
		} finally {
			setIsAiThinking(false);
		}
	}

	function appendChat(message) { 
		setChat(c => [...c, message]); 
		// 滚动到底部逻辑
		setTimeout(() => {
			const chatWindow = document.querySelector('.flex-1.p-4.overflow-y-auto');
			if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
		}, 50);
	}

	// --- 渲染 (JSX 代码) ---

	return (
		<div className='h-screen flex flex-col bg-slate-50 font-sans'>
			{/* 顶部栏 */}
			<header className='shrink-0 bg-white border-b shadow-md'>
				<div className='max-w-7xl mx-auto px-4 py-2 flex items-center justify-between'>
					<div className='text-xl font-extrabold text-indigo-700'>AI-Kanban 一体化控制台</div>
					<div className='flex items-center gap-3 text-sm'>
						{appMode === APP_MODES.KANBAN && (
								<>
										<label className="text-gray-500 text-xs">
												<input type='file' accept='application/json' onChange={importJSON} className="hidden" id="fileImport"/>
												<button 
														onClick={() => document.getElementById('fileImport').click()} 
														className='px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition'
												>
														导入 JSON
												</button>
										</label>
										<button onClick={exportBoard} className='px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition'>导出看板</button>
										<button onClick={exportChatLog} className='px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition'>导出聊天</button>
										<button 
												onClick={() => setAppMode(APP_MODES.WORLD_INFO_SETUP)} 
												className='px-3 py-1.5 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition'
										>
												设置项目世界
										</button>
										<button onClick={openAddTaskModal} className='px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition'>+ 新任务</button>
										
										{/* NEW: 清空任务按钮 */}
										<button onClick={clearAllTasks} className='px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition'>清空任务</button>
										
										<button onClick={resetAll} className='px-3 py-1.5 rounded-lg bg-rose-900 text-white hover:bg-rose-800 transition'>重置所有</button>
								</>
						)}
						{appMode === APP_MODES.WORLD_INFO_SETUP && (
								<div className='text-sm text-purple-600 font-semibold'>项目设置中...</div>
						)}
					</div>
				</div>
			</header>

			{/* 主体：左聊天/设置 + 右看板/引导 */}
			<div className='flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-4 p-4 overflow-auto'>
				
				{/* 左侧区域 (聊天或设置组件) */}
				{appMode === APP_MODES.WORLD_INFO_SETUP ? (
						<WorldInfoSetup 
								currentWorldInfo={worldInfo}
								setWorldInfo={setWorldInfo}
								setAppMode={setAppMode}
								isAiThinking={isAiThinking}
								setIsAiThinking={setIsAiThinking}
								apiKey={apiKey}
								setMessage={setMessage}
								chat={chat}
								appendChat={appendChat}
								inputRef={inputRef}
						/>
				) : (
						<section className='rounded-2xl bg-white border shadow-xl flex flex-col overflow-hidden h-[80vh] md:h-full'>
								<div className='px-4 py-3 border-b text-base font-semibold text-slate-700 bg-gray-50'>AI 对话区（增量 Agent）</div>
								<div className='flex-1 p-4 overflow-y-auto flex flex-col'>
										{/* 聊天内容 */}
										{chat.map((m, i) => (
											<div key={i} className={`mb-3 p-2 rounded-lg max-w-[90%] ${m.role === 'user' ? 'bg-indigo-50 text-slate-900 self-end ml-auto' : 'bg-gray-100 text-slate-700 self-start mr-auto'}`}>
												<div className='text-[13px]'>
													<span className={`font-bold ${m.role === 'user' ? 'text-indigo-600' : 'text-emerald-600'}`}>{m.role === 'user' ? '你' : 'AI'}：</span>
													{m.text}
												</div>
												{m.time && <span className='text-[10px] text-gray-400 block mt-0.5'>{m.time}</span>}
											</div>
										))}
										
										{/* AI 加载指示器 */}
										{isAiThinking && (
											<div className='flex items-center text-sm text-indigo-500 mt-2 p-2 self-start'>
												<svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
													<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
													<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
											placeholder={isAiThinking ? "请等待 AI 响应..." : (!apiKey ? "请先配置 API Key" : "输入你的需求，如：t-003 被外部依赖阻塞")} 
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


				{/* 右侧区域 (看板或世界信息展示) */}
				<section className='md:col-span-2 flex flex-col gap-4 overflow-y-auto'>
					
						{appMode === APP_MODES.KANBAN && (
								<>
										{/* 指标卡片 (现在以 Story Points 计算) */}
										<div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
												<div className='rounded-xl bg-white shadow-lg p-4 transition-transform hover:scale-[1.02]'>
													<div className='text-xs text-gray-500'>总任务 (点数)</div>
													<div className='text-3xl font-bold text-slate-800 mt-1'>{metrics.totalPoints} <span className='text-base text-gray-500'>({metrics.total}个任务)</span></div>
													<div className='text-xs text-gray-600 mt-1'>
														Done {metrics.points.done} · Doing {metrics.points.doing} · ToDo {metrics.points.todo}
													</div>
												</div>
												<div className='rounded-xl bg-white shadow-lg p-4 transition-transform hover:scale-[1.02]'>
													<div className='text-xs text-gray-500'>平均 Lead / Cycle（天/任务）</div>
													<div className='text-3xl font-bold text-indigo-600 mt-1'>{metrics.avgLead} / {metrics.avgCycle}</div>
												</div>
												<div className='rounded-xl bg-white shadow-lg p-4 transition-transform hover:scale-[1.02]'>
													<div className='text-xs text-gray-500'>吞吐量 (7天/点数)</div>
													<div className='text-3xl font-bold text-emerald-600 mt-1'>{metrics.throughput7d}</div>
													<div className='text-xs text-gray-600 mt-1'>WIP/TH: {metrics.wipToTh || '—'}</div>
												</div>
												<div className='rounded-xl bg-white shadow-lg p-4 transition-transform hover:scale-[1.02]'>
													<div className='text-xs text-gray-500'>WIP (点数) / 阻塞任务数</div>
													<div className='text-3xl font-bold text-amber-600 mt-1'>{metrics.wip} / <span className={metrics.counts.blocked > 0 ? 'text-red-500' : 'text-green-500'}>{metrics.counts.blocked}</span></div>
												</div>
										</div>

										{/* 视图切换 Tabs */}
										<div className='flex border-b border-gray-200 bg-white rounded-t-xl p-2 shadow-sm'>
												{['kanban', 'cfd', 'burndown'].map((v) => (
													<button
														key={v}
														onClick={() => setView(v)}
														className={`
															px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-150 ease-in-out
															${v === view 
																? 'bg-indigo-100 text-indigo-700' 
																: 'text-gray-500 hover:bg-gray-50'
															}
														`}
													>
														{v === 'kanban' && '看板视图'}
														{v === 'cfd' && '累积流图 (CFD)'}
														{v === 'burndown' && '燃尽图 (Burndown)'}
													</button>
												))}
										</div>

										{/* 视图内容区 */}
										<div className='flex-1 overflow-y-auto bg-white rounded-b-2xl shadow-xl p-4'>
												{view === 'kanban' && (
													<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
														{columns.map(col => (
															<Column key={col.id} title={col.name} onDrop={(e) => handleDrop(col.name)}>
																{by(col.name).map(t => (
																	<Card key={t.id} task={t} onDragStart={(e, id) => setDragId(id)} onEdit={setEdit} />
																))}
															</Column>
														))}
													</div>
												)}
												{view === 'cfd' && (
														<div className='min-h-[400px] flex flex-col'>
																<h3 className='font-bold text-xl mb-2 text-slate-700'>累积流图 (Cumulative Flow Diagram, CFD)</h3>
																<p className='text-sm text-gray-500 mb-4'>Y轴代表 **Story Points**。线条变宽表示流动健康，水平线表示瓶颈。</p>
																<ResponsiveContainer width="100%" height={350}>
																		<AreaChart data={calculateCfdData(data)}>
																				<CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
																				<XAxis dataKey="date" tickLine={false} style={{ fontSize: '10px' }} />
																				<YAxis style={{ fontSize: '10px' }} />
																				<Tooltip labelFormatter={(label) => `日期: ${label}`} formatter={(value, name) => [`${value} 点`, name]} contentStyle={{ fontSize: '12px', padding: '8px', borderRadius: '8px', border: '1px solid #ccc' }} />
																				<Legend iconType="square" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
																				{COLUMN_ORDER.slice().reverse().map(colName => {
																						const colorConfig = COLUMN_COLORS[colName];
																						return (
																								<Area key={colName} type="monotone" dataKey={colName} stackId="1" stroke={colorConfig.color} fill={colorConfig.color} fillOpacity={0.8} name={colName}/>
																						);
																				})}
																		</AreaChart>
																</ResponsiveContainer>
														</div>
												)}
												{view === 'burndown' && (
														<div className='min-h-[400px] flex flex-col'>
																<h3 className='font-bold text-xl mb-2 text-slate-700'>燃尽图 (Burndown Chart)</h3>
																<p className='text-sm text-gray-500 mb-4'>Y轴代表剩余工作量 (**Story Points**)。实际曲线应保持在范围线下方。</p>
																<ResponsiveContainer width="100%" height={350}>
																		<LineChart data={calculateBurndownData(data)}>
																				<CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
																				<XAxis dataKey="date" tickLine={false} style={{ fontSize: '10px' }} />
																				<YAxis allowDecimals={false} style={{ fontSize: '10px' }} />
																				<Tooltip labelFormatter={(label) => `日期: ${label}`} formatter={(value, name) => [`${value} 点`, name]} contentStyle={{ fontSize: '12px', padding: '8px', borderRadius: '8px', border: '1px solid #ccc' }} />
																				<Legend iconType="line" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
																				<Line type="monotone" dataKey="scope" stroke="#A1A1AA" strokeWidth={2} dot={false} name="总范围 (Story Points)" strokeDasharray="5 5" />
																				<Line type="monotone" dataKey="remaining" stroke="#EF4444" strokeWidth={3} dot={true} name="实际剩余工作" />
																		</LineChart>
																</ResponsiveContainer>
														</div>
												)}
										</div>
								</>
						)}
						{appMode === APP_MODES.WORLD_INFO_SETUP && (
								<div className='p-6 bg-purple-50 rounded-2xl shadow-inner h-full'>
										<h3 className='text-2xl font-bold text-purple-700 mb-4'>当前项目世界信息</h3>
										<pre className='bg-white p-4 rounded-xl text-xs overflow-auto border border-purple-200'>
												{JSON.stringify(worldInfo, null, 2)}
										</pre>
										<p className='mt-4 text-sm text-purple-600 font-medium'>
												Agent 正在左侧引导您修改这些核心元数据。完成后，它将自动带您返回看板。
										</p>
								</div>
						)}
				</section>
			</div>

			{/* 底部提示 */}
			<footer className='shrink-0 bg-white border-t text-[12px] text-gray-600'>
				<div className='max-w-7xl mx-auto px-4 py-2 space-x-2'>
					<span>💡 提示：当前模式：{appMode === APP_MODES.KANBAN ? '看板管理' : '世界信息设置'}。</span>
					<span>→ **请务必在代码中替换 `HARDCODED_API_KEY` 为您的 DeepSeek API Key。**</span>
				</div>
			</footer>
			
			{/* ---------------------------------------------------- */}
			{/* 模态框渲染区域 (保持不变) */}
			{/* ---------------------------------------------------- */}

			{edit && (
				<div className='fixed inset-0 bg-black/40 flex items-end md:items-center md:justify-center z-50' onClick={() => setEdit(null)}>
					<div className='bg-white w-full md:w-[560px] rounded-t-2xl md:rounded-2xl p-6 shadow-2xl' onClick={(e) => e.stopPropagation()}>
						<div className='text-xl font-bold mb-4 text-slate-800'>编辑任务 <span className='text-sm font-normal text-gray-500'>({edit.id})</span></div>
						<form id='editForm' className='grid grid-cols-2 gap-4'>
							<label className='text-xs block font-medium text-gray-700'>标题<input name='title' defaultValue={edit.title} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'/></label>
							<label className='text-xs block font-medium text-gray-700'>模块
								<input name='module' defaultValue={edit.module || ''} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'/>
							</label>
							<label className='text-xs block font-medium text-gray-700'>状态
								<select name='status' defaultValue={edit.status} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'>
									<option>To Do</option><option>In Progress</option><option>Review</option><option>Done</option>
								</select>
							</label>
							<label className='text-xs block font-medium text-gray-700'>级别
								<select name='level' defaultValue={edit.level || 'Task'} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'>
									<option>Task</option><option>Story</option><option>Epic</option>
								</select>
							</label>
							<label className='text-xs block font-medium text-gray-700'>负责人（逗号分隔）<input name='owner' defaultValue={(edit.owner || []).join(', ')} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'/></label>
							
							<label className='text-xs block font-medium text-gray-700'>创建<input type='datetime-local' name='created_at' defaultValue={edit.created_at ? edit.created_at.slice(0, 16) : ''} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'/></label>
							<label className='text-xs block font-medium text-gray-700'>开始<input type='datetime-local' name='started_at' defaultValue={edit.started_at ? edit.started_at.slice(0, 16) : ''} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'/></label>
							<label className='text-xs block font-medium text-gray-700'>完成<input type='datetime-local' name='finished_at' defaultValue={edit.finished_at ? edit.finished_at.slice(0, 16) : ''} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'/></label>
							<label className='text-xs block font-medium text-gray-700'>截止<input type='datetime-local' name='due_at' defaultValue={edit.due_at ? edit.due_at.slice(0, 16) : ''} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'/></label>
							<label className='text-xs block font-medium text-gray-700'>依赖任务 ID（逗号分隔）<input name='depends_on' defaultValue={(edit.depends_on || []).join(', ')} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'/></label>
							<label className='col-span-2 text-xs block font-medium text-gray-700'>阻塞原因（清除内容以解除阻塞）<input name='block_reason' defaultValue={edit.block_reason || ''} className='mt-1 w-full border rounded-lg px-3 py-2 text-sm'/></label>
						</form>
						<div className='mt-6 flex justify-between'>
							<button 
								className='px-4 py-2 rounded-lg bg-rose-100 text-rose-600 hover:bg-rose-200 text-sm font-semibold transition' 
								onClick={() => handleDeleteTask(edit)}
							>
								删除任务
							</button>
							<div className='flex gap-3'>
								<button className='px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-sm font-semibold transition' onClick={() => setEdit(null)}>取消</button>
								<button className='px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold transition' onClick={onEditSave}>保存</button>
							</div>
						</div>
					</div>
				</div>
			)}
			
			{showResetConfirm && (
				<ResetConfirmModal 
					onClose={() => setShowResetConfirm(false)}
					onConfirm={handleResetConfirm}
				/>
			)}
			
			{showClearTasksConfirm && ( // NEW: 清空任务模态框
				<ClearTasksConfirmModal
						onClose={() => setShowClearTasksConfirm(false)}
						onConfirm={handleClearTasksConfirm}
				/>
			)}
			
			{taskToDelete && (
				<DeleteConfirmModal 
					task={taskToDelete}
					onClose={() => setTaskToDelete(null)}
					onConfirm={handleDeleteTaskConfirm}
				/>
			)}

			{showAddTaskModal && (
				<AddTaskModal
					onClose={() => setShowAddTaskModal(false)}
					onSave={handleAddTaskSubmit}
				/>
			)}
			
			{message && (
				<MessageBox
					message={message}
					onClose={() => setMessage(null)}
				/>
			)}
		</div>
	);
}
