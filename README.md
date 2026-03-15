# 🔵 Zalo Personal Server

Kết nối tài khoản Zalo cá nhân với AI Assistant — gửi tin nhắn, xem bạn bè, quản lý hội thoại qua Extension.

---

## ⚡ Hướng dẫn cài đặt (Chỉ làm 1 lần)

### Bước 1: Tạo Server miễn phí

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/thriving-victory)

1. Nhấn nút **"Deploy on Railway"** ở trên
2. Nếu chưa có tài khoản Railway → Nhấn **Sign Up** → Đăng ký bằng GitHub hoặc Email
3. Trang deploy hiện ra → Nhấn **"Deploy Now"** → Chờ 1-2 phút cho đến khi hiện ✅ xanh

> ℹ️ Railway miễn phí $5/tháng — đủ để chạy Zalo Server 24/7

### Bước 2: Lấy link Server

1. Sau khi deploy xong, nhấn vào service **zalo-server** trong Railway Dashboard
2. Vào tab **Settings** → kéo xuống mục **Networking** → phần **Public Networking**
3. Nếu chưa có domain → Nhấn **"Generate Domain"**
4. Copy link domain (dạng `https://xxx.up.railway.app`)

### Bước 3: Kết nối Extension

1. Mở **Extension** trên Chrome → Nhấn ⚙️ **Settings**
2. Kéo xuống phần **Zalo** → Paste link server vào ô **Server URL**
3. Nhấn **Lưu** → Extension sẽ kiểm tra server → Hiện ✅ nếu OK
4. Nhấn **Kết nối** → Mã QR hiện lên
5. Mở **app Zalo trên điện thoại** → Quét mã QR
6. ✅ **Done!** Zalo đã kết nối với AI Assistant

---

## 💬 Cách sử dụng

Sau khi kết nối, bạn có thể nói với AI:

| Lệnh | Ví dụ |
|---|---|
| Gửi tin nhắn | *"Gửi Zalo cho Nguyên: Mai họp lúc 9h nhé"* |
| Xem bạn bè | *"Liệt kê danh sách bạn bè Zalo"* |
| Tìm người | *"Tìm số điện thoại 0901234567 trên Zalo"* |
| Xem tin nhắn | *"Xem tin nhắn Zalo gần đây"* |

---

## ❓ Câu hỏi thường gặp

**Q: Có mất phí không?**
A: Railway miễn phí $5/tháng. Server Zalo rất nhẹ, đủ dùng trong gói free.

**Q: Mỗi lần mở Extension có cần quét QR lại không?**
A: Không. Server lưu phiên đăng nhập, chỉ cần quét QR 1 lần.

**Q: Nếu server bị tắt thì sao?**
A: Vào Railway Dashboard → nhấn Redeploy. Sau đó quét QR lại 1 lần.

**Q: Có ai đọc được tin nhắn của tôi không?**
A: Không. Server chạy trên tài khoản Railway riêng của bạn, chỉ bạn có quyền truy cập.

---

## 🔧 Dành cho Developer

### API Endpoints

| Method | Path | Mô tả |
|---|---|---|
| GET | `/` | Health check |
| POST | `/zalo/login` | Tạo QR login |
| GET | `/zalo/status` | Check trạng thái |
| POST | `/zalo/logout` | Đăng xuất |
| POST | `/zalo/send` | Gửi tin nhắn |
| GET | `/zalo/messages` | Tin nhắn gần đây |
| GET | `/zalo/friends` | DS bạn bè |
| POST | `/zalo/find` | Tìm user SĐT |

### Chạy Local

```bash
npm install
npm run dev
```

Server chạy tại `http://localhost:3456`

### Tech Stack
- Node.js + Express
- [zca-js](https://github.com/nicenick/zca-js) — Zalo personal API
