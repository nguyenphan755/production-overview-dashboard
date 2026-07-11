# Tài liệu Kiến trúc Phần mềm (SAD)

## Production Overview Dashboard — MES CADIVI

| Thuộc tính | Giá trị |
|------------|---------|
| **Phiên bản** | 1.0 |
| **Ngày** | 11/07/2026 |
| **Phạm vi** | Phân tích đọc-only — không sửa mã nguồn |
| **Trạng thái** | Bản nháp — chờ duyệt |

---

## Mục lục

1. [Kiến trúc tổng thể](#1-kiến-trúc-tổng-thể)
2. [Cấu trúc thư mục](#2-cấu-trúc-thư-mục)
3. [Kiến trúc module](#3-kiến-trúc-module)
4. [Kiến trúc Frontend](#4-kiến-trúc-frontend)
5. [Kiến trúc Backend](#5-kiến-trúc-backend)
6. [Kiến trúc Database](#6-kiến-trúc-database)
7. [Quan hệ bảng SQL](#7-quan-hệ-bảng-sql)
8. [Kiến trúc API](#8-kiến-trúc-api)
9. [Luồng xác thực (Authentication)](#9-luồng-xác-thực-authentication)
10. [Luồng phân quyền (Authorization)](#10-luồng-phân-quyền-authorization)
11. [Luồng người dùng](#11-luồng-người-dùng)
12. [Luồng giao tiếp PLC](#12-luồng-giao-tiếp-plc)
13. [Sơ đồ luồng dữ liệu](#13-sơ-đồ-luồng-dữ-liệu)
14. [Quản lý cấu hình](#14-quản-lý-cấu-hình)
15. [Kiến trúc logging](#15-kiến-trúc-logging)
16. [Kiến trúc triển khai](#16-kiến-trúc-triển-khai)
17. [Kiến trúc Docker](#17-kiến-trúc-docker)
18. [Sao lưu & phục hồi](#18-sao-lưu--phục-hồi)
19. [Kiến trúc bảo mật](#19-kiến-trúc-bảo-mật)
- [Phụ lục A: Chi tiết từng màn hình](#phụ-lục-a-chi-tiết-từng-màn-hình)
- [Phụ lục B: Catalog API đầy đủ](#phụ-lục-b-catalog-api-đầy-đủ)
- [Phụ lục C: Inventory bảng Database](#phụ-lục-c-inventory-bảng-database)
- [Phụ lục D: Nợ kỹ thuật & trùng lặp](#phụ-lục-d-nợ-kỹ-thuật-trùng-lặp-và-file-không-dùng)

---

## 1. Kiến trúc tổng thể

Hệ thống là **MES Dashboard nội bộ** phục vụ giám sát sản xuất cáp điện (CADIVI) trên 4 khu vực: **Drawing, Stranding, Armoring, Sheathing**.

### 1.1 Sơ đồ tổng quan

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TẦNG XƯỞNG (Shopfloor)                          │
│  PLC/SCADA ──► KEPServer/OPC UA ──► Node-RED ──► REST API (Express)    │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    MÁY CHỦ WINDOWS (Nhà máy)                             │
│  ┌──────────┐   ┌─────────────┐   ┌────────────────────────────────┐  │
│  │ NGINX:80 │──►│ PM2/Express │──►│ PostgreSQL (production_dashboard)│  │
│  │ static   │   │   :3001     │   └────────────────────────────────┘  │
│  │ /api /ws │   │ WebSocket   │   ┌────────────────────────────────┐  │
│  └──────────┘   └─────────────┘   │ Grafana POC :3002 (optional)   │  │
│         ▲                          └────────────────────────────────┘  │
└─────────┼───────────────────────────────────────────────────────────────┘
          │
          │ HTTP + WebSocket
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              TRÌNH DUYỆT (~20 user) — React SPA (frontend/build)         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Stack công nghệ

| Thành phần | Công nghệ | Vai trò |
|------------|-----------|---------|
| Frontend | React 18, Vite 6, Tailwind 4, Chart.js, Recharts | Dashboard SPA, polling 1–5s |
| Backend | Express 4, Node.js ≥18, `ws` | REST API + WebSocket |
| Database | PostgreSQL | Lưu trữ MES, time-series, OEE |
| Ingress shopfloor | Node-RED + OPC UA | Ghi telemetry từ PLC |
| Reverse proxy | NGINX (Windows) | Static + proxy `/api`, `/ws` |
| Process manager | PM2 | Backend zero-downtime reload |
| Analytics POC | Grafana | Biểu đồ nâng cao (external link) |

### 1.3 Đặc điểm kiến trúc

- **Monorepo** đa thành phần: `frontend/`, `backend/`, `docs/`, `scripts/`
- **Không có tầng Controller/Repository** — routes gọi trực tiếp services + SQL
- **Real-time hybrid:** WebSocket cho cập nhật máy + polling REST cho KPI/chart
- **Không có React Router** — điều hướng bằng state tab nội bộ
- **Đang vận hành production** tại nhà máy qua PM2 + NGINX trên Windows

---

## 2. Cấu trúc thư mục

```
Production Overview Dashboard NEW/
├── frontend/                    # UI React (canonical)
│   ├── index.html               # SPA shell
│   ├── vite.config.ts
│   ├── package.json
│   ├── config/
│   │   └── mes-tag-mapping.json # Hợp đồng tag PLC → API/DB
│   └── src/
│       ├── main.tsx             # Entry point
│       ├── App.tsx              # Auth gate
│       ├── pages/               # LoginPage, Dashboard, AccountManagement
│       ├── components/
│       │   ├── tabs/            # 8 tab dashboard
│       │   ├── speed-lab/
│       │   ├── grafana/
│       │   └── ui/              # Radix/shadcn primitives
│       ├── hooks/               # Data fetching + polling
│       ├── services/            # api.ts, authApi.ts
│       ├── utils/
│       ├── types/
│       └── styles/
│
├── backend/
│   ├── server.js                # Entry → src/app.js
│   ├── ecosystem.config.cjs     # PM2 config
│   ├── node-red-mes-flow*.json  # Node-RED integration
│   ├── database/                # schema.sql + migrations (CANONICAL)
│   ├── scripts/                 # DB setup, import, cron jobs
│   └── src/
│       ├── app.js               # Express + WS + background jobs
│       ├── routes/              # 14 route modules
│       ├── services/            # 17 business services
│       ├── middleware/auth.js
│       └── websocket/broadcast.js
│
├── database/queries/            # ⚠️ Mirror schema (trùng lặp với backend/database/)
├── docs/                        # 75+ tài liệu kỹ thuật
├── scripts/                     # Benchmark, deploy helper, Python export
├── deploy/                      # nginx.conf mẫu
├── infrastructure/nginx/        # app.conf template cho deploy.ps1
├── grafana/                     # POC dashboards + provisioning
├── docker-compose.yml           # ⚠️ Thiếu Dockerfile
└── deploy.ps1                   # Script triển khai Windows chính
```

> **Lưu ý:** Rule `.cursor/rules/project-structure.mdc` mô tả frontend ở root `src/`, nhưng **thực tế code nằm tại `frontend/src/`**.

---

## 3. Kiến trúc module

### 3.1 Phân tầng Backend

```
routes/  ──►  middleware/auth.js (JWT)
    │
    ├──► services/  ──►  database/connection.js (pg pool)
    │
    └──► database/connection.js (trực tiếp, không qua service)
    
services/  ──►  websocket/broadcast.js (push realtime)
```

| Module | Trách nhiệm |
|--------|-------------|
| `routes/` | HTTP boundary, validation cơ bản, format response |
| `services/` | OEE, availability sync, speed lab, analytics cache, bobbin cuts |
| `middleware/auth.js` | JWT verify, role gate |
| `database/connection.js` | Pool PostgreSQL, slow query log |
| `websocket/broadcast.js` | Push `machine:update`, `presence:update` |

### 3.2 Services chính

| Service | Chức năng |
|---------|-----------|
| `oeeCalculator.js` | Tính OEE realtime |
| `availabilitySync.js` | Đồng bộ availability theo ca (continuous timer) |
| `availabilityAggregator.js` | Gọi DB function aggregation |
| `speedLabService.js` | Query bucket speed/OEE |
| `oeeWaterfallService.js` | Waterfall six big losses |
| `analyticsService.js` | Cache analytics JSONB + scheduler |
| `machineLineTelemetrySampler.js` | Sample telemetry 5s → partitioned table |
| `machineLineTelemetry.js` | Ghi telemetry + hourly energy rollup |
| `productionLengthService.js` | Delta chiều dài từ counter |
| `bobbinCutService.js` | Ghi bobbin cut QC |
| `oeeSettlementService.js` | Chốt OEE ca |
| `oeeSpeedHistoryService.js` | Speed history cho Equipment chart |
| `machineStatusCache.js` | In-memory cache trạng thái máy |
| `userPresenceService.js` | Online user tracking |
| `lineProcessingReportService.js` | HTML report xử lý dây chuyền |

### 3.3 Background jobs (khởi động trong `app.js`)

| Job | Interval mặc định | Env |
|-----|-------------------|-----|
| Availability sync | 30–60s | `AVAILABILITY_SYNC_INTERVAL` |
| Analytics cache refresh | 60s | `ANALYTICS_REFRESH_INTERVAL` |
| Machine line telemetry sampler | 5s | (hardcoded trong service) |
| User presence cleanup | interval nội bộ | — |
| WebSocket heartbeat | 30s | `WS_HEARTBEAT_MS` |

---

## 4. Kiến trúc Frontend

### 4.1 Mô hình ứng dụng

- **SPA một trang** mount tại `frontend/index.html`
- **Auth gate:** `App.tsx` kiểm tra `localStorage["mes_login_session"]`
- **Dashboard shell:** `Dashboard.tsx` quản lý `activeTab` + `selectedMachineId`
- **Code splitting:** lazy load `EquipmentDetail`, `SpeedLab`, `PerformanceAnalytics`

### 4.2 Điều hướng (không dùng React Router)

| Tab ID | Component | Lazy |
|--------|-----------|------|
| `production` | `ProductionOverview` | — |
| `quality` | `QualityControl` | — |
| `equipment` | `EquipmentStatus` / `EquipmentDetail` | Detail: lazy |
| `speed-lab` | `SpeedLab` | lazy |
| `analytics` | `PerformanceAnalytics` | lazy |
| `maintenance` | `Maintenance` | — |
| `schedule` | `ProductionSchedule` | — |
| `accounts` | `AccountManagement` | admin/supervisor only |

### 4.3 Data layer

| Hook / Service | Nguồn | Interval |
|----------------|-------|----------|
| `useGlobalKPIs`, `useProductionAreas` | REST | ~1s |
| `useMachines` | REST + WS `machine:update` | 1–5s (tab-aware) |
| `useMachineDetail` | REST + WS | ≥3–5s |
| `useSpeedLabQuery` | REST speed-lab | on-demand + poll live window |
| `useUserPresence` | REST heartbeat + WS | 20s / 15s |
| `mockApi.ts` | Local mock | khi `VITE_USE_MOCK_DATA=true` |

### 4.4 Styling

| File | Phạm vi |
|------|---------|
| `src/index.css` | Tailwind v4 bundle + `.mes-dashboard` (chính) |
| `pages/LoginPage.css` | Trang đăng nhập |
| `styles/speed-lab.css` | Tab Speed Lab |
| `styles/equipment-speed-panel.css` | Chart speed (Equipment + Speed Lab) |
| `styles/globals.css` | shadcn tokens — **có file nhưng không import** |
| `components/ui/*` | Radix/shadcn primitives |

### 4.5 Build production

- Vite `outDir: build`
- Production: strip `console`/`debugger` (esbuild drop)
- Manual chunks: `vendor-react`, `vendor-charts`, `vendor-recharts`, `vendor-export`

---

## 5. Kiến trúc Backend

### 5.1 Entry & lifecycle

```
backend/server.js → backend/src/app.js
```

**Khởi động (`server.listen`):**
1. Initialize machine status cache
2. Start availability continuous sync
3. Start analytics scheduler
4. Start machine line telemetry sampler
5. Start user presence cleanup

**Graceful shutdown (SIGTERM/SIGINT/uncaughtException):**
- Dừng WS heartbeat, background timers (`stopHandles[]`)
- Đóng WS clients, drain HTTP server
- `pool.end()` PostgreSQL

### 5.2 Health endpoints

| Endpoint | Mục đích | Response |
|----------|----------|----------|
| `GET /health` | Liveness | `{ status: "ok" }` |
| `GET /health/ready` | Readiness (DB) | `{ status: "ready", db: "ok" }` hoặc 503 |

### 5.3 Response envelope

```json
{
  "success": true,
  "data": {},
  "timestamp": "2026-07-11T00:00:00.000Z",
  "message": "optional"
}
```

### 5.4 Route mount map

```
/api/auth          → auth.js
/api/users         → users.js
/api/kpis          → kpis.js
/api/areas         → areas.js
/api/machines      → machines.js
/api/orders        → orders.js
/api/alarms        → alarms.js
/api/availability  → availability.js
/api/analytics     → analytics.js
/api/oee-settled   → oee-settled.js
/api/reports       → reports.js
/api/presence      → presence.js
/api/bobbin-cuts   → bobbinCuts.js
/api/speed-lab     → speedLab.js
WebSocket          → /ws
```

---

## 6. Kiến trúc Database

### 6.1 Thông tin chung

| Thuộc tính | Giá trị |
|------------|---------|
| Engine | PostgreSQL |
| Database | `production_dashboard` |
| Schema canonical | `backend/database/schema.sql` + migrations |
| ORM | Không — raw SQL qua `pg` |
| Bảng | 21 |
| View | 1 (`v_machine_telemetry_ai_hourly`) |
| Enum types | 7 |

### 6.2 Hub trung tâm

Bảng **`machines`** là snapshot realtime mỗi dây chuyền — 15+ bảng con có FK.

### 6.3 Time-series tiers

| Tier | Bảng | Mục đích |
|------|------|----------|
| Hot raw | `machine_metrics`, `machine_line_telemetry` (partitioned monthly) | Trend/sparkline |
| Hourly rollup | `energy_consumption`, `oee_calculations_hourly` | Energy, analytics dài hạn |
| Aggregated | `availability_aggregations`, `analytics_cache` | Shift/window cache |
| Settlement | `oee_shift_settlements` | OEE ca đã chốt |

### 6.4 Triggers & functions quan trọng

| Object | Trigger/Event | Hành vi |
|--------|---------------|---------|
| `update_machine_status_history()` | `machines.status` UPDATE | Đóng/mở segment Gantt |
| `calculate_availability_aggregation()` | status change + sync timer | Upsert availability |
| `log_machine_product_or_material_change()` | `product_name`/`material_code` UPDATE | Audit product change |
| `get_latest_availability()` | — | Latest shift/window per machine |

### 6.5 Enum types

| Enum | Values |
|------|--------|
| `machine_status` | running, idle, warning, error, stopped, setup |
| `production_area` | drawing, stranding, armoring, sheathing |
| `alarm_severity` | info, warning, error, critical |
| `order_status` | running, completed, interrupted, cancelled |
| `user_role` | operator, engineer, supervisor, admin |
| `maintenance_type` | PM, CM |
| `maintenance_status` | scheduled, in_progress, completed, cancelled, overdue |

---

## 7. Quan hệ bảng SQL

### 7.1 Sơ đồ ER (tóm tắt)

```
machines (HUB)
├── production_orders          (machine_id FK)
├── machine_metrics            (machine_id FK, CASCADE)
├── machine_line_telemetry     (machine_id FK, CASCADE, PARTITIONED)
├── machine_status_history     (machine_id FK, CASCADE)
├── availability_aggregations  (machine_id FK, CASCADE)
├── oee_calculations           (machine_id FK, CASCADE)
├── oee_calculations_hourly    (machine_id FK, CASCADE)
├── oee_shift_settlements      (machine_id FK, CASCADE)
├── production_length_events   (machine_id FK, CASCADE)
├── production_quality         (machine_id FK, CASCADE)
├── energy_consumption         (machine_id FK, CASCADE)
├── machine_energy_samples     (machine_id FK, CASCADE) — unused
├── alarms                     (machine_id FK, CASCADE)
├── bobbin_cut_records         (machine_id FK, CASCADE)
├── machine_product_change_events (machine_id FK, CASCADE)
├── maintenance_plans        (machine_id FK) — schema only
└── maintenance_requests       (machine_id FK) — schema only

production_orders
├── oee_calculations           (production_order_id FK)
├── production_quality         (production_order_id FK)
└── availability_aggregations  (production_order_id FK)

mes_users — standalone (auth)
analytics_cache — soft refs (scope_machine_id, scope_area)
material_master — soft ref via machines.material_code
```

### 7.2 Soft FK (không ràng buộc DB)

- `machines.production_order_id`
- `production_length_events.production_order_id`
- `machine_line_telemetry.production_order_id`
- `bobbin_cut_records.order_id`

---

## 8. Kiến trúc API

**Base URL:** `http://<host>:3001/api`  
**WebSocket:** `ws://<host>:3001/ws`  
**Tổng REST endpoints:** 43

### 8.1 Phân loại bảo vệ JWT

| Có JWT bắt buộc | Public (không JWT) |
|-----------------|-------------------|
| `/api/users/*` | Hầu hết GET (machines, areas, KPIs, analytics, speed-lab) |
| `/api/presence/*` | `PATCH /machines/:id`, POST metrics/alarms |
| `/api/reports/*` | Bobbin sync |
| `/api/oee-settled/*` | |
| `POST /availability/sync/*` | |
| `PUT /machines/name/:name` (Node-RED) | |

### 8.2 WebSocket events

| Event | Trigger | Payload |
|-------|---------|---------|
| `connected` | Client connect | `{ message }` |
| `machine:update` | PATCH/PUT machine | Full machine object |
| `presence:update` | Heartbeat/leave/timeout | `{ count }` |

---

## 9. Luồng xác thực (Authentication)

```
User → LoginPage → POST /api/auth/login
                        │
                        ▼
                  mes_users (bcrypt verify)
                        │
                        ▼
                  jwt.sign({ userId, username, role }, 24h)
                        │
                        ▼
                  localStorage["mes_login_session"] = { token, user }
                        │
                        ▼
                  Dashboard render
```

| Khía cạnh | Chi tiết |
|-----------|----------|
| Algorithm | bcrypt hash password |
| Token | JWT HS256, expiry **24h** |
| Payload | `{ userId, username, role }` |
| Refresh token | **Không có** — hết hạn phải login lại |
| Production guard | `JWT_SECRET` bắt buộc, fail-fast boot nếu thiếu/default |
| Verify endpoint | `POST /api/auth/verify` body `{ token }` |

---

## 10. Luồng phân quyền (Authorization)

**Roles:** `operator` | `engineer` | `supervisor` | `admin`

| Hành động | operator | engineer | supervisor | admin |
|-----------|:--------:|:--------:|:----------:|:-----:|
| Xem dashboard tabs | ✅ | ✅ | ✅ | ✅ |
| Tab Accounts | ❌ | ❌ | ✅ | ✅ |
| CRUD users (API) | ❌ | ❌ | ✅ | ✅ |
| Reports HTML/CSV | ✅* | ✅* | ✅* | ✅* |
| OEE settled | ✅* | ✅* | ✅* | ✅* |
| Presence | ✅* | ✅* | ✅* | ✅* |

*\*Cần JWT hợp lệ; backend chỉ enforce role chi tiết trên `/api/users`.*

**Frontend:** Tab Accounts ẩn nếu role ∉ `{admin, supervisor}`. Các tab khác **không gate theo role**.

**⚠️ Gap:** Hầu hết API ghi (PATCH machine, POST metrics/alarms) **không yêu cầu JWT**.

---

## 11. Luồng người dùng

```
Mở http://server-ip/
    │
    ├─ Chưa login → LoginPage → POST /auth/login → Dashboard (tab Production)
    │
    └─ Đã login → Dashboard
            │
            ├─ Production Overview → click máy → Equipment Detail
            ├─ Equipment → OEE toolbar, export HTML, Grafana link
            ├─ Speed Lab → waterfall, CSV, Grafana link
            ├─ Analytics → export PDF/PPT
            ├─ Schedule → xem orders
            ├─ Quality / Maintenance → mock UI
            ├─ Accounts (admin/supervisor) → quản lý user
            └─ Logout → xóa session
```

**Personas:**
- **Operator:** Giám sát ca, xem máy, alarm
- **Engineer:** Speed Lab, phân tích OEE, export
- **Supervisor/Admin:** Quản lý tài khoản, chốt ca OEE, báo cáo

---

## 12. Luồng giao tiếp PLC

```
PLC Tags
    │
    ▼
KEPServer / OPC UA
    │
    ▼
Node-RED (poll/subscribe)
    │  Map tags → JSON (mes-tag-mapping.json)
    │
    ├─► PUT /api/machines/name/:machineName  (JWT required)
    └─► PATCH /api/machines/:machineId       (no auth)
            │
            ▼
        UPDATE machines
        INSERT machine_metrics / machine_line_telemetry
        TRIGGER status_history, availability
        calculateOEE, productionLength delta
            │
            ▼
        WebSocket broadcast machine:update
            │
            ▼
        React Dashboard (fleet refresh)
```

**Hợp đồng tag:** `frontend/config/mes-tag-mapping.json`  
**Node-RED flows:** `backend/node-red-mes-flow.json`, `node-red-mes-flow-simple.json`  
**Tài liệu tag:** `docs/architecture/shopfloor_plc_tags.md`

**Fields PLC thường ghi:** `status`, `lineSpeed`, `targetSpeed`, `producedLength`, `producedLengthOk`, `producedLengthNg`, `energyMeterKwh`, `materialCode`, `productName`, `multiZoneTemperatures`, `current`, `power`, `temperature`

---

## 13. Sơ đồ luồng dữ liệu

```
[Thu thập]
PLC → Node-RED → PATCH/PUT machines
                    ├─► machine_metrics
                    ├─► machine_line_telemetry (partitioned)
                    ├─► production_length_events (delta)
                    └─► triggers → machine_status_history, availability_aggregations

[Tính toán nền]
availabilitySync (timer) → availability_aggregations
oeeCalculator → oee_calculations
analyticsScheduler → analytics_cache
machineLineTelemetry → energy_consumption (hourly UPSERT)
machineLineTelemetrySampler → machine_line_telemetry (5s)

[Phục vụ UI]
REST API ← PostgreSQL
WebSocket ← machine PATCH broadcast
React tabs ← polling + WS
Grafana ← deep link (optional, read PG directly)
```

---

## 14. Quản lý cấu hình

### 14.1 Backend (`backend/.env`)

| Biến | Mục đích | Default |
|------|----------|---------|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL | localhost:5432 |
| `JWT_SECRET` | Bắt buộc production | — |
| `JWT_EXPIRES_IN` | Token TTL | 24h |
| `NODE_ENV` | production → giảm log, enforce JWT | — |
| `PORT` | API port | 3001 |
| `AVAILABILITY_SYNC_INTERVAL` | Sync availability | 30–60s |
| `ANALYTICS_REFRESH_INTERVAL` | Analytics cache | 60s |
| `CORS_ORIGIN` | Allowed origins | — |
| `DB_SLOW_QUERY_MS` | Slow query warn | 1000 |
| `DB_LOG_QUERIES` | Verbose SQL log | false |
| `WS_HEARTBEAT_MS` | WS ping interval | 30000 |
| `SHUTDOWN_TIMEOUT_MS` | Graceful shutdown | 10000 |
| `JSON_BODY_LIMIT` | Request body max | 2mb |
| `LOG_REQUESTS` | Force request log in prod | false |

### 14.2 Frontend (build-time `VITE_*` → `.env.production`)

| Biến | Mục đích |
|------|----------|
| `VITE_API_BASE_URL` | `/api` (same-origin) hoặc absolute URL |
| `VITE_USE_MOCK_DATA` | Mock vs real API |
| `VITE_REALTIME_ENABLED` | Bật WebSocket |
| `VITE_POLL_MS_MACHINES` | Khuyến nghị **2000** |
| `VITE_POLL_MS_MACHINE_DETAIL` | Khuyến nghị **5000** |
| `VITE_GRAFANA_URL` | Deep link Grafana |
| `VITE_ENERGY_SOURCE` | `meter` hoặc `power` cho chart energy |

### 14.3 Scripts triển khai

| Script | Mục đích |
|--------|----------|
| `deploy.ps1` | Full deploy Windows (NGINX + PM2 + build) |
| `scripts/factory-post-pull.ps1` | Sau git pull: index DB, env, build, reload |
| `scripts/check-factory-readiness.mjs` | Kiểm tra readiness |
| `scripts/benchmark-chart-apis.mjs` | Benchmark chart APIs |
| `scripts/load-test-mes.mjs` | Load test 20 virtual users |

---

## 15. Kiến trúc logging

| Lớp | Cơ chế | Production behavior |
|-----|--------|---------------------|
| Express requests | Middleware log | **Tắt** (bật `LOG_REQUESTS=true`) |
| SQL queries | `connection.js` | Chỉ slow query ≥ `DB_SLOW_QUERY_MS` |
| WS connect/disconnect | `app.js` | **Tắt** |
| WS broadcast | `broadcast.js` | **Tắt** |
| Background jobs | availabilitySync, sampler | console.log/warn |
| Unhandled errors | process handlers | Log + graceful shutdown |
| Frontend | console.* | **Stripped** trong production build |
| NGINX | access.log, error.log | File `C:\nginx\logs\` |
| PM2 | stdout/stderr | `pm2 logs production-dashboard-backend` |

**Không có:** ELK, Loki, Application Insights, structured JSON logging, correlation ID.

---

## 16. Kiến trúc triển khai

### 16.1 Môi trường nhà máy (khuyến nghị)

```
Windows Server/PC
├── PostgreSQL (localhost:5432)
├── PM2 → backend/server.js (:3001, bind 0.0.0.0)
├── NGINX (:80)
│   ├── /        → frontend/build (static, SPA fallback)
│   ├── /api/    → proxy 127.0.0.1:3001
│   ├── /ws      → WebSocket upgrade
│   └── /health  → proxy backend health
└── Task Scheduler (optional)
    ├── ProductionDashboard-NGINX @ boot (SYSTEM)
    └── ProductionDashboard-PM2 @ logon (user)
```

### 16.2 Luồng deploy lần đầu

1. Clone repo → `C:\apps\production-dashboard`
2. Cấu hình `backend\.env` (DB, JWT_SECRET)
3. `powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -InstallAutoStart -OpenFirewall`
4. Truy cập `http://<server-ip>/`

### 16.3 Cập nhật sau git pull

```powershell
git pull origin main
powershell -ExecutionPolicy Bypass -File .\scripts\factory-post-pull.ps1
```

### 16.4 Alternative: PM2 serve (không NGINX)

- `VITE_API_BASE_URL` phải là absolute URL tới API
- `pm2 serve frontend/build 4173 --spa`

---

## 17. Kiến trúc Docker

**Hiện trạng:** `docker-compose.yml` khai báo build context nhưng **không có Dockerfile** → Docker **chưa production-ready**.

```yaml
services:
  frontend: build ./frontend, ports 5173:5173
  backend:  build ./backend,  ports 3001:3001
```

**Grafana POC riêng:** `docker-compose.grafana.yml` + `grafana/provisioning/`

**Triển khai thực tế nhà máy:** PM2 + NGINX native Windows — **không dùng Docker**.

---

## 18. Sao lưu & phục hồi

**Không có chiến lược backup tự động trong codebase.**

| Thành phần | Hướng dẫn hiện có | Khuyến nghị |
|------------|-------------------|-------------|
| PostgreSQL | `pg_dump` thủ công (docs/guides) | Scheduled Task hàng ngày |
| NGINX config | `deploy.ps1` backup `nginx.conf.bak` | Git + version control |
| Frontend build | Rebuild từ source | Git tag releases |
| PM2 state | `pm2 save` | ecosystem.config.cjs trong repo |

**Retention DB (gợi ý trong migration):**
- `machine_metrics`: ~30 ngày
- `oee_calculations`: ~180 ngày
- `machine_line_telemetry`: DROP partition cũ (monthly)

**Script partition:** `backend/scripts/ensure-machine-line-telemetry-partitions.mjs`

**RPO/RTO:** Chưa định nghĩa chính thức.

---

## 19. Kiến trúc bảo mật

| Lớp | Biện pháp hiện có | Gap / Rủi ro |
|-----|-------------------|--------------|
| Auth | JWT + bcrypt | Không refresh token; JWT trong localStorage (XSS) |
| Transport | HTTP nội bộ LAN | Không HTTPS/TLS mặc định |
| API write | PATCH machine **public** | Cần network segmentation hoặc API key |
| WebSocket | Không auth | Ai cũng subscribe trên LAN |
| CORS | Configurable | Dev mode permissive |
| Secrets | `.env` gitignored | Password mẫu trong README-deploy |
| Rate limit | NGINX sample comment | Chưa bật mặc định |
| RBAC | Chỉ `/api/users` | Frontend tabs không enforce backend role |
| SQL injection | Parameterized queries | ✅ |
| Production JWT | Fail-fast nếu thiếu secret | ✅ |
| Body size limit | 2mb JSON | ✅ |

---

# Phụ lục A: Chi tiết từng màn hình

> Ứng dụng là React SPA — "trang" = view React + file HTML tĩnh.

---

## A.1 `frontend/index.html` — Shell SPA

| Hạng mục | Chi tiết |
|----------|----------|
| **Mục đích** | Entry HTML mount `#root` cho Vite/React |
| **Tính năng** | Load `main.tsx`, viewport meta |
| **Business logic** | Không — chỉ bootstrap |
| **API** | Không |
| **DB** | Không |
| **Python** | Không |
| **JS/TS** | `frontend/src/main.tsx` |
| **CSS** | `frontend/src/index.css` |
| **Quyền** | Public |
| **Validation** | N/A |
| **Error handling** | Browser default |

---

## A.2 LoginPage

| Hạng mục | Chi tiết |
|----------|----------|
| **File** | `frontend/src/pages/LoginPage.tsx` |
| **Mục đích** | Đăng nhập MES CADIVI |
| **Tính năng** | Form username/password, branding logo, remember me (UI only), forgot password (non-functional) |
| **Business logic** | Gọi `login()` → lưu JWT + user vào localStorage |
| **API** | `POST /api/auth/login` |
| **DB** | `mes_users` |
| **Python** | Không |
| **JS/TS** | `LoginPage.tsx`, `authApi.ts`, `App.tsx` |
| **CSS** | `LoginPage.css` |
| **Quyền** | Public (pre-auth) |
| **Validation** | Client: required fields; server: bcrypt |
| **Error handling** | Hiển thị message lỗi từ API |

---

## A.3 Production Overview

| Hạng mục | Chi tiết |
|----------|----------|
| **File** | `frontend/src/components/tabs/ProductionOverview.tsx` |
| **Mục đích** | Tổng quan nhà máy — KPI, 4 khu vực, lưới máy |
| **Tính năng** | Global KPI bar, area cards sparkline, click máy → Equipment detail |
| **Business logic** | Aggregate KPI theo ca/ngày; map area → machines |
| **API** | `GET /kpis/global`, `/areas`, `/machines` |
| **DB** | `machines`, `production_orders`, `alarms`, `machine_metrics`, `production_length_events` |
| **Python** | Không |
| **JS/TS** | `ProductionOverview.tsx`, `GlobalKPIBar.tsx`, `AreaCard.tsx`, `MachineGrid.tsx`, `useProductionData.ts` |
| **CSS** | Tailwind (`index.css`) |
| **Quyền** | Mọi role đã login |
| **Validation** | Query `period=shift\|day` |
| **Error handling** | `ErrorBoundary` per tab; loading states |

---

## A.4 Quality Control

| Hạng mục | Chi tiết |
|----------|----------|
| **File** | `frontend/src/components/tabs/QualityControl.tsx` |
| **Mục đích** | Dashboard QC (mockup) |
| **Tính năng** | Pass rate, defect charts — **dữ liệu hardcoded** |
| **Business logic** | Chưa tích hợp MES thật |
| **API** | **Không** |
| **DB** | `production_quality` tồn tại schema nhưng UI chưa dùng |
| **Python** | `scripts/update_quality_excel.py` (offline) |
| **JS/TS** | `QualityControl.tsx` |
| **CSS** | Tailwind + Recharts |
| **Quyền** | Mọi role |
| **Validation** | N/A |
| **Error handling** | N/A |

---

## A.5 Equipment Status

| Hạng mục | Chi tiết |
|----------|----------|
| **File** | `frontend/src/components/tabs/EquipmentStatus.tsx` |
| **Mục đích** | Trạng thái thiết bị theo khu vực |
| **Tính năng** | Cards máy, sparkline, OEE toolbar (realtime/shift/day), export HTML report |
| **Business logic** | Merge analytics OEE rollup; shift window calculation |
| **API** | `/machines`, `/orders`, `/analytics`, `/reports/line-processing.html` |
| **DB** | `machines`, `machine_metrics`, `availability_aggregations`, `machine_status_history` |
| **Python** | Không |
| **JS/TS** | `EquipmentStatus.tsx`, `EquipmentOeeToolbar.tsx`, `useMachineTrends.ts`, `equipmentOeeDisplay.ts` |
| **CSS** | Tailwind |
| **Quyền** | JWT cho report export |
| **Validation** | Date/shift params |
| **Error handling** | Toast/error states |

---

## A.6 Equipment Detail (sub-view)

| Hạng mục | Chi tiết |
|----------|----------|
| **File** | `frontend/src/components/tabs/EquipmentDetail.tsx` |
| **Mục đích** | Chi tiết một máy — Gantt trạng thái, speed/energy/temp, orders, bobbin |
| **Tính năng** | Charts, OEE compare, bobbin cut detector, Grafana link, HTML report |
| **Business logic** | Bucket speed history, energy source meter vs power, bobbin sync client-side |
| **API** | `/machines/:id`, `/status-history`, `/speed-history`, `/oee-settled/shift`, `/analytics`, `/bobbin-cuts/sync`, `/reports/line-processing.html` |
| **DB** | `machines`, `machine_status_history`, `machine_metrics`, `energy_consumption`, `production_orders`, `bobbin_cut_records`, `machine_line_telemetry` |
| **Python** | Không |
| **JS/TS** | `EquipmentDetail.tsx`, `useMachineDetailTrends.ts`, `useEquipmentSpeedHistory.ts`, `useBobbinCutRecordsFixed.ts`, `utils/equipment-*` |
| **CSS** | `equipment-speed-panel.css` |
| **Quyền** | JWT cho settled OEE + reports |
| **Validation** | Window max 31 ngày; bucket params |
| **Error handling** | Lazy load Suspense; ErrorBoundary |

---

## A.7 Speed Lab

| Hạng mục | Chi tiết |
|----------|----------|
| **File** | `frontend/src/components/tabs/SpeedLab.tsx` |
| **Mục đích** | Phòng thí nghiệm phân tích tốc độ/OEE |
| **Tính năng** | Query bucket, waterfall six losses, multi-machine, CSV, Grafana link |
| **Business logic** | Coarsen bucket theo range; merge raw + aggregated |
| **API** | `/speed-lab/query`, `/waterfall`, `/query-multi`, `/machines/:id/speed-history` |
| **DB** | `machine_metrics`, `oee_calculations`, `machine_status_history`, `production_length_events` |
| **Python** | Không |
| **JS/TS** | `SpeedLab.tsx`, `components/speed-lab/*`, `useSpeedLabQuery.ts`, `useOeeWaterfallQuery.ts` |
| **CSS** | `speed-lab.css`, `equipment-speed-panel.css` |
| **Quyền** | Public API |
| **Validation** | Range ≤ 31 ngày |
| **Error handling** | Loading/error UI per chart |

---

## A.8 Performance Analytics

| Hạng mục | Chi tiết |
|----------|----------|
| **File** | `frontend/src/components/tabs/PerformanceAnalytics.tsx` |
| **Mục đích** | Analytics cấp nhà máy — OEE trend, six big losses, energy, NG |
| **Tính năng** | Live mode 60s poll, export PDF/PPT, recalculate cache |
| **Business logic** | Đọc `analytics_cache` JSONB payload |
| **API** | `/analytics`, `/analytics/recalculate`, KPIs/orders supporting |
| **DB** | `analytics_cache`, `oee_calculations`, `machine_metrics`, `energy_consumption` |
| **Python** | Không |
| **JS/TS** | `PerformanceAnalytics.tsx`, `exportAnalytics.ts` |
| **CSS** | Tailwind + Recharts |
| **Quyền** | Public read |
| **Validation** | range, area, shiftDate params |
| **Error handling** | Export try/catch |

---

## A.9 Maintenance

| Hạng mục | Chi tiết |
|----------|----------|
| **File** | `frontend/src/components/tabs/Maintenance.tsx` |
| **Mục đích** | Lịch bảo trì (mockup) |
| **Tính năng** | Static work orders — dùng tên máy từ fleet |
| **API** | **Không** |
| **DB** | `maintenance_plans`, `maintenance_requests` — schema only |
| **Python** | Không |
| **JS/TS** | `Maintenance.tsx` |
| **Quyền** | Mọi role |

---

## A.10 Production Schedule

| Hạng mục | Chi tiết |
|----------|----------|
| **File** | `frontend/src/components/tabs/ProductionSchedule.tsx` |
| **Mục đích** | Lịch lệnh sản xuất |
| **Tính năng** | Orders + progress từ API thật |
| **API** | `GET /orders`, machines prop |
| **DB** | `production_orders`, `machines` |
| **JS/TS** | `ProductionSchedule.tsx`, `useProductionOrders` |

**Orphan:** `ProductionScheduleTablet.tsx` — không được import, thiếu hooks.

---

## A.11 Account Management

| Hạng mục | Chi tiết |
|----------|----------|
| **File** | `frontend/src/pages/AccountManagement.tsx` |
| **Mục đích** | Quản trị user MES |
| **Tính năng** | List/create/edit/reset password |
| **API** | `/users` CRUD + reset-password |
| **DB** | `mes_users` |
| **Quyền** | **admin, supervisor** (FE + BE) |

---

## A.12 HTML động: Line Processing Report

| Hạng mục | Chi tiết |
|----------|----------|
| **Endpoint** | `GET /api/reports/line-processing.html` |
| **Mục đích** | Báo cáo HTML xử lý dây chuyền theo ca |
| **Query** | `localDate`, `shift`, `area` hoặc `machineIds` |
| **Service** | `lineProcessingReportService.buildLineProcessingHtmlReport` |
| **DB** | `machine_line_telemetry`, `machine_status_history`, `machine_product_change_events` |
| **Quyền** | JWT required |
| **HTML liên quan** | Equipment Status, Equipment Detail (export button) |

---

## A.13 HTML tĩnh phụ (không phải app chính)

| File | Mục đích |
|------|----------|
| `docs/reference/samples/oee-waterfall-demo.html` | Demo waterfall OEE |
| `scripts/sh04-speed-compare.html` | Output so sánh speed SH-04 |
| `scripts/multi-machine-speed-compare.html` | So sánh multi-machine |

---

# Phụ lục B: Catalog API đầy đủ

## B.1 System / Health

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/` | None | API index + endpoint list |
| GET | `/health` | None | `{ status: "ok", timestamp }` |
| GET | `/health/ready` | None | `{ status: "ready", db: "ok" }` hoặc 503 |

---

## B.2 Auth — `/api/auth`

### POST `/api/auth/login`

| | |
|---|---|
| **Auth** | Public |
| **Request** | `{ "username": "string", "password": "string" }` |
| **Response** | `{ success, data: { token, user: { id, username, role, isActive, plant, area, line, lastLoginAt } } }` |
| **DB** | `mes_users` SELECT + UPDATE last_login |
| **HTML** | LoginPage |
| **Logic** | bcrypt.compare + jwt.sign 24h |

### POST `/api/auth/verify`

| | |
|---|---|
| **Auth** | Public |
| **Request** | `{ "token": "JWT" }` |
| **Response** | `{ success, data: { valid: true, user: payload } }` |
| **DB** | Không |
| **Logic** | jwt.verify |

---

## B.3 Users — `/api/users` (JWT + admin/supervisor)

| Method | Path | Request body | DB |
|--------|------|--------------|-----|
| GET | `/api/users` | — | mes_users SELECT |
| POST | `/api/users` | `{ username, password, role, isActive?, plant?, area?, line? }` | INSERT bcrypt |
| PATCH | `/api/users/:id` | partial fields | UPDATE |
| POST | `/api/users/:id/reset-password` | `{ newPassword }` | UPDATE hash |

**HTML:** AccountManagement

---

## B.4 Presence — `/api/presence` (JWT)

| Method | Path | Body | Response data |
|--------|------|------|---------------|
| POST | `/presence/heartbeat` | `{ sessionId? }` | `{ count, users: [{ userId, username }] }` |
| POST | `/presence/leave` | `{ sessionId? }` | same |
| GET | `/presence/count` | — | same |

**Service:** `userPresenceService`  
**WS event:** `presence:update`

---

## B.5 KPIs — `/api/kpis`

### GET `/api/kpis/global?period=shift|day`

| | |
|---|---|
| **Auth** | Public |
| **Response data** | `{ running, total, output, orders, alarms, energy, outputPeriod, outputWindowStart, outputWindowEnd }` |
| **DB** | machines, orders, alarms, production_length_events |
| **HTML** | ProductionOverview, GlobalKPIBar |
| **Logic** | shiftCalculator.getCurrentShiftWindow |

---

## B.6 Areas — `/api/areas`

### GET `/api/areas` / GET `/api/areas/:areaId?period=shift|day`

| | |
|---|---|
| **Auth** | Public |
| **Areas** | drawing, stranding, armoring, sheathing |
| **Response data** | `{ id, name, running, total, output, speedAvg, alarms, topMachines, allMachines, sparklineData }` |
| **DB** | machines, metrics, alarms, length events |
| **HTML** | ProductionOverview |

---

## B.7 Machines — `/api/machines`

| Method | Path | Auth | DB / Service | HTML |
|--------|------|------|--------------|------|
| GET | `/machines?area=` | Public | machines, alarms | Dashboard, Production, Equipment |
| GET | `/machines/:id` | Public | machines + OEE + bobbin | EquipmentDetail |
| GET | `/:id/status-history` | Public | machine_status_history | EquipmentDetail Gantt |
| GET | `/:id/speed-history` | Public | oeeSpeedHistoryService | EquipmentDetail, SpeedLab |
| PATCH | `/:id` | **Public** | machines + side effects + WS | Node-RED, UI |
| PUT | `/name/:name` | **JWT** | same as PATCH | Node-RED flow chính |
| POST | `/:id/metrics` | Public | machine_metrics | PLC |
| POST | `/:id/alarms` | Public | alarms | PLC |
| GET | `/:id/orders` | Public | production_orders | EquipmentDetail |

**PATCH body (camelCase):** `status`, `lineSpeed`, `targetSpeed`, `producedLength`, `producedLengthOk`, `producedLengthNg`, `materialCode`, `productName`, `energyMeterKwh`, `multiZoneTemperatures`, `current`, `power`, `temperature`, ...

**Side effects PATCH:** productionLength delta → `production_length_events`, OEE recalc, availability aggregator, telemetry insert, WS `machine:update`

**status-history query:** `hours` (default 8) OR `start` + `end` (max 31 days)  
**speed-history query:** `start`, `end` (required), `bucketSec?`, `limit?`

---

## B.8 Orders — `/api/orders`

| Method | Path | Auth | Body | DB |
|--------|------|------|------|-----|
| GET | `/orders` | Public | — | production_orders |
| GET | `/orders/:orderId` | Public | — | production_orders |
| PATCH | `/orders/:orderId` | Public | productName, machineId, producedLength, status, ... | UPDATE + telemetry sync |

**HTML:** ProductionSchedule, EquipmentDetail

---

## B.9 Alarms — `/api/alarms`

| Method | Path | Query/Body | DB |
|--------|------|------------|-----|
| GET | `/alarms` | `machineId?`, `acknowledged?` | alarms SELECT |
| PATCH | `/alarms/:alarmId` | `{ acknowledged?: boolean }` | alarms UPDATE |

---

## B.10 Availability — `/api/availability`

| Method | Path | Auth | Body/Service |
|--------|------|------|--------------|
| GET | `/sync/status` | Public | availabilitySync.getSyncStatus |
| POST | `/sync/all` | JWT | `{ windowMinutes?, retryFailed? }` |
| POST | `/sync/area/:area` | JWT | `{ windowMinutes? }` |
| GET | `/machine/:machineId` | Public | get_latest_availability() |

---

## B.11 Analytics — `/api/analytics`

| Method | Path | Query/Body | Service |
|--------|------|------------|---------|
| GET | `/analytics` | range, area, machineId, shiftDate, shiftNumber, force | getAnalyticsWithCache |
| POST | `/recalculate` | same params | computeAndCacheAnalytics |

**Response:** `{ success, data: <large payload>, cached, timestamp }`  
**Payload includes:** oeeSummary, sixBigLosses, pareto, oeeTrend, energyTrend, ngTrend, insights, ...

**HTML:** PerformanceAnalytics, EquipmentStatus (OEE rollup)

---

## B.12 OEE Settled — `/api/oee-settled` (JWT)

| Method | Path | Query/Body | Service |
|--------|------|------------|---------|
| GET | `/shift` | shiftDate, shiftNumber | listShiftSettlements |
| POST | `/shift` | `{ shiftDate, shiftNumber, area? }` | settleCompletedShift (409 if shift not ended) |

**DB:** `oee_shift_settlements`

---

## B.13 Reports — `/api/reports` (JWT)

| Method | Path | Query | Output |
|--------|------|-------|--------|
| GET | `/factory-telemetry` | from, to, granularity, format=json\|csv, machineId? | JSON/CSV |
| GET | `/line-processing.html` | localDate, shift, area XOR machineIds | HTML |

**DB:** `machine_line_telemetry`, status history, product change events

---

## B.14 Bobbin Cuts — `/api/bobbin-cuts`

| Method | Path | Body | Service |
|--------|------|------|---------|
| POST | `/sync` | array of cuts or `{ cuts: [...] }` | insertBobbinCuts |
| GET | `/machines/:machineId` | orderId?, from?, to?, limit? | getBobbinCutsByMachine |

**DB:** `bobbin_cut_records`

---

## B.15 Speed Lab — `/api/speed-lab`

| Method | Path | Params | Service |
|--------|------|--------|---------|
| GET | `/query` | machineId, start, end, bucketSec?, includeRaw?, rawLimit? | querySpeedLab |
| GET | `/query-multi` | start, end, bucketSec?, machineIds? | querySpeedLabMulti |
| GET | `/waterfall` | machineId, start, end | queryOeeWaterfall |
| GET | `/machines` | — | SQL machine list |

**Max range:** 31 ngày  
**HTML:** SpeedLab, EquipmentDetail

---

## B.16 WebSocket — `/ws`

| Aspect | Detail |
|--------|--------|
| Auth | None |
| Heartbeat | Server ping every 30s (configurable) |
| Client → Server | No handlers (receive-only) |
| Events | `connected`, `machine:update`, `presence:update` |

---

# Phụ lục C: Inventory bảng Database

| Bảng | Mục đích | Quan hệ | Used By | CRUD |
|------|----------|---------|---------|------|
| **machines** | Snapshot realtime máy | Hub 15+ FK | Mọi module | R: all; U: PATCH/PUT |
| **production_orders** | Lệnh sản xuất | → machines | orders, machines, OEE | Full via API |
| **material_master** | Master vật liệu | soft → machines.material_code | machines route, reports | R only |
| **machine_metrics** | Time-series metrics | → machines | speed history, analytics | R + Create (PLC) |
| **machine_line_telemetry** | Telemetry 5s partitioned | → machines | sampler, reports, speed | R + Insert |
| **machine_status_history** | Gantt segments | → machines | OEE, speed lab | R (trigger write) |
| **availability_aggregations** | Availability ca/window | → machines, orders | sync, analytics | R (function upsert) |
| **oee_calculations** | OEE snapshots | → machines, orders | calculator, speed lab | R + Insert |
| **oee_calculations_hourly** | Rollup warm tier | → machines | script only | W script |
| **oee_shift_settlements** | OEE ca chốt | → machines | settlement API | R + Insert |
| **production_length_events** | Delta chiều dài | → machines | length service, waterfall | R + Insert |
| **production_quality** | QC theo order | → machines, orders | oeeCalculator read | **R only (no writes)** |
| **energy_consumption** | Hourly kWh | → machines | equipment charts | R + Upsert |
| **machine_energy_samples** | 5s legacy | → machines | **Unused** | — |
| **alarms** | Cảnh báo | → machines | alarms API, KPIs | Full |
| **bobbin_cut_records** | Cắt cuộn QC | → machines | bobbin service | R + Insert |
| **machine_product_change_events** | Audit đổi SP | → machines | reports | R (trigger) |
| **analytics_cache** | Cache JSONB analytics | soft refs | analytics service | R + Upsert |
| **mes_users** | Tài khoản | standalone | auth, users | Full |
| **maintenance_plans** | PM/CM plans | → machines | **Schema only** | — |
| **maintenance_requests** | Yêu cầu bảo trì | → machines | **Schema only** | — |

---

# Phụ lục D: Nợ kỹ thuật, trùng lặp và file không dùng

## D.1 Trùng lặp

| Loại | Chi tiết |
|------|----------|
| **Database SQL** | `database/queries/` mirror toàn bộ `backend/database/` |
| **Tài liệu** | ENV guides overlap; API docs overlap; deploy guides overlap |
| **Project structure rule** | `.cursor/rules` nói `src/` ở root; thực tế `frontend/src/` |
| **Deploy nginx** | `deploy/nginx.conf` vs `infrastructure/nginx/app.conf` |
| **Node-RED flows** | 3 file JSON tương tự |

## D.2 CSS / JS / Component không dùng

| File | Trạng thái |
|------|------------|
| `frontend/src/styles/globals.css` | Không import |
| `GrafanaEmbeddedView.tsx` | Không được dùng (external link thay thế) |
| `ProductionScheduleTablet.tsx` | Orphan — hooks missing |
| `mockApi.ts` | Chỉ khi `VITE_USE_MOCK_DATA=true` |
| `subscribeToGlobalUpdates` | No-op trên real API |

## D.3 Schema chưa wired

| Object | Trạng thái |
|--------|------------|
| `maintenance_plans`, `maintenance_requests` | Migration có, UI/API không |
| `production_quality` | Không có writer |
| `machine_energy_samples` | Thay bằng `machine_line_telemetry` |
| Quality & Maintenance tabs | Mock data trong production |

## D.4 Technical debt

| Mức | Vấn đề |
|-----|--------|
| **Cao** | API ghi không auth — rủi ro LAN |
| **Cao** | Không HTTPS, JWT trong localStorage |
| **Cao** | Không backup DB tự động |
| **Trung bình** | Không React Router — không deep link tab/máy |
| **Trung bình** | Không tầng repository — SQL rải rác routes |
| **Trung bình** | Docker incomplete (thiếu Dockerfile) |
| **Trung bình** | WebSocket không auth |
| **Thấp** | Mock tabs (Quality, Maintenance) trong prod |
| **Thấp** | 75+ docs khó maintain |

## D.5 Architecture weaknesses

1. **Single point:** một PostgreSQL + một Node process — chưa HA
2. **Polling-heavy:** 20 users × 1–2s có thể spike DB (đã có index 2026-07 mitigation)
3. **No observability stack** — chỉ console + nginx logs
4. **Role model yếu** — 4 role nhưng hầu hết API không enforce
5. **Partition maintenance** — `machine_line_telemetry` cần script tạo partition hàng tháng

---

## Tóm tắt điều hành

Production Overview Dashboard là **MES dashboard đang vận hành thực tế** với stack React + Express + PostgreSQL, tích hợp PLC qua Node-RED, triển khai Windows PM2+NGINX.

**Core production path** (Production, Equipment, Speed Lab, Analytics, Schedule) **đã nối API/DB đầy đủ**.

**Quality, Maintenance** và một số bảng DB **chưa hoàn thiện**.

Bảo mật phụ thuộc **segmentation mạng nội bộ** hơn là defense-in-depth ở API layer.

---

## Bước tiếp theo (chờ duyệt)

Sau khi duyệt bản này, có thể mở rộng:

1. Catalog API — request/response JSON schema chi tiết từng endpoint
2. Inventory từng component `.tsx` với dependency graph
3. ER diagram đầy đủ từng cột từ `schema.sql`
4. OpenAPI 3.0 spec
5. Audit bảo mật chi tiết theo OWASP
6. Runbook vận hành (backup, partition, incident)

---

*Tài liệu được tạo tự động từ phân tích codebase — không sửa đổi mã nguồn.*
