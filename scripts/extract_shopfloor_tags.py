#!/usr/bin/env python3
"""
Đọc MES_Tagname_Mapping_IIoT_Shopfloor_v1.0.xlsx và in ra danh sách
tag PLC (tên trường Name) theo từng sheet ở dạng markdown.
"""
from pathlib import Path

import math
import pandas as pd


def is_nan(v) -> bool:
    try:
        return v is None or (isinstance(v, float) and math.isnan(v))
    except Exception:
        return False


def extract_tags_from_sheet(df: pd.DataFrame) -> list[str]:
    tags: list[str] = []
    # Mỗi UDT là block 4 cột: Name, Data Type, Description, (ngăn cách = NaN)
    # Hàng tiêu đề thường ở dòng index 2 (thứ 3) với các giá trị "Name"
    name_cols = []
    header_candidates = [2, 3]
    for hdr_row in header_candidates:
        if hdr_row >= len(df.index):
            continue
        row_vals = df.iloc[hdr_row].tolist()
        for i, c in enumerate(row_vals):
            if str(c).strip().lower() == "name":
                name_cols.append(i)
        if name_cols:
            break
    for col_idx in name_cols:
        col_series = df.iloc[3:, col_idx]  # sau dòng tiêu đề
        for v in col_series:
            if is_nan(v):
                continue
            s = str(v).strip()
            if not s or s.lower().startswith("name") or s.startswith("//"):
                continue
            if s not in tags:
                tags.append(s)
    return tags


def main() -> None:
    path = Path(
        r"c:\Users\Admin\OneDrive - CÔNG TY CP DÂY CÁP ĐIỆN VIỆT NAM\WORKSPACE\25. MES\0.2 TIEN DO\MES_Tagname_Mapping_IIoT_Shopfloor_v1.0.xlsx"
    )
    if not path.exists():
        print(f"File not found: {path}")
        return

    xls = pd.ExcelFile(path)
    for sheet_name in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet_name, header=None)
        tags = extract_tags_from_sheet(df)
        print(f"### {sheet_name}")
        for t in tags:
            print(f"- `{t}`")
        print()


if __name__ == "__main__":
    main()

