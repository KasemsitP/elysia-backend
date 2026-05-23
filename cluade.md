# CLAUDE.md

## Skills
Always apply debug-mantra when debugging.
Always write post-mortem after a bug is fixed.
Always scrutinize before making any code changes.
Always use management-talk when writing updates for leadership or non-engineers.

---


## Project Overview

โปรเจกต์นี้คือระบบจัดการข้อสอบและตรวจคะแนนแบบปลอดภัย ใช้สำหรับบริหารงานสอบตั้งแต่การสร้างแคมเปญสอบ การกำหนดวันสอบ วิชา หัวข้อข้อสอบ ผู้เข้าสอบ ห้องสอบ การสร้างเล่มข้อสอบและ QR payload การจัดเล่มข้อสอบลงถุง การมอบหมายผู้ตรวจ การตรวจคะแนนแบบ draft การยืนยันคะแนนทั้งถุง การจัดการเหตุผิดปกติ ไปจนถึงการออกรายงาน PDF และการปลดล็อกข้อมูลผู้เข้าสอบหลังจบกระบวนการที่กำหนด

ระบบต้องออกแบบให้ปกปิดตัวตนผู้เข้าสอบในช่วงจัดถุงและตรวจคะแนน โดยใช้ `random_num` เป็นลำดับจัดเก็บแทน `user_code` หรือชื่อจริงของผู้เข้าสอบ ส่วน QR payload ต้องถูกเข้ารหัสหรือ mask อย่างเหมาะสม เพื่อป้องกันไม่ให้ staff, grader หรือผู้ที่เห็นข้อมูลทั่วไปสามารถระบุตัวผู้เข้าสอบได้โดยตรง

Backend ใช้ TypeScript + Elysia โดยต้องเน้น clean architecture, type-safety, transaction safety, validation ฝั่ง server และการแยก responsibility ชัดเจนระหว่าง route, service, repository, schema และ type

---

## Tech Stack

- Backend: TypeScript, Elysia
- Database: MySQL
- ORM / DB Client: Prisma หรือ mysql2/promise ตาม module ที่เหมาะสม
- Frontend: React + Vite + TypeScript
- API State: TanStack Query เป็นหลัก
- PDF: PDFKit + worker_threads
- Cache / Lock / Queue: Redis สำหรับงานที่ต้องการความเร็วหรือกัน concurrent
- Auth: session/token ตาม implementation ของระบบ
- Validation: Elysia schema หรือ type-safe validator ที่กำหนดไว้ใน module

---

## Coding Principles for AI

เมื่อช่วยเขียนโค้ดในโปรเจกต์นี้ ให้ทำตามนี้เสมอ:

1. เขียน TypeScript แบบ clean และ type-safe
2. หลีกเลี่ยง `any` ถ้าสามารถระบุ type ได้
3. ใช้ Elysia schema validate request body, params และ query
4. แยกไฟล์เป็น route, service, repo, schema, type ให้ชัดเจน
5. ไม่เขียน business logic ใน route
6. ไม่เขียน SQL หรือ Prisma query ซับซ้อนใน route
7. Service ทำหน้าที่ orchestrate business flow
8. Repository ทำหน้าที่คุยกับ database เท่านั้น
9. งานที่เปลี่ยนหลายตารางต้องใช้ transaction
10. Validate สิทธิ์และ context ฝั่ง backend เสมอ
11. ห้ามเชื่อ frontend เรื่อง campaign/session/grader/score
12. ห้าม log plaintext QR payload, encryption key, OTP หรือข้อมูลลับ
13. ระวังข้อมูลผู้เข้าสอบ ห้ามเปิดเผยก่อน campaign unlock
14. Response shape ต้องเป็นมาตรฐานเดียวกันทั้งระบบ
15. ถ้าแก้โค้ด ให้บอกไฟล์ ฟังก์ชัน และเหตุผลที่แก้ชัดเจน

---

## Recommended Backend Structure

