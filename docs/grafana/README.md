# Grafana POC — Setup & chạy thử

> **Hướng dẫn đầy đủ (sử dụng + cài trên PC khác):** [`HUONG_DAN_SU_DUNG.md`](HUONG_DAN_SU_DUNG.md)

Dashboard Grafana **bổ sung** (không thay thế UI MES). Tab Equipment Detail và Speed Lab giữ nguyên giao diện MES; có thêm nút **Mở Grafana** mở dashboard tương ứng trong tab mới.

- Equipment Detail → `mes-equipment-detail`
- Speed Lab → `mes-speed-lab`
- Env frontend: `VITE_GRAFANA_URL=http://localhost:3000`

## 1. Tạo user read-only (khuyến nghị production)

```powershell
psql -U postgres -d production_dashboard -f grafana/sql/create_grafana_readonly_user.sql
```

Sau đó thêm vào `grafana/.env`: `GRAFANA_PG_USER=grafana_readonly` và password tương ứng.

## 2. Postgres credentials — tự động từ `.env`

**Không cần sửa tay** `postgres.yml`. Script đọc theo thứ tự:

1. `.env` (root)
2. `backend/.env` (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`)
3. `grafana/.env` (override tùy chọn `GRAFANA_PG_*`)

`DB_HOST=localhost` được map thành `host.docker.internal` (Grafana chạy trong Docker, Postgres trên máy host).

Render thủ công (không cần nếu dùng docker compose bên dưới):

```powershell
node scripts/render-grafana-datasource.mjs
```

File sinh ra: `grafana/provisioning/datasources/postgres.yml` (gitignored, có password).

## 3. Chạy Grafana

### Cách A — Dùng Grafana Docker đang chạy sẵn (port 3000, ví dụ `nhed-grafana`)

Không start container Grafana mới (tránh trùng port). Chỉ render datasource + import dashboard qua API:

```powershell
node scripts/render-grafana-datasource.mjs
node scripts/provision-grafana-api.mjs
```

Mặc định: `http://localhost:3000`, user `admin`. Đặt `GRAFANA_ADMIN_PASSWORD` trong `grafana/.env` nếu khác (ví dụ `admin123`).

Dashboard: http://localhost:3000/d/mes-speed-lab-poc

### Cách B — Grafana POC riêng (port 3002, không đụng instance cũ)

```powershell
copy grafana\.env.example grafana\.env
docker compose -f docker-compose.grafana.yml up -d
```

Compose chạy `grafana-datasource-render` rồi `mes-grafana-poc` trên **port 3002** (đổi `GRAFANA_PORT` trong `grafana/.env` nếu cần).

## 4. Ba scenario POC

Xem [`POC_SCENARIOS.md`](POC_SCENARIOS.md). Dùng quick links trên dashboard hoặc time picker:

| Scenario | Time range |
|----------|------------|
| A — 1 ca | `now/d+6h` → `now/d+14h` (Ca 1 ICT) |
| B — 1 ngày | Last 24 hours |
| C — 7 ngày | Last 7 days |

## Scripts

| Script | Mục đích |
|--------|----------|
| `node scripts/render-grafana-datasource.mjs` | Sinh `postgres.yml` từ `.env` |
| `node scripts/build-grafana-dashboards.mjs` | Sinh `mes-equipment-detail.json` + `mes-speed-lab.json` |
| `node scripts/measure-speed-lab-baseline.mjs [--machine SH-08]` | Đo latency API MES |
| `node scripts/measure-grafana-query-baseline.mjs [--machine SH-08]` | Đo SQL panel Grafana |

Xem [`docs/guides/EQUIPMENT_SPEED_LAB_QUERY_OPTIMIZATION.md`](../guides/EQUIPMENT_SPEED_LAB_QUERY_OPTIMIZATION.md) — rà soát truy vấn Equipment Detail & Speed Lab.
| `node backend/scripts/report-oee-calculations-volume.mjs` | Báo cáo retention |

## Troubleshooting

| Vấn đề | Cách xử lý |
|--------|------------|
| Datasource connection failed | Chạy lại `node scripts/render-grafana-datasource.mjs`; kiểm tra Postgres listen + `pg_hba.conf` |
| `change_me` / wrong password | Đảm bảo `backend/.env` có `DB_PASSWORD`; recreate compose |
| Dashboard trống | Chọn máy có `oee_calculations`; mở rộng time range |
| Iframe MES trống / login Grafana | `GF_SECURITY_ALLOW_EMBEDDING=true` + anonymous Viewer (đã có trong `docker-compose.grafana.yml`); hard-refresh MES |

Xem thêm [`EMBED_DECISION.md`](EMBED_DECISION.md), [`RETENTION_PLAN.md`](RETENTION_PLAN.md).
