"use client";
import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  LineChart as LineIcon,
  PieChart as PieIcon,
  CircleDot,
  SlidersHorizontal,
  Plus,
  X,
  RotateCcw,
  Expand,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Column } from "./types";
import {
  getVisualization,
  type DataFilter,
  type VisualizationResult,
} from "./api";

export type ChartKind =
  "bar" | "line" | "area" | "pie" | "donut" | "scatter" | "histogram";
const metrics = {
  count: "จำนวนแถว",
  sum: "ผลรวม",
  mean: "ค่าเฉลี่ย",
  median: "มัธยฐาน",
  min: "ต่ำสุด",
  max: "สูงสุด",
};
const kinds = [
  { id: "bar", name: "แท่ง", icon: BarChart3 },
  { id: "line", name: "เส้น", icon: LineIcon },
  { id: "area", name: "พื้นที่", icon: LineIcon },
  { id: "pie", name: "วงกลม", icon: PieIcon },
  { id: "donut", name: "โดนัท", icon: PieIcon },
  { id: "scatter", name: "กระจาย", icon: CircleDot },
  { id: "histogram", name: "Histogram", icon: BarChart3 },
] as const;
const colors = [
  "#236a52",
  "#4f9b87",
  "#83bab0",
  "#6f86b5",
  "#b69b6e",
  "#aa80a7",
  "#8f9d65",
];
const number = (value: number) =>
  value.toLocaleString("th-TH", { maximumFractionDigits: 4 });

