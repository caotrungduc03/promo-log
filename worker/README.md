# Promodo Log — Google Sheets Sync Worker

Cloudflare Worker làm proxy trung gian giữa app **Promodo Log** và **Google Sheets API** (dùng Service Account, không lộ link/ID Google Sheet ra client).

## 1. Cài đặt & Cấu hình Secrets

```bash
cd worker
pnpm install

# Tạo file .dev.vars từ file mẫu rồi điền các giá trị từ Service Account JSON:
cp .dev.vars.example .dev.vars

# Đẩy toàn bộ biến trong .dev.vars lên Cloudflare Secrets trong 1 lệnh:
pnpm secrets:push
```

*(Tùy chọn)* Trong `wrangler.toml`, sửa `ALLOWED_ORIGIN` thành domain frontend của bạn (ví dụ `https://your-app.pages.dev`) và `SHEET_NAME` nếu tab Sheet không phải `Sheet1`.

## 2. Chạy thử local & Deploy

```bash
# Chạy local
pnpm dev

# Deploy lên Cloudflare
pnpm deploy
```

Sau khi deploy, copy URL Worker (dạng `https://pomoday-sheet-sync.<subdomain>.workers.dev`) và dán vào mục **Google Sheet Sync** trong tab **Stats** của app.