```txt
src/
  modules/
    campaign/
      campaign.route.ts
      campaign.service.ts
      campaign.repo.ts
      campaign.schema.ts
      campaign.type.ts
    session/
      session.route.ts
      session.service.ts
      session.repo.ts
      session.schema.ts
      session.type.ts
    subject/
      subject.route.ts
      subject.service.ts
      subject.repo.ts
      subject.schema.ts
      subject.type.ts
    bag/
      bag.route.ts
      bag.service.ts
      bag.repo.ts
      bag.schema.ts
      bag.type.ts
    booklet/
      booklet.route.ts
      booklet.service.ts
      booklet.repo.ts
      booklet.schema.ts
      booklet.type.ts
    grading/
      grading.route.ts
      grading.service.ts
      grading.repo.ts
      grading.schema.ts
      grading.type.ts
    grader/
      grader.route.ts
      grader.service.ts
      grader.repo.ts
      grader.schema.ts
      grader.type.ts
    report/
      report.route.ts
      report.service.ts
      report.repo.ts
      report.schema.ts
      report.type.ts
    notification/
      notification.route.ts
      notification.service.ts
      notification.repo.ts
      notification.schema.ts
      notification.type.ts
    otp/
      otp.route.ts
      otp.service.ts
      otp.repo.ts
      otp.schema.ts
      otp.type.ts
    settings/
      settings.route.ts
      settings.service.ts
      settings.repo.ts
      settings.schema.ts
      settings.type.ts
  shared/
    db/
      prisma.ts
      transaction.ts
    errors/
      AppError.ts
      error-handler.ts
    utils/
      time.ts
      crypto.ts
      response.ts
      pagination.ts
    workers/
      pdf.worker.ts
```

---

## Standard API Response

Success:

```ts
{
  success: true,
  data: T,
  message?: string
}
```

Error:

```ts
{
  success: false,
  message: string,
  errors?: Array<{
    field?: string;
    message: string;
  }>
}
```

---

## Core Domain (Entity Overview)

- `exam_campaigns` — แคมเปญสอบ เช่น ปีสอบ สนามสอบ ขนาดสนาม และสถานะ unlock
- `sessions` — รอบสอบหรือวันสอบในแคมเปญ
- `subjects` — master catalog วิชาสอบ
- `campaign_subjects` — วิชาที่ lock ตาม campaign (snapshot ของปีสอบนั้น)
- `session_subjects` — วิชาที่อยู่ในแต่ละรอบสอบ
- `session_subject_questions` — ข้อสอบจริงที่ใช้ใน session นั้น (source หลักสำหรับ grading)
- `subject_questions` — template/master question ของ subject เท่านั้น
- `booklets` — เล่มข้อสอบของผู้เข้าสอบ มี QR payload, random_num, bag_id
- `bags` — ถุงข้อสอบในแต่ละ session
- `graders` — ผู้ตรวจข้อสอบ
- `grader_assignments` — งานตรวจที่มอบหมายให้ผู้ตรวจ (campaign/session/subject/question)
- `grading_slots` — slot การตรวจของเล่มหนึ่ง วิชาหนึ่ง ข้อหนึ่ง โดยผู้ตรวจคนที่ 1 หรือ 2
- `grading_score_drafts` — คะแนนชั่วคราวก่อนยืนยัน
- `grading_scores` — คะแนนจริงหลังยืนยัน
- `grading_score_logs` — ประวัติการแก้ไขคะแนนหลัง confirm
- `grader_work_locks` — lock งานตรวจ เพื่อบังคับให้ผู้ตรวจตรวจถุงเดิม/ข้อเดิมจนเสร็จ
- `session_counters` — ใช้กัน concurrent ตอนสร้างถุงและออกเลข random_num

---

## Database Domain Model

### 1. Campaign Layer

#### `exam_campaigns`

เก็บแคมเปญสอบ เป็น root entity หลักของระบบ

field สำคัญ: `id`, `name`, `year_be`, `site`, `campaign_size`, `is_active`, `is_unlock`, `qr_active`, `created_at`, `updated_at`, `deleted_at`

#### `campaign_subjects`

ใช้ lock วิชาตาม campaign — `subjects` เป็น master catalog แต่วิชาที่ใช้งานจริงในแต่ละ campaign ต้องอ้างผ่าน `campaign_subjects` เพื่อเก็บ snapshot ของ code, name, full_score ในปีสอบนั้น ๆ

```txt
subjects = แม่แบบวิชากลาง
campaign_subjects = วิชาที่ campaign นี้ใช้งานจริง
```

ข้อสำคัญ:
- Flow จริงควรใช้ `campaign_subject_id`
- ไม่ควรใช้ `subject_id` ตรง ๆ ใน grading flow
- ถ้าชื่อวิชาหรือคะแนนของปีสอบเปลี่ยน จะไม่กระทบ master subject

#### `campaign_settings`

เก็บ settings ตาม campaign เช่น:
- `score_diff_threshold` คะแนนต่างเกินกี่คะแนนให้เป็น disputed
- `passing_quota` จำนวนผู้ผ่าน
- `minimum_passing_score` คะแนนขั้นต่ำ
- `passing_policy` วิธีคัดผู้ผ่าน
- `bag_size` จำนวนเล่มต่อถุง
- `qr_active` เปิด/ปิด QR

