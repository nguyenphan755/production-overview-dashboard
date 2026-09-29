# Observability Quickstart — MES Production Dashboard

> Phase 0 Session 0B · Prometheus + Grafana + Logs
> Liên quan: [SKILL_BATTLEMAP.md](../learning/SKILL_BATTLEMAP.md) §3.8, §3.9

---

## 1. Mục tiêu

Sau buổi lab này bạn có thể:

- Chạy Grafana POC local
- Kiểm tra `/health` và `/health/ready` của backend
- Đọc log container / systemd cơ bản
- Hiểu pipeline Prometheus → Grafana (Phase 2 sẽ implement `/metrics`)

---

## 2. Health checks (đã có sẵn)

Backend expose:

| Endpoint | Mục đích |
|----------|----------|
| `GET /health` | Liveness — process còn sống |
| `GET /health/ready` | Readiness — PostgreSQL kết nối được |

```bash
curl -s http://localhost:3001/health | jq .
curl -s http://localhost:3001/health/ready | jq .
```

Code: [backend/src/app.js](../../backend/src/app.js)

**MES checklist "server healthy"**:

- [ ] `/health` → 200
- [ ] `/health/ready` → 200 (DB OK)
- [ ] `GET /api/kpis/global` → 200, < 500ms
- [ ] Grafana UI mở được
- [ ] Không có error loop trong logs 5 phút gần nhất

---

## 3. Grafana POC (Phase 0 lab)

Repo đã có stack Grafana đọc PostgreSQL:

```bash
# Từ thư mục gốc repo
docker compose -f docker-compose.grafana.yml up -d

# Hoặc script setup (khuyến nghị)
node scripts/setup-grafana.mjs
```

- UI: `http://localhost:${GRAFANA_PORT:-3000}`
- Default admin: xem `grafana/.env` hoặc `GRAFANA_ADMIN_PASSWORD`
- Dashboards: [grafana/dashboards/](../../grafana/dashboards/)

Chi tiết: [docs/grafana/README.md](../grafana/README.md)

---

## 4. Log query thực chiến

### Windows (hiện tại — PM2)

```powershell
pm2 logs production-dashboard-backend --lines 200
Get-Content backend\logs\*.log -Tail 50 -Wait
```

### Linux / Docker (mục tiêu)

```bash
# Docker Compose
docker compose logs backend -f --since 10m

# systemd (sau khi deploy Linux)
journalctl -u mes-backend -f --since "1 hour ago"

# Lọc JSON (Phase 2 — pino)
docker logs mes-backend 2>&1 | jq 'select(.level >= 50)'
```

### NGINX

```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## 5. Prometheus (Phase 2 — preview)

Sẽ thêm endpoint `GET /metrics` với `prom-client`:

```
http_requests_total
http_request_duration_seconds
db_pool_connections_active
```

Scrape config (draft): `infrastructure/prometheus/prometheus.yml`

Grafana dashboard **Server Health** sẽ hiển thị:

- API request rate & error rate
- Latency p50 / p95
- DB pool usage

---

## 6. Lab exercises Session 0B

1. Start backend + Grafana POC cùng lúc
2. Mở dashboard MES Speed Lab — xác nhận data từ PostgreSQL
3. `curl /health/ready` khi tắt PostgreSQL → quan sát 503
4. Bật lại DB → ready trở lại 200
5. Ghi kết quả vào §7

---

## 7. Kết quả lab (bạn điền)

**Ngày**: _______________

| Check | Kết quả | Ghi chú |
|-------|---------|---------|
| Grafana UI | OK / Fail | |
| /health | | |
| /health/ready | | |
| Dashboard có data | | |
| Log query thử | | |

**Câu hỏi mở cho Phase 2**:

1.
2.

---

## 8. Bước tiếp theo

- Phase 2 Sprint 2.3: implement pino + `/metrics` + dashboard Server Health
- Benchmark baseline: [SKILL_BATTLEMAP.md §6](../learning/SKILL_BATTLEMAP.md)
