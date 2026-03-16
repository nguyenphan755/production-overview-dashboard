# MES_TAG_NAME_SHOPFLOOR.md

**Phiên bản:** 0.1  
**Mục đích:** Gom và chuẩn hóa danh sách **tagname tầng Shopfloor (IIoT)** theo từng cụm máy, đồng thời phân loại **nguồn/hệ thống**: PLC, Tablet, MES, SAP – để dễ trao đổi với đối tác và đội vận hành.

---

## 1. Phạm vi & liên kết tài liệu

- Tập trung vào **tag Shopfloor/IIoT** đang dùng trong file `MES_Tagname_Mapping_IIoT_Shopfloor_v1.0.xlsx`.
- Tham chiếu quy ước chung trong `MES_TAG_NAMING_STANDARD.md`:
  - Cấu trúc Plant/Area/Machine/Parameter.
  - Bảng **Nguồn dữ liệu (Data Source)** – mục 1.4.
  - Phân loại **SAP  MES  Tablet** – mục 8.5.
- Tài liệu này **không lặp lại toàn bộ chi tiết CSDL**, mà tập trung:
  - Liệt kê **cụm máy** (machine cluster) theo Shopfloor.
  - Với mỗi cụm máy, liệt kê **tag Shopfloor chính** và gắn nhãn:
    - **PLC** – đọc trực tiếp từ máy (IIoT, Kepserver/Node-RED).
    - **Tablet** – nhập tại chỗ (operator, QC, Planner).
    - **MES** – do MES sinh/tính/lưu (không hiện ở PLC).
    - **SAP** – có luồng đồng bộ với SAP (đọc hoặc ghi).

---

## 2. Tóm tắt mục cần nhập – Tablet | MES | SAP

Bảng dưới tóm gọn **ai nhập / ai lưu / ai đồng bộ** gì. Chi tiết từng tag theo cụm máy xem các mục 3.1–3.9.

| Hệ thống | Mục cần nhập / nguồn dữ liệu |
| -------- | ---------------------------- |
| **Tablet** | **Lệnh:** Start/End lệnh, trạng thái lệnh, quét QR phiếu lệnh (thời điểm, người quét). **Operator:** Tên CNVH, CNVH chính, CNVH phụ (Planner/Tablet gán; lưu MES, không đẩy SAP). **Ca:** Bàn giao ca (thời gian, người bàn giao, người nhận, ghi chú). **Downtime / Sự kiện:** Mã event (START/STOP/CHANGEOVER…), lý do dừng máy (reason), thời điểm. **Cuộn/Bobbin/PKT:** ID cuộn, ID bobbin, loại turê, trọng lượng bobbin; PktIn/PktOut; khi có cân: WeightNet, WeightGross; SampleCode, ghi chú. **Chất lượng:** Kết quả QC (OK/NG), defect, NCR; các giá trị Q_* nhập tay nếu không có thiết bị đo. **Khác:** Action plan, kiểm kê tồn kho (người đếm, số lượng), yêu cầu bảo trì. |
| **MES** | **Không nhập tay** (trừ cấu hình danh mục). MES **nhận** từ PLC/API: trạng thái máy, tốc độ, length counter, alarm. **Tính/lưu:** OEE, Availability, Performance, Quality; chiều dài sản xuất theo lệnh/cuộn; ID ca hiện tại; đối soát tồn kho; thời điểm server, sinh ID. **Lưu** dữ liệu từ Tablet và SAP sau khi xử lý. |
| **SAP** | **Nhận từ SAP (không nhập trên Tablet):** Lệnh sản xuất (OrderId, OrderCode, TargetLength, SalesOrderId, LineItem, ProductionOrderYear, ProductionProposalId); BOM / định mức vật tư; Material Master; Work center; ca/lịch (nếu lấy từ SAP). **Gửi lên SAP:** Xác nhận sản xuất (ProducedLength, StartTime, EndTime, WeightNet, WeightGross, SampleCode); chứng từ vật tư (Material Document / MIGO); báo phế phẩm; trạng thái lệnh (ConfirmationStatus, SyncToSapAt, SyncToSapStatus). *Operator chính/phụ chỉ lưu MES, không đồng bộ lên SAP.* |

---

## 3. Danh sách cụm máy (theo sheet Excel)

Các cụm máy (group) tương ứng với từng sheet trong file Excel:

- `I.Group_Drawing`
- `II.Group_Stranding`
- `III.Group_Armoring`
- `IV.Group_Extrusion`
- `V.Group_Furnace`
- `VI.Group_Pelletizing`
- `VII.Group.CuringBath`
- `VIII. Group_Tin_Plating`
- `XX.Group_Energy`

Trong mỗi mục cụ thể:

- **PLC (Shopfloor/IIoT)**: giữ nguyên tag/UDT như trong Excel (không chỉnh sửa tại đây).
- **Tablet**: tag/operator nhập từ Tablet (theo chuẩn `MES_TAG_NAMING_STANDARD.md`).
- **MES**: tag được lưu/tính trong CSDL MES.
- **SAP**: tag có luồng đồng bộ với SAP.

