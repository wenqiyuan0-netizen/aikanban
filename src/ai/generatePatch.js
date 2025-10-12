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
