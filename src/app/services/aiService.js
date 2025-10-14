/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 封装与 DeepSeek API 的交互，根据不同模式选择相应的 system prompt 与响应 schema。
 * - 处理超时控制、API Key 选择以及响应解析。
 *
 * Implementation Notes / 实现方式:
 * - 构建统一的消息数组，将 schema 以 JSON 字符串附加到系统提示中，确保 AI 返回严格的 JSON。
 * - 通过 `response_format: json_object` 强制 DeepSeek 以 JSON 返回。
 *
 * Pending / 未完成:
 * - 未实现快/慢模型切换、流式响应或重试机制。
 * - 缺少错误日志上报与更细粒度的异常分类。
 *
 * Next Steps / 后续计划:
 * - 引入多模型路由与分层 prompt 管理，将废弃项目流程相关指令纳入。
 * - 支持 AbortController 的外部控制以及 UI 级别的进度提示。
 */
import { APP_MODES } from '../constants/appModes';
import { DEEPSEEK_BASE_URL, DEEPSEEK_MODEL, HARDCODED_API_KEY } from '../config/apiConfig';
import { CLASSIFIER_INTENT_SCHEMA, KANBAN_PATCH_SCHEMA, WORLD_INFO_SCHEMA } from './aiSchemas';

const API_URL = DEEPSEEK_BASE_URL;
const MODEL = DEEPSEEK_MODEL;

const callStructuredJson = async ({
        apiKey,
        systemPrompt,
        responseSchema,
        userPrompt,
        timeoutMs = 25000,
        temperature = 0.1,
        validate,
}) => {
        const useApiKey = apiKey || HARDCODED_API_KEY;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
                        content: `${userPrompt}\n\n请严格返回 JSON 对象。`,
                },
        ];

        const payload = {
                model: MODEL,
                messages,
                temperature,
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
                if (validate) {
                        validate(parsedJson);
                }
                return parsedJson;
        } catch (error) {
                clearTimeout(timeoutId);

                if (error.name === 'AbortError') {
                        console.error(`[CONSOLE_ERROR] AI Request Timed Out (超过 ${timeoutMs / 1000} 秒未响应).`);
                        throw new Error(`AI Request Timed Out (超过 ${timeoutMs / 1000} 秒未响应).`);
                }

                console.error('[CONSOLE_ERROR] Error when calling DeepSeek API:', error);
                throw new Error(`AI Communication Failure: ${error.message}`);
        }
};

export const generatePatch = async (apiKey, mode, fullPrompt) => {
        let systemPrompt;
        let responseSchema;

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
                        6. \`world_patch.moduleList\` 用于标记并行推进的任务块（例如：睡眠区、饮食区、运动区或不同系统模块）。如果用户尚未提到并行模块，请返回空数组或保留历史值，不要强行杜撰。
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

                        **工作流约束:** 任务移动必须遵循 **To Do -> Designing -> In Progress -> Code Review -> QA -> Done** 的线性顺序。**禁止跳过阶段，除非用户明确要求。**

                        5.  **历史一致性 Historical consistency:** 在创建 event_add、回填 created_at、due_at 或修改 status 时，必须先检查现有任务状态与事件时间戳，确保不会出现时间线矛盾。例如，若任务已标记为 Done，绝不可再插入其“开始”事件；若确需重写历史，必须先征得用户明确同意，并在单次补丁中同步提供所有必要的逆向更新以保持一致。若无法确认，请向用户说明风险并请求进一步指示。
                `;
        }

        return callStructuredJson({
                apiKey,
                systemPrompt,
                responseSchema,
                userPrompt: fullPrompt,
                timeoutMs: 25000,
                validate: (parsedJson) => {
                        if (!parsedJson.ai_response) {
                                throw new Error('AI response validation failed. Missing ai_response.');
                        }

                        if (mode === APP_MODES.KANBAN && !Array.isArray(parsedJson.patch_instructions)) {
                                throw new Error('Kanban mode validation failed. Missing patch_instructions array.');
                        }
                        if (mode === APP_MODES.WORLD_INFO_SETUP && !parsedJson.status) {
                                throw new Error('Setup mode validation failed. Missing status field.');
                        }
                },
        });
};

export const classifyIntent = async (apiKey, { userInput, currentProject, worldInfo, archivedProjects, previousIntents }) => {
        const systemPrompt = `
                你是一个前端内部的「轻量判定 Agent」，负责在用户的自然语言命令进入主流程前进行分类。
                你的输出只被系统使用，**不要**编写任何给用户看的话。

                你的职责：
                1. 判断命令属于「NEW_PROJECT」(开启/切换到全新项目)、「CURRENT_PROJECT」(继续当前项目事务)、「ARCHIVED_PROJECT」(请求查看旧项目)、或无法判断的「UNKNOWN」。
                2. 当返回 NEW_PROJECT 或 ARCHIVED_PROJECT 时，请在 meta 字段里告知是否需要二次确认 (requiresConfirmation)。
                3. 如果是 ARCHIVED_PROJECT，请补充 \`archivedResolution\`：LIST=需要列出目录；SPECIFIC=用户已给出具体项目；MERGE=用户想合并旧项目；NONE=未说明。
                4. 给出简短的中文 reason，用于在调试日志中解释分类原因。
                5. 若能识别到具体项目名称，请填入 meta.targetProjectName。
        `;

        const prompt = `
                【用户最新输入】
                ${userInput}

                【当前项目概要】
                ${JSON.stringify(currentProject || {}, null, 2)}

                【当前项目世界信息摘要】
                ${JSON.stringify(worldInfo || {}, null, 2)}

                【可唤醒的归档项目列表】
                ${JSON.stringify(archivedProjects || [], null, 2)}

                【最近 5 次判定历史】
                ${JSON.stringify(previousIntents || [], null, 2)}
        `;

        return callStructuredJson({
                apiKey,
                systemPrompt,
                responseSchema: CLASSIFIER_INTENT_SCHEMA,
                userPrompt: prompt,
                timeoutMs: 15000,
                validate: (result) => {
                        if (!result.intent) {
                                throw new Error('Classifier missing intent field.');
                        }
                },
        });
};