---

## 3.1 I.Group_Drawing – Cụm máy kéo (Drawing)

**Mô tả:** Cụm máy kéo nhôm/copper (RBD, Multi-wire, Medium), cung cấp các tham số tốc độ line, tốc độ tối đa, dòng kéo, chiều dài, trạng thái line… qua các UDT như `UDT_Drawing_Alumium`, `UDT_Drawing_SingleAlumium`, `UDT_Drawing_Copper_RBDAndMultiWire`, `UDT_Drawing_Medium`.

### 3.1.1 PLC – Tag/UDT Shopfloor

**Nguồn:** Sheet `I.Group_Drawing` trong file `MES_Tagname_Mapping_IIoT_Shopfloor_v1.0.xlsx`.

**Danh sách tag PLC chính (trích từ Excel – giữ nguyên tên):**

- `Line.MaxSpeed`, `Line.SpSpeed`, `Line.ActSpeed`, `Line.ToltalRuntime`, `Line.Runtime`
- `Length.SpTotal`, `Length.ActTotal`, `Runtime.Remaining`
- `Drawing.DieNo`, `Drawing.SlipPct`, `Drawing.ActSpeed`, `Drawing.ActCurrent`, `Drawing.Dia`
- `Capstan.ActSpeed`, `Capstan.ActCurrent`
- `SpoolerA.ActSpeed`, `SpoolerB.ActSpeed`
- `Cooling.DrawingWater.SpTemp`, `Cooling.DrawingWater.ActTemp`
- `Cooling.DrawingGearbox.SpTemp`, `Cooling.DrawingGearbox.ActTemp`
- `Cmd.StartLine`, `Cmd.StartDrawing`, `Cmd.StartCapstan`, `Cmd.StartSpoolerA`, `Cmd.StartSpoolerB`, `Cmd_StartAnnealer`
- `Sts.Fault`
- `Context.MachineID`, `Context.ProductCode`, `Context.OrderID`, `Context.MachineType`, `Context.MachineStatus`
- `Context.Speed.Optimized`, `Context.SnapshotReason`, `Context.SnapshotCounter`
- `Context.MainEmployeeID`, `Context.SubEmployeeID`
- `Context.DiaIn`, `Context.DiaOut`, `Context.PKTIN`, `Context.PKTOUT`
- `Context.Spare1`…`Context.Spare5`
- `Drawing1.ActSpeed`…`Drawing13.ActSpeed`
- `Drawing1.ActCurrent`…`Drawing13.ActCurrent`
- `Annealing.SpOutputPct`, `Annealing.ActVoltage`, `Annealing.ActCurrent`, `Annealing.ActOutputPct`
- `Coiler.ActSpeed`
- `Cooling.AnnealerWater.ActTemp`, `Cooling.AnnealerSoftWater.ActTemp`
- `Transformer.R.ActValue`, `Transformer.S.ActValue`, `Transformer.T.ActValue`

> **Ghi chú:** Toàn bộ các field trên nằm trong các UDT như `UDT_Drawing_Alumium`, `UDT_Drawing_SingleAlumium`, `UDT_Drawing_Copper_RBDAndMultiWire`, `UDT_Drawing_Medium` trong file Excel gốc. Khi mapping sang tag MES, dùng bảng mapping để gắn đúng `{Plant}_{Area}_{Machine}`.

> **Nguyên tắc:** Mọi đổi tên/chuẩn hóa sang tag MES/API thực hiện trong `MES_TAG_NAMING_STANDARD.md` và `config/mes-tag-mapping.json`. File này chỉ tham chiếu, **không thay đổi tag PLC**.

### 3.1.2 Tablet – Tag/operator nhập tại chỗ

Nhóm này áp dụng chung cho các máy Drawing, theo chuẩn phần **Production / Event / Shift / Quality** trong `MES_TAG_NAMING_STANDARD.md` và là nguồn dữ liệu thao tác thực tế cho các chỉ số **Analytics** ở **mục 5** của tài liệu đó.


