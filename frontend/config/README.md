# MES Configuration

Thư mục cấu hình cho hệ thống MES Production Overview Dashboard.

## Files

| File | Mô tả |
|------|-------|
| `mes-tag-mapping.json` | Mapping tagname PLC/SCADA → API field → DB column |

## Sử dụng

- **Đối tác tích hợp PLC/SCADA**: Dùng `mes-tag-mapping.json` để cấu hình Kepserver, OPC UA client, hoặc Node-RED.
- **Lãnh đạo / PM**: Tham chiếu `docs/MES_TAG_NAMING_STANDARD.md` để nắm quy chuẩn tagname.

## Luồng dữ liệu

```
PLC → Kepserver/OPC UA → Node-RED → PUT /api/machines/name/:machineName → PostgreSQL
```

Xem chi tiết: `docs/MES_TAG_NAMING_STANDARD.md`
