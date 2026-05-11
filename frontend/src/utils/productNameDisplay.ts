/** Tailwind bundle may omit arbitrary `text-[#FACC15]` — use inline color for reliable yellow */
export const UNKNOWN_LIKE_PRODUCT_TEXT_COLOR = '#FACC15';

export function isUnknownLikeProductName(label: string | undefined | null): boolean {
  const s = label?.trim();
  if (!s) return false;
  return /^(unknown_product|uknow_product)$/i.test(s);
}

export function unknownLikeProductInlineStyle(
  label: string | undefined | null
): { color: string } | undefined {
  return isUnknownLikeProductName(label)
    ? { color: UNKNOWN_LIKE_PRODUCT_TEXT_COLOR }
    : undefined;
}