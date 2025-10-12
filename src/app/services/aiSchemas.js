/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 以 JSON Schema 形式描述看板与世界信息 Agent 需要遵循的响应结构。
 *
 * Implementation Notes / 实现方式:
 * - `KANBAN_PATCH_SCHEMA` 与 `WORLD_INFO_SCHEMA` 均约束 AI 输出字段，便于前端安全解析。
 * - Schema 包含中文提示，强调语气/语言要求。
 *
 * Pending / 未完成:
 * - 未覆盖多模型（快/慢模型）或不同语言下的 schema 变体。
 * - 缺少对项目废弃/恢复相关的结构化指令定义。
 *
 * Next Steps / 后续计划:
 * - 为新状态机事件（如 `REQUEST_PROJECT_RESET`）补充 schema，并与 prompt 模板保持同步。
 * - 考虑将 schema 转化为可复用的 Zod/TypeScript 类型。
 */
export const CLASSIFIER_INTENT_SCHEMA = {
        type: 'OBJECT',
        properties: {
                intent: {
                        type: 'STRING',
                        enum: ['NEW_PROJECT', 'CURRENT_PROJECT', 'ARCHIVED_PROJECT', 'UNKNOWN'],
                        description: 'Classifier output indicating which workflow should handle the user request.',
                },
                confidence: {
                        type: 'NUMBER',
                        description: 'A float between 0 and 1 representing how confident the classifier is in this decision.',
                },
                reason: {
                        type: 'STRING',
                        description: 'Short natural language summary of why the intent was chosen (Chinese).',
                },
                meta: {
                        type: 'OBJECT',
                        description: 'Additional routing hints for downstream workflows. 所有字段均为可选。',
                        properties: {
                                archivedResolution: {
                                        type: 'STRING',
                                        enum: ['LIST', 'SPECIFIC', 'MERGE', 'NONE'],
                                        description: '当 intent=ARCHIVED_PROJECT 时，指示需要目录视图还是直接打开具体项目。',
                                },
                                targetProjectName: {
                                        type: 'STRING',
                                        description: '当 intent=ARCHIVED_PROJECT 或 NEW_PROJECT 时，给出的项目名称提示。',
                                },
                                requiresConfirmation: {
                                        type: 'BOOLEAN',
                                        description: '是否需要用户在 UI 中进行二次确认，例如废弃当前项目。',
                                },
                                notes: { type: 'STRING', description: '额外的路由说明或后续 Prompt 应注意的事项。' },
                        },
                },
        },
        required: ['intent'],
};

export const KANBAN_PATCH_SCHEMA = {
        type: 'OBJECT',
        properties: {
                ai_response: {
                        type: 'STRING',
                        description:
                                'A friendly, concise, conversational summary of the changes made or any advice based on the request. MUST use an intimate/friendly tone (亲昵的语气) and be in Chinese.',
                },
                patch_instructions: {
                        type: 'ARRAY',
                        description: 'An array of instructions to modify the kanban board state incrementally.',
                        items: {
                                type: 'OBJECT',
                                properties: {
                                        type: { type: 'STRING', enum: ['task_add', 'task_update', 'member_add', 'member_remove', 'event_add'] },
                                        id: { type: 'STRING', description: 'Target ID for update/remove operations.' },
                                        updates: {
                                                type: 'OBJECT',
                                                description: 'Fields to update for task_update operation (only include changed fields).',
                                                properties: {
                                                        title: { type: 'STRING' },
                                                        status: { type: 'STRING', enum: ['To Do', 'In Progress', 'Review', 'Done'] },
                                                        owner: { type: 'ARRAY', items: { type: 'STRING' } },
                                                        block_reason: {
                                                                type: 'STRING',
                                                                nullable: true,
                                                                description: 'Set to non-null string to block, or null/undefined to unblock.',
                                                        },
                                                        due_at: { type: 'STRING' },
                                                        level: { type: 'STRING', enum: ['Epic', 'Story', 'Task'] },
                                                        depends_on: { type: 'ARRAY', items: { type: 'STRING' } },
                                                },
                                        },
                                        details: {
                                                type: 'OBJECT',
                                                description: 'Full details for task_add, member_add, or event_add.',
                                                properties: {
                                                        id: { type: 'STRING' },
                                                        name: { type: 'STRING' },
                                                        role: { type: 'STRING' },
                                                        title: { type: 'STRING' },
                                                        status: { type: 'STRING', enum: ['To Do', 'In Progress', 'Review', 'Done'] },
                                                        owner: { type: 'ARRAY', items: { type: 'STRING' } },
                                                        module: { type: 'STRING' },
                                                        time: { type: 'STRING' },
                                                        type: { type: 'STRING' },
                                                        task_id: { type: 'STRING' },
                                                        level: { type: 'STRING', enum: ['Epic', 'Story', 'Task'] },
                                                        depends_on: { type: 'ARRAY', items: { type: 'STRING' } },
                                                        created_at: { type: 'STRING' },
                                                },
                                        },
                                },
                                required: ['type'],
                        },
                },
        },
        required: ['ai_response', 'patch_instructions'],
};

export const WORLD_INFO_SCHEMA = {
        type: 'OBJECT',
        properties: {
                ai_response: {
                        type: 'STRING',
                        description: 'A friendly, conversational response in Chinese. Should contain the next question or completion confirmation. MUST use an intimate/friendly tone (亲昵的语气).',
                },
                status: { type: 'STRING', enum: ['INCOMPLETE', 'COMPLETE'], description: 'Marks if all required world info fields have been gathered.' },
                world_patch: {
                        type: 'OBJECT',
                        description: 'The partial or complete world information structure based on user input.',
                        properties: {
                                projectName: { type: 'STRING', description: 'Project name (e.g., 实习项目看板)' },
                                projectGoal: { type: 'STRING', description: 'Overall project goal or mission (e.g., 完成结业展示)' },
                                keyDeadline: { type: 'STRING', description: 'Main project deadline in UTC ISO 8601 format.' },
                                moduleList: {
                                        type: 'ARRAY',
                                        items: { type: 'STRING' },
                                        description: 'List of key modules or departments (e.g., WS, IIOT).',
                                },
                                memberList: {
                                        type: 'ARRAY',
                                        items: {
                                                type: 'OBJECT',
                                                properties: {
                                                        id: { type: 'STRING', description: "Unique member ID, usually the name." },
                                                        name: { type: 'STRING', description: "Team member's display name." },
                                                        role: { type: 'STRING', description: "Team member's main role or focus." },
                                                },
                                                required: ['id', 'name'],
                                        },
                                        description: 'List of all team members with their IDs/Names and Roles.',
                                },
                        },
                        required: ['projectName', 'projectGoal', 'keyDeadline', 'moduleList', 'memberList'],
                },
        },
        required: ['ai_response', 'status'],
};
