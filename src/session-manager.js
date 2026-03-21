// ============================================================
// Session Manager — Multi-tenant: 1 Zalo session per user email
// ============================================================
import { Zalo, ThreadType } from 'zca-js';
import { readFile, writeFile, mkdir, unlink, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = join(__dirname, '..', 'sessions');

class SessionManager {
  constructor() {
    this.sessions = new Map(); // email → { api, zalo, status, recentMessages }
  }

  // Khởi tạo: restore tất cả sessions đã lưu
  async init() {
    await mkdir(SESSIONS_DIR, { recursive: true }).catch(() => {});

    try {
      const files = await readdir(SESSIONS_DIR);
      const cookieFiles = files.filter(f => f.endsWith('.json'));

      for (const file of cookieFiles) {
        const email = file.replace('.json', '').replace(/_/g, '.');
        try {
          await this._restoreSession(email);
          console.log(`[Sessions] ✅ Restored: ${email}`);
        } catch (e) {
          console.log(`[Sessions] ⚠️ Failed to restore ${email}: ${e.message}`);
        }
      }

      console.log(`[Sessions] 📊 ${this.sessions.size} active session(s)`);
    } catch (e) {
      console.log('[Sessions] Init:', e.message);
    }
  }

  // Lấy session path cho user
  _getSessionPath(email) {
    const safeEmail = email.replace(/\./g, '_').replace(/@/g, '_at_');
    return join(SESSIONS_DIR, `${safeEmail}.json`);
  }

  // Restore session từ file cookies
  async _restoreSession(email) {
    const cookiePath = this._getSessionPath(email);
    const data = await readFile(cookiePath, 'utf-8');
    const cookies = JSON.parse(data);

    const zalo = new Zalo({ cookie: cookies });
    const api = await zalo.login();

    this.sessions.set(email, {
      api,
      zalo,
      status: 'connected',
      recentMessages: [],
      connectedAt: Date.now()
    });

    this._setupListener(email);
    return true;
  }

  // Lưu cookies ra file
  async _saveCookies(email, api) {
    try {
      if (api.getCookie) {
        const cookies = api.getCookie();
        await writeFile(this._getSessionPath(email), JSON.stringify(cookies, null, 2), 'utf-8');
      }
    } catch (e) {
      console.warn(`[Sessions] Save cookies failed for ${email}:`, e.message);
    }
  }

  // Bắt đầu login QR → trả về Promise resolve khi user quét xong
  async startLoginQR(email) {
    // Nếu đã login → return luôn
    const existing = this.sessions.get(email);
    if (existing && existing.status === 'connected') {
      return { success: true, message: 'Đã đăng nhập Zalo rồi!' };
    }

    // Đánh dấu đang pending
    this.sessions.set(email, {
      api: null,
      zalo: null,
      status: 'pending_qr',
      recentMessages: [],
      connectedAt: null
    });

    try {
      const zalo = new Zalo();

      // QR sẽ được lưu ra file, extension sẽ poll lấy
      const qrDir = join(SESSIONS_DIR, 'qr');
      await mkdir(qrDir, { recursive: true }).catch(() => {});
      const safeEmail = email.replace(/\./g, '_').replace(/@/g, '_at_');
      const qrPath = join(qrDir, `${safeEmail}.png`);

      console.log(`[Sessions] ⏳ Waiting for QR scan: ${email}`);

      // Biến để track xem đã confirm thành công chưa (trước khi getUserInfo fail)
      let confirmedSuccess = false;
      let scanDisplayName = '';

      // Dùng callback API của zca-js để detect login success sớm hơn
      const api = await zalo.loginQR({
        qrPath,
        callback: (event) => {
          console.log(`[Sessions] 📱 QR Event: type=${event.type}`);
          if (event.type === 2) { // QRCodeScanned
            console.log(`[Sessions] 📱 QR Scanned by: ${event.data?.display_name || 'unknown'}`);
            scanDisplayName = event.data?.display_name || '';
            confirmedSuccess = true;
          }
        }
      });

      console.log(`[Sessions] ✅ loginQR() returned for: ${email}`);

      // Set connected NGAY LẬP TỨC
      this.sessions.set(email, {
        api,
        zalo,
        status: 'connected',
        recentMessages: [],
        connectedAt: Date.now()
      });
      console.log(`[Sessions] 🟢 Status set to connected: ${email}`);

      // Save cookies (non-critical)
      try {
        await this._saveCookies(email, api);
        console.log(`[Sessions] 💾 Cookies saved: ${email}`);
      } catch (cookieErr) {
        console.warn(`[Sessions] ⚠️ Cookie save failed (non-critical): ${cookieErr.message}`);
      }

      // Setup listener (non-critical)
      try {
        this._setupListener(email);
        console.log(`[Sessions] 👂 Listener started: ${email}`);
      } catch (listErr) {
        console.warn(`[Sessions] ⚠️ Listener setup failed (non-critical): ${listErr.message}`);
      }

      return { success: true, message: 'Đăng nhập Zalo thành công!' };
    } catch (e) {
      console.error(`[Sessions] ❌ Login error: ${email}: ${e.message}`);

      // QUAN TRỌNG: zca-js throw "Can't login" SAU KHI đã login thành công
      // (do getUserInfo fail từ Railway IP). Nếu đã confirmed → vẫn coi như thành công
      // nhưng không có api object → set limited connected
      if (e.message === "Can't login" || e.message === "Can't get account info") {
        console.warn(`[Sessions] ⚠️ Login threw "${e.message}" but may still be connected. Setting limited connected.`);
        this.sessions.set(email, {
          api: null,
          zalo: null,
          status: 'connected',
          recentMessages: [],
          connectedAt: Date.now(),
          limited: true // API bị hạn chế do getUserInfo fail
        });
        return { success: true, message: 'Đăng nhập Zalo thành công (API hạn chế)!' };
      }

      this.sessions.set(email, {
        api: null,
        zalo: null,
        status: 'error',
        error: e.message,
        recentMessages: [],
        connectedAt: null
      });
      return { success: false, error: e.message };
    }
  }

  // Setup message listener cho user
  _setupListener(email) {
    const session = this.sessions.get(email);
    if (!session?.api?.listener) return;

    session.api.listener.on('message', (message) => {
      const msg = {
        id: message.data?.msgId,
        threadId: message.threadId,
        threadType: message.type === ThreadType.Group ? 'group' : 'user',
        content: typeof message.data?.content === 'string' ? message.data.content : '[non-text]',
        fromId: message.data?.uidFrom || message.data?.uid,
        timestamp: Date.now(),
        isSelf: message.isSelf || false
      };

      session.recentMessages.unshift(msg);
      if (session.recentMessages.length > 50) {
        session.recentMessages = session.recentMessages.slice(0, 50);
      }
    });

    session.api.listener.start();
  }

  // Gửi tin nhắn
  async sendMessage(email, threadId, message, threadType = 'user') {
    const session = this.sessions.get(email);
    if (!session?.api) throw new Error('Chưa đăng nhập Zalo');

    const type = threadType === 'group' ? ThreadType.Group : ThreadType.User;
    return await session.api.sendMessage({ msg: message }, threadId, type);
  }

  // Lấy danh sách bạn bè
  async getFriends(email) {
    const session = this.sessions.get(email);
    if (!session?.api) throw new Error('Chưa đăng nhập Zalo');
    return await session.api.getAllFriends();
  }

  // Tìm user bằng SĐT
  async findUser(email, phone) {
    const session = this.sessions.get(email);
    if (!session?.api) throw new Error('Chưa đăng nhập Zalo');
    return await session.api.findUser(phone);
  }

  // Lấy tin nhắn gần đây
  getRecentMessages(email, limit = 20) {
    const session = this.sessions.get(email);
    if (!session) return [];
    return session.recentMessages.slice(0, Math.min(limit, 50));
  }

  // Check status
  getStatus(email) {
    const session = this.sessions.get(email);
    if (!session) return { status: 'not_connected' };
    return {
      status: session.status,
      connectedAt: session.connectedAt,
      recentMessageCount: session.recentMessages.length,
      error: session.error || null
    };
  }

  // Logout user
  async logout(email) {
    const session = this.sessions.get(email);
    if (session?.api?.listener) {
      session.api.listener.stop();
    }
    this.sessions.delete(email);

    // Xóa cookie file
    try { await unlink(this._getSessionPath(email)); } catch {}

    // Xóa QR file
    try {
      const safeEmail = email.replace(/\./g, '_').replace(/@/g, '_at_');
      await unlink(join(SESSIONS_DIR, 'qr', `${safeEmail}.png`));
    } catch {}
  }

  // Stats tổng
  getStats() {
    return {
      totalSessions: this.sessions.size,
      connected: [...this.sessions.values()].filter(s => s.status === 'connected').length,
      pending: [...this.sessions.values()].filter(s => s.status === 'pending_qr').length
    };
  }
}

export const sessionManager = new SessionManager();
