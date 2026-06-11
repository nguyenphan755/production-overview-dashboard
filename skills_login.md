# Skill: Port Login UI + Auth bảo mật + PM2 Deploy (từ Production Overview Dashboard)

Tài liệu này mô tả **cách copy nguyên bộ** từ repo này sang project khác:

1. **Giao diện đăng nhập** (React + CSS branded CADIVI/MES)
2. **Luồng bảo mật** (bcrypt + JWT + quản lý user PostgreSQL)
3. **Triển khai PM2** (backend API + tùy chọn UI / NGINX)

> **Cấu trúc repo nguồn:** `frontend/` (Vite React) + `backend/` (Express ESM). Frontend build ra `frontend/build` (không phải `dist`).

---

## 1. Kiến trúc tổng quan

```mermaid
flowchart LR
  subgraph Browser
    Login[LoginPage.tsx]
    App[App.tsx session]
    API[api.ts / authApi.ts]
  end
  subgraph Backend_PM2
    Express[Express :3001]
    Auth[/api/auth]
    Users[/api/users]
    PG[(mes_users PostgreSQL)]
  end
  Login -->|POST username/password| Auth
  Auth -->|bcrypt + JWT 24h| App
  App -->|localStorage mes_login_session| API
  API -->|Bearer token| Express
  Auth --> PG
  Users --> PG
```

**Hai kiểu deploy production:**

| Kiểu | UI | API | `VITE_API_BASE_URL` |
|------|----|-----|---------------------|
| **A — NGINX + PM2** (khuyến nghị máy chủ Windows) | NGINX port 80, SPA `frontend/build` | PM2 `ecosystem.config.cjs` port 3001 | `/api` (same-origin) hoặc `http://host/api` |
| **B — PM2 thuần** (không NGINX) | `vite preview` port 4173 (PM2) | PM2 port 3001 | URL tuyệt đối `http://host:3001/api` |

---

## 2. Danh sách file cần copy

### 2.1 Frontend — Login UI & session

| File nguồn | Mục đích |
|------------|----------|
| `frontend/src/pages/LoginPage.tsx` | Trang login 2 cột (brand + form) |
| `frontend/src/pages/LoginPage.css` | Toàn bộ style (snow, grid, responsive) |
| `frontend/src/assets/cadivi-logo.png` | Logo — **đổi file này** khi port sang công ty khác |
| `frontend/src/services/authApi.ts` | `login`, `listUsers`, `createUser`, … |
| `frontend/src/App.tsx` | Gate: chưa login → `LoginPage`, đã login → app chính |
| `frontend/src/pages/AccountManagement.tsx` | (Tuỳ chọn) Quản lý tài khoản admin/supervisor |

**Tích hợp `App.tsx` (pattern bắt buộc):**

```tsx
const SESSION_KEY = "mes_login_session";

// Restore session từ localStorage
// handleLoginSuccess → localStorage.setItem(SESSION_KEY, JSON.stringify(payload))
// handleLogout → localStorage.removeItem(SESSION_KEY)
// if (!session) return <LoginPage onSuccess={handleLoginSuccess} />;
```

**API client chính:** `frontend/src/services/api.ts` đọc JWT từ cùng key `mes_login_session` (`readStoredAuthToken`) cho các request cần auth (export report, v.v.).

### 2.2 Backend — Auth & users

| File nguồn | Mục đích |
|------------|----------|
| `backend/src/routes/auth.js` | `POST /api/auth/login`, `POST /api/auth/verify` |
| `backend/src/routes/users.js` | CRUD user (admin/supervisor) |
| `backend/src/middleware/auth.js` | `authenticateToken`, `generateToken`, `requireRole` |
| `backend/database/migration_add_user_accounts.sql` | Bảng `mes_users` + enum `user_role` |
| `backend/scripts/create-user.js` | CLI tạo user đầu tiên |
| `backend/ecosystem.config.cjs` | Cấu hình PM2 backend |

**Mount routes trong `backend/src/app.js`:**

```js
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
```

**Dependencies backend (`package.json`):**

```json
"bcryptjs": "^2.4.3",
"jsonwebtoken": "^9.0.2",
"cors": "^2.8.5"
```

### 2.3 Deploy & hạ tầng

