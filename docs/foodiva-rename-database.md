# แก้ชื่อ Foodiva ในฐานข้อมูล (ค้างทำ)

- เขียน 2026-09-15 · commit โค้ด `299ac72` (`fix/foodiva-spelling`, merge เข้า `main` แล้ว)
- สถานะ: **โค้ดใช้ชื่อใหม่แล้ว แต่ข้อมูลใน Supabase จริงยังเป็นชื่อเก่า** — migration ยังไม่ได้รัน และยังไม่ได้ทดสอบ (ตอนนั้น Docker ไม่ได้เปิด)

## ชื่อที่เปลี่ยน

| ชื่อเก่า (ยังอยู่ใน `app_state.payload`) | ชื่อใหม่ (โค้ดใน `main`) | อยู่ตรงไหนใน payload |
|---|---|---|
| `fooddiva` | `foodiva` | `entries[].role` |
| `foodDivaConfirm` | `foodivaConfirm` | `entries[].kind` |
| `foodDivaReturnReceive` | `foodivaReturnReceive` | `entries[].kind` |
| `foodDivaContact` | `foodivaContact` | `config`, `lots[].config` |
| `foodDivaAddress` | `foodivaAddress` | `config`, `lots[].config` |

และ `save_app_state` (migration `20260914000009`) ยังเช็ก role ของบัญชี `L4_SUPPLIER` เป็น `'fooddiva'`

## ⚠️ ห้าม deploy `main` ขึ้นระบบจริงก่อนรัน migration

ถ้า deploy ก่อน:
- Foodiva บันทึกอะไรไม่ได้เลย — `Entry role does not match signed-in account`
- Lot เก่าที่ Foodiva ยืนยัน Invoice / รับเนื้อรมควันไปแล้ว ระบบจะมองไม่เห็นรายการนั้น → ยอดพร้อมส่ง, stage, สต๊อก คำนวณผิด
- หน้าตั้งค่าแสดงผู้ติดต่อ / ที่อยู่ Foodiva ว่าง — **อย่ากดบันทึกตั้งค่า** เพราะจะมีทั้ง key เก่าและใหม่ใน config แล้วตอนรัน migration ค่าเก่าจะทับค่าใหม่

## ขั้นตอนตอนกลับมาทำ

1. เปิด Docker Desktop แล้วรัน `bash supabase/tests/migrations_apply_test.sh` → ต้องได้ `all green`
2. สำรองข้อมูล: `select payload, revision from public.app_state;` เก็บผลเป็นไฟล์
3. รัน `supabase/migrations/20260915000011_rename_foodiva.sql` บน Supabase จริง
   - เปลี่ยนชื่อใน payload ครั้งเดียว, เพิ่ม `revision` (เครื่องที่เปิดค้างจะต้องโหลดใหม่ก่อนบันทึก), สร้าง `save_app_state` ใหม่ที่เช็ก `'foodiva'`
   - ถ้ายังเหลือชื่อเก่า migration จะ error เองและไม่เปลี่ยนอะไร
4. Deploy `main` **ทันทีหลังข้อ 3** — build เก่าอ่านชื่อใหม่ไม่ออก
5. ให้ทุกคน reload หน้าเว็บ
6. ตรวจ: query นี้ต้องได้ `false`
   ```sql
   select payload::text like '%"fooddiva"%' or payload::text like '%"foodDiva%' from public.app_state;
   ```

## ถ้าต้องย้อนกลับ

1. คืน payload จากไฟล์สำรองในข้อ 2 (และตั้ง `revision` ให้มากกว่าค่าปัจจุบัน)
2. สร้าง `save_app_state` กลับเป็น `'fooddiva'` (คัดจาก `20260914000009_auth_and_app_state_api.sql`)
3. Deploy build ก่อน commit `299ac72`

## หมายเหตุ

- Migration ใช้ text replace — ถ้าผู้ใช้เคยพิมพ์ข้อความที่เป็น `"fooddiva"` พอดี หรือขึ้นต้นด้วย `foodDiva` จะถูกแก้สะกดไปด้วย (ไม่กระทบการทำงาน)
- ข้อความที่ผู้ใช้เห็นบนหน้าจอสะกด "Foodiva" ถูกอยู่แล้ว ปัญหามีแค่ชื่อภายใน