| Tagname                              | Nhóm       | Mô tả ngắn                                          | Ghi chú tích hợp                          |
| ------------------------------------ | ---------- | --------------------------------------------------- | ----------------------------------------- |
| `Order_StartTime`                    | Order      | Thời điểm operator bấm **Start** lệnh trên Tablet   | POST/PUT `/api/orders/:id` từ Tablet      |
| `Order_EndTime`                      | Order      | Thời điểm operator bấm **End** lệnh trên Tablet     | Đóng lệnh hoặc kết thúc ca                |
| `Order_Status`                       | Order      | Trạng thái lệnh: `running`, `completed`, …          | Tablet/PLC cập nhật qua API               |
| `Order_QRScanTime`                   | Order / QR | Thời điểm quét QR phiếu lệnh                        | `order_scans.scan_time` – Tablet QR       |
| `Order_QRScanBy`                     | Order / QR | Người quét QR                                       | User đăng nhập Tablet                     |
| `{Machine}_OperatorName`             | Machine    | Tên công nhân vận hành                              | Tablet nhập; lưu `machines.operator_name` |
| `{Machine}_OperatorMain`             | Machine    | Công nhân vận hành chính                            | Planner/Tablet; không đẩy SAP             |
| `{Machine}_OperatorAux`              | Machine    | Công nhân vận hành phụ                              | Planner/Tablet; không đẩy SAP             |
| `Shift_HandoverTime`                 | Shift      | Thời gian bàn giao ca tại máy Drawing               | POST `/api/shifts/:shiftId/handover`      |
| `Shift_HandoverBy`                   | Shift      | Người bàn giao ca                                   | User Tablet                               |
| `Shift_ReceivedBy`                   | Shift      | Người nhận ca                                       | User Tablet                               |
| `Shift_HandoverNotes`                | Shift      | Ghi chú bàn giao ca (tồn tại, sự cố, chất lượng, …) | Text trên Tablet                          |
| `Downtime_Event` (`/api/downtime`)   | Downtime   | Sự kiện dừng máy: mã event, reason, thời điểm       | Tablet chọn reason_codes, nhập notes      |
| `Event_Code` (`/api/events`)         | Event      | Mã sự kiện sản xuất (START/STOP/CHANGEOVER/…)       | Tablet/PLC gửi                            |
| QC input theo Drawing (nếu nhập tay) | Quality    | Các giá trị Q_Raw_*, Q_Drw_* nhập trực tiếp         | Có thể nhập từ Tablet QC hoặc màn hình    |


### 3.1.3 MES – Tag lưu/tính trong CSDL MES

Các tag này lấy dữ liệu từ PLC + Tablet để tính toán và lưu trữ; áp dụng cho cụm Drawing.


| Tagname                                                           | Bảng CSDL                     | Mô tả                                         | Nguồn dữ liệu (tóm tắt)        |
| ----------------------------------------------------------------- | ----------------------------- | --------------------------------------------- | ------------------------------ |
| `{Machine}_Status`                                                | `machines.status`             | Trạng thái máy kéo (running/idle/error/…)     | PLC → Kepserver → API PUT      |
| `{Machine}_LineSpeed`                                             | `machines.line_speed`         | Tốc độ line hiện tại (m/s hoặc m/min)         | PLC                            |
| `{Machine}_TargetSpeed`                                           | `machines.target_speed`       | Tốc độ mục tiêu                               | Recipe/Tablet/API              |
| `{Machine}_LengthCounter`                                         | `machines.length_counter`     | Bộ đếm chiều dài máy kéo                      | PLC                            |
| `{Machine}_ProducedLength`                                        | `machines.produced_length`    | Chiều dài đã sản xuất trên máy Drawing        | MES tính từ length events      |
| `{Machine}_ProducedLengthOK`                                      | `machines.produced_length_ok` | Chiều dài OK                                  | PLC/API hoặc MES tính          |
| `{Machine}_ProducedLengthNG`                                      | `machines.produced_length_ng` | Chiều dài NG (phế)                            | PLC/API hoặc nhập QC           |
| `{Machine}_CurrentShiftId`                                        | `machines.current_shift_id`   | ID ca hiện tại                                | MES tính từ cấu hình ca        |
| `{Machine}_HealthScore`                                           | `machine_metrics` / view      | Điểm sức khỏe máy (vibration, alarm, runtime) | MES tính từ metrics            |
| `Order_ProducedLength`                                            | `production_orders`           | Tổng chiều dài lệnh được sản xuất             | MES cộng từ length events      |
| `Order_TargetLength`                                              | `production_orders`           | Chiều dài mục tiêu của lệnh Drawing           | SAP/Planner                    |
| `Order_Duration`                                                  | `production_orders`           | Thời lượng thực hiện lệnh                     | MES tính từ Start/End          |
| `OEE_Availability`, `OEE_Performance`, `OEE_Quality`, `OEE_Total` | `kpi_aggregates` / view       | OEE cho máy/cụm Drawing theo ca/ngày          | MES tính từ runtime, speed, NG |
| `Shift_`* (id, start, end, …)                                     | `shifts`                      | Thông tin ca làm cho toàn cụm Drawing         | MES/Tablet                     |
| `Coils_*` (coil_id, length, weight_net/gross, …)                  | `coils`                       | Thông tin cuộn đơn dây (raw / sau Drawing)    | PLC + cân + Tablet             |


### 3.1.4 SAP – Tag/Trường có đồng bộ với SAP

Nhóm này mô tả những trường trong Drawing có liên quan đến lệnh SAP, BOM và xác nhận sản xuất.