#### `setting_definitions`

เก็บนิยาม setting กลาง เช่น key, name, description, type, scope และ default value ใช้สำหรับให้ frontend render form setting และทำ validation ได้เป็นระบบ

---

### 2. Session / Subject / Question Layer

#### `sessions`

แทนวันสอบหรือรอบสอบใน campaign

field สำคัญ: `campaign_id`, `session_code`, `title`, `exam_date`, `day_no`

#### `session_subjects`

แทนวิชาที่อยู่ในวันสอบนั้น ๆ อ้าง `campaign_subject_id` ไม่ใช่ `subject_id` ตรง ๆ

```txt
วันที่ 1
  09:00 - 11:00 กฎหมายพิเศษ
  13:00 - 15:00 ภาษาอังกฤษ
```

#### `session_subject_questions`

แทนข้อสอบจริงที่ใช้ใน session นั้น — เป็น table สำคัญที่สุดสำหรับ grading

ข้อสำคัญ:
- `question_no` ต้อง unique ภายใน session/day
- ใช้ `session_subject_question_id` ใน grading flow
- `subject_questions` เป็น template ได้ แต่ของจริงในการตรวจคือ `session_subject_questions`

ถ้ามีข้อเลือกทำ เช่น ข้อ 5 และ 6 ให้เลือกทำ 1 ข้อ ให้ใช้ `question_choice_groups` และ `question_choice_group_items`

#### `subjects`

เป็น master subject catalog กลาง ไม่ใช่ source หลักใน grading flow

#### `subject_questions`

เป็น template/master question ของ subject เท่านั้น ไม่ใช่ source หลักในการตรวจคะแนนจริง

---

### 3. Optional Question Design

#### `question_choice_groups`

เก็บกลุ่มข้อเลือกทำ เช่น:

```txt
group_code = OPTIONAL_5_6
required_count = 1
max_select_count = 1
scoring_policy = SELECTED_ONLY
```

#### `question_choice_group_items`

เก็บว่ากลุ่มนี้มีข้อใดบ้าง (อ้าง `session_subject_question_id`)

#### `booklet_question_choices`

เก็บว่า booklet แต่ละเล่มเลือกทำข้อใดจริง ใช้ตอนตรวจหรือสรุปคะแนน

---

### 4. Candidate / Room Layer

#### `users`

เก็บข้อมูลผู้เข้าสอบจริง เช่น user_code, ชื่อ, เลขบัตร, วันเกิด ข้อมูลนี้ต้องระวังมาก ห้ามเปิดเผยใน locked mode

#### `exam_rooms`

เก็บห้องสอบของ campaign

#### `user_campaigns`

เชื่อมผู้เข้าสอบกับ campaign และที่นั่งสอบ

#### `user_sessions`

เชื่อมผู้เข้าสอบกับ session/day ที่เข้าสอบ

---

### 5. Booklet / Bag Layer

#### `booklets`

field สำคัญ: `campaign_id`, `session_id`, `user_code`, `qr_payload`, `bag_id`, `seq_in_bag`, `random_num`, `status`

ข้อสำคัญ:
- `qr_payload` ต้อง unique
- `random_num` unique ต่อ session
- locked mode ใช้ `random_num` แทนชื่อหรือ user_code
- sort `random_num` ควรใช้ numeric sort เช่น `CAST(random_num AS UNSIGNED)`

#### `bags`

field สำคัญ: `campaign_id`, `session_id`, `bag_no`, `count_items`, `status`, `created_by_account_id`

ควรเก็บ `created_by_account_id` เพื่อรู้ว่า staff คนไหนสร้างหรือสแกนลงถุง

#### `session_counters`

ใช้กัน concurrent ตอนสร้างถุงและออกเลข `random_num` — ดู Concurrency Rules

---

### 6. Scanner / Audit Layer

#### `qr_scan_logs`

เก็บ log การสแกน QR ทุกครั้ง ห้ามเก็บ plaintext payload ให้เก็บเป็น:
- `qr_payload_masked`
- `qr_payload_hash`

ตัวอย่าง `scan_context`: `BAG_PACKAGING`, `GRADING`, `BAG_RETURN`, `VERIFY`, `UNKNOWN`

ตัวอย่าง `scan_result`: `SUCCESS`, `FAILED`, `DUPLICATE`, `REJECTED`

---

### 7. Grader / Assignment Layer

#### `graders`

เชื่อม account กับ campaign ในฐานะผู้ตรวจ

