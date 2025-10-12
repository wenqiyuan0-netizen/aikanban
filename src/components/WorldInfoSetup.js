/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 实现世界信息配置界面：AI 引导用户补充项目元数据，并将结果写回当前项目。
 * - 首次进入时自动推送欢迎消息。
 *
 * Implementation Notes / 实现方式:
 * - 复用 `generatePatch` 调用世界信息 schema，AI 返回 `world_patch` 后合并到当前项目。
 * - 与 `appendChat` 配合保持聊天记录，并通过回调 `onFlowComplete/onFlowAbort` 向外部状态机报告流程进度。
 *
 * Pending / 未完成:
 * - 尚未在组件内直接清理旧聊天，需要依赖上层在进入流程前调用。
 * - 仍缺乏对上传附件、项目模板选择等扩展输入的支持。
 *
 * Next Steps / 后续计划:
 * - 与世界信息摘要模块联动，展示 AI 生成的结构化结果预览。
 * - 增加表单预览、附件上传等功能以丰富世界信息。
 */
import React, { useEffect } from 'react';
import { APP_MODES } from '../app/constants/appModes';
import { generatePatch } from '../app/services/aiService';

export function WorldInfoSetup({
        currentWorldInfo,
        setWorldInfo,
        isAiThinking,
        setIsAiThinking,
        apiKey,
        setMessage,
        worldChat,
        appendChat,
        inputRef,
        onFlowAbort,
        onFlowComplete,
        entryContext,
}) {
        useEffect(() => {
                if (worldChat.length === 0) {
                        appendChat(
                                {
                                        role: 'ai',
                                        text: '嘿，朋友！欢迎进入项目世界信息设置模式。请告诉我您的**项目名称**、**目标**和**主要截止日期**，我会用最亲昵的方式帮助您初始化项目规则。',
                                        time: new Date().toLocaleTimeString(),
                                },
                                APP_MODES.WORLD_INFO_SETUP,
                        );
                }
        }, [appendChat, worldChat.length]);

        const renderEntryHint = () => {
                if (!entryContext) return null;
                if (entryContext.source === 'classifier:new_project') {
                        return '当前世界信息会话来自“新项目”判定，所有配置将覆盖旧项目。';
                }
                if (entryContext.source === 'ai_task_follow_up') {
                        return 'AI 新增任务后触发的补充流程，请完善对应的世界信息。';
                }
                if (entryContext.source === 'manualEntry') {
                        return '你从头部菜单进入了世界信息配置，可以在此更新项目元数据。';
                }
                return null;
        };
        const entryHint = renderEntryHint();

        async function sendWorldMsg() {
                const text = (inputRef.current?.value || '').trim();
                if (!text || isAiThinking) return;

                const userMessage = { role: 'user', text, time: new Date().toLocaleTimeString() };
                appendChat(userMessage, APP_MODES.WORLD_INFO_SETUP);
                inputRef.current.value = '';
                setIsAiThinking(true);

                try {
                        const chatHistory = [...worldChat, userMessage]
                                .map((message) => `[${message.role}]: ${message.text}`)
                                .join('\n');
                        const fullPrompt = `
                                【当前世界信息】: 这是您已经收集到的项目元数据。
                                ${JSON.stringify(currentWorldInfo, null, 2)}
                                ---
                                历史对话:\n${chatHistory}\n
                                ---
                                用户输入：${text}
                        `;

                        const parsedResponse = await generatePatch(apiKey, APP_MODES.WORLD_INFO_SETUP, fullPrompt);

                        appendChat(
                                { role: 'ai', text: parsedResponse.ai_response, time: new Date().toLocaleTimeString() },
                                APP_MODES.WORLD_INFO_SETUP,
                        );

                        if (parsedResponse.status === 'COMPLETE' && parsedResponse.world_patch) {
                                setWorldInfo(parsedResponse.world_patch);
                                setMessage({
                                        title: '项目世界信息已完成！',
                                        body: 'Agent 成功收集到所有项目元数据，看板管理模式已激活。',
                                        type: 'success',
                                });
                                onFlowComplete?.({
                                        worldPatch: parsedResponse.world_patch,
                                        aiResponse: parsedResponse.ai_response,
                                });
                        } else if (parsedResponse.status === 'INCOMPLETE' && parsedResponse.world_patch) {
                                setWorldInfo(parsedResponse.world_patch);
                        }
                } catch (error) {
                        console.error('[CONSOLE_ERROR] AI API Error (Setup Mode):', error);
                        setMessage({
                                title: 'AI 连接错误',
                                body: '设置模式下调用 AI 失败: ' + (error.message || '未知错误'),
                                type: 'error',
                        });
                } finally {
                        setIsAiThinking(false);
                }
        }

        return (
                <section className='rounded-2xl bg-white border shadow-xl flex flex-col overflow-hidden h-[80vh] md:h-full'>
                        <div className='px-4 py-3 border-b text-base font-semibold text-purple-700 bg-purple-50 flex justify-between items-center'>
                                项目世界信息设置
                                <button
                                        onClick={() => onFlowAbort?.()}
                                        className='text-xs px-2 py-1 rounded bg-purple-200 hover:bg-purple-300'
                                >
                                        返回看板 (不保存)
                                </button>
                        </div>
                        <div className='world-chat-window flex-1 p-4 overflow-y-auto flex flex-col'>
                                {entryHint && (
                                        <div className='mb-3 p-3 text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg'>
                                                {entryHint}
                                        </div>
                                )}
                                {worldChat.map((message, index) => (
                                        <div
                                                key={index}
                                                className={`mb-3 p-2 rounded-lg max-w-[90%] ${message.role === 'user' ? 'bg-indigo-50 text-slate-900 self-end ml-auto' : 'bg-gray-100 text-slate-700 self-start mr-auto'}`}
                                        >
                                                <div className='text-[13px]'>
                                                        <span className={`font-bold ${message.role === 'user' ? 'text-indigo-600' : 'text-purple-600'}`}>
                                                                {message.role === 'user' ? '你' : '配置 AI'}：
                                                        </span>
                                                        {message.text}
                                                </div>
                                                {message.time && <span className='text-[10px] text-gray-400 block mt-0.5'>{message.time}</span>}
                                        </div>
                                ))}

                                {isAiThinking && (
                                        <div className='flex items-center text-sm text-indigo-500 mt-2 p-2 self-start'>
                                                <svg className='animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'>
                                                        <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
                                                        <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
                                                </svg>
                                                配置 AI 正在分析信息...
                                        </div>
                                )}
                        </div>
                        <div className='p-3 border-t flex gap-2 bg-gray-50'>
                                <input
                                        ref={inputRef}
                                        disabled={isAiThinking || !apiKey}
                                        className='flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm disabled:bg-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                                        placeholder={isAiThinking ? '请等待 AI 响应...' : '输入项目信息 (如: 项目名是XXX)'}
                                        onKeyDown={(event) => event.key === 'Enter' && sendWorldMsg()}
                                />
                                <button
                                        onClick={sendWorldMsg}
                                        disabled={isAiThinking || !apiKey}
                                        className='px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition disabled:bg-gray-400'
                                >
                                        发送
                                </button>
                        </div>
                </section>
        );
}
