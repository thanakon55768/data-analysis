# AI Data Analyst — Phase 1

เว็บภาษาไทยสำหรับอัปโหลด ไฟล์ตารางและ JSON ดูตาราง ค้นหา และคำนวณสถิติจาก Python จริง ยังไม่ต้องใช้ API key

## ใช้งานได้

- CSV และ TSV แบบ UTF-8, JSON และ JSONL รวมถึง XLS, XLSX และ ODS พร้อมเลือกชีต
- ตาราง 50 แถวต่อหน้า ค้นหาข้อความทุกคอลัมน์แบบ literal
- จำนวนแถว/คอลัมน์ ค่าว่าง แถวที่มีค่าว่าง ข้อมูลซ้ำ
- ผลรวม ค่าเฉลี่ย มัธยฐาน ต่ำสุด/สูงสุดของแต่ละคอลัมน์ตัวเลข
- Loading/error/empty states คำเตือนสูตร Excel และชื่อคอลัมน์ซ้ำ/ว่าง
- ลบไฟล์ต้นฉบับและข้อมูลที่ประมวลผลด้วยปุ่ม “ลบข้อมูลและเริ่มใหม่”

## โครงสร้าง

- frontend/: Next.js + TypeScript + Tailwind + shadcn/ui + TanStack Table
- backend/: FastAPI + Pandas + NumPy + OpenPyXL
- docs/: แบบระบบ แผน และหลักฐานตรวจรับ
- legacy-vite/: starter เดิมสำหรับอ้างอิง

## ติดตั้ง — Windows / PowerShell

ใช้ Node.js 24 และ Python 3.12 ขึ้นไป (ทดสอบด้วย Python 3.14) เปิด terminal ในโฟลเดอร์ data-anlysisV:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-lock.txt
npm.cmd --prefix frontend ci
```

ไม่ต้องสร้าง .venv ใหม่หากมีจากการติดตั้งครั้งก่อน

Terminal 1 — Backend:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Terminal 2 — Frontend:

```powershell
npm.cmd --prefix frontend run dev
```

เปิด [เว็บไซต์](http://127.0.0.1:3000), [Backend health](http://127.0.0.1:8000/health), [API docs](http://127.0.0.1:8000/docs)

Frontend proxy ใช้ http://127.0.0.1:8000 โดยปริยาย หากเปลี่ยนพอร์ต Backend ให้คัดลอก frontend/.env.example เป็น frontend/.env.local แล้วแก้ FASTAPI_URL และ restart Frontend ห้ามใช้ NEXT_PUBLIC_ สำหรับ server URL หรือ keys

## ทดสอบ

จากโฟลเดอร์โปรเจกต์:

```powershell
.\.venv\Scripts\python.exe -m pytest backend -q -c backend/pyproject.toml
.\.venv\Scripts\ruff.exe check backend/app backend/tests --config backend/pyproject.toml
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run build
```

Browser E2E ใช้ production build และ Backend จริงบนพอร์ตแยก 3001/8001 (ต้องว่าง) รันจาก frontend:

```powershell
cd frontend
$env:PLAYWRIGHT_BROWSERS_PATH = (Join-Path (Split-Path (Get-Location)) '.browsers')
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

ทดสอบด้วยข้อมูลสังเคราะห์เฉพาะ tests ไม่เติมข้อมูลลงแอป ไฟล์ E2E อยู่ใน .data-e2e และภาพหน้าจอใน frontend/output/playwright ซึ่งไม่ติด Git

## ขอบเขตข้อมูล

