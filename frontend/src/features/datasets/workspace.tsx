"use client";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Sparkles,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  Table2,
  ChevronRight,
  Trash2,
  FileSpreadsheet,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ChartPanel } from "./chart-panel";
import { ChatPanel } from "./chat-panel";
import { UploadPanel } from "./upload-panel";
import { SheetSelector } from "./sheet-selector";
import { DataTable } from "./data-table";
import { StatisticsPanel } from "./statistics-panel";
import {
  uploadDataset,
  listDatasets,
  getDataset,
  selectSheet,
  getPreview,
  getStatistics,
  deleteDataset,
} from "./api";
import type { Dataset, Preview, Statistics } from "./types";

import { accountMode } from "@/features/auth/client";

export function Workspace() {
  const [view, setView] = useState<"chat" | "data">("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [history, setHistory] = useState<(Dataset & { deleting?: boolean })[]>(
    [],
  );
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyRevision, setHistoryRevision] = useState(0);
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

  useEffect(() => {
    if (!accountMode) return;
    const controller = new AbortController();
    listDatasets(historyOffset, controller.signal)
      .then(setHistory)
      .catch((error) => {
        if (!controller.signal.aborted) setError(message(error));
      });
    return () => controller.abort();
  }, [historyOffset, historyRevision]);

  async function reopen(id: string) {
    if (busy) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    ++epoch.current;
    setBusy(true);
    setError("");
    setPreview(null);
    setStatistics(null);
    setDataset(null);
    setSearch("");
    setOffset(0);
    setPageOffsets([0]);
    try {
      setDataset(await getDataset(id, controller.signal));
      setView("chat");
      setSidebarOpen(false);
      setShowUpload(false);
    } catch (error) {
      if (!controller.signal.aborted) setError(message(error));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  async function removeHistory(id: string) {
    if (busy || !window.confirm("ลบไฟล์และข้อมูลที่เกี่ยวข้องถาวรหรือไม่?")) return;
    setBusy(true);
    try {
      await deleteDataset(id, new AbortController().signal);
      setHistoryRevision((value) => value + 1);
      if (dataset?.id === id) {
        ++epoch.current;
        setDataset(null);
        setPreview(null);
        setStatistics(null);
      }
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    if (busy) return;
    if (!/\.(csv|tsv|json|jsonl|xls|xlsx|ods)$/i.test(file.name)) {
      setError("รองรับไฟล์ CSV, TSV, JSON, JSONL, XLS, XLSX และ ODS");
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
        setView("chat");
        setShowUpload(false);
        setHistoryRevision((value) => value + 1);
        if (dataset && !accountMode)
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
    if (accountMode && !window.confirm("ลบไฟล์และข้อมูลที่เกี่ยวข้องถาวรหรือไม่?"))
      return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    ++epoch.current;
    setBusy(true);
    setError("");
    try {
      await deleteDataset(dataset.id, controller.signal);
      setHistoryRevision((value) => value + 1);
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
    <div
      className={`analyst-shell ${sidebarOpen ? "sidebar-open" : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") setSidebarOpen(false);
      }}
    >
      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          aria-label="ปิดเมนูด้านข้าง"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className="analyst-sidebar" aria-label="ไฟล์และบทสนทนา">
        <div className="sidebar-brand">
          <span className="brand-mark">
            <Sparkles size={20} />
          </span>
          <strong>Data Analyst</strong>
          <button
            className="icon-button mobile-only"
            aria-label="ปิดรายการไฟล์"
            onClick={() => setSidebarOpen(false)}
          >
            <PanelLeftClose size={19} />
          </button>
        </div>
        <Button
          className="new-analysis"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setShowUpload(true);
            setSidebarOpen(false);
          }}
        >
          <Plus size={17} /> วิเคราะห์ไฟล์ใหม่
        </Button>
        <div className="sidebar-section-label">ไฟล์ของคุณ</div>
        <nav className="file-history" aria-label="ประวัติไฟล์">
          {history.length === 0 && (
            <p className="sidebar-empty">
              {accountMode ? "ไฟล์ที่อัปโหลดจะแสดงที่นี่" : "อัปโหลดไฟล์เพื่อเริ่มบทสนทนา"}
            </p>
          )}
          {history.map((item) => (
            <div
              className={`history-row ${dataset?.id === item.id ? "selected" : ""}`}
              key={item.id}
            >
              <button
                className="history-open"
                disabled={busy || item.deleting}
                onClick={() => reopen(item.id)}
                aria-current={dataset?.id === item.id ? "page" : undefined}
              >
                <FileSpreadsheet size={17} />
                <span>
                  {item.filename}
                  <small>
                    {item.deleting
                      ? "ต้องล้างไฟล์"
                      : item.created_at
                        ? new Date(item.created_at).toLocaleDateString("th-TH")
                        : "ชุดข้อมูล"}
                  </small>
                </span>
              </button>
              <button
                className="icon-button history-delete"
                disabled={busy}
                aria-label={`ลบ ${item.filename}`}
                onClick={() => removeHistory(item.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </nav>
        {accountMode && (historyOffset > 0 || history.length >= 20) && (
          <div className="history-pages">
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || historyOffset === 0}
              onClick={() =>
                setHistoryOffset((value) => Math.max(0, value - 20))
              }
            >
              ก่อนหน้า
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || history.length < 20}
              onClick={() => setHistoryOffset((value) => value + 20)}
            >
              ถัดไป
            </Button>
          </div>
        )}
        <div className="sidebar-foot">
          <FileSpreadsheet size={17} />
          <span>
            {accountMode ? "พื้นที่ข้อมูลส่วนตัว" : "พื้นที่ทดลองในเครื่อง"}
            <small>
              {accountMode ? "ไฟล์เก็บไว้จนกว่าคุณจะลบ" : "ไฟล์ชั่วคราว 24 ชั่วโมง"}
            </small>
          </span>
        </div>
      </aside>
      <main className="analyst-main">
        <header className="conversation-header">
          <div className="conversation-title">
            <button
              className="icon-button mobile-only"
              aria-label="เปิดรายการไฟล์"
              onClick={() => setSidebarOpen(true)}
            >
              <PanelLeftOpen size={21} />
            </button>
            <span>AI Data Analyst</span>
            <ChevronRight size={14} />
            <strong title={dataset?.filename}>
              {dataset?.filename ?? "บทสนทนาใหม่"}
            </strong>
          </div>
          {dataset?.status === "ready" && (
            <div
              className="view-tabs"
              role="tablist"
              aria-label="มุมมองข้อมูล"
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  const next = view === "chat" ? "data" : "chat";
                  setView(next);
                  document.getElementById(`${next}-tab`)?.focus();
                }
              }}
            >
              <button
                role="tab"
                aria-selected={view === "chat"}
                aria-controls="chat-view"
                id="chat-tab"
                onClick={() => setView("chat")}
              >
                <MessageSquare size={15} /> แชต
              </button>
              <button
                role="tab"
                aria-selected={view === "data"}
                aria-controls="data-view"
                id="data-tab"
                onClick={() => setView("data")}
              >
                <Table2 size={15} /> ตารางและสถิติ
              </button>
            </div>
          )}
        </header>
        <div className="conversation-body">
          {error && (
            <div className="workspace-alert">
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>ยังไม่สามารถดำเนินการได้</AlertTitle>
                <AlertDescription>
                  <p>{error}</p>
                  {dataset?.status === "ready" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRevision((value) => value + 1)}
                    >
                      ลองโหลดข้อมูลอีกครั้ง
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          )}
          {busy && (
            <div className="processing-state" role="status">
              <LoaderCircle className="spinning" size={20} /> กำลังอ่านข้อมูลของคุณ…
            </div>
          )}
          {(!dataset || showUpload) && !busy && (
            <section className="welcome-upload">
              <div className="welcome-symbol">
                <Sparkles size={30} strokeWidth={1.4} />
              </div>
              <h1>เริ่มบทสนทนากับข้อมูลของคุณ</h1>
              <p>อัปโหลดไฟล์ แล้วถามสิ่งที่คุณอยากรู้</p>
              <UploadPanel busy={busy} onFile={onFile} />
              {dataset && (
                <Button variant="ghost" onClick={() => setShowUpload(false)}>
                  กลับไปยังบทสนทนา
                </Button>
              )}
            </section>
          )}
          {dataset && !showUpload && (
            <>
              {dataset.status === "needs_sheet" && (
                <div className="sheet-prompt">
                  <Sparkles size={28} />
                  <h1>เลือกชีตเพื่อเริ่มวิเคราะห์</h1>
                  <p>{dataset.filename}</p>
                </div>
              )}
              <div
                className={`sheet-control ${dataset.sheets.length > 0 ? "" : "empty-sheet-control"}`}
              >
                <SheetSelector
                  dataset={dataset}
                  busy={busy}
                  onSelect={onSheet}
                />
              </div>
              {warnings.length > 0 && (
                <details className="data-warnings">
                  <summary>ข้อสังเกตเกี่ยวกับข้อมูล ({warnings.length})</summary>
                  <ul>
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </details>
              )}
              {dataset.status === "ready" && !busy && (
                <div
                  id="chat-view"
                  role="tabpanel"
                  aria-labelledby="chat-tab"
                  hidden={view !== "chat"}
                  className="chat-view"
                >
                  <ChatPanel
                    key={`${dataset.id}:${dataset.selected_sheet}`}
                    datasetId={dataset.id}
                    filename={dataset.filename}
                    selectedSheet={dataset.selected_sheet}
                  />
                </div>
              )}
              <div
                id="data-view"
                role="tabpanel"
                aria-labelledby="data-tab"
                hidden={view !== "data" || dataset.status !== "ready"}
                className="data-view"
              >
                <div className="data-view-heading">
                  <div>
                    <h1>สำรวจข้อมูล</h1>
                    <p>{dataset.filename}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={reset}
                  >
                    <Trash2 size={15} /> ลบข้อมูลและเริ่มใหม่
                  </Button>
                </div>
                {preview && (
                  <ChartPanel
                    key={`${dataset.id}:${dataset.selected_sheet}`}
                    datasetId={dataset.id}
                    columns={preview.columns}
                    selectedSheet={dataset.selected_sheet}
                  />
                )}
                <StatisticsPanel
                  statistics={statistics}
                  columns={preview?.columns ?? []}
                />
                {loading && (
                  <div className="loading-line" role="status">
                    <LoaderCircle className="spinning" /> กำลังโหลดข้อมูล
                  </div>
                )}
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
                    pageOffsets.length > 1
                      ? pageOffsets[pageOffsets.length - 2]
                      : 0
                  }
                  onPage={(value) => {
                    if (value < offset)
                      setPageOffsets((values) => values.slice(0, -1));
                    else if (value > offset)
                      setPageOffsets((values) => [...values, value]);
                    setOffset(value);
                  }}
                />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
