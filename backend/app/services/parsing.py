import csv
import json
import math
import multiprocessing as mp
import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path

import pandas as pd
from openpyxl import load_workbook

from app.config import (
    MAX_CELLS,
    MAX_COLUMNS,
    MAX_FILE_BYTES,
    MAX_LOGICAL_BYTES,
    MAX_ROWS,
    PARSE_TIMEOUT,
)
from app.schemas import AnalysisError
from app.services.file_validation import validate_upload


@dataclass
class ParsedDataset:
    frame: pd.DataFrame
    columns: list[dict]
    warnings: list[str]


def _check_shape(rows: int, columns: int):
    if columns > MAX_COLUMNS or rows > MAX_ROWS or rows * columns > MAX_CELLS:
        raise AnalysisError(
            "shape_limit", "ข้อมูลต้องไม่เกิน 100,000 แถว, 200 คอลัมน์ และ 2,000,000 เซลล์"
        )


def _scalar(value):
    if value is None or value == "":
        return None
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, timedelta):
        seconds = value.total_seconds()
        magnitude = abs(seconds)
        text = (
            str(int(magnitude))
            if magnitude.is_integer()
            else format(magnitude, ".6f").rstrip("0").rstrip(".")
        )
        return ("-" if seconds < 0 else "") + f"PT{text}S"
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def parse_dataset(
    path: Path, kind: str, sheet_name: str | None = None
) -> ParsedDataset:
    warnings = []
    rows = []
    logical_bytes = 0

    def account(values):
        nonlocal logical_bytes
        logical_bytes += len(
            json.dumps(values, ensure_ascii=False, allow_nan=False).encode("utf-8")
        )
        if logical_bytes > MAX_LOGICAL_BYTES:
            raise AnalysisError(
                "logical_size_limit",
                "ข้อมูลหลังขยายข้อความเกินขอบเขต 32 MB กรุณาลดจำนวนแถวหรือความยาวข้อความ",
            )

    if kind == "csv":
        # Do not use Pandas' default NA tokens or automatic date/header coercion.
        try:
            with path.open(encoding="utf-8-sig", newline="") as stream:
                csv.field_size_limit(MAX_FILE_BYTES)
                quoted_header = stream.read(1) == '"'
                stream.seek(0)
                reader = csv.reader(stream, strict=True)
                headers = next(reader, [])
                if (
                    not quoted_header
                    and len(headers) == 1
                    and any(char in headers[0] for char in ";\t|")
                ):
                    raise AnalysisError(
                        "unsupported_delimiter",
                        "CSV ต้องใช้เครื่องหมายจุลภาค (,) คั่นคอลัมน์ กรุณาส่งออกเป็น CSV UTF-8",
                    )
                _check_shape(0, len(headers))
                account(headers)
                for row in reader:
                    if not row:  # entirely blank physical records are not observations
                        continue
                    if len(row) != len(headers):
                        raise AnalysisError(
                            "malformed_csv",
                            f"จำนวนคอลัมน์ไม่ตรงกับหัวตารางบริเวณบรรทัด {reader.line_num}",
                        )
                    normalized = [_scalar(cell) for cell in row]
                    account(normalized)
                    rows.append(normalized)
                    _check_shape(len(rows), len(headers))
        except (UnicodeDecodeError, csv.Error):
            raise AnalysisError(
                "invalid_csv", "อ่าน CSV ไม่ได้ กรุณาใช้ UTF-8 และตรวจสอบเครื่องหมายคำพูด/ตัวคั่น"
            ) from None
    else:
        book = load_workbook(path, read_only=True, data_only=True, keep_links=False)
        formulas = None
        try:
            if sheet_name not in book.sheetnames:
                raise AnalysisError("unknown_sheet", "ไม่พบชีตที่เลือก")
            sheet = book[sheet_name]
            _check_shape(0, sheet.max_column or 0)
            sheet.reset_dimensions()
            iterator = sheet.iter_rows(values_only=True)
            headers = [
                str(value) if value is not None else "" for value in next(iterator, ())
            ]
            account(headers)
            for row in iterator:
                # Retain blank records inside the sheet; strip trailing empty records below.
                _check_shape(len(rows) + 1, max(len(headers), len(row)))
                if len(row) > len(headers):
                    headers.extend([""] * (len(row) - len(headers)))
                normalized = [_scalar(cell) for cell in row]
                account(normalized)
                rows.append(normalized)
            while rows and all(cell is None for cell in rows[-1]):
                rows.pop()
            formulas = load_workbook(
                path, read_only=True, data_only=False, keep_links=False
            )
            formula_sheet = formulas[sheet_name]
            formula_sheet.reset_dimensions()
            missing_formula = False
            last_formula_row = 0
            for index, row in enumerate(formula_sheet.iter_rows(), start=0):
                if index > MAX_ROWS:
                    raise AnalysisError("shape_limit", "ชีตเกินขอบเขต 100,000 แถว")
                for col_index, cell in enumerate(row):
                    if cell.data_type == "f":
                        last_formula_row = max(last_formula_row, index)
                        cached = (
                            rows[index - 1][col_index]
                            if index > 0
                            and index <= len(rows)
                            and col_index < len(rows[index - 1])
                            else None
                        )
                        if cached is None:
                            missing_formula = True
            if missing_formula:
                warnings.append(
                    "พบสูตร Excel ที่ไม่มีผลคำนวณบันทึกไว้ ระบบไม่คำนวณสูตร: กรุณาเปิดและบันทึกด้วย Excel แล้วอัปโหลดใหม่ ค่าสูตรที่ไม่มีผลจะแสดงเป็นค่าว่าง"
                )
                # Preserve formula-only data rows even when cached values are all empty.
                while len(rows) < last_formula_row:
                    rows.append([None] * len(headers))
        finally:
            book.close()
            if formulas is not None:
                formulas.close()
    if not headers or not rows:
        raise AnalysisError("empty_dataset", "ไม่พบแถวข้อมูลในไฟล์หรือชีตที่เลือก")
    if len(set(headers)) != len(headers) or "" in headers:
        warnings.append("พบชื่อคอลัมน์ซ้ำหรือไม่มีชื่อ ระบบใช้รหัส c0, c1… เพื่อแยกคอลัมน์โดยรักษาชื่อเดิม")
    # Infer only unambiguous numeric CSV columns; preserve identifiers such as 001.
    numeric_pattern = re.compile(r"-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?\Z")
    columns = []
    for row in rows:
        row.extend([None] * (len(headers) - len(row)))
    for index, label in enumerate(headers):
        values = [row[index] for row in rows if row[index] is not None]
        dtype = "text"
        if (
            kind == "csv"
            and values
            and all(isinstance(v, str) and numeric_pattern.fullmatch(v) for v in values)
        ):
            converted = [float(v) for v in values]
            # Integers beyond JS safe range remain text to avoid rounding identifiers.
            if all(
                math.isfinite(v)
                and abs(v) <= 9_007_199_254_740_991
                and Decimal(original) == Decimal(str(v))
                for original, v in zip(values, converted, strict=True)
            ):
                for row in rows:
                    if row[index] is not None:
                        value = float(row[index])
                        row[index] = int(value) if value.is_integer() else value
                dtype = "number"
            else:
                warnings.append(
                    f"คอลัมน์ {index + 1} มีตัวเลขที่แปลงแล้วสูญเสียความแม่นยำ จึงรักษาคอลัมน์เป็นข้อความ"
                )
        elif values and all(isinstance(v, bool) for v in values):
            dtype = "boolean"
        elif values and all(
            isinstance(v, (int, float)) and not isinstance(v, bool) for v in values
        ):
            if all(abs(v) <= 9_007_199_254_740_991 for v in values):
                dtype = "number"
            else:
                for row in rows:
                    if row[index] is not None:
                        row[index] = str(row[index])
                warnings.append(
                    f"คอลัมน์ {index + 1} มีตัวเลขเกินขอบเขตความแม่นยำของเว็บ จึงแสดงเป็นข้อความ"
                )
        elif not values:
            dtype = "empty"
        columns.append({"id": f"c{index}", "label": label, "dtype": dtype})
    frame = pd.DataFrame(
        rows, columns=[column["id"] for column in columns], dtype=object
    )
    return ParsedDataset(frame, columns, warnings)