#### `grader_assignments`

กำหนดว่าผู้ตรวจคนใดตรวจข้อใด ระบบใหม่ควรอ้าง:
- `campaign_id`, `grader_id`, `session_id`
- `campaign_subject_id`, `session_subject_id`, `session_subject_question_id`

ไม่ควรอ้างแค่ `question_no` เพราะ question_no มี context ตาม session และ subject

---

### 8. Grading Layer

#### `grading_slots`

unique constraint สำคัญ:
```txt
booklet_id + session_subject_question_id + grader_order
booklet_id + session_subject_question_id + grader_id
```

Business rule:
- ถ้ายังไม่มี slot ให้สร้าง `grader_order = 1`
- ถ้ามีแล้ว 1 คน ให้สร้าง `grader_order = 2`
- ถ้ามีครบ 2 คนแล้ว ห้ามสร้างเพิ่ม ยกเว้นมี decider flow
- grader คนเดิมห้ามตรวจซ้ำเป็นคนที่ 1 และ 2 ใน booklet/question เดียวกัน

#### `grading_score_drafts`

คะแนนชั่วคราวก่อนยืนยันทั้งถุง ผู้ตรวจสามารถแก้ไขได้เฉพาะในถุงและข้อที่กำลัง lock อยู่

#### `grading_scores`

คะแนนจริงหลังยืนยัน ห้ามแก้โดยตรงหลัง confirm ต้องผ่าน flow แก้ไขและมี log

#### `grading_score_logs`

เก็บประวัติการแก้ไขคะแนนหลัง confirm ห้ามแก้คะแนนจริงโดยไม่มี log

#### `grader_work_locks`

Business rule:
- ผู้ตรวจหนึ่งคนควรมี active lock ได้ไม่เกิน 1 งาน
- ถ้ามี active lock แล้ว ต้องกลับไปตรวจ bag/question เดิม
- เมื่อ confirm ครบทั้งถุง ให้ release lock

---

### 9. Incident / Note Layer

#### `booklet_incident_reports`

เก็บรายงานเหตุผิดปกติระดับเล่มหรือถุง เช่น สงสัยทุจริต กระดาษเสียหาย QR ผิด เล่มซ้ำ missing page

#### `booklet_question_notes`

เก็บหมายเหตุรายข้อรายเล่ม เช่น คำตอบหาย ข้อความน่าสงสัย มีรอยแก้ไข

#### `incident_attachments`

เก็บไฟล์แนบ เช่น รูปภาพหลักฐาน หรือเอกสารแนบของ incident/note

---

### 10. Notification / OTP Layer

#### `twofactor_sessions`

เก็บ OTP session ห้ามเก็บ OTP plaintext ให้เก็บเฉพาะ hash

#### `notification_templates`, `notification_messages`, `notification_recipients`, `notification_delivery_logs`, `notification_preferences`

ระบบ notification สำหรับแจ้งเตือน staff/grader

#### `service_outbox_events`

ใช้ outbox pattern สำหรับงาน async เช่น ส่ง email OTP, แจ้ง PDF พร้อมดาวน์โหลด, แจ้ง campaign unlocked

---

## Important Business Rules

1. ก่อน campaign unlock ห้ามเปิดเผยตัวตนผู้เข้าสอบ
2. ใน locked mode ให้ใช้ `random_num` แทน `user_code`
3. QR payload ต้องถูก mask/encrypt และไม่ควร log plaintext payload
4. ผู้ตรวจต้องตรวจตาม assignment เท่านั้น
5. การหา assignment ต้อง join ผ่าน `session_subject_question_id`
6. ผู้ตรวจหนึ่งคนตรวจได้ทีละถุงและทีละข้อผ่าน `grader_work_locks`
7. หนึ่ง booklet + question มีผู้ตรวจได้สูงสุด 2 คน
8. ถ้ายังไม่มี slot ให้เป็น `grader_order = 1`
9. ถ้ามี slot แล้ว 1 คน ให้เป็น `grader_order = 2`
10. ถ้ามีครบ 2 คนแล้ว ห้ามสร้าง slot เพิ่ม
11. ระหว่างยังเป็น draft ผู้ตรวจสามารถแก้คะแนนซ้ำได้เฉพาะในถุงและข้อที่กำลัง lock อยู่
12. เมื่อ confirm แล้ว ห้ามแก้คะแนนโดยตรง ต้องผ่าน flow แก้ไขและมี log
13. Backend ต้อง validate คะแนนเสมอ ห้ามเชื่อ frontend
14. คะแนนต้องไม่ติดลบ และต้องไม่เกิน `session_subject_questions.max_score`
15. validate ว่าคะแนนเป็น integer ทั้ง frontend และ backend
16. การ sort `random_num` ให้ใช้ numeric sort เช่น `CAST(random_num AS UNSIGNED)`
17. งาน PDF หนักควรทำผ่าน `worker_threads`