| File nguồn | Mục đích |
|------------|----------|
| `backend/ecosystem.config.cjs` | PM2 app `production-dashboard-backend` |
| `deploy.ps1` | Windows: build FE + PM2 + NGINX + Task Scheduler |
| `infrastructure/nginx/app.conf` | Reverse proxy `/` + `/api` + `/ws` |
| `docs/guides/PM2_DEPLOYMENT.md` | Hướng dẫn PM2 không NGINX |
| `README-deploy.md` | Chi tiết NGINX + PM2 Windows |
| `frontend/.env.production.example` | Mẫu biến build Vite |

---

## 3. Giao diện Login — chi tiết copy

### 3.1 Component

`LoginPage.tsx` gồm:

- Layout 2 cột: **aside** (logo, badge "MES Secure Access", feature list) + **panel** (form)
- Form: username (email input), password + nút show/hide, remember me (UI only), forgot password (placeholder)
- States: `idle` | `loading` | `error` — loading bar + message
- Gọi `login(email, password)` từ `authApi.ts`
- Lưu `mes_last_login_info` vào `localStorage` (hiển thị lần đăng nhập trước)

### 3.2 Asset logo

```tsx
const cadiviLogo = new URL("../assets/cadivi-logo.png", import.meta.url).href;
```

Port sang project khác: thay `cadivi-logo.png`, sửa alt text, tiêu đề `h1`, footer brand trong JSX.

### 3.3 CSS

Copy **toàn bộ** `LoginPage.css` (~500 dòng). Import trong component:

```tsx
import "./LoginPage.css";
```

Không phụ thuộc Tailwind — chỉ cần import file CSS. Class prefix: `login-*`.

### 3.4 Responsive

Breakpoint `@media (max-width: 900px)`: 1 cột, aside xuống dưới panel.

---

## 4. Bảo mật & Authentication

### 4.1 Database

Chạy migration (cần function `update_updated_at_column()` — có sẵn trong `backend/database/schema.sql`):

```sql
-- backend/database/migration_add_user_accounts.sql
CREATE TYPE user_role AS ENUM ('operator', 'engineer', 'supervisor', 'admin');

CREATE TABLE mes_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'operator',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  plant VARCHAR(100),
  area VARCHAR(100),
  line VARCHAR(100),
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 Tạo user admin đầu tiên

```bash
cd backend
npm run create-user -- admin@company.local "StrongPassword123!" admin
```

Script: `node scripts/create-user.js <username> <password> [role]` — bcrypt **cost 12**, username normalize `trim().toLowerCase()`.

**Không có đăng ký công khai** — chỉ admin/supervisor tạo user qua API hoặc CLI.

### 4.3 API Auth

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/api/auth/login` | Không | Body: `{ username, password }` → `{ token, user }` |
| POST | `/api/auth/verify` | Không | Body: `{ token }` → kiểm tra JWT |
| GET | `/api/users` | Bearer + role admin/supervisor | Danh sách user |
| POST | `/api/users` | Bearer + admin/supervisor | Tạo user |
| PATCH | `/api/users/:id` | Bearer + admin/supervisor | Sửa user |
| POST | `/api/users/:id/reset-password` | Bearer + admin/supervisor | Đổi mật khẩu |

**Response shape (thống nhất):**

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-05-19T..."
}
```

Lỗi: `success: false`, `message: "..."`.

### 4.4 JWT middleware

File `backend/src/middleware/auth.js`:

- Secret: `process.env.JWT_SECRET` (fallback dev — **bắt buộc đổi production**)
- Header: `Authorization: Bearer <token>`
- Expiry: **24 giờ** (`expiresIn: '24h'`)
- Payload token: `{ userId, username, role }`
- `requireRole('admin', 'supervisor')` cho route quản trị

**Bảo vệ route nghiệp vụ:** thêm `authenticateToken` vào router cần bảo vệ, ví dụ:

```js
router.put('/name/:machineName', authenticateToken, async (req, res) => { ... });
```

### 4.5 Luồng login (server)

1. Validate `username` + `password`
2. `SELECT` từ `mes_users` (username lowercase)
3. Kiểm tra `is_active`
4. `bcrypt.compare(password, password_hash)`
5. `UPDATE last_login_at`
6. Trả JWT + user (kèm `lastLoginAt` **trước** lần login hiện tại)

### 4.6 Frontend session

- Key: `mes_login_session` → JSON `{ token, user }`
- Lưu **localStorage** (không httpOnly cookie trong repo này)
- Mọi request protected: header `Authorization: Bearer ${token}`

**Lưu ý bảo mật khi port:**

| Mục | Repo hiện tại | Khuyến nghị production mạnh hơn |
|-----|---------------|----------------------------------|
| JWT storage | localStorage | httpOnly cookie + refresh token (nếu cần) |
| HTTPS | Tùy deploy | Bắt buộc qua NGINX/TLS |
| Rate limit login | Chưa có | Thêm `express-rate-limit` trên `/api/auth/login` |
| Helmet | Chưa có | `helmet()` trên Express |
| JWT secret | `.env` | Chuỗi random ≥ 32 byte, không commit |

### 4.7 CORS (production)

Trong `backend/src/app.js`:

- `NODE_ENV !== 'production'` → cho phép mọi origin (dev/Tailscale)
- `NODE_ENV=production` → chỉ `CORS_ORIGIN` (có thể nhiều origin, phân tách bằng dấu phẩy)

```env
NODE_ENV=production
CORS_ORIGIN=http://192.168.1.10:4173,http://192.168.1.10
```

`CORS_ORIGIN` phải **khớp URL** người dùng mở UI.

### 4.8 Biến môi trường backend

Tạo `backend/.env` (không commit):

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=production_dashboard
DB_USER=postgres
DB_PASSWORD=***

PORT=3001
NODE_ENV=production

JWT_SECRET=<random-long-secret>
CORS_ORIGIN=http://localhost:4173
```

