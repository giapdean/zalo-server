# Zalo Personal Server

Server Node.js cho phép kết nối tài khoản Zalo cá nhân qua QR code.
Dùng với [Super Google AI Assistant](https://chrome.google.com/webstore) Chrome Extension.

## ⚡ Deploy 1-Click

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/thriving-victory)

> Nhấn nút trên → Đăng nhập Railway → Deploy → Copy URL → Paste vào Extension

## Sau khi Deploy

1. Vào Railway Dashboard → Copy **domain URL** (dạng `xxx.up.railway.app`)
2. Mở Extension → Settings → Zalo → Paste URL vào ô **Server URL**
3. Nhấn **Kết nối** → Quét QR bằng Zalo app
4. ✅ Done! AI có thể gửi/nhận tin nhắn Zalo

## API Endpoints

| Method | Path | Mô tả |
|---|---|---|
| GET | `/` | Health check |
| POST | `/zalo/login` | Tạo QR login |
| GET | `/zalo/status` | Check trạng thái |
| GET | `/zalo/qr` | Lấy QR image |
| POST | `/zalo/logout` | Đăng xuất |
| POST | `/zalo/send` | Gửi tin nhắn |
| GET | `/zalo/messages` | Tin nhắn gần đây |
| GET | `/zalo/friends` | DS bạn bè |
| POST | `/zalo/find` | Tìm user SĐT |

## Chạy Local (Dev)

```bash
npm install
npm run dev
```

Server chạy tại `http://localhost:3456`

## Tech Stack
- Node.js + Express
- [zca-js](https://github.com/nicenick/zca-js) — Zalo personal API
- Session persistence (cookie storage)
