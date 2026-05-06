# Đề xuất cân trọng lượng tinh – Ngành dây cáp điện

**Mục đích:** Tham chiếu cách cân **trọng lượng tinh** (WeightNet) và **trọng lượng tổng** (WeightGross) trong sản xuất dây cáp điện, cùng thiết bị cân thực tế có thể dùng và tích hợp MES/SAP.

---

## 1. Trọng lượng tinh (Net) vs Trọng lượng tổng (Gross)

| Khái niệm | Ý nghĩa | Dùng khi nào |
| --------- | ------- | ------------- |
| **WeightGross** (trọng lượng tổng) | Cả cuộn dây + turê/bobbin (ống chỉ, lõi cuộn) | Cân trực tiếp cuộn đặt lên cân |
| **WeightNet** (trọng lượng tinh) | Chỉ khối lượng dây (đồng/nhôm), đã trừ bì | Báo cáo sản lượng, SAP (material doc), định mức |

**Công thức:**  
**WeightNet = WeightGross − Tare**  
Trong đó **Tare** = trọng lượng turê/bobbin (cân khi chưa quấn dây, hoặc tra từ danh mục turê).

---

## 2. Đề xuất cách cân cho chuyên ngành dây cáp điện

### 2.1. Cân khi đóng cuộn (sau khi quấn xong)

- **Bước 1:** Cân **cuộn hoàn chỉnh** (dây + turê) → ghi nhận **WeightGross**.
- **Bước 2:** Lấy **Tare** bằng một trong hai cách:
  - **Cách A – Cân turê trống:** Trước khi quấn, cân turê/bobbin trống (cùng loại) → Tare. Lưu Tare theo từng loại turê (BobbinType) trong MES.
  - **Cách B – Tare trên cân:** Đặt turê trống lên cân → nhấn **TARE** → cân về 0 → sau đó quấn dây và cân lại; số hiển thị chính là WeightNet (một số cân hỗ trợ cả Gross + Net).
- **Bước 3:** **WeightNet = WeightGross − Tare** (nếu dùng Cách A).

**Đề xuất vị trí cân:**

- **Tại máy quấn / bàn tháo cuộn:** Cân sàn hoặc cân bàn đặt cố định, công nhân đưa cuộn lên cân khi kết thúc cuộn (hoặc trước khi xuất vị trí).
- **Tại điểm tập kết / QC:** Một trạm cân chung cho nhiều máy, cân trước khi đóng gói hoặc nhập kho.

### 2.2. Tích hợp với MES / Tablet

- **Tự động:** Cân có **RS232, USB hoặc Ethernet** → gửi Gross (và nếu có, Net) lên PLC/Node-RED/API → MES lưu `WeightGross`, `WeightNet` (tính từ Gross − Tare theo `BobbinType`).
- **Bán tự động:** Công nhân cân xong, nhập Gross (và/hoặc Net) trên **Tablet** → Tablet→MES; MES có thể tính Net nếu đã có Tare theo loại turê.
- **Thủ công:** Nhập tay Gross và Net (hoặc Gross + chọn loại turê để MES tính Net) trên Tablet.

---

## 3. Thiết bị cân thực tế có thể dùng

### 3.1. Cân điện tử cuộn dây (dây đồng, dây cáp)

Các thiết bị **có sẵn trên thị trường**, phù hợp cuộn dây kim loại (đồng, nhôm) và dây cáp:

| Đặc điểm | Mô tả |
| -------- | ----- |
| **Tải trọng** | Thường **100–300 kg** (cuộn dây đồng/cáp); có dòng lên **500–1000 kg** cho cuộn lớn. |
| **Độ chính xác** | Sai số phổ biến **±10 g** đến **±50 g** tùy model; cân kỹ thuật có thể ±10 g. |
| **Chức năng TARE** | Có sẵn: cân trừ bì (đặt turê trống lên, nhấn TARE → 0, sau đó cân cuộn = Net). |
| **Mặt cân** | **Mặt lõm / chống trượt** để cuộn tròn không lăn; kích thước ví dụ 50×70 cm trở lên. |
| **Kết nối** | **RS232, USB, Bluetooth** → dễ đọc số liệu tự động, tích hợp in phiếu hoặc gửi API/PLC. |
| **Chuẩn** | Loadcell OIML, có CO/CQ, kiểm định (nếu cần hồ sơ pháp lý). |