---

## Main System Flow

### 1. Setup Campaign Flow

1. Admin สร้าง campaign
2. สร้างหรือเลือก master subjects
3. สร้าง `campaign_subjects` เพื่อ lock วิชาตาม campaign
4. สร้าง sessions/day
5. เพิ่ม `session_subjects` ลงแต่ละ session
6. เพิ่ม `session_subject_questions` เป็นข้อจริงที่ใช้สอบในวันนั้น
7. กำหนด settings เช่น threshold, passing quota, minimum score
8. สร้างห้องสอบและผู้เข้าสอบ
9. สร้าง booklets และ QR payload
10. สร้าง `session_counters` สำหรับ session นั้น

### 2. Bag Packaging Flow

1. Staff เลือก campaign และ session
2. Staff สแกน QR payload ของ booklet
3. Backend unmask/decrypt payload
4. ตรวจว่า booklet มีจริง และอยู่ใน campaign/session นี้จริง
5. ตรวจว่า booklet ยังไม่มี bag
6. เขียน `qr_scan_logs`
7. เมื่อครบจำนวนเล่มต่อถุง ให้สร้าง bag
8. ใช้ transaction + `session_counters FOR UPDATE`
9. กำหนด `bag_no`, `seq_in_bag`, `random_num`
10. update booklets เป็น `PACKAGED` แล้ว commit

### 3. Grading Flow

1. Grader login
2. Backend หา grader profile จาก account
3. โหลด assignment ของ grader ใน campaign
4. Grader เลือก question ที่ได้รับมอบหมาย
5. Grader สแกน QR booklet
6. Backend เขียน scan log
7. ตรวจว่า booklet อยู่ใน bag แล้ว
8. ตรวจว่า grader มี assignment ของ `session_subject_question_id`
9. ตรวจ active work lock — ถ้าไม่มีให้สร้าง lock
10. สร้างหรือ reuse `grading_slots`
11. Grader กรอกคะแนน
12. Backend validate integer, min, max_score
13. บันทึกหรือ update `grading_score_drafts`
14. เมื่อครบทุกเล่มในถุง กด confirm
15. Backend validate ว่าคะแนนครบทุกเล่ม
16. Insert/Upsert ลง `grading_scores`
17. Update slot เป็น `COMPLETED`
18. Mark drafts เป็น `CONFIRMED`
19. ตรวจคะแนนต่างเกิน threshold หรือไม่ (disputed check)
20. Release lock
21. สร้าง notification/outbox event ถ้าจำเป็น

### 4. Report Flow

1. User เลือก report
2. Backend validate permission
3. Query ข้อมูลตาม mode locked/unlocked
4. Locked mode แสดง `random_num`, Unlocked mode แสดง `user_code` และชื่อผู้เข้าสอบ
5. ส่งงาน PDF ไป worker thread
6. Worker generate PDF และส่ง buffer หรือ file กลับให้ client

### 5. Unlock Campaign Flow

1. Manager คนที่ 1 ใส่ key หรือขอ OTP
2. Manager คนที่ 2 ใส่ key หรือขอ OTP
3. Backend verify key/OTP
4. ถ้าครบเงื่อนไข update `exam_campaigns.is_unlock = true`
5. เขียน activity log
6. หลัง unlock report จึงแสดงข้อมูลผู้เข้าสอบจริงได้

---

## QR / Security Notes

QR payload ใช้ระบุเล่มข้อสอบ ข้อมูลภายในอาจมี campaign id, session id, user id หรือ user code

ตัวอย่าง plaintext ก่อนเข้ารหัส:
```json
{"cid":1000,"sid":2000,"uid":3000}
```

ข้อควรระวัง:
- ห้ามเปิดเผย plaintext QR payload โดยไม่จำเป็น
- ห้าม log key, plaintext payload หรือข้อมูลที่สามารถระบุตัวผู้เข้าสอบ
- ถ้าต้องการรู้ว่า payload เป็นของใคร ต้อง decrypt ภายใต้สิทธิ์ที่ถูกต้อง
- ห้ามสร้าง mapping แบบเปิดเผยง่าย เช่น payload -> user_code หาก requirement คือคนดู database ต้องไม่รู้ตัวตนผู้เข้าสอบ
- การ unlock campaign เท่านั้นที่ควรเปิดเผยชื่อหรือรหัสผู้เข้าสอบจริง

