# ตั้งค่า Phase 2

เตรียมโค้ดแล้ว ยังรอสร้าง Supabase และทดสอบบัญชีจริงตามที่ผู้ใช้เลือก

1. สร้างโปรเจกต์ Supabase เปิด Email provider และตั้ง Site URL กับ Redirect URLs เป็น http://127.0.0.1:3000
2. รัน supabase/migrations/202611210001_datasets.sql ใน SQL Editor ของโปรเจกต์ใหม่ ตรวจ RLS และ private bucket datasets
3. คัดลอก frontend/.env.example เป็น frontend/.env.local ตั้ง NEXT_PUBLIC_STORAGE_MODE=supabase และใส่ NEXT_PUBLIC_SUPABASE_URL กับ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ใช้ publishable หรือ legacy anon key
4. Backend รับ environment จาก shell โดยตรง ตั้ง STORAGE_MODE=supabase, SUPABASE_URL และ SUPABASE_PUBLISHABLE_KEY ใน PowerShell ก่อนเปิด uvicorn ตาม README ห้ามใช้ service_role หรือ secret key ในตัวแปรเหล่านี้
5. Restart Backend และ Frontend แล้วสมัครบัญชีและยืนยันอีเมล

## ตรวจรับบริการจริง
- ใช้สองบัญชี A และ B อัปโหลดทั้งเจ็ดรูปแบบ เปิดจากประวัติหลัง refresh และลบข้อมูล
- ใช้ bearer ของ B เรียก detail, preview, statistics, sheet และ DELETE ของ UUID บัญชี A ต้องไม่มีข้อมูลและแก้ไขไม่ได้
- ใช้ token ของ B เรียก REST และ Storage ของ A โดยตรงเพื่อตรวจ RLS จริง
- ทดสอบ login, logout, email confirmation, password reset และ expired session
- จำลองการลบล้มเหลว แล้วกดล้างไฟล์ซ้ำ ตรวจว่า objects และ metadata ถูกลบหมด
- เปลี่ยนชีตพร้อมกัน คำขอ version เก่าต้องได้ 409

## พฤติกรรม
ไฟล์บัญชีเก็บจนผู้ใช้ลบ โหมด local เก็บชั่วคราวตามเดิม ข้อมูล local ไม่ย้ายเข้าบัญชีอัตโนมัติ ตั้งโหมด Frontend และ Backend ให้ตรงกัน

ผล parsed แต่ละเวอร์ชันเป็นไฟล์ส่วนตัวแยกกัน เวอร์ชันเก่าถูกล้างเมื่อลบ dataset การอัปโหลดที่หยุดกลางทางอาจแสดงรายการให้ล้างไฟล์ ผู้ใช้กดลบซ้ำได้

โหมดบัญชียังใช้ผ่าน localhost การเปิด public deployment และ production origin/host อยู่ในเฟส deployment

ชุดทดสอบจำลองไม่ได้ยืนยัน RLS หรือ Storage policies จริง การตรวจบริการจริงยังค้างจนมี Supabase project
