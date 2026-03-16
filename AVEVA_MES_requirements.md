## Checklist yeu cau tong the gui AVEVA

## 1) Production Operations Management
- [ ] Order lifecycle: nhan lenh tu SAP -> phan ca/may -> dispatch -> start/stop/pause -> close -> xac nhan ve SAP.
- [ ] Shop floor execution: start/end san xuat theo lenh; ly do dung may (downtime reason code); ghi nhan OK/NG (so luong/khoi luong).
- [ ] Machine & process selection: gan may, cong doan, routing; kiem soat dung cong doan theo lenh.
- [ ] Nhap lenh san xuat: quet QR (QR-based dispatch), ho tro nhap tay khi khong co QR.
- [ ] Shift handling: ca lam viec, lich ca, doi ca; KPI theo ca, theo may, theo lenh.
- [ ] Realtime data capture: tu dong tu PLC/SCADA (toc do, trang thai, OEE); manual entry khi mat ket noi.
- [ ] OEE realtime & historical: A/P/Q tung may, line, ca, ngay; downtime Pareto, loss category.
- [ ] Production confirmation: confirmation, bao cao san luong, scrap ve SAP.
- [ ] Audit trail & trace: ai thao tac gi, khi nao, tren lenh nao.

## 2) Quality Operations Management
- [ ] QC workflow: ke hoach kiem tra -> nhap ket qua -> OK/NG -> NCR neu loi.
- [ ] Defect classification: danh muc loi (defect code); phan loai scrap (tai che/sua/chap nhan).
- [ ] SPC/Statistical QC: bieu do kiem soat, gioi han tren/duoi.
- [ ] Traceability quality: loi gan theo lot/batch/may/ca/lenh.
- [ ] Q in OEE: tu dong cap nhat Quality loss vao OEE.
- [ ] Quality reporting: scrap analysis, defect Pareto; trend loi theo may/san pham/ca.

## 3) Maintenance Operations Management
- [ ] Maintenance request tu shopfloor (tao ticket).
- [ ] PM/CM planning: lich PM theo may/gio chay; ghi nhan CM (sua chua khan).
- [ ] Integration voi CMMS (neu co): dong bo work order, trang thai.
- [ ] Downtime classification: ly do dung may do bao tri.
- [ ] Asset health view: MTBF/MTTR, top asset downtime.
- [ ] Maintenance reporting: Pareto downtime theo nguyen nhan bao tri.

## 4) Inventory Operations Management
- [ ] Material issue & consumption: BOM issue tu SAP; tieu hao thuc te tren lenh.
- [ ] WIP tracking: theo may/cong doan/ca.
- [ ] Lot/Batch/Genealogy: truy xuat nguon goc tu nguyen lieu -> ban thanh pham -> thanh pham.
- [ ] Inventory reconciliation: so sanh ke hoach vs thuc te.
- [ ] Integration SAP: dong bo ton kho, nhap/xuat.
- [ ] Traceability reporting: bao cao genealogy, lot history.

## 5) Corporate / Multi-Plant Reporting (Bao cao tap doan)
- [ ] Multi-plant roll-up: OEE, downtime, production vs plan, scrap theo plant.
- [ ] Benchmarking: so sanh line/plant theo KPI chuan hoa.
- [ ] Standardized KPI catalog: dinh nghia thong nhat KPI tap doan.
- [ ] Drill-down: tu corporate -> plant -> line -> machine.
- [ ] Data governance: chuan du lieu, kiem soat quality data.
- [ ] Security: phan quyen cap tap doan/nha may.

## 6) Big Losses Analytics (Six Big Losses)
- [ ] Six Big Losses chuan: Availability/Performance/Quality loss.
- [ ] Loss hierarchy: Category -> Reason code -> Root cause.
- [ ] Pareto theo may/ca/line/san pham/don hang.
- [ ] Live + historical: realtime & lich su.
- [ ] AI/Rules-based insights: khuyen nghi hanh dong.
- [ ] Action plan workflow: assign, track, close.
- [ ] Correlation: loss <-> process parameters.
- [ ] Severity / ranking: muc do uu tien xu ly.

## 7) Scheduling / Plant Scheduling System
- [ ] Finite capacity scheduling theo nang luc may.
- [ ] Constraint-based: vat tu, khuon, setup time, maintenance windows.
- [ ] What-if simulation: so sanh nhieu phuong an.
- [ ] Dispatch list: lenh theo ca, theo line/may.
- [ ] Changeover optimization: giam setup/SMED.
- [ ] Real-time rescheduling khi co downtime/thieu vat tu.
- [ ] Integration SAP: lay ke hoach, tra lich da toi uu.

