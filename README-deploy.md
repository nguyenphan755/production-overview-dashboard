# Deploy guide - NGINX + PM2 (Windows server)

Triển khai Production Overview Dashboard sau NGINX + PM2 trên một máy
chủ Windows nội bộ (không có domain, chỉ dùng IP nội bộ).

Sau khi triển khai:

- Browser chỉ thấy port **80** (NGINX)
- NGINX phục vụ static từ `frontend\build\`
- NGINX proxy `/api/*` và `/ws` -> backend Express trên `127.0.0.1:3001`
- PM2 quản lý backend, optionally chạy như Windows Service để auto-start

## 1. Yêu cầu trên server Windows

- **Node.js >= 18** (https://nodejs.org/)
- **PM2** -> `npm install -g pm2`
- **NGINX for Windows** -> http://nginx.org/en/download.html, giải nén
  vào `C:\nginx\` (hoặc dùng `winget install nginxinc.nginx` rồi copy
  sang `C:\nginx`)
- **PostgreSQL** đã chạy, DB `production_dashboard` đã init, file
  `backend\.env` có credential đúng
- PowerShell 5.1+ (sẵn có trên Windows 10/11/Server 2016+)

Xác minh nhanh:

```powershell
node -v
npm -v
pm2 -v
& 'C:\nginx\nginx.exe' -v
```

## 2. Đưa source lên server

Clone hoặc copy toàn bộ repo, ví dụ tại
`C:\apps\production-dashboard`. Đảm bảo `backend\.env` đã có
DB_HOST/DB_USER/DB_PASSWORD/DB_NAME đúng cho server đó.

## 3. Chạy deploy script

Mở **PowerShell as Administrator**, vào thư mục project:

```powershell
cd 'C:\apps\production-dashboard'
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

Lần đầu nên chạy với cả hai option để PM2 + NGINX auto-start sau reboot
và mở firewall port 80:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -InstallAutoStart -OpenFirewall
```

Các tham số khác:

| Param | Ý nghĩa |
|---|---|
| `-NginxRoot <path>` | Thư mục cài NGINX (default `C:\nginx`) |
| `-InstallAutoStart` | Đăng ký 2 Scheduled Task: NGINX chạy lúc boot (SYSTEM), PM2 resurrect lúc user logon |
| `-OpenFirewall` | Thêm rule Windows Firewall cho TCP 80 |
| `-SkipFrontendBuild` | Bỏ qua `npm install` + `npm run build` cho FE |
| `-SkipBackendInstall` | Bỏ qua `npm install` cho backend |

> Trước đây có option `-InstallPm2Service` (cài `pm2-windows-service`).
> Đã gỡ bỏ vì package đó prompt interactive (user/password) và hay
> hang khi chạy unattended. Thay bằng Task Scheduler native, ổn định hơn.

Script là **idempotent**, chạy lại nhiều lần vẫn ổn:

1. Tạo `frontend\.env.production` với `VITE_API_BASE_URL=/api`
2. `npm install` + `npm run build` (output: `frontend\build\`)
3. `npm install` cho backend, đảm bảo PM2 đã cài
4. `pm2 start` lần đầu, các lần sau là `pm2 reload --update-env`
   (zero-downtime). `pm2 save` để PM2 nhớ danh sách
5. (Tùy chọn) đăng ký Scheduled Task `ProductionDashboard-NGINX`
   (boot/SYSTEM) và `ProductionDashboard-PM2` (logon/user)
6. Render `infrastructure\nginx\app.conf` (thay `__FRONTEND_DIST__` bằng
   đường dẫn tuyệt đối với forward-slash) thành
   `C:\nginx\conf\production-dashboard.conf`
7. Backup `C:\nginx\conf\nginx.conf` -> `nginx.conf.bak` (chỉ lần đầu)
   và viết file `nginx.conf` mới có `include production-dashboard.conf;`
8. `nginx -t` -> nếu ok thì `nginx -s reload` (hoặc start nếu chưa chạy)
9. (Tùy chọn) thêm Windows Firewall rule cho TCP 80

Sau khi xong, mở `http://<server-ip>/` trên trình duyệt.

## 3.1 Sau `git pull` — tối ưu chart (Equipment / Speed Lab)

Khi đã deploy rồi và chỉ cần kéo code mới + index DB + env poll:

```powershell
cd 'C:\apps\production-dashboard'   # đường dẫn repo trên PC nhà máy
git pull origin main

# Một lệnh: kiểm tra DB → index CONCURRENTLY → env → build FE → pm2 reload → benchmark
powershell -ExecutionPolicy Bypass -File .\scripts\factory-post-pull.ps1
```

**Trước khi chạy lần đầu**, đảm bảo `backend\.env` có:

- `DB_PASSWORD` đúng (nhà máy thường `Cadivi1975`)
- `JWT_SECRET` chuỗi ngẫu nhiên ≥32 ký tự (bắt buộc khi `NODE_ENV=production`)

Script tự thêm (nếu chưa có): `AVAILABILITY_SYNC_INTERVAL=60`, `VITE_POLL_MS_MACHINES=2000`, `VITE_POLL_MS_MACHINE_DETAIL=5000`.

Chỉ index, không build:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\factory-post-pull.ps1 -SkipBuild
```

Kiểm tra / đo lại:

```powershell
node scripts/check-factory-readiness.mjs
node scripts/benchmark-chart-apis.mjs
```

## 4. Lệnh thường dùng

### PM2 (backend)

```powershell
pm2 status
pm2 logs production-dashboard-backend
pm2 logs production-dashboard-backend --lines 200
pm2 restart production-dashboard-backend
pm2 reload  production-dashboard-backend     # zero-downtime
pm2 stop    production-dashboard-backend
pm2 save                                     # snapshot tiến trình hiện tại
```

### NGINX

```powershell
# Test config
& 'C:\nginx\nginx.exe' -p 'C:\nginx' -t

# Reload sau khi sửa config
& 'C:\nginx\nginx.exe' -p 'C:\nginx' -s reload

# Stop graceful / immediate
& 'C:\nginx\nginx.exe' -p 'C:\nginx' -s quit
& 'C:\nginx\nginx.exe' -p 'C:\nginx' -s stop

# Logs
Get-Content 'C:\nginx\logs\error.log'  -Tail 50 -Wait
Get-Content 'C:\nginx\logs\access.log' -Tail 50 -Wait
```

## 5. Cập nhật code mới

```powershell
cd 'C:\apps\production-dashboard'
git pull
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

`deploy.ps1` rebuild frontend, `pm2 reload` backend (zero-downtime) và
reload NGINX, không downtime đáng kể.

## 6. Ghi chú

### 6.1. Backend port

Backend listen `0.0.0.0:3001` (xem `backend\src\app.js`). Sau khi NGINX
chạy, có thể cấm port 3001 inbound từ ngoài (chỉ giữ port 80 mở):

```powershell
New-NetFirewallRule -DisplayName 'Block backend 3001 inbound' `
  -Direction Inbound -Action Block -Protocol TCP -LocalPort 3001
```

Hoặc đổi backend listen sang `127.0.0.1` (cần sửa code trong
`backend\src\app.js`, ngoài phạm vi script này).

### 6.2. Auto-start khi reboot (NGINX + PM2)

PM2 trên Windows **không** dùng được `pm2 startup` như Linux, và package
`pm2-windows-service` thì hay hang khi prompt user/password. Cách native
ổn định: dùng **Task Scheduler**. Chạy deploy với `-InstallAutoStart`:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -InstallAutoStart
```

Script đăng ký 2 Scheduled Task:

| Task | Trigger | RunAs | Action |
|---|---|---|---|
| `ProductionDashboard-NGINX` | At system boot | `SYSTEM` (highest) | `C:\nginx\nginx.exe` (cwd `C:\nginx`) |
| `ProductionDashboard-PM2`   | At user logon  | current user (highest) | `pm2 resurrect` |

Kiểm tra:

```powershell
Get-ScheduledTask -TaskName 'ProductionDashboard-*'
```

Test thủ công (không cần reboot):

```powershell
Start-ScheduledTask -TaskName 'ProductionDashboard-NGINX'
Start-ScheduledTask -TaskName 'ProductionDashboard-PM2'
```

Gỡ:

```powershell
Unregister-ScheduledTask -TaskName 'ProductionDashboard-NGINX' -Confirm:$false
Unregister-ScheduledTask -TaskName 'ProductionDashboard-PM2'   -Confirm:$false
```

> Vì PM2 dump file (`%USERPROFILE%\.pm2\dump.pm2`) thuộc về user, task
> phải chạy as user. Nếu Windows server cấu hình **auto-login** (cùng
> user) thì backend sẽ tự lên ngay sau reboot. Nếu không auto-login thì
> phải có user logon trước khi backend khởi động.

#### 6.2.1. Lựa chọn thay thế: nssm

Nếu muốn coi NGINX là Windows Service đúng nghĩa (start/stop qua
`services.msc`), dùng [`nssm`](https://nssm.cc/):

```powershell
nssm install nginx 'C:\nginx\nginx.exe'
nssm set nginx AppDirectory 'C:\nginx'
nssm start nginx
```

### 6.3. WebSocket / real-time

Hiện `frontend\.env` đặt `VITE_REALTIME_ENABLED=false` nên client không
tự kết nối WebSocket. NGINX vẫn proxy `/ws` sẵn sàng.

Nếu bật realtime sau này, cần sửa `deploy.ps1` đoạn ghi
`.env.production` thành `VITE_REALTIME_ENABLED=true` và dùng URL tuyệt
đối cho `VITE_API_BASE_URL` (ví dụ `http://<server-ip>/api`) - vì
`new WebSocket(...)` yêu cầu URL tuyệt đối (`ws://...`/`wss://...`).

### 6.4. CORS

Khi truy cập qua NGINX, frontend và API cùng origin
(`http://<server-ip>`) nên CORS không còn là vấn đề. Backend đang cho
phép tất cả origin trong non-production và đọc `CORS_ORIGIN` từ
`backend\.env` ở production. Có thể đặt `CORS_ORIGIN=http://<server-ip>`
để siết lại.

### 6.5. Đổi port backend

Nếu đổi `PORT` trong `backend\.env`, cần đồng bộ:

- `backend\ecosystem.config.cjs` (`env.PORT`)
- `infrastructure\nginx\app.conf` (`proxy_pass http://127.0.0.1:<port>`
  trong cả 3 location: `/api/`, `/ws`, `/health`)
- Chạy lại `.\deploy.ps1`

### 6.6. NGINX bị conflict port 80

Nếu IIS hoặc service khác đang giữ port 80, NGINX sẽ start fail. Kiểm tra:

```powershell
Get-NetTCPConnection -LocalPort 80 -State Listen
```

Tắt IIS nếu cần:

```powershell
Stop-Service W3SVC
Set-Service  W3SVC -StartupType Disabled
```

### 6.7. File backup nginx.conf

Lần đầu chạy script, `C:\nginx\conf\nginx.conf` được backup sang
`nginx.conf.bak`. Lần chạy sau giữ nguyên file `.bak` đó. Nếu muốn quay
về cấu hình NGINX gốc, copy `nginx.conf.bak` -> `nginx.conf`.