---

## Correct Prisma Relation for Campaign Detail

ห้าม include แบบเก่า:

```ts
session_subjects: {
  include: {
    subjects: true, // ผิด: session_subjects ไม่ได้ผูกตรงกับ subjects แล้ว
  },
}
```

โครง relation ที่ถูกต้อง:

```txt
exam_campaigns
└── sessions
    └── session_subjects
        ├── campaign_subjects
        │   └── subjects
        └── session_subject_questions
```

ตัวอย่าง Prisma query ที่ถูกต้อง:

```ts
async findCampaignWithSessionsAndSubjects(campaignId: number, tx?: Tx) {
  const client = tx ?? prisma;

  return await client.exam_campaigns.findUnique({
    where: { id: campaignId },
    include: {
      sessions: {
        where: { deleted_at: null },
        orderBy: { day_no: "asc" },
        include: {
          session_subjects: {
            where: { deleted_at: null },
            orderBy: { order_no: "asc" },
            include: {
              campaign_subjects: {
                include: { subjects: true },
              },
              session_subject_questions: {
                where: { deleted_at: null },
                orderBy: { question_no: "asc" },
              },
            },
          },
        },
      },
    },
  });
}
```

ควร map เป็น DTO ก่อนส่งออกจาก API ไม่ควรส่ง Prisma raw object ตรง ๆ

---

## Recommended API Summary

### Auth
```txt
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me
```

### Campaign
```txt
GET    /api/campaigns
GET    /api/campaigns/:campaignId
POST   /api/campaigns
PATCH  /api/campaigns/:campaignId
DELETE /api/campaigns/:campaignId
PATCH  /api/campaigns/:campaignId/active
PATCH  /api/campaigns/:campaignId/qr-active
GET    /api/campaigns/:campaignId/detail
```

### Campaign Subjects
```txt
GET    /api/campaigns/:campaignId/subjects
POST   /api/campaigns/:campaignId/subjects
PATCH  /api/campaign-subjects/:campaignSubjectId
DELETE /api/campaign-subjects/:campaignSubjectId
```

### Sessions
```txt
GET    /api/campaigns/:campaignId/sessions
POST   /api/campaigns/:campaignId/sessions
GET    /api/sessions/:sessionId
PATCH  /api/sessions/:sessionId
DELETE /api/sessions/:sessionId
```

### Session Subjects / Questions
```txt
GET    /api/sessions/:sessionId/subjects
POST   /api/sessions/:sessionId/subjects
PATCH  /api/session-subjects/:sessionSubjectId
DELETE /api/session-subjects/:sessionSubjectId

GET    /api/session-subjects/:sessionSubjectId/questions
POST   /api/session-subjects/:sessionSubjectId/questions
PATCH  /api/session-subject-questions/:questionId
DELETE /api/session-subject-questions/:questionId
```

### Optional Question Groups
```txt
GET    /api/session-subjects/:sessionSubjectId/choice-groups
POST   /api/session-subjects/:sessionSubjectId/choice-groups
PATCH  /api/question-choice-groups/:groupId
DELETE /api/question-choice-groups/:groupId
POST   /api/question-choice-groups/:groupId/items
DELETE /api/question-choice-group-items/:itemId
```

### Users / Candidates
```txt
GET    /api/users
POST   /api/users
GET    /api/users/:userId
PATCH  /api/users/:userId
DELETE /api/users/:userId

GET    /api/campaigns/:campaignId/candidates
POST   /api/campaigns/:campaignId/candidates
PATCH  /api/user-campaigns/:userCampaignId/seat
DELETE /api/user-campaigns/:userCampaignId
```

### Booklets / QR
```txt
GET    /api/campaigns/:campaignId/sessions/:sessionId/booklets
POST   /api/campaigns/:campaignId/sessions/:sessionId/booklets/generate
POST   /api/booklets/verify-qr
GET    /api/booklets/:bookletId
PATCH  /api/booklets/:bookletId
```

### Bag Packaging
```txt
POST   /api/bags/check-subjects
POST   /api/bags/create-insert
GET    /api/campaigns/:campaignId/bags
GET    /api/bags/:bagId
PATCH  /api/bags/:bagId/status
GET    /api/bags/:bagId/booklets
```

### Graders / Assignments
```txt
GET    /api/campaigns/:campaignId/graders
POST   /api/campaigns/:campaignId/graders
PATCH  /api/graders/:graderId
DELETE /api/graders/:graderId

GET    /api/campaigns/:campaignId/grader-assignments
POST   /api/grader-assignments
DELETE /api/grader-assignments/:assignmentId
GET    /api/graders/:graderId/assignments
```

