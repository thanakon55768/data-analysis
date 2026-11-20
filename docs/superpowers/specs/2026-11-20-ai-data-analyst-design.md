# AI Data Analyst — approved design

ผู้ใช้ยืนยันแบบระบบเมื่อ 20 พฤศจิกายน 2026 โดยอ้างอิงข้อเสนอในแชตและ Project Specification ที่แนบมา

## Goal
เว็บภาษาไทยสำหรับผู้ใช้ทั่วไป อัปโหลด CSV/XLSX ตรวจข้อมูล วิเคราะห์ด้วย Python ถามผ่าน Gemini แสดงกราฟ และดาวน์โหลดรายงาน โดยไม่มีผลวิเคราะห์ปลอม

## Architecture and decisions
- Next.js / React / TypeScript / Tailwind / shadcn/ui / Recharts / TanStack Table frontend
- FastAPI / Pandas / NumPy / OpenPyXL / SciPy backend
- Supabase Auth / PostgreSQL / private Storage
- Gemini ใช้เลือกเครื่องมือจาก allowlist และอธิบายผล Python เท่านั้น ห้าม eval/exec หรือรัน SQL/Python ที่ AI สร้าง
- ReportLab PDF พร้อมฟอนต์ภาษาไทย; frontend deploy Vercel, backend Render
- repository เดียว แยก frontend, backend, supabase/migrations และ docs

## Approaches
พิจารณาต้นแบบในเครื่องแล้วเพิ่มบัญชีภายหลัง เทียบกับออกแบบรองรับหลายบัญชีตั้งแต่ต้น ผู้ใช้ยืนยันแนวทางหลัง: Phase 1 ทดลองในเครื่องได้ แต่ต้องเพิ่ม authentication และตรวจเจ้าของข้อมูลก่อนเปิดออนไลน์

## Database
profiles(id referencing auth user, display_name, created_at)
datasets(id, user_id, original_name, storage_path, size_bytes, sheet_name, row_count, column_count, status, version, created_at)
dataset_columns(id, dataset_id, ordinal, name, dtype, missing_count)
analysis_runs(id, dataset_id, user_id, kind, parameters_json, result_json, algorithm_version, status, created_at)
chat_sessions(id, dataset_id, user_id, title, created_at)
chat_messages(id, session_id, role, content, analysis_run_id, created_at)
charts(id, dataset_id, analysis_run_id, chart_type, config_json)
reports(id, dataset_id, user_id, storage_path, status, created_at)

ใช้ UUID, foreign keys, owner indexes, RLS และ private Storage policies; การตรวจสิทธิ์ต้องครอบคลุมความสัมพันธ์และไฟล์ ไม่เชื่อ user_id จาก client การลบต้องมีขั้นตอนล้างไฟล์และข้อมูลที่เกี่ยวข้อง

## Phases
1. Local core: upload, sheet selection, paginated preview, real statistics
2. Accounts/storage: Supabase Auth, ownership, RLS, upload history/deletion
3. Gemini chat: validated tools, conversation, ambiguity handling, computation evidence
4. Dashboard/charts: correct axes/aggregation, user selection, explicit sampling
5. Outliers/PDF/history/profile
6. End-to-end verification and deployment

## Constraints
- API keys server-side environment only; no fake statistics or silent data cleaning
- Preserve original files; expose missing values, duplicate rows and interpretation warnings
- File proposal: 10 MiB, 100,000 rows; validate resource behavior before production
- Limit expanded XLSX size, column count, processing duration, preview payload and concurrent work
- Phase 1 is local-only and has no user accounts; no public deployment or persistence claim
- Gemini, Supabase and hosting setup remain later-phase work; no credentials required for Phase 1

## Acceptance
Each phase must have real verification. Cross-account denial is required before online release. AI results must originate from Python, PDF Thai text must be visually checked, and the final flow covers signup → upload → analysis → chat → report → deletion.
