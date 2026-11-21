"use client";
import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import type { Column } from "./types";
import { getChart, type ChartResult } from "./api";

const metrics = { count: "จำนวนแถว", sum: "ผลรวม", mean: "ค่าเฉลี่ย", median: "มัธยฐาน", min: "ต่ำสุด", max: "สูงสุด" };
const colors = ["#236a52", "#72a798", "#aeceb4", "#bea16d", "#778da3", "#a18aba"];
export function ChartPanel({ datasetId, columns, selectedSheet }: { datasetId: string; columns: Column[]; selectedSheet: string | null }) {
  const numeric = columns.filter((column) => column.dtype === "number");
  const [group, setGroup] = useState(columns.find((column) => column.dtype === "text")?.id ?? columns[0]?.id ?? "");
  const [value, setValue] = useState(numeric[0]?.id ?? "");
  const [metric, setMetric] = useState<keyof typeof metrics>("count");
  const [kind, setKind] = useState("bar");
  const [result, setResult] = useState<ChartResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function calculate() {
    if (busy) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true); setError(""); setResult(null);
    try {
      const data = await getChart(datasetId, { group_id: group, metric, expected_sheet: selectedSheet ?? "", ...(metric !== "count" ? { value_id: value } : {}) }, controller.signal);
      if (!controller.signal.aborted) setResult(data);
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "สร้างกราฟไม่สำเร็จ");
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const data = result?.groups.map((row, index) => ({ ...row, key: String(index), label: row.group === null ? "(ค่าว่าง)" : row.group })) ?? [];
  const canPie = result && ["sum", "count"].includes(result.metric) && data.every((row) => row.value !== null && row.value >= 0) && data.reduce((sum, row) => sum + (row.value ?? 0), 0) > 0;
  const title = result ? `${metrics[result.metric as keyof typeof metrics]}${result.metric !== "count" ? `ของ ${result.value_column?.label}` : ""} แยกตาม ${result.group_column.label}` : "";
  return <section className="chart-builder" aria-label="กราฟวิเคราะห์ข้อมูล">
    <h2>มองข้อมูลผ่านกราฟ</h2>
    <form className="chart-controls" onSubmit={(event) => { event.preventDefault(); void calculate(); }}>
      <label>แบ่งกลุ่มตาม<select value={group} disabled={busy} onChange={(event) => { setGroup(event.target.value); setResult(null); }}>{columns.map((column) => <option key={column.id} value={column.id}>{column.label} · {column.id}</option>)}</select></label>
      <label>วิธีคำนวณ<select value={metric} disabled={busy} onChange={(event) => { setMetric(event.target.value as keyof typeof metrics); setResult(null); }}>{Object.entries(metrics).map(([id, label]) => <option key={id} value={id} disabled={id !== "count" && numeric.length === 0}>{label}</option>)}</select></label>
      {metric !== "count" && <label>คอลัมน์ตัวเลข<select value={value} disabled={busy} onChange={(event) => { setValue(event.target.value); setResult(null); }}>{numeric.map((column) => <option key={column.id} value={column.id}>{column.label} · {column.id}</option>)}</select></label>}
      <label>รูปแบบ<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="bar">กราฟแท่ง</option><option value="pie">กราฟสัดส่วน</option></select></label>
      <Button type="submit" disabled={busy || !group || (metric !== "count" && !value)}>{busy ? "กำลังคำนวณ…" : "สร้างกราฟ"}</Button>
    </form>
    {error && <p role="alert" className="chat-error">{error}</p>}
    {result && <div aria-live="polite">
      <h3>{title}</h3><p className="chart-caption">คำนวณจาก {result.row_count.toLocaleString("th-TH")} แถว · {data.length} กลุ่ม · รวมกลุ่มค่าว่าง · แสดงทุกกลุ่ม ไม่มีการสุ่มข้อมูล</p>
      {kind === "pie" && !canPie ? <p role="status">กราฟสัดส่วนใช้ผลรวมหรือจำนวนแถวที่เป็นค่าตั้งแต่ศูนย์และมีผลรวมมากกว่าศูนย์ กรุณาเลือกกราฟแท่งสำหรับข้อมูลนี้</p> : <div className="chart-scroll"><div style={{ width: "100%", height: kind === "bar" ? Math.max(300, data.length * 38) : 360 }} role="img" aria-label={`${title} ดูค่าทั้งหมดได้ในตารางใต้กราฟ`}>
        <ResponsiveContainer width="100%" height="100%">
          {kind === "bar" ? <BarChart data={data} layout="vertical" margin={{ top: 15, right: 30, bottom: 25, left: 5 }} accessibilityLayer>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5ebe1" /><XAxis type="number" domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="key" width={100} tick={{ fontSize: 11 }} tickFormatter={(key) => data[Number(key)]?.label.slice(0, 18) ?? key} /><Tooltip labelFormatter={(key) => data[Number(key)]?.label ?? key} /><ReferenceLine x={0} stroke="#7d8e79" /><Bar dataKey="value" name={metrics[result.metric as keyof typeof metrics]} fill="#236a52" radius={[0, 4, 4, 0]} isAnimationActive={false} />
          </BarChart> : <PieChart><Pie data={data} dataKey="value" nameKey="label" innerRadius={65} outerRadius={125} isAnimationActive={false}>{data.map((row, index) => <Cell key={row.key} fill={colors[index % colors.length]} />)}</Pie><Tooltip /></PieChart>}
        </ResponsiveContainer>
      </div></div>}
      {result.warnings.map((warning) => <p key={warning}>{warning}</p>)}
      <details className="chart-values"><summary>ตารางค่าที่ใช้สร้างกราฟ ({data.length} กลุ่ม)</summary><div className="evidence-table"><table><thead><tr><th>{result.group_column.label}</th><th>{metrics[result.metric as keyof typeof metrics]}</th></tr></thead><tbody>{data.map((row) => <tr key={row.key}><td>{row.label}</td><td>{row.value === null ? "ไม่มีค่าตัวเลข" : row.value.toLocaleString("th-TH", { maximumFractionDigits: 10 })}</td></tr>)}</tbody></table></div></details>
    </div>}
    {!result && !busy && !error && <p className="chart-caption">เลือกคอลัมน์และวิธีคำนวณ แล้วกดสร้างกราฟ · รองรับไม่เกิน 200 กลุ่ม</p>}
  </section>;
}
