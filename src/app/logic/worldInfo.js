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
