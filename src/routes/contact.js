// ============================================================
// Contact Routes — Friends, find, alias, social, block
// ============================================================
import { Router } from 'express';
import { sessionManager } from '../session-manager.js';

const router = Router();

const handler = (fn) => async (req, res) => {
  try { res.json({ success: true, ...(await fn(req) || {}) }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// === CONTACTS ===
router.get('/friends', handler(async (req) => {
  const friends = await sessionManager.getFriends(req.userEmail);
  const list = (friends || []).map(f => ({
    id: f.userId || f.uid || f.id,
    name: f.displayName || f.zaloName || f.name || 'Unknown',
    phone: f.phoneNumber || f.phone || null,
    avatar: f.avatar || null
  }));
  return { count: list.length, friends: list };
}));

router.post('/find', handler(async (req) => {
  const { phone } = req.body;
  if (!phone) throw new Error('Thiếu số điện thoại');
  const result = await sessionManager.findUser(req.userEmail, phone);
  return { user: result };
}));

router.get('/find-username', handler(async (req) => {
  const data = await sessionManager.findUserByUsername(req.userEmail, req.query.username);
  return { user: data };
}));

router.get('/user-info', handler(async (req) => {
  const data = await sessionManager.getUserInfo(req.userEmail, req.query.userId);
  return { user: data };
}));

router.post('/multi-users', handler(async (req) => {
  const data = await sessionManager.getMultiUsersByPhones(req.userEmail, req.body.phones);
  return { users: data };
}));

router.post('/friend-alias', handler(async (req) => {
  await sessionManager.changeFriendAlias(req.userEmail, req.body.userId, req.body.alias);
}));

router.post('/friend-alias-remove', handler(async (req) => {
  await sessionManager.removeFriendAlias(req.userEmail, req.body.userId);
}));

router.get('/alias-list', handler(async (req) => {
  return { data: await sessionManager.getAliasList(req.userEmail) };
}));

router.get('/close-friends', handler(async (req) => {
  return { data: await sessionManager.getCloseFriends(req.userEmail) };
}));

router.get('/friend-onlines', handler(async (req) => {
  return { data: await sessionManager.getFriendOnlines(req.userEmail) };
}));

router.get('/friend-recommendations', handler(async (req) => {
  return { data: await sessionManager.getFriendRecommendations(req.userEmail) };
}));

router.post('/last-online', handler(async (req) => {
  return { data: await sessionManager.lastOnline(req.userEmail, req.body.userIds) };
}));

router.get('/friend-board', handler(async (req) => {
  return { data: await sessionManager.getFriendBoardList(req.userEmail) };
}));

// === SOCIAL (Friend Requests) ===
router.post('/friend-request', handler(async (req) => {
  await sessionManager.sendFriendRequest(req.userEmail, req.body.userId, req.body.message || '');
}));

router.post('/accept-friend', handler(async (req) => {
  await sessionManager.acceptFriendRequest(req.userEmail, req.body.userId);
}));

router.post('/reject-friend', handler(async (req) => {
  await sessionManager.rejectFriendRequest(req.userEmail, req.body.userId);
}));

router.post('/undo-friend-request', handler(async (req) => {
  await sessionManager.undoFriendRequest(req.userEmail, req.body.userId);
}));

router.get('/sent-friend-requests', handler(async (req) => {
  return { data: await sessionManager.getSentFriendRequests(req.userEmail) };
}));

router.get('/friend-request-status', handler(async (req) => {
  return { data: await sessionManager.getFriendRequestStatus(req.userEmail, req.query.userId) };
}));

router.post('/remove-friend', handler(async (req) => {
  await sessionManager.removeFriend(req.userEmail, req.body.userId);
}));

router.post('/block', handler(async (req) => {
  await sessionManager.blockUser(req.userEmail, req.body.userId);
}));

router.post('/unblock', handler(async (req) => {
  await sessionManager.unblockUser(req.userEmail, req.body.userId);
}));

router.post('/block-feed', handler(async (req) => {
  await sessionManager.blockViewFeed(req.userEmail, req.body.userId);
}));

export default router;
