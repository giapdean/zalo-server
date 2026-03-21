// ============================================================
// Message Routes — Send, forward, delete, react, stickers, events
// ============================================================
import { Router } from 'express';
import { sessionManager } from '../session-manager.js';

const router = Router();

// Helper: standard try/catch wrapper
const handler = (fn) => async (req, res) => {
  try { res.json({ success: true, ...(await fn(req) || {}) }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /zalo/send — Gửi tin nhắn text
router.post('/send', handler(async (req) => {
  const { threadId, message, threadType } = req.body;
  if (!threadId || !message) throw new Error('Thiếu threadId hoặc message');
  await sessionManager.sendMessage(req.userEmail, threadId, message, threadType || 'user');
  return { message: 'Đã gửi tin nhắn!', to: threadId };
}));

// POST /zalo/send-link
router.post('/send-link', handler(async (req) => {
  const { threadId, url, threadType } = req.body;
  await sessionManager.sendLink(req.userEmail, threadId, url, threadType || 'user');
  return { message: 'Đã gửi link' };
}));

// POST /zalo/send-sticker
router.post('/send-sticker', handler(async (req) => {
  const { threadId, stickerId, cateId, threadType } = req.body;
  await sessionManager.sendSticker(req.userEmail, threadId, stickerId, cateId, threadType || 'user');
  return { message: 'Đã gửi sticker' };
}));

// POST /zalo/send-video
router.post('/send-video', handler(async (req) => {
  const { threadId, videoUrl, thumbnailUrl, threadType } = req.body;
  await sessionManager.sendVideo(req.userEmail, threadId, videoUrl, thumbnailUrl || '', threadType || 'user');
  return { message: 'Đã gửi video' };
}));

// POST /zalo/send-voice
router.post('/send-voice', handler(async (req) => {
  const { threadId, voiceUrl, threadType } = req.body;
  await sessionManager.sendVoice(req.userEmail, threadId, voiceUrl, threadType || 'user');
  return { message: 'Đã gửi voice' };
}));

// POST /zalo/send-card
router.post('/send-card', handler(async (req) => {
  const { threadId, userId, phone, threadType } = req.body;
  await sessionManager.sendCard(req.userEmail, threadId, userId, phone || '', threadType || 'user');
  return { message: 'Đã gửi card' };
}));

// POST /zalo/send-bank-card
router.post('/send-bank-card', handler(async (req) => {
  const { threadId, bankName, cardNumber, name, threadType } = req.body;
  await sessionManager.sendBankCard(req.userEmail, threadId, bankName, cardNumber, name, threadType || 'user');
  return { message: 'Đã gửi bank card' };
}));

// POST /zalo/reaction
router.post('/reaction', handler(async (req) => {
  const { threadId, msgId, icon, threadType } = req.body;
  await sessionManager.addReaction(req.userEmail, threadId, msgId, icon, threadType || 'user');
  return { message: `Đã thả ${icon}` };
}));

// POST /zalo/undo
router.post('/undo', handler(async (req) => {
  const { threadId, msgId, threadType } = req.body;
  await sessionManager.undo(req.userEmail, threadId, msgId, threadType || 'user');
  return { message: 'Đã thu hồi' };
}));

// POST /zalo/delete-msg
router.post('/delete-msg', handler(async (req) => {
  const { threadId, msgId, threadType } = req.body;
  await sessionManager.deleteMessage(req.userEmail, threadId, msgId, threadType || 'user');
  return { message: 'Đã xóa' };
}));

// POST /zalo/forward
router.post('/forward', handler(async (req) => {
  const { threadId, msgId, dstThreadId, threadType, dstThreadType } = req.body;
  await sessionManager.forwardMessage(req.userEmail, threadId, msgId, dstThreadId, threadType || 'user', dstThreadType || 'user');
  return { message: 'Đã chuyển tiếp' };
}));

// GET /zalo/search-sticker
router.get('/search-sticker', handler(async (req) => {
  const data = await sessionManager.searchSticker(req.userEmail, req.query.keyword);
  return { data };
}));

// GET /zalo/stickers
router.get('/stickers', handler(async (req) => {
  const data = await sessionManager.getStickers(req.userEmail, req.query.type || 'recent');
  return { data };
}));

// GET /zalo/stickers-detail
router.get('/stickers-detail', handler(async (req) => {
  const ids = (req.query.ids || '').split(',').map(s => s.trim()).filter(Boolean);
  const data = await sessionManager.getStickersDetail(req.userEmail, ids);
  return { data };
}));

// GET /zalo/sticker-category
router.get('/sticker-category', handler(async (req) => {
  const data = await sessionManager.getStickerCategoryDetail(req.userEmail, req.query.cateId);
  return { data };
}));

// POST /zalo/typing-event
router.post('/typing-event', handler(async (req) => {
  await sessionManager.sendTypingEvent(req.userEmail, req.body.threadId, req.body.threadType || 'user');
}));

// POST /zalo/seen-event
router.post('/seen-event', handler(async (req) => {
  await sessionManager.sendSeenEvent(req.userEmail, req.body.threadId, req.body.threadType || 'user');
}));

// POST /zalo/delivered-event
router.post('/delivered-event', handler(async (req) => {
  await sessionManager.sendDeliveredEvent(req.userEmail, req.body.threadId, req.body.threadType || 'user');
}));

// GET /zalo/messages
router.get('/messages', handler(async (req) => {
  const limit = parseInt(req.query.limit) || 20;
  const messages = sessionManager.getRecentMessages(req.userEmail, limit);
  return { count: messages.length, messages };
}));

export default router;
