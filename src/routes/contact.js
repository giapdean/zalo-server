// ============================================================
// Contact Routes — Bạn bè, tìm kiếm user
// ============================================================
import { Router } from 'express';
import { sessionManager } from '../session-manager.js';

const router = Router();

// GET /zalo/friends — Danh sách bạn bè
router.get('/friends', async (req, res) => {
  try {
    const friends = await sessionManager.getFriends(req.userEmail);

    const list = (friends || []).map(f => ({
      id: f.userId || f.uid || f.id,
      name: f.displayName || f.zaloName || f.name || 'Unknown',
      phone: f.phoneNumber || f.phone || null,
      avatar: f.avatar || null
    }));

    res.json({
      success: true,
      count: list.length,
      friends: list
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /zalo/find — Tìm user bằng SĐT
router.post('/find', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ success: false, error: 'Thiếu số điện thoại' });
  }

  try {
    const result = await sessionManager.findUser(req.userEmail, phone);

    if (!result) {
      return res.json({ success: false, error: `Không tìm thấy user với SĐT: ${phone}` });
    }

    res.json({
      success: true,
      user: {
        id: result.userId || result.uid || result.id,
        name: result.displayName || result.zaloName || result.name || 'Unknown',
        phone: phone,
        avatar: result.avatar || null
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