export function ChartCanvas({
  result,
  kind,
  start = 0,
  end = result.points.length - 1,
}: {
  result: VisualizationResult;
  kind: ChartKind;
  start?: number;
  end?: number;
}) {
  const points = result.points.slice(start, end + 1);
  const name =
    result.mode === "histogram"
      ? "จำนวนแถว"
      : result.mode === "scatter"
        ? (result.value_column?.label ?? "Y")
        : metrics[result.metric as keyof typeof metrics];
  const xLabel = result.group_column.label;
  const common = {
    data: points,
    margin: { top: 20, right: 25, bottom: 25, left: 10 },
    accessibilityLayer: true,
  };
  const grid = (
    <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e4eae5" />
  );
  const x = (
    <XAxis
      dataKey="label"
      tick={{ fontSize: 10, fill: "#7c8b7e" }}
      tickLine={false}
      axisLine={false}
      tickFormatter={(label: string) =>
        label.length > 15 ? label.slice(0, 14) + "…" : label
      }
      minTickGap={24}
      label={{
        value: xLabel,
        position: "insideBottom",
        offset: -19,
        fontSize: 11,
      }}
    />
  );
  const y = (
    <YAxis
      tick={{ fontSize: 10, fill: "#7c8b7e" }}
      tickLine={false}
      axisLine={false}
      tickFormatter={number}
      width={65}
      domain={[
        (min: number) => Math.min(0, min),
        (max: number) => Math.max(0, max),
      ]}
      allowDecimals={result.metric !== "count" && result.mode !== "histogram"}
    />
  );
  const tooltip = (
    <Tooltip
      contentStyle={{
        border: "1px solid #dce7df",
        borderRadius: 10,
        fontSize: 12,
        boxShadow: "0 8px 24px #16322312",
      }}
    />
  );
  const canPie =
    ["sum", "count"].includes(result.metric) &&
    points.every((point) => point.value !== null && point.value >= 0) &&
    points.reduce((sum, point) => sum + (point.value ?? 0), 0) > 0;
  if ((kind === "pie" || kind === "donut") && !canPie)
    return (
      <div className="chart-empty">
        กราฟสัดส่วนใช้ผลรวมหรือจำนวนแถวที่ไม่มีค่าติดลบหรือค่าว่าง และมีผลรวมมากกว่าศูนย์
      </div>
    );
  if (!points.length)
    return (
      <div className="chart-empty">
        ไม่พบข้อมูลที่ใช้สร้างกราฟ กรุณาปรับตัวกรองหรือคอลัมน์
      </div>
    );
  return (
    <ResponsiveContainer width="100%" height={350} minWidth={0}>
      {kind === "scatter" ? (
        <ScatterChart margin={common.margin} accessibilityLayer>
          {grid}
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel}
            tick={{ fontSize: 10 }}
            domain={["dataMin", "dataMax"]}
            label={{
              value: xLabel,
              position: "insideBottom",
              offset: -18,
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="value"
            name={name}
            tick={{ fontSize: 10 }}
            domain={["dataMin", "dataMax"]}
          />
          {tooltip}
          <Scatter
            data={points}
            name={`${xLabel} / ${name}`}
            fill="#3d8b75"
            fillOpacity={0.6}
            isAnimationActive={false}
          />
        </ScatterChart>
      ) : kind === "pie" || kind === "donut" ? (
        <PieChart accessibilityLayer>
          <Pie
            data={points}
            dataKey="value"
            nameKey="label"
            innerRadius={kind === "donut" ? 72 : 0}
            outerRadius={125}
            paddingAngle={points.length <= 12 ? 2 : 0}
            isAnimationActive={false}
          >
            {points.map((point, index) => (
              <Cell key={index} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          {tooltip}
        </PieChart>
      ) : kind === "line" ? (
        <LineChart {...common}>
          {grid}
          {x}
          {y}
          {tooltip}
          <ReferenceLine y={0} stroke="#c0cdc2" />
          <Line
            type="linear"
            dataKey="value"
            name={name}
            stroke="#2e816a"
            strokeWidth={2.5}
            dot={points.length < 30}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      ) : kind === "area" ? (
        <AreaChart {...common}>
          {grid}
          {x}
          {y}
          {tooltip}
          <Area
            type="linear"
            dataKey="value"
            name={name}
            stroke="#2e816a"
            fill="#d4e9df"
            strokeWidth={2}
            connectNulls={false}
            isAnimationActive={false}
          />
        </AreaChart>
      ) : (
        <BarChart {...common} barCategoryGap={kind === "histogram" ? 1 : "25%"}>
          {grid}
          {x}
          {y}
          {tooltip}
          <ReferenceLine y={0} stroke="#c0cdc2" />
          <Bar
            dataKey="value"
            name={name}
            fill="#36856d"
            maxBarSize={50}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}

export function ChartPanel({
  datasetId,
  columns,
  selectedSheet,
}: {
  datasetId: string;
  columns: Column[];
  selectedSheet: string | null;
}) {
  const numeric = columns.filter((column) => column.dtype === "number");
  const [group, setGroup] = useState(
    columns.find((column) => column.dtype === "text")?.id ??
      columns[0]?.id ??
      "",
  );
  const [value, setValue] = useState(numeric[0]?.id ?? "");
  const [metric, setMetric] = useState<keyof typeof metrics>("count");
  const [kind, setKind] = useState<ChartKind>("bar");
  const [interval, setInterval] = useState("month");
  const [bins, setBins] = useState(12);
  const [filters, setFilters] = useState<DataFilter[]>([]);
  const [result, setResult] = useState<VisualizationResult | null>(null);
  const [renderKind, setRenderKind] = useState<ChartKind>("bar");
  const [range, setRange] = useState({ start: 0, end: 0 });
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const mode =
    kind === "scatter"
      ? "scatter"
      : kind === "histogram"
        ? "histogram"
        : ["line", "area"].includes(kind)
          ? "time"
          : "aggregate";
  function changeKind(next: ChartKind) {
    setKind(next);
    setResult(null);
    setError("");
    if (next === "scatter" || next === "histogram") {
      setGroup(numeric[0]?.id ?? "");
      setValue(numeric[1]?.id ?? numeric[0]?.id ?? "");
    } else if (next === "line" || next === "area")
      setGroup(
        columns.find((column) => /date|time|วันที่|เวลา/i.test(column.label))
          ?.id ??
          columns[0]?.id ??
          "",
      );
  }
  async function calculate() {
    if (busy) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const data = await getVisualization(
        datasetId,
        {
          mode,
          group_id: group,
          metric,
          interval,
          bins,
          filters,
          expected_sheet: selectedSheet ?? "",
          ...(metric !== "count" || mode === "scatter"
            ? { value_id: value }
            : {}),
        },
        controller.signal,
      );
      if (!controller.signal.aborted) {
        if (data.mode === "scatter") data.points.sort((a, b) => a.x - b.x);
        setResult(data);
        setRenderKind(kind);
        setRange({ start: 0, end: Math.max(0, data.points.length - 1) });
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : "สร้างกราฟไม่สำเร็จ");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  function updateFilter(index: number, patch: Partial<DataFilter>) {
    setFilters((items) =>
      items.map((item, current) =>
        current === index ? { ...item, ...patch } : item,
      ),
    );
    setResult(null);
  }
  const chosenColumns =
    mode === "scatter" || mode === "histogram" ? numeric : columns;
  const title = result
    ? result.mode === "scatter"
      ? `${result.group_column.label} × ${result.value_column?.label}`
      : result.mode === "histogram"
        ? `การกระจายของ ${result.group_column.label}`
        : `${metrics[result.metric as keyof typeof metrics]}แยกตาม ${result.group_column.label}`
    : "สำรวจความหมายที่อยู่ในข้อมูล";
  const shown = result?.points.slice(range.start, range.end + 1) ?? [];
  return (
    <section
      className={`chart-builder professional-chart ${expanded ? "chart-expanded" : ""}`}
      aria-label="กราฟวิเคราะห์ข้อมูล"
      onKeyDown={(event) => {
        if (event.key === "Escape") setExpanded(false);
      }}
    >
      <div className="dashboard-title">
        <div>
          <h2>สำรวจข้อมูลด้วยกราฟ</h2>
        </div>
        <button
          className="icon-button"
          aria-label={expanded ? "ย่อกราฟ" : "ขยายกราฟ"}
          onClick={() => setExpanded(!expanded)}
        >
          <Expand size={18} />
        </button>
      </div>
      <div className="chart-kind-tabs" role="group" aria-label="รูปแบบกราฟ">
        {kinds.map(({ id, name, icon: Icon }) => (
          <button
            type="button"
            key={id}
            aria-pressed={kind === id}
            disabled={
              busy ||
              ((id === "scatter" || id === "histogram") && !numeric.length)
            }
            onClick={() => changeKind(id)}
          >
            <Icon size={16} />
            {name}
          </button>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void calculate();
        }}
      >
        <div className="chart-controls">
          <label>
            {mode === "time"
              ? "คอลัมน์วันที่ (ISO)"
              : mode === "scatter" || mode === "histogram"
                ? "แกน X · ตัวเลข"
                : "แบ่งกลุ่มตาม"}
            <select
              value={group}
              disabled={busy}
              onChange={(event) => {
                setGroup(event.target.value);
                setResult(null);
              }}
            >
              {chosenColumns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.label} · {column.id}
                </option>
              ))}
            </select>
          </label>
          {mode !== "scatter" && mode !== "histogram" && (
            <label>
              วิธีคำนวณ
              <select
                value={metric}
                disabled={busy}
                onChange={(event) => {
                  setMetric(event.target.value as keyof typeof metrics);
                  setResult(null);
                }}
              >
                {Object.entries(metrics).map(([id, label]) => (
                  <option
                    key={id}
                    value={id}
                    disabled={id !== "count" && !numeric.length}
                  >
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(mode === "scatter" ||
            (mode !== "histogram" && metric !== "count")) && (
            <label>
              {mode === "scatter" ? "แกน Y · ตัวเลข" : "ค่าที่วิเคราะห์"}
              <select
                value={value}
                disabled={busy}
                onChange={(event) => {
                  setValue(event.target.value);
                  setResult(null);
                }}
              >
                {numeric.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.label} · {column.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode === "time" && (
            <label>
              ช่วงเวลา
              <select
                value={interval}
                onChange={(event) => {
                  setInterval(event.target.value);
                  setResult(null);
                }}
              >
                <option value="day">รายวัน</option>
                <option value="month">รายเดือน</option>
                <option value="year">รายปี</option>
              </select>
            </label>
          )}
          {mode === "histogram" && (
            <label>
              จำนวนช่วง
              <input
                type="number"
                min={3}
                max={50}
                value={bins}
                onChange={(event) => {
                  setBins(Number(event.target.value));
                  setResult(null);
                }}
              />
            </label>
          )}
          <Button
            type="submit"
            disabled={busy || !group || (mode === "scatter" && !value)}
          >
            {busy ? "กำลังคำนวณ…" : "อัปเดตกราฟ"}
          </Button>
        </div>
        <div className="filter-heading">
          <span>
            <SlidersHorizontal size={14} /> ตัวกรองข้อมูล
          </span>
          <button
            type="button"
            disabled={busy || filters.length >= 5}
            onClick={() => {
              setFilters((items) => [
                ...items,
                { column_id: columns[0].id, operator: "eq", value: "" },
              ]);
              setResult(null);
            }}
          >
            <Plus size={14} /> เพิ่มตัวกรอง
          </button>
        </div>
        {filters.length === 0 && (
          <p className="filter-none">
            กำลังใช้ข้อมูลทั้งหมด เพิ่มตัวกรองเพื่อเจาะลึกเฉพาะส่วนที่สนใจ
          </p>
        )}
        {filters.map((filter, index) => (
          <div className="filter-row" key={index}>
            <select
              aria-label={`คอลัมน์ตัวกรอง ${index + 1}`}
              value={filter.column_id}
              disabled={busy}
              onChange={(event) =>
                updateFilter(index, { column_id: event.target.value })
              }
            >
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.label} · {column.id}
                </option>
              ))}
            </select>
            <select
              aria-label={`เงื่อนไข ${index + 1}`}
              value={filter.operator}
              disabled={busy}
              onChange={(event) =>
                updateFilter(index, {
                  operator: event.target.value as DataFilter["operator"],
                })
              }
            >
              <option value="eq">เท่ากับ</option>
              <option value="contains">มีข้อความ</option>
              <option value="gte">มากกว่าหรือเท่ากับ</option>
              <option value="lte">น้อยกว่าหรือเท่ากับ</option>
              <option value="missing">เป็นค่าว่าง</option>
              <option value="after">ตั้งแต่วันที่ (ISO)</option>
              <option value="before">ถึงวันที่ (ISO)</option>
            </select>
            {filter.operator !== "missing" && (
              <input
                aria-label={`ค่าตัวกรอง ${index + 1}`}
                value={filter.value}
                disabled={busy}
                maxLength={200}
                placeholder={
                  filter.operator === "after" || filter.operator === "before"
                    ? "YYYY-MM-DD"
                    : "ค่าที่ต้องการ"
                }
                onChange={(event) =>
                  updateFilter(index, { value: event.target.value })
                }
              />
            )}
            <button
              className="icon-button"
              aria-label={`ลบตัวกรอง ${index + 1}`}
              type="button"
              disabled={busy}
              onClick={() => {
                setFilters((items) =>
                  items.filter((_, current) => current !== index),
                );
                setResult(null);
              }}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </form>
      {error && (
        <p role="alert" className="chat-error">
          {error}
        </p>
      )}
      {result && (
        <>
          <div className="dashboard-metrics">
            <div>
              <span>ข้อมูลทั้งหมด</span>
              <strong>{number(result.source_rows)}</strong>
              <small>แถว</small>
            </div>
            <div>
              <span>ผ่านตัวกรอง</span>
              <strong>{number(result.filtered_rows)}</strong>
              <small>แถว</small>
            </div>
            <div>
              <span>{result.mode === "scatter" ? "จุดที่แสดง" : "กลุ่ม / ช่วง"}</span>
              <strong>{number(result.points.length)}</strong>
              <small>
                {result.sample_count ? "มีการสุ่มจุด" : "ใช้ค่าทั้งหมดที่เข้าเงื่อนไข"}
              </small>
            </div>
            <div>
              <span>ค่าที่ใช้ไม่ได้</span>
              <strong>{number(result.excluded_rows)}</strong>
              <small>แถวที่ตัดออกจากกราฟ</small>
            </div>
          </div>
          <div className="chart-result-header">
            <div>
              <h3>{title}</h3>
              <p>
                {result.value_column?.label ??
                  metrics[result.metric as keyof typeof metrics]}
                {["line", "area"].includes(renderKind)
                  ? " · เรียงตามเวลา UTC"
                  : ""}
              </p>
            </div>
            <button
              className="chart-reset"
              onClick={() =>
                setRange({
                  start: 0,
                  end: Math.max(0, result.points.length - 1),
                })
              }
            >
              <RotateCcw size={13} /> คืนช่วงทั้งหมด
            </button>
          </div>
          <div className="chart-stage">
            <ChartCanvas
              result={result}
              kind={renderKind}
              start={range.start}
              end={range.end}
            />
          </div>
          {result.points.length > 1 && (
            <div className="chart-zoom">
              <div className="range-title">
                <span>ลากขอบเพื่อซูมช่วงข้อมูล</span>
                <strong>
                  {range.start + 1}–{range.end + 1} / {result.points.length}
                </strong>
              </div>
              <ResponsiveContainer width="100%" height={54}>
                <AreaChart data={result.points}>
                  <Brush
                    dataKey="label"
                    height={28}
                    stroke="#95b4a4"
                    fill="#f4f8f5"
                    startIndex={range.start}
                    endIndex={range.end}
                    travellerWidth={9}
                    tickFormatter={(label) => String(label).slice(0, 12)}
                    onChange={(next) => {
                      if (
                        next.startIndex !== undefined &&
                        next.endIndex !== undefined
                      )
                        setRange({
                          start: next.startIndex,
                          end: next.endIndex,
                        });
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="accessible-range">
                <label>
                  เริ่ม
                  <input
                    type="range"
                    min={0}
                    max={result.points.length - 1}
                    value={range.start}
                    onChange={(event) =>
                      setRange((current) => ({
                        start: Math.min(
                          Number(event.target.value),
                          current.end,
                        ),
                        end: current.end,
                      }))
                    }
                  />
                </label>
                <label>
                  สิ้นสุด
                  <input
                    type="range"
                    min={0}
                    max={result.points.length - 1}
                    value={range.end}
                    onChange={(event) =>
                      setRange((current) => ({
                        start: current.start,
                        end: Math.max(
                          Number(event.target.value),
                          current.start,
                        ),
                      }))
                    }
                  />
                </label>
              </div>
            </div>
          )}
          <p className="chart-caption">
            แสดง {shown.length} จาก {result.points.length} จุด/กลุ่ม ·
            ซูมเปลี่ยนเฉพาะช่วงแสดงผล ·{" "}
            {renderKind === "pie" || renderKind === "donut"
              ? "สัดส่วนคิดเฉพาะกลุ่มในช่วงที่เลือก"
              : "ตัวกรองคำนวณใหม่จากข้อมูลต้นฉบับ"}
          </p>
          {result.warnings.map((warning) => (
            <p className="chart-warning" key={warning}>
              {warning}
            </p>
          ))}
          <details className="chart-values">
            <summary>ดูค่าที่อยู่ในกราฟ ({shown.length})</summary>
            <div className="evidence-table">
              <table>
                <thead>
                  <tr>
                    <th>{result.group_column.label}</th>
                    <th>{result.value_column?.label ?? "ผลลัพธ์"}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((point, index) => (
                    <tr key={index}>
                      <td>
                        {result.mode === "scatter"
                          ? number(point.x)
                          : point.label}
                      </td>
                      <td>
                        {point.value === null
                          ? "ไม่มีค่าตัวเลข"
                          : number(point.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      {!result && !busy && !error && (
        <div className="dashboard-empty">
          <BarChart3 size={34} strokeWidth={1.2} />
          <h3>เลือกมุมมองของข้อมูล</h3>
          <p>เลือกมุมมองและคอลัมน์ แล้วกดอัปเดตกราฟ</p>
        </div>
      )}
    </section>
  );
}
