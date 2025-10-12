/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 定义项目废弃/重启流程的有限状态机（FSM），并提供上下文生成与状态迁移工具函数。
 * - 记录状态转换历史，方便未来接入调试或审计。
 *
 * Implementation Notes / 实现方式:
 * - `PROJECT_FLOW_STATES` / `PROJECT_FLOW_EVENTS` 给出核心状态与事件枚举。
 * - `reduceProjectFlow` 根据当前状态和事件查找有效迁移，若无匹配则保持原状态。
 * - 元数据 (`metadata`) 可存储额外信息（如旧项目快照摘要），供外层在不同阶段读取。
 *
 * Pending / 未完成:
 * - 尚未写入归档逻辑或与存储层整合，仅提供内存态的状态跟踪。
 * - 缺少单元测试验证非法事件、回滚路径等边界情况。
 *
 * Next Steps / 后续计划:
 * - 与 `useWorkspace`、本地存储结合，实现项目归档与恢复。
 * - 补充命令式 Helper（如 `isAbortInProgress`），并在 App 中根据状态显示不同 UI。
 */

export const PROJECT_FLOW_STATES = {
        KANBAN_ACTIVE: 'KANBAN_ACTIVE',
        CONFIRM_ABORT: 'CONFIRM_ABORT',
        WORLD_INFO_RESET: 'WORLD_INFO_RESET',
        KANBAN_REBOOT: 'KANBAN_REBOOT',
};

export const PROJECT_FLOW_EVENTS = {
        REQUEST_ABORT: 'REQUEST_ABORT',
        CANCEL_ABORT: 'CANCEL_ABORT',
        CONFIRM_ABORT: 'CONFIRM_ABORT',
        WORLD_INFO_COMPLETE: 'WORLD_INFO_COMPLETE',
        RETURN_TO_KANBAN: 'RETURN_TO_KANBAN',
};

const TRANSITIONS = {
        [PROJECT_FLOW_STATES.KANBAN_ACTIVE]: {
                [PROJECT_FLOW_EVENTS.REQUEST_ABORT]: {
                        state: PROJECT_FLOW_STATES.CONFIRM_ABORT,
                },
        },
        [PROJECT_FLOW_STATES.CONFIRM_ABORT]: {
                [PROJECT_FLOW_EVENTS.CANCEL_ABORT]: {
                        state: PROJECT_FLOW_STATES.KANBAN_ACTIVE,
                        clearMetadata: true,
                },
                [PROJECT_FLOW_EVENTS.CONFIRM_ABORT]: {
                        state: PROJECT_FLOW_STATES.WORLD_INFO_RESET,
                },
        },
        [PROJECT_FLOW_STATES.WORLD_INFO_RESET]: {
                [PROJECT_FLOW_EVENTS.CANCEL_ABORT]: {
                        state: PROJECT_FLOW_STATES.KANBAN_ACTIVE,
                        clearMetadata: true,
                },
                [PROJECT_FLOW_EVENTS.WORLD_INFO_COMPLETE]: {
                        state: PROJECT_FLOW_STATES.KANBAN_REBOOT,
                },
        },
        [PROJECT_FLOW_STATES.KANBAN_REBOOT]: {
                [PROJECT_FLOW_EVENTS.RETURN_TO_KANBAN]: {
                        state: PROJECT_FLOW_STATES.KANBAN_ACTIVE,
                        clearMetadata: true,
                },
        },
};

export const createProjectFlowContext = (state = PROJECT_FLOW_STATES.KANBAN_ACTIVE) => ({
        state,
        history: [],
        metadata: {},
});

export const reduceProjectFlow = (context, action) => {
        const { state, history, metadata } = context;
        const { type, payload } = action;
        const config = TRANSITIONS[state]?.[type];

        if (!config) {
                return context;
        }

        const nextState = typeof config.state === 'function' ? config.state(payload, context) : config.state;
        const nextMetadata = config.clearMetadata ? {} : { ...metadata, ...(payload?.metadata || {}) };

        return {
                state: nextState,
                history: [
                        ...history,
                        {
                                event: type,
                                from: state,
                                to: nextState,
                                at: new Date().toISOString(),
                        },
                ],
                metadata: nextMetadata,
        };
};

export const isAbortFlowActive = (flowState) =>
        flowState === PROJECT_FLOW_STATES.CONFIRM_ABORT || flowState === PROJECT_FLOW_STATES.WORLD_INFO_RESET;
