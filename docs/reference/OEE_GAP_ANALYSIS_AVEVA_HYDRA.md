# OEE GAP Analysis (Project vs AVEVA/Hydra + TPM)

## 1) Muc tieu
- Lam ro baseline OEE hien tai trong project.
- Doi chieu voi khung tham chieu vendor (AVEVA/Hydra) va TPM/Six Big Losses.
- De xuat bo quy tac OEE thong nhat cho van hanh realtime va bao cao chot ca/chot ngay.

## 2) Pham vi va gia dinh tham chieu
- Pham vi phan tich tren code + DB + docs hien co trong repo.
- Khung so sanh su dung:
  - OEE quoc te: `OEE = Availability x Performance x Quality`.
  - Six Big Losses theo TPM.
  - Thuc hanh vendor thong dung (AVEVA/Hydra): uu tien period theo ca/lenh san xuat, reason-code ro rang, tách KPI realtime va KPI settlement.
- Luu y: hien khong truy cap duoc web reference truc tiep do token Firecrawl local bi unauthorized, vi vay tai lieu nay dung khung chuan cong nghiep pho bien + implementation hien tai trong repo de ra quy tac ap dung.

## 3) Baseline hien tai trong project

### 3.1 Backend OEE calculator
- File: `backend/src/services/oeeCalculator.js`
- Dang tinh:
  - Availability: Running Time / Planned Time.
  - Performance: Actual Speed / Target Speed (clamp 0..100).
  - Quality: OK / (OK + NG), co fallback.
  - OEE: `(A * P * Q) / 10000`.
- Window tinh:
  - Mac dinh shift-based (goi `getCurrentShiftWindow`).
  - Cho shift dang chay: co `availabilityIsPreliminary` va co fallback ve shift truoc neu qua thap dau ca.

### 3.2 Availability aggregation
- Files:
  - `backend/src/services/availabilityAggregator.js`
  - `backend/src/services/availabilitySync.js`
  - `backend/database/migration_add_availability_aggregation.sql`
- Co bang `availability_aggregations`, ham `calculate_availability_aggregation`, `get_latest_availability`.
- Logic SQL va service cho thay da uu tien `calculation_type = 'shift'`, nhung schema/comment van con vet rolling-window demo.

### 3.3 Data model lien quan OEE
- `backend/database/migration_add_oee_tracking.sql`:
  - `machine_status_history`
  - `production_quality`
  - `oee_calculations`
- `machines` co truong snapshot OEE (`oee`, `availability`, `performance`, `quality`).

### 3.4 Frontend hien thi
- `frontend/src/components/tabs/EquipmentDetail.tsx` hien thi OEE va A/P/Q theo mau nguong.
- Co phan tich losses o `backend/src/services/analyticsService.js` (Six Big Losses mapping theo status/downtime buckets).

## 4) Khung chuan muc tieu (AVEVA/Hydra + TPM)

## 4.1 Dinh nghia A/P/Q chuan
- Availability:
  - Numerator: Operating Time.
  - Denominator: Planned Production Time.
  - Operating Time = Planned Production Time - Stop Losses.
- Performance:
  - Theo ideal cycle/rated speed.
  - Khong nen mac dinh 100% khi thieu target; can danh dau "unknown" hoac loai khoi KPI settlement.
- Quality:
  - Good Count / Total Count (hoac Good Length / Total Length neu line theo met).
  - Scrap/rework can tách ro.

## 4.2 Six Big Losses mapping
- Availability Losses:
  - Equipment Failures
  - Setup and Adjustments
- Performance Losses:
  - Idling and Minor Stops
  - Reduced Speed
- Quality Losses:
  - Process Defects
  - Reduced Yield (startup losses)

## 4.3 Nguyen tac settlement KPI
- Tach 2 lop:
  - Realtime monitoring KPI: cap nhat lien tuc de quan sat.
  - Settled KPI (official): chot theo ca/ngay/lenh, du lieu da complete + da classify reason-code.
- Muc tieu: tranh sai lech KPI do du lieu dau ca, du lieu chua du, hoac fallback "gia dinh tot".

## 5) GAP Analysis chi tiet

## 5.1 GAP ve Availability
- Hien tai:
  - Da co shift-based va aggregation tot.
  - Co fallback shift truoc khi dau ca availability thap.
- GAP:
  - KPI realtime co the "dep so" hon thuc te dau ca do fallback.
  - Chua thay ro co co che "official settlement" tách biet voi realtime.
- Tac dong:
  - Bao cao quan tri ca/ngay co nguy co khong truy vet duoc nguon goc sai lech.

## 5.2 GAP ve Performance
- Hien tai:
  - Neu `targetSpeed <= 0` thi Performance = 100.
- GAP:
  - Khong phu hop thong le OEE chuan cho KPI chot ky.
  - Day OEE tang ao khi master data target speed chua day du.
- Tac dong:
  - KPI OEE bi lac quan gia, lam sai uu tien cai tien.

## 5.3 GAP ve Quality
- Hien tai:
  - Uu tien OK/NG realtime, fallback `producedLength` -> assume all OK.
  - Neu tong = 0 thi tra 100%.
