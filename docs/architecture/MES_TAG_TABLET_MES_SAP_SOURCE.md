# Bảng tag theo ngữ cảnh – Kiểu dữ liệu & Nguồn dữ liệu

**Phiên bản:** 1.0  
**Mục đích:** Tham chiếu nhanh **tagname** kèm **kiểu dữ liệu** và **nguồn dữ liệu** (luồng PLC, Tablet, MES, SAP).  
**Tham chiếu:** `MES_TAG_NAMING_STANDARD.md`, `MES_TAG_NAME_SHOPFLOOR.md`.

---

## 1. Quy ước cột Nguồn dữ liệu

| Ký hiệu | Ý nghĩa |
| ------- | ------- |
| **PLC** | Dữ liệu đọc trực tiếp từ PLC/SCADA (IIoT, Kepserver). |
| **Tablet** | Operator/QC/Planner nhập trên Tablet/App. |
| **MES** | MES tính toán, sinh, hoặc lưu nội bộ (CSDL MES). |
| **SAP** | Dữ liệu từ SAP (đồng bộ xuống) hoặc ghi lên SAP. |
| **PLC → API** | PLC/Node-RED gửi qua REST API vào MES. |
| **Tablet → MES** | Tablet gửi qua API, MES lưu vào CSDL. |
| **SAP → MES** | SAP đồng bộ xuống MES (lệnh, BOM, master). |
| **MES → SAP** | MES đẩy dữ liệu lên SAP (confirmation, material doc). |
| **PLC → Tablet** | Giá trị từ PLC hiển thị/điền sẵn trên Tablet (read-only). |
| **SAP → MES → Tablet** | SAP xuống MES, Tablet đọc từ MES. |

*Một tag có thể có nhiều nguồn (ví dụ: vừa Tablet→MES vừa MES→SAP). Ghi đầy đủ các luồng áp dụng.*

---

## 2. Lệnh sản xuất (Order)

| Tagname | Kiểu dữ liệu | Nguồn dữ liệu | Mô tả |
| ------- | ------------- | ------------- | ----- |
| `{Machine}_OrderId` | VARCHAR(100) | SAP→MES; PLC→API (khi dispatch) | Mã đơn hàng |
| `{Machine}_OrderName` | VARCHAR(255) | SAP→MES; Tablet→MES (khi gán lệnh) | Tên lệnh |
| `{Machine}_OrderCode` | VARCHAR(100) | SAP→MES | Mã đơn (SAP/ERP) |
| `{Machine}_ProductName` | VARCHAR(255) | SAP→MES; PLC→API | Tên sản phẩm |
| `{Machine}_MaterialCode` | VARCHAR(50) | SAP→MES; PLC→API | Mã vật tư |
| `{Machine}_CustomerName` | VARCHAR(255) | SAP→MES | Tên công ty đối tác |
| `Order_StartTime` | TIMESTAMPTZ | Tablet→MES (bấm Start) | Thời gian bắt đầu |
| `Order_EndTime` | TIMESTAMPTZ | Tablet→MES (bấm End) | Thời gian hoàn thành |
| `Order_Status` | VARCHAR(50) | Tablet→MES; PLC→API; MES→SAP | running, completed, interrupted, cancelled |
| `Order_ProducedLength` | DECIMAL(12,2) | MES (tính từ length events) | Chiều dài đã sản xuất |
| `Order_TargetLength` | DECIMAL(12,2) | SAP→MES; Tablet→MES (Planner) | Chiều dài mục tiêu |
| `Order_Duration` | VARCHAR(50) | MES (tính từ Start/End) | Thời lượng (chuỗi hiển thị) |
| `Order_QRScanTime` | TIMESTAMPTZ | Tablet→MES (quét QR) | Thời điểm quét QR |
| `Order_QRScanBy` | VARCHAR(255) | Tablet→MES (user đăng nhập) | Người quét QR |
| `Order_PlannedLength` | DECIMAL(12,2) | SAP→MES; Tablet→MES (Planner) | Chiều dài kế hoạch |
| `Order_SalesOrderId` | VARCHAR(100) | SAP→MES | Số đơn hàng/Hợp đồng (SAP) |
| `Order_LineItem` | VARCHAR(50) | SAP→MES | Line Item (SAP) |
| `Order_ProductionOrderYear` | INTEGER | SAP→MES | Năm phiếu DNSX |
| `Order_ProductionProposalId` | VARCHAR(100) | SAP→MES | Phiếu Đề nghị sản xuất |

