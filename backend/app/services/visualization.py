from typing import Literal

import numpy as np
import pandas as pd
from pydantic import BaseModel, ConfigDict, Field

from app.schemas import AnalysisError
from app.services.statistics import safe_number


class DataFilter(BaseModel):
    model_config = ConfigDict(extra="forbid")
    column_id: str = Field(max_length=10)
    operator: Literal["eq", "contains", "gte", "lte", "missing", "after", "before"] = (
        "eq"
    )
    value: str = Field(default="", max_length=200)


def apply_filters(frame, columns, filters):
    by_id = {c["id"]: c for c in columns}
    filtered = frame
    for item in filters:
        if item.column_id not in by_id:
            raise AnalysisError("invalid_filter", "ไม่พบคอลัมน์ตัวกรอง")
        series = filtered[item.column_id]
        if item.operator == "missing":
            mask = series.isna()
        elif item.operator in {"after", "before"}:
            import re

            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", item.value):
                raise AnalysisError("invalid_filter", "วันที่ตัวกรองต้องเป็น YYYY-MM-DD")
            try:
                threshold = pd.Timestamp(item.value, tz="UTC")
            except ValueError:
                raise AnalysisError("invalid_filter", "วันที่ตัวกรองไม่ถูกต้อง") from None
            text = series.map(lambda value: str(value) if pd.notna(value) else "")
            iso = text.str.match(r"^\d{4}-\d{2}-\d{2}(?:[T ].*)?$")
            values = pd.to_datetime(
                text.where(iso), format="mixed", errors="coerce", utc=True
            )
            mask = (
                values.ge(threshold)
                if item.operator == "after"
                else values.lt(threshold + pd.Timedelta(days=1))
            )
        elif item.operator in {"gte", "lte"}:
            if by_id[item.column_id]["dtype"] != "number":
                raise AnalysisError("invalid_filter", "ตัวกรองช่วงค่าต้องใช้คอลัมน์ตัวเลข")
            try:
                threshold = float(item.value)
                if not np.isfinite(threshold):
                    raise ValueError()
            except ValueError:
                raise AnalysisError("invalid_filter", "กรุณาระบุค่าตัวเลขที่ถูกต้อง") from None
            values = pd.to_numeric(series, errors="coerce")
            mask = (
                values.ge(threshold) if item.operator == "gte" else values.le(threshold)
            )
        elif item.operator == "eq" and by_id[item.column_id]["dtype"] == "number":
            try:
                threshold = float(item.value)
                if not np.isfinite(threshold):
                    raise ValueError()
            except ValueError:
                raise AnalysisError("invalid_filter", "กรุณาระบุค่าตัวเลขที่ถูกต้อง") from None
            mask = pd.to_numeric(series, errors="coerce").eq(threshold)
        else:
            values = series.map(
                lambda value: str(value).casefold() if pd.notna(value) else None
            )
            mask = (
                values.eq(item.value.casefold())
                if item.operator == "eq"
                else values.str.contains(item.value.casefold(), regex=False, na=False)
            )
        filtered = filtered[mask]
    return filtered


class VisualizationSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["aggregate", "scatter", "histogram", "time"] = "aggregate"
    group_id: str = Field(max_length=10)
    value_id: str | None = Field(default=None, max_length=10)
    metric: Literal["count", "sum", "mean", "median", "min", "max"] = "count"
    interval: Literal["day", "month", "year"] = "month"
    bins: int = Field(default=12, ge=3, le=50)
    filters: list[DataFilter] = Field(default_factory=list, max_length=5)
    expected_sheet: str | None = Field(default=None, max_length=31)


