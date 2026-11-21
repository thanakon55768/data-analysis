"use client";
import { useRef, useState } from "react";
import { Upload, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
export function UploadPanel({
  busy,
  onFile,
}: {
  busy: boolean;
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div className="upload-grid">
      <section
        className={`dropzone ${drag ? "dragging" : ""}`}
        aria-label="อัปโหลดข้อมูล"
        aria-busy={busy}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDrag(false);
          if (!busy && event.dataTransfer.files[0])
            onFile(event.dataTransfer.files[0]);
        }}
      >
        {busy ? (
          <LoaderCircle className="upload-icon spinning" aria-hidden="true" />
        ) : (
          <Upload className="upload-icon" aria-hidden="true" />
        )}
        <h2>{busy ? "กำลังประมวลผลข้อมูล…" : "ลากไฟล์มาวางที่นี่"}</h2>
        <p>หรือเลือกไฟล์จากเครื่องของคุณ</p>
        <input
          ref={input}
          type="file"
          accept=".csv,.tsv,.json,.jsonl,.xls,.xlsx,.ods"
          className="sr-only"
          tabIndex={-1}
          aria-label="ไฟล์ข้อมูล"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onFile(file);
          }}
        />
        <Button
          size="lg"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? "กำลังวิเคราะห์…" : "เลือกไฟล์"}
        </Button>
        <p className="caption">CSV / TSV / JSON / JSONL / XLS / XLSX / ODS · สูงสุด 10 MB</p>
      </section>
      <aside className="upload-guide">
        <h2>ก่อนเริ่มวิเคราะห์</h2>
        <ul>
          <li>ใช้ไฟล์ CSV ที่เข้ารหัส UTF-8 เพื่อให้อ่านภาษาไทยได้ถูกต้อง</li>
          <li>สำหรับ Excel เลือกชีตที่ต้องการหลังอัปโหลด</li>
          <li>แถวแรกเป็นชื่อคอลัมน์ · ไม่เกิน 100,000 แถว และ 200 คอลัมน์</li>
        </ul>
      </aside>
    </div>
  );
}
