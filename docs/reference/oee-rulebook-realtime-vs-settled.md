# Rulebook OEE — Realtime vs Settled (mục 6.1 & 6.2)

Tài liệu này **chốt quy tắc nghiệp vụ** cho hai lớp chỉ số: **Realtime (giám sát)** và **Settled (chính thức sau khi chốt kỳ)**. Phần **loss mapping / reason-code** (mục 6.3) không nằm trong phạm vi file này.

---

## 1. Mục đích và phạm vi

- **Realtime**: phục vụ điều hành tức thời; cho phép cảnh báo sớm và một số ước lượng có gắn **cờ chất lượng dữ liệu**.
- **Settled**: phục vụ báo cáo quản trị, đối soát giữa các bộ phận; **không** giấu việc thiếu dữ liệu — mọi giả định phải có **cờ và chú thích** để audit được.
- **Chính sách giai đoạn hiện tại (Quality)**: **chưa tích hợp NG** → nhà máy **chấp nhận Quality mặc định 100%** cho cả realtime và settled, **miễn là** luôn gắn cờ `ASSUMED_100_PENDING_NG_INTEGRATION` và hiển thị cảnh báo trên dashboard/báo cáo. Sau khi có kênh NG, chuyển sang §5.3 phần **“Sau khi tích hợp NG”**.
- **OEE tổng**: `OEE = Availability × Performance × Quality` (mỗi thành phần biểu diễn theo % 0–100 trước khi nhân; tích hiển thị dạng % 0–100).

---

## 2. Thuật ngữ và biến đầu vào

| Thuật ngữ | Ý nghĩa |
|-----------|---------|
| **Planned Production Time** | Thời gian kế hoạch sản xuất trong **kỳ đã chọn** (ca / ngày / lệnh), sau khi đã loại trừ các khoảng **không tính vào OEE** theo quy ước nhà máy (nếu có): ví dụ nghỉ theo lịch, họp cố định được TP phê duyệt. *Nếu chưa có loại trừ, Planned Time = độ dài kỳ theo lịch.* |
| **Operating Time** (Running Time) | Thời gian máy ở trạng thái được coi là **đang chạy sản xuất** theo rule nhà máy (đối chiếu enum status PLC/MES). |
| **Stop Time** | Thời gian không thuộc Operating Time trong kỳ (breakdown, setup, chờ nguyên liệu, v.v. — chi tiết phân loại loss là việc mục 6.3). |
| **Actual speed** | Tốc độ thực đoạn đang xét (đơn vị thống nhất theo line; ví dụ m/phút hoặc m/s sau quy đổi). |
| **Target / Rated speed** | Tốc độ mục tiêu **đã chốt cho lệnh / sản phẩm / recipe** (master data hoặc từ ERP/MES). |
| **Good length / Defect length** | Chiều dài OK / NG trong kỳ (hoặc số lượng tương đương nếu line đếm theo đơn vị khác). |

---

## 3. Công thức chuẩn (tham chiếu TPM)

### 3.1 Availability (%)

\[
\text{Availability} = \frac{\text{Operating Time}}{\text{Planned Production Time}} \times 100
\]

- **Operating Time** có thể tính trực tiếp từ tổng thời lượng trạng thái `running` trong kỳ, hoặc tương đương: `Planned Production Time − Stop Time` (nếu định nghĩa Stop đầy đủ và nhất quán).

### 3.2 Performance (%)

\[
\text{Performance} = \frac{\text{Actual output rate}}{\text{Target output rate}} \times 100
\]

- Trên line dùng tốc độ: có thể dùng tỉ lệ **Actual speed / Target speed** trong **khoảng thời gian Operating Time** (hoặc tích phân theo thời gian — quy ước chi tiết ghi trong spec kỹ thuật triển khai).
- **Giới hạn trên**: theo thông lệ OEE cổ điển thường **cap 100%** (chạy nhanh hơn target không làm OEE > 100). Nếu sau này nhà máy chọn cho phép >100, phải **ghi rõ trong phụ lục** và tách KPI “OEE cổ điển” / “OEE mở rộng”.

### 3.3 Quality (%)

\[
\text{Quality} = \frac{\text{Good quantity}}{\text{Total quantity}} \times 100
\]

- Line theo mét: `Good length / (Good length + Defect length)`.

---

## 4. Hai lớp KPI (tổng quan)