def _parse_worker(path: str, filename: str, sheet_name: str | None, output: str):
    try:
        source = Path(path)
        kind = validate_upload(source, filename)
        if kind == "xlsx" and sheet_name is None:
            book = load_workbook(
                source, read_only=True, data_only=True, keep_links=False
            )
            try:
                payload = {"sheets": [{"name": name} for name in book.sheetnames]}
            finally:
                book.close()
        else:
            parsed = parse_dataset(source, kind, sheet_name)
            payload = {
                "columns": parsed.columns,
                "rows": parsed.frame.values.tolist(),
                "warnings": parsed.warnings,
            }
        result = {"ok": True, "data": payload}
    except AnalysisError as exc:
        result = {
            "ok": False,
            "code": exc.code,
            "message": exc.message,
            "status": exc.status,
        }
    except Exception:
        result = {
            "ok": False,
            "code": "parse_failed",
            "message": "อ่านไฟล์ไม่สำเร็จ กรุณาตรวจสอบว่าไฟล์ถูกต้องและไม่ถูกป้องกันด้วยรหัสผ่าน",
            "status": 422,
        }
    Path(output).write_text(
        json.dumps(result, ensure_ascii=False, allow_nan=False), encoding="utf-8"
    )


def run_parse(
    path: Path,
    filename: str,
    sheet_name: str | None,
    timeout: float = PARSE_TIMEOUT,
    worker=_parse_worker,
) -> dict:
    output = path.parent / "processing.json"
    process = mp.get_context("spawn").Process(
        target=worker, args=(str(path), filename, sheet_name, str(output))
    )
    try:
        process.start()
        process.join(timeout)
        if process.is_alive():
            process.terminate()
            process.join(5)
            raise AnalysisError(
                "processing_timeout", "การอ่านไฟล์ใช้เวลาเกิน 30 วินาที กรุณาลดขนาดไฟล์"
            )
        if process.exitcode != 0 or not output.exists():
            raise AnalysisError(
                "parse_failed", "ไม่สามารถประมวลผลไฟล์นี้ได้ กรุณาตรวจสอบไฟล์แล้วลองอีกครั้ง"
            )
        result = json.loads(output.read_text(encoding="utf-8"))
        if not result["ok"]:
            raise AnalysisError(result["code"], result["message"], result["status"])
        return result["data"]
    finally:
        if process.is_alive():
            process.kill()
            process.join()
        if process.pid is not None:
            process.close()
        output.unlink(missing_ok=True)