## 8) Energy Monitoring (Giam sat nang luong)
- [ ] Thu thap du lieu dien/nang luong theo may/line/area (real-time & lich su).
- [ ] Do luong tieu thu theo ca/lenh/lo san xuat.
- [ ] KPI nang luong: kWh/ton, kWh/unit, chi phi nang luong tren san pham.
- [ ] Canh bao vuot nguong tieu thu, bat thuong (spike detection).
- [ ] Phan tich peak/off-peak, demand charge va ti le tai.
- [ ] Tich hop voi dong ho dien/energy meter (Modbus/TCP, OPC UA).
- [ ] Bao cao nang luong: trend, Pareto, benchmark theo may/line/plant.

## A) Data Governance & Master Data
- [ ] Danh muc chuan: Machine, Line, Area, Product, Process, Reason Code, Shift.
- [ ] KPI catalog chuan hoa toan nha may/tap doan.
- [ ] Quy tac dat ma (naming conventions).
- [ ] Quy trinh phe duyet & thay doi du lieu master.

## B) Audit Trail & e-Signature
- [ ] Nhat ky thao tac nguoi dung (ai lam gi, luc nao, o dau).
- [ ] Luu vet Start/Stop/Confirm/Override.
- [ ] e-Signature (neu yeu cau tuan thu ISO/GMP).
- [ ] Bao cao audit theo ca/lenh.

## C) Cybersecurity & Access Control
- [ ] Role-Based Access Control (Operator/Shift lead/Supervisor/Manager/Admin).
- [ ] MFA/SSO (Azure AD/LDAP).
- [ ] Phan quyen theo plant/line/machine.
- [ ] Log truy cap he thong.

## D) High Availability & Disaster Recovery
- [ ] Cluster/HA cho MES server.
- [ ] Backup lich trinh va restore test dinh ky.
- [ ] DR site (neu yeu cau tap doan).
- [ ] SLA thoi gian phuc hoi (RTO/RPO).

## E) Edge Buffering & Offline Mode
- [ ] Luu tam du lieu khi mat PLC/SAP.
- [ ] Dong bo lai khi mang hoi phuc.
- [ ] Canh bao mat ket noi.
- [ ] Quy tac conflict resolution.

## F) Alarm & Event Management
- [ ] Chuan hoa alarm/event codes.
- [ ] Escalation workflow (SMS/Email/Team).
- [ ] Canh bao theo muc do nghiem trong.
- [ ] Bao cao alarm Pareto.

## G) Performance & Scalability
- [ ] Kha nang xu ly so luong tag/PLC/may lon.
- [ ] Multi-plant/multi-line scale.
- [ ] SLA response time cho dashboard realtime.
- [ ] Load balancing.

## H) Change Management (Recipe/Parameter)
- [ ] Version control recipe/parameter.
- [ ] Approval workflow khi doi recipe.
- [ ] Traceability recipe theo lo/lenh.
- [ ] Audit trail cho parameter changes.

## I) Training & SOP Enablement
- [ ] Bo huong dan van hanh cho Operator/Supervisor.
- [ ] Tai lieu SOP tich hop vao EWI.
- [ ] Checklist dao tao nguoi dung.

## J) Multi-Language & Localization
- [ ] Ho tro song ngu Viet/Anh.
- [ ] Dinh dang thoi gian, ca, ngay theo locale.
- [ ] Quy tac phan quyen theo ngon ngu (neu co).

## K) Testing & Commissioning
- [ ] FAT/SAT/UAT ro rang.
- [ ] KPI validation truoc go-live.
- [ ] Ke hoach chay thu pilot.
- [ ] Cut-over plan & rollback plan.

## L) PLC/SCADA Communications
- [ ] Giao thuc PLC: TCP/IP, OPC UA.
- [ ] Tang thu thap du lieu realtime tu PLC/SCADA.

## M) Middleware / Integration Layer
- [ ] Kepserver cho ket noi da giao thuc PLC.
- [ ] Node-RED cho orchestration luong du lieu.
- [ ] API cho web (REST/JSON), webhook neu can.

## N) Database & Data Storage
- [ ] Operational DB: PostgreSQL.
- [ ] Time-series/Historian (neu dung): luu du lieu realtime, tan suat cao.
