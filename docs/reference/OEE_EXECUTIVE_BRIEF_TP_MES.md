# Executive Brief - OEE chuan AVEVA/Hydra + TPM

## Thong diep 1 dong
He thong da co nen tang OEE tot, nhung can chuan hoa KPI settlement de tranh "OEE dep so" do fallback du lieu, dac biet o Performance va Quality.

## 1) Hien trang nhanh
- OEE dang tinh theo cong thuc dung: `OEE = A x P x Q`.
- Availability da di theo huong shift-based va co aggregation.
- Tuy nhien, con mot so fallback co the lam KPI lac quan:
  - targetSpeed thieu -> Performance = 100.
  - Quality: **chinh sach phase hien tai** — mac dinh 100% **truoc khi tich hop NG**, nhung **bat buoc** co cờ `ASSUMED_100_PENDING_NG_INTEGRATION` va chu thich tren UI/bao cao (khong giau giong fallback Performance).

## 2) Rui ro quan tri neu giu nguyen
- KPI OEE cao hon thuc te, uu tien cai tien sai.
- Pareto losses co the khong phan anh dung nguyen nhan goc.
- Tranh cai giua bo phan van hanh, bao tri, chat luong khi doi chieu so.

## 3) Chuan muc de xuat
- Tach `Realtime KPI` va `Settled KPI` (official).
- Settled KPI KHONG cho phep fallback "mac dinh tot" khi thieu du lieu.
- Chuan hoa reason-code va mapping Six Big Losses toan nha may.
- Data quality flags bat buoc tren tung he so A/P/Q.

**Rulebook chi tiet (6.1 + 6.2 — ban hanh Phase 1):** [oee-rulebook-realtime-vs-settled.md](./oee-rulebook-realtime-vs-settled.md)

## 4) Ke hoach hanh dong uu tien

### 0-30 ngay (P0)
- Chot rulebook KPI:
  - Performance missing targetSpeed -> `null + dataQualityIssue`.
  - Quality (truoc NG): mac dinh 100% + cờ `ASSUMED_100_PENDING_NG_INTEGRATION`; sau NG -> khong mac dinh, thieu OK/NG -> `INSUFFICIENT_QUALITY_DATA`.
- Chinh API/dashboard de hien thi realtime vs settled tach biet.
- Dong bo docs theo logic shift-based hien tai.

### 30-60 ngay (P1)
- Ban hanh danh muc reason-code chuan.
- Chuan hoa mapping status/reason -> six big losses.
- Them dashboard theo doi do tin cay KPI (data completeness).

### 60-90 ngay (P2)
- Chot settlement theo production order va startup/yield losses.
- Co che review va phe duyet exception du lieu.

## 5) KPI mong doi sau chuan hoa
- OEE settled phan anh dung nang luc thiet bi.
- Loss Pareto co tinh hanh dong ro rang.
- Giam tranh cai KPI lien phong ban.
- Tang toc do ra quyet dinh cai tien OEE theo ca/ngay/tuan.

## 6) Quyết định can TP MES chot
1. Co thong nhat tach KPI realtime va settled tu thang nay khong?
2. Co thong nhat khong su dung fallback 100% cho settlement KPI khong?
3. Co giao mot owner cho bo reason-code six losses cap nha may khong?