---

## 5. Frontend env & build

Copy `frontend/.env.production.example` → `frontend/.env.production`:

**PM2 split (API port 3001, UI port 4173):**

```env
VITE_API_BASE_URL=http://127.0.0.1:3001/api
VITE_USE_MOCK_DATA=false
```

**NGINX same-origin (deploy.ps1 set `/api`):**

```env
VITE_API_BASE_URL=/api
```

Sau **mỗi** thay đổi `.env.production`:

```bash
cd frontend
npm install
npm run build
```

Output: `frontend/build/`.

---

## 6. PM2 Deploy

### 6.1 Cài PM2 (một lần)

```bash
npm install -g pm2
pm2 --version
```

### 6.2 Backend — ecosystem.config.cjs

Copy `backend/ecosystem.config.cjs`:

```js
module.exports = {
  apps: [{
    name: 'production-dashboard-backend',  // đổi tên khi port project khác
    script: './server.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '512M',
    min_uptime: '10s',
    max_restarts: 10,
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
    error_file: path.join(__dirname, 'logs/pm2-error.log'),
    out_file: path.join(__dirname, 'logs/pm2-out.log'),
    merge_logs: true,
    time: true,
  }],
};
```

> File `.cjs` vì `package.json` backend có `"type": "module"`.

**Khởi động:**

```bash
cd backend
mkdir logs
npm install
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
pm2 logs production-dashboard-backend
```

**Cập nhật code backend:**

```bash
pm2 reload ecosystem.config.cjs --update-env
pm2 save
```

### 6.3 UI — PM2 + Vite preview (không NGINX)

**Tránh `pm2 serve` trên Windows** (hay 403/path). Dùng Vite preview:

```bash
cd frontend
npm run build

# Từ thư mục frontend:
pm2 start .\node_modules\vite\bin\vite.js --name production-dashboard-ui --interpreter node -- preview --host 0.0.0.0 --port 4173 --strictPort
pm2 save
```

Linux tương tự:

```bash
pm2 start ./node_modules/vite/bin/vite.js --name production-dashboard-ui --interpreter node -- preview --host 0.0.0.0 --port 4173 --strictPort
```

### 6.4 Windows — deploy.ps1 (NGINX + PM2)

Chạy từ root repo (cần NGINX tại `C:\nginx` hoặc `-NginxRoot`):

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1