| Tagname / Trường           | Ý nghĩa SAP                               | Luồng đồng bộ                        |
| -------------------------- | ----------------------------------------- | ------------------------------------ |
| `Order_SapOrderId`         | Mã lệnh sản xuất SAP                      | SAP → MES (khi release lệnh)         |
| `{Machine}_OrderId`        | Mã lệnh gán cho máy kéo                   | SAP → MES (dispatch) và MES hiển thị |
| `{Machine}_MaterialCode`   | Mã vật tư (AL/CU wire) từ SAP             | SAP → MES (BOM / material master)    |
| `Order_TargetLength`       | Số mét cần kéo theo lệnh SAP              | SAP → MES                            |
| `Order_ProducedLength`     | Số mét thực tế đã kéo                     | MES → SAP (confirmation)             |
| `{Coil}_WeightNet`         | Khối lượng tinh cuộn dây (AL/CU)          | MES → SAP (material document)        |
| `{Coil}_WeightGross`       | Khối lượng tổng cuộn dây                  | MES → SAP                            |
| `Order_ConfirmationStatus` | Trạng thái xác nhận sản xuất trên SAP     | Hai chiều (cập nhật trạng thái)      |
| `Order_SyncToSapAt`        | Thời điểm MES gửi xác nhận lên SAP        | MES → SAP                            |
| `Order_SyncToSapStatus`    | Kết quả đồng bộ (success/pending/failed)  | MES ghi                              |
| `{Order}_MaterialBom`      | Thông tin BOM định mức vật tư cho Drawing | SAP → MES                            |
| `{Order}_MaterialConsumed` | Tiêu hao vật tư thực tế (AL/CU) cho lệnh  | MES → SAP (consumption / MIGO)       |


---

## 3.2 II.Group_Stranding – Cụm máy xoắn (Stranding)

**Mô tả:** Cụm máy xoắn ruột dẫn (Stranding) – xoắn nhiều sợi lại với nhau, tạo ruột dẫn cáp. Tham số chính: số sợi, bước xoắn, hướng S/Z, đường kính ruột dẫn, tốc độ line, trạng thái line, lỗi đứt sợi…

### 3.2.1 PLC – Tag/UDT Shopfloor

**Nguồn:** Sheet `II.Group_Stranding` trong file `MES_Tagname_Mapping_IIoT_Shopfloor_v1.0.xlsx`.

**Danh sách tag PLC chính (trích từ Excel – giữ nguyên tên):**

- `Line.MaxSpeed`, `Line.SpSpeed`, `Line.ActSpeed`, `Line.ActBowSpeed`, `Line.ActTwistPerMin`, `Line.ToltalRuntime`, `Line.Runtime`
- `Length.SpTotal`, `Length.ActTotal`, `Runtime.MinutesToFill`
- `Stranding.LayLength`, `Stranding.Strands`, `Stranding.StrandSize`, `Stranding.LayDirection`
- `Reel.InUse`, `Reel.ProducedCount`
- `Spooling.Tension`
- `PayOff.ControlEnable`, `PayOff.WireBreakAlarmEnable`, `PayOff.WireBreakDetected`
- `Cmd.StartLine`, `Cmd.StartCapstan`, `Cmd.StartTakeUp`
- `Sts.Fault`, `Sts.Alarm`
- `Context.MachineID`, `Context.ProductCode`, `Context.OrderID`, `Context.MachineStatus`
- `Context.Speed.Optimized`, `Context.SnapshotReason`, `Context.SnapshotCounter`
- `Context.MainEmployeeID`, `Context.SubEmployeeID`
- `Context.DiaIn`, `Context.DiaOut`, `Context.PKTIN`, `Context.PKTOUT`
- `Context.Spare1`…`Context.Spare5`
- `Line.LayDirection`, `Line.CableDia`, `Line.SpPitch`, `Line.SetMaterial`, `Line.AlineMode`, `Line.SpRef`, `Line.ActRef`, `Line.SpTwist`, `Line.ActTwist`
- `Payoff1.ActSpeed`…`Payoff5.ActSpeed`, `Payoff1.ActCurrent`…`Payoff5.ActCurrent`
- `Payoff1.ActTension`…`Payoff7.ActTension`
- `Drum.SpSpeed`, `Drum.ActSpeed`, `Drum.ActCurrent`
- `Tape1.`*, `Tape2.*`, `MetalTape.*` (MaxSpeed, ActSpeed, ActVpp, ActCurrent, TapeThickness, TapeWidth, ActPitch, Tension, Left, Dia, Overlap, LayDirection, Enable, WireBreakDetected)
- `Capstan.ActSpeed`, `Capstan.ActCurrent`, `Capstan.Power`, `Capstan.Torque`
- `Takeup.ActSpeed`, `Takeup.Power`, `Takeup.Torque`
- `Cmd.StartPayOff1`…`Cmd.StartPayOff7`, `Cmd.StartDrum`, `Cmd.StartTape1`, `Cmd.StartTape2`, `Cmd.StartMetalTape`
- `Bearing1.ActTemp`…`Bearing5.ActTemp`, `Bearing1.ActFlow`…`Bearing5.ActFlow`
- `Cage1.*`, `Cage2.*`, `Cage3.*` (MaxSpeed, MaxVpp, ActSpeed, ActVpp, ActCurrent, InUseBobbin, ActPitch, Tension, LayDirection, Enable, WireBreakDetected)

> **Ghi chú:** Danh sách trên gộp các field thuộc nhiều UDT Stranding trong sheet `II.Group_Stranding`. Khi mapping sang MES, có thể gom theo nhóm: Line, Payoff, Cage, Tape, Capstan, Takeup, Context, v.v.

