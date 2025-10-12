/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 显示应用底部提示：当前模式、安全提醒、API Key 配置说明。
 *
 * Implementation Notes / 实现方式:
 * - 通过 props 读取模式枚举，动态显示文案。
 *
 * Pending / 未完成:
 * - 缺少国际化与权限区分提示。
 * - 未展示版本号或状态机信息。
 *
 * Next Steps / 后续计划:
 * - 根据多项目状态提供更多上下文（当前项目名、最后更新时间）。
 * - 加入链接（帮助文档、隐私政策）。
 */
import React from 'react';
import { APP_MODES } from '../../app/constants/appModes';

export function AppFooter({ appMode }) {
        return (
                <footer className='shrink-0 border-t bg-white'>
                        <div className='max-w-7xl mx-auto px-4 py-3 text-xs text-gray-600 flex flex-col gap-1'>
                                <span>💡 提示：当前模式：{appMode === APP_MODES.KANBAN ? '看板管理' : '世界信息设置'}。</span>
                                <span>⚠️ 在与 AI 交互时请勿填写敏感信息，所有看板内容都会被发送至 AI 服务商。</span>
                                <span>→ 请于 `.env` 或安全位置配置 DeepSeek API Key，默认值仅供本地调试。</span>
                                <span>→ **请务必在代码中替换 `HARDCODED_API_KEY` 为您的 DeepSeek API Key。**</span>
                        </div>
                </footer>
        );
}
