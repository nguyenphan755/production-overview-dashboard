# Grafana POC — 3 scenario so sánh với Speed Lab / Equipment Details

Tài liệu này chuẩn hóa **3 kịch bản** để so sánh latency MES API vs Grafana panel query (cùng cửa sổ thời gian, cùng máy).

## Tham số chung

| Tham số | Giá trị POC |
|---------|-------------|
| Timezone | `Asia/Ho_Chi_Minh` (ICT, UTC+7) |
| Ca xưởng | Ca 1: 06:00–14:00, Ca 2: 14:00–22:00, Ca 3: 22:00–06:00+1 |
| Production day | 06:00 ngày D → 06:00 ngày D+1 (3 ca) |
| Máy mẫu | Lấy từ `GET /api/machines` — ưu tiên máy có nhiều dữ liệu `oee_calculations` (ví dụ `SH-08`) |
| `bucketSec` Speed Lab | 30 (mặc định tab Speed Lab) |

## Metric so sánh

| Metric | Mô tả | Mục tiêu Grafana POC |
|--------|--------|----------------------|
| **T_total** | Thời gian 3 API Speed Lab chạy song song (wall-clock) | ≤ 2s cho scenario A; ≤ 5s cho B; ≤ 8s cho C |
| **T_query** | Thời gian query panel Grafana (Explore → Query inspector) | ≤ 500ms aggregate; ≤ 2s worst case |
| **Payload** | Kích thước response JSON (bytes) | Grafana aggregate << MES raw segments |
| **Rows scanned** | `EXPLAIN ANALYZE` hoặc Grafana query stats | Ưu tiên bucket SQL, không full raw |

### API MES đo cho mỗi scenario

Speed Lab gọi **3 request song song** khi đổi filter:

1. `GET /api/speed-lab/query?machineId=&start=&end=&bucketSec=30&includeRaw=1`
2. `GET /api/speed-lab/waterfall?machineId=&start=&end=`
3. `GET /api/machines/:id/speed-history?start=&end=`

Equipment Details (khi xem speed history) thêm:

4. `GET /api/machines/:id/status-history?start=&end=` (Gantt)

Chạy script: `node scripts/measure-speed-lab-baseline.mjs --machine SH-08` — kết quả: [`MES_BASELINE_RESULTS.md`](MES_BASELINE_RESULTS.md).

**Kết quả mẫu (SH-08):** Scenario C — MES 745 ms / 4.9 MB vs Grafana SQL aggregate 310 ms / 81 bucket rows.

---

## Scenario A — 1 máy, 1 ca (8 giờ)

**Mục đích:** So sánh filter ca cố định (toolbar `shift_1` hoặc ca hiện tại).

| Field | Giá trị |
|-------|---------|
| Window | Ca 1 hôm nay: `06:00` → `14:00` ICT (hoặc ca đang chạy: `getCurrentShiftWindow`) |
| Span | 8h |
| Ước tính rows `oee_calculations` | ~28k rows/máy (1 Hz khi chạy) |
| MES bucket | 30s → ~960 điểm chart |

**Grafana panel tương ứng:** Speed trend (bucket `$__interval`), Status state timeline.

---

## Scenario B — 1 máy, production day (3 ca, ~24h)

**Mục đích:** So sánh mode `day` / `calendar_day` — điểm nghẽn `fetchSegmentSeries()` (~86k rows).

| Field | Giá trị |
|-------|---------|
| Window | Production day hôm qua (đã đóng): 06:00 D-1 → 06:00 D ICT |
| Span | ~24h |
| Ước tính rows | ~86k rows/máy |
| MES risk | `includeRaw=1` → segment series **không LIMIT** |

**Grafana panel tương ứng:** Speed + energy hourly; zoom tùy ý trong time picker.

---

## Scenario C — 1 máy, 7 ngày (week)

**Mục đích:** So sánh mode `week` — bucket 300s, status history lookback dài.

| Field | Giá trị |
|-------|---------|
| Window | `now - 7d` → `now` |
| Span | 168h |
| Ước tính rows | ~600k rows/máy (nếu chạy liên tục) |
| MES bucket | 300s auto |

**Grafana panel tương ứng:** Speed aggregate + energy daily; auto-interval Grafana.

---

## Checklist POC Grafana

- [ ] Docker Grafana chạy: `docker compose -f docker-compose.grafana.yml up -d`
- [ ] User `grafana_readonly` tạo: `grafana/sql/create_grafana_readonly_user.sql`
- [ ] Dashboard **MES Speed Lab POC** load được 3 scenario
- [ ] Ghi `T_query` từ Explore cho từng panel
- [ ] So sánh với [`MES_BASELINE_RESULTS.md`](MES_BASELINE_RESULTS.md)
- [ ] Quyết định embed: xem [`EMBED_DECISION.md`](EMBED_DECISION.md)

## Grafana MCP (Cursor) — phase R&D

Dùng **Grafana Assistant CLI** (không runtime MES) để:

- Tinh chỉnh SQL panel từ mô tả tiếng Việt
- Tạo biến `machine_id`, `area` từ bảng `machines`
- Export dashboard JSON vào `grafana/dashboards/`

Không dùng MCP làm lớp filter cho operator trên sàn xưởng.