> **Nguyên tắc:** Giữ nguyên toàn bộ tên UDT/tag PLC như trong sheet Stranding; mapping sang tag MES/API xem trong `MES_TAG_NAMING_STANDARD.md`.

### 3.2.2 Tablet – Tag/operator nhập tại chỗ

Về cơ bản giống Drawing, nhưng tập trung thêm vào thông tin xoắn và chất lượng ruột dẫn.


| Tagname                  | Nhóm       | Mô tả ngắn                                             | Ghi chú tích hợp                     |
| ------------------------ | ---------- | ------------------------------------------------------ | ------------------------------------ |
| `Order_StartTime`        | Order      | Bấm Start lệnh xoắn trên Tablet                        | Giống Drawing                        |
| `Order_EndTime`          | Order      | Bấm End lệnh xoắn trên Tablet                          | Giống Drawing                        |
| `Order_Status`           | Order      | Trạng thái lệnh xoắn                                   | Giống Drawing                        |
| `Order_QRScanTime`       | Order / QR | Thời điểm quét QR phiếu lệnh Stranding                 | Giống Drawing                        |
| `Order_QRScanBy`         | Order / QR | Người quét QR                                          | Giống Drawing                        |
| `{Machine}_OperatorName` | Machine    | Tên công nhân vận hành máy xoắn                        | Tablet nhập                          |
| `{Machine}_OperatorMain` | Machine    | Công nhân vận hành chính                               | Planner/Tablet; không đẩy SAP        |
| `{Machine}_OperatorAux`  | Machine    | Công nhân vận hành phụ                                 | Planner/Tablet; không đẩy SAP        |
| `Shift_HandoverTime`     | Shift      | Bàn giao ca tại cụm Stranding                          | POST `/api/shifts/:shiftId/handover` |
| `Shift_HandoverBy`       | Shift      | Người bàn giao ca                                      | User Tablet                          |
| `Shift_ReceivedBy`       | Shift      | Người nhận ca                                          | User Tablet                          |
| `Shift_HandoverNotes`    | Shift      | Ghi chú bàn giao ca (tồn cuộn, sự cố xoắn, chất lượng) | Text trên Tablet                     |
| `Downtime_Event`         | Downtime   | Dừng máy (đứt sợi, lỗi cấp sợi, lỗi điều chỉnh, …)     | Chọn reason_codes phù hợp Stranding  |
| `Event_Code`             | Event      | Start/Stop/Changeover/Setup                            | Giống Drawing                        |
| QC input theo Stranding  | Quality    | Ghi nhận số sợi, bước xoắn, OD ruột dẫn nếu nhập tay   | Liên kết nhóm Q_Str_* trong Quality  |


### 3.2.3 MES – Tag lưu/tính trong CSDL MES

Các tag này phù hợp với ruột dẫn sau xoắn.


| Tagname                      | Bảng CSDL                     | Mô tả                                                         | Nguồn dữ liệu (tóm tắt)             |
| ---------------------------- | ----------------------------- | ------------------------------------------------------------- | ----------------------------------- |
| `{Machine}_Status`           | `machines.status`             | Trạng thái máy xoắn                                           | PLC → API                           |
| `{Machine}_LineSpeed`        | `machines.line_speed`         | Tốc độ line xoắn                                              | PLC                                 |
| `{Machine}_LengthCounter`    | `machines.length_counter`     | Bộ đếm chiều dài ruột dẫn                                     | PLC                                 |
| `{Machine}_ProducedLength`   | `machines.produced_length`    | Chiều dài ruột dẫn đã xoắn                                    | MES tính từ length events           |
| `{Machine}_ProducedLengthOK` | `machines.produced_length_ok` | Chiều dài OK                                                  | PLC/MES                             |
| `{Machine}_ProducedLengthNG` | `machines.produced_length_ng` | Chiều dài NG (đứt sợi, chất lượng kém)                        | PLC/QC                              |
| `{Machine}_CurrentShiftId`   | `machines.current_shift_id`   | ID ca hiện tại                                                | MES                                 |
| `Order_ProducedLength`       | `production_orders`           | Độ dài lệnh đã xoắn                                           | MES cộng từ máy Stranding           |
| `Order_TargetLength`         | `production_orders`           | Độ dài mục tiêu của lệnh tại công đoạn xoắn                   | SAP/Planner                         |
| `OEE_`* cho Stranding        | `kpi_aggregates` / view       | OEE máy xoắn (A/P/Q)                                          | Từ runtime, speed, NG, downtime     |
| `Shift_*`                    | `shifts`                      | Ca áp dụng cho cụm Stranding                                  | MES/Tablet                          |
| `Coils_*` hoặc `Lots_*`      | `coils` / `lots`              | Thông tin cuộn/lô sau xoắn                                    | PLC + Tablet (scan, cân nếu có)     |
| `Q_Str_*` (Quality)          | `quality_measurements`        | Thông số chất lượng: đường kính ruột dẫn, bước xoắn, Rdc20, … | Tablet/QC hoặc thiết bị đo liên kết |


