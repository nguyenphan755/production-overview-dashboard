# UI/UX performance — baseline checklist (Phase 0)

Use Chrome DevTools (hoặc Edge) trước và sau khi chỉnh polling/render.

## Network

1. Mở tab **Production** — Network: đếm request `/api/machines` / phút (mục tiêu: không trùng nhiều hook cùng endpoint).
2. Chuyển **Equipment** → chọn máy → đếm `/api/machines/:id`, `/api/analytics`, `/api/.../status-history`.
3. Đổi filter OEE — ghi thời gian response chậm nhất.

## Performance

1. Performance → Record: đổi tab 5 lần, dừng — xem **Long tasks** > 50ms.
2. **document.hidden**: thu nhỏ tab trình duyệt 10s — xác nhận không còn spam request (khi đã bật pause theo visibility).

## Kết quả ghi lại

| Bước | Trước (ms / req-phút) | Sau |
|------|------------------------|-----|
| machines (Production) | | |
| Equipment detail | | |

Cập nhật bảng sau mỗi đợt tối ưu.