---

## 3. Trạng thái máy & chiều dài (Machine)

| Tagname | Kiểu dữ liệu | Nguồn dữ liệu | Mô tả |
| ------- | ------------- | ------------- | ----- |
| `{Machine}_Status` | VARCHAR(50) | PLC→API | running, idle, warning, error, stopped, setup |
| `{Machine}_LineSpeed` | DECIMAL(10,2) | PLC→API | Tốc độ dây chuyền (m/min hoặc m/s) |
| `{Machine}_TargetSpeed` | DECIMAL(10,2) | PLC→API; Tablet→MES (recipe) | Tốc độ mục tiêu |
| `{Machine}_LengthCounter` | DECIMAL(12,2) | PLC→API | Bộ đếm chiều dài (PLC) |
| `{Machine}_LengthCounterLast` | DECIMAL(12,2) | MES (ghi từ counter trước) | Giá trị counter trước (delta) |
| `{Machine}_LengthCounterLastAt` | TIMESTAMPTZ | MES | Thời điểm counter trước |
| `{Machine}_ProducedLength` | DECIMAL(12,2) | MES (tính từ length events) | Chiều dài sản xuất |
| `{Machine}_TargetLength` | DECIMAL(12,2) | SAP→MES; Tablet→MES | Chiều dài mục tiêu lệnh |
| `{Machine}_CurrentShiftId` | VARCHAR(50) | MES (tính từ thời điểm) | ID ca hiện tại |
| `{Machine}_CurrentShiftStart` | TIMESTAMPTZ | MES (bảng shifts) | Bắt đầu ca |
| `{Machine}_CurrentShiftEnd` | TIMESTAMPTZ | MES (bảng shifts) | Kết thúc ca |

---

## 4. Operator & Ca (Tablet)

| Tagname | Kiểu dữ liệu | Nguồn dữ liệu | Mô tả |
| ------- | ------------- | ------------- | ----- |
| `{Machine}_OperatorName` | VARCHAR(255) | Tablet→MES | Tên công nhân vận hành |
| `{Machine}_OperatorMain` | VARCHAR(255) | Tablet→MES (Planner/Tablet; không đẩy SAP) | Công nhân vận hành chính |
| `{Machine}_OperatorAux` | VARCHAR(255) | Tablet→MES (Planner/Tablet; không đẩy SAP) | Công nhân vận hành phụ |
| `Shift_HandoverTime` | TIMESTAMPTZ | Tablet→MES (bấm bàn giao ca) | Thời gian bàn giao ca |
| `Shift_HandoverBy` | VARCHAR(255) | Tablet→MES | Người bàn giao ca |
| `Shift_ReceivedBy` | VARCHAR(255) | Tablet→MES | Người nhận ca |
| `Shift_HandoverNotes` | TEXT | Tablet→MES | Ghi chú bàn giao ca |

---

## 5. Cuộn / Bobbin / PKT (Coil)

| Tagname | Kiểu dữ liệu | Nguồn dữ liệu | Mô tả |
| ------- | ------------- | ------------- | ----- |
| `{Machine}_CoilId` | VARCHAR(50) | PLC→API; Tablet→MES (bắt đầu/kết thúc cuộn) | ID cuộn sản phẩm |
| `{Machine}_CoilLength` | DECIMAL(12,2) | PLC→API; MES (tính) | Chiều dài cuộn (m) |
| `{Machine}_CoilWeight` | DECIMAL(12,3) | PLC→API (cân); Tablet→MES (nhập tay) | Khối lượng cuộn (kg) |
| `{Machine}_BobbinId` | VARCHAR(50) | Tablet→MES; PLC→API (quét) | ID bobbin (ống chỉ) |
| `{Machine}_BobbinWeight` | DECIMAL(12,3) | Tablet→MES; PLC→API (cân) | Trọng lượng bobbin (kg) |
| `{Machine}_PktIn` | VARCHAR(50) | Tablet→MES; PLC→API (quét) | Mã cuộn/bobbin đầu vào |
| `{Machine}_PktOut` | VARCHAR(50) | Tablet→MES; PLC→API (quét) | Mã cuộn/bobbin đầu ra |
| `{Machine}_WeightNet` | DECIMAL(12,3) | Tablet→MES (cân); MES→SAP | Khối lượng tinh (kg) – SAP |
| `{Machine}_WeightGross` | DECIMAL(12,3) | Tablet→MES (cân); MES→SAP | Khối lượng tổng (kg) – SAP |
| `{Machine}_SampleCode` | VARCHAR(50) | Tablet→MES (QC); SAP→MES | Mã sample – SAP |
| `{Machine}_BatchNumber` | VARCHAR(50) | Tablet→MES; SAP→MES | Batch number |
| `{Machine}_Notes` | TEXT | Tablet→MES | Ghi chú |