### 3.2.4 SAP – Tag/Trường có đồng bộ với SAP


| Tagname / Trường           | Ý nghĩa SAP                                    | Luồng đồng bộ                  |
| -------------------------- | ---------------------------------------------- | ------------------------------ |
| `Order_SapOrderId`         | Mã lệnh sản xuất SAP cho công đoạn Stranding   | SAP → MES                      |
| `{Machine}_OrderId`        | Lệnh gán cho máy xoắn                          | SAP → MES (dispatch)           |
| `{Machine}_MaterialCode`   | Mã vật tư ruột dẫn/bán thành phẩm từ SAP       | SAP → MES (BOM/component)      |
| `Order_TargetLength`       | Số mét cần xoắn                                | SAP → MES                      |
| `Order_ProducedLength`     | Số mét thực tế đã xoắn                         | MES → SAP (confirmation)       |
| `{Coil}_WeightNet`         | Khối lượng net ruột dẫn sau xoắn (nếu quản lý) | MES → SAP (material document)  |
| `{Coil}_WeightGross`       | Khối lượng tổng ruột dẫn                       | MES → SAP                      |
| `{Order}_MaterialBom`      | BOM vật tư cho công đoạn Stranding             | SAP → MES                      |
| `{Order}_MaterialConsumed` | Tiêu hao vật tư (sợi đơn) thực tế              | MES → SAP (consumption / MIGO) |


---

## 3.3 III.Group_Armoring – Cụm máy giáp/băng giáp (Armoring)

**Mô tả:** Cụm máy giáp băng/giáp sợi (băng thép, băng nhôm, sợi thép) cho cáp lực, cáp điều khiển. Tham số chính: tốc độ line, độ dày băng/giáp, độ chồng mí, hướng giáp, đường kính sau giáp, lỗi đứt băng/sợi…

### 3.3.1 PLC – Tag/UDT Shopfloor

**Nguồn:** Sheet `III.Group_Armoring` trong file Excel.


| UDT / Block PLC                | Ghi chú                                     |
| ------------------------------ | ------------------------------------------- |
| `UDT_Armoring_`* (theo Excel)  | UDT cho các máy giáp/băng giáp              |
| `Line.*`                       | Trạng thái line, tốc độ line, chiều dài, …  |
| Tham số giáp (Overlap, Width…) | Độ chồng mí, chiều rộng băng, hướng giáp, … |


### 3.3.2 Tablet – Tag/operator nhập tại chỗ


| Tagname                 | Nhóm     | Mô tả ngắn                                   |
| ----------------------- | -------- | -------------------------------------------- |
| `Order_StartTime`       | Order    | Start lệnh giáp/băng giáp                    |
| `Order_EndTime`         | Order    | End lệnh giáp/băng giáp                      |
| `{Machine}_Operator*`   | Machine  | Operator chính/phụ máy giáp                  |
| `Shift_*`               | Shift    | Bàn giao ca, ghi chú tồn tại/sự cố giáp      |
| `Downtime_Event`        | Downtime | Dừng máy do đứt băng, kẹt băng, lỗi setup…   |
| QC input theo `Q_Arm_*` | Quality  | Nếu QC nhập trực tiếp (độ dày, độ chồng mí…) |


### 3.3.3 MES – Tag lưu/tính trong CSDL MES


| Tagname                    | Bảng CSDL              | Mô tả                               |
| -------------------------- | ---------------------- | ----------------------------------- |
| `{Machine}_Status`         | `machines`             | Trạng thái máy giáp                 |
| `{Machine}_LineSpeed`      | `machines`             | Tốc độ line giáp                    |
| `{Machine}_ProducedLength` | `machines`             | Chiều dài sau giáp                  |
| `Order_ProducedLength`     | `production_orders`    | Chiều dài lệnh tại công đoạn giáp   |
| `Q_Arm_*`                  | `quality_measurements` | Độ dày, chiều rộng, overlap, ODarm… |
| `OEE_*`                    | `kpi_aggregates`       | OEE cho cụm Armoring                |


### 3.3.4 SAP – Tag/Trường có đồng bộ với SAP


| Tagname / Trường           | Ý nghĩa SAP                      |
| -------------------------- | -------------------------------- |
| `Order_SapOrderId`         | Lệnh SAP cho công đoạn giáp      |
| `{Machine}_OrderId`        | Lệnh gán cho máy giáp            |
| `{Machine}_MaterialCode`   | Mã băng thép/băng nhôm/sợi thép… |
| `{Order}_MaterialBom`      | BOM vật tư cho Armoring          |
| `{Order}_MaterialConsumed` | Tiêu hao băng/giáp thực tế       |


---

## 3.4 IV.Group_Extrusion – Cụm bọc cách điện / bọc vỏ (Extrusion)

**Mô tả:** Cụm máy bọc cách điện, bọc vỏ trong/ngoài (Insulating, Inner Sheathing, Outer Sheathing). Tham số: tốc độ line, nhiệt độ zone, OD, độ dày cách điện/vỏ, eccentricity, spark test, lỗi bề mặt/in chữ…

