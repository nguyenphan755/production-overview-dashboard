/**
 * Chiều dài sản xuất hiển thị / bobbin / tiến độ: luôn ưu tiên mét OK (`producedLengthOk`).
 * Chỉ fallback `producedLength` khi backend chưa gửi trường OK (tương thích dữ liệu cũ).
 */
export function effectiveProducedLengthOkM(
  o: { producedLengthOk?: number | null; producedLength?: number | null } | null | undefined
): number {
  if (o == null) return 0;
  const ok = o.producedLengthOk;
  if (typeof ok === 'number' && !Number.isNaN(ok)) return ok;
  return o.producedLength ?? 0;
}
