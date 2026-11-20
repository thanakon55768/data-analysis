"""Synthetic E2E fixture only; never loaded into the application by default."""

import sys
from io import BytesIO

from openpyxl import Workbook

book = Workbook()
book.active.title = "ยอดขาย"
book.active.append(["สินค้า", "ยอดขาย"])
book.active.append(["ชา", 100])
other = book.create_sheet("อื่น")
other.append(["value"])
other.append([9])
book.create_sheet("ว่าง")
output = BytesIO()
book.save(output)
sys.stdout.buffer.write(output.getvalue())