---

## 6. Downtime & Sự kiện (Event)

| Tagname | Kiểu dữ liệu | Nguồn dữ liệu | Mô tả |
| ------- | ------------- | ------------- | ----- |
| `Downtime_Event` | VARCHAR(50) | Tablet→MES (chọn reason); PLC→API (mã event) | Mã sự kiện dừng máy |
| `Downtime_Reason` | VARCHAR(100) / INT (FK) | Tablet→MES (chọn từ reason_codes) | Nguyên nhân dừng máy |
| `Event_Code` | VARCHAR(50) | Tablet→MES; PLC→API | START, STOP, CHANGEOVER, … |
| `event_time` | TIMESTAMPTZ | Tablet→MES; PLC→API | Thời điểm sự kiện |
| `entered_by` | VARCHAR(255) | Tablet→MES (user đăng nhập) | Người nhập |

---

## 7. Chất lượng (Quality)

| Tagname | Kiểu dữ liệu | Nguồn dữ liệu | Mô tả |
| ------- | ------------- | ------------- | ----- |
| `{Machine}_ProducedLengthOK` | DECIMAL(12,2) | PLC→API; MES (tính) | Chiều dài OK |
| `{Machine}_ProducedLengthNG` | DECIMAL(12,2) | PLC→API; Tablet→MES (QC) | Chiều dài NG (phế phẩm) |
| `Q_Drw_WDia` | DECIMAL(12,4) | Tablet→MES (QC); PLC→API (nếu có đo) | Đường kính dây (Drawing) |
| `Q_Drw_DiaDev` | DECIMAL(12,4) | Tablet→MES; MES (SPC) | Sai lệch đường kính |
| `Q_Drw_WBreak` | INTEGER | PLC→API; Tablet→MES | Số lần đứt dây/ca |
| `Q_Drw_Rdc20` | DECIMAL(12,4) | Tablet→MES (QC); thiết bị đo | Điện trở DC @ 20°C |
| `Q_Drw_Tens` | DECIMAL(12,4) | Tablet→MES (QC) | Độ bền kéo |
| `Q_Drw_Elong` | DECIMAL(12,4) | Tablet→MES (QC) | Độ giãn dài |
| QC Result (OK/NG) | VARCHAR(10) | Tablet→MES | Pass/Fail – OK hay NG |

---

## 8. SAP – Nhận từ SAP / Gửi lên SAP

| Tagname | Kiểu dữ liệu | Nguồn dữ liệu | Mô tả |
| ------- | ------------- | ------------- | ----- |
| `Order_SapOrderId` | VARCHAR(100) | SAP→MES | Mã lệnh sản xuất SAP |
| `{Machine}_MaterialCode` | VARCHAR(50) | SAP→MES (Material Master) | Mã vật tư SAP |
| `{Order}_MaterialBom` | TEXT/JSON | SAP→MES (BOM) | BOM định mức vật tư |
| `{Order}_MaterialConsumed` | DECIMAL(12,3) | MES→SAP (MIGO) | Vật tư tiêu hao thực tế |
| `Order_ConfirmationStatus` | VARCHAR(50) | MES→SAP; SAP→MES | Trạng thái xác nhận sản xuất |
| `Order_SyncToSapAt` | TIMESTAMPTZ | MES (ghi khi gửi) | Thời điểm đồng bộ lên SAP |
| `Order_SyncToSapStatus` | VARCHAR(50) | MES | success, pending, failed |
| `{Machine}_WeightNet` | DECIMAL(12,3) | Tablet→MES; MES→SAP | Khối lượng tinh – SAP |
| `{Machine}_WeightGross` | DECIMAL(12,3) | Tablet→MES; MES→SAP | Khối lượng tổng – SAP |
| `{Machine}_CoilId` | VARCHAR(50) | MES→SAP (khi đóng cuộn) | ID cuộn gửi SAP |
| `Order_ScrapToSap` | BOOLEAN/TEXT | MES→SAP | Báo phế phẩm lên SAP |
| `(Order)_SalesOrderId` | VARCHAR(100) | SAP→MES | Số đơn hàng/Hợp đồng |
| `(Order)_LineItem` | VARCHAR(50) | SAP→MES | Line Item (SAP) |
| `(Order)_ProductionOrderYear` | INTEGER | SAP→MES | Năm phiếu DNSX |
| `(Order)_ProductionProposalId` | VARCHAR(100) | SAP→MES | Phiếu Đề nghị sản xuất |
| `(Order)_CustomerName` | VARCHAR(255) | SAP→MES | Tên công ty đối tác |

