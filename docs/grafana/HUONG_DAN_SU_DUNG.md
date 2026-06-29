# Hướng dẫn sử dụng Grafana MES & cài đặt trên PC khác

Tài liệu dành cho vận hành và IT: cách dùng Grafana song song với MES, và cách triển khai Grafana trên máy tính mới (nhà máy khác, máy dev, máy xem báo cáo).

---

## 0. Cài tự động một lệnh (PC mới)

**Yêu cầu:** Docker Desktop đang chạy, Node.js 18+, đã clone repo MES.

### Cùng PC với Postgres (DB local)

```powershell
cd "Production Overview Dashboard NEW"
node scripts/setup-grafana.mjs
```

Hoặc Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-grafana.ps1
```

Script tự động:

1. Tạo `grafana/.env` (nếu chưa có)
2. Đọc `backend/.env` → render datasource Postgres
3. Build dashboard JSON (`mes-speed-lab`, `mes-equipment-detail`)
4. `docker compose -f docker-compose.grafana.yml up -d` (container `mes-grafana-poc`)
5. Chờ health check và in URL + hướng dẫn `VITE_GRAFANA_URL`

### Postgres trên PC/server khác

```powershell
node scripts/setup-grafana.mjs --db-host 192.168.1.100
```

### Tùy chọn

| Tham số | Mô tả |
|---------|--------|
| `--db-host <ip>` | IP máy chạy PostgreSQL |
| `--db-port 5432` | Port Postgres |
| `--grafana-port 3000` | Port UI Grafana |
| `--admin-password <pw>` | Mật khẩu admin Grafana |
| `--skip-docker` | Chỉ sinh config, không start Docker |
| `--help` | Trợ giúp |

**Sau khi cài:** trên PC chạy MES, thêm `VITE_GRAFANA_URL=http://<IP-PC-GRAFANA>:3000` vào `frontend/.env` và restart dev server.

