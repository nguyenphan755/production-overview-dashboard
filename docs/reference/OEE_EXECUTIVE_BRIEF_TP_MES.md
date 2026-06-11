# Executive Brief - OEE chuẩn AVEVA/Hydra + TPM

## Thông điệp 1 dòng
Hệ thống đã có nền tảng OEE tốt, nhưng cần chuẩn hóa KPI settlement để tránh "OEE đẹp số" do fallback dữ liệu, đặc biệt ở Performance và Quality.

## 1) Hiện trạng nhanh
- OEE đang tính theo công thức đúng: `OEE = A x P x Q`.
- Availability đã đi theo hướng shift-based và có aggregation.
- Tuy nhiên, còn một số fallback có thể làm KPI lạc quan:
  - targetSpeed thiếu -> Performance = 100.
  - Quality: **chính sách phase hiện tại** — mặc định 100% **trước khi tích hợp NG**, nhưng **bắt buộc** có cờ `ASSUMED_100_PENDING_NG_INTEGRATION` và chú thích trên UI/báo cáo (không giấu giống fallback Performance).

## 2) Rủi ro quản trị nếu giữ nguyên
- KPI OEE cao hơn thực tế, ưu tiên cải tiến sai.
- Pareto losses có thể không phản ánh đúng nguyên nhân gốc.
- Tranh cãi giữa bộ phận vận hành, bảo trì, chất lượng khi đối chiếu số.

## 3) Chuẩn mực đề xuất
- Tách `Realtime KPI` và `Settled KPI` (official).
- Settled KPI KHÔNG cho phép fallback "mặc định tốt" khi thiếu dữ liệu.
- Chuẩn hóa reason-code và mapping Six Big Losses toàn nhà máy.
- Data quality flags bắt buộc trên từng hệ số A/P/Q.

**Rulebook chi tiết (6.1 + 6.2 — ban hành Phase 1):** [oee-rulebook-realtime-vs-settled.md](./oee-rulebook-realtime-vs-settled.md)

## 4) Kế hoạch hành động ưu tiên

### 0-30 ngày (P0)
- Chốt rulebook KPI:
  - Performance missing targetSpeed -> `null + dataQualityIssue`.
  - Quality (trước NG): mặc định 100% + cờ `ASSUMED_100_PENDING_NG_INTEGRATION`; sau NG -> không mặc định, thiếu OK/NG -> `INSUFFICIENT_QUALITY_DATA`.
- Chỉnh API/dashboard để hiển thị realtime vs settled tách biệt.
- Đồng bộ docs theo logic shift-based hiện tại.

### 30-60 ngày (P1)
- Ban hành danh mục reason-code chuẩn.
- Chuẩn hóa mapping status/reason -> six big losses.
- Thêm dashboard theo dõi độ tin cậy KPI (data completeness).

### 60-90 ngày (P2)
- Chốt settlement theo production order và startup/yield losses.
- Cơ chế review và phê duyệt exception dữ liệu.

## 5) KPI mong đợi sau chuẩn hóa
- OEE settled phản ánh đúng năng lực thiết bị.
- Loss Pareto có tính hành động rõ ràng.
- Giảm tranh cãi KPI liên phòng ban.
- Tăng tốc độ ra quyết định cải tiến OEE theo ca/ngày/tuần.

## 6) Quyết định cần TP MES chốt
1. Có thống nhất tách KPI realtime và settled từ tháng này không?
2. Có thống nhất không sử dụng fallback 100% cho settlement KPI không?
3. Có giao một owner cho bộ reason-code six losses cấp nhà máy không?
