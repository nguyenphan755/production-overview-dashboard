# Kế hoạch retention & partition — `oee_calculations`

Bắt buộc trước khi Grafana query dài hạn trên bảng `oee_calculations` (~86k rows/máy/24h, ~900M rows/năm cho 30 máy).

## Hiện trạng (đo 2026-06-25)

| Item | Trạng thái |
|------|------------|
| Tổng rows `oee_calculations` | **~16.0M** |
| Kích thước bảng | **~4.2 GB** |
| Rows 7 ngày (30 máy) | **~640k** (~21k/máy) |
| Index `(machine_id, calculation_timestamp DESC)` | Có |
| Partition theo tháng | **Chưa** |
| Job archive/delete tự động | **Chưa** |
| Materialized view hourly | Migration sẵn: `migration_oee_calculations_hourly_rollup.sql` |

Chạy lại: `node backend/scripts/report-oee-calculations-volume.mjs`

## Mục tiêu retention

| Tier | Tuổi dữ liệu | Mục đích | Hành động |
|------|--------------|----------|-----------|
| **Hot** | 0–30 ngày | Speed Lab, Equipment historical, Grafana POC | Giữ raw trong `oee_calculations` |
| **Warm** | 31–90 ngày | Báo cáo tuần/tháng | Chuyển sang aggregate hourly (MV hoặc bảng rollup) |
| **Cold** | > 90 ngày | Audit / compliance tùy chọn | Archive parquet/CSV hoặc DROP partition |

Tham chiếu: [`POSTGRESQL_MES_PERFORMANCE_GUIDE.md`](../guides/POSTGRESQL_MES_PERFORMANCE_GUIDE.md) — đề xuất archive 90 ngày.

## Phase 1 — Monitoring (ngay, không đổi schema)

Chạy định kỳ (hàng tuần):

```sql
-- Kích thước bảng
SELECT pg_size_pretty(pg_total_relation_size('oee_calculations')) AS total_size;

-- Rows per machine last 7 days
SELECT machine_id, COUNT(*) AS rows_7d
FROM oee_calculations
WHERE calculation_timestamp >= NOW() - INTERVAL '7 days'
GROUP BY machine_id
ORDER BY rows_7d DESC;

-- Oldest row
SELECT MIN(calculation_timestamp), MAX(calculation_timestamp) FROM oee_calculations;
```

Script ops: [`backend/scripts/report-oee-calculations-volume.mjs`](../../backend/scripts/report-oee-calculations-volume.mjs)

## Phase 2 — Hourly rollup (trước partition)

Tạo bảng rollup phục vụ Grafana + Speed Lab multi-day:

```sql
-- Xem migration: migration_oee_calculations_hourly_rollup.sql
```

Grafana panel > 7 ngày nên query `oee_calculations_hourly` thay vì raw.

## Phase 3 — Partition monthly (khi > ~50M rows)

Pattern giống `machine_line_telemetry`:

1. `PARTITION BY RANGE (calculation_timestamp)`
2. Child tables `oee_calculations_y2025m06`, ...
3. Script maintenance: `ensure-oee-calculations-partitions.mjs` (mirror telemetry script)

**Lưu ý:** PK phải include `calculation_timestamp` khi partition declarative.

## Phase 4 — Retention job

| Job | Lịch | Hành động |
|-----|------|-----------|
| `refresh_oee_hourly_rollup` | Mỗi giờ | INSERT ... ON CONFLICT từ raw 2h gần nhất |
| `drop_oee_raw_partitions` | Hàng tháng | DROP partition older than 30 days (sau khi rollup) |
| `archive_oee_cold` | Hàng quý | `COPY` partition cũ ra NAS/S3 (tùy compliance) |

Chạy bằng `pg_cron` hoặc Windows Task Scheduler gọi `node backend/scripts/...`.

## Ảnh hưởng Grafana

| Without retention | With plan |
|-------------------|-----------|
| Query 7d scan ~600k rows/máy | Hourly MV: ~168 points/máy |
| Dashboard chậm dần theo tháng | Panel p95 ổn định |
| Cùng pool với MES API contention | Read replica / readonly user tách tải |

## Checklist triển khai

- [ ] Baseline volume report chạy được
- [ ] `oee_calculations_hourly` migration applied
- [ ] Grafana dashboard panel > 7d trỏ rollup table
- [ ] Partition script tested trên staging
- [ ] Retention DROP tested với backup
- [ ] Cập nhật [`GRAFANA_INTEGRATION_GUIDE.md`](../guides/GRAFANA_INTEGRATION_GUIDE.md) trỏ đúng bảng

## Thứ tự ưu tiên

1. **Monitoring script** (tuần này)
2. **Hourly rollup** (trước Grafana production)
3. **Partition** (khi row count > 10M)
4. **Automated DROP** (sau rollup verified)
