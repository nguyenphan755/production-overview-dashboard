import pandas as pd
from pathlib import Path


def main() -> None:
    path = Path(
        r"c:\Users\Admin\OneDrive - CÔNG TY CP DÂY CÁP ĐIỆN VIỆT NAM\WORKSPACE\25. MES\0.2 TIEN DO\MES_Tagname_Mapping_IIoT_Shopfloor_v1.0.xlsx"
    )
    if not path.exists():
        print(f"File not found: {path}")
        return

    xls = pd.ExcelFile(path)
    print("SHEETS:")
    for name in xls.sheet_names:
        print(f"- {name}")

    first = xls.sheet_names[0]
    df = pd.read_excel(xls, sheet_name=first)
    print(f"\nCOLUMNS (ascii-stripped) of sheet '{first}':")
    cols = [str(c) for c in df.columns]
    safe_cols = [c.encode("ascii", "ignore").decode("ascii") for c in cols]
    print(safe_cols)

    print("\nFIRST 5 ROWS (ascii-stripped) of sheet '{first}':")
    for _, row in df.head(5).iterrows():
        vals = [str(v) for v in row.tolist()]
        safe_vals = [v.encode("ascii", "ignore").decode("ascii") for v in vals]
        print(safe_vals)


if __name__ == "__main__":
    main()

