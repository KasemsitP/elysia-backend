# CLAUDE.md

## Project Overview

โปรเจกต์นี้คือระบบจัดการข้อสอบและตรวจคะแนนแบบปลอดภัย โดยมี workflow หลักตั้งแต่การสร้างแคมเปญสอบ กำหนดรอบสอบ วิชา หัวข้อข้อสอบ การสร้างเล่มข้อสอบพร้อม QR payload การจัดข้อสอบลงถุง การมอบหมายผู้ตรวจ การตรวจคะแนนแบบ draft และการยืนยันคะแนนทั้งถุง ไปจนถึงการออกรายงาน PDF และการปลดล็อกข้อมูลผู้เข้าสอบ

ระบบนี้เน้นการปกปิดตัวตนผู้เข้าสอบระหว่างการจัดถุงและการตรวจคะแนน โดยใช้ `random_num` เป็นลำดับจัดเก็บแทนรหัสผู้เข้าสอบจริง ส่วน QR payload จะถูก mask/encrypt เพื่อป้องกันไม่ให้ผู้ตรวจหรือผู้ที่เห็นข้อมูลทั่วไปสามารถระบุตัวผู้เข้าสอบได้โดยตรง

---

## Core Domain

ระบบประกอบด้วย entity หลักดังนี้:

- `exam_campaigns` — แคมเปญสอบ เช่น ปีสอบ สนามสอบ ขนาดสนาม และสถานะ unlock
- `sessions` — รอบสอบหรือวันสอบในแคมเปญ
- `subjects` — วิชาสอบ
- `session_subjects` — วิชาที่อยู่ในแต่ละรอบสอบ
- `subject_questions` — หัวข้อ/ข้อสอบย่อยของแต่ละวิชา พร้อมคะแนนเต็ม
- `booklets` — เล่มข้อสอบของผู้เข้าสอบ มี QR payload, random_num, bag_id
- `bags` — ถุงข้อสอบในแต่ละ session
- `graders` — ผู้ตรวจข้อสอบ
- `grader_assignments` — งานตรวจที่มอบหมายให้ผู้ตรวจ เช่น session, subject, question
- `grading_slots` — slot การตรวจของเล่มหนึ่ง วิชาหนึ่ง ข้อหนึ่ง โดยผู้ตรวจคนที่ 1 หรือ 2
- `grading_score_drafts` — คะแนนชั่วคราวก่อนยืนยัน
- `grading_scores` — คะแนนจริงหลังยืนยัน
- `grader_work_locks` — lock งานตรวจ เพื่อบังคับให้ผู้ตรวจตรวจถุงเดิม/ข้อเดิมจนเสร็จ

---

## Important Business Rules

1. ก่อน campaign unlock ห้ามเปิดเผยตัวตนผู้เข้าสอบ
2. ใน locked mode ให้ใช้ `random_num` แทน `user_code`
3. QR payload ต้องถูก mask/encrypt และไม่ควร log plaintext payload
4. ผู้ตรวจต้องตรวจตาม assignment เท่านั้น
5. การหา assignment ต้อง join `subject_questions` ด้วย `sq.id = ga.subject_question_id`
6. ผู้ตรวจหนึ่งคนตรวจได้ทีละถุงและทีละข้อผ่าน `grader_work_locks`
7. หนึ่ง booklet + subject + question มีผู้ตรวจได้สูงสุด 2 คน
8. ถ้ายังไม่มี slot ให้เป็น `grader_order = 1`
9. ถ้ามี slot แล้ว 1 คน ให้เป็น `grader_order = 2`
10. ถ้ามีครบ 2 คนแล้ว ห้ามสร้าง slot เพิ่ม
11. ระหว่างยังเป็น draft ผู้ตรวจสามารถแก้คะแนนซ้ำได้เฉพาะในถุงและข้อที่กำลัง lock อยู่
12. เมื่อ confirm แล้ว ห้ามแก้คะแนนโดยตรง ต้องผ่าน flow แก้ไขคะแนนและมี log
13. Backend ต้อง validate คะแนนเสมอ ห้ามเชื่อ frontend
14. คะแนนต้องไม่ติดลบ และต้องไม่เกิน `subject_questions.max_score`
15. หากระบบไม่รองรับทศนิยม ต้อง validate ว่าคะแนนเป็น integer ทั้ง frontend และ backend
16. การ sort `random_num` ให้ใช้ numeric sort เช่น `CAST(random_num AS UNSIGNED)`
17. งาน PDF หนักควรทำผ่าน `worker_threads`

---

## Grading Flow

