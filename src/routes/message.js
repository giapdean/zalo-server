// ============================================================
// Message Routes — Gửi tin nhắn, xem tin nhắn gần đây
// ============================================================
import { Router } from 'express';
import { sessionManager } from '../session-manager.js';

const router = Router();

// POST /zalo/send — Gửi tin nhắn
router.post('/send', async (req, res) => {
  const { threadId, message, threadType } = req.body;

  if (!threadId || !message) {
    return res.status(400).json({
      success: false,
      error: 'Thiếu threadId hoặc message'
    });
  }

  try {
    await sessionManager.sendMessage(req.userEmail, threadId, message, threadType || 'user');
    res.json({
      success: true,
      message: 'Đã gửi tin nhắn!',
      to: threadId,
      content: message
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /zalo/messages — Xem tin nhắn gần đây
router.get('/messages', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;

  try {
    const messages = sessionManager.getRecentMessages(req.userEmail, limit);
    res.json({
      success: true,
      count: messages.length,
      messages
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