---

## 9. OEE & KPI (MES tính)

| Tagname | Kiểu dữ liệu | Nguồn dữ liệu | Mô tả |
| ------- | ------------- | ------------- | ----- |
| `{Machine}_OEE` | DECIMAL(5,2) | MES (tính từ A×P×Q) | OEE tổng (%) |
| `{Machine}_Availability` | DECIMAL(5,2) | MES (từ runtime, downtime) | Hệ số A (%) |
| `{Machine}_Performance` | DECIMAL(5,2) | MES (từ speed, target) | Hệ số P (%) |
| `{Machine}_Quality` | DECIMAL(5,2) | MES (từ OK/NG length) | Hệ số Q (%) |

---

## 10. Đề xuất bổ sung (Tablet / MES / SAP) 🆕

*Các hạng mục dưới đây đề xuất thêm cho Tablet, MES và SAP. Trong file Excel, các dòng tương ứng được **tô màu vàng** để dễ nhận biết.*

| Tagname | Kiểu dữ liệu | Nguồn dữ liệu | Mô tả | Ghi chú |
| ------- | ------------- | ------------- | ----- | ------- |
| `Order_SapOrderId` | VARCHAR(100) | SAP→MES | Mã lệnh sản xuất SAP | 🆕 Đề xuất |
| `Order_ConfirmationStatus` | VARCHAR(50) | MES→SAP; SAP→MES | Trạng thái xác nhận sản xuất | 🆕 Đề xuất |
| `Order_SyncToSapAt` | TIMESTAMPTZ | MES | Thời điểm đồng bộ lên SAP | 🆕 Đề xuất |
| `Order_SyncToSapStatus` | VARCHAR(50) | MES | success, pending, failed | 🆕 Đề xuất |
| `Order_ScrapToSap` | BOOLEAN/TEXT | MES→SAP | Báo phế phẩm lên SAP | 🆕 Đề xuất |
| `{Order}_MaterialBom` | TEXT/JSON | SAP→MES (BOM) | BOM định mức vật tư | 🆕 Đề xuất |
| `{Machine}_CurrentShiftStart` | TIMESTAMPTZ | MES (bảng shifts) | Bắt đầu ca hiện tại | 🆕 Đề xuất |
| `{Machine}_CurrentShiftEnd` | TIMESTAMPTZ | MES (bảng shifts) | Kết thúc ca hiện tại | 🆕 Đề xuất |
| `{Machine}_CoilLength` | DECIMAL(12,2) | PLC→API; MES (tính) | Chiều dài cuộn (m) | 🆕 Đề xuất |
| `{Machine}_CoilWeight` | DECIMAL(12,3) | PLC→API; Tablet→MES | Khối lượng cuộn (kg) | 🆕 Đề xuất |
| `Downtime_Reason` | VARCHAR(100) / INT (FK) | Tablet→MES | Nguyên nhân dừng máy (mã) | 🆕 Đề xuất |
| `event_time` | TIMESTAMPTZ | Tablet→MES; PLC→API | Thời điểm sự kiện | 🆕 Đề xuất |
| `entered_by` | VARCHAR(255) | Tablet→MES | Người nhập (user đăng nhập) | 🆕 Đề xuất |
| `Order_RealTime` | TIMESTAMPTZ | Tablet→MES | Thời gian thực (hiển thị) | 🆕 Đề xuất |
| `Order_ORScanTime` | TIMESTAMPTZ | Tablet→MES | Thời điểm quét OR | 🆕 Đề xuất |
| `Order_ORScanBy` | VARCHAR(255) | Tablet→MES | Người quét OR | 🆕 Đề xuất |

---

*Tài liệu tham khảo: MES_TAG_NAMING_STANDARD.md (mục 2–9), MES_TAG_NAME_SHOPFLOOR.md (mục 2 Tóm tắt, mục 3.1–3.9).*