### Grading
```txt
POST   /api/gradingslots/preview-start
POST   /api/gradingslots/confirm-start
POST   /api/gradingdraft/save
GET    /api/gradingdraft/unconfirmed/:graderId
POST   /api/gradingdraft/confirm-bag
POST   /api/gradingdraft/cancel
GET    /api/grading/scores/bag/:bagId
GET    /api/grading/logs/bag/:bagId
```

### Incident / Notes
```txt
GET    /api/incidents
POST   /api/incidents
GET    /api/incidents/:incidentId
PATCH  /api/incidents/:incidentId
DELETE /api/incidents/:incidentId

GET    /api/booklets/:bookletId/question-notes
POST   /api/booklets/:bookletId/question-notes
PATCH  /api/booklet-question-notes/:noteId
DELETE /api/booklet-question-notes/:noteId
```

### Scanner Logs
```txt
GET    /api/scan-logs
GET    /api/booklets/:bookletId/scan-logs
GET    /api/accounts/:accountId/scan-logs
```

### Reports / PDF
```txt
GET    /api/reports/bags/:bagId/payload.pdf
GET    /api/reports/bags/:bagId/manual-score-sheet.pdf
GET    /api/reports/bags/:bagId/scores.pdf
GET    /api/reports/bags/:bagId/scores-unlocked.pdf
GET    /api/reports/campaigns/:campaignId/score-all.pdf
GET    /api/reports/campaigns/:campaignId/graders.pdf
GET    /api/reports/campaigns/:campaignId/passing-list.pdf
```

### Settings
```txt
GET    /api/setting-definitions
GET    /api/campaigns/:campaignId/settings
PUT    /api/campaigns/:campaignId/settings/:settingKey
PATCH  /api/campaigns/:campaignId/settings/bulk
```

### OTP / Unlock
```txt
POST   /api/otp/request
POST   /api/otp/verify
POST   /api/campaigns/:campaignId/unlock/request
POST   /api/campaigns/:campaignId/unlock/confirm
GET    /api/campaigns/:campaignId/is-unlock
```

### Notifications
```txt
GET    /api/notifications
GET    /api/notifications/unread-count
PATCH  /api/notifications/:notificationId/read
PATCH  /api/notifications/:notificationId/dismiss
GET    /api/notification-preferences
PATCH  /api/notification-preferences
```

---

## Concurrency Rules

### Bag Creation

ห้ามใช้วิธี scan หาเลขถุงล่าสุดแล้ว +1 โดยไม่มี lock เพราะ staff หลายคนอาจสร้างถุงพร้อมกัน

แนวทางที่แนะนำ:
1. สร้าง `session_counters` ต่อ session
2. ตอนสร้างถุงใช้ transaction
3. Lock row ด้วย `SELECT ... FOR UPDATE`
4. อ่าน `next_bag_no` และ `next_random_seq`
5. สร้าง bag และ assign random_num
6. update counter แล้ว commit

ถ้าใช้ Redis เพิ่มเติม สามารถใช้ Redis lock กัน double click หรือกัน request ซ้ำในช่วงสั้น ๆ ได้ แต่ database transaction ยังต้องเป็น source of truth

### Grading Slot Creation

การสร้าง slot ต้องอยู่ใน transaction และต้อง handle duplicate key จาก unique constraint

```txt
booklet + session_subject_question
  ไม่มี slot -> grader_order 1
  มี 1 slot  -> grader_order 2
  มี 2 slot  -> reject
```

### Draft Confirm

ตอน confirm ทั้งถุง ต้อง validate ใน transaction:
1. grader มี active lock จริง
2. bag/question ตรงกับ lock
3. draft ครบทุก booklet ที่ต้องตรวจ
4. score ไม่ว่าง, เป็น integer, ไม่เกิน max_score
5. insert grading_scores
6. update slots และ drafts
7. release lock

---

## Redis Usage Recommendation

ควรใช้ Redis กับงานเหล่านี้:
1. Rate limit login / OTP / scan endpoint
2. Short-lived lock กัน double submit เช่น `bag:create:{sessionId}`
3. Cache campaign settings เช่น `campaign:{id}:settings`
4. Cache active campaign/session data ที่อ่านบ่อย
5. Store temporary scan batch ก่อนกดสร้างถุง
6. Queue หรือ pub/sub สำหรับ notification / PDF status ถ้าต้อง realtime
7. Idempotency key สำหรับ request ที่เสี่ยงถูกยิงซ้ำ
8. Cache permission/session ของ user

