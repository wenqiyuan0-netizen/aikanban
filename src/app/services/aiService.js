import { APP_MODES } from '../constants/appModes';
import { DEEPSEEK_BASE_URL, DEEPSEEK_MODEL, HARDCODED_API_KEY } from '../config/apiConfig';
import { KANBAN_PATCH_SCHEMA, WORLD_INFO_SCHEMA } from './aiSchemas';

export const generatePatch = async (apiKey, mode, fullPrompt) => {
        const useApiKey = apiKey || HARDCODED_API_KEY;
        const API_URL = DEEPSEEK_BASE_URL;

        let systemPrompt;
        let responseSchema;
        const model = DEEPSEEK_MODEL;

        const controller = new AbortController();
        const timeoutMs = 25000;
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
        } else {
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

        const messages = [
                {
                        role: 'system',
                        content:
                                systemPrompt +
                                '\n\n--- STRUCTURE INSTRUCTION ---\n你的回复必须且仅包含一个 raw JSON 对象，严格遵循以下 JSON Schema 的定义。不得包含任何额外的前缀、后缀文本或 Markdown JSON 格式。结构内容如下:\n' +
                                JSON.stringify(responseSchema, null, 2),
                },
                {
                        role: 'user',
                        content: `${fullPrompt}\n\n请严格返回 JSON 对象。`,
                },
        ];

        const payload = {
                model,
                messages,
                temperature: 0.1,
                response_format: { type: 'json_object' },
        };

        try {
                const response = await fetch(API_URL, {
                        method: 'POST',
                        headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${useApiKey}`,
                        },
                        body: JSON.stringify(payload),
                        signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                        const errorText = await response.text();
                        if (response.status === 401) {
                                throw new Error(`Authentication Failed (401). Please check your DeepSeek API Key: ${errorText}`);
                        }
                        throw new Error(`API returned status ${response.status}: ${errorText}`);
                }

                const result = await response.json();
                const jsonString = result.choices?.[0]?.message?.content;

                if (!jsonString) {
                        throw new Error('AI response content is empty or malformed. DeepSeek model might not have returned JSON.');
                }

                const parsedJson = JSON.parse(jsonString);

                if (!parsedJson.ai_response) {
                        throw new Error('AI response validation failed. Missing ai_response.');
                }

                if (mode === APP_MODES.KANBAN && !Array.isArray(parsedJson.patch_instructions)) {
                        throw new Error('Kanban mode validation failed. Missing patch_instructions array.');
                }
                if (mode === APP_MODES.WORLD_INFO_SETUP && !parsedJson.status) {
                        throw new Error('Setup mode validation failed. Missing status field.');
                }

                return parsedJson;
        } catch (error) {
                clearTimeout(timeoutId);

                if (error.name === 'AbortError') {
                        console.error(`[CONSOLE_ERROR] AI Request Timed Out (超过 ${timeoutMs / 1000} 秒未响应).`);
                        throw new Error(`AI Request Timed Out (超过 ${timeoutMs / 1000} 秒未响应).`);
                }

                console.error('[CONSOLE_ERROR] Error in generatePatch:', error);
                throw new Error(`AI Communication Failure: ${error.message}`);
        }
};
