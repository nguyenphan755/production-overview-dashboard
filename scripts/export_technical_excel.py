#!/usr/bin/env python3
"""
Đọc file MES_TAG_Technical.xlsx của nhà máy và ghi toàn bộ nội dung
ra file text UTF-8 để dễ xem trong dự án.
"""
import os
from pathlib import Path


def main() -> None:
    try:
        import openpyxl
    except ImportError:
        import sys
        os.system(f'"{sys.executable}" -m pip install openpyxl -q')
        import openpyxl  # type: ignore[redefined-builtin]

    project_dir = Path(__file__).resolve().parents[1]

    # Ưu tiên lấy file gốc trong Downloads
    downloads_path = Path.home() / "Downloads" / "MES_TAG_Technical.xlsx"
    if downloads_path.exists():
        excel_path = downloads_path
    else:
        excel_path = project_dir / "MES_TAG_Technical.xlsx"

    if not excel_path.exists():
        print("Không tìm thấy MES_TAG_Technical.xlsx tại:", excel_path)
        return

    out_path = project_dir / "scripts" / "technical_export.txt"

    wb = openpyxl.load_workbook(excel_path, data_only=True)
    with out_path.open("w", encoding="utf-8") as f:
        for sheet in wb.worksheets:
            f.write(f"=== Sheet: {sheet.title}\n")
            for row in sheet.iter_rows(values_only=True):
                f.write(repr(row) + "\n")
            f.write("\n")

    print("WROTE", out_path)


if __name__ == "__main__":
    main()

