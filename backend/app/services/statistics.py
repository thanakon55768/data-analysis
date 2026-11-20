import json
import math

import numpy as np
import pandas as pd


def safe_number(value):
    if value is None or pd.isna(value):
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def compute_statistics(frame: pd.DataFrame, columns: list[dict]) -> dict:
    missing = frame.isna()
    result = {
        "row_count": len(frame),
        "column_count": len(columns),
        "missing_cells": int(missing.sum().sum()),
        "rows_with_missing": int(missing.any(axis=1).sum()),
        "duplicate_rows": int(frame.duplicated(keep="first").sum()),
        "numeric": [],
        "warnings": [],
    }
    for column in columns:
        if column["dtype"] != "number":
            continue
        source = pd.to_numeric(frame[column["id"]], errors="coerce").astype(float)
        finite = source[np.isfinite(source)]
        if int(np.isinf(source).sum()):
            result["warnings"].append(
                f"คอลัมน์ {column['label']} มีค่าที่ไม่เป็นตัวเลขจำกัด จึงไม่รวมค่าดังกล่าวในการคำนวณ"
            )
        with np.errstate(over="ignore", invalid="ignore"):
            metrics = {
                "sum": finite.sum(min_count=1),
                "mean": finite.mean(),
                "median": finite.median(),
                "min": finite.min(),
                "max": finite.max(),
            }
        result["numeric"].append(
            {
                "column_id": column["id"],
                "count": len(finite),
                "missing": int(source.isna().sum()),
                **{key: safe_number(value) for key, value in metrics.items()},
            }
        )
    return result


def build_preview(
    frame: pd.DataFrame, columns: list[dict], offset: int, limit: int, search: str
) -> dict:
    filtered = frame
    if search:
        needle = search.casefold()
        mask = frame.map(
            lambda value: (
                needle in str(value).casefold()
                if value is not None and not pd.isna(value)
                else False
            )
        ).any(axis=1)
        filtered = frame[mask]
    page = filtered.iloc[offset : offset + limit]
    rows = [
        {
            key: None if value is None or pd.isna(value) else value
            for key, value in row.items()
        }
        for row in page.to_dict(orient="records")
    ]
    result = {
        "columns": [dict(column) for column in columns],
        "rows": rows,
        "total_rows": len(frame),
        "filtered_rows": len(filtered),
        "offset": offset,
        "limit": limit,
        "warnings": [],
        "truncated_cells": [],
    }
    cap = 2 * 1024 * 1024

    def size():
        return len(
            json.dumps(result, ensure_ascii=False, allow_nan=False).encode("utf-8")
        )

    if size() > cap:
        while len(result["rows"]) > 1 and size() > cap:
            result["rows"] = result["rows"][: max(1, len(result["rows"]) // 2)]
        result["limit"] = max(1, len(result["rows"]))
        result["warnings"].append("ลดจำนวนแถวต่อหน้าอัตโนมัติเพื่อจำกัดข้อมูลตัวอย่างไม่เกิน 2 MB")
    if size() > cap:
        for column in result["columns"]:
            if len(column["label"]) > 1000:
                column["label"] = column["label"][:1000] + "…"
        for row in result["rows"]:
            for key, value in row.items():
                if isinstance(value, str) and len(value) > 1000:
                    row[key] = value[:1000] + "…"
                    if key not in result["truncated_cells"]:
                        result["truncated_cells"].append(key)
        result["warnings"].append(
            "ตัดข้อความยาวเฉพาะตัวอย่างบนหน้าจอ ข้อมูลต้นฉบับและสถิติยังครบถ้วน"
        )
    return result