- ไฟล์ไม่เกิน 10 MiB, 100,000 แถวข้อมูล, 200 คอลัมน์ และ 2,000,000 เซลล์
- XLSX และ ODS หลังคลายไม่เกิน 100 MiB และ 2,000 archive members; ไม่รองรับไฟล์เข้ารหัส
- อ่านไฟล์ใน child process ยุติได้เมื่อเกิน 30 วินาที อ่านพร้อมกันได้ 1 งาน ตอบให้ลองใหม่เมื่อไม่ว่าง
- CSV ใช้จุลภาค ส่วน TSV ใช้แท็บ โดยแถวแรกเป็นชื่อคอลัมน์
- JSON ใช้อาร์เรย์ของออบเจ็กต์ ส่วน JSONL ใช้หนึ่งออบเจ็กต์ต่อบรรทัด คีย์ที่ขาดจะแสดงเป็นค่าว่าง และค่าซ้อนจะแสดงเป็นข้อความ JSON
- ไม่ข้ามแถว CSV ที่คอลัมน์ไม่ตรงหัวตาราง; บรรทัดว่างทั้งบรรทัดไม่นับเป็นข้อมูล
- ค่าว่างคือเซลล์ว่าง/null; ข้อความ NA ไม่ใช่ค่าว่าง; ข้อมูลซ้ำนับหลังแถวแรก
- รักษาชื่อคอลัมน์ซ้ำ/ว่าง ใช้รหัส c0, c1… เพื่อแยกคอลัมน์
- ไม่เดาวันเดือน ไม่ลบข้อมูลซ้ำ ไม่เติมค่าว่าง ไม่แปลงสกุลเงินอัตโนมัติ
- แปลงเฉพาะคอลัมน์ CSV ที่เป็นตัวเลขชัดเจน; รหัส 001 และจำนวนเต็มเกินช่วงความแม่นยำเว็บยังเป็นข้อความ
- คำนวณ floating point แสดงทศนิยมสูงสุด 6 ตำแหน่ง ไม่ใช่ decimal accounting engine
- ไม่คำนวณสูตร Excel ใช้ผลลัพธ์ที่ Excel บันทึกไว้ ถ้าไม่มีแสดงค่าว่างและคำเตือน
- API preview สูงสุด 200 แถว/2 MiB ลดจำนวนแถวต่อหน้าอัตโนมัติ หากแถวเดียวเกินขนาดจะย่อข้อความเฉพาะตัวอย่างพร้อมเตือน ไม่แก้ต้นฉบับ; การค้นหาไม่เปลี่ยนสถิติภาพรวม Dataset
- ข้อมูลหลังขยายข้อความซ้ำต้องไม่เกินงบ 32 MiB ก่อนสร้าง JSON เพื่อควบคุมการใช้หน่วยความจำ
- คอลัมน์ตัวเลขที่แปลงแล้วค่าทศนิยมเปลี่ยนจะรักษาเป็นข้อความพร้อมเตือน ระยะเวลา Excel แสดงเป็นข้อความ ISO 8601 เช่น PT99000S = 27 ชั่วโมง 30 นาที

## การจัดเก็บและข้อจำกัด

ใช้เฉพาะในเครื่อง ไม่มีการเข้าสู่ระบบ **ห้ามเปลี่ยน host เป็น 0.0.0.0 หรือเปิด public tunnel/hosting** ก่อนเพิ่มบัญชีและตรวจเจ้าของข้อมูลใน Phase 2

ไฟล์ต้นฉบับ ข้อมูลแปลงแล้ว และ metadata เก็บใน .data/<UUID>/ ที่รากโปรเจกต์ นอก public directory เปลี่ยนด้วย DATA_DIR อายุ 24 ชั่วโมงนับตั้งแต่อัปโหลด ล้างเมื่อเริ่ม Backend หรือเข้าถึง repository ครั้งถัดไป ไม่ใช่ scheduled deletion ขณะเครื่องปิด

รีเฟรชหน้าเว็บไม่กู้ Dataset เดิม เพราะยังไม่มีประวัติ/บัญชี ไฟล์ที่ไม่ได้กดลบอาจค้างจน cleanup ทำงาน ไม่มีการส่ง Dataset ไปบริการ AI หรือ Storage ภายนอกใน Phase นี้

ยังไม่มี Gemini Chat, Supabase Auth/Storage, กราฟ, Outlier Detection, PDF หรือ deployment ดูแผนระยะต่อไปใน docs/superpowers/specs/2026-11-20-ai-data-analyst-design.md

## เอกสารอ้างอิง

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [FastAPI file uploads](https://fastapi.tiangolo.com/tutorial/request-files/)

## Phase 2
ระบบบัญชีและจัดเก็บไฟล์ส่วนตัวมีโค้ดเตรียมไว้แล้ว ดูขั้นตอนสร้าง Supabase ตั้ง environment รัน migration และตรวจรับสองบัญชีใน docs/phase-2-setup.md โหมดเริ่มต้นยังเป็น local

## Phase 3
แชตสำหรับถามภาพรวม สถิติรายคอลัมน์ และการคำนวณแยกกลุ่ม เตรียมพร้อมตั้งค่า Gemini ฝั่ง Backend ดู docs/phase-3-setup.md การทดสอบ Gemini จริงยังรอ API key