| Tiêu chí | **Realtime** | **Settled** |
|----------|----------------|-------------|
| Mục đích | Giám sát, phản ứng nhanh | Báo cáo chính thức, KPI chốt kỳ |
| Cập nhật | Liên tục / theo chu kỳ ngắn | Một snapshot **sau khi kỳ đóng** |
| Availability | Cho phép `preliminary` (đầu ca, thiếu log…) | **Chỉ** tính trên kỳ đã khóa, **không** kế thừa số ca trước |
| Performance | Có thể hiển thị tạm khi thiếu target, kèm cờ | Thiếu target hợp lệ → **không** gán 100%; xem §5.2 |
| Quality | Theo §5.3 (**trước NG**: mặc định 100% + cờ); sau NG: OK/NG thực tế | Giống realtime trong giai đoạn **chưa có NG**: **100%** + cờ `ASSUMED_100_PENDING_NG_INTEGRATION`; sau NG: không giả định |
| OEE tổng | Có thể tính kể cả Quality giả định **nếu** cờ Quality được trả về đầy đủ | **Settled** vẫn tính được khi Quality đang theo chính sách giả định **nhưng** báo cáo BGĐ phải lọc/chú thích theo cờ Quality |

---

## 5. Mục 6.1 — Rulebook chi tiết theo A / P / Q

### 5.1 Availability

**Realtime**

- Cho phép cờ **`availability_is_preliminary`**: ví dụ đầu ca, aggregation chưa ổn định, hoặc phần cuối kỳ đang chờ đóng event.
- Cho phép hiển thị % theo **cửa sổ hiện tại** (ví dụ từ đầu ca đến `now`).
- **Không** áp dụng các quy tắc “vay” số ca trước vào **bản settled**; có thể vẫn hiển thị riêng “tham chiếu ca trước” như một KPI phụ (ngoài OEE settled).

**Settled**

- **Chỉ** dùng dữ liệu trong `[period_start, period_end]` của kỳ đã **đóng** (ca/ngày/lệnh).
- **Không** thay thế Availability thấp đầu ca bằng Availability ca trước trong con số **settled** của ca hiện tại.
- `Planned Production Time` và danh sách **stop được loại khỏi Planned** (nếu có) phải **đóng băng** tại thời điểm settlement để audit được.

### 5.2 Performance

**Realtime**

- Nếu **`target_speed`** (hoặc tương đương) **thiếu hoặc ≤ 0**:
  - Hiển thị Performance **`null`** *hoặc* giữ số “ước tính” nhưng **bắt buộc** có cờ **`performance_data_quality = MISSING_TARGET`** (hoặc mã tương đương).
  - **Không** được báo cáo như “Performance chính xác” khi có cờ này.

**Settled**

- Nếu không có **Target speed hợp lệ** cho ≥ X% thời lượng Operating Time của kỳ (ngưỡng X do TP chốt, ví dụ 95%) hoặc không có target cho toàn kỳ:
  - `performance_settled_pct` = **`null`**
  - `performance_data_quality` = **`MISSING_TARGET`** hoặc **`INSUFFICIENT_MASTER_DATA`**
  - **Không** gán `100%` để “đỡ trống”.

### 5.3 Quality

#### A) Giai đoạn **chưa tích hợp NG** — **chính sách đang áp dụng**

Mục tiêu: giữ OEE vận hành được **mà không giấu** rằng tổn thất chất lượng **chưa** đo.

**Realtime và Settled (cùng một rule trong phase này)**

1. Nếu đã có **OK và NG** (hoặc scrap) tin cậy trong kỳ → tính theo §3.3, cờ `quality_data_quality = OK`.
2. Nếu **chưa có NG / chưa đấu nối kênh NG** (hoặc chỉ có tổng mét chạy mà không có split QC đã thống nhất):
   - `quality_*_pct` = **`100`**
   - **`quality_data_quality` = `ASSUMED_100_PENDING_NG_INTEGRATION`** (bắt buộc).
   - UI/báo cáo: hiển thị nhãn kiểu *“Quality = 100% (giả định — chưa trừ NG)”*.
3. **Không** được coi KPI này là **OEE đầy đủ theo TPM** cho mục đích đánh giá quality loss; dùng cho **điều hành A và P**, và roadmap phải ghi **“Quality chờ tích hợp NG”**.

#### B) Sau khi **đã tích hợp NG** — chuyển sang đo đạc đầy đủ

**Realtime**

- Ưu tiên **OK + NG** thực tế trong kỳ.
- Nếu chỉ có tổng sản lượng mà **không tách OK/NG**:
  - Hiển thị Quality **ước lượng** với cờ **`ESTIMATED_FROM_TOTAL`** (dashboard vận hành).
  - Tooltip: “ước lượng — cần QC/NG”.

**Settled**

- Nếu trong kỳ **không có** đủ dữ liệu OK/NG tin cậy (theo ngưỡng TP chốt):
  - `quality_settled_pct` = **`null`**
  - `quality_data_quality` = **`INSUFFICIENT_QUALITY_DATA`**
  - **Không** mặc định “toàn bộ là OK”.
- **Chưa có sản xuất** (`total = 0`): `quality_settled_pct` = **`null`** với **`NO_PRODUCTION`**, hoặc loại kỳ khỏi ranking — **không** dùng 100% như điểm tối đa ảo (trừ khi vẫn đang trong phase A có chủ trương riêng — khi đó vẫn phải có cờ policy).