# Lần đầu production server:
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -InstallAutoStart -OpenFirewall
```

Script thực hiện:

1. Build frontend với `VITE_API_BASE_URL=/api`
2. `npm install` backend, tạo `backend/logs`
3. `pm2 start` hoặc `pm2 reload ecosystem.config.cjs`
4. Render `infrastructure/nginx/app.conf` → `C:\nginx\conf\production-dashboard.conf`
5. Reload NGINX
6. (Tuỳ chọn) Task Scheduler: `ProductionDashboard-NGINX` (boot), `ProductionDashboard-PM2` (`pm2 resurrect` at logon)

**Kiểm tra sau deploy:**

```bash
pm2 status
pm2 logs production-dashboard-backend
curl http://localhost/health
curl http://localhost/api/auth/login -X POST -H "Content-Type: application/json" -d "{\"username\":\"...\",\"password\":\"...\"}"
```

### 6.5 Auto-start Windows (không dùng pm2-windows-service)

| Task | Trigger | Lệnh |
|------|---------|------|
| `ProductionDashboard-NGINX` | At startup (SYSTEM) | `nginx.exe` |
| `ProductionDashboard-PM2` | At user logon | `pm2 resurrect` |

`pm2 save` sau mỗi lần thêm/xóa process.

### 6.6 Firewall

Mở TCP inbound: **3001** (API), **4173** (UI PM2), **80** (NGINX).

---

## 7. Checklist áp dụng sang project mới

### Phase A — Database & backend

- [ ] Copy `migration_add_user_accounts.sql`, chạy trên PostgreSQL
- [ ] Copy `auth.js` (routes), `users.js`, `middleware/auth.js`
- [ ] Mount `/api/auth`, `/api/users` trong `app.js`
- [ ] Cài `bcryptjs`, `jsonwebtoken`
- [ ] Tạo `backend/.env` với `JWT_SECRET`, `CORS_ORIGIN`, DB_*
- [ ] `npm run create-user` → tài khoản admin
- [ ] Test: `POST /api/auth/login` trả token

### Phase B — Frontend

- [ ] Copy `LoginPage.tsx`, `LoginPage.css`, logo asset
- [ ] Copy `authApi.ts`, chỉnh `getApiBaseUrl()` nếu cấu trúc khác
- [ ] Sửa `App.tsx` — gate login + `SESSION_KEY`
- [ ] (Tuỳ chọn) `AccountManagement.tsx` + tab trong dashboard
- [ ] Đảm bảo `api.ts` dùng `mes_login_session` cho Bearer
- [ ] `.env.production` + `npm run build`

### Phase C — Deploy

- [ ] Copy `ecosystem.config.cjs`, đổi `name` app PM2
- [ ] `pm2 start` + `pm2 save`
- [ ] Chọn flow B (PM2 UI+API) hoặc A (deploy.ps1 + NGINX)
- [ ] Khớp `CORS_ORIGIN` với URL UI thực tế
- [ ] Khớp `VITE_API_BASE_URL` với URL API thực tế
- [ ] Test login trên trình duyệt từ máy LAN khác

---

## 8. Tùy chỉnh nhanh (branding)

| Vị trí | Đổi gì |
|--------|--------|
| `LoginPage.tsx` | `h1`, `p`, feature bullets, `login-footer-brand` |
| `LoginPage.css` | Màu gradient `.login-page`, `.login-submit` |
| `assets/cadivi-logo.png` | Logo công ty |
| `ecosystem.config.cjs` | `name` PM2 process |
| Scheduled Task names trong `deploy.ps1` | Prefix tên project |

---

## 9. API contract tham chiếu (copy nhanh)

**Login request:**

```http
POST /api/auth/login
Content-Type: application/json

{ "username": "admin@company.local", "password": "secret" }
```

**Login success:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "username": "admin@company.local",
      "role": "admin",
      "isActive": true,
      "plant": null,
      "area": null,
      "line": null,
      "lastLoginAt": "2026-05-18T10:00:00.000Z"
    }
  },
  "timestamp": "..."
}
```

**Request có auth:**

```http
GET /api/users
Authorization: Bearer <token>
```

---

## 10. Troubleshooting

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|-------------|------------------------|------------|
| CORS error trên browser | `CORS_ORIGIN` sai hoặc `NODE_ENV=production` | Sửa `backend/.env`, `pm2 reload --update-env` |
| API gọi `localhost` từ máy khác | `VITE_API_BASE_URL` build sai | Set IP/hostname thật, `npm run build` lại |
| 401 mọi API sau login | Thiếu Bearer hoặc token hết hạn 24h | Login lại; kiểm tra header |
| PM2 restart loop | DB không kết nối | Xem `backend/logs/pm2-error.log` |
| UI 403 với `pm2 serve` (Windows) | Bug path static | Dùng `vite preview` qua PM2 |
| `mes_users` không tồn tại | Chưa migrate | Chạy `migration_add_user_accounts.sql` |
| Invalid credentials | User chưa tạo / sai password | `npm run create-user` |

---

## 11. Tài liệu liên quan trong repo

- `docs/guides/PM2_DEPLOYMENT.md` — PM2 không NGINX, Windows VM
- `README-deploy.md` — NGINX + PM2 + Task Scheduler chi tiết
- `backend/ENV_SETUP.md` — biến môi trường backend
- `frontend/.env.production.example` — biến build Vite

---

*Skill được sinh từ Production Overview Dashboard — dùng làm template khi onboard login/auth/deploy vào MES hoặc dashboard nội bộ khác.*
