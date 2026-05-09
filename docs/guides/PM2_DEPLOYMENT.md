# Hướng dẫn chạy Production Overview Dashboard bằng PM2

Tài liệu này để **clone repo sang máy khác** (Windows hoặc Linux), cài dependency, build frontend và chạy **API** (PM2) + **UI** (`vite preview` phục vụ thư mục `build/`). Trên **Windows VM**, flow **`npm run build`** rồi **`npm run preview`** (hoặc `npx vite preview …`) đã được kiểm chứng ổn định; **`pm2 serve`** dễ gây **403** / lỗi path — tránh dùng làm mặc định.

> **Không dùng nginx** trong flow này: trình duyệt gọi API bằng URL tuyệt đối (`VITE_API_BASE_URL`). Production có nginx thì xem `README.md` và `deploy/nginx.conf`.

---

## 1. Điều kiện

- **Node.js** (khuyến nghị LTS) và **npm**
- **PostgreSQL** đã chạy, database/schema đã migrate (xem `docs/guides/BACKEND_DATABASE_SETUP.md`, `docs/guides/POSTGRESQL_SETUP.md`)
- Repo đã clone về máy; gọi thư mục gốc repo là `REPO_ROOT` (ví dụ `C:\MES\Production-Overview-Dashboard`)

---

## 2. Cài PM2 (một lần trên máy đó)

```bash
npm install -g pm2
pm2 --version
```

---

## 3. Cấu hình backend (`backend/.env`)

Trong thư mục `backend/`, tạo file **`.env`** (không commit file thật chứa mật khẩu). Tham khảo `backend/ENV_SETUP.md`.

Ví dụ tối thiểu:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=production_dashboard
DB_USER=postgres
DB_PASSWORD=your_password

PORT=3001
NODE_ENV=production

# Bắt buộc khi NODE_ENV=production: origin của UI PM2 (cổng static)
CORS_ORIGIN=http://localhost:4173

# Nên đặt secret mạnh khi deploy thật
JWT_SECRET=your-long-random-secret
```

- **`PORT`**: cổng API (mặc định `3001`). Nếu đổi, nhớ đổi luôn `VITE_API_BASE_URL` bên frontend và build lại.
- **`CORS_ORIGIN`**: phải khớp URL bạn mở UI (ví dụ `http://127.0.0.1:4173` hoặc `http://PC-KHAC:4173`). Nhiều origin: dấu phẩy, không khoảng trắng thừa.

---

## 4. Cấu hình frontend production (`frontend/.env.production`)

UI (**vite preview** hoặc tương đương) **không** proxy `/api`. Biến build-time **`VITE_API_BASE_URL`** phải là URL đầy đủ tới API.

Copy mẫu và chỉnh:

```bash
cd frontend
copy .env.production.example .env.production
```

Ví dụ API chạy cùng máy, cổng 3001:

```env
VITE_API_BASE_URL=http://127.0.0.1:3001/api
VITE_USE_MOCK_DATA=false
VITE_REALTIME_ENABLED=true
```

Nếu máy khác trong LAN truy cập API qua IP máy chủ (ví dụ `192.168.1.50`):

```env
VITE_API_BASE_URL=http://192.168.1.50:3001/api
```

**Sau mỗi lần sửa `.env.production` phải build lại** (`npm run build`).

---

## 5. Cài package và build

```bash
cd REPO_ROOT\backend
npm install

cd REPO_ROOT\frontend
npm install
npm run build
```

Frontend build ra thư mục **`frontend/build`** (repo cấu hình Vite `outDir: build`, **không phải** `dist`).

---

## 6. Khởi động (Windows VM — đã kiểm chứng)

**Backend — PM2** (có thể gõ từ `frontend/` miễn là có `--cwd` trỏ đúng `backend`):

```powershell
pm2 start server.js --name production-dashboard-api --cwd "C:\Users\MES\Documents\GitHub\production-overview-dashboard\backend"
pm2 save
```

**Frontend — sau build, trong `frontend/`** (tiến trình **foreground**: đóng cửa sổ PowerShell là hết serve):

