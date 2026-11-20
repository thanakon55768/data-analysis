import { useState } from "react";
import type { Statistics, Column } from "./types";
const format = (value: number | null | undefined) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("th-TH", { maximumFractionDigits: 6 }).format(
        value,
      );
export function StatisticsPanel({
  statistics,
  columns,
}: {
  statistics: Statistics | null;
  columns: Column[];
}) {
  const [selected, setSelected] = useState("");
  const metric =
    statistics?.numeric.find((value) => value.column_id === selected) ??
    statistics?.numeric[0];
  const cards = [
    ["จำนวนแถว", statistics?.row_count, "rows"],
    ["คอลัมน์", statistics?.column_count, "columns"],
    ["ค่าว่าง", statistics?.missing_cells, "missing"],
    ["ข้อมูลซ้ำ", statistics?.duplicate_rows, "duplicates"],
  ] as const;
  return (
    <section aria-labelledby="stats-heading">
      <h2 id="stats-heading">ภาพรวมข้อมูล</h2>
      <div className="overview">
        {cards.map(([label, value, id]) => (
          <div key={id}>
            <strong data-testid={`stat-${id}`}>{format(value)}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      {statistics ? (
        <p className="caption statistic-note">
          แถวที่มีค่าว่าง {format(statistics.rows_with_missing)} แถว ·
          ข้อมูลซ้ำนับเฉพาะแถวที่ซ้ำหลังแถวแรก · ไม่มีการลบหรือเติมข้อมูลอัตโนมัติ
        </p>
      ) : null}
      {metric ? (
        <div className="numeric-panel">
          <div className="section-heading">
            <h3>สถิติคอลัมน์ตัวเลข</h3>
            <label>
              คอลัมน์{" "}
              <select
                aria-label="คอลัมน์สถิติ"
                value={metric.column_id}
                onChange={(event) => setSelected(event.target.value)}
              >
                {statistics?.numeric.map((value) => (
                  <option key={value.column_id} value={value.column_id}>
                    {columns.find((column) => column.id === value.column_id)
                      ?.label || "(ไม่มีชื่อ)"}{" "}
                    · {value.column_id}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <dl className="metrics">
            {(
              [
                ["ผลรวม", "sum"],
                ["ค่าเฉลี่ย", "mean"],
                ["มัธยฐาน", "median"],
                ["ต่ำสุด", "min"],
                ["สูงสุด", "max"],
              ] as const
            ).map(([label, key]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd data-testid={`metric-${key}`}>{format(metric[key])}</dd>
              </div>
            ))}
          </dl>
          <p className="caption">
            คำนวณจากค่าตัวเลขที่ใช้ได้ {format(metric.count)} ค่า · ค่าว่าง{" "}
            {format(metric.missing)} ค่า
          </p>
        </div>
      ) : statistics ? (
        <p className="caption statistic-note">ไม่พบคอลัมน์ตัวเลขที่ใช้คำนวณสถิติได้</p>
      ) : null}
    </section>
  );
}
