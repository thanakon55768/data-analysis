"use client";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Trash2,
  FileSpreadsheet,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { UploadPanel } from "./upload-panel";
import { SheetSelector } from "./sheet-selector";
import { DataTable } from "./data-table";
import { StatisticsPanel } from "./statistics-panel";
import {
  uploadDataset,
  selectSheet,
  getPreview,
  getStatistics,
  deleteDataset,
} from "./api";
import type { Dataset, Preview, Statistics } from "./types";

export function Workspace() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const active = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const [pageOffsets, setPageOffsets] = useState<number[]>([0]);
  const message = (error: unknown) =>
    error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง";
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    if (!dataset || dataset.status !== "ready" || busy) return;
    const controller = new AbortController();
    const current = epoch.current;
    const timer = setTimeout(
      () => {
        setLoading(true);
        Promise.allSettled([
          getPreview(
            dataset.id,
            { offset, limit: 50, search },
            controller.signal,
          ),
          getStatistics(dataset.id, controller.signal),
        ])
          .then(([nextPreview, nextStats]) => {
            if (!controller.signal.aborted && current === epoch.current) {
              setPreview(
                nextPreview.status === "fulfilled" ? nextPreview.value : null,
              );
              setStatistics(
                nextStats.status === "fulfilled" ? nextStats.value : null,
              );
              const failures = [nextPreview, nextStats].filter(
                (result) => result.status === "rejected",
              );
              setError(
                failures.map((result) => message(result.reason)).join(" · "),
              );
            }
          })
          .catch((error) => {
            if (!controller.signal.aborted && current === epoch.current) {
              setPreview(null);
              setStatistics(null);
              setError(message(error));
            }
          })
          .finally(() => {
            if (!controller.signal.aborted && current === epoch.current)
              setLoading(false);
          });
      },
      search ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [dataset, search, offset, revision, busy]);

  async function onFile(file: File) {
    if (busy) return;
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      setError("รองรับเฉพาะไฟล์ .csv และ .xlsx");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("ไฟล์ต้องมีขนาดไม่เกิน 10 MB");
      return;
    }
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    ++epoch.current;
    setBusy(true);
    setLoading(false);
    setError("");
    setPreview(null);
    setStatistics(null);
    setSearch("");
    setOffset(0);
    setPageOffsets([0]);
    setDataset(null);
    try {
      const next = await uploadDataset(file, controller.signal);
      if (!controller.signal.aborted) {
        setDataset(next);
        if (dataset)
          await deleteDataset(dataset.id, controller.signal).catch(() => {});
      }
    } catch (error) {
      if (!controller.signal.aborted) setError(message(error));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function onSheet(name: string) {
    if (!dataset || busy) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    ++epoch.current;
    setBusy(true);
    setLoading(false);
    setError("");
    setPreview(null);
    setStatistics(null);
    setSearch("");
    setOffset(0);
    setPageOffsets([0]);
    try {
      const next = await selectSheet(dataset.id, name, controller.signal);
      if (!controller.signal.aborted) setDataset(next);
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(message(error));
        setDataset({ ...dataset, status: "needs_sheet", selected_sheet: null });
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function reset() {
    if (!dataset || busy) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    ++epoch.current;
    setBusy(true);
    setError("");
    try {
      await deleteDataset(dataset.id, controller.signal);
      setDataset(null);
      setPreview(null);
      setStatistics(null);
      setSearch("");
      setOffset(0);
      setPageOffsets([0]);
      setLoading(false);
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  const warnings = [
    ...new Set([
      ...(dataset?.warnings ?? []),
      ...(statistics?.warnings ?? []),
      ...(preview?.warnings ?? []),
    ]),
  ];
  return (
    <>
      <header className="app-header">
        <span className="brand">AI Data Analyst</span>
        <span>พื้นที่วิเคราะห์ข้อมูล</span>
      </header>
      <main className="workspace">
        <div className="intro">
          <h1>เริ่มต้นจากข้อมูลของคุณ</h1>
          <p>อัปโหลด Excel หรือ CSV เพื่อสำรวจข้อมูลและคำนวณสถิติจริง</p>
        </div>
        <UploadPanel busy={busy} onFile={onFile} />
        <div className="live-status" role="status" aria-live="polite">
          {busy
            ? "กำลังอ่านไฟล์ กรุณารอสักครู่"
            : loading
              ? "กำลังโหลดตารางและสถิติ…"
              : ""}
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>ยังไม่สามารถดำเนินการได้</AlertTitle>
            <AlertDescription>
              <p>{error}</p>
              {dataset?.status === "ready" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRevision((value) => value + 1)}
                >
                  ลองโหลดข้อมูลอีกครั้ง
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        {dataset ? (
          <div className="dataset-bar">
            <div className="dataset-name">
              <FileSpreadsheet aria-hidden="true" />
              <div>
                <strong>{dataset.filename}</strong>
                <small>
                  เก็บชั่วคราวถึง{" "}
                  {new Date(dataset.expires_at).toLocaleString("th-TH")}
                </small>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled={busy} onClick={reset}>
              <Trash2 data-icon="inline-start" />
              ลบข้อมูลและเริ่มใหม่
            </Button>
          </div>
        ) : null}
        {dataset ? (
          <SheetSelector dataset={dataset} busy={busy} onSelect={onSheet} />
        ) : null}
        {warnings.length ? (
          <Alert>
            <AlertCircle />
            <AlertTitle>ข้อสังเกตเกี่ยวกับข้อมูล</AlertTitle>
            <AlertDescription>
              <ul>
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        <StatisticsPanel
          statistics={statistics}
          columns={preview?.columns ?? []}
        />
        {loading ? (
          <div className="loading-line" aria-hidden="true">
            <LoaderCircle className="spinning" />
            กำลังโหลดข้อมูล
          </div>
        ) : null}
        <DataTable
          preview={preview}
          busy={busy || loading}
          search={search}
          onSearch={(value) => {
            setPageOffsets([0]);
            setOffset(0);
            setSearch(value);
          }}
          previousOffset={
            pageOffsets.length > 1 ? pageOffsets[pageOffsets.length - 2] : 0
          }
          onPage={(value) => {
            if (value < offset) setPageOffsets((values) => values.slice(0, -1));
            else if (value > offset)
              setPageOffsets((values) => [...values, value]);
            setOffset(value);
          }}
        />
        <footer>
          ประมวลผลในเครื่องของคุณ · ไฟล์เก็บชั่วคราวไม่เกิน 24 ชั่วโมง
          และล้างเมื่อเริ่มระบบหรือมีการใช้งานครั้งถัดไป · ลบได้ด้วยปุ่มด้านบน
        </footer>
      </main>
    </>
  );
}
