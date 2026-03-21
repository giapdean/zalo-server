// ============================================================
// Utility Routes — Profile, chat mgmt, quick msgs, auto-reply,
// notes, reminders, labels, catalog, misc
// ============================================================
import { Router } from 'express';
import { sessionManager } from '../session-manager.js';

const router = Router();

const handler = (fn) => async (req, res) => {
  try { res.json({ success: true, ...(await fn(req) || {}) }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// === PROFILE ===
router.get('/account-info', handler(async (req) => ({ data: await sessionManager.fetchAccountInfo(req.userEmail) })));
router.post('/update-profile', handler(async (req) => { await sessionManager.updateProfile(req.userEmail, req.body); }));
router.post('/update-bio', handler(async (req) => { await sessionManager.updateProfileBio(req.userEmail, req.body.bio); }));
router.get('/avatar-list', handler(async (req) => ({ data: await sessionManager.getAvatarList(req.userEmail) })));
router.get('/full-avatar', handler(async (req) => ({ data: await sessionManager.getFullAvatar(req.userEmail, req.query.userId) })));
router.get('/avatar-url', handler(async (req) => ({ data: await sessionManager.getAvatarUrlProfile(req.userEmail, req.query.userId) })));
router.post('/active-status', handler(async (req) => { await sessionManager.updateActiveStatus(req.userEmail, req.body.active); }));
router.get('/own-id', handler(async (req) => ({ data: await sessionManager.getOwnId(req.userEmail) })));
router.get('/settings', handler(async (req) => ({ data: await sessionManager.getSettings(req.userEmail) })));
router.post('/update-settings', handler(async (req) => { await sessionManager.updateSettings(req.userEmail, req.body.settings); }));

// === CHAT MANAGEMENT ===
router.post('/delete-chat', handler(async (req) => { await sessionManager.deleteChat(req.userEmail, req.body.threadId, req.body.threadType || 'user'); }));
router.post('/pin-chat', handler(async (req) => { await sessionManager.setPinnedConversations(req.userEmail, req.body.pinnedList); }));
router.get('/pinned-chats', handler(async (req) => ({ data: await sessionManager.getPinConversations(req.userEmail) })));
router.post('/mute-chat', handler(async (req) => { await sessionManager.setMute(req.userEmail, req.body.threadId, req.body.threadType || 'user', req.body.duration || -1); }));
router.get('/muted-chats', handler(async (req) => ({ data: await sessionManager.getMute(req.userEmail) })));
router.post('/hide-chat', handler(async (req) => { await sessionManager.setHiddenConversations(req.userEmail, req.body.threadId, req.body.threadType || 'user'); }));
router.get('/hidden-chats', handler(async (req) => ({ data: await sessionManager.getHiddenConversations(req.userEmail) })));
router.get('/archived-chats', handler(async (req) => ({ data: await sessionManager.getArchivedChatList(req.userEmail) })));
router.post('/archive-chat', handler(async (req) => { await sessionManager.updateArchivedChatList(req.userEmail, req.body.threadId, req.body.threadType || 'user', req.body.archived !== false); }));
router.post('/mark-unread', handler(async (req) => { await sessionManager.addUnreadMark(req.userEmail, req.body.threadId, req.body.threadType || 'user'); }));
router.post('/mark-read', handler(async (req) => { await sessionManager.removeUnreadMark(req.userEmail, req.body.threadId, req.body.threadType || 'user'); }));
router.get('/unread-marks', handler(async (req) => ({ data: await sessionManager.getUnreadMark(req.userEmail) })));
router.get('/auto-delete-chat', handler(async (req) => ({ data: await sessionManager.getAutoDeleteChat(req.userEmail, req.query.threadId) })));
router.post('/auto-delete-chat', handler(async (req) => { await sessionManager.updateAutoDeleteChat(req.userEmail, req.body.threadId, req.body.threadType || 'user', req.body.duration); }));

// === QUICK MESSAGES ===
router.get('/quick-messages', handler(async (req) => ({ data: await sessionManager.getQuickMessageList(req.userEmail) })));
router.post('/add-quick-msg', handler(async (req) => { await sessionManager.addQuickMessage(req.userEmail, req.body.shortcut, req.body.message); }));
router.post('/remove-quick-msg', handler(async (req) => { await sessionManager.removeQuickMessage(req.userEmail, req.body.quickMsgId); }));
router.post('/update-quick-msg', handler(async (req) => { await sessionManager.updateQuickMessage(req.userEmail, req.body.quickMsgId, req.body.shortcut, req.body.message); }));

// === AUTO REPLY ===
router.get('/auto-reply-list', handler(async (req) => ({ data: await sessionManager.getAutoReplyList(req.userEmail) })));
router.post('/create-auto-reply', handler(async (req) => { await sessionManager.createAutoReply(req.userEmail, req.body.message, req.body.enabled !== false); }));
router.post('/update-auto-reply', handler(async (req) => { await sessionManager.updateAutoReply(req.userEmail, req.body.autoReplyId, req.body.message, req.body.enabled); }));
router.post('/delete-auto-reply', handler(async (req) => { await sessionManager.deleteAutoReply(req.userEmail, req.body.autoReplyId); }));

// === NOTES & REMINDERS ===
router.post('/create-note', handler(async (req) => { return { data: await sessionManager.createNote(req.userEmail, req.body.groupId, req.body.content) }; }));
router.post('/edit-note', handler(async (req) => { await sessionManager.editNote(req.userEmail, req.body.noteId, req.body.groupId, req.body.content); }));
router.post('/create-reminder', handler(async (req) => { return { data: await sessionManager.createReminder(req.userEmail, req.body.groupId, req.body.content, req.body.time) }; }));
router.post('/edit-reminder', handler(async (req) => { await sessionManager.editReminder(req.userEmail, req.body.reminderId, req.body.content, req.body.time); }));
router.post('/remove-reminder', handler(async (req) => { await sessionManager.removeReminder(req.userEmail, req.body.reminderId); }));
router.get('/reminders', handler(async (req) => ({ data: await sessionManager.getListReminder(req.userEmail, req.query.groupId || '') })));
router.get('/reminder', handler(async (req) => ({ data: await sessionManager.getReminder(req.userEmail, req.query.reminderId) })));

// === LABELS ===
router.get('/labels', handler(async (req) => ({ data: await sessionManager.getLabels(req.userEmail) })));
router.post('/update-labels', handler(async (req) => { await sessionManager.updateLabels(req.userEmail, req.body.labels); }));

// === CATALOG & PRODUCTS ===
router.get('/catalogs', handler(async (req) => ({ data: await sessionManager.getCatalogList(req.userEmail) })));
router.post('/create-catalog', handler(async (req) => { return { data: await sessionManager.createCatalog(req.userEmail, req.body.name) }; }));
router.post('/update-catalog', handler(async (req) => { await sessionManager.updateCatalog(req.userEmail, req.body.catalogId, req.body.name); }));
router.post('/delete-catalog', handler(async (req) => { await sessionManager.deleteCatalog(req.userEmail, req.body.catalogId); }));
router.get('/products', handler(async (req) => ({ data: await sessionManager.getProductCatalogList(req.userEmail, req.query.catalogId) })));
router.post('/create-product', handler(async (req) => { return { data: await sessionManager.createProductCatalog(req.userEmail, req.body.catalogId, req.body.product) }; }));
router.post('/update-product', handler(async (req) => { await sessionManager.updateProductCatalog(req.userEmail, req.body.productId, req.body.product); }));
router.post('/delete-product', handler(async (req) => { await sessionManager.deleteProductCatalog(req.userEmail, req.body.productId); }));
router.get('/biz-account', handler(async (req) => ({ data: await sessionManager.getBizAccount(req.userEmail) })));
router.get('/boards', handler(async (req) => ({ data: await sessionManager.getListBoard(req.userEmail) })));

// === MISC UTILITIES ===
router.get('/parse-link', handler(async (req) => ({ data: await sessionManager.parseLink(req.userEmail, req.query.url) })));
router.post('/keep-alive', handler(async (req) => { await sessionManager.keepAlive(req.userEmail); }));
router.post('/report', handler(async (req) => { await sessionManager.sendReport(req.userEmail, req.body.threadId, req.body.reason); }));

export default router;