```powershell
cd C:\Users\MES\Documents\GitHub\production-overview-dashboard\frontend
npm install
npm run build
npm run preview
```

Tương đương:

```powershell
npx vite preview --host 0.0.0.0 --port 4173 --strictPort
```

Luôn chạy **`vite preview`** trong **`frontend/`** (project có `vite.config.ts`, `outDir: build`). Không chạy trong `backend/` — sẽ báo thiếu `dist`.

**Frontend — PM2** (giữ UI sau khi đóng terminal), gọi **đúng CLI Vite trong project**:

```powershell
cd C:\Users\MES\Documents\GitHub\production-overview-dashboard\frontend
pm2 start .\node_modules\vite\bin\vite.js --name production-dashboard-ui --interpreter node -- preview --host 0.0.0.0 --port 4173 --strictPort
pm2 save
```

### Linux / macOS

```bash
pm2 start server.js --name production-dashboard-api --cwd "/path/to/REPO_ROOT/backend"
cd /path/to/REPO_ROOT/frontend && npm run build
pm2 start ./node_modules/vite/bin/vite.js --name production-dashboard-ui --interpreter node -- preview --host 0.0.0.0 --port 4173 --strictPort
pm2 save
```

Tuỳ chọn (Linux): `pm2 serve ".../frontend/build" 4173 --spa` thường ít lỗi hơn Windows.

- **`production-dashboard-api`**: Express (`server.js`), mặc định **3001**.
- **`production-dashboard-ui`**: **Vite preview**, cổng **4173**, đọc **`frontend/build`**.

Nên dùng **`127.0.0.1` hoặc IP thật** trong `VITE_API_BASE_URL` cho khớp với cách user mở site (tránh lệch `localhost` vs hostname).

---

## 7. Kiểm tra

| Dịch vụ | URL |
|--------|-----|
| UI (static) | http://localhost:4173/ |
| API health | http://127.0.0.1:3001/health |
| WebSocket (realtime) | `ws://127.0.0.1:3001/ws` |

```bash
pm2 status
pm2 logs production-dashboard-api
pm2 logs production-dashboard-ui
```

---

## 8. Vận hành thường xuyên

```bash
pm2 restart production-dashboard-api
pm2 restart production-dashboard-ui
```

Sau khi sửa **frontend**: `cd frontend` → `npm run build` → nếu đang chạy tay `npm run preview` thì Ctrl+C rồi chạy lại; nếu PM2 UI → `pm2 restart production-dashboard-ui`.

Sau khi sửa **backend**: `pm2 restart production-dashboard-api`.

---

## 9. Khởi động lại sau khi reboot Windows

PM2 không tự chạy sau reboot trừ khi cấu hình thêm. Xem tài liệu chính thức: [PM2 Startup](https://pm2.keymetrics.io/docs/usage/startup/).

Thực tế: chạy lại lệnh `pm2 start` / `pm2 resurrect` (nếu đã `pm2 save`), hoặc dùng Task Scheduler / dịch vụ wrapper.

---

## 10. Xử lý sự cố nhanh

| Hiện tượng | Gợi ý |
|------------|--------|
| `EADDRINUSE` cổng 3001 / 4173 | `pm2 delete all` hoặc đổi `PORT` / cổng preview, firewall |
| Trắng / 403 asset khi dùng **`pm2 serve`** trên Windows | Dùng **`npm run preview`** hoặc PM2 + **`node_modules\vite\bin\vite.js`** như mục 6 |
| UI không load được data | Kiểm tra `VITE_API_BASE_URL`, build lại; tab Network có bị CORS không → chỉnh `CORS_ORIGIN` |
| Chỉ chạy được trên máy chủ | Mở firewall inbound **TCP 3001** và **TCP 4173**; `VITE_API_BASE_URL` dùng IP máy chủ |

---

## 11. Không dùng PM2 (debug nhanh)

- Backend: `cd backend` → `npm start`
- Frontend dev (không giống production): `cd frontend` → `npm run dev` → http://localhost:5173/

Flow production-style không cần PM2 có thể dùng `npm run build` + `npx serve -s frontend/build -l 4173` (cần cài `serve`), nhưng PM2 tiện giữ process và log.