def build_visualization(frame, columns, spec):
    from app.services.chat_analysis import AnalysisPlan, execute_plan

    source_count = len(frame)
    data = apply_filters(frame, columns, spec.filters)
    by_id = {c["id"]: c for c in columns}
    if spec.group_id not in by_id:
        raise AnalysisError("invalid_chart", "กรุณาเลือกคอลัมน์แกน X หรือแบ่งกลุ่ม")
    warnings = []
    excluded = 0
    sample_count = None
    value_column = by_id.get(spec.value_id)
    if spec.mode in {"scatter", "histogram"}:
        if by_id[spec.group_id]["dtype"] != "number":
            raise AnalysisError("invalid_chart", "กราฟนี้ต้องใช้แกน X เป็นตัวเลข")
        x = pd.to_numeric(data[spec.group_id], errors="coerce").astype(float)
        valid = np.isfinite(x)
        if spec.mode == "scatter":
            if not value_column or value_column["dtype"] != "number":
                raise AnalysisError("invalid_chart", "Scatter ต้องใช้คอลัมน์ตัวเลขสองคอลัมน์")
            y = pd.to_numeric(data[spec.value_id], errors="coerce").astype(float)
            valid &= np.isfinite(y)
            pairs = pd.DataFrame({"x": x[valid], "value": y[valid]})
            excluded = len(data) - len(pairs)
            if len(pairs) > 2000:
                pairs = pairs.sample(n=2000, random_state=0)
                sample_count = len(pairs)
                warnings.append("Scatter สุ่มแสดง 2,000 จุดจากคู่ค่าที่ใช้ได้ด้วย seed คงที่")
            points = [
                {
                    "x": safe_number(row.x),
                    "value": safe_number(row.value),
                    "label": str(index + 1),
                }
                for index, row in enumerate(pairs.itertuples())
            ]
        else:
            excluded = int((~valid).sum())
            values = x[valid].to_numpy()
            counts, edges = (
                np.histogram(values, bins=spec.bins) if len(values) else ([], [])
            )
            points = [
                {
                    "x": float(edges[index]),
                    "upper": float(edges[index + 1]),
                    "value": int(count),
                    "label": f"{edges[index]:.6g} – {edges[index + 1]:.6g}",
                }
                for index, count in enumerate(counts)
            ]
            warnings.append("Histogram รวมขอบซ้ายแต่ไม่รวมขอบขวา ยกเว้นช่วงสุดท้ายรวมทั้งสองขอบ")
    else:
        grouped_data = data
        if spec.mode == "time":
            text = data[spec.group_id].map(
                lambda value: str(value) if pd.notna(value) else ""
            )
            iso = text.str.match(r"^\d{4}-\d{2}-\d{2}(?:[T ].*)?$")
            dates = pd.to_datetime(
                text.where(iso), errors="coerce", utc=True, format="mixed"
            )
            excluded = int(dates.isna().sum())
            if len(data) and excluded == len(data):
                raise AnalysisError(
                    "invalid_chart", "ไม่พบวันที่ ISO ในคอลัมน์นี้ กรุณาเลือกคอลัมน์วันที่ YYYY-MM-DD"
                )
            grouped_data = data[dates.notna()].copy()
            pattern = {"day": "%Y-%m-%d", "month": "%Y-%m", "year": "%Y"}[spec.interval]
            grouped_data[spec.group_id] = dates[dates.notna()].dt.strftime(pattern)
            warnings.append("แกนเวลาอ่านเฉพาะวันที่ ISO YYYY-MM-DD และจัดเขตเวลาเป็น UTC")
        message, result = execute_plan(
            AnalysisPlan(
                action="group",
                group_id=spec.group_id,
                column_id=spec.value_id,
                metric=spec.metric,
            ),
            grouped_data,
            columns,
        )
        if result is None:
            raise AnalysisError("invalid_chart", message)
        points = [
            {
                "x": index,
                "label": row["group"] if row["group"] is not None else "(ค่าว่าง)",
                "value": row["value"],
            }
            for index, row in enumerate(result["groups"])
        ]
        if spec.mode == "time" and points:
            points.sort(key=lambda point: point["label"])
            frequency = {"day": "D", "month": "MS", "year": "YS"}[spec.interval]
            calendar = pd.date_range(
                points[0]["label"], points[-1]["label"], freq=frequency
            )
            if len(calendar) > 200:
                raise AnalysisError(
                    "chart_time_limit",
                    "ช่วงเวลามีมากกว่า 200 จุด กรุณาเลือกช่วงรายเดือน/รายปีหรือตัวกรอง",
                )
            observed = {point["label"]: point["value"] for point in points}
            pattern = {"day": "%Y-%m-%d", "month": "%Y-%m", "year": "%Y"}[spec.interval]
            points = [
                {
                    "x": index,
                    "label": date.strftime(pattern),
                    "value": observed.get(date.strftime(pattern)),
                }
                for index, date in enumerate(calendar)
            ]
            warnings.append("ช่วงเวลาที่ไม่มีข้อมูลแสดงเป็นช่องว่าง กราฟไม่เชื่อมข้ามค่าที่ไม่มีข้อมูล")
    return {
        "mode": spec.mode,
        "points": points,
        "group_column": by_id[spec.group_id],
        "value_column": value_column,
        "metric": spec.metric,
        "source_rows": source_count,
        "filtered_rows": len(data),
        "excluded_rows": excluded,
        "sample_count": sample_count,
        "warnings": warnings,
        "filters": [item.model_dump() for item in spec.filters],
    }
