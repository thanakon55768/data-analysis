"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Sparkles,
  Check,
  Copy,
  ChevronDown,
  FileSpreadsheet,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  askQuestion,
  getChat,
  type ChatTurn,
  type VisualizationResult,
} from "./api";

const ChatChart = dynamic(
  () => import("./chart-panel").then((module) => module.ChartCanvas),
  { ssr: false },
);

function Evidence({ evidence }: { evidence: Record<string, unknown> }) {
  const rows = Array.isArray(evidence.groups)
    ? evidence.groups
    : Array.isArray(evidence.numeric)
      ? evidence.numeric
      : [];
  const numeric = !Array.isArray(evidence.groups);
  const format = (value: unknown) =>
    typeof value === "number"
      ? value.toLocaleString("th-TH", { maximumFractionDigits: 6 })
      : value == null
        ? "—"
        : String(value);
  return (
    <div className="evidence-content">
      {typeof evidence.row_count === "number" && (
        <p>คำนวณจากข้อมูล {evidence.row_count.toLocaleString("th-TH")} แถว</p>
      )}
      {rows.length > 0 && (
        <div className="evidence-table">
          <table>
            <thead>
              <tr>
                {(numeric
                  ? ["คอลัมน์", "จำนวนค่า", "ผลรวม", "ค่าเฉลี่ย", "ต่ำสุด", "สูงสุด"]
                  : ["กลุ่ม", String(evidence.metric ?? "ผลลัพธ์")]
                ).map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row: Record<string, unknown>, index: number) => (
                <tr key={index}>
                  {(numeric
                    ? [
                        row.column_id,
                        row.count,
                        row.sum,
                        row.mean,
                        row.min,
                        row.max,
                      ]
                    : [row.group ?? "ค่าว่าง", row.value]
                  ).map((value, index) => (
                    <td key={index}>{format(value)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <details className="raw-evidence">
        <summary>ดูรายละเอียดทั้งหมด</summary>
        <pre>{JSON.stringify(evidence, null, 2)}</pre>
      </details>
    </div>
  );
}

export function ChatPanel({
  datasetId,
  filename,
  selectedSheet,
}: {
  datasetId: string;
  filename: string;
  selectedSheet: string | null;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState("");
  const [shareAnalysis, setShareAnalysis] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const messages = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    getChat(datasetId, controller.signal)
      .then(setTurns)
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : "โหลดบทสนทนาไม่สำเร็จ",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      active.current?.abort();
    };
  }, [datasetId]);
  useEffect(() => {
    messages.current?.scrollTo({
      top: messages.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, busy]);
  useEffect(() => {
    if (input.current) {
      input.current.style.height = "auto";
      input.current.style.height = `${Math.min(input.current.scrollHeight, 160)}px`;
    }
  }, [question]);
  async function send() {
    if (busy || loading || !question.trim() || !consent) return;
    const controller = new AbortController();
    active.current = controller;
    const text = question.trim();
    setPending(text);
    setQuestion("");
    setBusy(true);
    setError("");
    try {
      const turn = await askQuestion(datasetId, text, controller.signal, {
        share_analysis: shareAnalysis,
        expected_sheet: selectedSheet ?? "",
      });
      if (!controller.signal.aborted)
        setTurns((values) => [...values, turn].slice(-20));
    } catch (error) {
      if (!controller.signal.aborted) {
        setQuestion(text);
        setError(error instanceof Error ? error.message : "ส่งคำถามไม่สำเร็จ");
      }
    } finally {
      if (!controller.signal.aborted) {
        setPending("");
        setBusy(false);
        input.current?.focus();
      }
    }
  }
  async function copy(turn: ChatTurn) {
    try {
      await navigator.clipboard.writeText(turn.answer);
      setCopied(turn.id);
    } catch {
      setError("คัดลอกไม่ได้ กรุณาเลือกข้อความแล้วคัดลอกด้วยตนเอง");
    }
  }
  return (
    <section className="chat-panel" aria-label="ถามข้อมูลด้วย AI">
      <div
        ref={messages}
        className="chat-messages"
        role="log"
        aria-live="polite"
        aria-busy={busy || loading}
      >
        {loading && (
          <div className="chat-loading">
            <LoaderCircle className="spinning" size={18} /> กำลังเปิดบทสนทนา…
          </div>
        )}
        {!loading && turns.length === 0 && !busy && (
          <div className="chat-welcome">
            <span className="welcome-symbol">
              <Sparkles size={31} strokeWidth={1.4} />
            </span>
            <h1>วันนี้อยากรู้อะไรจากข้อมูล?</h1>
            <p>เริ่มถามได้เลย แล้วเราจะหาคำตอบจากไฟล์ของคุณ</p>
            <div className="attached-file">
              <FileSpreadsheet size={16} />
              <span>{filename}</span>
            </div>
            <div className="prompt-suggestions">
              {[
                "ข้อมูลนี้เกี่ยวกับอะไร",
                "ช่วยทำกราฟเปรียบเทียบให้หน่อย",
                "มีประเด็นอะไรที่น่าสนใจบ้าง",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setQuestion(prompt);
                    input.current?.focus();
                  }}
                >
                  <MessagePromptIcon />
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((turn) => (
          <article className="chat-turn" key={turn.id}>
            <div className="user-message">
              <span className="sr-only">คุณ</span>
              <p>{turn.question}</p>
            </div>
            <div className="assistant-message">
              <span className="assistant-avatar">
                <Sparkles size={18} />
              </span>
              <div className="assistant-content">
                <div className="assistant-name">Data Analyst</div>
                <p className="answer-text">{turn.answer}</p>
                {turn.explanation_by_ai && (
                  <span className="explanation-label">
                    คำอธิบายจาก AI · ตรวจสอบตัวเลขในหลักฐาน
                  </span>
                )}
                {turn.evidence &&
                  Array.isArray(turn.evidence.points) &&
                  typeof turn.evidence.chart_kind === "string" && (
                    <div className="chat-inline-chart">
                      <ChatChart
                        result={turn.evidence as unknown as VisualizationResult}
                        kind={
                          turn.evidence
                            .chart_kind as import("./chart-panel").ChartKind
                        }
                      />
                    </div>
                  )}
                {turn.explanation_by_ai && turn.computed_answer && (
                  <details className="computed-answer">
                    <summary>ผลคำนวณโดยตรง</summary>
                    <p>{turn.computed_answer}</p>
                  </details>
                )}
                {turn.warnings.map((warning) => (
                  <p className="answer-warning" key={warning}>
                    {warning}
                  </p>
                ))}
                {turn.evidence && (
                  <details className="computation-evidence">
                    <summary>
                      <Check size={14} /> ตรวจสอบผลคำนวณ{" "}
                      <ChevronDown size={14} />
                    </summary>
                    <Evidence evidence={turn.evidence} />
                  </details>
                )}
                <button
                  className="icon-button copy-answer"
                  aria-label={copied === turn.id ? "คัดลอกแล้ว" : "คัดลอกคำตอบ"}
                  onClick={() => copy(turn)}
                >
                  {copied === turn.id ? (
                    <Check size={15} />
                  ) : (
                    <Copy size={15} />
                  )}
                </button>
              </div>
            </div>
          </article>
        ))}
        {busy && (
          <div className="chat-turn">
            <div className="user-message">
              <p>{pending}</p>
            </div>
            <div className="assistant-message">
              <span className="assistant-avatar">
                <Sparkles size={18} />
              </span>
              <div className="thinking-status" role="status">
                <span className="thinking-dots">
                  <i />
                  <i />
                  <i />
                </span>
                กำลังวิเคราะห์ข้อมูล…
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="composer-dock">
        {error && (
          <p className="chat-error" role="alert">
            {error}
          </p>
        )}
        <form
          className="chat-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label htmlFor="chat-question" className="sr-only">
            คำถามเกี่ยวกับข้อมูล
          </label>
          <textarea
            ref={input}
            id="chat-question"
            maxLength={2000}
            rows={1}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder="ถามอะไรก็ได้เกี่ยวกับข้อมูลนี้…"
            disabled={busy}
          />
          <div className="composer-toolbar">
            <span>
              <FileSpreadsheet size={14} />
              <span>{filename}</span>
            </span>
            <Button
              className="send-question"
              aria-label="ส่งคำถาม"
              disabled={busy || loading || !consent || !question.trim()}
              type="submit"
            >
              {busy ? (
                <LoaderCircle size={18} className="spinning" />
              ) : (
                <ArrowUp size={20} />
              )}
            </Button>
          </div>
        </form>
        <label className="chat-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <span>อนุญาตให้ส่งคำถาม ชื่อคอลัมน์ และบริบทบทสนทนาไป Gemini</span>
        </label>
        <label className="chat-consent context-consent">
          <input
            type="checkbox"
            checked={shareAnalysis}
            onChange={(event) => setShareAnalysis(event.target.checked)}
          />
          <span>
            เพิ่มความเข้าใจ โดยส่งตัวอย่างสูงสุด 5 แถวแรก (12 คอลัมน์) สรุปข้อมูล
            และผลคำนวณให้ Gemini อธิบาย
          </span>
        </label>
        <p className="composer-note">
          AI อาจตีความคลาดเคลื่อน ตรวจสอบผลคำนวณประกอบคำตอบ · Shift + Enter
          ขึ้นบรรทัดใหม่
        </p>
      </div>
    </section>
  );
}

function MessagePromptIcon() {
  return <ArrowUp size={14} className="suggestion-arrow" />;
}
