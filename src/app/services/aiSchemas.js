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
