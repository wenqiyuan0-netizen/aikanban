/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 定义看板 Agent 初始化对话消息，用于提醒用户当前补丁模式及状态约束。
 *
 * Implementation Notes / 实现方式:
 * - 以系统消息形式提供背景说明，作为 `useWorkspace` 初始化聊天记录的起点。
 *
 * Pending / 未完成:
 * - 尚未提供世界信息 Agent 的初始提示常量。
 * - 缺少多语言版本与 prompt 版本号映射。
 *
 * Next Steps / 后续计划:
 * - 在 prompt 管理模块建立统一的初始消息表，根据语言/模型动态加载。
 */
export const INITIAL_KANBAN_CHAT = [
        {
                role: 'system',
                text: 'AI-Agent 已连接，已升级为【增量补丁模式】。**Blocked 状态已移除**，请使用 `block_reason` 属性来标记任务阻塞。',
        },
];
