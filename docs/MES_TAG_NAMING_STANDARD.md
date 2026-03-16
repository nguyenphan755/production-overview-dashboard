# Quy chuẩn Tagname MES – Production Overview Dashboard

**Phiên bản:** 1.11  
**Ngày:** 2025-02-25  
**Phạm vi:** Hệ thống MES – Cáp điện (Drawing, Stranding, Armoring, Sheathing)  
**Mục đích:** Chuẩn hóa tagname PLC/SCADA → CSDL MES để gửi đối tác và cấp lãnh đạo

---

## Mục lục

1. [Overview](#1-overview)
2. [Production](#2-production)
3. [Quality](#3-quality)
4. [Equipment](#4-equipment)
5. [Analytics](#5-analytics)
6. [Maintenance](#6-maintenance)
7. [Schedule](#7-schedule)
8. [CSDL MES](#8-csdl-mes) (8.5 Tagname – SAP | MES | Tablet)
9. [CSDL SAP](#9-csdl-sap) (9.5 Luồng đồng bộ · 9.6 Mã lỗi · 9.7 Định dạng dữ liệu)
10. [CSDL ERP](#10-csdl-erp)
11. [API & Integration](#11-api--integration)

---

## 1. Overview

### 1.1 Luồng dữ liệu

```
PLC/SCADA → Kepserver/Node-RED → MES REST API → PostgreSQL → Dashboard
```

### 1.2 Nguyên tắc chung


| Nguyên tắc         | Mô tả                                             |
| ------------------ | ------------------------------------------------- |
| **Hierarchy**      | `Plant.Area.Machine.Parameter`                    |
| **Snake_case**     | Dùng dấu gạch dưới cho tagname (vd: `line_speed`) |
| **CamelCase API**  | API REST dùng camelCase (vd: `lineSpeed`)         |
| **Đơn vị rõ ràng** | Ghi trong tài liệu, không nhúng trong tên tag     |
| **ISA-95**         | Tham chiếu Level 3 (MES)                          |


### 1.3 Cấu trúc hierarchy

```
{Plant}_{Line}_{Area}_{Machine}_{Parameter}
```

- **Plant**: Mã nhà máy 2 ký tự (LT, TA, DN, BN – xem bảng 1.3.1)
- **Line**: Dây chuyền (vd: `L01`, `LINE_A`) – *tùy chọn, nhóm máy*
- **Area**: Khu vực – `drawing`, `stranding`, `armoring`, `sheathing`, `tinning` hoặc mã xưởng (vd: `1`, `2`)
- **Machine**: Mã máy – 2 ký tự đầu là kí hiệu loại máy (BD, KD, XS, BC… xem bảng 1.3.1), tiếp theo là quy cách + số thứ tự (vd: `BD751`, `D01`, `S01`)
- **Parameter**: Tham số đo (vd: `line_speed`, `status`, `current`)

#### 1.3.1 Ví dụ SAP Workcenter – LT1BD751

*Cấu trúc workcenter SAP Cadivi: `Plant` + `Area` + `Machine` (nối liền, không dấu phân cách).*


| Workcenter   | Thành phần | Mã      | Diễn giải                |
| ------------ | ---------- | ------- | ------------------------ |
| **LT1BD751** | Plant      | `LT`    | Long Thành               |
|              | Area       | `1`     | Xưởng shopfloor số 1     |
|              | Machine    | `BD751` | Máy bọc dân dụng 75 số 1 |


**Phân tích cấu trúc:**

```
LT1BD751 = LT + 1 + BD751
         = Plant(2) + Area(1) + Machine(5)
```


| Cấp     | Độ dài (vd) | Kiểu dữ liệu | Ví dụ | Ghi chú                                                                     |
| ------- | ----------- | ------------ | ----- | --------------------------------------------------------------------------- |
| Plant   | 2 ký tự     | VARCHAR(2)   | LT    | Cố định theo danh mục nhà máy (xem bảng dưới)                               |
| Area    | 1–2 ký tự   | VARCHAR(2)   | 1     | Số xưởng/shop floor                                                         |
| Machine | 4–6 ký tự   | VARCHAR(6)   | BD751 | 2 ký tự đầu = kí hiệu máy (xem bảng dưới), tiếp theo = quy cách + số thứ tự |


**Bảng kí hiệu Plant (2 ký tự):**


| Kí hiệu | Kiểu dữ liệu | Diễn giải       |
| ------- | ------------ | --------------- |
| LT      | VARCHAR(2)   | Long Thành      |
| TA      | VARCHAR(2)   | Tân Á / Sài Gòn |
| DN      | VARCHAR(2)   | Đà Nẵng         |
| BN      | VARCHAR(2)   | Bắc Ninh        |


**Bảng kí hiệu máy (2 ký tự đầu của Machine):** Mỗi kí hiệu một hàng. Chỉ gộp khi diễn giải giống nhau.


| Kí hiệu | Kiểu dữ liệu | Diễn giải         |
| ------- | ------------ | ----------------- |
| BD      | VARCHAR(2)   | Máy bọc dân dụng  |
| KD      | VARCHAR(2)   | Máy kéo đại       |
| KN      | VARCHAR(2)   | Máy kéo nhỡ       |
| KT      | VARCHAR(2)   | Máy kéo trung     |
| KA      | VARCHAR(2)   | Máy kéo nhôm      |
| TT      | VARCHAR(2)   | Máy tráng thiếc   |
| XB      | VARCHAR(2)   | Máy bện           |
| XS      | VARCHAR(2)   | Máy xoắn ghép     |
| XD      | VARCHAR(2)   | Máy xoắn ghép     |
| XG      | VARCHAR(2)   | Máy xoắn ghép     |
| XC      | VARCHAR(2)   | Máy xoắn cứng     |
| XO      | VARCHAR(2)   | Máy xoắn ống      |
| XT      | VARCHAR(2)   | Máy xoắn trả xoắn |
| BC      | VARCHAR(2)   | Máy bọc cáp       |
| BM      | VARCHAR(2)   | Máy bọc trung thế |
| GB      | VARCHAR(2)   | Máy giáp Mica     |
| GB      | VARCHAR(2)   | Máy giáp băng     |
| LH      | VARCHAR(2)   | Lò lưu hóa        |
| LU      | VARCHAR(2)   | Lò ủ              |
| CC      | VARCHAR(2)   | Lò nhôm           |
| OC      | VARCHAR(2)   | Máy ống luồn cứng |
| OM      | VARCHAR(2)   | Máy ống luồn mềm  |
| TH      | VARCHAR(2)   | Máy tạo hạt       |


#### 1.3.2 Bảng MRP Controller (SAP)

*Mã MRP Controller – người phụ trách kế hoạch vật tư sản xuất (SAP PP). Sắp xếp theo thứ tự mã.*


| MRP Controller | Kiểu dữ liệu | MRP Controller Name |
| -------------- | ------------ | ------------------- |
| 102            | INTEGER      | Nhôm 9,5 mm         |
| 103            | INTEGER      | Kéo đại             |
| 104            | INTEGER      | Kéo trung/multi     |
| 105            | INTEGER      | Kéo nhỏ/multi       |
| 106            | INTEGER      | Tráng thiếc         |
| 107            | INTEGER      | Xoắn                |
| 108            | INTEGER      | Giáp Mica           |
| 109            | INTEGER      | Bọc cách điện       |
| 110            | INTEGER      | CCV Line            |
| 111            | INTEGER      | Giáp màn chắn       |
| 112            | INTEGER      | Xoắn ghép nhôm      |
| 113            | INTEGER      | Bọc lót             |
| 114            | INTEGER      | Bọc inner           |
| 115            | INTEGER      | Bọc phân cách       |
| 116            | INTEGER      | Giáp bảo vệ         |
| 117            | INTEGER      | Ghép nhôm giáp PC   |
| 118            | INTEGER      | Cáp nhôm siêu nhiệt |
| 119            | INTEGER      | Xoắn TP             |
| 120            | INTEGER      | Xoắn ghép TP        |
| 121            | INTEGER      | Bọc thành phẩm      |
| 122            | INTEGER      | Tạo hạt             |


**Ánh xạ MES:**

- `machine_id` (MES) = `LT1BD751` (dùng trực tiếp workcenter SAP để đồng bộ)
- `machines.area` = `sheathing` (suy từ BD = bọc dân dụng)
- `plants.plant_code` = `LT`

**Ví dụ tagname cho LT1BD751:**

```
LT1BD751_Status
LT1BD751_LineSpeed
LT1BD751_OrderId
LT1BD751_ProducedLength
LT1BD751_ProducedLengthOK
LT1BD751_ProducedLengthNG
LT1BD751_CoilId
LT1BD751_WeightNet
LT1BD751_WeightGross
```

*Lưu ý: Độ dài Plant/Area/Machine có thể khác nhau theo từng nhà máy. Cần bảng mapping `config/workcenter-mapping.json` để parse workcenter khi tích hợp.*

### 1.4 Nguồn dữ liệu (Data Source)

*Trong toàn bộ tài liệu, cột **Nguồn dữ liệu** mô tả giá trị lấy từ đâu và lấy như thế nào (PLC, API, SAP, nhập tay, MES tính, v.v.).*


| Nguồn        | Mô tả                                                                 | Tag/Field / Ghi chú                                      |
| ------------ | --------------------------------------------------------------------- | -------------------------------------------------------- |
| `plc`        | Từ PLC/SCADA qua Kepserver/Node-RED                                   | Mặc định khi dữ liệu từ máy                              |
| `manual`     | Nhập tay khi mất kết nối hoặc không có thiết bị                       | `{Field}_DataSource` = `manual`                          |
| `calculated` | MES tính (OEE, Availability, delta length, đối soát…)                | `{Field}_DataSource` = `calculated`                       |
| `api`        | Dữ liệu đến MES qua REST API (payload từ PLC/Node-RED, Tablet, job SAP) | Kênh nhận; nguồn thực tế có thể là PLC, Tablet hoặc SAP  |
| `sap`        | Đồng bộ từ/đến SAP (lệnh, BOM, confirmation, material doc…)           | Xem mục 9                                                |
| `tablet`     | Nhập từ Tablet/App tại máy (operator, QC, Planner): Start/End, QR, downtime, NCR, bàn giao ca… | 8.5 cột **Tablet**                                       |
| `mes`        | MES ghi/sinh (thời điểm server, ID ca, đối soát, sinh bản ghi…)       | Lưu trữ nội bộ CSDL MES                                  |
| `shopfloor`  | **Tại chỗ:** gộp PLC + Tablet + nhập tay tại máy (tầng sản xuất)      | Dùng khi nguồn là tổng thể tại chỗ, không cần tách PLC/Tablet |

*Phân loại tag theo hệ thống (SAP | MES | Tablet) xem **mục 8.5**.*

### 1.5 Đơn vị đo (Units)


| Tham số                               | Đơn vị | Ghi chú          |
| ------------------------------------- | ------ | ---------------- |
| Tốc độ (Drawing)                      | m/s    | Máy kéo sợi      |
| Tốc độ (Stranding/Armoring/Sheathing) | m/min  | Các khu vực khác |
| Chiều dài                             | m      | Mét              |
| Trọng lượng                           | kg     | Kilogram         |
| Đường kính                            | mm     | Milimet          |
| Tiết diện                             | mm²    | Milimet vuông    |
| Dòng điện                             | A      | Ampe             |
| Công suất                             | kW     | Kilowatt         |
| Nhiệt độ                              | °C     | Celsius          |
| OEE, A, P, Q                          | %      | 0–100            |
| Năng lượng                            | kWh    | Kilowatt-giờ     |
| Runtime                               | h      | Giờ              |


### 1.6 Liên kết AVEVA MES


| Nhóm AVEVA               | Tag liên quan                                               |
| ------------------------ | ----------------------------------------------------------- |
| 1) Production Operations | Status, LineSpeed, OrderId, ProductName, StartTime, EndTime |
| 2) Quality               | ProducedLengthOK, ProducedLengthNG, Quality                 |
| 3) Maintenance           | HealthScore, VibrationLevel, MaintenancePlan                |
| 5) Corporate Reporting   | OEE, Availability, Performance, Quality                     |
| 6) Six Big Losses        | Status, ReasonCode, LossCategory                            |
| 8) Energy Monitoring     | Power, EnergyKwh                                            |
| F) Alarm Management      | AlarmId, AlarmSeverity, AlarmMessage                        |
| L) PLC/SCADA             | Toàn bộ tagname trong tài liệu                              |


---

## 2. Production

### 2.1 Production Order – Lệnh sản xuất


| Tagname                      | Cột CSDL                                   | Kiểu dữ liệu  | API Field              | Nguồn dữ liệu                                                    | Mô tả                                              |
| ---------------------------- | ------------------------------------------ | ------------- | ---------------------- | ---------------------------------------------------------------- | -------------------------------------------------- |
| `{Machine}_OrderId`          | `machines.production_order_id`             | VARCHAR(100)  | `productionOrderId`    | PLC/API PUT machines hoặc SAP/ERP đồng bộ khi dispatch lệnh      | Mã đơn hàng                                        |
| `{Machine}_OrderName`        | `machines.production_order_name`           | VARCHAR(255)  | `productionOrderName`  | API PUT machines hoặc từ production_orders khi gán lệnh          | Tên lệnh                                           |
| `{Machine}_OrderCode`        | `production_orders.id`                     | VARCHAR(100)  | `orderCode`            | SAP/ERP đồng bộ hoặc API POST/PUT orders                         | Mã đơn (SAP/ERP)                                   |
| `{Machine}_ProductName`      | `machines.product_name`                    | VARCHAR(255)  | `productName`          | PLC/API PUT machines hoặc suy từ material_code (material_master) | Tên sản phẩm                                       |
| `{Machine}_MaterialCode`     | `machines.material_code`                   | VARCHAR(50)   | `materialCode`         | PLC/API PUT machines hoặc SAP/ERP                                | Mã vật tư                                          |
| `{Machine}_CustomerName`     | `production_orders.customer`               | VARCHAR(255)  | `customer`             | SAP/ERP đồng bộ hoặc API POST orders                             | Tên công ty đối tác                                |
| `{Machine}_OperatorName`     | `machines.operator_name`                   | VARCHAR(255)  | `operatorName`         | API PUT machines (Tablet/PLC) hoặc nhập tay                      | Tên công nhân vận hành                             |
| `{Machine}_OperatorMain`     | `machines.operator_main`                   | VARCHAR(255)  | `operatorMain`         | Planner/Tablet hoặc API PUT machines (lưu MES; không đồng bộ SAP) | Công nhân vận hành chính                           |
| `{Machine}_OperatorAux`      | `machines.operator_aux`                    | VARCHAR(255)  | `operatorAux`          | Planner/Tablet hoặc API PUT machines (lưu MES; không đồng bộ SAP) | Công nhân vận hành phụ                            |
| `Order_StartTime`            | `production_orders.start_time`             | TIMESTAMPTZ   | `startTime`            | API PUT orders hoặc Tablet khi bắt đầu lệnh                      | Thời gian bắt đầu                                  |
| `Order_EndTime`              | `production_orders.end_time`               | TIMESTAMPTZ   | `endTime`              | API PUT orders hoặc Tablet khi kết thúc lệnh                     | Thời gian hoàn thành                               |
| `Order_Status`               | `production_orders.status`                 | VARCHAR(50)   | `status`               | API PUT orders (PLC/Tablet) hoặc SAP sync                        | `running`, `completed`, `interrupted`, `cancelled` |
| `Order_ProducedLength`       | `production_orders.produced_length`        | DECIMAL(12,2) | `producedLength`       | MES tính từ production_length_events (delta_length) khi running  | Chiều dài đã sản xuất                              |
| `Order_TargetLength`         | `production_orders.target_length`          | DECIMAL(12,2) | `targetLength`         | SAP/ERP đồng bộ hoặc API POST/PUT orders                         | Chiều dài mục tiêu                                 |
| `Order_ProductNameCurrent`   | `production_orders.product_name_current`   | VARCHAR(255)  | `productNameCurrent`   | API PUT machines (live từ PLC) hoặc copy từ product_name         | Tên SP hiện tại (live)                             |
| `Order_Duration`             | `production_orders.duration`               | VARCHAR(50)   | `duration`             | MES tính (end_time − start_time) hoặc API                        | Thời lượng (chuỗi hiển thị)                        |
| `Order_MachineName`          | `production_orders.machine_name`           | VARCHAR(100)  | `machineName`          | API POST/PUT orders khi gán lệnh cho máy                         | Tên máy gán cho đơn                                |
| `Order_QRScanTime`           | `order_scans.scan_time`                    | TIMESTAMPTZ   | `qrScanTime`           | Tablet/App quét QR → API POST scan (ghi thời điểm server)        | Thời điểm quét QR (nếu dùng)                       |
| `Order_QRScanBy`             | `order_scans.scan_by`                      | VARCHAR(255)  | `qrScanBy`             | Tablet/App quét QR → API (user đăng nhập hoặc field scan_by)     | Người quét QR                                      |
| `Order_PlannedLength`        | `production_plans.planned_length`          | DECIMAL(12,2) | `plannedLength`        | SAP/ERP đồng bộ (target qty) hoặc Planner nhập tay MES           | Chiều dài kế hoạch (so sánh vs thực tế)            |
| `Order_SalesOrderId`         | `production_orders.sales_order_id`         | VARCHAR(100)  | `salesOrderId`         | SAP/ERP đồng bộ khi nhận lệnh                                    | Số Đơn hàng/Hợp đồng (SAP)                         |
| `Order_LineItem`             | `production_orders.line_item`              | VARCHAR(50)   | `lineItem`             | SAP/ERP đồng bộ khi nhận lệnh                                    | Line Item (SAP)                                    |
| `Order_ProductionOrderYear`  | `production_orders.production_order_year`  | INTEGER       | `productionOrderYear`  | SAP/ERP đồng bộ (năm phiếu DNSX)                                 | Năm của phiếu DNSX                                 |
| `Order_ProductionProposalId` | `production_orders.production_proposal_id` | VARCHAR(100)  | `productionProposalId` | SAP/ERP đồng bộ (mã phiếu Đề nghị sản xuất)                      | Phiếu Đề nghị sản xuất (DNSX)                      |


### 2.2 Production – Trạng thái & chiều dài


| Tagname                         | Cột CSDL                          | Kiểu dữ liệu  | API Field             | Đơn vị               | Nguồn dữ liệu                                                    | Mô tả                                                     |
| ------------------------------- | --------------------------------- | ------------- | --------------------- | -------------------- | ---------------------------------------------------------------- | --------------------------------------------------------- |
| `{Machine}_Status`              | `machines.status`                 | VARCHAR(50)   | `status`              | enum                 | PLC/SCADA → Kepserver/Node-RED → API PUT machines                | `running`, `idle`, `warning`, `error`, `stopped`, `setup` |
| `{Machine}_LineSpeed`           | `machines.line_speed`             | DECIMAL(10,2) | `lineSpeed`           | m/min (Drawing: m/s) | PLC/SCADA → Kepserver/Node-RED → API PUT machines                | Tốc độ dây chuyền                                         |
| `{Machine}_TargetSpeed`         | `machines.target_speed`           | DECIMAL(10,2) | `targetSpeed`         | m/min                | PLC/API PUT machines (recipe hoặc nhập)                          | Tốc độ mục tiêu                                           |
| `{Machine}_LengthCounter`       | `machines.length_counter`         | DECIMAL(12,2) | `lengthCounter`       | m                    | PLC/SCADA → Kepserver/Node-RED → API PUT machines (mỗi cycle)    | Bộ đếm chiều dài (PLC)                                    |
| `{Machine}_LengthCounterLast`   | `machines.length_counter_last`    | DECIMAL(12,2) | `lengthCounterLast`   | m                    | MES ghi lại từ length_counter trước đó khi nhận giá trị mới      | Giá trị counter trước (delta)                             |
| `{Machine}_LengthCounterLastAt` | `machines.length_counter_last_at` | TIMESTAMPTZ   | `lengthCounterLastAt` | timestamp            | MES ghi thời điểm lần đọc counter trước                          | Thời điểm counter trước                                   |
| `{Machine}_ProducedLength`      | `machines.produced_length`        | DECIMAL(12,2) | `producedLength`      | m                    | MES tính từ production_length_events (tổng delta_length running) | Chiều dài sản xuất                                        |
| `{Machine}_TargetLength`        | `machines.target_length`          | DECIMAL(12,2) | `targetLength`        | m                    | API PUT machines hoặc từ production_orders khi gán lệnh          | Chiều dài mục tiêu lệnh                                   |
| `{Machine}_CurrentShiftId`      | `machines.current_shift_id`       | VARCHAR(50)   | `currentShiftId`      | string               | MES tính từ thời điểm hiện tại (shiftCalculator) khi API nhận    | ID ca hiện tại                                            |
| `{Machine}_CurrentShiftStart`   | `machines.current_shift_start`    | TIMESTAMPTZ   | `currentShiftStart`   | timestamp            | MES từ bảng shifts / shiftCalculator                             | Bắt đầu ca                                                |
| `{Machine}_CurrentShiftEnd`     | `machines.current_shift_end`      | TIMESTAMPTZ   | `currentShiftEnd`     | timestamp            | MES từ bảng shifts / shiftCalculator                             | Kết thúc ca                                               |


### 2.3 Chuyên ngành dây cáp – Coil, Bobbin, PKT


| Tagname                   | Cột CSDL                | Kiểu dữ liệu  | API Field       | Nguồn dữ liệu                                         | Mô tả                                                |
| ------------------------- | ----------------------- | ------------- | --------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| `{Machine}_CoilId`        | `coils.coil_id`         | VARCHAR(50)   | `coilId`        | PLC/API hoặc Tablet khi bắt đầu/kết thúc cuộn         | ID cuộn sản phẩm                                     |
| `{Machine}_CoilLength`    | `coils.length_m`        | DECIMAL(12,2) | `coilLength`    | PLC/API PUT (từ counter) hoặc cân/đo; MES có thể tính | Chiều dài cuộn (m)                                   |
| `{Machine}_CoilWeight`    | `coils.weight_kg`       | DECIMAL(12,3) | `coilWeight`    | Cân tại máy → PLC/API hoặc nhập tay khi đóng cuộn     | Khối lượng cuộn (kg)                                 |
| `{Machine}_CoilStartTime` | `coils.start_time`      | TIMESTAMPTZ   | `coilStartTime` | API POST/PUT coils (Tablet/PLC) khi bắt đầu quấn      | Thời điểm bắt đầu quấn cuộn                          |
| `{Machine}_CoilEndTime`   | `coils.end_time`        | TIMESTAMPTZ   | `coilEndTime`   | API POST/PUT coils (Tablet/PLC) khi kết thúc cuộn     | Thời điểm kết thúc cuộn                              |
| `{Machine}_BobbinId`      | `bobbins.id`            | VARCHAR(50)   | `bobbinId`      | Tablet/PLC quét hoặc nhập khi lắp ống chỉ             | ID bobbin (ống chỉ)                                  |
| `{Machine}_BobbinWeight`  | `bobbins.weight_kg`     | DECIMAL(12,3) | `bobbinWeight`  | Cân/PLC hoặc nhập tay khi đăng ký bobbin              | Trọng lượng bobbin (kg)                              |
| `{Machine}_PktIn`         | `coils.pkt_in`          | VARCHAR(50)   | `pktIn`         | PLC/Tablet quét hoặc nhập mã NVL đầu vào              | Mã số cuộn hoặc ID bobbin đầu vào                    |
| `{Machine}_PktOut`        | `coils.pkt_out`         | VARCHAR(50)   | `pktOut`        | PLC/Tablet quét hoặc nhập mã cuộn/bobbin đầu ra       | Mã số cuộn hoặc ID bobbin đầu ra                     |
| `{Machine}_WeightNet`     | `coils.weight_net_kg`   | DECIMAL(12,3) | `weightNet`     | Cân/PLC hoặc nhập; đồng bộ SAP khi đóng cuộn          | Khối lượng tinh (kg) – SAP                           |
| `{Machine}_WeightGross`   | `coils.weight_gross_kg` | DECIMAL(12,3) | `weightGross`   | Cân/PLC hoặc nhập; đồng bộ SAP khi đóng cuộn          | Khối lượng tổng (kg) – SAP                           |
| `{Machine}_SampleCode`    | `coils.sample_code`     | VARCHAR(50)   | `sampleCode`    | Tablet/QC nhập hoặc SAP đồng bộ                       | Mã sample – SAP                                      |
| `{Machine}_LengthStartM`  | `coils.length_start_m`  | DECIMAL(12,2) | `lengthStartM`  | PLC (counter tại lúc bắt đầu cuộn) hoặc nhập tay      | Số mét đầu (Stranding, Armoring, Sheathing, Tinning) |
| `{Machine}_LengthEndM`    | `coils.length_end_m`    | DECIMAL(12,2) | `lengthEndM`    | PLC (counter tại lúc kết thúc cuộn) hoặc nhập tay     | Số mét cuối                                          |


### 2.4 Event Codes – Sự kiện sản xuất (nhập Tablet / PLC)


| Code              | Mô tả (EN)      |
| ----------------- | --------------- |
| `START`           | Start           |
| `IDLE`            | Idle            |
| `WARNING`         | Warning         |
| `FAULT`           | Fault           |
| `WARM_UP`         | Warm-up         |
| `SETUP`           | Setup           |
| `SPEED_REDUCTION` | Speed Reduction |
| `BOBBIN_CHANGE`   | Bobbin Change   |
| `COIL_CHANGE`     | Coil Change     |
| `MATERIAL_CHANGE` | Material Change |
| `PRODUCT_CHANGE`  | Product Change  |
| `STOP`            | Stop            |
| `PAUSE`           | Pause           |
| `RESUME`          | Resume          |
| `CLEANING`        | Cleaning        |
| `INSPECTION`      | Inspection      |
| `OTHER`           | Other           |


### 2.5 Production Events – Bảng & tag còn thiếu

**Bảng `production_events*`* (đề xuất):


| Cột                   | Kiểu           | Nguồn dữ liệu                                       | Mô tả                             |
| --------------------- | -------------- | --------------------------------------------------- | --------------------------------- |
| `id`                  | SERIAL PK      | MES sinh khi INSERT                                 | ID sự kiện                        |
| `machine_id`          | VARCHAR(50) FK | Từ request/context khi ghi event                    | Máy                               |
| `production_order_id` | VARCHAR(100)   | API/Tablet (lệnh đang chạy tại máy)                 | Lệnh (nếu có)                     |
| `event_code`          | VARCHAR(50)    | Tablet chọn từ danh mục event_codes hoặc PLC gửi mã | Mã sự kiện (START, STOP, …)       |
| `event_type`          | VARCHAR(50)    | Tablet/PLC (loại sự kiện)                           | Loại (Start, Stop, Changeover, …) |
| `event_time`          | TIMESTAMP      | Thời điểm API nhận hoặc PLC gửi                     | Thời điểm                         |
| `reason_id`           | INT FK         | Tablet chọn từ reason_codes (khi dừng máy)          | Lý do (nếu dừng máy)              |
| `entered_by`          | VARCHAR(255)   | User đăng nhập Tablet hoặc field trong API          | Người nhập (Tablet)               |
| `data_source`         | VARCHAR(20)    | Ghi `plc` nếu từ PLC, `manual` nếu Tablet           | Nguồn: plc | manual               |


**Tag:** `{Machine}_EventId`, `{Machine}_EventCode`, `{Machine}_EventTime`, `Event_ReasonId`, `Event_EnteredBy`

### 2.6 Production Length Events (đã có – `production_length_events`)


| Cột                   | Kiểu dữ liệu  | Tag tương ứng             | Nguồn dữ liệu                                                   | Mô tả                          |
| --------------------- | ------------- | ------------------------- | --------------------------------------------------------------- | ------------------------------ |
| `machine_id`          | VARCHAR(50)   | `{Machine}_Id`            | Từ bản ghi máy đang được API PUT cập nhật                       | Máy                            |
| `production_order_id` | VARCHAR(100)  | `{Machine}_OrderId`       | Từ machines.production_order_id trong request/DB                | Lệnh                           |
| `shift_id`            | VARCHAR(50)   | `Event_ShiftId`           | MES tính từ event_time (shiftCalculator.getShiftId)             | Ca                             |
| `shift_date`          | DATE          | `Event_ShiftDate`         | MES tính từ event_time (shift window)                           | Ngày ca                        |
| `status`              | VARCHAR(50)   | `{Machine}_Status`        | API PUT machines (payload status từ PLC/Tablet)                 | Trạng thái tại thời điểm event |
| `counter_value`       | DECIMAL(12,2) | `{Machine}_LengthCounter` | API PUT machines (lengthCounter từ PLC mỗi lần gửi)             | Giá trị counter                |
| `delta_length`        | DECIMAL(12,2) | (tính)                    | MES tính: counter_value − last_counter; chỉ cộng khi is_running | Chiều dài tăng thêm            |
| `is_running`          | BOOLEAN       | (tính)                    | MES: true nếu status === 'running'                              | Đang chạy hay không            |
| `reset_detected`      | BOOLEAN       | (tính)                    | MES: true nếu counter_value < last_counter (bộ đếm reset)       | Phát hiện reset counter        |
| `event_time`          | TIMESTAMPTZ   | `Event_Time`              | Thời điểm server khi API nhận request (eventTime)               | Thời điểm event                |


### 2.7 Production – Bảng còn thiếu


| Bảng               | Cột chính                                            | Kiểu dữ liệu                                          | Nguồn dữ liệu                                                                                   | Mô tả                                  |
| ------------------ | ---------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------- |
| `order_scans`      | order_id, scan_time, scan_by, qr_data                | VARCHAR(100), TIMESTAMPTZ, VARCHAR(255), TEXT         | Tablet/App quét QR → API (scan_time = server time; scan_by = user; qr_data = payload đọc từ QR) | Lịch sử quét QR                        |
| `production_plans` | order_id, planned_length, planned_start, planned_end | VARCHAR(100), DECIMAL(12,2), TIMESTAMPTZ, TIMESTAMPTZ | SAP/ERP đồng bộ khi nhận lệnh; hoặc Planner nhập tay trong MES                                  | Kế hoạch sản xuất (so sánh vs thực tế) |


#### 2.7.1 Diễn giải cột từng bảng

**Bảng `order_scans`** – Lịch sử quét QR (quét mã QR gắn với lệnh sản xuất tại máy/xưởng):


| Cột         | Tag tương ứng      | Kiểu dữ liệu | Nguồn dữ liệu                                             | Mô tả                                                                                                                            |
| ----------- | ------------------ | ------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `order_id`  | `Order_OrderId`    | VARCHAR(100) | API request (parse từ qr_data hoặc chọn lệnh trên Tablet) | Mã lệnh sản xuất được quét (FK `production_orders.id`). Mỗi lần quét QR tại máy/tablet gắn lệnh với ca/máy và ghi lại thời điểm. |
| `scan_time` | `Order_QRScanTime` | TIMESTAMPTZ  | Server ghi thời điểm khi nhận API POST scan               | Thời điểm quét QR (giờ máy/UTC). Báo cáo “lệnh bắt đầu tại máy lúc nào”, đối soát với `production_orders.start_time`.            |
| `scan_by`   | `Order_QRScanBy`   | VARCHAR(255) | User đăng nhập Tablet hoặc field scan_by trong API        | Người quét. Truy vết ai gán/khởi động lệnh tại máy.                                                                              |
| `qr_data`   | `Order_QRData`     | TEXT         | Thiết bị đọc QR / App gửi nội dung thô trong request      | Nội dung thô từ QR. Validate hoặc parse order_id.                                                                                |


**Cách lấy dữ liệu:** Tablet/App tại máy khi operator quét QR (phiếu lệnh/màn hình); hoặc thiết bị đọc QR gửi API (vd. `POST /api/orders/:id/scan`). Không lấy từ PLC.

---

**Bảng `production_plans`** – Kế hoạch sản xuất (chiều dài và thời gian kế hoạch, so sánh với thực tế):


| Cột              | Tag tương ứng         | Kiểu dữ liệu  | Nguồn dữ liệu                                                 | Mô tả                                                                                         |
| ---------------- | --------------------- | ------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `order_id`       | `Order_OrderId`       | VARCHAR(100)  | SAP/ERP đồng bộ hoặc API khi tạo/cập nhật kế hoạch            | Mã lệnh (FK `production_orders.id`). Mỗi lệnh có một (hoặc nhiều phiên bản) bản ghi kế hoạch. |
| `planned_length` | `Order_PlannedLength` | DECIMAL(12,2) | SAP/ERP (target quantity, đơn vị m) hoặc Planner nhập tay MES | Chiều dài kế hoạch (m). So với `produced_length` để báo cáo % hoàn thành.                     |
| `planned_start`  | `Order_PlannedStart`  | TIMESTAMPTZ   | SAP/ERP (operation start) hoặc Planner nhập tay MES           | Thời gian bắt đầu kế hoạch. So với `production_orders.start_time`.                            |
| `planned_end`    | `Order_PlannedEnd`    | TIMESTAMPTZ   | SAP/ERP (operation end) hoặc Planner nhập tay MES             | Thời gian kết thúc kế hoạch. So với `production_orders.end_time`.                             |


**Cách lấy dữ liệu:** Đồng bộ từ SAP/ERP khi nhận lệnh (operation dates, target quantity); hoặc Planner nhập tay trong MES (xem mục 2.1).

### 2.8 Inventory & Traceability – Tag/bảng còn thiếu


| Tagname                    | Bảng CSDL                           | Kiểu dữ liệu  | Nguồn dữ liệu                                                      | Mô tả                         |
| -------------------------- | ----------------------------------- | ------------- | ------------------------------------------------------------------ | ----------------------------- |
| `{Machine}_LotId`          | `lots.lot_id`                       | VARCHAR(50)   | PLC/Tablet quét lot hoặc nhập khi bắt đầu lệnh; SAP/ERP có thể gửi | Mã lot đang sản xuất          |
| `{Order}_MaterialLot`      | `lots`                              | VARCHAR(50)   | Gắn lot với order qua API/Tablet khi xuất NVL hoặc bắt đầu lệnh    | Lot nguyên liệu gắn với đơn   |
| `{Order}_MaterialConsumed` | `material_consumption.consumed_qty` | DECIMAL(12,3) | Cân/PLC báo tiêu hao; API ghi; hoặc nhập tay / đồng bộ SAP         | Số lượng vật tư tiêu hao      |
| `{Area}_WIP`               | `wip.quantity`                      | DECIMAL(12,3) | MES tổng hợp từ sản lượng đang chạy chưa đóng lệnh theo area       | WIP theo khu vực              |
| `{Lot}_ParentLot`          | `lot_genealogy.parent_lot_id`       | VARCHAR(50)   | MES/Tablet ghi khi tạo lot con từ lot cha (traceability)           | Lot cha (truy xuất nguồn gốc) |
| `{Lot}_ChildLot`           | `lot_genealogy.child_lot_id`        | VARCHAR(50)   | MES/Tablet ghi khi tạo lot con từ lot cha (traceability)           | Lot con                       |


---

## 3. Quality

### 3.1 Chất lượng sản xuất


| Tagname                      | Cột CSDL                      | Kiểu dữ liệu  | API Field          | Đơn vị | Nguồn dữ liệu                                                              | Mô tả                   |
| ---------------------------- | ----------------------------- | ------------- | ------------------ | ------ | -------------------------------------------------------------------------- | ----------------------- |
| `{Machine}_ProducedLengthOK` | `machines.produced_length_ok` | DECIMAL(12,2) | `producedLengthOk` | m      | PLC/API PUT machines (bộ đếm OK) hoặc MES tính từ production_length_events | Chiều dài OK            |
| `{Machine}_ProducedLengthNG` | `machines.produced_length_ng` | DECIMAL(12,2) | `producedLengthNg` | m      | PLC/API PUT machines (bộ đếm NG) hoặc nhập tay/QC                          | Chiều dài NG (phế phẩm) |
| `{Machine}_Quality`          | `machines.quality`            | DECIMAL(5,2)  | `quality`          | %      | MES tính (OK/(OK+NG)*100) hoặc PLC/API gửi trực tiếp                       | Quality (Q trong OEE)   |


### 3.2 Quality – Tag/bảng còn thiếu


| Bảng CSDL thiếu        | Cột chính                                                                              | Kiểu dữ liệu                                                                                           | Nguồn dữ liệu                                                              | Tag chuẩn                                                          |
| ---------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `defect_codes`         | id, code, category, description, severity                                              | SERIAL PK, VARCHAR(50), VARCHAR(50), VARCHAR(255), VARCHAR(50)                                         | Danh mục cố định/cấu hình; QC nhập khi tạo mã lỗi mới                      | `{Machine}_DefectCode`, `{Order}_DefectCode`                       |
| `quality_inspections`  | id, order_id, lot_id, machine_id, defect_code, result (OK/NG), inspected_at, inspector | SERIAL PK, VARCHAR(100), VARCHAR(50), VARCHAR(50), VARCHAR(50), VARCHAR(10), TIMESTAMPTZ, VARCHAR(255) | QC/Tablet nhập khi kiểm tra; inspector = user đăng nhập; result chọn OK/NG | `{Order}_QCResult`, `{Lot}_QCResult`, `{Machine}_InspectionResult` |
| `ncr`                  | id, order_id, defect_code, description, severity, status, created_at                   | SERIAL PK, VARCHAR(100), VARCHAR(50), TEXT, VARCHAR(50), VARCHAR(50), TIMESTAMPTZ                      | QC/Planner tạo NCR từ Tablet/API; defect_code từ defect_codes              | `{Order}_NCRId`, `{Order}_NCRStatus`                               |
| `scrap_classification` | id, code, description                                                                  | SERIAL PK, VARCHAR(50), VARCHAR(255)                                                                   | Danh mục cố định; có thể mở rộng từ SAP/Planner                            | `{Order}_ScrapReason` – tái chế/sửa/chấp nhận                      |


### 3.3 Reason Codes – Nhóm Quality (nhập Tablet)


| Code              | Mô tả (EN)          |
| ----------------- | ------------------- |
| `QUALITY_CHECK`   | Quality Check       |
| `REWORK_REQ`      | Rework Required     |
| `INSPECTION_HOLD` | Inspection Hold     |
| `QUALITY_ISSUE`   | Quality Issue       |
| `OTHER_QUALITY`   | Other Quality Issue |


### 3.4 Quality – SPC & Control Limits (đề xuất)


| Tag               | Cột CSDL                           | Kiểu dữ liệu  | Nguồn dữ liệu                                                    | Mô tả                                         |
| ----------------- | ---------------------------------- | ------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| `{Parameter}_UCL` | quality_control_limits.upper_limit | DECIMAL(12,4) | Cấu hình theo sản phẩm/tham số (QC/Engineer); có thể từ SPC tính | Giới hạn kiểm soát trên (Upper Control Limit) |
| `{Parameter}_LCL` | quality_control_limits.lower_limit | DECIMAL(12,4) | Cấu hình theo sản phẩm/tham số (QC/Engineer); có thể từ SPC tính | Giới hạn kiểm soát dưới (Lower Control Limit) |
| `{Parameter}_USL` | quality_specs.upper_spec           | DECIMAL(12,4) | Quy cách sản phẩm (R&D/QC nhập); có thể đồng bộ từ ERP           | Giới hạn quy cách trên                        |
| `{Parameter}_LSL` | quality_specs.lower_spec           | DECIMAL(12,4) | Quy cách sản phẩm (R&D/QC nhập); có thể đồng bộ từ ERP           | Giới hạn quy cách dưới                        |


**Bảng:** `quality_control_limits`, `quality_specs` (theo product/parameter)

### 3.5 Quality – Dữ liệu kiểm soát chất lượng theo công đoạn (MES_TAG_Quality)

Phần này bổ sung từ danh sách tham số chất lượng do nhà máy cung cấp (file MES_TAG_Quality.xlsx), nhóm theo **công đoạn** (Raw Material → Final Testing). Các tagname dưới đây **không trùng** với mục 3.1–3.4 (OEE/QC/NCR/SPC). Quy ước rút gọn: `**Q_{Công đoạn}_{Tham số}`** — mã công đoạn (Raw, Drw, Ann, Str, Mic, Ins, Cab, InSh, Arm, OuSh, Fin), tham số viết tắt (Rho20, Dia, Tens, OD, IR, …).


| Công đoạn       | Tham số chất lượng          | Tagname (đề xuất) | Đơn vị  | Thiết bị / Nguồn             | Ghi chú                                   |
| --------------- | --------------------------- | ----------------- | ------- | ---------------------------- | ----------------------------------------- |
| Raw Material    | Điện trở suất 20°C          | `Q_Raw_Rho20`     | Ω·mm²/m | Micro-ohmmeter, QMS          | Cầu đo DO5000                             |
| Raw Material    | Đường kính                  | `Q_Raw_Dia`       | mm      | Laser micrometer             | Panme điện tử                             |
| Raw Material    | Bề mặt                      | `Q_Raw_Sur`       | -       | Camera / Visual              | Xem xét thêm TB Machine Vision            |
| Raw Material    | Độ bền kéo                  | `Q_Raw_Tens`      | Mpa     | UTM                          | Máy kháng kéo                             |
| Raw Material    | Độ giãn dài                 | `Q_Raw_Elong`     | %       | UTM                          | -                                         |
| Raw Material    | Tỷ trọng                    | `Q_Raw_Dens`      | g/cm³   | Density balance              | Phòng KCS NM CADIVI Khí cụ điện           |
| Raw Material    | Độ cứng Shore               | `Q_Raw_Shore`     | A/D     | Shore Durometer              | -                                         |
| Drawing         | Đường kính dây              | `Q_Drw_WDia`      | mm      | Laser micrometer, Online     | Keyence IG-20/LS5000                      |
| Drawing         | Sai lệch đường kính         | `Q_Drw_DiaDev`    | mm      | MES SPC                      | Nhập dung sai trên HMI link PLC           |
| Drawing         | Số lần đứt dây/ca           | `Q_Drw_WBreak`    | -       | Machine sensor               | Counter đưa về PLC, cảm biến báo đứt      |
| Drawing         | Điện trở DC ở 20°C          | `Q_Drw_Rdc20`     | Ω/km    | Online resistance meter      | Xem xét thêm TB đo Resistor online        |
| Drawing         | Độ bền kéo                  | `Q_Drw_Tens`      | Mpa     | UTM, QMS                     | Máy kháng kéo                             |
| Drawing         | Độ giãn dài                 | `Q_Drw_Elong`     | %       | UTM, QMS                     | -                                         |
| Annealing       | Điện trở DC ở 20°C          | `Q_Ann_Rdc20`     | Ω/km    | Online resistance meter      | Xem xét thêm TB đo Resistor online        |
| Annealing       | Độ bền kéo                  | `Q_Ann_Tens`      | Mpa     | UTM, QMS                     | Máy kháng kéo                             |
| Annealing       | Độ giãn dài                 | `Q_Ann_Elong`     | %       | UTM                          | -                                         |
| Annealing       | Đường kính dây              | `Q_Ann_WDia`      | mm      | Laser micrometer, Online     | Keyence IG-20/LS5000                      |
| Stranding       | Đường kính ruột dẫn         | `Q_Str_CondOD`    | mm      | Laser OD gauge, Online       | Keyence IG-20/LS5000                      |
| Stranding       | Điện trở DC ở 20°C          | `Q_Str_Rdc20`     | Ω/km    | Online resistance meter      | Xem xét thêm TB đo Resistor online        |
| Stranding       | Bước xoắn                   | `Q_Str_Lay`       | mm      | Encoder calculation          | -                                         |
| Stranding       | Hướng xoắn (S/Z)            | `Q_Str_Dir`       | spec    | Recipe control               | -                                         |
| Stranding       | Số sợi                      | `Q_Str_NStr`      | -       | Manual verify                | Đếm số lượng Pay-Off Active               |
| Mica Armouring  | Số lớp mica                 | `Q_Mic_MLay`      | -       | PLC + Recipe                 | Mặc định là 2                             |
| Mica Armouring  | Độ dày băng                 | `Q_Mic_TThick`    | mm      | Micrometer                   | Nhập trên HMI link PLC                    |
| Mica Armouring  | Chiều rộng băng             | `Q_Mic_TWid`      | mm      | Caliper                      | -                                         |
| Mica Armouring  | Độ chồng mí                 | `Q_Mic_Overlap`   | %       | Encoder / Vision             | -                                         |
| Mica Armouring  | Hướng giáp (S/Z)            | `Q_Mic_Dir`       | -       | Direction sensor             | -                                         |
| Mica Armouring  | Tốc độ line                 | `Q_Mic_Speed`     | m/min   | Line encoder + PLC           | -                                         |
| Insulating      | Đường kính ngoài            | `Q_Ins_OD`        | mm      | Laser OD gauge, Online       | Keyence IG-20/LS5000                      |
| Insulating      | Độ dày cách điện (Avg./Min) | `Q_Ins_InsTh`     | mm      | X-ray / Ultrasonic           | Xem xét thêm TB đo realtime               |
| Insulating      | Độ lệch tâm                 | `Q_Ins_Ecc`       | %       | X-ray gauge                  | -                                         |
| Insulating      | Bề mặt                      | `Q_Ins_Sur`       | -       | Camera / Visual              | Xem xét thêm TB Machine Vision            |
| Insulating      | Spark test                  | `Q_Ins_Spark`     | kV      | Spark tester                 | Xem xét nâng cấp thiết bị có truyền thông |
| Insulating      | Điện trở cách điện          | `Q_Ins_IR`        | MΩ·km   | IR tester, QMS               | Xem xét thêm TB đo Resistor online        |
| Insulating      | Độ bền kéo                  | `Q_Ins_Tens`      | Mpa     | UTM, QMS                     | Máy kháng kéo                             |
| Insulating      | Độ giãn dài                 | `Q_Ins_Elong`     | %       | UTM, QMS                     | -                                         |
| Cabling         | Số lõi ghép                 | `Q_Cab_Cores`     | -       | Setup verify                 | Nhập từ Tablet                            |
| Cabling         | Đường kính tổng sau ghép    | `Q_Cab_ODcab`     | mm      | Laser OD gauge, QMS          | -                                         |
| Cabling         | Bước ghép                   | `Q_Cab_Lay`       | mm      | Encoder calculation          | -                                         |
| Cabling         | Hướng ghép (S/Z)            | `Q_Cab_Dir`       | spec    | Recipe control               | -                                         |
| Inner Sheathing | Bề mặt                      | `Q_InSh_Sur`      | -       | Camera / Visual              | Xem xét thêm TB Machine Vision            |
| Inner Sheathing | Đường kính ngoài            | `Q_InSh_OD`       | mm      | Laser OD gauge, Online       | Keyence IG-20/LS5000                      |
| Inner Sheathing | Độ dày vỏ trong             | `Q_InSh_InShTh`   | mm      | X-ray / Ultrasonic           | Xem xét thêm TB Ultrasonic online         |
| Inner Sheathing | Độ bền kéo                  | `Q_InSh_Tens`     | Mpa     | UTM                          | Máy kháng kéo                             |
| Inner Sheathing | Độ giãn dài                 | `Q_InSh_Elong`    | %       | UTM                          | -                                         |
| Armouring       | Bề mặt                      | `Q_Arm_Sur`       | -       | Camera / Visual              | Xem xét thêm TB Machine Vision            |
| Armouring       | Độ dày                      | `Q_Arm_Thick`     | mm      | Micrometer                   | Nhập từ Tablet                            |
| Armouring       | Chiều rộng                  | `Q_Arm_Wid`       | mm      | Caliper                      | -                                         |
| Armouring       | Độ chồng mí (%)             | `Q_Arm_Overlap`   | %       | Encoder / PLC                | -                                         |
| Armouring       | Độ bền kéo                  | `Q_Arm_Tens`      | Mpa     | UTM, QMS                     | Máy kháng kéo                             |
| Armouring       | Đường kính ngoài sau giáp   | `Q_Arm_ODarm`     | mm      | Laser OD gauge, Online       | Keyence IG-20/LS5000                      |
| Outer Sheathing | Đường kính ngoài            | `Q_OuSh_OD`       | mm      | Laser OD gauge, Online       | Keyence IG-20/LS5000                      |
| Outer Sheathing | Độ dày vỏ (Avg./Min)        | `Q_OuSh_ShTh`     | mm      | X-ray / Ultrasonic           | Nhập từ Tablet                            |
| Outer Sheathing | Spark test                  | `Q_OuSh_Spark`    | kV      | Spark tester                 | -                                         |
| Outer Sheathing | Trọng lượng                 | `Q_OuSh_Wt`       | kg/km   | Inline scale                 | -                                         |
| Outer Sheathing | Độ bền kéo                  | `Q_OuSh_Tens`     | Mpa     | UTM                          | Máy kháng kéo                             |
| Outer Sheathing | Độ giãn dài                 | `Q_OuSh_Elong`    | %       | UTM                          | -                                         |
| Outer Sheathing | Chữ in                      | `Q_OuSh_Print`    | m       | Vision camera                | Xem xét thêm TB Machine Vision            |
| Final Testing   | Độ dày vỏ bọc (Avg./Min)    | `Q_Fin_ShTh`      | mm      | Microscope, QMS              | -                                         |
| Final Testing   | Độ dày cách điện (Avg./Min) | `Q_Fin_InsTh`     | mm      | Microscope, QMS              | -                                         |
| Final Testing   | Điện trở DC ở 20°C          | `Q_Fin_Rdc20`     | Ω/km    | Online resistance meter, QMS | -                                         |
| Final Testing   | Độ bền kéo                  | `Q_Fin_Tens`      | Mpa     | UTM, QMS                     | -                                         |
| Final Testing   | Độ giãn dài                 | `Q_Fin_Elong`     | %       | UTM, QMS                     | -                                         |
| Final Testing   | Điện trở cách điện          | `Q_Fin_IR`        | MΩ·km   | IR tester, QMS               | -                                         |
| Final Testing   | Thử điện áp HV              | `Q_Fin_HV`        | kV      | PD-HV system, QMS            | -                                         |
| Final Testing   | Thử phóng điện cục bộ PD    | `Q_Fin_PD`        | pC      | PD-HV system, QMS            | -                                         |
| Final Testing   | Đường kính tổng             | `Q_Fin_OD`        | mm      | Trên mẫu, QMS                | -                                         |


**Lưu ý:** Các tag trong sheet "3.5 Tagname Chat luong" của file Excel (`{Machine}_ProducedLengthOK`, `{Machine}_Quality`, `{Parameter}_UCL`/`LCL`/`USL`/`LSL`, v.v.) đã được quy định tại mục **3.1**, **3.2** và **3.4**; không lặp lại trong mục 3.5.

---

## 4. Equipment

### 4.1 Machine – Điện & nhiệt độ


| Tagname                              | Cột CSDL                           | Kiểu dữ liệu  | API Field               | Đơn vị | Nguồn dữ liệu                                       | Mô tả              |
| ------------------------------------ | ---------------------------------- | ------------- | ----------------------- | ------ | --------------------------------------------------- | ------------------ |
| `{Machine}_Current`                  | `machines.current`                 | DECIMAL(10,2) | `current`               | A      | PLC/SCADA (biến tần/cảm biến) → Kepserver → API PUT | Dòng điện          |
| `{Machine}_Power`                    | `machines.power`                   | DECIMAL(10,2) | `power`                 | kW     | PLC/SCADA (công tơ/cảm biến) → Kepserver → API PUT  | Công suất          |
| `{Machine}_Temperature`              | `machines.temperature`             | DECIMAL(6,2)  | `temperature`           | °C     | PLC/SCADA (cảm biến nhiệt) → Kepserver → API PUT    | Nhiệt độ           |
| `{Machine}_TempZone1` … `TempZone10` | `machines.multi_zone_temperatures` | JSONB         | `multiZoneTemperatures` | °C     | PLC/SCADA (nhiệt từng vùng) → Kepserver → API PUT   | Nhiệt độ vùng 1–10 |


### 4.2 Machine – OEE & thiết bị


| Tagname                    | Cột CSDL                   | Kiểu dữ liệu  | API Field        | Đơn vị | Nguồn dữ liệu                                                    | Mô tả                                    |
| -------------------------- | -------------------------- | ------------- | ---------------- | ------ | ---------------------------------------------------------------- | ---------------------------------------- |
| `{Machine}_OEE`            | `machines.oee`             | DECIMAL(5,2)  | `oee`            | %      | MES tính (A×P×Q) hoặc PLC gửi nếu đã tính sẵn → API PUT          | OEE                                      |
| `{Machine}_Availability`   | `machines.availability`    | DECIMAL(5,2)  | `availability`   | %      | MES tính từ downtime/runtime hoặc PLC → API PUT                  | Availability (A)                         |
| `{Machine}_Performance`    | `machines.performance`     | DECIMAL(5,2)  | `performance`    | %      | MES tính (tốc độ thực/ mục tiêu) hoặc PLC → API PUT              | Performance (P)                          |
| `{Machine}_HealthScore`    | `machines.health_score`    | DECIMAL(5,2)  | `healthScore`    | 0–100  | Cảm biến/PLC (IoT) hoặc MES tổng hợp từ alarm, vibration → API   | Điểm sức khỏe thiết bị                   |
| `{Machine}_VibrationLevel` | `machines.vibration_level` | VARCHAR(50)   | `vibrationLevel` | enum   | Cảm biến rung → PLC/SCADA → API PUT                              | `Normal`, `Elevated`, `High`, `Critical` |
| `{Machine}_RuntimeHours`   | `machines.runtime_hours`   | DECIMAL(10,2) | `runtimeHours`   | h      | PLC đếm thời gian chạy hoặc MES tổng từ production_length_events | Tổng thời gian chạy máy                  |


### 4.3 Alarms


| Tagname                       | Cột CSDL              | Kiểu dữ liệu  | API Field      | Nguồn dữ liệu                                             | Mô tả                                  |
| ----------------------------- | --------------------- | ------------- | -------------- | --------------------------------------------------------- | -------------------------------------- |
| `{Machine}_AlarmId`           | `alarms.id`           | SERIAL/BIGINT | `id`           | MES sinh khi POST /api/machines/:id/alarms (từ PLC/SCADA) | ID cảnh báo                            |
| `{Machine}_AlarmSeverity`     | `alarms.severity`     | VARCHAR(50)   | `severity`     | PLC/SCADA gửi qua API khi có alarm                        | `info`, `warning`, `error`, `critical` |
| `{Machine}_AlarmMessage`      | `alarms.message`      | TEXT          | `message`      | PLC/SCADA gửi nội dung alarm qua API                      | Nội dung cảnh báo                      |
| `{Machine}_AlarmAcknowledged` | `alarms.acknowledged` | BOOLEAN       | `acknowledged` | Operator bấm xác nhận trên HMI/Tablet → API PUT           | Đã xác nhận                            |


### 4.4 Machine Metrics (Time series)


| Tagname                      | Cột CSDL          | Kiểu dữ liệu  | metric_type       | Nguồn dữ liệu                                              | Mô tả                            |
| ---------------------------- | ----------------- | ------------- | ----------------- | ---------------------------------------------------------- | -------------------------------- |
| `{Machine}_Speed_TS`         | `machine_metrics` | DECIMAL(10,2) | `speed`           | PLC/SCADA gửi định kỳ → API POST /api/machines/:id/metrics | Chuỗi thời gian tốc độ           |
| `{Machine}_Temperature_TS`   | `machine_metrics` | DECIMAL(6,2)  | `temperature`     | PLC/SCADA gửi định kỳ → API POST metrics                   | Chuỗi thời gian nhiệt độ         |
| `{Machine}_Current_TS`       | `machine_metrics` | DECIMAL(10,2) | `current`         | PLC/SCADA gửi định kỳ → API POST metrics                   | Chuỗi thời gian dòng điện        |
| `{Machine}_Power_TS`         | `machine_metrics` | DECIMAL(10,2) | `power`           | PLC/SCADA gửi định kỳ → API POST metrics                   | Chuỗi thời gian công suất        |
| `{Machine}_MultiZoneTemp_TS` | `machine_metrics` | DECIMAL(6,2)  | `multi_zone_temp` | PLC/SCADA gửi từng zone định kỳ → API POST (zone_number)   | Nhiệt độ vùng (zone_number 1–10) |


### 4.5 Energy


| Tagname                | Cột CSDL                        | Kiểu dữ liệu  | API Field   | Đơn vị    | Nguồn dữ liệu                                                      | Mô tả               |
| ---------------------- | ------------------------------- | ------------- | ----------- | --------- | ------------------------------------------------------------------ | ------------------- |
| `{Machine}_EnergyKwh`  | `energy_consumption.energy_kwh` | DECIMAL(12,3) | `energyKwh` | kWh       | Công tơ/PLC đọc theo giờ → Node-RED/API ghi vào energy_consumption | Năng lượng theo giờ |
| `{Machine}_EnergyHour` | `energy_consumption.hour`       | TIMESTAMPTZ   | `hour`      | timestamp | Mốc giờ khi ghi (từ request hoặc PLC)                              | Mốc thời gian       |


**Tag/bảng còn thiếu (Energy KPI):** `{Order}_EnergyKwh`, `{Shift}_EnergyKwh` – tiêu thụ theo lệnh/ca. Cột `order_id`, `shift_id` trong `energy_consumption` (đề xuất).

### 4.6 Thông số dây (chuyên ngành)


| Tagname                         | Cột CSDL                        | Kiểu dữ liệu  | Nguồn dữ liệu                                   | Mô tả                            |
| ------------------------------- | ------------------------------- | ------------- | ----------------------------------------------- | -------------------------------- |
| `{Machine}_WireDiameter`        | `coils.diameter_mm`             | DECIMAL(8,3)  | PLC/đo hoặc nhập khi tạo coil; có thể từ recipe | Đường kính dây (mm)              |
| `{Machine}_CrossSection`        | `coils.cross_section_mm2`       | DECIMAL(10,2) | Tính từ đường kính hoặc nhập/recipe             | Tiết diện (mm²)                  |
| `{Machine}_ConductorSize`       | `coils.conductor_size`          | VARCHAR(50)   | Recipe/lệnh sản xuất hoặc nhập khi tạo coil     | Quy cách ruột dẫn                |
| `{Machine}_DieSize`             | `coils.die_size_mm`             | DECIMAL(8,3)  | Recipe/PLC hoặc nhập khi đổi khuôn              | Kích thước khuôn (mm)            |
| `{Machine}_InsulationThickness` | `coils.insulation_thickness_mm` | DECIMAL(6,3)  | Recipe/QC nhập                                  | Độ dày cách điện (mm)            |
| `{Machine}_PayOffId`            | `machines.pay_off_id`           | VARCHAR(50)   | Cấu hình máy hoặc PLC/API khi gắn máy thả NVL   | Mã máy thả (NVL), nếu tách riêng |
| `{Machine}_TakeUpId`            | `machines.take_up_id`           | VARCHAR(50)   | Cấu hình máy hoặc PLC/API khi gắn máy cuộn TP   | Mã máy cuộn (TP), nếu tách riêng |


### 4.7 Equipment – Tag/bảng còn thiếu


Các bảng dưới đây bổ sung cho phần Equipment, phục vụ quản lý **mã cảnh báo**, **dây chuyền** và ánh xạ **máy → line**. Đây là các bảng cấu hình (master data), không đến từ PLC nhưng được dùng bởi các tag ở mục 4.x.

#### 4.7.1 Bảng `alarm_codes`

**Mục đích:** Danh mục mã cảnh báo chuẩn, dùng chung cho nhiều máy/nhà máy. Các tag `{Machine}_AlarmId`, `{Machine}_AlarmSeverity`, `{Machine}_AlarmMessage`, `{Machine}_AlarmAcknowledged` (xem mục 4.3) sẽ tham chiếu bảng này.

| Cột CSDL      | Kiểu dữ liệu | Ràng buộc        | Nguồn dữ liệu                                       | Mô tả                                          |
| ------------- | ------------ | ---------------- | --------------------------------------------------- | ---------------------------------------------- |
| `id`          | SERIAL PK    | NOT NULL, PK     | Hệ thống MES sinh tự động khi tạo alarm code       | ID nội bộ của mã cảnh báo                      |
| `code`        | VARCHAR(50)  | NOT NULL, UNIQUE | Admin cấu hình; có thể import từ PLC/SCADA         | Mã cảnh báo (vd: `OVERTEMP`, `LOW_PRESSURE`)   |
| `severity`    | VARCHAR(50)  | NOT NULL         | Admin cấu hình; có thể mapping từ PLC/SCADA        | Mức độ (`info`, `warning`, `error`, `critical`) |
| `category`    | VARCHAR(50)  | NULLABLE         | Admin cấu hình                                      | Nhóm cảnh báo (Process, Safety, Quality, v.v.) |
| `description` | VARCHAR(255) | NULLABLE         | Admin cấu hình                                      | Mô tả chi tiết mã cảnh báo                     |
| `is_active`   | BOOLEAN      | DEFAULT TRUE     | Admin bật/tắt trong giao diện cấu hình             | Cho phép sử dụng (ẩn/hiện trong cấu hình)      |
| `created_at`  | TIMESTAMPTZ  | DEFAULT now()    | MES tự ghi thời điểm khi tạo bản ghi               | Thời điểm tạo mã                               |


#### 4.7.2 Bảng `lines`

**Mục đích:** Quản lý dây chuyền (line) – nhóm nhiều máy thành 1 đối tượng để tính KPI (OEE theo line, sản lượng theo line, v.v.).

| Cột CSDL     | Kiểu dữ liệu | Ràng buộc        | Nguồn dữ liệu                          | Mô tả                                         |
| ------------ | ------------ | ---------------- | -------------------------------------- | --------------------------------------------- |
| `id`         | VARCHAR(50)  | NOT NULL, PK     | Admin cấu hình; có thể đồng bộ từ ERP | Mã line (vd: `L01_DRAWING`, `L02_SHEATHING`)  |
| `name`       | VARCHAR(100) | NOT NULL         | Admin cấu hình                          | Tên hiển thị của line                         |
| `plant_id`   | VARCHAR(50)  | FK → `plants.id` | Admin chọn từ danh mục plants          | Thuộc nhà máy nào (mapping với bảng Plant)    |
| `area_id`    | VARCHAR(50)  | FK → `areas.id`  | Admin chọn từ danh mục areas           | Khu vực/công đoạn chính (drawing, sheathing) |
| `description`| TEXT         | NULLABLE         | Admin cấu hình                          | Mô tả thêm (loại sản phẩm, quy cách chính)    |
| `is_active`  | BOOLEAN      | DEFAULT TRUE     | Admin bật/tắt                           | Line còn sử dụng hay đã ngưng                 |
| `sort_order` | INTEGER      | NULLABLE         | Admin cấu hình                          | Thứ tự hiển thị trên dashboard                |

**Tag gợi ý (line-level, nếu cần mở rộng sau):**

- `{Line}_OEE`, `{Line}_Availability`, `{Line}_Performance`, `{Line}_Quality`
- `{Line}_ProducedLength`, `{Line}_ProducedLengthOK`, `{Line}_ProducedLengthNG`


#### 4.7.3 Cột `machines.line_id` – ánh xạ Máy ↔ Line

**Mục đích:** Cho phép mỗi máy thuộc một (hoặc nhiều) line để tính toán KPI theo line và lọc theo dây chuyền.

| Cột CSDL          | Kiểu dữ liệu | Ràng buộc                | Nguồn dữ liệu                          | Mô tả                            |
| ----------------- | ------------ | ------------------------ | -------------------------------------- | -------------------------------- |
| `machines.id`     | VARCHAR(50)  | PK (sẵn có)             | Đồng bộ từ cấu hình máy / SAP workcenter | Mã máy trong MES                 |
| `machines.line_id`| VARCHAR(50)  | FK → `lines.id`, NULLABLE | Admin gán trong cấu hình máy         | Máy thuộc line nào (nếu có gán) |

Trong mô hình đơn giản, `machines.line_id` là cột bổ sung trong bảng `machines`. Nếu cần một máy thuộc **nhiều** line, có thể mở rộng thêm bảng trung gian `machine_lines(machine_id, line_id)` thay vì cột đơn.


### 4.8 Technical – Thông số công nghệ theo công đoạn (MES_TAG_Technical)

Phần này tham chiếu file `MES_TAG_Technical.xlsx` do nhà máy cung cấp. Chỉ liệt kê các dòng có **Add Tagname = 1**, dùng quy ước rút gọn **`T_{Công đoạn}_{Tham số}`**:

- **Công đoạn** (code gợi ý): `Draw` (kéo), `Ann` (ủ mềm), `Ins` (bọc cách điện), `ArmStr` (giáp sợi), `ArmTape` (giáp băng DSTA/DATA), `Out` (bọc vỏ ngoài)
- **Tham số** (viết tắt): `AreaRed`, `OilLvl`, `WireTemp`, `Rdc`, `Flow`, `InsTh`, `SparkKV`, `Cover`, `SheathTh`, `Ecc`, `WtPerM`, `PrintSync`, ...

Các tag `T_...` này **không trùng** với các tag đã định nghĩa ở mục 3.x và 4.x (khác prefix so với `Q_...` và `{Machine}_...`), dùng làm chuẩn đặt tên khi tích hợp tín hiệu kỹ thuật vào MES/SCADA.

| Công đoạn                | Thông số kỹ thuật          | Tagname (đề xuất)      | Đơn vị   | Thiết bị           | Ghi chú                                             |
| ------------------------ | ------------------------- | ---------------------- | -------- | ------------------ | --------------------------------------------------- |
| Công đoạn kéo           | Tỷ lệ giảm tiết diện      | `T_Draw_AreaRed`      | %        | PLC tính toán      | ĐK: Thực tế/đường kính khuôn TP                    |
| Công đoạn kéo           | Mức dầu                   | `T_Draw_OilLvl`       | %        | Level sensor       | INT:0-1-2,… Hoặc analog                            |
| Ủ mềm                   | Nhiệt độ dây sau ủ        | `T_Ann_WireTemp`      | °C       | Cảm biến hồng ngoại | Xem xét tích hợp CB hồng ngoại                     |
| Ủ mềm                   | Điện trở sau ủ           | `T_Ann_Rdc`           | Ω/km     | Thiết bị đo điện trở online | Xem xét tích hợp đo Resistor online        |
| Ủ mềm                   | Lưu lượng nước           | `T_Ann_Flow`          | L/phút   | Flow meter         | Xem xét lắp đặt cảm biến lưu lượng IN/OUT          |
| Bọc cách điện           | Độ dày cách điện        | `T_Ins_InsTh`         | mm       | X-ray / Ultrasonic gauge | Xem xét lắp đặt thiết bị đo                  |
| Bọc cách điện           | Điện áp Spark test       | `T_Ins_SparkKV`       | kV       | Spark tester       | TB không đo được điện áp thực tế (kV)              |
| Giáp sợi                | Độ phủ giáp              | `T_ArmStr_Cover`      | %        | PLC tính toán      | Hiện chưa có dữ liệu từ PLC                        |
| Giáp băng DSTA/DATA     | Độ phủ                   | `T_ArmTape_Cover`     | %        | PLC                | -                                                   |
| Bọc vỏ ngoài            | Độ dày vỏ               | `T_Out_SheathTh`      | mm       | Ultrasonic         | Xem xét thêm thiết bị đo Ultrasonic                |
| Bọc vỏ ngoài            | Độ lệch tâm             | `T_Out_Ecc`           | %        | Gauge system       | Xem xét thêm thiết bị đo độ lệch tâm (ovan)        |
| Bọc vỏ ngoài            | Spark test               | `T_Out_SparkKV`       | kV       | Spark tester       | TB không đo được điện áp thực tế (kV)              |
| Bọc vỏ ngoài            | Trọng lượng/mét         | `T_Out_WtPerM`        | kg/km    | Hệ cân online      | Xem xét thiết bị đáp ứng                           |
| Bọc vỏ ngoài            | Đồng bộ in chữ          | `T_Out_PrintSync`     | OK/NG    | Camera vision      | Xem xét thiết bị đáp ứng                           |


---

## 5. Analytics

### 5.1 KPI & OEE

- OEE, Availability, Performance, Quality (xem mục 4.2)
- `analytics_cache` – cache KPI theo ca, line, ngày

### 5.2 Downtime Events – Bảng & tag

**Bảng `downtime_events`** (đề xuất):


| Cột                   | Kiểu                  | Mô tả                                 |
| --------------------- | --------------------- | ------------------------------------- |
| `id`                  | SERIAL PK             | ID                                    |
| `machine_id`          | VARCHAR(50) FK        | Máy                                   |
| `reason_id`           | INT FK → reason_codes | Mã lý do                              |
| `start_time`          | TIMESTAMP             | Bắt đầu dừng                          |
| `end_time`            | TIMESTAMP             | Kết thúc dừng                         |
| `duration_seconds`    | INTEGER               | Thời gian dừng (giây)                 |
| `loss_category`       | VARCHAR(50)           | Availability/Performance/Quality loss |
| `root_cause_id`       | INT FK                | Nguyên nhân gốc (nếu có)              |
| `production_order_id` | VARCHAR(100)          | Lệnh đang chạy khi dừng               |
| `entered_by`          | VARCHAR(255)          | Người nhập (Tablet)                   |


**Tag:** `{Machine}_DowntimeStart`, `{Machine}_DowntimeEnd`, `{Machine}_DowntimeReason`, `{Machine}_LossCategory`, `{Machine}_RootCauseId`

### 5.3 Reason Codes – Bảng & Downtime (Six Big Losses)

**Bảng `reason_codes`** (đề xuất):


| Cột              | Kiểu               | Mô tả                                                   |
| ---------------- | ------------------ | ------------------------------------------------------- |
| `id`             | SERIAL PK          | ID                                                      |
| `code`           | VARCHAR(50) UNIQUE | Mã (MECH_FAIL, MAT_SHORTAGE, …)                         |
| `category`       | VARCHAR(50)        | Machine, Material, Operator, Planning, Utility, Quality |
| `description_en` | VARCHAR(255)       | Mô tả tiếng Anh                                         |
| `description_vi` | VARCHAR(255)       | Mô tả tiếng Việt                                        |
| `loss_type`      | VARCHAR(50)        | Availability, Performance, Quality                      |
| `root_cause_id`  | INT FK             | Liên kết nguyên nhân gốc (nếu có)                       |


### 5.4 Reason Codes – Downtime (Six Big Losses)

*Operator chọn lý do dừng máy từ Tablet. Phân loại theo Six Big Losses.*


| Category        | Code                | Mô tả (EN)               |
| --------------- | ------------------- | ------------------------ |
| **1. Machine**  | `MECH_FAIL`         | Mechanical Failure       |
|                 | `ELEC_FAULT`        | Electrical Fault         |
|                 | `SOFTWARE_ERR`      | Software Error           |
|                 | `MAINT_REQ`         | Maintenance Required     |
|                 | `TOOL_WEAR`         | Tool Wear                |
|                 | `OTHER_MACHINE`     | Other Machine Issue      |
| **2. Material** | `MAT_SHORTAGE`      | Material Shortage        |
|                 | `WRONG_MAT`         | Wrong Material           |
|                 | `MAT_DEFECT`        | Material Defect          |
|                 | `WAIT_MAT`          | Waiting for Material     |
|                 | `MAT_CHANGE`        | Material Change          |
|                 | `OTHER_MAT`         | Other Material Issue     |
| **3. Operator** | `OP_ABSENT`         | Operator Absent          |
|                 | `TRAINING_REQ`      | Training Required        |
|                 | `BREAK_TIME`        | Break Time               |
|                 | `SHIFT_CHANGE`      | Shift Change             |
|                 | `OP_ERROR`          | Operator Error           |
|                 | `OTHER_OP`          | Other Operator Issue     |
| **4. Planning** | `NO_WORK_ORDER`     | No Work Order            |
|                 | `SCHEDULE_CHANGE`   | Schedule Change          |
|                 | `PRIORITY_CHANGE`   | Priority Change          |
|                 | `WAIT_INSTRUCTIONS` | Waiting for Instructions |
|                 | `OTHER_PLANNING`    | Other Planning Issue     |
| **5. Utility**  | `POWER_OUTAGE`      | Power Outage             |
|                 | `AIR_ISSUE`         | Compressed Air Issue     |
|                 | `COOLING_ISSUE`     | Cooling System Issue     |
|                 | `OTHER_UTILITY`     | Other Utility Issue      |


### 5.5 Analytics – Tag/bảng còn thiếu


Các bảng sau dùng cho module Analytics: tổng hợp KPI, quản lý hành động khắc phục downtime và danh mục nguyên nhân gốc. Mỗi bảng được mô tả chi tiết để dễ thiết kế CSDL và tích hợp tag.

#### 5.5.1 Bảng `kpi_aggregates`

**Mục đích:** Lưu KPI đã được tổng hợp (aggregate) theo **đối tượng** (machine/line/area/plant/shift) và **khoảng thời gian** (giờ, ca, ngày, tuần...). Các tag như `{Area}_OEE_Avg`, `{Shift}_Output`, `{Plant}_OEE` sẽ đọc từ bảng này thay vì tính lại theo thời gian thực.

| Cột CSDL       | Kiểu dữ liệu  | Ràng buộc                 | Nguồn dữ liệu                                                                 | Mô tả                                                                 |
| -------------- | ------------- | ------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `id`           | SERIAL PK     | NOT NULL, PK              | MES sinh tự động khi job tổng hợp chạy                                      | ID bản ghi KPI                                                        |
| `scope_type`   | VARCHAR(50)   | NOT NULL                  | Cấu hình trong MES (`machine`, `line`, `area`, `plant`, `shift`, `order`...) | Loại đối tượng KPI (máy, line, area, plant, ca, đơn hàng, ...)       |
| `scope_id`     | VARCHAR(50)   | NOT NULL                  | MES xác định từ `machines`, `lines`, `areas`, `plants`, `shifts`             | ID đối tượng (vd: `BD751`, `L01_DRAWING`, `AREA_SHEATHING`, `PLANT_LT`) |
| `metric`       | VARCHAR(50)   | NOT NULL                  | Cấu hình danh mục KPI (`OEE`, `Availability`, `Output`, `ScrapRate`, ...)    | Tên chỉ số KPI                                                         |
| `value`        | DECIMAL(12,4) | NOT NULL                  | MES job tổng hợp                                                              | Giá trị KPI đã tính                                                   |
| `unit`         | VARCHAR(20)   | NULLABLE                  | Cấu hình theo metric                                                          | Đơn vị (%, m, kg, kWh, h, ...)                                         |
| `period_start` | TIMESTAMPTZ   | NOT NULL                  | MES job tổng hợp                                                              | Thời điểm bắt đầu kỳ tổng hợp                                         |
| `period_end`   | TIMESTAMPTZ   | NOT NULL                  | MES job tổng hợp                                                              | Thời điểm kết thúc kỳ tổng hợp                                        |
| `granularity`  | VARCHAR(20)   | NOT NULL                  | Cấu hình job (`hourly`, `shift`, `daily`, `weekly`)                           | Mức độ chi tiết của KPI                                               |
| `source_table` | VARCHAR(100)  | NULLABLE                  | MES lưu thông tin truy vết (`production_length_events`, `downtime_events`, ...) | Bảng nguồn chính dùng để tính KPI                                    |
| `created_at`   | TIMESTAMPTZ   | DEFAULT now()             | MES tự ghi khi ghi bản ghi                                                    | Thời điểm KPI được tổng hợp                                           |

**Tag chuẩn (đọc từ `kpi_aggregates`):** `{Area}_OEE_Avg`, `{Shift}_Output`, `{Plant}_OEE`, `{Line}_Availability_Avg`, ...


#### 5.5.2 Bảng `action_plans`

**Mục đích:** Theo dõi **kế hoạch hành động** (action plan) xuất phát từ các sự kiện downtime (xem `downtime_events` ở mục 5.2). Cho phép gán người phụ trách, hạn hoàn thành, trạng thái xử lý.

| Cột CSDL           | Kiểu dữ liệu | Ràng buộc                 | Nguồn dữ liệu                                                         | Mô tả                                                 |
| ------------------ | ------------ | ------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- |
| `id`               | SERIAL PK    | NOT NULL, PK              | MES sinh khi tạo action plan từ UI/Tablet/API                        | ID kế hoạch hành động                                 |
| `downtime_event_id`| INTEGER      | NOT NULL, FK → `downtime_events.id` | Chọn từ danh sách downtime cần hành động khắc phục           | Sự kiện downtime liên quan                            |
| `title`            | VARCHAR(255) | NOT NULL                  | Supervisor/Planner nhập                                               | Tiêu đề ngắn gọn của hành động                        |
| `description`      | TEXT         | NULLABLE                  | Supervisor/Technician nhập                                            | Mô tả chi tiết việc cần làm                           |
| `assigned_to`      | VARCHAR(255) | NULLABLE                  | Chọn user/nhóm user trong hệ thống (username, email, role)           | Người được giao xử lý                                 |
| `status`           | VARCHAR(50)  | NOT NULL                  | Cập nhật qua UI/Tablet/API (`open`, `in_progress`, `done`, `cancelled`, `overdue`) | Trạng thái kế hoạch hành động                         |
| `due_date`         | DATE         | NULLABLE                  | Supervisor/Planner nhập                                               | Hạn hoàn thành                                        |
| `closed_at`        | TIMESTAMPTZ  | NULLABLE                  | MES ghi khi status chuyển sang `done` hoặc `cancelled`               | Thời điểm đóng kế hoạch                               |
| `created_by`       | VARCHAR(255) | NOT NULL                  | MES ghi user hiện tại khi tạo                                        | Người tạo action plan                                 |
| `created_at`       | TIMESTAMPTZ  | DEFAULT now()             | MES tự ghi khi tạo                                                    | Thời điểm tạo                                         |

**Tag chuẩn:** `ActionPlan_Id`, `ActionPlan_Status` – dùng trong Analytics/Dashboard để đếm số action plan mở, trễ hạn, đã hoàn thành.


#### 5.5.3 Bảng `root_causes`

**Mục đích:** Danh mục **nguyên nhân gốc** (root cause) dùng khi phân tích downtime (Six Big Losses). Kết hợp với `reason_codes` (mục 5.3) để chuẩn hóa nguyên nhân.

| Cột CSDL          | Kiểu dữ liệu | Ràng buộc                    | Nguồn dữ liệu                              | Mô tả                                      |
| ----------------- | ------------ | ---------------------------- | ------------------------------------------ | ------------------------------------------ |
| `id`              | SERIAL PK    | NOT NULL, PK                 | MES sinh tự động khi tạo root cause        | ID nguyên nhân gốc                         |
| `code`            | VARCHAR(50)  | NOT NULL, UNIQUE             | Admin cấu hình                             | Mã nguyên nhân gốc (vd: `RC_BAD_MATERIAL`) |
| `description`     | VARCHAR(255) | NOT NULL                     | Admin cấu hình hoặc nhập khi phân tích     | Mô tả chi tiết nguyên nhân gốc            |
| `reason_category_id` | INTEGER   | FK → `reason_codes.id` hoặc bảng danh mục tương ứng | Admin mapping với nhóm lý do downtime | Nhóm lý do chính liên quan                 |
| `is_active`       | BOOLEAN      | DEFAULT TRUE                 | Admin bật/tắt                              | Cho phép sử dụng hay không                 |
| `created_at`      | TIMESTAMPTZ  | DEFAULT now()                | MES tự ghi                                 | Thời điểm tạo                              |

**Liên kết tag:** `ReasonCode_RootCauseId` – có thể được lưu trong `downtime_events.root_cause_id` để phân tích sâu Six Big Losses và Pareto nguyên nhân.


---

## 6. Maintenance

### 6.1 Lịch bảo trì


| Tagname                              | Cột CSDL                            | Kiểu dữ liệu  | API Field       | Nguồn dữ liệu                                            | Mô tả                                                           |
| ------------------------------------ | ----------------------------------- | ------------- | --------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| `{Machine}_MaintenancePlanId`        | `maintenance_plans.id`              | SERIAL PK     | `id`            | MES sinh khi tạo kế hoạch (Planner/CMMS hoặc API POST)   | ID kế hoạch bảo trì                                             |
| `{Machine}_MaintenanceType`          | `maintenance_plans.type`            | VARCHAR(20)   | `type`          | Planner/CMMS chọn PM hoặc CM khi lên lịch                | `PM` (định kỳ), `CM` (sửa chữa)                                 |
| `{Machine}_MaintenanceScheduledAt`   | `maintenance_plans.scheduled_at`    | TIMESTAMPTZ   | `scheduledAt`   | Planner nhập hoặc CMMS đồng bộ khi lên lịch              | Thời gian lên lịch                                              |
| `{Machine}_MaintenanceCompletedAt`   | `maintenance_plans.completed_at`    | TIMESTAMPTZ   | `completedAt`   | Technician/Tablet cập nhật khi hoàn thành bảo trì        | Thời gian hoàn thành                                            |
| `{Machine}_MaintenanceStatus`        | `maintenance_plans.status`          | VARCHAR(50)   | `status`        | Planner/Technician cập nhật qua API/Tablet               | `scheduled`, `in_progress`, `completed`, `cancelled`, `overdue` |
| `{Machine}_MaintenanceIntervalHours` | `maintenance_plans.interval_hours`  | DECIMAL(10,2) | `intervalHours` | Cấu hình theo máy (Planner/Admin) hoặc từ CMMS           | Chu kỳ bảo trì (giờ)                                            |
| `{Machine}_MaintenanceDescription`   | `maintenance_plans.description`     | TEXT          | `description`   | Planner/Technician nhập khi tạo hoặc thực hiện           | Mô tả công việc                                                 |
| `{Machine}_MaintenanceRequestBy`     | `maintenance_requests.requested_by` | VARCHAR(255)  | `requestedBy`   | Operator/Tablet (shopfloor) nhập khi yêu cầu bảo trì (Tablet/API) | Người yêu cầu (tại chỗ)                                        |


### 6.2 Maintenance – Bảng & tag còn thiếu

**Bảng `maintenance_plans*`* (đề xuất – chi tiết cột):


| Cột              | Kiểu           | Mô tả                                                 |
| ---------------- | -------------- | ----------------------------------------------------- |
| `id`             | SERIAL PK      | ID                                                    |
| `machine_id`     | VARCHAR(50) FK | Máy                                                   |
| `type`           | VARCHAR(20)    | PM, CM                                                |
| `status`         | VARCHAR(50)    | scheduled, in_progress, completed, cancelled, overdue |
| `scheduled_at`   | TIMESTAMP      | Thời gian lên lịch                                    |
| `completed_at`   | TIMESTAMP      | Thời gian hoàn thành                                  |
| `interval_hours` | DECIMAL(10,2)  | Chu kỳ (giờ chạy máy)                                 |
| `description`    | TEXT           | Mô tả công việc                                       |
| `work_order_id`  | VARCHAR(100)   | Mã work order CMMS (nếu tích hợp)                     |


**Bảng `maintenance_requests`**: id (SERIAL PK), machine_id (VARCHAR(50) FK), description (TEXT), requested_by (VARCHAR(255)), severity (VARCHAR(50)), status (VARCHAR(50)), created_at (TIMESTAMPTZ)

**Tag còn thiếu:** `{Machine}_MTBF`, `{Machine}_MTTR` (tính từ downtime_events)

---

## 7. Schedule

### 7.1 Shift / Ca (đã có: machines.current_shift_id, current_shift_start, current_shift_end)


| Tagname               | Cột CSDL                | Kiểu dữ liệu | API Field       | Nguồn dữ liệu                                              | Mô tả                           |
| --------------------- | ----------------------- | ------------ | --------------- | ---------------------------------------------------------- | ------------------------------- |
| `Shift_Current`       | `shifts.id`             | VARCHAR(50)  | `shiftId`       | MES tính từ thời điểm (shift-{số}-{ngày}) hoặc cấu hình ca | Ca hiện tại                     |
| `Shift_Start`         | `shifts.start_time`     | TIMESTAMPTZ  | `startTime`     | Cấu hình ca (Admin) hoặc từ lịch làm việc nhà máy          | Thời gian bắt đầu ca            |
| `Shift_End`           | `shifts.end_time`       | TIMESTAMPTZ  | `endTime`       | Cấu hình ca (Admin) hoặc từ lịch làm việc nhà máy          | Thời gian kết thúc ca           |
| `Shift_HandoverTime`  | `shifts.handover_time`  | TIMESTAMPTZ  | `handoverTime`  | Tablet/API khi operator bấm bàn giao ca (POST handover)    | Thời gian nhận ca / bàn giao ca |
| `Shift_HandoverBy`    | `shifts.handover_by`    | VARCHAR(255) | `handoverBy`    | User đăng nhập Tablet khi bấm bàn giao                     | Người bàn giao ca               |
| `Shift_ReceivedBy`    | `shifts.received_by`    | VARCHAR(255) | `receivedBy`    | User đăng nhập Tablet khi bấm nhận ca                      | Người nhận ca                   |
| `Shift_HandoverNotes` | `shifts.handover_notes` | TEXT         | `handoverNotes` | Operator nhập trên Tablet khi bàn giao ca                  | Ghi chú bàn giao ca             |


### 7.2 Shifts – Bảng chi tiết (đề xuất)

**Bảng `shifts`**:


| Cột CSDL        | Kiểu dữ liệu   | Ràng buộc           | Nguồn dữ liệu                                             | Mô tả                                     |
| --------------- | -------------- | ------------------- | --------------------------------------------------------- | ----------------------------------------- |
| `id`            | VARCHAR(50) PK | NOT NULL, PK        | MES sinh hoặc cấu hình theo mẫu (`shift-1-2025-02-25`)   | ID duy nhất của ca (kết hợp số ca + ngày) |
| `shift_number`  | INTEGER        | NOT NULL            | Admin cấu hình ca (1, 2, 3)                               | Số ca trong ngày                           |
| `shift_date`    | DATE           | NOT NULL            | MES tính từ lịch + thời điểm start                        | Ngày ca (theo lịch sản xuất)              |
| `start_time`    | TIMESTAMPTZ    | NOT NULL            | MES sinh khi ca bắt đầu (từ lịch hoặc operator bấm Start) | Bắt đầu ca                                 |
| `end_time`      | TIMESTAMPTZ    | NULLABLE            | MES cập nhật khi ca kết thúc (theo lịch hoặc bấm End)     | Kết thúc ca                                |
| `handover_time` | TIMESTAMPTZ    | NULLABLE            | Operator/Leader ghi nhận trên Tablet khi bàn giao ca      | Thời gian bàn giao/nhận ca thực tế        |
| `handover_by`   | VARCHAR(255)   | NULLABLE            | User đăng nhập, ghi khi lưu handover                      | Người bàn giao ca                          |
| `received_by`   | VARCHAR(255)   | NULLABLE            | User đăng nhập, ghi khi nhận ca                           | Người nhận ca                              |
| `handover_notes`| TEXT           | NULLABLE            | Operator/Leader nhập tự do trên Tablet                    | Ghi chú bàn giao (tồn kho, lỗi, cảnh báo)  |


### 7.3 Scheduling – Tag/bảng còn thiếu


Các bảng sau phục vụ lập lịch sản xuất: **dispatch list**, thời gian **setup/changeover** và **kế hoạch sản xuất theo lệnh**. Đây là master/transaction để tính các tag ở mục 7.1 và Analytics.

#### 7.3.1 Bảng `dispatch_list` – Danh sách phân công máy

**Mục đích:** Xác định thứ tự các lệnh sẽ chạy trên từng máy/dây chuyền (dispatching). Các tag `{Machine}_NextOrder`, `Dispatch_Priority`, `Dispatch_Sequence` đọc từ bảng này.

| Cột CSDL        | Kiểu dữ liệu  | Ràng buộc                    | Nguồn dữ liệu                                                       | Mô tả                                                        |
| --------------- | ------------- | ---------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| `id`            | SERIAL PK     | NOT NULL, PK                 | MES sinh tự động khi thêm vào dispatch list                        | ID bản ghi dispatch                                          |
| `order_id`      | VARCHAR(100)  | NOT NULL, FK → `production_orders.id` | Planner nhập/chọn từ danh sách lệnh sản xuất               | Lệnh sản xuất được phân công                                 |
| `machine_id`    | VARCHAR(50)   | NOT NULL, FK → `machines.id` | Planner chọn máy hoặc hệ thống gợi ý                               | Máy sẽ thực hiện lệnh                                        |
| `priority`      | INTEGER       | NOT NULL, DEFAULT 0          | Planner gán (0 = mặc định; số càng nhỏ càng ưu tiên cao)           | Mức ưu tiên lệnh trên máy                                    |
| `sequence`      | INTEGER       | NOT NULL                     | MES tính khi sắp xếp (1,2,3,...) hoặc Planner chỉnh tay            | Thứ tự chạy lệnh trên máy                                    |
| `planned_start` | TIMESTAMPTZ   | NULLABLE                     | Planner/MES tính toán từ lịch sản xuất                             | Thời gian kế hoạch bắt đầu lệnh trên máy                     |
| `planned_end`   | TIMESTAMPTZ   | NULLABLE                     | MES tính từ planned_start + thời lượng                             | Thời gian kế hoạch kết thúc lệnh                             |
| `status`        | VARCHAR(50)   | NOT NULL, DEFAULT `planned`  | MES cập nhật (`planned`, `in_progress`, `completed`, `cancelled`)  | Trạng thái dispatch                                          |
| `created_by`    | VARCHAR(255)  | NOT NULL                     | MES ghi user tạo (Planner/Scheduler)                               | Người tạo bản ghi                                            |
| `created_at`    | TIMESTAMPTZ   | DEFAULT now()                | MES tự ghi                                                          | Thời điểm tạo bản ghi                                        |

**Tag chuẩn:** `{Machine}_NextOrder`, `Dispatch_Priority`, `Dispatch_Sequence`.


#### 7.3.2 Bảng `setup_times` – Thời gian chuyển đổi (setup/changeover)

**Mục đích:** Lưu **ma trận thời gian setup** giữa các sản phẩm/quy cách cho từng máy, dùng để ước lượng thời gian chuyển đổi và tối ưu lịch (reduce changeover loss).

| Cột CSDL         | Kiểu dữ liệu | Ràng buộc                      | Nguồn dữ liệu                                        | Mô tả                                         |
| ---------------- | ------------ | ------------------------------ | ---------------------------------------------------- | --------------------------------------------- |
| `id`             | SERIAL PK    | NOT NULL, PK                   | MES sinh tự động khi cấu hình                        | ID bản ghi setup time                         |
| `machine_id`     | VARCHAR(50)  | NOT NULL, FK → `machines.id`   | Planner/Engineer cấu hình theo từng máy              | Máy áp dụng                                  |
| `from_product_id`| VARCHAR(50)  | NOT NULL, FK → `material_master.material_code` | Planner/Engineer chọn sản phẩm/quy cách hiện tại | Sản phẩm/quy cách trước khi chuyển           |
| `to_product_id`  | VARCHAR(50)  | NOT NULL, FK → `material_master.material_code` | Planner/Engineer chọn sản phẩm/quy cách kế tiếp | Sản phẩm/quy cách sau khi chuyển             |
| `duration_minutes`| INTEGER     | NOT NULL                       | Planner/Engineer nhập (theo thực tế/tiêu chuẩn)      | Thời gian setup/changeover (phút)            |
| `notes`          | TEXT         | NULLABLE                       | Planner/Engineer nhập                                | Ghi chú (thay khuôn, thay cuộn, chỉnh thông số ...) |

**Tag chuẩn:** `{Machine}_SetupTime`, `{Machine}_ChangeoverTime` – có thể là KPI tính toán dựa trên `setup_times` và `downtime_events`.


#### 7.3.3 Bảng `production_plans` – Kế hoạch theo lệnh

**Mục đích:** Lưu **chiều dài/thời gian kế hoạch** cho từng lệnh sản xuất, làm chuẩn so sánh với thực tế (On-time Delivery, Plan vs Actual). Trùng với cấu trúc đã mô tả ở mục 8.2 nhưng nhấn mạnh các cột phục vụ Schedule.

| Cột CSDL        | Kiểu dữ liệu  | Ràng buộc                    | Nguồn dữ liệu                                        | Mô tả                                         |
| --------------- | ------------- | ---------------------------- | ---------------------------------------------------- | --------------------------------------------- |
| `id`            | SERIAL PK     | NOT NULL, PK                 | MES sinh tự động khi tạo kế hoạch cho order         | ID bản ghi kế hoạch                           |
| `order_id`      | VARCHAR(100)  | NOT NULL, FK → `production_orders.id` | Đồng bộ/nhập từ ERP hoặc Planner nhập tay | Lệnh sản xuất                                 |
| `planned_length`| DECIMAL(12,2) | NULLABLE                     | Planner/ERP nhập                                     | Chiều dài kế hoạch (m)                        |
| `planned_start` | TIMESTAMPTZ   | NULLABLE                     | Planner/ERP/MES tính toán theo lịch                 | Thời gian dự kiến bắt đầu                     |
| `planned_end`   | TIMESTAMPTZ   | NULLABLE                     | MES tính từ planned_start + thời lượng              | Thời gian dự kiến kết thúc                    |
| `plan_source`   | VARCHAR(50)   | NULLABLE                     | `ERP`, `Manual`, `MES`                              | Nguồn gốc kế hoạch                            |
| `created_at`    | TIMESTAMPTZ   | DEFAULT now()                | MES tự ghi                                           | Thời điểm tạo bản ghi                         |

**Tag chuẩn:** `Order_PlannedLength`, `Order_PlannedStart`, `Order_PlannedEnd` – dùng trong dashboard lập kế hoạch và so sánh kế hoạch/thực tế.


---

## 8. CSDL MES

### 8.1 Bảng đã có (PostgreSQL)


| Bảng                                        | Kiểu dữ liệu chính                                                         | Mô tả                                                                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `machines`                                  | VARCHAR(50) PK, VARCHAR(50), DECIMAL(5,2), DECIMAL(10,2), DECIMAL(12,2), … | Máy móc, trạng thái, OEE, điện, nhiệt độ, produced_length_ok/ng, health_score, vibration_level, runtime_hours (migration) |
| `production_orders`                         | VARCHAR(100) PK, VARCHAR(255), TIMESTAMPTZ, DECIMAL(12,2), …               | Lệnh sản xuất                                                                                                             |
| `production_length_events`                  | SERIAL PK, VARCHAR(50), VARCHAR(100), TIMESTAMPTZ, DECIMAL(12,2), …        | Log sự kiện chiều dài (delta-based)                                                                                       |
| `alarms`                                    | SERIAL PK, VARCHAR(50), VARCHAR(50), TEXT, BOOLEAN, TIMESTAMPTZ            | Cảnh báo                                                                                                                  |
| `machine_metrics`                           | SERIAL PK, VARCHAR(50), VARCHAR(50), DECIMAL(10,2), TIMESTAMPTZ            | Time series (speed, temp, current, power)                                                                                 |
| `energy_consumption`                        | SERIAL PK, VARCHAR(50), DECIMAL(12,3), TIMESTAMPTZ                         | Tiêu thụ năng lượng                                                                                                       |
| `material_master`                           | VARCHAR(50) PK, VARCHAR(255), …                                            | Danh mục vật tư (material_code, material_name)                                                                            |
| `machine_status_history`                    | SERIAL PK, VARCHAR(50), VARCHAR(50), TIMESTAMPTZ                           | Lịch sử trạng thái máy                                                                                                    |
| `production_quality`                        | SERIAL PK, DECIMAL(12,2), DECIMAL(12,2), DECIMAL(5,2)                      | OK/NG, quality %                                                                                                          |
| `oee_calculations`                          | SERIAL PK, VARCHAR(50), DECIMAL(5,2), TIMESTAMPTZ                          | Lịch sử OEE                                                                                                               |
| `availability_aggregations`                 | SERIAL PK, VARCHAR(50), VARCHAR(50), DECIMAL(5,2), DATE                    | Availability theo ca                                                                                                      |
| `analytics_cache`                           | SERIAL PK, VARCHAR(50), VARCHAR(50), JSONB, TIMESTAMPTZ                    | Cache KPI analytics                                                                                                       |
| `mes_users`                                 | SERIAL PK, VARCHAR(255), VARCHAR(255), …                                   | Tài khoản người dùng                                                                                                      |
| `maintenance_plans`, `maintenance_requests` | SERIAL PK, VARCHAR(50), VARCHAR(20), TIMESTAMPTZ, …                        | Đề xuất, migration chưa chạy                                                                                              |


### 8.2 Bảng còn thiếu (đề xuất) – Chi tiết cấu trúc

**Production:**


| Bảng                | Cột chính                                                                                                                                                                                                                                                                                                                    | Kiểu dữ liệu                                                                                                                                                                                                                                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `coils`             | id, coil_id, machine_id, order_id, bobbin_id, length_m, weight_kg, weight_net_kg, weight_gross_kg, pkt_in, pkt_out, start_time, end_time, length_start_m, length_end_m, sample_code, status, notes, bobbin_type, production_date, unit, diameter_mm, cross_section_mm2, conductor_size, die_size_mm, insulation_thickness_mm | SERIAL PK, VARCHAR(50), VARCHAR(50), VARCHAR(100), VARCHAR(50), DECIMAL(12,2), DECIMAL(12,3), DECIMAL(12,3), DECIMAL(12,3), VARCHAR(50), VARCHAR(50), TIMESTAMPTZ, TIMESTAMPTZ, DECIMAL(12,2), DECIMAL(12,2), VARCHAR(50), VARCHAR(50), TEXT, VARCHAR(50), DATE, VARCHAR(20), DECIMAL(8,3), DECIMAL(10,2), VARCHAR(50), DECIMAL(8,3), DECIMAL(6,3) |
| `bobbins`           | id, bobbin_type, weight_kg, received_at, machine_id                                                                                                                                                                                                                                                                          | SERIAL PK, VARCHAR(50), DECIMAL(12,3), TIMESTAMPTZ, VARCHAR(50)                                                                                                                                                                                                                                                                                    |
| `production_events` | id, machine_id, order_id, event_code, event_type, event_time, reason_id, entered_by, data_source                                                                                                                                                                                                                             | SERIAL PK, VARCHAR(50), VARCHAR(100), VARCHAR(50), VARCHAR(50), TIMESTAMPTZ, INTEGER FK, VARCHAR(255), VARCHAR(20)                                                                                                                                                                                                                                 |
| `event_codes`       | id, code, description_en, description_vi                                                                                                                                                                                                                                                                                     | SERIAL PK, VARCHAR(50), VARCHAR(255), VARCHAR(255)                                                                                                                                                                                                                                                                                                 |
| `order_scans`       | id, order_id, scan_time, scan_by, qr_data                                                                                                                                                                                                                                                                                    | SERIAL PK, VARCHAR(100), TIMESTAMPTZ, VARCHAR(255), TEXT                                                                                                                                                                                                                                                                                           |
| `production_plans`  | id, order_id, planned_length, planned_start, planned_end, plan_source                                                                                                                                                                                                                                                        | SERIAL PK, VARCHAR(100), DECIMAL(12,2), TIMESTAMPTZ, TIMESTAMPTZ, VARCHAR(50)                                                                                                                                                                                                                                                                      |
| `order_bom`         | id, production_order_id, material_code, bom_qty, unit                                                                                                                                                                                                                                                                        | SERIAL PK, VARCHAR(100) FK, VARCHAR(50), DECIMAL(12,3), VARCHAR(20)                                                                                                                                                                                                                                                                                |


**Quality:**


| Bảng                     | Cột chính                                                                      | Kiểu dữ liệu                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `defect_codes`           | id, code, category, description, severity                                      | SERIAL PK, VARCHAR(50), VARCHAR(50), VARCHAR(255), VARCHAR(50)                                         |
| `quality_inspections`    | id, order_id, lot_id, machine_id, defect_code, result, inspected_at, inspector | SERIAL PK, VARCHAR(100), VARCHAR(50), VARCHAR(50), VARCHAR(50), VARCHAR(10), TIMESTAMPTZ, VARCHAR(255) |
| `ncr`                    | id, order_id, defect_code, description, severity, status, created_at           | SERIAL PK, VARCHAR(100), VARCHAR(50), TEXT, VARCHAR(50), VARCHAR(50), TIMESTAMPTZ                      |
| `scrap_classification`   | id, code, description (tái chế/sửa/chấp nhận)                                  | SERIAL PK, VARCHAR(50), VARCHAR(255)                                                                   |
| `quality_control_limits` | id, product_id, parameter, upper_limit, lower_limit                            | SERIAL PK, VARCHAR(50), VARCHAR(50), DECIMAL(12,4), DECIMAL(12,4)                                      |
| `quality_specs`          | id, product_id, parameter, upper_spec, lower_spec                              | SERIAL PK, VARCHAR(50), VARCHAR(50), DECIMAL(12,4), DECIMAL(12,4)                                      |


**Analytics:**


| Bảng                    | Cột chính                                                                                                                                                                                                                                                                                      | Kiểu dữ liệu                                                                                                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reason_codes`          | id, code, category, description_en, description_vi, loss_type, root_cause_id                                                                                                                                                                                                                   | SERIAL PK, VARCHAR(50), VARCHAR(50), VARCHAR(255), VARCHAR(255), VARCHAR(50), INTEGER FK                                                                                                                                  |
| `downtime_events`       | id, machine_id, reason_id, start_time, end_time, duration_seconds, loss_category, root_cause_id, order_id, entered_by                                                                                                                                                                          | SERIAL PK, VARCHAR(50), INTEGER FK, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, VARCHAR(50), INTEGER FK, VARCHAR(100), VARCHAR(255)                                                                                                |
| `root_causes`           | id, code, description, reason_category_id                                                                                                                                                                                                                                                      | SERIAL PK, VARCHAR(50), VARCHAR(255), INTEGER FK                                                                                                                                                                          |
| `kpi_aggregates`        | id, scope_type, scope_id, metric, value, period_start, period_end                                                                                                                                                                                                                              | SERIAL PK, VARCHAR(50), VARCHAR(50), VARCHAR(50), DECIMAL(12,4), TIMESTAMPTZ, TIMESTAMPTZ                                                                                                                                 |
| `action_plans`          | id, downtime_event_id, assigned_to, status, due_date, closed_at                                                                                                                                                                                                                                | SERIAL PK, INTEGER FK, VARCHAR(255), VARCHAR(50), DATE, TIMESTAMPTZ                                                                                                                                                       |
| `machine_shift_summary` | id, machine_id, shift_id, shift_date, production_order_id, product_code, runtime_actual_seconds, total_operating_time_seconds, actual_speed_avg, max_speed, oee, operator_main, operator_aux, produced_length_ok, produced_length_ng, produced_length, downtime_reason_ids, corrective_actions | SERIAL PK, VARCHAR(50), VARCHAR(50), DATE, VARCHAR(100), VARCHAR(50), INTEGER, INTEGER, DECIMAL(10,2), DECIMAL(10,2), DECIMAL(5,2), VARCHAR(255), VARCHAR(255), DECIMAL(12,2), DECIMAL(12,2), DECIMAL(12,2), TEXT[], TEXT |


**Inventory – Tồn kho:** (chi tiết mục 8.3)


| Bảng                       | Cột chính                                                                         | Kiểu dữ liệu                                                                               |
| -------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `inventory`                | id, material_code, location_id, quantity, unit, reserved_qty                      | SERIAL PK, VARCHAR(50), VARCHAR(50), DECIMAL(12,3), VARCHAR(20), DECIMAL(12,3)             |
| `inventory_transactions`   | id, material_code, transaction_type, quantity, order_id, lot_id, transaction_time | SERIAL PK, VARCHAR(50), VARCHAR(20), DECIMAL(12,3), VARCHAR(100), VARCHAR(50), TIMESTAMPTZ |
| `material_issue`           | id, order_id, material_code, quantity, issue_time                                 | SERIAL PK, VARCHAR(100), VARCHAR(50), DECIMAL(12,3), TIMESTAMPTZ                           |
| `material_consumption`     | id, order_id, material_code, consumed_qty, consumed_at                            | SERIAL PK, VARCHAR(100), VARCHAR(50), DECIMAL(12,3), TIMESTAMPTZ                           |
| `inventory_count`          | id, material_code, location_id, counted_qty, count_date                           | SERIAL PK, VARCHAR(50), VARCHAR(50), DECIMAL(12,3), DATE                                   |
| `inventory_reconciliation` | id, material_code, planned_qty, actual_qty, variance, status                      | SERIAL PK, VARCHAR(50), DECIMAL(12,3), DECIMAL(12,3), DECIMAL(12,3), VARCHAR(50)           |
| `lots`                     | id, lot_code, material_code, order_id, machine_id, quantity                       | SERIAL PK, VARCHAR(50), VARCHAR(50), VARCHAR(100), VARCHAR(50), DECIMAL(12,3)              |
| `batches`                  | id, batch_code, lot_id, quantity                                                  | SERIAL PK, VARCHAR(50), VARCHAR(50) FK, DECIMAL(12,3)                                      |
| `wip`                      | id, machine_id, area_id, quantity                                                 | SERIAL PK, VARCHAR(50), VARCHAR(50), DECIMAL(12,3)                                         |
| `lot_genealogy`            | id, lot_id, parent_lot_id, child_lot_id                                           | SERIAL PK, VARCHAR(50), VARCHAR(50), VARCHAR(50)                                           |


**Schedule:**


| Bảng            | Cột chính                                                                                                   | Kiểu dữ liệu                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `shifts`        | id, shift_number, start_time, end_time, handover_time, handover_by, received_by, handover_notes, shift_date | VARCHAR(50) PK, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, VARCHAR(255), VARCHAR(255), TEXT, DATE |
| `dispatch_list` | id, order_id, machine_id, priority, planned_start, sequence                                                 | SERIAL PK, VARCHAR(100), VARCHAR(50), INTEGER, TIMESTAMPTZ, INTEGER                                    |
| `setup_times`   | id, machine_id, from_product_id, to_product_id, duration_minutes                                            | SERIAL PK, VARCHAR(50), VARCHAR(50), VARCHAR(50), INTEGER                                              |


**Recipe/Parameter:**


| Bảng        | Cột chính                                                         | Kiểu dữ liệu                                                     |
| ----------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| `recipes`   | id, recipe_id, version, machine_id, parameters JSONB, approved_at | SERIAL PK, VARCHAR(50), INTEGER, VARCHAR(50), JSONB, TIMESTAMPTZ |
| `setpoints` | id, machine_id, parameter_name, value, updated_at                 | SERIAL PK, VARCHAR(50), VARCHAR(50), DECIMAL(12,4), TIMESTAMPTZ  |


**Audit & Compliance:**


| Bảng           | Cột chính                                                               | Kiểu dữ liệu                                                                          |
| -------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `audit_log`    | id, user_id, action, entity, entity_id, old_value, new_value, timestamp | SERIAL PK, INTEGER, VARCHAR(50), VARCHAR(50), VARCHAR(100), JSONB, JSONB, TIMESTAMPTZ |
| `e_signatures` | id, user_id, action, entity_id, signature_data, timestamp               | SERIAL PK, INTEGER, VARCHAR(50), VARCHAR(100), TEXT, TIMESTAMPTZ                      |


**Multi-Plant & Data Governance:**


| Bảng              | Cột chính                              | Kiểu dữ liệu                                                   |
| ----------------- | -------------------------------------- | -------------------------------------------------------------- |
| `plants`          | id, plant_code, name                   | SERIAL PK, VARCHAR(10), VARCHAR(100)                           |
| `lines`           | id, line_code, name, area_id, plant_id | SERIAL PK, VARCHAR(50), VARCHAR(100), VARCHAR(50), VARCHAR(50) |
| `kpi_definitions` | id, name, formula, unit, scope         | SERIAL PK, VARCHAR(100), TEXT, VARCHAR(20), VARCHAR(50)        |


### 8.3 Inventory – Tồn kho

*Phân hệ tồn kho: nguyên liệu, WIP, thành phẩm. Đồng bộ với SAP/ERP.*


| Tagname                          | Cột CSDL                            | Kiểu dữ liệu  | API Field              | Nguồn dữ liệu                                                   | Mô tả                                |
| -------------------------------- | ----------------------------------- | ------------- | ---------------------- | --------------------------------------------------------------- | ------------------------------------ |
| `{Warehouse}_MaterialCode`       | `inventory.material_code`           | VARCHAR(50)   | `materialCode`         | SAP/ERP đồng bộ hoặc nhập khi nhập/xuất kho                     | Mã vật tư                            |
| `{Warehouse}_Quantity`           | `inventory.quantity`                | DECIMAL(12,3) | `quantity`             | Cập nhật khi nhập/xuất/điều chỉnh (API/Tablet) hoặc đồng bộ SAP | Số lượng tồn                         |
| `{Warehouse}_Unit`               | `inventory.unit`                    | VARCHAR(20)   | `unit`                 | Từ material_master hoặc nhập khi tạo vị trí tồn                 | Đơn vị (kg, m, cuộn)                 |
| `{Location}_StockLevel`          | `inventory.stock_level`             | DECIMAL(12,3) | `stockLevel`           | Tổng quantity theo location_id; hoặc API cập nhật               | Mức tồn theo vị trí                  |
| `{Order}_MaterialIssued`         | `material_issue.quantity`           | DECIMAL(12,3) | `materialIssued`       | Kho/Tablet ghi khi xuất NVL cho lệnh (API POST material_issue)  | Vật tư đã xuất cho lệnh              |
| `{Order}_MaterialConsumed`       | `material_consumption.consumed_qty` | DECIMAL(12,3) | `materialConsumed`     | Cân/PLC báo hoặc nhập tay khi đóng lệnh; có thể đồng bộ SAP     | Vật tư tiêu hao thực tế              |
| `{Order}_MaterialBom`            | `order_bom.bom_qty`                 | DECIMAL(12,3) | `materialBom`          | SAP/ERP đồng bộ BOM khi nhận lệnh; hoặc Planner nhập            | Định mức vật tư (BOM)                |
| `{Machine}_WIP`                  | `wip.quantity`                      | DECIMAL(12,3) | `wipQuantity`          | MES tổng hợp sản lượng đang chạy chưa đóng lệnh tại máy         | WIP tại máy                          |
| `{Area}_WIP`                     | `wip.quantity`                      | DECIMAL(12,3) | `wipQuantity`          | MES tổng hợp WIP theo area                                      | WIP theo khu vực                     |
| `Inventory_LastCount`            | `inventory_count.count_date`        | DATE          | `lastCountDate`        | Kho/Tablet ghi khi kiểm kê (API POST inventory_count)           | Lần kiểm kê gần nhất                 |
| `Inventory_ReconciliationStatus` | `inventory_reconciliation.status`   | VARCHAR(50)   | `reconciliationStatus` | Cập nhật khi chạy đối soát (plan vs actual) hoặc thủ công       | Trạng thái đối soát (plan vs actual) |


**Bảng Inventory (đề xuất):**

Các bảng dưới đây hỗ trợ quản lý tồn kho, giao dịch nhập/xuất, kiểm kê và đối soát với kế hoạch/SAP.

#### 8.3.1 Bảng `inventory` – Tồn kho theo vật tư & vị trí

| Tagname                | Cột CSDL        | Kiểu dữ liệu  | Ràng buộc              | Nguồn dữ liệu                                                        | Mô tả                                  |
| ---------------------- | --------------- | ------------- | ---------------------- | -------------------------------------------------------------------- | -------------------------------------- |
| `-`                    | `id`            | SERIAL PK     | NOT NULL, PK           | MES sinh tự động                                                     | ID bản ghi tồn kho                     |
| `{Warehouse}_MaterialCode` | `material_code` | VARCHAR(50)   | NOT NULL, FK → `material_master.material_code` | Đồng bộ từ SAP/ERP hoặc chọn từ danh mục vật tư           | Mã vật tư                               |
| `-`                    | `location_id`   | VARCHAR(50)   | NOT NULL               | Kho/vị trí cấu hình trong MES/ERP                                   | Vị trí/kho lưu trữ (vd: WH01-RACK-A1)  |
| `{Warehouse}_Quantity` | `quantity`      | DECIMAL(12,3) | NOT NULL, DEFAULT 0    | MES cập nhật theo `inventory_transactions`                          | Số lượng tồn hiện tại                  |
| `{Warehouse}_Unit`     | `unit`          | VARCHAR(20)   | NOT NULL               | Từ `material_master` hoặc khai báo khi tạo vị trí                    | Đơn vị (kg, m, cuộn, ...)              |
| `-`                    | `reserved_qty`  | DECIMAL(12,3) | NOT NULL, DEFAULT 0    | MES tính từ các lệnh đã giữ vật tư nhưng chưa xuất kho               | Số lượng đã giữ chỗ (reserved)         |
| `-`                    | `last_updated`  | TIMESTAMPTZ   | NOT NULL, DEFAULT now()| MES tự ghi khi có giao dịch ảnh hưởng tới tồn                        | Thời điểm cập nhật tồn kho gần nhất    |


#### 8.3.2 Bảng `inventory_transactions` – Giao dịch nhập/xuất/điều chỉnh

| Tagname | Cột CSDL          | Kiểu dữ liệu  | Ràng buộc                      | Nguồn dữ liệu                                                         | Mô tả                                         |
| ------- | ----------------- | ------------- | ------------------------------ | --------------------------------------------------------------------- | --------------------------------------------- |
| `-`     | `id`              | SERIAL PK     | NOT NULL, PK                   | MES sinh tự động khi ghi giao dịch                                   | ID giao dịch tồn kho                          |
| `-`     | `material_code`   | VARCHAR(50)   | NOT NULL, FK → `material_master.material_code` | Quét/nhập mã vật tư hoặc đồng bộ từ SAP                      | Mã vật tư liên quan                           |
| `-`     | `transaction_type`| VARCHAR(20)   | NOT NULL                       | MES/Tablet ghi `IN`/`OUT`/`ADJUST`                                   | Loại giao dịch: Nhập, Xuất, Điều chỉnh        |
| `-`     | `quantity`        | DECIMAL(12,3) | NOT NULL                       | Kho nhập số lượng (theo đơn vị của material)                         | Số lượng +/− theo giao dịch                   |
| `-`     | `unit`            | VARCHAR(20)   | NULLABLE                       | Tự điền theo `material_code`                                        | Đơn vị (kg, m, cuộn, ...)                     |
| `-`     | `order_id`        | VARCHAR(100)  | NULLABLE, FK → `production_orders.id` | Nếu giao dịch gắn với lệnh sản xuất                          | Lệnh sản xuất liên quan (nếu có)              |
| `-`     | `lot_id`          | VARCHAR(50)   | NULLABLE                       | Nếu giao dịch theo lô/coil                                          | Lô/cuộn liên quan                             |
| `-`     | `transaction_time`| TIMESTAMPTZ   | NOT NULL                       | MES ghi theo thời gian quét/ghi giao dịch                           | Thời điểm phát sinh giao dịch                 |
| `-`     | `created_by`      | VARCHAR(255)  | NOT NULL                       | User đăng nhập trên Tablet/UI hoặc user tích hợp API                 | Người thực hiện giao dịch                     |


#### 8.3.3 Bảng `material_issue` – Xuất vật tư theo lệnh (BOM)

| Tagname                | Cột CSDL      | Kiểu dữ liệu  | Ràng buộc                    | Nguồn dữ liệu                                          | Mô tả                               |
| ---------------------- | ------------- | ------------- | ---------------------------- | ------------------------------------------------------ | ----------------------------------- |
| `-`                    | `id`          | SERIAL PK     | NOT NULL, PK                 | MES sinh khi ghi phiếu xuất NVL cho lệnh              | ID bản ghi xuất vật tư             |
| `-`                    | `order_id`    | VARCHAR(100)  | NOT NULL, FK → `production_orders.id` | Kho/Planner chọn lệnh khi xuất NVL            | Lệnh sản xuất                       |
| `-`                    | `material_code`| VARCHAR(50)  | NOT NULL, FK → `material_master.material_code` | Quét/nhập mã vật tư hoặc đồng bộ ERP         | Mã vật tư được xuất                 |
| `{Order}_MaterialIssued` | `quantity`    | DECIMAL(12,3) | NOT NULL                     | Kho nhập theo phiếu xuất/BOM                          | Số lượng xuất (theo BOM)           |
| `-`                    | `unit`        | VARCHAR(20)   | NULLABLE                     | Tự điền theo material                                  | Đơn vị                              |
| `-`                    | `issue_time`  | TIMESTAMPTZ   | NOT NULL                     | MES ghi khi xác nhận phiếu xuất                       | Thời điểm xuất NVL                  |
| `-`                    | `issued_by`   | VARCHAR(255)  | NOT NULL                     | User kho/Tablet hoặc user tích hợp API                 | Người xuất vật tư                   |


#### 8.3.4 Bảng `material_consumption` – Tiêu hao thực tế trên lệnh

| Tagname                  | Cột CSDL       | Kiểu dữ liệu  | Ràng buộc                    | Nguồn dữ liệu                                                        | Mô tả                                 |
| ------------------------ | -------------- | ------------- | ---------------------------- | -------------------------------------------------------------------- | ------------------------------------- |
| `-`                      | `id`           | SERIAL PK     | NOT NULL, PK                 | MES sinh khi ghi tiêu hao thực tế                                   | ID bản ghi tiêu hao                   |
| `-`                      | `order_id`     | VARCHAR(100)  | NOT NULL, FK → `production_orders.id` | MES tính từ cân/PLC hoặc kho nhập tay khi đóng lệnh         | Lệnh sản xuất                         |
| `-`                      | `material_code`| VARCHAR(50)   | NOT NULL, FK → `material_master.material_code` | Lấy từ phiếu xuất hoặc nhập tay                         | Mã vật tư                             |
| `{Order}_MaterialConsumed` | `consumed_qty` | DECIMAL(12,3) | NOT NULL                     | Cân/PLC đo, hoặc operator nhập khi đóng lệnh                        | Số lượng tiêu hao thực tế             |
| `-`                      | `unit`         | VARCHAR(20)   | NULLABLE                     | Tự điền theo material                                               | Đơn vị                                |
| `-`                      | `consumed_at`  | TIMESTAMPTZ   | NOT NULL                     | MES ghi khi xác nhận tiêu hao                                       | Thời điểm ghi nhận tiêu hao           |
| `-`                      | `machine_id`   | VARCHAR(50)   | NULLABLE, FK → `machines.id` | Nếu tiêu hao gắn với máy cụ thể (cân online theo máy)               | Máy liên quan                         |


#### 8.3.5 Bảng `inventory_count` – Kiểm kê

| Tagname             | Cột CSDL      | Kiểu dữ liệu  | Ràng buộc            | Nguồn dữ liệu                                     | Mô tả                             |
| ------------------- | ------------- | ------------- | -------------------- | ------------------------------------------------- | --------------------------------- |
| `-`                 | `id`          | SERIAL PK     | NOT NULL, PK         | MES sinh khi tạo phiếu kiểm kê                    | ID bản ghi kiểm kê                |
| `-`                 | `material_code`| VARCHAR(50)  | NOT NULL, FK → `material_master.material_code` | Chọn/scan vật tư                      | Mã vật tư kiểm kê                 |
| `-`                 | `location_id` | VARCHAR(50)   | NOT NULL             | Chọn kho/vị trí kiểm kê                           | Vị trí kiểm kê                    |
| `-`                 | `counted_qty` | DECIMAL(12,3) | NOT NULL             | Người kiểm kê nhập tay hoặc từ thiết bị cân       | Số lượng đếm được                 |
| `-`                 | `unit`        | VARCHAR(20)   | NULLABLE             | Tự điền theo material                              | Đơn vị                             |
| `Inventory_LastCount` | `count_date`  | DATE          | NOT NULL             | MES ghi ngày kiểm kê                              | Ngày kiểm kê                      |
| `-`                 | `counted_by`  | VARCHAR(255)  | NOT NULL             | Người kiểm kê nhập trên Tablet/UI                 | Người thực hiện kiểm kê           |


#### 8.3.6 Bảng `inventory_reconciliation` – Đối soát kế hoạch vs thực tế

| Tagname                        | Cột CSDL            | Kiểu dữ liệu  | Ràng buộc            | Nguồn dữ liệu                                           | Mô tả                                         |
| ------------------------------ | ------------------- | ------------- | -------------------- | ------------------------------------------------------- | --------------------------------------------- |
| `-`                            | `id`                | SERIAL PK     | NOT NULL, PK         | MES sinh khi chạy đối soát                              | ID bản ghi đối soát                           |
| `-`                            | `material_code`     | VARCHAR(50)   | NOT NULL, FK → `material_master.material_code` | Lấy theo vật tư cần đối soát               | Mã vật tư                                    |
| `-`                            | `planned_qty`       | DECIMAL(12,3) | NOT NULL             | Từ kế hoạch/SAP/BOM (ERP)                               | Số lượng kế hoạch                             |
| `-`                            | `actual_qty`        | DECIMAL(12,3) | NOT NULL             | Từ tồn kho/transactions sau kiểm kê                    | Số lượng thực tế                             |
| `-`                            | `variance`          | DECIMAL(12,3) | NOT NULL             | MES tính = `actual_qty - planned_qty`                  | Chênh lệch (thực - kế hoạch)                 |
| `-`                            | `reconciliation_date`| DATE         | NOT NULL             | Ngày chạy job đối soát hoặc ngày kiểm kê               | Ngày đối soát                                 |
| `Inventory_ReconciliationStatus` | `status`            | VARCHAR(50)   | NOT NULL             | MES/Planner cập nhật (`ok`, `investigate`, `adjusted`) | Trạng thái xử lý chênh lệch                   |


**Tag còn thiếu:** `{Material}_MinStock`, `{Material}_MaxStock`, `{Material}_ReorderPoint` (mức tồn tối thiểu/tối đa/điểm đặt hàng)

### 8.4 Mapping Tag → CSDL MES

*Chi tiết xem `config/mes-tag-mapping.json`.*

### 8.5 Ghi chú Tagname theo hệ thống (SAP | MES | Tablet)

Để tra cứu nhanh **tagname nào phục vụ SAP, nào chỉ MES nội bộ, nào nhập từ Tablet**, dùng quy ước sau. Thông tin chi tiết từng tag vẫn nằm ở cột **Nguồn dữ liệu** trong các mục 2–8 và ở **mục 9 (CSDL SAP)**.

**Quy ước:**

| Ký hiệu   | Ý nghĩa |
| --------- | ------- |
| **SAP**   | Tag đồng bộ **từ SAP** (nhận lệnh, BOM, master) hoặc **ghi/đẩy lên SAP** (confirmation, material document, scrap). Xem mục 9.1, 9.2, 9.3. |
| **MES**   | Tag lưu **trong CSDL MES** (nội bộ). Nguồn có thể là PLC, API, SAP, Tablet, MES tính – nhưng **đích lưu trữ** là MES. |
| **Tablet**| Tag có **nguồn nhập chính từ Tablet/App** (operator, QC, Planner, Kho): quét QR, bàn giao ca, downtime, NCR, action plan, kiểm kê, v.v. |

**Bảng tham chiếu nhanh – Tag theo hệ thống:**

| Hệ thống | Nhóm tag / Ví dụ |
| -------- | ----------------- |
| **SAP**  | `Order_SapOrderId`, `Order_ConfirmationStatus`, `Order_SyncToSapAt`, `Order_SyncToSapStatus`, `Order_ScrapToSap`; `{Order}_SalesOrderId`, `{Order}_LineItem`, `{Order}_ProductionOrderYear`, `{Order}_ProductionProposalId`; `{Machine}_OrderId`, `{Machine}_MaterialCode`; `{Coil}_WeightNet`, `{Coil}_WeightGross`, `{Coil}_SampleCode`, `{Order}_MaterialBom`, `{Order}_MaterialConsumed` (đồng bộ SAP). Toàn bộ trường trong **mục 9.3** ánh xạ SAP ↔ MES. *Không đưa operator chính/phụ lên SAP để tránh phình CSDL SAP.* |
| **MES**  | Phần lớn tagname trong tài liệu: Production (2.x), Quality (3.x), Equipment (4.x), Analytics (5.x), Maintenance (6.x), Schedule (7.x), Inventory (8.3). Tag **chỉ lưu/đọc trong MES** (PLC→API→PostgreSQL, MES tính, API PUT/POST). |
| **Tablet** | `Order_StartTime`, `Order_EndTime`, `Order_Status` (khi bấm Start/End); `Order_QRScanTime`, `Order_QRScanBy`; `{Machine}_OperatorName`, `{Machine}_OperatorMain`, `{Machine}_OperatorAux` (Planner/Tablet gán, lưu MES; không đồng bộ SAP); `Shift_*` (handover, received_by, handover_notes); `{Machine}_Downtime*`, reason/downtime nhập Tablet; `ActionPlan_*`; QC result, NCR, defect; `inventory_transactions.created_by`, `inventory_count.counted_by`; maintenance request. Các bảng **reason_codes**, **downtime_events**, **action_plans**, **quality_inspections**, **ncr** – nhập/cập nhật từ Tablet. |

*Lưu ý:* Một tag có thể vừa **MES** (lưu trong DB) vừa **SAP** (đồng bộ hai chiều) hoặc vừa **MES** vừa **Tablet** (nguồn nhập từ Tablet, lưu MES). Cột **Nguồn dữ liệu** trong từng bảng vẫn là nơi mô tả chính xác nhất.

---

## 9. CSDL SAP

### 9.1 Trường đồng bộ SAP (đề xuất)


| Tag / Trường               | Kiểu dữ liệu | Mô tả                          |
| -------------------------- | ------------ | ------------------------------ |
| `Order_SapOrderId`         | VARCHAR(100) | Mã đơn hàng SAP                |
| `Order_ConfirmationStatus` | VARCHAR(50)  | Trạng thái xác nhận sản xuất   |
| `Order_SyncToSapAt`        | TIMESTAMPTZ  | Thời điểm đồng bộ lên SAP      |
| `Order_SyncToSapStatus`    | VARCHAR(50)  | `success`, `pending`, `failed` |
| `Order_ScrapToSap`         | BOOLEAN/TEXT | Báo cáo phế phẩm lên SAP       |


### 9.2 Luồng đồng bộ

Tổng quan:

```
MES (production_orders, coils, material_consumption) ←→ SAP (Production Order, Confirmation, Material Document)
```

Các ví dụ đồng bộ cụ thể (chi tiết trường/tag xem mục 9.1, 9.3):

#### 9.2.1 SAP → MES (nhận dữ liệu từ SAP)

| Luồng | Nguồn SAP | Đích MES | Tag / Bảng MES | Ghi chú |
| ----- | --------- | -------- | ----------------- | ------- |
| Nhận lệnh sản xuất | Production Order (CO41/CO40) | `production_orders` | `{Machine}_OrderId`, `{Order}_OrderCode`, `Order_TargetLength`, `Order_SalesOrderId`, `Order_LineItem`, `Order_ProductionOrderYear`, `Order_ProductionProposalId` | SAP gửi **lệnh sx** xuống MES và xuống từng màn hình tablet (theo máy/công đoạn). Khi release lệnh → API/EDI đẩy sang MES, tạo bản ghi order. |
| Nhận BOM / định mức | BOM (CS01), Material Requirement | `order_bom`, `material_consumption` (planned) | `{Order}_MaterialBom`, `{Order}_MaterialCode` | SAP gửi **cùng lúc với lệnh sx**: BOM của lệnh đó xuống MES/tablet để tablet biết định mức vật tư, thực hiện xuất NVL và ghi tiêu hao theo lệnh. |
| Nhận danh mục vật tư | Material Master (MM03) | `material_master` | `{Material}_MaterialCode`, tên quy cách | Đồng bộ mã vật tư, đơn vị |
| Nhận workcenter / máy | Work Center (CR01), Capacity | `machines`, `lines` | `machine_id` = workcenter SAP (vd: LT1BD751) | Ánh xạ máy MES ↔ Work Center SAP (mục 1.3.1) |
| Nhận ca / lịch | SAP PP calendar, Shift | `shifts` | `Shift_*`, `current_shift_id` | Nếu ca lấy từ SAP (tùy triển khai) |

#### 9.2.2 MES → SAP (ghi kết quả lên SAP)

| Luồng | Nguồn MES | Đích SAP | Tag / Bảng MES | Ghi chú |
| ----- | --------- | -------- | ----------------- | ------- |
| Xác nhận sản xuất (Confirmation) | `production_orders`, `production_length_events`, `coils` | Production Order Confirmation (CO11N/CO15) | `Order_ProducedLength`, `Order_StartTime`, `Order_EndTime`, `{Machine}_WeightNet`, `{Machine}_WeightGross`, `{Coil}_SampleCode`, `{Machine}_Status` | Gửi khi đóng lệnh hoặc theo ca; SAP cập nhật quantity confirmed, yield |
| Chứng từ vật tư (Material Document) | `material_consumption`, `material_issue` | Material Document (MIGO) – Goods Issue / Consumption | `{Order}_MaterialConsumed`, `{Order}_MaterialIssued` | Tiêu hao thực tế / xuất NVL theo lệnh → SAP ghi consumption |
| Báo phế phẩm | `production_orders` (scrap), `machines.produced_length_ng` | Scrap posting, NCR (tùy cấu hình SAP) | `Order_ScrapToSap`, `{Machine}_ProducedLengthNG` | Số lượng NG / scrap đẩy lên SAP để điều chỉnh tồn và cost |
| Trạng thái lệnh | `production_orders.status` | Production Order status (release/complete) | `Order_Status`, `Order_ConfirmationStatus` | Cập nhật trạng thái lệnh trên SAP (running, completed, …) |
| Đồng bộ cuộn / lot | `coils` | Batch, Huong (tùy module SAP) | `{Coil}_CoilId`, `{Coil}_WeightNet`, `{Coil}_WeightGross`, `{Lot}_BatchNumber` | Khi đóng cuộn, gửi thông tin cuộn/lô lên SAP nếu cần |

#### 9.2.3 Đồng bộ hai chiều (SAP ↔ MES)

| Luồng | Mô tả | Tag / Bảng | Ghi chú |
| ----- | ----- | ---------- | ------- |
| Lệnh sản xuất | SAP release → MES nhận; MES xác nhận xong → SAP cập nhật confirmed | `production_orders`, `Order_SapOrderId`, `Order_ConfirmationStatus`, `Order_SyncToSapAt`, `Order_SyncToSapStatus` | Trạng thái đồng bộ lưu trong MES (9.1) |
| Vật tư tiêu hao | BOM từ SAP → MES; tiêu hao thực tế MES → SAP Material Doc | `order_bom`, `material_consumption`, `{Order}_MaterialBom`, `{Order}_MaterialConsumed` | Một chiều từng bước hoặc hai chiều tùy tích hợp |

#### 9.2.4 Nếu SAP không gửi BOM – Hụt dữ liệu / Ảnh hưởng

| Hạng mục | Hụt / Ảnh hưởng |
| -------- | ------------------- |
| Định mức vật tư theo lệnh | Tablet/MES không biết lệnh cần **mã vật tư nào, số lượng bao nhiêu** → không có chuẩn để xuất NVL và ghi tiêu hao theo lệnh. |
| Xuất kho / ghi tiêu hao chuẩn | Xuất NVL và ghi tiêu hao phải **nhập tay hoặc dựa BOM khác** (Excel, BOM local MES) → dễ sai, trùng dữ liệu, không đồng bộ SAP. |
| So sánh định mức vs thực tế | Không có **số lượng kế hoạch (BOM)** → không so được định mức vs tiêu hao thực tế, không báo chênh lệch vật tư theo lệnh. |
| Chứng từ vật tư lên SAP (MIGO) | SAP cần consumption **gắn đúng component BOM** của lệnh. Không có BOM từ SAP → MES gửi lên thiếu cấu trúc BOM hoặc SAP khó nhận / đối soát. |
| Costing / variance trong SAP | Phân tích **giá vốn, chênh lệch vật tư (usage variance)** dựa BOM + tiêu hao thực tế. Thiếu BOM đồng bộ → dữ liệu costing/variance không đáng tin hoặc thiếu. |
| Traceability / truy xuất | Khó báo cáo chuẩn **vật tư nào (mã/lô) dùng cho lệnh nào** theo đúng cấu trúc BOM → truy xuất nguồn gốc yếu. |

*Kết luận:* Cần gửi **BOM cùng lệnh sản xuất** xuống MES/tablet để tránh hụt dữ liệu trên.

*Chi tiết trường SAP ↔ Tag MES theo từng nhóm máy – mục 9.3.*

### 9.3 Ánh xạ trường SAP ↔ MES theo nhóm máy

*Các trường SAP yêu cầu để tích hợp đồng bộ SAP–MES. Mỗi nhóm máy có bộ trường riêng.*

#### 9.3.1 Nhóm Nguyên liệu (Raw Materials)


| Trường SAP (Field Description) | Tag MES                    | Cột CSDL                        | Kiểu dữ liệu  | Bảng                                            | Ghi chú                               |
| ------------------------------ | -------------------------- | ------------------------------- | ------------- | ----------------------------------------------- | ------------------------------------- |
| Material Number                | `{Material}_MaterialCode`  | `material_code`                 | VARCHAR(50)   | `material_master`, `inventory`, `lots`          | Mã vật tư                             |
| Batch Number                   | `{Lot}_BatchNumber`        | `batch_code`, `lot_code`        | VARCHAR(50)   | `lots`, `batches`                               | Mã lô                                 |
| ID cuộn                        | `{Coil}_CoilId`            | `coil_id`                       | VARCHAR(50)   | `coils`, `inventory`                            | Mã cuộn NVL                           |
| Lệnh sản xuất                  | `{Order}_OrderId`          | `production_order_id`           | VARCHAR(100)  | `production_orders`, `coils`                    | Mã lệnh                               |
| Ca sản xuất                    | `Shift_Current`            | `shift_id`, `current_shift_id`  | VARCHAR(50)   | `shifts`, `machines`                            | Ca 1/2/3                              |
| Ngày sản xuất                  | `Order_ProductionDate`     | `production_date`, `shift_date` | DATE          | `production_orders`, `production_length_events` | Ngày sản xuất                         |
| Khối lượng tinh (Net)          | `{Coil}_WeightNet`         | `weight_net_kg`                 | DECIMAL(12,3) | `coils`, `inventory_transactions`               | kg                                    |
| Khối lượng tổng (Gross)        | `{Coil}_WeightGross`       | `weight_gross_kg`               | DECIMAL(12,3) | `coils`                                         | kg (bao gồm turê)                     |
| Mã sample                      | `{Coil}_SampleCode`        | `sample_code`                   | VARCHAR(50)   | `coils`                                         | Mã mẫu kiểm tra                       |
| Trạng thái                     | `{Coil}_Status`            | `status`                        | VARCHAR(50)   | `coils`                                         | `available`, `consumed`, `quarantine` |
| Ghi chú                        | `{Coil}_Notes`             | `notes`                         | TEXT          | `coils`                                         | Ghi chú                               |
| Loại turê                      | `{Coil}_BobbinType`        | `bobbin_type`                   | VARCHAR(50)   | `coils`, `bobbins`                              | Loại ống chỉ                          |
| Định mức vật tư                | `{Order}_MaterialBom`      | `bom_qty`, `material_bom`       | DECIMAL(12,3) | `material_consumption`, `order_bom`             | Định mức BOM                          |
| Vật tư tiêu hao thực tế        | `{Order}_MaterialConsumed` | `consumed_qty`                  | DECIMAL(12,3) | `material_consumption`                          | Tiêu hao thực tế                      |


#### 9.3.2 Nhóm Máy kéo (Drawing)


| Trường SAP              | Tag MES                        | Cột CSDL                            | Kiểu dữ liệu  | Bảng                   | Ghi chú           |
| ----------------------- | ------------------------------ | ----------------------------------- | ------------- | ---------------------- | ----------------- |
| Material Number         | `{Machine}_MaterialCode`       | `material_code`                     | VARCHAR(50)   | `machines`, `coils`    | Mã vật tư         |
| Batch Number            | `{Machine}_BatchNumber`        | `batch_code`                        | VARCHAR(50)   | `coils`                | Mã lô             |
| ID cuộn                 | `{Machine}_CoilId`             | `coil_id`                           | VARCHAR(50)   | `coils`                | ID cuộn           |
| Lệnh sản xuất           | `{Machine}_OrderId`            | `production_order_id`               | VARCHAR(100)  | `machines`, `coils`    |                   |
| Ca sản xuất             | `{Machine}_CurrentShiftId`     | `current_shift_id`                  | VARCHAR(50)   | `machines`             |                   |
| Ngày sản xuất           | `{Machine}_ProductionDate`     | `production_date`                   | DATE          | `coils`                |                   |
| Khối lượng tinh (Net)   | `{Machine}_WeightNet`          | `weight_net_kg`                     | DECIMAL(12,3) | `coils`                |                   |
| Khối lượng tổng (Gross) | `{Machine}_WeightGross`        | `weight_gross_kg`                   | DECIMAL(12,3) | `coils`                |                   |
| Mã sample               | `{Machine}_SampleCode`         | `sample_code`                       | VARCHAR(50)   | `coils`                |                   |
| Trạng thái              | `{Machine}_Status`             | `status`                            | VARCHAR(50)   | `machines`, `coils`    |                   |
| Ghi chú                 | `{Machine}_Notes`              | `notes`                             | TEXT          | `coils`                |                   |
| Loại turê               | `{Machine}_BobbinType`         | `bobbin_type`                       | VARCHAR(50)   | `coils`, `bobbins`     |                   |
| Số Đơn hàng/Hợp đồng    | `{Order}_SalesOrderId`         | `sales_order_id`, `contract_number` | VARCHAR(100)  | `production_orders`    | Đơn hàng SAP      |
| Line Item               | `{Order}_LineItem`             | `line_item`                         | VARCHAR(50)   | `production_orders`    | Dòng đơn hàng     |
| Năm của phiếu DNSX      | `{Order}_ProductionOrderYear`  | `production_order_year`             | INTEGER       | `production_orders`    | Năm phiếu đề nghị |
| Phiếu Đề nghị sản xuất  | `{Order}_ProductionProposalId` | `production_proposal_id`            | VARCHAR(100)  | `production_orders`    | Mã phiếu DNSX     |
| Vật tư tiêu hao thực tế | `{Order}_MaterialConsumed`     | `consumed_qty`                      | DECIMAL(12,3) | `material_consumption` |                   |


#### 9.3.3 Nhóm Máy xoắn (Stranding)

*Giống Máy kéo, thêm:*


| Trường SAP  | Tag MES                  | Cột CSDL         | Kiểu dữ liệu  | Bảng    | Ghi chú       |
| ----------- | ------------------------ | ---------------- | ------------- | ------- | ------------- |
| Số mét đầu  | `{Machine}_LengthStartM` | `length_start_m` | DECIMAL(12,2) | `coils` | Mét đầu cuộn  |
| Số mét cuối | `{Machine}_LengthEndM`   | `length_end_m`   | DECIMAL(12,2) | `coils` | Mét cuối cuộn |


*Các trường còn lại:* Material Number, Batch Number, ID cuộn, Lệnh sản xuất, Ca sản xuất, Ngày sản xuất, Khối lượng tinh/Gross, Mã sample, Trạng thái, Ghi chú, Loại turê, Số Đơn hàng, Line Item, Năm phiếu DNSX, Phiếu Đề nghị sản xuất, Vật tư tiêu hao thực tế.

#### 9.3.4 Nhóm Máy Giáp (Armoring)

*Giống Máy xoắn, thêm:*


| Trường SAP  | Tag MES          | Cột CSDL | Kiểu dữ liệu | Bảng                         | Ghi chú     |
| ----------- | ---------------- | -------- | ------------ | ---------------------------- | ----------- |
| Đơn vị tính | `{Machine}_Unit` | `unit`   | VARCHAR(20)  | `coils`, `production_orders` | kg, m, cuộn |


*Các trường còn lại:* Material Number, Batch Number, ID cuộn, Lệnh sản xuất, Ca sản xuất, Ngày sản xuất, Khối lượng tinh/Gross, Số mét đầu/cuối, Mã sample, Trạng thái, Ghi chú, Loại turê, Số Đơn hàng, Line Item, Năm phiếu DNSX, Phiếu Đề nghị sản xuất, Vật tư tiêu hao thực tế.

#### 9.3.5 Nhóm Máy Bọc (Sheathing)

*Giống Máy xoắn* – đủ: Material Number, Batch Number, ID cuộn, Lệnh sản xuất, Ca sản xuất, Ngày sản xuất, Khối lượng tinh/Gross, Số mét đầu/cuối, Mã sample, Trạng thái, Ghi chú, Loại turê, Số Đơn hàng, Line Item, Năm phiếu DNSX, Phiếu Đề nghị sản xuất, Vật tư tiêu hao thực tế.

#### 9.3.6 Nhóm Máy Tráng thiếc (Tinning)

*Giống Máy xoắn* – cùng bộ trường.

#### 9.3.7 Nhóm Bảo trì (Maintenance – Dữ liệu chi tiết gửi SAP)


| Trường SAP (Dữ liệu chi tiết)     | Tag MES                                           | Cột CSDL                           | Kiểu dữ liệu        | Bảng                              | Ghi chú                               |
| --------------------------------- | ------------------------------------------------- | ---------------------------------- | ------------------- | --------------------------------- | ------------------------------------- |
| Mã thiết bị                       | `{Machine}_MachineId`                             | `machine_id`                       | VARCHAR(50)         | `machines`                        | Mã máy                                |
| Ca sản xuất                       | `{Machine}_CurrentShiftId`                        | `shift_id`                         | VARCHAR(50)         | `shifts`, `machines`              |                                       |
| Mã sản phẩm                       | `{Machine}_ProductCode`                           | `product_code`, `material_code`    | VARCHAR(50)         | `machines`, `production_orders`   |                                       |
| Mã lệnh sản xuất                  | `{Machine}_OrderId`                               | `production_order_id`              | VARCHAR(100)        | `machines`                        |                                       |
| Thời gian chạy máy thực tế        | `{Machine}_RuntimeActual`                         | `runtime_actual_seconds`           | INTEGER             | `machine_shift_summary`           | Giờ chạy thực (không tính setup/dừng) |
| Tổng thời gian hoạt động thực tế  | `{Machine}_TotalOperatingTime`                    | `total_operating_time_seconds`     | INTEGER             | `machine_shift_summary`           | Bao gồm setup, dừng máy               |
| Tốc độ chạy máy thực tế           | `{Machine}_LineSpeed`                             | `line_speed`, `actual_speed`       | DECIMAL(10,2)       | `machines`, `machine_metrics`     | m/min                                 |
| Tốc độ chạy máy tối đa            | `{Machine}_MaxSpeed`                              | `max_speed`, `target_speed`        | DECIMAL(10,2)       | `machines`                        | m/min                                 |
| Hiệu suất tổng thể thiết bị (OEE) | `{Machine}_OEE`                                   | `oee`                              | DECIMAL(5,2)        | `machines`, `oee_calculations`    | %                                     |
| Công nhân vận hành (chính/phụ)    | `{Machine}_OperatorMain`, `{Machine}_OperatorAux` | `operator_main`, `operator_aux`    | VARCHAR(255)        | `machines`, `shift_operators`     | Chỉ MES/Tablet; không đồng bộ SAP   |
| Sản lượng đạt                     | `{Machine}_ProducedLengthOK`                      | `produced_length_ok`               | DECIMAL(12,2)       | `machines`                        | m                                     |
| Sản lượng không đạt               | `{Machine}_ProducedLengthNG`                      | `produced_length_ng`               | DECIMAL(12,2)       | `machines`                        | m                                     |
| Sản lượng thực tế                 | `{Machine}_ProducedLength`                        | `produced_length`                  | DECIMAL(12,2)       | `machines`                        | m                                     |
| Nguyên nhân dừng máy              | `{Machine}_DowntimeReason`                        | `reason_id`, `reason_code`         | INTEGER/VARCHAR(50) | `downtime_events`, `reason_codes` | Mã lý do                              |
| Biện pháp khắc phục               | `ActionPlan_Description`                          | `corrective_action`, `description` | TEXT                | `action_plans`, `downtime_events` |                                       |


### 9.4 Bảng & cột MES cần bổ sung cho SAP

**Bảng `coils*`* – mở rộng cho SAP:


| Cột               | Kiểu          | Mô tả                                                |
| ----------------- | ------------- | ---------------------------------------------------- |
| `weight_net_kg`   | DECIMAL(12,3) | Khối lượng tinh                                      |
| `weight_gross_kg` | DECIMAL(12,3) | Khối lượng tổng                                      |
| `sample_code`     | VARCHAR(50)   | Mã sample                                            |
| `notes`           | TEXT          | Ghi chú                                              |
| `length_start_m`  | DECIMAL(12,2) | Số mét đầu (Stranding, Armoring, Sheathing, Tinning) |
| `length_end_m`    | DECIMAL(12,2) | Số mét cuối                                          |
| `unit`            | VARCHAR(20)   | Đơn vị tính (kg, m, cuộn) – Armoring                 |
| `production_date` | DATE          | Ngày sản xuất                                        |
| `bobbin_type`     | VARCHAR(50)   | Loại turê                                            |


**Bảng `production_orders`** – cột SAP:


| Cột                      | Kiểu         | Mô tả                                       |
| ------------------------ | ------------ | ------------------------------------------- |
| `sales_order_id`         | VARCHAR(100) | Số Đơn hàng/Hợp đồng                        |
| `line_item`              | VARCHAR(50)  | Line Item                                   |
| `production_order_year`  | INTEGER      | Năm của phiếu DNSX                          |
| `production_proposal_id` | VARCHAR(100) | Phiếu Đề nghị sản xuất                      |
| `sap_order_id`           | VARCHAR(100) | Mã đơn SAP (nếu khác id)                    |
| `mrp_controller`         | VARCHAR(10)  | Mã MRP Controller (102–122, xem bảng 1.3.2) |


**Bảng `machine_shift_summary`** (đề xuất – cho Bảo trì/SAP):


| Cột                            | Kiểu           | Mô tả                      |
| ------------------------------ | -------------- | -------------------------- |
| `id`                           | SERIAL PK      |                            |
| `machine_id`                   | VARCHAR(50) FK |                            |
| `shift_id`                     | VARCHAR(50)    |                            |
| `shift_date`                   | DATE           |                            |
| `production_order_id`          | VARCHAR(100)   |                            |
| `product_code`                 | VARCHAR(50)    |                            |
| `runtime_actual_seconds`       | INTEGER        | Thời gian chạy máy thực tế |
| `total_operating_time_seconds` | INTEGER        | Tổng thời gian hoạt động   |
| `actual_speed_avg`             | DECIMAL(10,2)  | Tốc độ TB thực tế          |
| `max_speed`                    | DECIMAL(10,2)  | Tốc độ tối đa              |
| `oee`                          | DECIMAL(5,2)   | OEE                        |
| `operator_main`                | VARCHAR(255)   | Công nhân chính            |
| `operator_aux`                 | VARCHAR(255)   | Công nhân phụ              |
| `produced_length_ok`           | DECIMAL(12,2)  | Sản lượng đạt              |
| `produced_length_ng`           | DECIMAL(12,2)  | Sản lượng không đạt        |
| `produced_length`              | DECIMAL(12,2)  | Sản lượng thực tế          |
| `downtime_reason_ids`          | TEXT[]         | Danh sách reason_id        |
| `corrective_actions`           | TEXT           | Biện pháp khắc phục        |


**Bảng `order_bom`** (đề xuất – Định mức vật tư):


| Cột                   | Kiểu            | Mô tả             |
| --------------------- | --------------- | ----------------- |
| `id`                  | SERIAL PK       |                   |
| `production_order_id` | VARCHAR(100) FK |                   |
| `material_code`       | VARCHAR(50)     |                   |
| `bom_qty`             | DECIMAL(12,3)   | Định mức theo BOM |
| `unit`                | VARCHAR(20)     | kg, m             |


### 9.5 Luồng đồng bộ SAP–MES (chi tiết từng bước)

#### 9.5.1 SAP → MES (Nhận dữ liệu từ SAP)


| Bước | Hành động                                    | Hệ thống  | Dữ liệu                                                 | Ghi chú                      |
| ---- | -------------------------------------------- | --------- | ------------------------------------------------------- | ---------------------------- |
| 1    | SAP tạo/giải phóng lệnh sản xuất             | SAP       | Production Order (Auffrag)                              | Lệnh sẵn sàng sản xuất       |
| 2    | SAP gửi lệnh qua API/IDoc/BAPI               | SAP → MES | Order header, operations, BOM                           | Định kỳ hoặc real-time       |
| 3    | MES nhận và validate dữ liệu                 | MES       | Kiểm tra material_code, machine_id, dates               | Trả lỗi nếu thiếu/bất hợp lệ |
| 4    | MES ghi vào `production_orders`, `order_bom` | MES       | production_order_id, sales_order_id, line_item, bom_qty | Trạng thái `pending`         |
| 5    | MES đồng bộ material master (nếu cần)        | MES       | material_master, material_code                          | Cập nhật danh mục vật tư     |
| 6    | Dispatch: gán lệnh cho máy/ca                | MES       | machine_id, shift_id                                    | Operator/Planner thực hiện   |


#### 9.5.2 MES → SAP (Gửi dữ liệu lên SAP)


| Bước | Hành động                                      | Hệ thống  | Dữ liệu                                      | Ghi chú                                           |
| ---- | ---------------------------------------------- | --------- | -------------------------------------------- | ------------------------------------------------- |
| 1    | Kết thúc lệnh / đóng ca                        | MES       | production_orders.status = `completed`       | Hoặc theo từng cuộn/coil                          |
| 2    | MES tổng hợp confirmation                      | MES       | produced_length_ok/ng, consumed_qty, runtime | Từ production_length_events, material_consumption |
| 3    | MES gọi API SAP (Confirmation)                 | MES → SAP | BAPI_ALM_CONF_CREATE hoặc tương đương        | Production confirmation                           |
| 4    | SAP xử lý confirmation                         | SAP       | Cập nhật order, goods movement               | Trừ tồn kho, cập nhật chi phí                     |
| 5    | MES gửi Material Document (tiêu hao)           | MES → SAP | material_consumption → SAP MM                | Nếu tách riêng khỏi confirmation                  |
| 6    | MES ghi `sync_to_sap_at`, `sync_to_sap_status` | MES       | production_orders                            | Đánh dấu đã đồng bộ                               |
| 7    | SAP trả kết quả (success/error)                | SAP → MES | Return code, message                         | MES cập nhật status, log lỗi nếu có               |


#### 9.5.3 Sơ đồ luồng (Mermaid)

```
sequenceDiagram
    participant SAP
    participant MES
    participant PLC

    Note over SAP,MES: SAP → MES (Nhận lệnh)
    SAP->>MES: Production Order (API/IDoc)
    MES->>MES: Validate & Save
    MES->>SAP: ACK / Error

    Note over MES,PLC: Sản xuất
    MES->>PLC: Dispatch order
    PLC->>MES: Realtime data (speed, length, OK/NG)

    Note over MES,SAP: MES → SAP (Confirmation)
    MES->>MES: Aggregate (length, consumption)
    MES->>SAP: Production Confirmation (BAPI)
    SAP->>MES: Success / Error
    MES->>MES: Update sync status
```

### 9.6 Bảng mapping mã lỗi SAP

*Khi đồng bộ SAP–MES gặp lỗi, MES cần ánh xạ mã lỗi SAP sang hành động xử lý.*

#### 9.6.1 Mã lỗi SAP thường gặp (đề xuất)


| Mã lỗi SAP | Mô tả                                          | Hành động MES                                                   | Retry            |
| ---------- | ---------------------------------------------- | --------------------------------------------------------------- | ---------------- |
| `RC001`    | Order not found / Đơn không tồn tại            | Kiểm tra sap_order_id, báo Planner                              | Không            |
| `RC002`    | Material not in SAP / Vật tư chưa có trong SAP | Cập nhật material_master từ SAP, liên hệ Master Data            | Không            |
| `RC003`    | Quantity variance / Chênh lệch số lượng        | Kiểm tra produced_length, consumed_qty; điều chỉnh hoặc báo cáo | Có (sau khi sửa) |
| `RC004`    | Order already confirmed / Đơn đã xác nhận      | Bỏ qua hoặc ghi log; không gửi lại                              | Không            |
| `RC005`    | Invalid date format / Định dạng ngày sai       | Chuyển đổi theo chuẩn SAP (YYYYMMDD hoặc ISO 8601)              | Có               |
| `RC006`    | Connection timeout / Hết thời gian kết nối     | Retry 2–3 lần với backoff; nếu vẫn lỗi → queue để sync sau      | Có               |
| `RC007`    | Authorization failed / Lỗi phân quyền          | Kiểm tra user SAP, quyền BAPI                                   | Không            |
| `RC008`    | Batch/lot invalid / Lô không hợp lệ            | Kiểm tra batch_code, lot_code; đảm bảo tồn tại trong SAP        | Có (sau khi sửa) |
| `RC009`    | Work center/machine not in SAP                 | Cập nhật master data máy trong SAP                              | Không            |
| `RC010`    | Generic system error                           | Log chi tiết, thông báo Admin; retry sau 15 phút                | Có               |


#### 9.6.2 Chiến lược xử lý lỗi


| Trạng thái      | Mô tả                             | Hành động                                   |
| --------------- | --------------------------------- | ------------------------------------------- |
| `pending`       | Chưa gửi SAP                      | Đưa vào queue, gửi khi có kết nối           |
| `retry`         | Lỗi tạm thời (timeout, network)   | Retry tự động 2–3 lần                       |
| `manual_review` | Lỗi dữ liệu (RC001, RC002, RC003) | Chuyển Planner/Supervisor xử lý thủ công    |
| `failed`        | Lỗi không khắc phục được          | Log, báo Admin; không retry tự động         |
| `success`       | Đồng bộ thành công                | Cập nhật sync_to_sap_at, sync_to_sap_status |


#### 9.6.3 Bảng `sap_sync_log` (đề xuất)


| Cột               | Kiểu         | Mô tả                                                   |
| ----------------- | ------------ | ------------------------------------------------------- |
| `id`              | SERIAL PK    |                                                         |
| `entity_type`     | VARCHAR(50)  | `production_order`, `material_document`, `confirmation` |
| `entity_id`       | VARCHAR(100) | ID bản ghi MES                                          |
| `direction`       | VARCHAR(20)  | `sap_to_mes`, `mes_to_sap`                              |
| `sync_at`         | TIMESTAMP    | Thời điểm gửi/nhận                                      |
| `status`          | VARCHAR(50)  | `success`, `failed`, `retry`, `manual_review`           |
| `sap_return_code` | VARCHAR(50)  | Mã trả về SAP                                           |
| `sap_message`     | TEXT         | Thông báo lỗi/chi tiết                                  |
| `payload_summary` | JSONB        | Tóm tắt dữ liệu (để debug)                              |
| `retry_count`     | INTEGER      | Số lần retry                                            |


### 9.7 Đặc tả định dạng dữ liệu SAP–MES

*Chuẩn hóa kiểu dữ liệu, độ dài, format để đảm bảo tương thích khi gửi/nhận SAP.*

#### 9.7.1 Ngày và thời gian


| Trường           | Format MES               | Format SAP (ví dụ)           | Ghi chú                     |
| ---------------- | ------------------------ | ---------------------------- | --------------------------- |
| Ngày             | `YYYY-MM-DD` (ISO 8601)  | `YYYYMMDD` hoặc `YYYY-MM-DD` | Tùy BAPI/IDoc               |
| Thời gian        | `HH:mm:ss` hoặc `HHmmss` | `HHMMSS`                     | 24h                         |
| Timestamp đầy đủ | `YYYY-MM-DDTHH:mm:ssZ`   | `YYYYMMDDHHMMSS`             | UTC hoặc local tùy cấu hình |


#### 9.7.2 Số và đơn vị


| Trường          | Kiểu MES | Độ dài | Đơn vị         | Ghi chú   |
| --------------- | -------- | ------ | -------------- | --------- |
| Chiều dài (m)   | DECIMAL  | 12,2   | m              | Không âm  |
| Khối lượng (kg) | DECIMAL  | 12,3   | kg             | Không âm  |
| OEE, %          | DECIMAL  | 5,2    | %              | 0–100     |
| Tốc độ          | DECIMAL  | 10,2   | m/min hoặc m/s | Theo area |
| Số lượng        | DECIMAL  | 12,3   | Theo unit      |           |


#### 9.7.3 Chuỗi (String)


| Trường               | Độ dài tối đa | Ký tự cho phép         | Ghi chú                           |
| -------------------- | ------------- | ---------------------- | --------------------------------- |
| workcenter (SAP)     | 20            | Alphanumeric           | VD: LT1BD751 (Plant+Area+Machine) |
| material_code        | 50            | Alphanumeric, `-`, `_` | Không khoảng trắng đầu/cuối       |
| production_order_id  | 100           | Alphanumeric, `-`, `_` |                                   |
| batch_code, lot_code | 50            | Alphanumeric           |                                   |
| coil_id              | 50            | Alphanumeric           |                                   |
| sales_order_id       | 100           | Theo chuẩn SAP         |                                   |
| line_item            | 50            | Số hoặc mã             |                                   |
| sample_code          | 50            | Alphanumeric           |                                   |
| operator_name        | 255           | Unicode (UTF-8)        | Hỗ trợ tiếng Việt                 |
| notes                | 500 hoặc TEXT | Unicode                | Cắt bớt nếu vượt độ dài SAP       |


#### 9.7.4 Enum / Trạng thái


| Trường         | Giá trị MES                         | Giá trị SAP (ví dụ)          | Ghi chú                    |
| -------------- | ----------------------------------- | ---------------------------- | -------------------------- |
| Order status   | `running`, `completed`, `cancelled` | `REL`, `PCNF`, `TECO`        | Cần bảng mapping MES ↔ SAP |
| Machine status | `running`, `idle`, `error`          | Theo chuẩn SAP PM            |                            |
| Shift          | `1`, `2`, `3`                       | `1`, `2`, `3` hoặc mã ca SAP |                            |


#### 9.7.5 Bảng mapping trạng thái Order (MES ↔ SAP)


| MES status    | SAP status (ví dụ) | Mô tả                        |
| ------------- | ------------------ | ---------------------------- |
| `pending`     | `CRTD` / `REL`     | Chưa bắt đầu / Đã giải phóng |
| `running`     | `REL`              | Đang sản xuất                |
| `completed`   | `PCNF` / `TECO`    | Đã xác nhận / Đã kết thúc    |
| `cancelled`   | `TECO` / `DLV`     | Hủy / Đã giao                |
| `interrupted` | `REL`              | Tạm dừng (chưa đóng)         |


*Lưu ý: Giá trị SAP thực tế phụ thuộc cấu hình SAP (PP module, order type). Cần xác nhận với team SAP.*

---

## 10. CSDL ERP

### 10.1 Trường đồng bộ ERP (đề xuất)


| Tag / Trường           | Kiểu dữ liệu | Mô tả                      |
| ---------------------- | ------------ | -------------------------- |
| `Order_ErpOrderId`     | VARCHAR(100) | Mã đơn ERP                 |
| `Material_ErpCode`     | VARCHAR(50)  | Mã vật tư ERP              |
| `Customer_ErpCode`     | VARCHAR(50)  | Mã khách hàng ERP          |
| `Inventory_SyncStatus` | VARCHAR(50)  | Trạng thái đồng bộ tồn kho |


### 10.2 Luồng đồng bộ

```
MES ←→ ERP (Orders, Materials, Inventory)
```

*Chi tiết tích hợp ERP cần bổ sung theo hệ thống thực tế.*

---

## 11. API & Integration

### 11.1 Endpoint MES


| Method | Endpoint                               | Mô tả                          |
| ------ | -------------------------------------- | ------------------------------ |
| `PUT`  | `/api/machines/name/:machineName`      | Cập nhật máy (PLC/Node-RED)    |
| `GET`  | `/api/machines`                        | Danh sách máy                  |
| `GET`  | `/api/machines/:machineId`             | Chi tiết máy                   |
| `POST` | `/api/machines/:machineId/metrics`     | Ghi metrics (time series)      |
| `POST` | `/api/machines/:machineId/alarms`      | Tạo alarm                      |
| `POST` | `/api/orders`                          | Tạo đơn hàng                   |
| `PUT`  | `/api/orders/:orderId`                 | Cập nhật đơn hàng              |
| `GET`  | `/api/orders`                          | Danh sách đơn hàng             |
| `GET`  | `/api/machines/:machineId/maintenance` | Lịch bảo trì (đề xuất)         |
| `POST` | `/api/maintenance`                     | Tạo kế hoạch bảo trì (đề xuất) |
| `POST` | `/api/events`                          | Ghi sự kiện sản xuất (Tablet)  |
| `POST` | `/api/downtime`                        | Ghi downtime + reason (Tablet) |
| `GET`  | `/api/reason-codes`                    | Danh mục lý do                 |
| `GET`  | `/api/event-codes`                     | Danh mục sự kiện               |
| `GET`  | `/api/shifts`                          | Danh sách ca                   |
| `POST` | `/api/shifts/:shiftId/handover`        | Bàn giao ca                    |
| `POST` | `/api/coils`                           | Tạo/ghi cuộn sản phẩm          |
| `POST` | `/api/bobbins`                         | Đăng ký bobbin                 |


### 11.2 Quy tắc chuyển đổi


| PLC/SCADA → API                             | Ví dụ                             |
| ------------------------------------------- | --------------------------------- |
| Bỏ prefix Plant/Area khi dùng `machineName` | `P01_D01_LineSpeed` → `lineSpeed` |
| Snake_case → camelCase                      | `line_speed` → `lineSpeed`        |
| Enum giữ nguyên lowercase                   | `running`, `idle`, `warning`      |


### 11.3 File cấu hình

- `config/mes-tag-mapping.json` – Mapping tagname PLC → API/DB
- `backend/node-red-mes-flow.json` – Flow Node-RED mẫu

### 11.4 Ví dụ payload (camelCase)

```json
{
  "status": "running",
  "lineSpeed": 920,
  "targetSpeed": 1000,
  "current": 45.2,
  "power": 68.5,
  "temperature": 68,
  "producedLength": 3850,
  "producedLengthOk": 3820,
  "producedLengthNg": 30,
  "productionOrderId": "PO-2025-001",
  "productName": "Cáp CV 3x2.5mm²",
  "customer": "Công ty ABC",
  "materialCode": "MAT-001",
  "operatorName": "Nguyễn Văn A",
  "multiZoneTemperatures": { "zone1": 65, "zone2": 68 }
}
```

---

## Phụ lục: Ví dụ tagname theo máy

### Drawing (D-01, D-02, D-03)

```
D01_Status, D01_LineSpeed, D01_TargetSpeed, D01_LengthCounter
D01_Current, D01_Power, D01_Temperature, D01_TempZone1…10
D01_OrderId, D01_ProductName, D01_CustomerName, D01_MaterialCode, D01_OperatorName
D01_CoilId, D01_BobbinId, D01_BobbinWeight, D01_PktIn, D01_PktOut
D01_HealthScore, D01_VibrationLevel, D01_RuntimeHours
```

### Stranding (S-01, S-02) / Sheathing (SH-01, SH-02)

```
S01_Status, S01_LineSpeed, S01_TargetSpeed, ...
```

### SAP Workcenter (LT1BD751 – Máy bọc dân dụng)

```
LT1BD751_Status, LT1BD751_LineSpeed, LT1BD751_OrderId
LT1BD751_ProducedLength, LT1BD751_ProducedLengthOK, LT1BD751_ProducedLengthNG
LT1BD751_CoilId, LT1BD751_WeightNet, LT1BD751_WeightGross
```

*Cấu trúc: LT (Plant) + 1 (Area) + BD751 (Machine) – xem mục 1.3.1.*

---

## Phê duyệt & thay đổi


| Phiên bản | Ngày       | Thay đổi                                                                                                                                                                                                                                                                                     |
| --------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0       | 2025-02-25 | Phiên bản đầu                                                                                                                                                                                                                                                                                |
| 1.1–1.3   | 2025-02-25 | Bổ sung Reason Codes, Event Codes, chuyên ngành dây cáp                                                                                                                                                                                                                                      |
| 1.4       | 2025-02-25 | Sắp xếp lại theo nhóm: Overview, Production, Quality, Equipment, Analytics, Maintenance, Schedule, CSDL MES/SAP/ERP, API                                                                                                                                                                     |
| 1.5       | 2025-02-25 | Bổ sung chi tiết: Data source, Line, Production events, Order scans, SPC, Downtime/Root cause, Action plans, Shifts, coils/bobbins, Inventory/Traceability, Audit, Recipe, cấu trúc bảng đầy đủ                                                                                              |
| 1.6       | 2025-02-25 | Ánh xạ trường SAP theo nhóm máy: Nguyên liệu, Máy kéo, Máy xoắn, Máy Giáp, Máy Bọc, Máy Tráng thiếc, Bảo trì. Bổ sung coils (weight_net/gross, sample_code, length_start/end, unit), production_orders (sales_order_id, line_item, production_proposal_id), order_bom, machine_shift_summary |
| 1.7       | 2025-02-25 | Bổ sung 9.5 Luồng đồng bộ SAP–MES (từng bước, sơ đồ Mermaid), 9.6 Bảng mapping mã lỗi SAP + sap_sync_log, 9.7 Đặc tả định dạng dữ liệu (ngày, số, chuỗi, enum)                                                                                                                               |
| 1.8       | 2025-02-25 | Ví dụ SAP Workcenter LT1BD751 (Plant.LT + Area.1 + Machine.BD751) – mục 1.3.1, Phụ lục                                                                                                                                                                                                       |
| 1.9       | 2025-02-25 | Bảng kí hiệu máy (BD, KD, KN, TT, XB, XS, BC, GB, BM, LH, LU, …) – diễn giải cấu trúc Machine                                                                                                                                                                                                |
| 1.10      | 2025-02-25 | Bảng kí hiệu Plant (LT, TA, DN, BN) – Long Thành, Tân Á/Sài Gòn, Đà Nẵng, Bắc Ninh                                                                                                                                                                                                           |
| 1.11      | 2025-02-25 | Bảng MRP Controller (102–122) – Kéo, Xoắn, Bọc, Giáp, Tạo hạt, Nhôm… (SAP PP)                                                                                                                                                                                                                |


---

**Tài liệu tham khảo:**

- ISA-95 (Enterprise-Control System Integration)
- AVEVA_MES_requirements.md
- backend/database/schema.sql
- MES_ENTERPRISE_DATA_ARCHITECTURE.md

