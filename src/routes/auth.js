// ============================================================
// Auth Routes — Login QR (non-blocking), Status, Logout
// ============================================================
import { Router } from 'express';
import { sessionManager } from '../session-manager.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

// POST /zalo/login — Bắt đầu login QR (NON-BLOCKING: trả về ngay, poll /qr để lấy QR)
router.post('/login', async (req, res) => {
  try {
    // Check đã connected chưa
    const status = sessionManager.getStatus(req.userEmail);
    if (status.status === 'connected') {
      return res.json({ success: true, message: 'Đã đăng nhập Zalo rồi!' });
    }

    // Bắt đầu login async (không await)
    sessionManager.startLoginQR(req.userEmail).then(result => {
      console.log(`[Auth] Login result for ${req.userEmail}:`, result);
    }).catch(err => {
      console.error(`[Auth] Login error for ${req.userEmail}:`, err.message);
    });

    // Trả về ngay, client sẽ poll /qr
    res.json({ success: true, message: 'Đang tạo QR... Poll GET /zalo/qr để lấy mã.', pending: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /zalo/status — Check trạng thái login
router.get('/status', (req, res) => {
  const status = sessionManager.getStatus(req.userEmail);
  res.json({ success: true, ...status });
});

// GET /zalo/qr — Lấy QR image (base64) nếu đang pending
router.get('/qr', async (req, res) => {
  try {
    const safeEmail = req.userEmail.replace(/\./g, '_').replace(/@/g, '_at_');
    const qrPath = join(__dirname, '..', '..', 'sessions', 'qr', `${safeEmail}.png`);
    const qrData = await readFile(qrPath);
    const base64 = qrData.toString('base64');
    res.json({
      success: true,
      qr_base64: `data:image/png;base64,${base64}`
    });
  } catch (e) {
    // QR chưa sẵn sàng — client cần poll lại
    res.json({ success: false, pending: true, error: 'QR đang được tạo, thử lại sau 2-3 giây...' });
  }
});

// POST /zalo/logout — Đăng xuất
router.post('/logout', async (req, res) => {
  try {
    await sessionManager.logout(req.userEmail);
    res.json({ success: true, message: 'Đã đăng xuất Zalo.' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