### 3.4.1 PLC – Tag/UDT Shopfloor

**Nguồn:** Sheet `IV.Group_Extrusion` trong file Excel.


| UDT / Block PLC                 | Ghi chú                                      |
| ------------------------------- | -------------------------------------------- |
| `UDT_Extrusion_`* (theo Excel)  | UDT cho máy bọc cách điện/bọc vỏ             |
| `Line.*`, `TempZone*`, `Spark*` | Trạng thái line, nhiệt độ zone, spark tester |


### 3.4.2 Tablet – Tag/operator nhập tại chỗ

Giống Drawing/Stranding, thêm các ghi chú về lỗi bề mặt, in chữ.


| Tagname                                         | Nhóm     | Mô tả ngắn                                     |
| ----------------------------------------------- | -------- | ---------------------------------------------- |
| `Order_StartTime/EndTime`                       | Order    | Start/End lệnh bọc                             |
| `{Machine}_Operator*`                           | Machine  | Operator cụm Extrusion                         |
| `Shift_*`                                       | Shift    | Bàn giao ca, ghi chú lỗi bề mặt, in chữ, spark |
| `Downtime_Event`                                | Downtime | Sự cố extruder, lỗi cấp hạt, lỗi spark tester… |
| QC input theo `Q_Ins_*`, `Q_InSh_*`, `Q_OuSh_*` | Quality  | OD, thickness, eccentricity, spark, surface…   |


### 3.4.3 MES – Tag lưu/tính trong CSDL MES


| Tagname                           | Bảng CSDL              | Mô tả                              |
| --------------------------------- | ---------------------- | ---------------------------------- |
| `{Machine}_Status`                | `machines`             | Trạng thái extruder                |
| `{Machine}_LineSpeed`             | `machines`             | Tốc độ line                        |
| `{Machine}_ProducedLength`        | `machines`             | Chiều dài sau bọc                  |
| `Order_ProducedLength`            | `production_orders`    | Chiều dài lệnh tại công đoạn bọc   |
| `Q_Ins_*`, `Q_InSh_*`, `Q_OuSh_*` | `quality_measurements` | Thông số OD, thickness, spark, IR… |
| `OEE_*`                           | `kpi_aggregates`       | OEE cụm Extrusion                  |


### 3.4.4 SAP – Tag/Trường có đồng bộ với SAP


| Tagname / Trường           | Ý nghĩa SAP                     |
| -------------------------- | ------------------------------- |
| `Order_SapOrderId`         | Lệnh SAP cho công đoạn bọc      |
| `{Machine}_OrderId`        | Lệnh gán cho extruder           |
| `{Machine}_MaterialCode`   | Mã compound/nhựa/XLPE/PVC…      |
| `{Order}_MaterialBom`      | BOM compound/nhựa cho Extrusion |
| `{Order}_MaterialConsumed` | Tiêu hao hạt nhựa thực tế       |


---

## 3.5 V.Group_Furnace – Cụm lò ủ / CCV / lưu hóa (Furnace)

**Mô tả:** Cụm lò ủ, CCV, lò lưu hóa: kiểm soát nhiệt độ, áp suất, thời gian lưu, tốc độ line trong vùng nóng.

### 3.5.1 PLC – Tag/UDT Shopfloor

**Nguồn:** Sheet `V.Group_Furnace` trong file Excel.


| UDT / Block PLC          | Ghi chú                     |
| ------------------------ | --------------------------- |
| `UDT_Furnace_`*          | UDT cho lò ủ/lò lưu hóa/CCV |
| `TempZone*`, `Pressure*` | Nhiệt độ/áp suất từng zone  |


### 3.5.2 Tablet – Tag/operator nhập tại chỗ


| Tagname                   | Nhóm     | Mô tả ngắn                               |
| ------------------------- | -------- | ---------------------------------------- |
| `Order_StartTime/EndTime` | Order    | Start/End mẻ/lệnh qua lò                 |
| `{Machine}_Operator*`     | Machine  | Operator phụ trách lò                    |
| `Shift_*`                 | Shift    | Bàn giao ca, ghi chú bất thường về nhiệt |
| `Downtime_Event`          | Downtime | Lỗi lò, quá nhiệt, lỗi an toàn…          |


### 3.5.3 MES – Tag lưu/tính trong CSDL MES


| Tagname                   | Bảng CSDL              | Mô tả                           |
| ------------------------- | ---------------------- | ------------------------------- |
| `{Machine}_Status`        | `machines`             | Trạng thái lò                   |
| `{Machine}_Temp*`         | `machine_metrics`      | Nhiệt độ các zone               |
| `Order_ProducedLength`    | `production_orders`    | Chiều dài/lượng sản phẩm qua lò |
| `Q_Fin_*` (nếu liên quan) | `quality_measurements` | Kết quả thử nghiệm sau lò       |


### 3.5.4 SAP – Tag/Trường có đồng bộ với SAP