**ไม่ควรใช้ Redis เป็น source of truth สำหรับ:** เลขถุงจริง, random_num จริง, คะแนนจริง, assignment จริง, unlock state จริง — ข้อมูลเหล่านี้ต้องยึด database เป็นหลัก

---

## Security Rules

1. ห้าม log password, OTP, key, plaintext payload
2. ห้ามส่ง key กลับ frontend
3. OTP ต้องเก็บเป็น hash เท่านั้น
4. QR payload ควรเก็บ log เป็น hash/masked
5. Backend ต้องตรวจ permission ทุก endpoint
6. Locked mode ห้ามส่งชื่อผู้เข้าสอบออกจาก API
7. Unlock ต้องใช้ flow ที่ตรวจสอบผู้มีสิทธิ์ครบถ้วน
8. Soft delete ต้อง filter `deleted_at: null` เป็น default
9. API ที่แก้ข้อมูลสำคัญต้องเขียน `activity_logs`
10. งานตรวจคะแนนต้องยึด assignment และ lock ฝั่ง backend เท่านั้น

---

## Soft Delete Rule

ตารางที่ควรใช้ soft delete: `accounts`, `exam_campaigns`, `sessions`, `subjects`, `campaign_subjects`, `session_subjects`, `session_subject_questions`, `users`, `user_campaigns`, `user_sessions`, `booklets`, `bags`, `graders`, `grader_assignments`, `question_choice_groups`, `booklet_question_notes`, `booklet_incident_reports`, `notification_*` บางตาราง

เวลา query ข้อมูลปกติให้ใส่:

```ts
where: {
  deleted_at: null,
}
```

---

## PDF Rules

รายงาน PDF หลัก:
- ใบรายการ payload ในถุง
- ใบกรอกคะแนนสำหรับผู้ตรวจ
- รายงานคะแนนถุงแบบ locked / unlocked
- รายงานผู้ตรวจและถุงที่ตรวจ
- รายงานบัญชีผู้สอบผ่าน
- รายงานจัดอันดับคะแนน

ข้อกำหนด:
1. ใช้ worker_threads สำหรับ PDF หนัก
2. ใช้ฟอนต์ภาษาไทย: `THSarabunNew.ttf` และ `THSarabunNew-Bold.ttf`
3. Locked report ใช้ `random_num`, Unlocked report ใช้ `user_code` และชื่อจริง
4. PDF ต้องไม่เปิดเผย payload plaintext
5. ถ้าข้อสอบมีหลายข้อ คอลัมน์ต้องปรับ width ตามจำนวนข้อ
6. ถ้าข้อสอบมีข้อเลือกทำ ต้องแสดงเฉพาะข้อที่เกี่ยวข้องตาม policy

---

## Timezone Rule

เลือกแนวทางเดียวและใช้ทั้งระบบ ห้ามปนกัน

**Preferred:**
```txt
เก็บ UTC ใน database
แปลงเป็น Asia/Bangkok ตอนแสดงผล
```

**Alternative (ถ้าต้องเก็บเวลาไทยใน DB):**
```ts
export function nowThaiDateTimeString(): string {
  const now = new Date();
  const thaiTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);

  const yyyy = thaiTime.getUTCFullYear();
  const mm = String(thaiTime.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(thaiTime.getUTCDate()).padStart(2, "0");
  const hh = String(thaiTime.getUTCHours()).padStart(2, "0");
  const mi = String(thaiTime.getUTCMinutes()).padStart(2, "0");
  const ss = String(thaiTime.getUTCSeconds()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}
```

ห้ามใช้ `NOW()` ปนกับเวลาที่ app สร้างเอง

---

## Important Notes for Future Refactor

1. เปลี่ยน flow ทั้งหมดจาก `subject_id + question_no` ไปใช้ `session_subject_question_id`
2. `campaign_subjects` คือวิชาที่ใช้งานจริงใน campaign
3. `session_subjects` คือวิชาในวันสอบ
4. `session_subject_questions` คือข้อสอบจริงที่ใช้ตรวจ
5. `subject_questions` เป็น template เท่านั้น
6. Grading, assignment, report ควร join ผ่าน `session_subject_question_id`
7. Bag creation ต้องใช้ transaction และ counter lock
8. Scan log ต้องบันทึกทั้ง success และ failed cases
9. Redis ช่วยเรื่อง lock/cache/rate-limit ได้ แต่ database เป็น source of truth
10. API response ต้องคงรูปแบบ `{ success, data, message }`