- GAP:
  - Trong settlement, fallback "all OK" khong nen tinh la 100% neu thieu du lieu chat luong.
  - Chua thay ro luat startup scrap/rework tách khoi process defects.
- Tac dong:
  - Sai lech loss quality, kho danh gia dung Six Big Losses.

## 5.4 GAP ve phan loai losses va reason-code
- Hien tai:
  - Co status buckets (`idle`, `warning`, `error`, `stopped`, `setup`).
- GAP:
  - Chua ro bo reason-code chuan hoa theo cap toan nha may.
  - Chua thay co che enforce mapping status -> six losses theo rule governance.
- Tac dong:
  - Pareto losses va hanh dong cai tien co the khong nhat quan giua line/khu vuc.

## 5.5 GAP ve tai lieu va dong bo implementation
- Hien tai:
  - Docs OEE van con mo ta rolling 10 phut trong `docs/architecture/REALTIME_OEE_IMPLEMENTATION.md`.
  - Code da shift-based.
- GAP:
  - Sai khac docs vs code gay hieu nham cho van hanh va lanh dao.

## 6) Bo tieu chuan OEE de xuat ap dung ngay

**Chi tiet day du (Phase 1 — muc 6.1 & 6.2 da ban hanh):** [oee-rulebook-realtime-vs-settled.md](./oee-rulebook-realtime-vs-settled.md)

## 6.1 Rulebook A/P/Q (de xuat)
- Availability:
  - Realtime: cho phep preliminary flag.
  - Settlement: tinh thuần theo period da chot, khong vay muon shift truoc.
- Performance:
  - Neu thieu `targetSpeed`:
    - Realtime: co the hien thi tam va gan quality flag.
    - Settlement: dat `null` + `dataQualityIssue`, KHONG auto 100.
- Quality:
  - **Phase chua tich hop NG (da chot):** Realtime va settled deu **mac dinh 100%** khi chua co NG, **bat buoc** co cờ `ASSUMED_100_PENDING_NG_INTEGRATION` + chu thich tren dashboard/bao cao.
  - **Sau khi co NG:** khong mac dinh all OK khi thieu OK/NG; xem rulebook.

*(Cong thuc TPM, bang Realtime vs Settled, enum data_quality, grain shift/day/order — xem rulebook lien ket.)*

## 6.2 Rulebook settlement
- Tinh KPI chinh thuc theo:
  - Shift closed
  - Day closed
  - Production order closed
- Luu 2 bo chi so:
  - `oee_realtime_*`
  - `oee_settled_*`

*(Ten truong API/DB de xuat, thoi diem snapshot, rollup — xem rulebook lien ket.)*

## 6.3 Rulebook losses
- Chuan hoa bang mapping:
  - status/reason_code -> six_big_loss_category
- Bat buoc co governance:
  - danh muc reason-code dung chung toan nha may.
  - quy tac ownership va review dinh ky.

## 7) Danh sach thay doi uu tien cho he thong

## P0 (quan trong cao, can lam som)
1. Bo auto `Performance = 100` khi thieu target trong KPI settlement.
2. Quality: **phase chua NG** giu mac dinh 100% nhung **bat buoc** tra cờ `ASSUMED_100_PENDING_NG_INTEGRATION` + UI chu thich; **sau khi tich hop NG** thi bo mac dinh 100 va ap dung `INSUFFICIENT_QUALITY_DATA` khi thieu OK/NG.
3. Tach ro realtime vs settled KPI trong API va dashboard.
4. Dong bo lai docs OEE de khop code hien tai (shift-based).

## P1 (quan trong trung binh)
1. Chuan hoa reason-code va mapping six losses.
2. Them data-quality flags tren tung thanh phan A/P/Q.
3. Them dashboard theo doi "KPI confidence" (du lieu day du/thieu).

## P2 (nang cao)
1. Rule settlement theo lenh san xuat + startup/yield losses chi tiet.
2. Governance workflow phe duyet exception data.

## 8) Tieu chi thanh cong
- OEE settlement khong con fallback Performance/Target ao; Quality trong phase chua NG chi chap nhan neu **co cờ va chu thich ro rang**, sau NG phai do OK/NG thuc te.
- Giam tranh cai KPI giua san xuat - bao tri - chat luong.
- Pareto losses co tinh hanh dong (actionable) va nhat quan giua cac line.
- Docs, code, dashboard dong nhat cung mot bo dinh nghia.

## 9) Phu luc: File nguon da doi chieu
- `backend/src/services/oeeCalculator.js`
- `backend/src/services/availabilityAggregator.js`
- `backend/src/services/availabilitySync.js`
- `backend/src/services/analyticsService.js`
- `backend/src/routes/machines.js`
- `backend/database/migration_add_oee_tracking.sql`
- `backend/database/migration_add_availability_aggregation.sql`
- `docs/architecture/REALTIME_OEE_IMPLEMENTATION.md`
- `docs/architecture/SHIFT_BASED_AVAILABILITY.md`