### 5.4 OEE tổng khi thành phần thiếu

| Lớp | Quy tắc |
|-----|---------|
| **Realtime** | Nếu một trong A/P là `null` (hoặc Performance không hiển thị được) → `oee_realtime_pct = null` + cờ. **Quality** trong phase chưa NG: có thể là `100` **chỉ khi** có cờ `ASSUMED_100_PENDING_NG_INTEGRATION`. |
| **Settled** | Tương tự: **Performance** thiếu target → không nhân OEE settled (null). **Quality** phase chưa NG: cho phép **100 + cờ**, OEE settled **được phép tính** nhưng báo cáo quản trị nên filter hoặc cột riêng “OEE (chưa trừ NG)”. |

---

## 6. Mục 6.2 — Rulebook settlement (chốt kỳ)

### 6.1 Ba grain (độ chi tiết kỳ)

| Grain | Khi nào “đóng” | Ghi chú |
|-------|------------------|---------|
| **Shift** | Hết ca theo lịch nhà máy (ví dụ ranh giới đã dùng trong code hiện tại) | Snapshot settled **một máy / một ca** (hoặc aggregate sau). |
| **Day** | Hết ngày lịch theo **múi giờ nhà máy** đã cấu hình | Dùng cho báo cáo BGĐ; có thể rollup từ các shift đã settled. |
| **Production order** | Lệnh chuyển trạng thái **completed / closed** (theo rule MES) | Thời đoạn có thể không khớp ranh giới ca — vẫn là một kỳ settlement hợp lệ. |

Mỗi snapshot settled phải có khóa định danh đề xuất:

- `machine_id`
- `grain`: `shift` | `day` | `production_order`
- `period_start`, `period_end` (UTC hoặc local có timezone rõ ràng)
- `shift_id` / `calendar_date` / `production_order_id` tùy grain

### 6.2 Hai họ tên trường (đặt tên API / DB sau này)

**Realtime (monitoring)**

- `oee_realtime_pct`
- `availability_realtime_pct` + `availability_is_preliminary` (boolean)
- `performance_realtime_pct` + `performance_data_quality` (enum)
- `quality_realtime_pct` + `quality_data_quality` (enum)

**Settled (official)**

- `oee_settled_pct`
- `availability_settled_pct`
- `performance_settled_pct`
- `quality_settled_pct`
- `*_data_quality` tương ứng cho từng thành phần (hoặc một struct JSON duy nhất `data_quality_flags`)

Enum **data_quality** (đề xuất tối thiểu): `OK`, `MISSING_TARGET`, `INSUFFICIENT_QUALITY_DATA`, `ESTIMATED_FROM_TOTAL`, **`ASSUMED_100_PENDING_NG_INTEGRATION`**, `NO_PRODUCTION`, `INCOMPLETE_STATUS_HISTORY`, … (mở rộng khi triển khai).

### 6.3 Thời điểm sinh snapshot settled

- **Sự kiện**: khi grain đạt trạng thái đóng (đóng ca, đóng ngày, đóng lệnh).
- **Đối soát**: job định kỳ (ví dụ +15 phút sau ranh giới) để tái tính nếu có log đến muộn; sau cutoff audit thì **khóa bản ghi settled** (immutable) hoặc chỉ cho phép chỉnh bằng quy trình **điều chỉnh có phê duyệt** (ghi audit trail).

### 6.4 Rollup (tổng hợp nhiều máy / nhiều ca)

- Không nhân trực tiếp các OEE % máy khác nhau bằng nhau nếu không cùng trọng số; rollup đề xuất:
  - Cộng **Operating Time**, **Planned Time**, **Good length**, **Total length**, **Ideal output**… rồi tính lại A/P/Q **ở cấp tổng hợp**, **hoặc**
  - Trọng số theo Planned Time từng máy (TP chốt một trong hai và ghi vào policy).

---

## 7. Liên kết tài liệu khác

- Phân tích GAP và roadmap code: [OEE_GAP_ANALYSIS_AVEVA_HYDRA.md](./OEE_GAP_ANALYSIS_AVEVA_HYDRA.md)
- Brief lãnh đạo: [OEE_EXECUTIVE_BRIEF_TP_MES.md](./OEE_EXECUTIVE_BRIEF_TP_MES.md)

---

## 8. Phê duyệt (điền khi ban hành)

| Vai trò | Họ tên | Ngày | Ghi chú |
|---------|--------|------|---------|
| TP MES | | | |
| Đại diện SX | | | |
| Đại diện QM | | | |
| IT/MES | | | |

**Phiên bản tài liệu:** 1.1 — Bổ sung chính sách Quality mặc định 100% trước khi tích hợp NG (cờ `ASSUMED_100_PENDING_NG_INTEGRATION`).
