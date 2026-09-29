# MES Production Overview Dashboard — Tech Stack, Export Tools & Claude Code Deploy Prompt

> **Mục đích**: File tổng hợp để copy gửi Claude Code thiết kế cấu trúc deploy Production Linux.  
> **Dự án**: Production Overview Dashboard (CADIVI MES)  
> **Cập nhật**: 2026-09-02  
> **Tham chiếu nội bộ**: `docs/learning/SKILL_BATTLEMAP.md`, `docs/learning/SENIOR_DEVOPS_ROADMAP.md`, `README-deploy.md`

---

## Mục lục

1. [Bảng công nghệ & phiên bản (hiện tại vs mục tiêu)](#1-bảng-công-nghệ--phiên-bản-hiện-tại-vs-mục-tiêu)
2. [Công cụ xuất (Export) — App & DevOps](#2-công-cụ-xuất-export--app--devops)
3. [CI/CD — Frontend & Backend](#3-cicd--frontend--backend)
4. [Kiến trúc deploy mục tiêu (tóm tắt)](#4-kiến-trúc-deploy-mục-tiêu-tóm-tắt)
5. [Prompt gửi Claude Code (copy toàn bộ §5)](#5-prompt-gửi-claude-code-copy-toàn-bộ-5)

---

## 1. Bảng công nghệ & phiên bản (hiện tại vs mục tiêu)

### 1.1 Tổng quan stack

| Tầng | Công nghệ | Phiên bản hiện tại (repo) | Phiên bản mục tiêu Production Linux | Ghi chú |
|------|-----------|---------------------------|-------------------------------------|---------|
| **OS App Server** | Ubuntu Server LTS | Windows 10/11/Server (deploy hiện tại) | **Ubuntu 24.04 LTS** | Hybrid: OT gateway vẫn Windows |
| **OS OT Gateway** | Windows | Windows | **Windows 10/11/Server** | Node-RED + S7-1500 / OPC UA |
| **Runtime** | Node.js | **≥ 18** (docs yêu cầu) | **22 LTS** (Docker base) | ES modules (`"type": "module"`) |
| **Package manager** | npm | npm ci / npm install | npm ci (CI/CD) | Lockfile: package-lock.json |

### 1.2 Frontend

| Thành phần | Công nghệ | Phiên bản (package.json) | Vai trò |
|------------|-----------|--------------------------|---------|
| **Framework** | React | **^18.3.1** | SPA dashboard MES |
| **DOM** | react-dom | **^18.3.1** | Render UI |
| **Build tool** | Vite | **6.3.5** | Dev server + production build |
| **Compiler plugin** | @vitejs/plugin-react-swc | **^3.10.2** | Fast refresh, SWC transform |
| **Language** | TypeScript / TSX | implicit (vite resolve .ts/.tsx) | FE source chính |
| **UI primitives** | Radix UI (@radix-ui/react-*) | **^1.x – ^2.x** | Accessible components |
| **Styling** | Tailwind CSS | **v4.1.3** (bundled in index.css) | Utility-first CSS |
| **Class merge** | tailwind-merge, clsx, cva | * / ^0.7.1 | Component styling |
| **Charts** | Chart.js + react-chartjs-2 | **^4.4.1** / **^5.3.1** | Sparkline, trend charts |
| **Charts (alt)** | Recharts | **^2.15.2** | Một số panel analytics |
| **Date** | date-fns, chartjs-adapter-date-fns | **^4.4.0** / **^3.0.0** | Time axis |
| **Forms** | react-hook-form | **^7.55.0** | Form validation |
| **Icons** | lucide-react | **^0.487.0** | Icon set |
| **Themes** | next-themes | **^0.4.6** | Dark/light mode |
| **Toast** | sonner | **^2.0.3** | Notifications |
| **Build output** | Vite `build/` | — | Static assets → NGINX root |
| **Dev port** | Vite dev | **5173** | Local development |
| **Preview port** | vite preview | **4173** | PM2 preview mode |
| **Env prefix** | VITE_* | — | Embedded at build time |

**Frontend env quan trọng** (`frontend/.env.production.example`):

| Biến | Mục đích | Giá trị mẫu |
|------|----------|-------------|
| `VITE_API_BASE_URL` | API endpoint browser | `/api` (same-origin NGINX) hoặc absolute URL |
| `VITE_USE_MOCK_DATA` | Mock vs live | `false` |
| `VITE_REALTIME_ENABLED` | WebSocket | `true` |
| `VITE_GRAFANA_URL` | Embed Grafana | `http://host:3002` |
| `VITE_POLL_MS_MACHINES` | Poll interval | `2000` (2s, ~100 lines) |
| `VITE_POLL_MS_MACHINE_DETAIL` | Detail poll | `5000` |

### 1.3 Backend

| Thành phần | Công nghệ | Phiên bản (package.json) | Vai trò |
|------------|-----------|--------------------------|---------|
| **Framework** | Express | **^4.18.2** | REST API |
| **Runtime** | Node.js | **≥ 18** | server.js entry |
| **Database driver** | pg (node-postgres) | **^8.11.3** | PostgreSQL connection pool |
| **Auth** | jsonwebtoken | **^9.0.2** | JWT Bearer |
| **Password hash** | bcryptjs | **^2.4.3** | User credentials |
| **CORS** | cors | **^2.8.5** | Cross-origin (dev/file://) |
| **Config** | dotenv | **^16.3.1** | backend/.env |
| **WebSocket** | ws | **^8.14.2** | Realtime `/ws` |
| **Excel import** | read-excel-file | **^5.8.6** | Data import scripts |
| **API port** | PORT | **3001** (default) | Express listen |
| **Health** | /health, /health/ready | built-in | Liveness + DB readiness |

**Backend env quan trọng** (`backend/.env.example`):

| Biến | Mục đích |
|------|----------|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Auth (24h hiện tại → 15m target Phase 2) |
| `NODE_ENV` | production |
| `PORT` | 3001 |
| `AVAILABILITY_SYNC_INTERVAL` | 60s |
| `ANALYTICS_REFRESH_INTERVAL` | 60s |

### 1.4 Database

| Thành phần | Công nghệ | Phiên bản | Ghi chú |
|------------|-----------|-----------|---------|
| **RDBMS** | PostgreSQL | **15+** (hiện tại) → **16 hoặc 18** (mục tiêu Linux prod) | DB: `production_dashboard` |
| **Port** | PostgreSQL | **5432** | Default |
| **Cache table** | analytics_cache | SQL migration có sẵn | L3 cache (precomputed) |
| **Connection pool** | pg Pool | max configurable (`DB_POOL_MAX`) | Target: PgBouncer optional |
| **Migrations** | SQL files | `backend/database/`, `database/` | Manual + node scripts |

### 1.5 Reverse proxy & process management

| Thành phần | Hiện tại (Windows) | Mục tiêu Linux Production |
|------------|-------------------|---------------------------|
| **Reverse proxy** | NGINX for Windows | **NGINX 1.24+** (stable) |
| **Static serve** | frontend/build | NGINX root + immutable cache |
| **API proxy** | /api/* → :3001 | upstream × N replicas |
| **WebSocket** | /ws → :3001 | ip_hash hoặc Redis pub/sub |
| **Rate limit** | limit_req 10r/s | NGINX zone (có mẫu deploy/nginx.conf) |
| **TLS** | HTTP (LAN) | Internal CA hoặc Let's Encrypt |
| **Process manager** | PM2 | **Docker Compose** hoặc **systemd** |
| **Security headers** | CSP, HSTS-ready | deploy/nginx.conf mẫu |

### 1.6 OT / Industrial

| Thành phần | Công nghệ | Ghi chú |
|------------|-----------|---------|
| **PLC** | Siemens S7-1500 | Shopfloor tags |
| **Protocol** | OPC UA | Via KEPServer hoặc tương đương |
| **Gateway** | Node-RED | Windows, port ~1880 |
| **Ingestion API** | PUT /api/machines/name/:machineName | Target: API Key + Idempotency-Key |
| **Poll interval PLC** | ~1–5s | 100 lines peak |

### 1.7 Observability & Analytics (hiện có + mục tiêu)

| Thành phần | Phiên bản hiện tại | Mục tiêu Production |
|------------|-------------------|---------------------|
| **Grafana** | **11.4.0** (docker-compose.grafana.yml) | Giữ 11.x, on-prem Docker |
| **Grafana plugins** | grafana-clock-panel | POC dashboards |
| **Prometheus** | Chưa có | **2.x** — scrape /metrics |
| **Logs** | console.log | **pino** JSON → journalctl → Loki |
| **Alerting** | Chưa có | Prometheus rules → Slack/email |

### 1.8 Caching & Queue (mục tiêu — chưa implement)

| Thành phần | Công nghệ mục tiêu | Phiên bản đề xuất |
|------------|-------------------|-------------------|
| **L2 Cache** | Redis | **7.2+** |
| **Message Queue** | BullMQ | **5.x** (Redis-backed) |
| **Pattern** | Cache-aside + invalidation | TTL 2–300s per endpoint |

### 1.9 Container & orchestration (mục tiêu)

| Thành phần | Hiện tại | Mục tiêu |
|------------|----------|----------|
| **Docker Compose** | dev-only (FE+BE) | **docker-compose.prod.yml** full stack |
| **Docker base image** | node:22-alpine (Grafana render) | node:22-alpine cho BE/Worker |
| **Kubernetes** | Không | Không cần Phase 1–4 |

### 1.10 CI/CD (mục tiêu — chưa có pipeline)

| Thành phần | Đề xuất |
|------------|---------|
| **Platform** | GitLab CI hoặc GitHub Actions |
| **Node version CI** | 22.x |
| **FE build** | `npm ci && npm run build` → artifact `frontend/build/` |
| **BE build** | Docker image `mes-backend:<tag>` |
| **Registry** | GitLab Container Registry hoặc GHCR |
| **Deploy** | SSH + docker compose pull/up |
| **Secrets** | CI variables, không commit .env |

---

## 2. Công cụ xuất (Export) — App & DevOps

### 2.1 Export trong ứng dụng (Frontend — đã có)

| Thư viện | Phiên bản | Chức năng export | Màn hình / use case |
|----------|-----------|-------------------|---------------------|
| **exceljs** | ^4.4.0 | Export `.xlsx` | Speed Lab, analytics tables |
| **file-saver** | ^2.0.5 | Download file browser | CSV/XLSX trigger |
| **jspdf** | ^4.0.0 | Export PDF | Report snapshots |
| **html2canvas-pro** | ^1.6.4 | Capture DOM → image | Chart/screenshot export |
| **pptxgenjs** | ^3.12.0 | Export PowerPoint | Executive brief slides |
| **Utils** | `exportAnalytics.ts`, `speed-lab-csv.ts` | CSV/format helpers | Speed Lab downtime |

**Yêu cầu deploy**: NGINX `client_max_body_size` đủ cho upload; CSP cho phép blob download (`connect-src 'self'`, blob URLs nếu cần).

### 2.2 Export artifacts DevOps (cần thiết kế trong infrastructure/)

| Công cụ / Script | Output | Khi nào chạy | Ghi chú |
|------------------|--------|--------------|---------|
| **`scripts/export-openapi.mjs`** | `docs/api/openapi.yaml` | CI stage hoặc manual | Contract cho OT + FE |
| **`scripts/export-grafana-dashboards.sh`** | JSON backup `grafana/dashboards/` | Pre-deploy, weekly cron | Version control dashboards |
| **`infrastructure/scripts/backup-postgres.sh`** | `backups/pg_YYYYMMDD_HHMM.dump` | Daily cron 02:00 | `pg_dump -Fc` |
| **`infrastructure/scripts/export-env-template.sh`** | `.env.production.example` diff check | CI | Fail nếu thiếu key mới |
| **`infrastructure/scripts/export-metrics-snapshot.sh`** | Prometheus TSDB snapshot hoặc curl /metrics | Incident | Capacity planning |
| **`infrastructure/scripts/export-logs.sh`** | JSON logs last N hours | Debug | `journalctl` hoặc `docker logs` |
| **CI artifact: `frontend-build.tar.gz`** | Static FE bundle | Mỗi pipeline success | Deploy không cần rebuild trên server |
| **CI artifact: `mes-backend-<sha>.tar`** | Docker image export | Release tag | Air-gapped factory |
| **`node backend/scripts/export-machines-data.js`** | JS/JSON machine snapshot | Migration, backup | Đã có trong repo |
| **Grafana UI → Share → Export** | Dashboard JSON | Manual | Bổ sung cho provisioning |
| **DB migration export** | `pg_dump --schema-only` | Major release | Schema drift check |

### 2.3 Export dữ liệu vận hành (MES-specific)

| Loại data | Phương thức | Retention đề xuất |
|-----------|-------------|-------------------|
| OEE calculations | SQL export / MV refresh | 7d raw, 90d hourly (xem RETENTION_PLAN) |
| Machine telemetry | Partitioned tables export | Theo policy nhà máy |
| Analytics cache | Không export — rebuild | TTL trong PG |
| Audit / ingestion log | pino JSON export | 90 ngày |
| Grafana snapshots | PNG/PDF từ UI | Ad-hoc reports |

### 2.4 Công cụ xuất Claude Code phải thiết kế

Khi thiết kế infrastructure, **bắt buộc include**:

1. **`infrastructure/scripts/backup-postgres.sh`** — idempotent, rotate 7 daily + 4 weekly
2. **`infrastructure/scripts/export-release-bundle.sh`** — FE build + docker images + compose + env example (offline deploy)
3. **`infrastructure/scripts/restore-postgres.sh`** — paired với backup
4. **CI job `export-artifacts`** — upload FE build + SBOM (optional `npm sbom`)
5. **Runbook section "Export for audit"** — ai export gì, khi nào, lưu ở đâu
6. **OpenAPI export hook** — document all `/api/*` for Node-RED contract

---

## 3. CI/CD — Frontend & Backend

### 3.1 Pipeline stages (đề xuất)

```
┌─────────┐   ┌─────────┐   ┌──────────────┐   ┌─────────┐   ┌─────────────┐   ┌──────────┐
│  lint   │ → │  test   │ → │ build-artifacts│ → │  scan   │ → │deploy-staging│ → │deploy-prod│
└─────────┘   └─────────┘   └──────────────┘   └─────────┘   └─────────────┘   └──────────┘
                                    │                              │                  │
                                    ▼                              ▼                  ▼
                          FE: frontend/build/              smoke test           manual gate
                          BE: docker image                 /health/ready         rollback tag
                          export-artifacts.tar.gz
```

### 3.2 CI/CD Frontend

| Stage | Command / Action | Artifact |
|-------|------------------|----------|
| **Install** | `cd frontend && npm ci` | node_modules (cache) |
| **Lint** | ESLint (nếu thêm) / `tsc --noEmit` (optional) | — |
| **Build** | `npm run build` với `VITE_API_BASE_URL=/api` | `frontend/build/` |
| **Test** | Vitest/Playwright (khi có) | JUnit report |
| **Export** | `tar czf frontend-build-$CI_COMMIT_SHA.tar.gz frontend/build` | CI artifact |
| **Deploy** | SCP/rsync → `/srv/mes/frontend/build` hoặc Docker nginx volume | Immutable assets |

**FE build env inject (CI variables)**:

```yaml
# GitLab CI example variables
VITE_API_BASE_URL: "/api"
VITE_USE_MOCK_DATA: "false"
VITE_REALTIME_ENABLED: "true"
VITE_POLL_MS_MACHINES: "2000"
```

### 3.3 CI/CD Backend

| Stage | Command / Action | Artifact |
|-------|------------------|----------|
| **Install** | `cd backend && npm ci` | — |
| **Test** | API integration tests (khi có) | — |
| **Build image** | `docker build -t mes-backend:$CI_COMMIT_SHA ./backend` | Container image |
| **Push** | Push to registry | `:latest`, `:$SHA`, `:$TAG` |
| **Migrate** | `node scripts/setup-database.js` hoặc flyway (manual gate prod) | — |
| **Deploy** | `docker compose pull && docker compose up -d --no-deps backend worker` | Rolling |
| **Smoke** | `curl -f https://mes/api/../health/ready` | — |

### 3.4 CI/CD Infrastructure config

| Path | CI action |
|------|-----------|
| `infrastructure/nginx/` | Syntax test: `nginx -t` |
| `infrastructure/compose/docker-compose.prod.yml` | `docker compose config` validate |
| `infrastructure/prometheus/` | promtool check rules |
| `.env.production.example` | Diff check vs documented keys |

### 3.5 Rollback strategy

| Component | Rollback method |
|-----------|-----------------|
| FE | Restore previous `frontend-build-<sha>.tar.gz` |
| BE | `docker compose up -d backend:<previous-sha>` |
| DB | `restore-postgres.sh` từ pre-deploy backup |
| NGINX | Git revert config + `nginx -s reload` |

---

## 4. Kiến trúc deploy mục tiêu (tóm tắt)

```
S7-1500 → Node-RED (Windows) ──[X-MES-Ingest-Key + Idempotency-Key]──┐
                                                                      ↓
React SPA ← NGINX (TLS, LB, static cache) ← Express × N ← Redis (cache + BullMQ)
                                              ↓                    ↓
                                         PostgreSQL 16/18      BullMQ workers
                                              ↓
                                   Prometheus → Grafana 11.x
                                              ↓
                                   pino logs → journalctl
```

**Quyết định đã chốt** (không đổi trừ ADR mới):

- BullMQ + Redis (không RabbitMQ)
- Hybrid Linux app + Windows OT
- API key cho ingestion, JWT cho human users
- NGINX static cache thay CDN
- Không K8s giai đoạn đầu

---

## 5. Prompt gửi Claude Code (copy toàn bộ §5)

> **Hướng dẫn**: Copy từ dòng `# Yêu cầu:` đến hết section này, paste vào Claude Code trong repo này.  
> Thêm cuối prompt: `"Hãy đọc docs/learning/SKILL_BATTLEMAP.md và docs/guides/CLAUDE_PRODUCTION_DEPLOY_PROMPT.md trước khi trả lời."`

---

# Yêu cầu: Thiết kế cấu trúc Deploy Production chuẩn cho MES Production Overview Dashboard

## Vai trò của bạn
Bạn là **Senior DevOps / Platform Architect**. Nhiệm vụ: thiết kế **cấu trúc thư mục, file cấu hình, công cụ xuất (export), và blueprint triển khai** cho hệ thống MES này trên **Linux Production** — không over-engineer, có lộ trình phase rõ ràng, triển khai thực tế trong nhà máy (factory LAN, ~100 lines, ~20 concurrent users).

**Output mong muốn**: tài liệu kiến trúc + cây thư mục + file mẫu (Dockerfile, docker-compose, NGINX, CI/CD, env, runbook, **export scripts**) — chưa cần implement toàn bộ code backend, nhưng phải chỉ rõ hook/integration point vào codebase hiện có.

---

## A. Tech stack & versions (baseline — dùng đúng số version này)

### Runtime & languages
- **Node.js**: ≥18 hiện tại → **22 LTS** production (Docker)
- **npm**: ci trong CI/CD

### Frontend
- **React 18.3.1** + **react-dom 18.3.1**
- **Vite 6.3.5** + @vitejs/plugin-react-swc 3.10.2
- **TypeScript/TSX**, **Tailwind CSS 4.1.3**, **Radix UI**
- **Chart.js 4.4.1**, **Recharts 2.15.2**
- Build output: `frontend/build/` (KHÔNG phải dist/)
- Env: `VITE_*` only; poll 2s machines, 5s detail

### Backend
- **Express 4.18.2**, **pg 8.11.3**, **ws 8.14.2**
- **JWT** (jsonwebtoken 9.0.2), **bcryptjs 2.4.3**
- Port **3001**, health: `/health`, `/health/ready`
- WebSocket: `/ws`

### Database
- **PostgreSQL 16 hoặc 18** (target Linux prod), DB `production_dashboard`
- L3 cache: `analytics_cache` table (đã có migration)

### Infrastructure target
- **NGINX 1.24+** — reverse proxy, LB, static cache, rate limit, security headers
- **Redis 7.2+** — L2 cache-aside
- **BullMQ 5.x** — async jobs (analytics-recalc, oee-shift-settle)
- **Prometheus 2.x** + **Grafana 11.4.0** (POC có sẵn)
- **pino** — structured JSON logs
- **Docker Compose** prod (không K8s phase 1–4)

### OT (giữ nguyên Windows)
- **Node-RED** + **S7-1500** / OPC UA
- Ingestion: `PUT /api/machines/name/:machineName`
- Target auth: **X-MES-Ingest-Key** + **Idempotency-Key**

### App export libraries (đã có — deploy phải support)
- exceljs 4.4.0, jspdf 4.0.0, pptxgenjs 3.12.0, file-saver 2.0.5, html2canvas-pro 1.6.4

---

## B. Bối cảnh dự án

### Stack data flow
```
S7-1500 → Node-RED (Windows) → REST API Express :3001 → PostgreSQL → WebSocket /ws → React SPA
```

### Cấu trúc repo
```
/
├── frontend/          # React + Vite → frontend/build/
├── backend/           # Express, server.js, src/app.js
├── database/          # migrations, queries
├── docs/              # SKILL_BATTLEMAP, SENIOR_DEVOPS_ROADMAP, guides
├── deploy/nginx.conf  # NGINX mẫu (security headers, rate limit)
├── docker-compose.yml # dev-only
├── docker-compose.grafana.yml  # Grafana 11.4.0 POC
└── README-deploy.md   # Windows NGINX + PM2 (migrate sang Linux)
```

### API hot paths
- `GET /api/kpis/global` — poll 1–2s
- `GET /api/machines` — ~100 lines
- `GET /api/alarms`, `GET /api/analytics?range=…`
- `PUT /api/machines/name/:machineName` — OT ingestion
- `POST /api/auth/login` — JWT

---

## C. Quyết định kiến trúc đã chốt

1. **Hybrid**: MES app **Linux**; OT **Windows**
2. **Queue**: **BullMQ + Redis** (không RabbitMQ)
3. **OT auth**: API key + Idempotency-Key (không JWT user cho ingestion)
4. **Human auth**: JWT access 15m + refresh httpOnly (Phase 2)
5. **CDN**: NGINX static cache LAN (không Cloudflare)
6. **Logs**: pino → journalctl → Loki (sau)
7. **Nguyên tắc**: measure baseline → 1 skill/sprint → benchmark

---

## D. Công nghệ BẮT BUỘC cover

### D.1 Multi-layer caching (L0–L3)
- L0: browser poll (VITE_POLL_MS_*)
- L1: in-memory Node Map (1–5s)
- L2: Redis cache-aside (2–300s) — `/api/kpis/global`, analytics
- L3: PostgreSQL analytics_cache
- Invalidation on machine update

### D.2 Message Queue — BullMQ
Queues: `analytics-recalc`, `oee-shift-settle`, `ingestion-buffer` (Phase 5)
- Worker process tách khỏi HTTP
- Retry + dead-letter + idempotent handlers

### D.3 Load Balancing — NGINX
- upstream least_conn × N backend
- Health: `/health/ready`
- WebSocket: ip_hash vs Redis pub/sub — bảng trade-off + recommendation

### D.4 Idempotency
- Header `Idempotency-Key` on PUT ingestion
- Table `ingestion_dedup` + 24h TTL cleanup
- Phân biệt idempotency vs upsert ON CONFLICT

### D.5 CI/CD (FE + BE riêng)
**Frontend pipeline**: lint → build (VITE_* inject) → artifact `frontend-build.tar.gz` → deploy static
**Backend pipeline**: test → docker build → push registry → compose up → smoke /health/ready
Include: rollback, manual prod gate, secrets via CI variables

### D.6 Cybersecurity
TLS, security headers (CSP from deploy/nginx.conf), rate limit, JWT hardening, API key rotation, network segmentation OT→IT, PG least privilege, backup/restore, OWASP Express checklist

### D.7 NGINX Linux Production
Static immutable cache, gzip, proxy /api /ws /health, upstream LB

### D.8 Observability
Prometheus /metrics, Grafana dashboards, pino logs, alert rules

### D.9 Export tools (BẮT BUỘC thiết kế scripts)
1. `backup-postgres.sh` — daily pg_dump, rotate
2. `restore-postgres.sh`
3. `export-release-bundle.sh` — offline deploy package (FE + images + compose + env example)
4. `export-grafana-dashboards.sh`
5. `export-logs.sh` — incident debug
6. `export-openapi.mjs` — API contract for Node-RED
7. CI job `export-artifacts`
8. Runbook "Export for audit"

---

## E. Deliverables

### E.1 Folder structure `infrastructure/`
```
infrastructure/
├── docker/
│   ├── backend/Dockerfile
│   ├── frontend/Dockerfile
│   └── worker/Dockerfile
├── compose/
│   ├── docker-compose.prod.yml
│   ├── docker-compose.staging.yml
│   └── docker-compose.dev.yml
├── nginx/
│   ├── nginx.conf
│   ├── conf.d/mes-app.conf
│   └── snippets/security-headers.conf
├── redis/redis.conf
├── prometheus/prometheus.yml + alerts/
├── ci/.gitlab-ci.yml (hoặc .github/workflows/)
├── scripts/
│   ├── deploy.sh
│   ├── rollback.sh
│   ├── backup-postgres.sh
│   ├── restore-postgres.sh
│   ├── export-release-bundle.sh
│   ├── export-grafana-dashboards.sh
│   ├── export-logs.sh
│   └── health-check.sh
├── env/.env.production.example
└── docs/
    ├── LINUX_DEPLOY.md
    ├── RUNBOOK-incident.md
    ├── RUNBOOK-backup-restore.md
    ├── RUNBOOK-export-audit.md
    ├── SECURITY_CHECKLIST.md
    └── ADR/001-*.md, 002-*.md, ...
```

### E.2 File mẫu (nội dung thật)
- docker-compose.prod.yml (backend×2, redis, postgres:16/18, nginx, prometheus, grafana, worker)
- Dockerfiles (multi-stage, non-root)
- NGINX conf (LB + static + WS)
- .gitlab-ci.yml với stages FE + BE + export-artifacts
- .env.production.example (all keys)
- SQL migration ingestion_dedup
- Prometheus alerts (2 rules)
- deploy.sh idempotent

### E.3 Tài liệu
- LINUX_DEPLOY.md (Ubuntu 24.04, ufw, first deploy, update, rollback)
- Phase roadmap 0–6 (sync SENIOR_DEVOPS_ROADMAP)
- Tech stack version table (copy từ CLAUDE_PRODUCTION_DEPLOY_PROMPT.md §1)
- Mermaid architecture + sequence diagrams
- Integration points: backend/src/app.js, routes/machines.js, middleware/

---

## F. Ràng buộc

- ~100 lines, poll KPI 1–2s, ~20 users, factory LAN
- Single Linux server + 2 BE replicas (Docker), chưa K8s
- PostgreSQL 16/18, Node 22 LTS
- Idempotent deploy scripts
- Không commit secrets

---

## G. Acceptance criteria

1. `docker compose -f infrastructure/compose/docker-compose.prod.yml up -d` → healthy
2. NGINX 443 → FE + API + WS
3. Kill 1 backend replica → still serves
4. Redis cache documented for `/api/kpis/global`
5. Idempotency replay → 1 DB row
6. CI builds FE artifact + BE image; staging deploy documented
7. `backup-postgres.sh` + `restore-postgres.sh` paired and tested (doc)
8. `export-release-bundle.sh` produces offline-deployable tarball
9. Node-RED (Windows) connects via API key — network diagram included
10. All secrets in .env.example only

---

## H. Format output

1. Executive Summary
2. **Tech Stack & Versions table** (FE/BE/DB/Infra/OT/CI-CD)
3. **Export Tools catalog** (app + DevOps scripts)
4. Architecture Diagram (Mermaid)
5. Folder Structure (full tree)
6. Phase Implementation Plan (sprint × deliverable × acceptance)
7. Configuration Files (code blocks — real content)
8. CI/CD Pipeline (FE + BE separate jobs)
9. Security Checklist
10. Runbooks (deploy, rollback, incident, backup, export-audit)
11. Open Questions / Risks

---

## I. Tài liệu tham khảo (đọc trước)

- `docs/guides/CLAUDE_PRODUCTION_DEPLOY_PROMPT.md` (tech stack + export tools)
- `docs/learning/SKILL_BATTLEMAP.md`
- `docs/learning/SENIOR_DEVOPS_ROADMAP.md`
- `docs/architecture/MES_ARCHITECTURE_GUIDE.md`
- `docs/architecture/SAD_FULL.md`
- `README-deploy.md`, `deploy/nginx.conf`
- `backend/src/app.js`, `frontend/package.json`, `backend/package.json`
- `docker-compose.grafana.yml`
- `docs/guides/OBSERVABILITY_QUICKSTART.md`

---

## J. Lưu ý

- Viết **tiếng Việt** (config comments có thể English)
- Thực chiến nhà máy > cloud-native lý thuyết
- Mỗi quyết định lớn → ADR ngắn
- Trade-off tables (WS sticky vs Redis pub/sub, PG 16 vs 18)
- **KHÔNG tạo file trong repo** — chỉ output thiết kế để team review (trừ khi tôi yêu cầu implement sau)

---

*End of Claude Code prompt*