| Tagname / Trường    | Ý nghĩa SAP                    |
| ------------------- | ------------------------------ |
| `Order_SapOrderId`  | Lệnh SAP cho công đoạn Furnace |
| `{Machine}_OrderId` | Lệnh gán cho lò                |


---

## 3.6 VI.Group_Pelletizing – Cụm tạo hạt (Pelletizing)

**Mô tả:** Cụm máy tạo hạt hợp chất (compound) – trộn, đùn, cắt hạt.

### 3.6.1 PLC – Tag/UDT Shopfloor

**Nguồn:** Sheet `VI.Group_Pelletizing` trong file Excel.


| UDT / Block PLC     | Ghi chú                             |
| ------------------- | ----------------------------------- |
| `UDT_Pelletizing_`* | UDT cho máy tạo hạt                 |
| Tham số trộn/đùn    | Nhiệt độ, tốc độ trục vít, áp suất… |


### 3.6.2 Tablet – Tag/operator nhập tại chỗ


| Tagname                   | Nhóm     | Mô tả ngắn                      |
| ------------------------- | -------- | ------------------------------- |
| `Order_StartTime/EndTime` | Order    | Start/End mẻ tạo hạt            |
| `{Machine}_Operator*`     | Machine  | Operator tạo hạt                |
| `Downtime_Event`          | Downtime | Sự cố cấp liệu, quá nhiệt, tắc… |


### 3.6.3 MES – Tag lưu/tính trong CSDL MES


| Tagname                           | Bảng CSDL           | Mô tả                  |
| --------------------------------- | ------------------- | ---------------------- |
| `{Machine}_Status`                | `machines`          | Trạng thái máy tạo hạt |
| `Order_ProducedLength`/`Quantity` | `production_orders` | Khối lượng/mẻ tạo hạt  |


### 3.6.4 SAP – Tag/Trường có đồng bộ với SAP


| Tagname / Trường         | Ý nghĩa SAP                |
| ------------------------ | -------------------------- |
| `Order_SapOrderId`       | Lệnh SAP sản xuất compound |
| `{Machine}_MaterialCode` | Mã compound thành phẩm     |


---

## 3.7 VII.Group.CuringBath – Bồn lưu hóa / bồn nước (CuringBath)

**Mô tả:** Các bồn nước/bồn lưu hóa trong dây chuyền CCV/Extrusion.

### 3.7.1 PLC – Tag/UDT Shopfloor

**Nguồn:** Sheet `VII.Group.CuringBath` trong file Excel.


| UDT / Block PLC    | Ghi chú                        |
| ------------------ | ------------------------------ |
| `UDT_CuringBath_`* | UDT cho các bồn nước/lưu hóa   |
| `Temp*`, `Level*`  | Nhiệt độ, mực nước, lưu lượng… |


### 2.7.2 Tablet / MES / SAP

Các tag chính (Order, Operator, Downtime, OEE) sử dụng **giống Extrusion/Furnace**, vì đây là thiết bị phụ trợ trong line; thông tin chi tiết mapping xem `MES_TAG_NAMING_STANDARD.md` (Equipment & Energy).

---

## 3.8 VIII.Group_Tin_Plating – Cụm tráng thiếc (Tin Plating)

**Mô tả:** Cụm máy tráng thiếc dây dẫn.

### 3.8.1 PLC – Tag/UDT Shopfloor

**Nguồn:** Sheet `VIII. Group_Tin_Plating` trong file Excel.


| UDT / Block PLC          | Ghi chú                       |
| ------------------------ | ----------------------------- |
| `UDT_TinPlating_`*       | UDT cho máy tráng thiếc       |
| Dòng, nhiệt độ bể thiếc… | Tham số bể tráng, tốc độ line |


### 2.8.2 Tablet / MES / SAP

Các tag Order/Operator/Downtime/OEE, cùng các tham số chất lượng `Q_*` (lớp thiếc, bề mặt…) sẽ theo chuẩn chung trong `MES_TAG_NAMING_STANDARD.md` (nhóm Tráng thiếc) và không lặp lại chi tiết ở đây.

---

## 3.9 XX.Group_Energy – Cụm đo năng lượng (Energy)

**Mô tả:** Cụm đo năng lượng cho từng line/máy (điện năng, dòng, áp…).

### 3.9.1 PLC – Tag/UDT Shopfloor

**Nguồn:** Sheet `XX.Group_Energy` trong file Excel.


| UDT / Block PLC      | Ghi chú                          |
| -------------------- | -------------------------------- |
| `UDT_Energy_`*       | UDT cho đồng hồ đo năng lượng    |
| `Power`, `EnergyKwh` | Công suất tức thời, kWh tích lũy |


### 3.9.2 MES – Tag lưu/tính trong CSDL MES


| Tagname               | Bảng CSDL         | Mô tả                        |
| --------------------- | ----------------- | ---------------------------- |
| `{Machine}_Power`     | `machine_metrics` | Công suất máy                |
| `{Machine}_EnergyKwh` | `machine_metrics` | Điện năng tiêu thụ           |
| KPI Energy            | `kpi_aggregates`  | KPI năng lượng theo máy/line |