Flow การตรวจคะแนนโดยย่อ:

1. ผู้ตรวจ login
2. ระบบหา grader profile จาก account
3. โหลด assignment ของผู้ตรวจใน campaign ปัจจุบัน
4. ผู้ตรวจเลือกข้อที่ต้องการตรวจ
5. สแกน QR ของเล่มข้อสอบ
6. Backend unmask payload และหา booklet
7. ตรวจว่า booklet อยู่ใน bag แล้ว
8. ตรวจว่า grader มี assignment สำหรับ session/subject/question นี้
9. ตรวจหรือสร้าง active lock
10. สร้างหรือ reuse grading slot
11. ผู้ตรวจกรอกคะแนน
12. บันทึกคะแนนลง `grading_score_drafts`
13. เมื่อครบทุกเล่มในถุง กด confirm ทั้งหมด
14. Backend validate และ insert ไป `grading_scores`
15. Mark slot เป็น completed
16. Check disputed score ถ้าคะแนนผู้ตรวจ 1 และ 2 ต่างกันเกินเกณฑ์
17. Mark draft เป็น confirmed
18. Release lock

---

## QR / Security Notes

QR payload ใช้สำหรับระบุเล่มข้อสอบ โดยข้อมูลภายในอาจมี campaign id, session id, user id หรือ user code ขึ้นกับ flow

ตัวอย่าง plaintext ก่อนเข้ารหัส:

```json
{"cid":1000,"sid":2000,"uid":3000}

ข้อควรระวัง:

ห้ามเปิดเผย plaintext QR payload โดยไม่จำเป็น
ห้าม log key, plaintext payload หรือข้อมูลที่สามารถระบุตัวผู้เข้าสอบ
ถ้าต้องการรู้ว่า payload เป็นของใคร ต้อง decrypt ภายใต้สิทธิ์ที่ถูกต้อง
ห้ามสร้าง mapping แบบเปิดเผยง่าย เช่น payload -> user_code หาก requirement คือคนดู database ต้องไม่รู้ตัวตนผู้เข้าสอบ
การ unlock campaign เท่านั้นที่ควรเปิดเผยชื่อหรือรหัสผู้เข้าสอบจริง
PDF / Reports

ระบบมีรายงาน PDF หลัก เช่น:

ใบรายการ payload ในถุง
ใบกรอกคะแนนสำหรับผู้ตรวจ
รายงานคะแนนถุงแบบ locked
รายงานคะแนนถุงแบบ unlocked
รายงานผู้ตรวจ
รายงานบัญชีผู้สอบผ่าน
รายงานจัดอันดับคะแนน

PDF ควร generate ผ่าน worker thread เพื่อไม่ block main server

ฟอนต์หลักสำหรับ PDF ภาษาไทย:

THSarabunNew.ttf
THSarabunNew-Bold.ttf
Backend Coding Style

เขียน backend ด้วย TypeScript และ Elysia โดยเน้น clean code, type-safety และแยก responsibility ชัดเจน


API response ควรเป็นรูปแบบเดียวกัน:

Success:

{
  success: true,
  data: ...
}

Error:

{
  success: false,
  message: "ข้อความ error",
  errors?: [...]
}
Timezone Rule

เลือกแนวทาง timezone ให้ชัดเจน ห้ามใช้ปนกัน

Preferred:

เก็บ UTC ใน database
แปลงเป็นเวลาไทยตอนแสดงผล

Alternative:

ถ้าต้องเก็บเวลาไทยใน DB ให้ใช้ helper กลางเสมอ
ห้ามใช้ NOW() ปนกับเวลาที่สร้างจาก application
What AI Should Do

เมื่อช่วยเขียนโค้ดในโปรเจกต์นี้ ให้ทำตามนี้เสมอ:

เขียน TypeScript แบบ clean และ typesafe
ใช้ Elysia schema validate request
แยก route, service, repo, type ให้ชัดเจน
ไม่ใช้ any หากสามารถระบุ type ได้
ไม่เขียน business logic ใน route
ไม่เขียน SQL ใน service ถ้าไม่จำเป็น ให้แยกไป repo
ใช้ transaction ในงานที่เปลี่ยนหลายตาราง
Validate สิทธิ์และ context ฝั่ง backend เสมอ
ระวังข้อมูลผู้เข้าสอบ ห้ามเปิดเผยก่อน unlock
ระวัง QR payload, key และ plaintext ห้าม log
อธิบายโค้ดที่แก้แบบตรงจุด และบอกไฟล์/ฟังก์ชันที่ต้องแก้ให้ชัดเจน
