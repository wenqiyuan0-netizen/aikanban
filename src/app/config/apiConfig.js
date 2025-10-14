/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 提供 DeepSeek 聊天模型所需的基础配置，包括默认 API Key 占位符、Base URL、模型名称。
 *
 * Implementation Notes / 实现方式:
 * - 默认以硬编码常量作为初始 API Key，便于本地快速验证；实际部署需替换为安全存储方案。
 * - 导出 `initialApiKey` 让上层组件可统一读取初始值。
 *
 * Pending / 未完成:
 * - 未集成安全存储（环境变量 / 后端代理）与多模型切换能力。
 *
 * Next Steps / 后续计划:
 * - 改为从受控设置面板或安全 API 获取密钥，并支持快/慢模型的动态配置。
 */
export const HARDCODED_API_KEY = "sk-20b70ca073e84df1a951e4e942dc6856"; // 请替换为你实际的 DeepSeek API Key
export const initialApiKey = HARDCODED_API_KEY;

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1/chat/completions';
export const DEEPSEEK_MODEL = 'deepseek-chat';
