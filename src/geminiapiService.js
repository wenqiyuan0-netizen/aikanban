// src/apiService.js

const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent";

// 系统指令，定义 AI 代理的角色和返回格式
const SYSTEM_PROMPT = (nowISO) => `
  你是一个智能看板管理代理 (AI Kanban Agent)。
  你的任务是根据用户的请求，分析当前看板状态，并返回一个包含【增量补丁指令】(patch_instructions) 的 JSON 对象，以及你的回复文本 (ai_response)。
  你绝对不能返回完整的看板数据，只能返回需要执行的变更指令。

  **核心指令类型 (patch_instructions 数组):**
  1. **task_update**: 修改现有任务的属性。({ type: "task_update", id: "t-XXX", updates: { status: "Done", finished_at: "${nowISO()}" } })
  2. **task_add**: 新增任务。({ type: "task_add", details: { id: "t-XXX", title: "新任务标题", status: "To Do", module: "IIOT", created_at: "${nowISO()}" } })
  3. **member_add**: 新增成员。({ type: "member_add", details: { id: "D", name: "D", role: "技术支持" } })
  4. **member_remove**: 移除成员。({ type: "member_remove", id: "B" }})
  5. **event_add**: 新增事件记录。({ type: "event_add", details: { time: "${nowISO()}", type: "update", task_id: "t-XXX", user: "ai" } })
  
  **智能与提醒职责:**
  - **数据补全:** 如果用户创建/更新任务但缺少截止日期，请在 ai_response 中礼貌提醒用户。
  - **主动提醒:** 参考看板健康状态分析，主动提醒逾期、阻塞或临近截止日期的任务。
  
  你必须严格按照给定 JSON Schema 格式返回结果，不包含任何解释性文本或 Markdown 标记。
`;


/**
 * 调用 Gemini Agent API，获取看板更新指令。
 * @param {string} apiKey - 用户提供的 API Key。
 * @param {string} prompt - 包含用户指令和看板上下文的完整提示。
 * @param {function} nowISO - 用于生成 ISO 格式时间戳的函数。
 * @returns {Promise<object>} - 包含 AI 回复和增量补丁的 JSON 对象 { ai_response, patch_instructions }。
 */
export async function generateKanbanPatches(apiKey, prompt, nowISO) {
  if (!apiKey) {
    // 如果没有 Key，抛出异常，让 App.js 处理 UI 提示
    throw new Error('API Key is missing. Please enter your key to use the AI Agent.');
  }

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT(nowISO) }] },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          "ai_response": { "type": "STRING", "description": "对用户的自然语言回复，应简洁说明已执行的操作和主动提醒。" },
          "patch_instructions": { 
            "type": "ARRAY", 
            "items": { 
                "type": "OBJECT",
                "properties": {
                    "type": { "type": "STRING" },
                    "id": { "type": "STRING" },
                    // --- 最终修复点：添加一个占位符属性以满足 API 结构验证，要求 properties 非空。 ---
                    "updates": { 
                        "type": "OBJECT",
                        "description": "任务更新字段的键值对",
                        "properties": {
                            "__placeholder": { "type": "STRING", "description": "此字段仅用于满足API的JSON Schema验证，AI应忽略它并直接返回所需的更新字段。" }
                        }
                    },
                    "details": {
                        "type": "OBJECT",
                        "description": "新增任务/成员的详细信息",
                        "properties": {
                            "__placeholder": { "type": "STRING", "description": "此字段仅用于满足API的JSON Schema验证，AI应忽略它并直接返回所需的详情字段。" }
                        }
                    }
                },
                "description": "看板修改指令 (task_update, task_add, member_add, etc.)."
            }, 
            "description": "Agent 必须返回的看板修改指令数组。" 
          }
        },
        "propertyOrdering": ["ai_response", "patch_instructions"]
      }
    }
  };

  try {
    const response = await fetch(`${API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API 错误: HTTP ${response.status} - ${errorText.substring(0, 200) || '（无响应体）'}`);
    }

    const result = await response.json();
    const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!jsonText) {
      throw new Error('未能从 AI 接收到有效的 JSON 响应。');
    }
    
    // 返回解析后的 JSON 对象 { ai_response, patch_instructions }
    return JSON.parse(jsonText);

  } catch (error) {
    // 重新抛出错误，让调用者 (App.js) 处理 UI 层的错误提示
    console.error("API call failed:", error);
    throw error;
  }
}
