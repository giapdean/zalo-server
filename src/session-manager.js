// ============================================================
// Session Manager — Multi-tenant: 1 Zalo session per user email
// Supports ALL zca-js APIs
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

  _getSessionPath(email) {
    const safeEmail = email.replace(/\./g, '_').replace(/@/g, '_at_');
    return join(SESSIONS_DIR, `${safeEmail}.json`);
  }

  async _restoreSession(email) {
    const cookiePath = this._getSessionPath(email);
    const data = await readFile(cookiePath, 'utf-8');
    const cookies = JSON.parse(data);

    const zalo = new Zalo({ cookie: cookies });
    const api = await zalo.login();

    this.sessions.set(email, {
      api, zalo, status: 'connected',
      recentMessages: [], connectedAt: Date.now()
    });

    this._setupListener(email);
    return true;
  }

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

  // Helper: lấy api object hoặc throw
  _getApi(email) {
    const session = this.sessions.get(email);
    if (!session) throw new Error('Chưa đăng nhập Zalo');
    if (session.status === 'limited') throw new Error('Zalo đang kết nối hạn chế (Railway IP bị chặn). Hãy chạy server trên VPS hoặc local.');
    if (!session.api) throw new Error('Chưa đăng nhập Zalo');
    return session.api;
  }

  _getThreadType(tt) {
    return tt === 'group' ? ThreadType.Group : ThreadType.User;
  }

  // ============================================================
  // AUTH
  // ============================================================
  async startLoginQR(email) {
    const existing = this.sessions.get(email);
    if (existing && existing.status === 'connected') {
      return { success: true, message: 'Đã đăng nhập Zalo rồi!' };
    }

    this.sessions.set(email, {
      api: null, zalo: null, status: 'pending_qr',
      recentMessages: [], connectedAt: null
    });

    try {
      const zalo = new Zalo();
      const qrDir = join(SESSIONS_DIR, 'qr');
      await mkdir(qrDir, { recursive: true }).catch(() => {});
      const safeEmail = email.replace(/\./g, '_').replace(/@/g, '_at_');
      const qrPath = join(qrDir, `${safeEmail}.png`);

      console.log(`[Sessions] ⏳ Waiting for QR scan: ${email}`);

      const api = await zalo.loginQR({
        qrPath,
        callback: (event) => {
          console.log(`[Sessions] 📱 QR Event: type=${event.type}`);
          if (event.type === 2) {
            console.log(`[Sessions] 📱 QR Scanned by: ${event.data?.display_name || 'unknown'}`);
          }
        }
      });

      console.log(`[Sessions] ✅ loginQR() returned for: ${email}`);

      this.sessions.set(email, {
        api, zalo, status: 'connected',
        recentMessages: [], connectedAt: Date.now()
      });
      console.log(`[Sessions] 🟢 Status set to connected: ${email}`);

      try { await this._saveCookies(email, api); } catch (e) { console.warn(`[Sessions] ⚠️ Cookie save: ${e.message}`); }
      try { this._setupListener(email); } catch (e) { console.warn(`[Sessions] ⚠️ Listener: ${e.message}`); }

      return { success: true, message: 'Đăng nhập Zalo thành công!' };
    } catch (e) {
      console.error(`[Sessions] ❌ Login error: ${email}: ${e.message}`);

      if (e.message === "Can't login" || e.message === "Can't get account info") {
        console.warn(`[Sessions] ⚠️ Limited connected for: ${email}`);
        this.sessions.set(email, {
          api: null, zalo: null, status: 'limited',
          recentMessages: [], connectedAt: Date.now(), limited: true
        });
        return { success: true, message: 'Đăng nhập Zalo thành công (API hạn chế — Railway IP bị chặn)!', limited: true };
      }

      this.sessions.set(email, {
        api: null, zalo: null, status: 'error', error: e.message,
        recentMessages: [], connectedAt: null
      });
      return { success: false, error: e.message };
    }
  }

  // ============================================================
  // LISTENER
  // ============================================================
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
      if (session.recentMessages.length > 50) session.recentMessages = session.recentMessages.slice(0, 50);
    });

    session.api.listener.start();
  }

  // ============================================================
  // MESSAGES
  // ============================================================
  async sendMessage(email, threadId, message, tt = 'user') {
    return await this._getApi(email).sendMessage({ msg: message }, threadId, this._getThreadType(tt));
  }

  async sendLink(email, threadId, url, tt = 'user') {
    const api = this._getApi(email);
    const linkData = await api.parseLink(url);
    return await api.sendLink(linkData, threadId, this._getThreadType(tt));
  }

  async sendSticker(email, threadId, stickerId, cateId, tt = 'user') {
    return await this._getApi(email).sendSticker(
      { id: stickerId, cateId, type: 'sticker' }, threadId, this._getThreadType(tt)
    );
  }

  async sendVideo(email, threadId, videoUrl, thumbnailUrl, tt = 'user') {
    return await this._getApi(email).sendVideo(videoUrl, thumbnailUrl, threadId, this._getThreadType(tt));
  }

  async sendVoice(email, threadId, voiceUrl, tt = 'user') {
    return await this._getApi(email).sendVoice(voiceUrl, threadId, this._getThreadType(tt));
  }

  async sendCard(email, threadId, userId, phone, tt = 'user') {
    return await this._getApi(email).sendCard(userId, phone, threadId, this._getThreadType(tt));
  }

  async sendBankCard(email, threadId, bankName, cardNumber, name, tt = 'user') {
    return await this._getApi(email).sendBankCard({ bankName, cardNumber, name }, threadId, this._getThreadType(tt));
  }

  async addReaction(email, threadId, msgId, icon, tt = 'user') {
    return await this._getApi(email).addReaction(icon, msgId, threadId, this._getThreadType(tt));
  }

  async undo(email, threadId, msgId, tt = 'user') {
    return await this._getApi(email).undo(msgId, threadId, this._getThreadType(tt));
  }

  async deleteMessage(email, threadId, msgId, tt = 'user') {
    return await this._getApi(email).deleteMessage(msgId, threadId, this._getThreadType(tt));
  }

  async forwardMessage(email, threadId, msgId, dstThreadId, tt = 'user', dtt = 'user') {
    return await this._getApi(email).forwardMessage(msgId, threadId, this._getThreadType(tt), dstThreadId, this._getThreadType(dtt));
  }

  async searchSticker(email, keyword) {
    return await this._getApi(email).searchSticker(keyword);
  }

  async getStickers(email, type) {
    return await this._getApi(email).getStickers(type);
  }

  async getStickersDetail(email, stickerIds) {
    return await this._getApi(email).getStickersDetail(stickerIds);
  }

  async getStickerCategoryDetail(email, cateId) {
    return await this._getApi(email).getStickerCategoryDetail(cateId);
  }

  async sendTypingEvent(email, threadId, tt = 'user') {
    return await this._getApi(email).sendTypingEvent(threadId, this._getThreadType(tt));
  }

  async sendSeenEvent(email, threadId, tt = 'user') {
    return await this._getApi(email).sendSeenEvent(threadId, this._getThreadType(tt));
  }

  async sendDeliveredEvent(email, threadId, tt = 'user') {
    return await this._getApi(email).sendDeliveredEvent(threadId, this._getThreadType(tt));
  }

  getRecentMessages(email, limit = 20) {
    const session = this.sessions.get(email);
    if (!session) return [];
    return session.recentMessages.slice(0, Math.min(limit, 50));
  }

  // ============================================================
  // CONTACTS
  // ============================================================
  async getFriends(email) { return await this._getApi(email).getAllFriends(); }
  async findUser(email, phone) { return await this._getApi(email).findUser(phone); }
  async findUserByUsername(email, username) { return await this._getApi(email).findUserByUsername(username); }
  async getUserInfo(email, userId) { return await this._getApi(email).getUserInfo(userId); }
  async getMultiUsersByPhones(email, phones) { return await this._getApi(email).getMultiUsersByPhones(phones); }
  async changeFriendAlias(email, userId, alias) { return await this._getApi(email).changeFriendAlias(userId, alias); }
  async removeFriendAlias(email, userId) { return await this._getApi(email).removeFriendAlias(userId); }
  async getAliasList(email) { return await this._getApi(email).getAliasList(); }
  async getCloseFriends(email) { return await this._getApi(email).getCloseFriends(); }
  async getFriendOnlines(email) { return await this._getApi(email).getFriendOnlines(); }
  async getFriendRecommendations(email) { return await this._getApi(email).getFriendRecommendations(); }
  async lastOnline(email, userIds) { return await this._getApi(email).lastOnline(userIds); }
  async getFriendBoardList(email) { return await this._getApi(email).getFriendBoardList(); }

  // ============================================================
  // SOCIAL (Friend Requests)
  // ============================================================
  async sendFriendRequest(email, userId, msg) { return await this._getApi(email).sendFriendRequest(userId, msg); }
  async acceptFriendRequest(email, userId) { return await this._getApi(email).acceptFriendRequest(userId); }
  async rejectFriendRequest(email, userId) { return await this._getApi(email).rejectFriendRequest(userId); }
  async undoFriendRequest(email, userId) { return await this._getApi(email).undoFriendRequest(userId); }
  async getSentFriendRequests(email) { return await this._getApi(email).getSentFriendRequest(); }
  async getFriendRequestStatus(email, userId) { return await this._getApi(email).getFriendRequestStatus(userId); }
  async removeFriend(email, userId) { return await this._getApi(email).removeFriend(userId); }
  async blockUser(email, userId) { return await this._getApi(email).blockUser(userId); }
  async unblockUser(email, userId) { return await this._getApi(email).unblockUser(userId); }
  async blockViewFeed(email, userId) { return await this._getApi(email).blockViewFeed(userId); }

  // ============================================================
  // GROUPS
  // ============================================================
  async getGroups(email) { return await this._getApi(email).getAllGroups(); }
  async getGroupInfo(email, groupId) { return await this._getApi(email).getGroupInfo(groupId); }
  async getGroupMembersInfo(email, groupId) { return await this._getApi(email).getGroupMembersInfo(groupId); }
  async createGroup(email, name, memberIds) { return await this._getApi(email).createGroup({ name, members: memberIds }); }
  async addUserToGroup(email, groupId, userId) { return await this._getApi(email).addUserToGroup(userId, groupId); }
  async removeUserFromGroup(email, groupId, userId) { return await this._getApi(email).removeUserFromGroup(userId, groupId); }
  async changeGroupName(email, groupId, name) { return await this._getApi(email).changeGroupName(groupId, name); }
  async changeGroupAvatar(email, groupId, avatarPath) { return await this._getApi(email).changeGroupAvatar(groupId, avatarPath); }
  async changeGroupOwner(email, groupId, newOwnerId) { return await this._getApi(email).changeGroupOwner(groupId, newOwnerId); }
  async addGroupDeputy(email, groupId, userId) { return await this._getApi(email).addGroupDeputy(userId, groupId); }
  async removeGroupDeputy(email, groupId, userId) { return await this._getApi(email).removeGroupDeputy(userId, groupId); }
  async addGroupBlockedMember(email, groupId, userId) { return await this._getApi(email).addGroupBlockedMember(userId, groupId); }
  async removeGroupBlockedMember(email, groupId, userId) { return await this._getApi(email).removeGroupBlockedMember(userId, groupId); }
  async getGroupBlockedMembers(email, groupId) { return await this._getApi(email).getGroupBlockedMember(groupId); }
  async getPendingGroupMembers(email, groupId) { return await this._getApi(email).getPendingGroupMembers(groupId); }
  async reviewPendingMember(email, groupId, userId, action) { return await this._getApi(email).reviewPendingMemberRequest(groupId, userId, action); }
  async leaveGroup(email, groupId) { return await this._getApi(email).leaveGroup(groupId); }
  async disperseGroup(email, groupId) { return await this._getApi(email).disperseGroup(groupId); }
  async getGroupChatHistory(email, groupId, lastMsgId) { return await this._getApi(email).getGroupChatHistory(groupId, lastMsgId); }
  async enableGroupLink(email, groupId) { return await this._getApi(email).enableGroupLink(groupId); }
  async disableGroupLink(email, groupId) { return await this._getApi(email).disableGroupLink(groupId); }
  async getGroupLinkDetail(email, groupId) { return await this._getApi(email).getGroupLinkDetail(groupId); }
  async getGroupLinkInfo(email, link) { return await this._getApi(email).getGroupLinkInfo(link); }
  async joinGroupLink(email, link) { return await this._getApi(email).joinGroupLink(link); }
  async inviteUserToGroups(email, userId, groupIds) { return await this._getApi(email).inviteUserToGroups(userId, groupIds); }
  async updateGroupSettings(email, groupId, settings) { return await this._getApi(email).updateGroupSettings(groupId, settings); }
  async upgradeGroupToCommunity(email, groupId) { return await this._getApi(email).upgradeGroupToCommunity(groupId); }
  async getGroupInviteBoxList(email) { return await this._getApi(email).getGroupInviteBoxList(); }
  async deleteGroupInviteBox(email, groupId) { return await this._getApi(email).deleteGroupInviteBox(groupId); }

  // ============================================================
  // POLLS
  // ============================================================
  async createPoll(email, groupId, question, options) { return await this._getApi(email).createPoll(groupId, question, options); }
  async votePoll(email, pollId, optionIndexes, groupId) { return await this._getApi(email).votePoll(pollId, optionIndexes, groupId); }
  async getPollDetail(email, pollId, groupId) { return await this._getApi(email).getPollDetail(pollId, groupId); }
  async addPollOptions(email, pollId, options, groupId) { return await this._getApi(email).addPollOptions(pollId, options, groupId); }
  async lockPoll(email, pollId, groupId) { return await this._getApi(email).lockPoll(pollId, groupId); }
  async sharePoll(email, pollId, groupId, dstThreadId, dtt) { return await this._getApi(email).sharePoll(pollId, groupId, dstThreadId, this._getThreadType(dtt)); }

  // ============================================================
  // PROFILE
  // ============================================================
  async fetchAccountInfo(email) { return await this._getApi(email).fetchAccountInfo(); }
  async updateProfile(email, data) { return await this._getApi(email).updateProfile(data); }
  async updateProfileBio(email, bio) { return await this._getApi(email).updateProfileBio(bio); }
  async changeAccountAvatar(email, avatarPath) { return await this._getApi(email).changeAccountAvatar(avatarPath); }
  async getAvatarList(email) { return await this._getApi(email).getAvatarList(); }
  async getAvatarUrlProfile(email, userId) { return await this._getApi(email).getAvatarUrlProfile(userId); }
  async getFullAvatar(email, userId) { return await this._getApi(email).getFullAvatar(userId); }
  async deleteAvatar(email, avatarId) { return await this._getApi(email).deleteAvatar(avatarId); }
  async reuseAvatar(email, avatarId) { return await this._getApi(email).reuseAvatar(avatarId); }
  async getOwnId(email) { return await this._getApi(email).getOwnId(); }
  async updateActiveStatus(email, active) { return await this._getApi(email).updateActiveStatus(active); }
  async getSettings(email) { return await this._getApi(email).getSettings(); }
  async updateSettings(email, settings) { return await this._getApi(email).updateSettings(settings); }
  async updateLang(email, lang) { return await this._getApi(email).updateLang(lang); }

  // ============================================================
  // CHAT MANAGEMENT
  // ============================================================
  async deleteChat(email, threadId, tt) { return await this._getApi(email).deleteChat(threadId, this._getThreadType(tt)); }
  async setPinnedConversations(email, pinnedList) { return await this._getApi(email).setPinnedConversations(pinnedList); }
  async getPinConversations(email) { return await this._getApi(email).getPinConversations(); }
  async setMute(email, threadId, tt, duration) { return await this._getApi(email).setMute(threadId, this._getThreadType(tt), duration); }
  async getMute(email) { return await this._getApi(email).getMute(); }
  async setHiddenConversations(email, threadId, tt) { return await this._getApi(email).setHiddenConversations(threadId, this._getThreadType(tt)); }
  async getHiddenConversations(email) { return await this._getApi(email).getHiddenConversations(); }
  async getArchivedChatList(email) { return await this._getApi(email).getArchivedChatList(); }
  async updateArchivedChatList(email, threadId, tt, archived) { return await this._getApi(email).updateArchivedChatList(threadId, this._getThreadType(tt), archived); }
  async addUnreadMark(email, threadId, tt) { return await this._getApi(email).addUnreadMark(threadId, this._getThreadType(tt)); }
  async removeUnreadMark(email, threadId, tt) { return await this._getApi(email).removeUnreadMark(threadId, this._getThreadType(tt)); }
  async getUnreadMark(email) { return await this._getApi(email).getUnreadMark(); }
  async getAutoDeleteChat(email, threadId) { return await this._getApi(email).getAutoDeleteChat(threadId); }
  async updateAutoDeleteChat(email, threadId, tt, duration) { return await this._getApi(email).updateAutoDeleteChat(threadId, this._getThreadType(tt), duration); }
  async resetHiddenConversPin(email) { return await this._getApi(email).resetHiddenConversPin(); }
  async updateHiddenConversPin(email, pin) { return await this._getApi(email).updateHiddenConversPin(pin); }

  // ============================================================
  // QUICK MESSAGES & AUTO REPLY
  // ============================================================
  async getQuickMessageList(email) { return await this._getApi(email).getQuickMessageList(); }
  async addQuickMessage(email, shortcut, message) { return await this._getApi(email).addQuickMessage(shortcut, message); }
  async removeQuickMessage(email, quickMsgId) { return await this._getApi(email).removeQuickMessage(quickMsgId); }
  async updateQuickMessage(email, quickMsgId, shortcut, message) { return await this._getApi(email).updateQuickMessage(quickMsgId, shortcut, message); }
  async getAutoReplyList(email) { return await this._getApi(email).getAutoReplyList(); }
  async createAutoReply(email, message, enabled) { return await this._getApi(email).createAutoReply(message, enabled); }
  async updateAutoReply(email, autoReplyId, message, enabled) { return await this._getApi(email).updateAutoReply(autoReplyId, message, enabled); }
  async deleteAutoReply(email, autoReplyId) { return await this._getApi(email).deleteAutoReply(autoReplyId); }

  // ============================================================
  // NOTES & REMINDERS
  // ============================================================
  async createNote(email, groupId, content) { return await this._getApi(email).createNote(groupId, content); }
  async editNote(email, noteId, groupId, content) { return await this._getApi(email).editNote(noteId, groupId, content); }
  async createReminder(email, groupId, content, time) { return await this._getApi(email).createReminder(groupId, content, time); }
  async editReminder(email, reminderId, content, time) { return await this._getApi(email).editReminder(reminderId, content, time); }
  async removeReminder(email, reminderId) { return await this._getApi(email).removeReminder(reminderId); }
  async getListReminder(email, groupId) { return await this._getApi(email).getListReminder(groupId); }
  async getReminder(email, reminderId) { return await this._getApi(email).getReminder(reminderId); }
  async getReminderResponses(email, reminderId) { return await this._getApi(email).getReminderResponses(reminderId); }

  // ============================================================
  // LABELS & CATALOG
  // ============================================================
  async getLabels(email) { return await this._getApi(email).getLabels(); }
  async updateLabels(email, labels) { return await this._getApi(email).updateLabels(labels); }
  async getCatalogList(email) { return await this._getApi(email).getCatalogList(); }
  async createCatalog(email, name) { return await this._getApi(email).createCatalog(name); }
  async updateCatalog(email, catalogId, name) { return await this._getApi(email).updateCatalog(catalogId, name); }
  async deleteCatalog(email, catalogId) { return await this._getApi(email).deleteCatalog(catalogId); }
  async getProductCatalogList(email, catalogId) { return await this._getApi(email).getProductCatalogList(catalogId); }
  async createProductCatalog(email, catalogId, product) { return await this._getApi(email).createProductCatalog(catalogId, product); }
  async updateProductCatalog(email, productId, product) { return await this._getApi(email).updateProductCatalog(productId, product); }
  async deleteProductCatalog(email, productId) { return await this._getApi(email).deleteProductCatalog(productId); }
  async uploadProductPhoto(email, photoPath) { return await this._getApi(email).uploadProductPhoto(photoPath); }
  async getBizAccount(email) { return await this._getApi(email).getBizAccount(); }
  async getListBoard(email) { return await this._getApi(email).getListBoard(); }

  // ============================================================
  // UTILITIES
  // ============================================================
  async parseLink(email, url) { return await this._getApi(email).parseLink(url); }
  async uploadAttachment(email, filePath, threadId, tt) { return await this._getApi(email).uploadAttachment(filePath, threadId, this._getThreadType(tt)); }
  async keepAlive(email) { return await this._getApi(email).keepAlive(); }
  async getContext(email) { return await this._getApi(email).getContext(); }
  async getCookie(email) { return await this._getApi(email).getCookie(); }
  async getQR(email) { return await this._getApi(email).getQR(); }
  async sendReport(email, threadId, reason) { return await this._getApi(email).sendReport(threadId, reason); }
  async custom(email, url, data) { return await this._getApi(email).custom(url, data); }

  // ============================================================
  // STATUS & STATS
  // ============================================================
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

  async logout(email) {
    const session = this.sessions.get(email);
    if (session?.api?.listener) session.api.listener.stop();
    this.sessions.delete(email);
    try { await unlink(this._getSessionPath(email)); } catch {}
    try {
      const safeEmail = email.replace(/\./g, '_').replace(/@/g, '_at_');
      await unlink(join(SESSIONS_DIR, 'qr', `${safeEmail}.png`));
    } catch {}
  }

  getStats() {
    return {
      totalSessions: this.sessions.size,
      connected: [...this.sessions.values()].filter(s => s.status === 'connected').length,
      pending: [...this.sessions.values()].filter(s => s.status === 'pending_qr').length
    };
  }
}

export const sessionManager = new SessionManager();
