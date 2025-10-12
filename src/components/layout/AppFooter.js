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
