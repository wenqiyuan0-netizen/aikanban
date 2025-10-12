/**
 * File Overview · 文件说明
 * -----------------------------------------------------------------------------
 * Completed / 已完成:
 * - 负责将世界信息 Agent 返回的结构化补丁合并到当前项目数据中，并同步成员列表。
 *
 * Implementation Notes / 实现方式:
 * - 通过 Map 缓存现有成员，确保新旧成员按 ID 覆盖或追加。
 * - 更新世界信息后刷新看板更新时间戳，保持指标一致性。
 *
 * Pending / 未完成:
 * - 未处理附件、虚拟时间轴或复杂的嵌套字段。
 * - 缺少对必填字段的校验。
 *
 * Next Steps / 后续计划:
 * - 配合世界信息向导，补充 schema 校验与字段默认值处理。
 * - 支持将世界信息摘要写入专用存储，供新项目启动时复用。
 */
import { clone } from '../utils/clone';
import { nowISO } from '../utils/dateUtils';

export function applyWorldPatch(currentData, worldPatch) {
        const nextData = clone(currentData);

        nextData.worldInfo = { ...nextData.worldInfo, ...worldPatch };

        const newMembersList = worldPatch.memberList || [];
        const updatedMembers = [];
        const existingMembersMap = new Map(nextData.members.map((member) => [member.id, member]));

        newMembersList.forEach((newMember) => {
                const existingMember = existingMembersMap.get(newMember.id);
                if (existingMember) {
                        updatedMembers.push({ ...existingMember, ...newMember });
                } else {
                        updatedMembers.push(newMember);
                }
        });

        nextData.members = updatedMembers;
        nextData.worldInfo.memberList = updatedMembers;
        nextData.board.last_update = nowISO();

        return nextData;
}