**Lỗi port 3000 đã dùng?** Xem [mục 5 — Port 3000 bị chiếm](#lỗi-port-3000-đã-dùng).

---

## 1. Grafana trong hệ thống MES

| Thành phần | Vai trò |
|------------|---------|
| **MES (tab Equipment Detail, Speed Lab)** | Giao diện chính: chart, Gantt, OEE waterfall, PO, realtime |
| **Grafana** | Phân tích bổ sung: speed/OEE lịch sử dài, aggregate SQL, export — mở qua nút **Mở Grafana** |

Grafana **không thay thế** tab MES. Hai hệ thống dùng chung database PostgreSQL (`production_dashboard`).

### Dashboard có sẵn

| Dashboard | UID | Mở từ MES |
|-----------|-----|-----------|
| MES Speed Lab | `mes-speed-lab` | Tab Speed Lab → **Mở Grafana** |
| MES Equipment Detail | `mes-equipment-detail` | Tab Equipment (chi tiết máy) → **Mở Grafana** |
| MES Speed Lab POC | `mes-speed-lab-poc` | Chỉ Grafana (thử nghiệm) |

URL mẫu (thay `SH-05` bằng mã máy):

```
http://localhost:3000/d/mes-speed-lab?var-machine_id=SH-05&from=now-1h&to=now
http://localhost:3000/d/mes-equipment-detail?var-machine_id=SH-05&from=now-1h&to=now
```

---

## 2. Sử dụng hàng ngày (từ MES)

### 2.1 Mở Grafana từ MES

1. Đăng nhập MES như bình thường.
2. Vào **Speed Lab** hoặc **Equipment** → chọn máy.
3. Chọn ca / ngày trên **toolbar OEE** (giống khi xem chart MES).
4. Bấm **Mở Grafana** (góc phải) — tab mới mở dashboard đã đồng bộ:
   - biến `machine_id`
   - cửa sổ thời gian `from` / `to`
   - timezone `Asia/Ho_Chi_Minh`

### 2.2 Xem trực tiếp trên Grafana

1. Mở trình duyệt: `http://<địa-chỉ-grafana>:3000`
2. Đăng nhập (mặc định POC: `admin` / `admin` — đổi password sau khi cài).
3. Menu **Dashboards** → folder **MES**.
4. Chọn dashboard → biến **Machine** (dropdown) → chỉnh **time range** (góc phải trên).

**Gợi ý time range (ICT):**

| Nhu cầu | Time range |
|---------|------------|
| Đang chạy / 1 giờ qua | `Last 1 hour` |
| Cả ca 1 (06:00–14:00) | Quick link trên dashboard hoặc `now/d+6h` → `now/d+14h` |
| 24 giờ | `Last 24 hours` |
| 7 ngày | `Last 7 days` |

Chi tiết 3 scenario POC: [`POC_SCENARIOS.md`](POC_SCENARIOS.md).

### 2.3 Đọc panel chính

**Speed Lab (`mes-speed-lab`):**

- KPI: peak speed, % thời gian speed=0, số mẫu
- Chart: actual vs target speed (bucket 30s)
- OEE components, running time tích lũy
- Timeline trạng thái speed (running / creep / stopped)
- Energy kWh theo giờ

**Equipment Detail (`mes-equipment-detail`):**

- Snapshot máy live (status, speed, OEE, operator, product)
- OEE trung bình theo range
- Speed trend + Gantt trạng thái vận hành
- Telemetry 2h gần nhất (nhiệt độ, dòng, công suất)
- Bảng production orders

> OEE Waterfall v2 và logic Gantt/PO phức tạp vẫn nằm trong MES, không có đầy đủ trên Grafana.

---

## 3. Cài Grafana trên PC mới (từ đầu)

### 3.1 Yêu cầu

| Phần mềm | Ghi chú |
|----------|---------|
| **Docker Desktop** | Windows / macOS — hoặc Docker Engine trên Linux |
| **Git** | Clone repository MES |
| **Node.js 18+** | Chạy script render datasource / build dashboard |
| **PostgreSQL** | DB `production_dashboard` — trên cùng PC hoặc server mạng nội bộ |

### 3.2 Các kiến trúc thường gặp

```
Kiến trúc A — Tất cả trên một PC (POC / nhỏ)
┌─────────────────────────────────────┐
│  PC nhà máy                         │
│  Postgres :5432                     │
│  Backend MES :3001                  │
│  Frontend MES :5173 / nginx         │
│  Grafana Docker :3000               │
└─────────────────────────────────────┘

Kiến trúc B — Grafana trên PC khác, DB trên server
┌──────────────┐      mạng LAN       ┌─────────────────┐
│ PC xem báo   │ ──────────────────► │ Server DB       │
│ cáo          │   Postgres :5432    │ 192.168.x.x     │
│ Grafana :3000│                     │ Backend + MES   │
└──────────────┘                     └─────────────────┘

Kiến trúc C — MES trên PC A, Grafana trên PC B
 PC A: MES UI + API + DB
 PC B: chỉ Grafana → trỏ DB về IP PC A
 MES trên PC A: VITE_GRAFANA_URL=http://<IP-PC-B>:3000
```

### 3.3 Các bước cài (PC chạy Grafana)

**Bước 1 — Lấy mã nguồn**

```powershell
git clone <url-repo> "Production Overview Dashboard NEW"
cd "Production Overview Dashboard NEW"
```

**Bước 2 — Cấu hình database**

Đảm bảo `backend/.env` có thông tin Postgres (hoặc tạo `grafana/.env` override):

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=production_dashboard
DB_USER=postgres
DB_PASSWORD=<mật-khẩu>
```

Nếu Postgres **không** trên cùng PC với Grafana:

```env
# grafana/.env
GRAFANA_PG_HOST=192.168.1.100
GRAFANA_PG_PORT=5432
GRAFANA_PG_DATABASE=production_dashboard
GRAFANA_PG_USER=grafana_readonly
GRAFANA_PG_PASSWORD=<mật-khẩu-readonly>
```

> Trên server Postgres: mở firewall port 5432 (chỉ subnet nội bộ), sửa `pg_hba.conf` cho phép IP PC Grafana, khuyến nghị user `grafana_readonly` (xem `grafana/sql/create_grafana_readonly_user.sql`).

**Bước 3 — Cấu hình Grafana**

```powershell
copy grafana\.env.example grafana\.env
```

Sửa `grafana/.env`:

```env
GRAFANA_PORT=3000
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=<đặt-mật-khẩu-mạnh>
GRAFANA_URL=http://localhost:3000
```

**Bước 4 — Sinh dashboard JSON (nếu chưa có hoặc sau khi sửa SQL)**

```powershell
node scripts/build-grafana-dashboards.mjs
```

**Bước 5 — Khởi động Grafana**

```powershell
docker compose -f docker-compose.grafana.yml up -d
```

Kiểm tra:

```powershell
docker ps
# Container: mes-grafana-poc
```

Mở: `http://localhost:3000` → login admin → **Connections → Data sources** → **MES PostgreSQL** → **Save & test** phải **OK**.

**Bước 6 — (Tùy chọn) User read-only cho production**

```powershell
psql -U postgres -d production_dashboard -f grafana/sql/create_grafana_readonly_user.sql
```

Cập nhật `grafana/.env` dùng `GRAFANA_PG_USER=grafana_readonly`, rồi:

```powershell
docker compose -f docker-compose.grafana.yml up -d grafana
```

### 3.4 Nối MES trên PC khác với Grafana

Trên PC **build / chạy frontend MES**, thêm biến môi trường:

**Dev (`frontend/.env`):**

```env
VITE_GRAFANA_URL=http://192.168.1.50:3000
```

**Production (`frontend/.env.production` trước khi `npm run build`):**

```env
VITE_GRAFANA_URL=http://192.168.1.50:3000
```

Thay `192.168.1.50` bằng IP hoặc hostname PC chạy Grafana. Restart dev server hoặc build lại frontend.

Nút **Mở Grafana** trên MES sẽ trỏ đúng host Grafana.

### 3.5 Import vào Grafana có sẵn (không dùng Docker compose)

Nếu đã có container Grafana khác trên port 3000:

```powershell
node scripts/render-grafana-datasource.mjs
node scripts/provision-grafana-api.mjs
```

Đặt trong `grafana/.env`:

```env
GRAFANA_URL=http://localhost:3000
GRAFANA_ADMIN_PASSWORD=<mật-khẩu-admin>
```

---

## 4. Vận hành & bảo trì

### 4.1 Lệnh thường dùng

| Việc | Lệnh |
|------|------|
| Bật Grafana | `docker compose -f docker-compose.grafana.yml up -d` |
| Tắt Grafana | `docker compose -f docker-compose.grafana.yml down` |
| Xem log | `docker logs mes-grafana-poc --tail 50` |
| Restart sau đổi dashboard JSON | `docker compose -f docker-compose.grafana.yml restart grafana` |
| Sinh lại dashboard | `node scripts/build-grafana-dashboards.mjs` |
| Render lại datasource | `node scripts/render-grafana-datasource.mjs` |

### 4.2 Sau khi đổi mật khẩu DB

```powershell
node scripts/render-grafana-datasource.mjs
docker compose -f docker-compose.grafana.yml up -d grafana
```

### 4.3 Cập nhật dashboard từ repo mới

```powershell
git pull
node scripts/build-grafana-dashboards.mjs
docker compose -f docker-compose.grafana.yml restart grafana
```

---

## 5. Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|-------------|------------------------|------------|
| Datasource **connection failed** | Sai host/password; Postgres không listen LAN | Kiểm tra `backend/.env` / `grafana/.env`; chạy lại `render-grafana-datasource.mjs`; kiểm tra `pg_hba.conf` |
| Dashboard **trống** | Sai time range; máy không có `oee_calculations` | Chọn máy có dữ liệu (vd. SH-05); mở rộng `Last 24 hours` |
| Thời gian lệch / không có điểm | Timestamp OEE lưu ICT wall-clock | Dashboard đã cast `AT TIME ZONE 'Asia/Ho_Chi_Minh'` — hard-refresh Grafana |
| Nút **Mở Grafana** MES sai host | Thiếu `VITE_GRAFANA_URL` | Set URL đúng IP Grafana; rebuild frontend |
| Port 3000 bị chiếm | Container Grafana cũ (`nhed-grafana`, `mes-grafana-poc`) | `docker stop nhed-grafana` hoặc `node scripts/setup-grafana.mjs --grafana-port 3002` |
| `change_me` trong datasource | Chưa render từ `.env` | `node scripts/render-grafana-datasource.mjs` |

### Kiểm tra nhanh bằng API

```powershell
# Health
Invoke-RestMethod http://localhost:3000/api/health

# Danh sách dashboard (thay admin:admin)
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:admin"))
Invoke-RestMethod -Uri "http://localhost:3000/api/search?type=dash-db" -Headers @{Authorization="Basic $auth"}
```

### Lỗi port 3000 đã dùng

Thông báo Docker: `bind: Only one usage of each socket address` — đã có Grafana/process khác trên port 3000 (thường là `nhed-grafana` hoặc `mes-grafana-poc` đang chạy).

**Từ bản script mới:** `node scripts/setup-grafana.mjs` tự xử lý:
- Nếu `mes-grafana-poc` **đã chạy** trên port 3000 → chỉ `docker restart` (không `compose up --force-recreate`).
- Nếu port 3000 **bận bởi container khác** → tự chuyển sang port **3002** và cập nhật `grafana/.env`.

Chạy lại một lệnh:

```powershell
node scripts/setup-grafana.mjs
```

Nếu script chuyển sang 3002, cập nhật `frontend/.env`: `VITE_GRAFANA_URL=http://localhost:3002`

**Cách A — Giữ Grafana cũ, chạy MES Grafana port 3002 (thủ công):**

```powershell
node scripts/setup-grafana.mjs --grafana-port 3002
```

Cập nhật `frontend/.env`:

```env
VITE_GRAFANA_URL=http://localhost:3002
```

**Cách B — Dừng container chiếm port 3000, chạy lại:**

```powershell
docker ps --format "table {{.Names}}\t{{.Ports}}"
docker stop nhed-grafana
# hoặc: docker stop mes-grafana-poc
node scripts/setup-grafana.mjs
```

**Cách C — `mes-grafana-poc` đã chạy sẵn, chỉ cần cập nhật config:**

```powershell
node scripts/render-grafana-datasource.mjs
node scripts/build-grafana-dashboards.mjs
docker restart mes-grafana-poc
```

Mở http://localhost:3000 — không cần `docker compose up` lại.

---

## 6. Bảo mật (khuyến nghị production)

1. Đổi `GRAFANA_ADMIN_PASSWORD` ngay sau cài đặt.
2. Dùng user Postgres `grafana_readonly` (chỉ SELECT).
3. Không expose port 3000 ra Internet; chỉ VLAN nội bộ.
4. Không commit `grafana/.env`, `grafana/provisioning/datasources/postgres.yml` (đã gitignore).
5. Tắt anonymous nếu không cần embed: bỏ `GF_AUTH_ANONYMOUS_ENABLED` trong `docker-compose.grafana.yml`.

---

## 7. Tài liệu liên quan

| File | Nội dung |
|------|----------|
| [`README.md`](README.md) | Setup kỹ thuật ngắn |
| [`POC_SCENARIOS.md`](POC_SCENARIOS.md) | 3 scenario so sánh MES vs Grafana |
| [`EMBED_DECISION.md`](EMBED_DECISION.md) | Panel nào embed / giữ trong MES |
| [`RETENTION_PLAN.md`](RETENTION_PLAN.md) | Retention `oee_calculations` |
| [`MES_BASELINE_RESULTS.md`](MES_BASELINE_RESULTS.md) | Kết quả đo latency mẫu |

---

## 8. Checklist triển khai PC mới

- [ ] Docker chạy được (`docker ps`)
- [ ] `backend/.env` hoặc `grafana/.env` trỏ đúng Postgres
- [ ] `copy grafana\.env.example grafana\.env` và đổi password admin
- [ ] `node scripts/build-grafana-dashboards.mjs`
- [ ] `docker compose -f docker-compose.grafana.yml up -d`
- [ ] Datasource **MES PostgreSQL** → Save & test OK
- [ ] Mở `mes-speed-lab` + chọn máy → có điểm speed
- [ ] (Nếu dùng MES) `VITE_GRAFANA_URL` trỏ đúng IP Grafana
- [ ] (Khuyến nghị) Tạo `grafana_readonly` và đổi password admin Grafana
