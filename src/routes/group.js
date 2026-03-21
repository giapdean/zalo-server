// ============================================================
// Group Routes — CRUD, members, links, settings
// ============================================================
import { Router } from 'express';
import { sessionManager } from '../session-manager.js';

const router = Router();

const handler = (fn) => async (req, res) => {
  try { res.json({ success: true, ...(await fn(req) || {}) }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

router.get('/groups', handler(async (req) => ({ data: await sessionManager.getGroups(req.userEmail) })));
router.get('/group-info', handler(async (req) => ({ data: await sessionManager.getGroupInfo(req.userEmail, req.query.groupId) })));
router.get('/group-members', handler(async (req) => ({ data: await sessionManager.getGroupMembersInfo(req.userEmail, req.query.groupId) })));
router.post('/create-group', handler(async (req) => { await sessionManager.createGroup(req.userEmail, req.body.name, req.body.memberIds); return { message: 'Đã tạo nhóm' }; }));
router.post('/group-add', handler(async (req) => { await sessionManager.addUserToGroup(req.userEmail, req.body.groupId, req.body.userId); }));
router.post('/group-remove', handler(async (req) => { await sessionManager.removeUserFromGroup(req.userEmail, req.body.groupId, req.body.userId); }));
router.post('/group-rename', handler(async (req) => { await sessionManager.changeGroupName(req.userEmail, req.body.groupId, req.body.name); }));
router.post('/group-change-avatar', handler(async (req) => { await sessionManager.changeGroupAvatar(req.userEmail, req.body.groupId, req.body.avatarPath); }));
router.post('/group-change-owner', handler(async (req) => { await sessionManager.changeGroupOwner(req.userEmail, req.body.groupId, req.body.newOwnerId); }));
router.post('/group-add-deputy', handler(async (req) => { await sessionManager.addGroupDeputy(req.userEmail, req.body.groupId, req.body.userId); }));
router.post('/group-remove-deputy', handler(async (req) => { await sessionManager.removeGroupDeputy(req.userEmail, req.body.groupId, req.body.userId); }));
router.post('/group-block-member', handler(async (req) => { await sessionManager.addGroupBlockedMember(req.userEmail, req.body.groupId, req.body.userId); }));
router.post('/group-unblock-member', handler(async (req) => { await sessionManager.removeGroupBlockedMember(req.userEmail, req.body.groupId, req.body.userId); }));
router.get('/group-blocked', handler(async (req) => ({ data: await sessionManager.getGroupBlockedMembers(req.userEmail, req.query.groupId) })));
router.get('/group-pending', handler(async (req) => ({ data: await sessionManager.getPendingGroupMembers(req.userEmail, req.query.groupId) })));
router.post('/group-review-pending', handler(async (req) => { await sessionManager.reviewPendingMember(req.userEmail, req.body.groupId, req.body.userId, req.body.action); }));
router.post('/group-leave', handler(async (req) => { await sessionManager.leaveGroup(req.userEmail, req.body.groupId); }));
router.post('/group-disperse', handler(async (req) => { await sessionManager.disperseGroup(req.userEmail, req.body.groupId); }));
router.get('/group-history', handler(async (req) => ({ data: await sessionManager.getGroupChatHistory(req.userEmail, req.query.groupId, req.query.lastMsgId || '0') })));
router.post('/group-link-enable', handler(async (req) => ({ data: await sessionManager.enableGroupLink(req.userEmail, req.body.groupId) })));
router.post('/group-link-disable', handler(async (req) => { await sessionManager.disableGroupLink(req.userEmail, req.body.groupId); }));
router.get('/group-link', handler(async (req) => ({ data: await sessionManager.getGroupLinkDetail(req.userEmail, req.query.groupId) })));
router.get('/group-link-info', handler(async (req) => ({ data: await sessionManager.getGroupLinkInfo(req.userEmail, req.query.link) })));
router.post('/group-join-link', handler(async (req) => { await sessionManager.joinGroupLink(req.userEmail, req.body.link); }));
router.post('/group-invite', handler(async (req) => { await sessionManager.inviteUserToGroups(req.userEmail, req.body.userId, req.body.groupIds); }));
router.post('/group-settings', handler(async (req) => { await sessionManager.updateGroupSettings(req.userEmail, req.body.groupId, req.body.settings); }));
router.post('/group-upgrade', handler(async (req) => { await sessionManager.upgradeGroupToCommunity(req.userEmail, req.body.groupId); }));
router.get('/group-invite-box', handler(async (req) => ({ data: await sessionManager.getGroupInviteBoxList(req.userEmail) })));
router.post('/group-invite-box-delete', handler(async (req) => { await sessionManager.deleteGroupInviteBox(req.userEmail, req.body.groupId); }));

// === POLLS ===
router.post('/create-poll', handler(async (req) => { return { data: await sessionManager.createPoll(req.userEmail, req.body.groupId, req.body.question, req.body.options) }; }));
router.post('/vote-poll', handler(async (req) => { await sessionManager.votePoll(req.userEmail, req.body.pollId, req.body.optionIndexes, req.body.groupId); }));
router.get('/poll-detail', handler(async (req) => ({ data: await sessionManager.getPollDetail(req.userEmail, req.query.pollId, req.query.groupId) })));
router.post('/poll-add-options', handler(async (req) => { await sessionManager.addPollOptions(req.userEmail, req.body.pollId, req.body.options, req.body.groupId); }));
router.post('/poll-lock', handler(async (req) => { await sessionManager.lockPoll(req.userEmail, req.body.pollId, req.body.groupId); }));
router.post('/poll-share', handler(async (req) => { await sessionManager.sharePoll(req.userEmail, req.body.pollId, req.body.groupId, req.body.dstThreadId, req.body.dstThreadType || 'group'); }));

export default router;
