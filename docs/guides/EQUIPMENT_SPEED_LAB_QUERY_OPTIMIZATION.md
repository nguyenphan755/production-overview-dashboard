# Rà soát & tối ưu truy vấn — Equipment Detail & Speed Lab

Tài liệu tóm tắt luồng API, điểm nghẽn đã xử lý, và hướng cải tiến tiếp theo.

---

## 1. Luồng API khi mở Speed Lab

| Hook / thành phần | Endpoint | Mục đích |
|-------------------|----------|----------|
| `useSpeedLabQuery` | `GET /api/speed-lab/query` | Bucket trend, raw rows (capped), Gantt segments |
| `useOeeWaterfallQuery` | `GET /api/speed-lab/waterfall` | OEE waterfall v2 |
| `useEquipmentSpeedHistory` | `GET /api/machines/:id/speed-history` | V_KTCN overlay, product notes, ICT |
| `useMachines` (Dashboard) | `GET /api/machines` | Dropdown máy + target speed live |
| Toolbar OEE | `GET /api/analytics` hoặc settled shift | Rollup KPI toolbar |

Ba hook đầu chạy **song song** khi đã chọn máy.

---

## 2. Luồng API khi mở Equipment Detail

| Hook | Endpoint | Poll |
|------|----------|------|
| `useMachineDetail` | `GET /api/machines/:id` | Mặc định ≥3s (payload nặng) |
| `useEquipmentSpeedHistory` | `GET /api/machines/:id/speed-history` | 30s nếu cửa sổ live |
| Status Gantt (trong tab) | `GET /api/machines/:id/status-history` | 30s nếu live |
| `useMachines` (parent) | `GET /api/machines` | Chậm 5s khi đang xem detail |

---

## 3. Tối ưu đã triển khai

### Backend

| Thay đổi | File | Lợi ích |
|----------|------|---------|
| Bỏ `fetchSegmentSeries` uncapped khi đã có `rawRows` | `speedLabService.js` | Tránh query full-range thứ 2 (có thể 80k+ rows) |
| Waterfall dùng `fetchStableSpeedSummary` (1 aggregate SQL) thay `getMachineSpeedHistory` | `oeeWaterfallService.js` | Giảm ~5 query + xử lý phase/telemetry mỗi lần mở waterfall |
| Auto-coarsen `bucketSec` khi span/bucket > 4000 điểm | `oeeSpeedHistoryService.js` | Tránh chart speed-history quá nặng trên range dài |
| Product notes từ `machine_line_telemetry` | `oeeSpeedHistoryService.js` | Tên SP khớp snapshot máy (AreaCard) |

### Frontend

| Thay đổi | File | Lợi ích |
|----------|------|---------|
| Fleet poll chậm hơn trên Speed Lab / Equipment list / khi mở detail | `poll-config.ts`, `Dashboard.tsx` | Giảm tải `/api/machines` song song detail |
| Machine detail poll mặc định ≥3s | `poll-config.ts` | Giảm hammer `/machines/:id` |
| In-flight guard pollers | `useEquipmentSpeedHistory.ts`, `useProductionData.ts` | Không chồng request khi response chậm |
| Debounce bucket input 350ms | `SpeedLab.tsx` | Ít burst khi gõ bucket |
| `refetchAll` gồm speed-history | `SpeedLab.tsx` | Đồng bộ panel sau Phân tích |
| `refetch()` trên speed-history hook | `useEquipmentSpeedHistory.ts` | Hỗ trợ refresh thủ công |

---

## 4. Env tinh chỉnh poll (tùy chọn)

```env
# frontend/.env
VITE_POLL_MS_MACHINES=2000
VITE_POLL_MS_MACHINE_DETAIL=5000
```

---

## 5. Hướng cải tiến tiếp (chưa làm)

| Ưu tiên | Ôn tập | Effort |
|---------|--------|--------|
| Cao | Tách `GET /machines/:id` thành snapshot nhẹ + history on-demand | Lớn |
| Cao | Cache status segments dùng chung giữa Gantt và speed-history | Trung bình |
| Trung bình | React Query / SWR keyed cache cho 3 hook Speed Lab | Trung bình |
| Trung bình | Gộp `/speed-lab/query` + product overlay trong 1 response | Lớn |
| Thấp | `includeRaw=0` cho range >24h, chỉ dùng buckets | Nhỏ |

---

## 6. Đo hiệu năng

```powershell
node scripts/measure-speed-lab-baseline.mjs --machine SH-05
node scripts/measure-grafana-query-baseline.mjs --machine SH-05
```

Kết quả mẫu: [`docs/grafana/MES_BASELINE_RESULTS.md`](../grafana/MES_BASELINE_RESULTS.md).

---

## 7. Checklist sau deploy

- [ ] Restart backend sau thay đổi service
- [ ] Hard-refresh MES (Ctrl+Shift+R)
- [ ] Speed Lab: đổi filter → Network tab ≤3 request song song, không lặp segmentSeries
- [ ] Waterfall load nhanh hơn (không gọi full speed-history)
- [ ] Equipment Detail: `/api/machines` không poll 1s khi đang xem 1 máy