**Ví dụ model / nhà cung cấp (tham khảo):**

- **Cân điện tử cuộn dây đồng** (Cân Thiên Ý, Việt Scales, v.v.): tải 200–300 kg, mặt lõm, RS232/USB, TARE, dùng tại xưởng cuốn dây, kho xuất hàng, QC.
- **Ohaus Defender 3000**, **Excell DSB-200**, **A12E Yaohua 200 kg**, **JWI-700W 300 kg**: các dòng cân bàn/sàn cho cuộn kim loại, có kết nối máy tính in phiếu.

### 3.2. Cân tích hợp dây chuyền (tự động hóa cao)

- **Cân băng tải (belt scale)** hoặc **cân trục**: đo khối lượng dòng vật liệu (ví dụ nguyên liệu đầu vào); ít dùng trực tiếp cho “cân cuộn thành phẩm” nhưng có thể dùng ở công đoạn khác (định lượng, loss-in-weight).
- **Loadcell gắn trên giá đỡ cuộn:** Một số máy quấn/cáp có thể tích hợp loadcell dưới giá đỡ turê → đo tải trọng liên tục; khi kết thúc cuộn, lấy Gross; nếu đã lưu Tare theo loại turê → tính Net và đẩy vào MES/PLC.
- **Giải pháp “reel/drum weighing”:** Thiết bị cân cuộn (reel/drum) tải đến **800–1000 kg**, dùng trong nhà máy cáp/dây (ví dụ máy feeder cuộn 1000 kg, có thông số tải trọng). Có thể kết hợp với PLC để ghi Gross/Net theo từng cuộn.

### 3.3. Tóm tắt: Có thiết bị cân được không?

**Có.** Trong thực tế ngành dây cáp điện đang dùng:

1. **Cân sàn / cân bàn điện tử** chuyên cuộn dây (100–300 kg, TARE, mặt lõm, RS232/USB) – phổ biến nhất cho **cân từng cuộn** khi đóng cuộn hoặc tại kho/QC.
2. **Cân có kết nối** (RS232, Ethernet, API) để **tự động hoặc bán tự động** đưa Gross/Net vào MES và lên SAP.
3. **Loadcell** gắn tại giá cuộn hoặc tích hợp vào máy quấn (tùy dây chuyền) cho giải pháp **tự động hóa cao**.

---

## 4. Gợi ý luồng dữ liệu MES/SAP

- **Tablet / PLC → MES:**  
  `WeightGross`, `WeightNet` (hoặc chỉ Gross + MES tự tính Net từ Tare theo `BobbinType`), gắn với `CoilId`, `OrderId`, `Machine`.
- **MES → SAP:**  
  Khi đóng cuộn / xác nhận lệnh: gửi **WeightNet**, **WeightGross** (và thông tin cuộn, lô) cho Production Confirmation / Material Document (MIGO) theo chuẩn tag đã định nghĩa (`{Machine}_WeightNet`, `{Machine}_WeightGross`).

---

## 5. Tài liệu tham khảo trong project

- **Tag & nguồn dữ liệu:** `MES_TAG_TABLET_MES_SAP_SOURCE.md` (mục 5 Cuộn/Bobbin/PKT, mục 8 SAP).
- **Chuẩn tên tag:** `MES_TAG_NAMING_STANDARD.md` (`WeightNet`, `WeightGross`, `coils`).
- **Tóm tắt Shopfloor:** `MES_TAG_NAME_SHOPFLOOR.md` (Tablet: WeightNet, WeightGross khi có cân).

---

*Tài liệu đề xuất kỹ thuật – cần rà soát lại theo thiết bị và quy trình thực tế tại nhà máy.*
