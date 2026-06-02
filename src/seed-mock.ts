/**
 * Mock Seed — สร้างข้อมูลตัวอย่างครบวงจรสำหรับทดสอบ
 * รัน: bun src/seed-mock.ts
 *
 * สร้าง:
 *  • Campaign "การสอบผู้ช่วยพนักงานอัยการ 2568" (สนามใหญ่, is_unlock=true)
 *  • 2 วิชา, 1 รอบสอบ, 10 ข้อ (5/วิชา)
 *  • 10 ผู้เข้าสอบ + 10 สมุดคำตอบ
 *  • 2 ถุง (ถุงละ 5 เล่ม)
 *  • 4 ผู้ตรวจ (2/วิชา) + grader assignments
 *  • คะแนนครบ 200 slots — ส่วนใหญ่ COMPLETED, 5 DISPUTED, 2 RESET
 *  • Campaign settings (threshold=3, passing_count=5, ranking_priority)
 *
 * IDs start at 10 for all key tables (exam_campaigns, sessions, users, etc.)
 */
import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const dbUrl = new URL(process.env.DATABASE_URL!);
dbUrl.searchParams.set("allowPublicKeyRetrieval", "true");
const adapter = new PrismaMariaDb(dbUrl.toString());
const prisma = new PrismaClient({ adapter });

// ── DISPUTED cases: (bookletIndex 0-based, questionIndex 0-based) ──────────
// bookletIndex 0-9, questionIndex 0-9 (0-4 = Law1, 5-9 = Law2)
const DISPUTED_CASES: Array<{ bi: number; qi: number; g1: number; g2: number }> = [
    { bi: 0, qi: 0, g1: 9, g2: 3 },  // บุ๊กเล็ต 1, ข้อ 1 (Law1)
    { bi: 1, qi: 1, g1: 8, g2: 2 },  // บุ๊กเล็ต 2, ข้อ 2 (Law1)
    { bi: 2, qi: 2, g1: 10, g2: 5 }, // บุ๊กเล็ต 3, ข้อ 3 (Law1)
    { bi: 4, qi: 5, g1: 9, g2: 4 },  // บุ๊กเล็ต 5, ข้อ 1 (Law2)
    { bi: 6, qi: 6, g1: 10, g2: 4 }, // บุ๊กเล็ต 7, ข้อ 2 (Law2)
];

// RESET cases: already resolved (will have status="RESET" + score_log)
const RESET_CASES: Array<{ bi: number; qi: number; g1: number; g2: number }> = [
    { bi: 7, qi: 3, g1: 7, g2: 7 },  // บุ๊กเล็ต 8, ข้อ 4 (Law1) — reset เรียบร้อย
    { bi: 8, qi: 8, g1: 8, g2: 8 },  // บุ๊กเล็ต 9, ข้อ 4 (Law2) — reset เรียบร้อย
];

function isDisputed(bi: number, qi: number) {
    return DISPUTED_CASES.find((c) => c.bi === bi && c.qi === qi);
}
function isReset(bi: number, qi: number) {
    return RESET_CASES.find((c) => c.bi === bi && c.qi === qi);
}

// Normal score: deterministic, always diff ≤ 2 (within threshold=3)
function normalScore(bi: number, qi: number, order: 1 | 2): number {
    const base = 6 + ((bi + qi) % 4);
    return order === 1 ? base : base + 1;
}

async function setAutoIncrement(table: string, value: number) {
    await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` AUTO_INCREMENT = ${value}`);
}

async function cleanupCampaign(cId: number) {
    console.log(`🗑️  Cleaning up campaign id=${cId}...`);
    // Delete in FK-safe order (children before parents)
    await prisma.grading_score_logs.deleteMany({ where: { campaign_id: cId } });
    await prisma.grading_score_drafts.deleteMany({ where: { campaign_id: cId } });
    await prisma.grading_scores.deleteMany({
        where: { grading_slots: { campaign_id: cId } },
    });
    await prisma.grading_slots.deleteMany({ where: { campaign_id: cId } });
    await prisma.grader_work_locks.deleteMany({ where: { campaign_id: cId } });
    await prisma.grader_assignments.deleteMany({ where: { campaign_id: cId } });
    await prisma.booklet_question_choices.deleteMany({
        where: { booklets: { campaign_id: cId } },
    });
    await prisma.booklet_question_notes.deleteMany({ where: { campaign_id: cId } });
    await prisma.booklet_incident_reports.deleteMany({ where: { campaign_id: cId } });
    await prisma.question_choice_group_items.deleteMany({
        where: { question_choice_groups: { campaign_id: cId } },
    });
    await prisma.question_choice_groups.deleteMany({ where: { campaign_id: cId } });
    await prisma.session_subject_questions.deleteMany({ where: { campaign_id: cId } });
    await prisma.session_counters.deleteMany({
        where: { sessions: { campaign_id: cId } },
    });
    await prisma.session_subjects.deleteMany({ where: { campaign_id: cId } });
    await prisma.graders.deleteMany({ where: { campaign_id: cId } });
    await prisma.campaign_settings.deleteMany({ where: { campaign_id: cId } });
    await prisma.user_sessions.deleteMany({ where: { campaign_id: cId } });
    await prisma.user_campaigns.deleteMany({ where: { campaign_id: cId } });
    await prisma.qr_scan_logs.deleteMany({ where: { campaign_id: cId } });
    await prisma.notification_recipients.deleteMany({
        where: { notification_messages: { campaign_id: cId } },
    });
    await prisma.notification_delivery_logs.deleteMany({
        where: { notification_messages: { campaign_id: cId } },
    });
    await prisma.notification_messages.deleteMany({ where: { campaign_id: cId } });
    await prisma.booklets.deleteMany({ where: { campaign_id: cId } });
    await prisma.bags.deleteMany({ where: { campaign_id: cId } });
    await prisma.sessions.deleteMany({ where: { campaign_id: cId } });
    await prisma.campaign_subjects.deleteMany({ where: { campaign_id: cId } });
    await prisma.campaign_keys.deleteMany({ where: { campaign_id: cId } });
    await prisma.twofactor_sessions.deleteMany({ where: { campaign_id: cId } });
    await prisma.exam_rooms.deleteMany({ where: { campaign_id: cId } });
    // Detach any accounts scoped to this campaign (don't delete accounts)
    await prisma.accounts.updateMany({
        where: { campaign_id: cId },
        data: { campaign_id: null },
    });
    await prisma.exam_campaigns.delete({ where: { id: cId } });
    console.log(`✓ Campaign id=${cId} and all related data deleted\n`);
}

async function main() {
    console.log("🌱 Mock seeding (IDs start at 10)...\n");

    // ── Cleanup existing campaign if present ────────────────────────────────
    const existing = await prisma.exam_campaigns.findFirst({
        where: { year_be: "2568", campaign_size: "สนามใหญ่", deleted_at: null },
    });
    if (existing) {
        await cleanupCampaign(existing.id);
    }

    // ── 1. Roles ─────────────────────────────────────────────────────────────
    for (const r of [
        { id: 1, code: "ADMIN",   name: "ผู้ดูแลระบบ" },
        { id: 2, code: "STAFF",   name: "เจ้าหน้าที่" },
        { id: 3, code: "MANAGER", name: "ผู้จัดการ" },
        { id: 4, code: "GRADER",  name: "ผู้ตรวจข้อสอบ" },
    ]) {
        await prisma.roles.upsert({
            where: { id: r.id },
            create: r,
            update: { code: r.code, name: r.name },
        });
    }
    console.log("✓ Roles");

    // ── 2. Accounts ──────────────────────────────────────────────────────────
    const pw = await Bun.password.hash("Admin@12345", { algorithm: "bcrypt", cost: 10 });
    const graderPw = await Bun.password.hash("Grader@12345", { algorithm: "bcrypt", cost: 10 });

    async function findOrCreateAccount(username: string, data: object) {
        const found = await prisma.accounts.findFirst({ where: { username } });
        if (found) return found;
        return prisma.accounts.create({ data: data as never });
    }

    const adminAcc = await findOrCreateAccount("admin", {
        username: "admin", password_hash: pw, full_name: "System Administrator",
        title: "นาย", role_id: 1, active: true, active_unique_key: 1,
    });
    const _managerAcc = await findOrCreateAccount("manager01", {
        username: "manager01", password_hash: pw, full_name: "นายจัดการ ระบบสอบ",
        title: "นาย", role_id: 3, active: true,
    });
    const _staffAcc = await findOrCreateAccount("staff01", {
        username: "staff01", password_hash: pw, full_name: "นางสาวเจ้าหน้าที่ ประจำ",
        title: "นางสาว", role_id: 2, active: true,
    });
    const graderNames  = ["นายอนุวัฒน์ กฎหมาย", "นางสาวสุดา พิจารณา", "นายวิชิต แพ่งพาณิชย์", "นางสาวปิยะ ตัดสิน"];
    const graderTitles = ["นาย", "นางสาว", "นาย", "นางสาว"];
    const graderAccs = [];
    for (let i = 0; i < 4; i++) {
        const acc = await findOrCreateAccount(`grader0${i + 1}`, {
            username: `grader0${i + 1}`, password_hash: graderPw,
            full_name: graderNames[i]!, title: graderTitles[i]!, role_id: 4, active: true,
        });
        graderAccs.push(acc);
    }
    console.log(`✓ Accounts (admin:admin, manager:manager01, staff:staff01, grader01-04 / pw: Admin@12345 / Grader@12345)`);

    // ── 3. Master subjects ───────────────────────────────────────────────────
    const subj1 = await prisma.subjects.upsert({
        where: { code: "LAW-CRIM" },
        create: { code: "LAW-CRIM", name: "กฎหมายอาญา", active: true },
        update: {},
    });
    const subj2 = await prisma.subjects.upsert({
        where: { code: "LAW-CIVIL" },
        create: { code: "LAW-CIVIL", name: "กฎหมายแพ่งและพาณิชย์", active: true },
        update: {},
    });
    console.log("✓ Subjects");

    // ── 4. Setting definitions ───────────────────────────────────────────────
    for (const d of [
        { setting_key: "reset_threshold", name: "เกณฑ์ผลต่าง", value_type: "NUMBER", default_value: 5 },
        { setting_key: "passing_quota",   name: "จำนวนผู้ผ่าน (quota)", value_type: "NUMBER", default_value: null },
        { setting_key: "minimum_passing_score", name: "คะแนนขั้นต่ำ", value_type: "NUMBER", default_value: 0 },
        { setting_key: "passing_policy", name: "นโยบายผ่าน", value_type: "STRING", default_value: "MINIMUM_SCORE" },
        { setting_key: "payment_rate_per_booklet", name: "ค่าตรวจ/เล่ม", value_type: "NUMBER", default_value: 30 },
    ]) {
        await prisma.setting_definitions.upsert({
            where: { setting_key: d.setting_key },
            create: { ...d, scope: "CAMPAIGN", description: null, required: false, active: true, default_value: d.default_value as never },
            update: {},
        });
    }
    console.log("✓ Setting definitions");

    // ── 5. Campaign (id = 10) ────────────────────────────────────────────────
    await setAutoIncrement("exam_campaigns", 10);
    const campaign = await prisma.exam_campaigns.create({
        data: {
            name: "การสอบผู้ช่วยพนักงานอัยการ",
            year_be: "2568",
            site: "มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ",
            campaign_size: "สนามใหญ่",
            is_active: true,
            is_unlock: true,
            qr_active: true,
        },
    });
    const cId = campaign.id;
    console.log(`✓ Campaign id=${cId}`);

    // ── 6. Campaign subjects (ids start at 10) ───────────────────────────────
    await setAutoIncrement("campaign_subjects", 10);
    const cs1 = await prisma.campaign_subjects.create({
        data: { campaign_id: cId, subject_id: subj1.id, code: "LAW1", name: "กฎหมายอาญา", full_score: 50, order_no: 1 },
    });
    const cs2 = await prisma.campaign_subjects.create({
        data: { campaign_id: cId, subject_id: subj2.id, code: "LAW2", name: "กฎหมายแพ่งและพาณิชย์", full_score: 50, order_no: 2 },
    });
    console.log(`✓ Campaign subjects (cs1=${cs1.id}, cs2=${cs2.id})`);

    // ── 7. Campaign settings (ids start at 10) ───────────────────────────────
    await setAutoIncrement("campaign_settings", 10);
    const settingsData = [
        { key: "reset_threshold",           value: 3,     vt: "NUMBER" },
        { key: "passing_candidate_count",   value: 5,     vt: "NUMBER" },
        { key: "passing_quota",             value: 5,     vt: "NUMBER" },
        { key: "minimum_passing_score",     value: 60,    vt: "NUMBER" },
        { key: "passing_policy",            value: "TOP_N_ONLY", vt: "STRING" },
        { key: "payment_rate_per_booklet",  value: 40,    vt: "NUMBER" },
        { key: "ranking_subject_priority",  value: { subjectIds: [cs1.id, cs2.id] }, vt: "JSON" },
    ];
    for (const s of settingsData) {
        await prisma.campaign_settings.create({
            data: {
                campaign_id: cId,
                setting_key: s.key,
                setting_value: s.value as never,
                value_type: s.vt,
                active: true,
                created_by_account_id: adminAcc.id,
                updated_by_account_id: adminAcc.id,
            },
        });
    }
    console.log("✓ Campaign settings");

    // ── 8. Session (id = 10) ─────────────────────────────────────────────────
    await setAutoIncrement("sessions", 10);
    const session = await prisma.sessions.create({
        data: {
            campaign_id: cId,
            session_code: "D1",
            title: "วันที่ 1",
            exam_date: new Date("2025-06-15"),
            day_no: 1,
        },
    });
    const sId = session.id;
    await prisma.session_counters.create({ data: { session_id: sId, next_bag_no: 3, next_random_seq: 10011 } });
    console.log(`✓ Session id=${sId}`);

    // ── 9. Session subjects (ids start at 10) ────────────────────────────────
    await setAutoIncrement("session_subjects", 10);
    const now = new Date("2025-06-15T08:00:00");
    const noon = new Date("2025-06-15T12:00:00");
    const end  = new Date("2025-06-15T16:00:00");

    const ss1 = await prisma.session_subjects.create({
        data: { campaign_id: cId, session_id: sId, campaign_subject_id: cs1.id, start_at: now, end_at: noon, question_count: 5, order_no: 1 },
    });
    const ss2 = await prisma.session_subjects.create({
        data: { campaign_id: cId, session_id: sId, campaign_subject_id: cs2.id, start_at: noon, end_at: end, question_count: 5, order_no: 2 },
    });
    console.log(`✓ Session subjects (ss1=${ss1.id}, ss2=${ss2.id})`);

    // ── 10. Questions (ids start at 10, 5 per subject = 10 total) ────────────
    await setAutoIncrement("session_subject_questions", 10);
    const questionLabels = [
        "สัญญาซื้อขาย", "ฆ่าผู้อื่น", "บุกรุก", "ลักทรัพย์", "ยักยอก",
        "ตั๋วเงิน", "หนี้", "สัญญากู้ยืม", "นายจ้างลูกจ้าง", "ค้ำประกัน",
    ];

    const ssMap = [ss1, ss1, ss1, ss1, ss1, ss2, ss2, ss2, ss2, ss2];
    const csMap = [cs1, cs1, cs1, cs1, cs1, cs2, cs2, cs2, cs2, cs2];
    const qNums = [1, 2, 3, 4, 5, 1, 2, 3, 4, 5];

    const questions = [];
    for (let i = 0; i < 10; i++) {
        const q = await prisma.session_subject_questions.create({
            data: {
                campaign_id: cId,
                session_id: sId,
                session_subject_id: ssMap[i]!.id,
                question_no: qNums[i]!,
                label: questionLabels[i]!,
                max_score: 10,
                question_type: "REQUIRED",
            },
        });
        questions.push(q);
    }
    console.log(`✓ Questions (${questions.length} ข้อ, ids ${questions[0]!.id}–${questions[9]!.id})`);

    // ── 11. Candidates (users, ids start at 10) ───────────────────────────────
    await setAutoIncrement("users", 10);
    const candidateNames = [
        ["นาย", "สมชาย",     "ใจดี"],
        ["นางสาว", "สมหญิง", "มีสุข"],
        ["นาย", "ประเสริฐ",  "สิริ"],
        ["นางสาว", "วิไล",   "งาม"],
        ["นาย", "ชาญชัย",    "เก่ง"],
        ["นางสาว", "สุภา",   "พูลทรัพย์"],
        ["นาย", "อนุชา",     "ดีงาม"],
        ["นางสาว", "กนกวรรณ","รักดี"],
        ["นาย", "ธีระ",      "วิชาการ"],
        ["นางสาว", "ปิยะ",   "สุขสันต์"],
    ];

    await setAutoIncrement("user_campaigns", 10);
    const users = [];
    for (let i = 0; i < 10; i++) {
        const code = `1000${i + 1}`;
        const [title, fn, ln] = candidateNames[i]!;
        const u = await prisma.users.create({
            data: {
                user_code: code,
                title,
                full_name: `${fn} ${ln}`,
                first_name: fn,
                last_name: ln,
            },
        });
        users.push(u);
        await prisma.user_campaigns.create({ data: { user_id: u.id, campaign_id: cId } });
    }
    console.log(`✓ Users + UserCampaigns (${users.length} คน, user ids ${users[0]!.id}–${users[9]!.id})`);

    // ── 12. Graders (ids start at 10) ────────────────────────────────────────
    await setAutoIncrement("graders", 10);
    const graders = [];
    for (let i = 0; i < 4; i++) {
        const g = await prisma.graders.create({
            data: { campaign_id: cId, account_id: graderAccs[i]!.id, active: true },
        });
        graders.push(g);
    }
    // grader[0,1] = Law1 (cs1), grader[2,3] = Law2 (cs2)
    console.log(`✓ Graders (ids ${graders.map(g => g.id).join(", ")})`);

    // ── 13. Grader assignments (ids start at 10) ──────────────────────────────
    await setAutoIncrement("grader_assignments", 10);
    for (let qi = 0; qi < 10; qi++) {
        const q = questions[qi]!;
        const isLaw2 = qi >= 5;
        const ss  = isLaw2 ? ss2 : ss1;
        const cs  = isLaw2 ? cs2 : cs1;
        const g1  = graders[isLaw2 ? 2 : 0]!;
        const g2  = graders[isLaw2 ? 3 : 1]!;
        for (const g of [g1, g2]) {
            await prisma.grader_assignments.create({
                data: {
                    grader_id: g.id,
                    campaign_id: cId,
                    session_id: sId,
                    session_subject_id: ss.id,
                    session_subject_question_id: q.id,
                    campaign_subject_id: cs.id,
                    active: true,
                },
            });
        }
    }
    console.log("✓ Grader assignments");

    // ── 14. Booklets (ids start at 10) ───────────────────────────────────────
    await setAutoIncrement("booklets", 10);
    const booklets = [];
    for (let i = 0; i < 10; i++) {
        const u = users[i]!;
        const b = await prisma.booklets.create({
            data: {
                campaign_id: cId,
                session_id: sId,
                user_code: u.user_code,
                qr_payload: `MOCK-QR-BOOKLET-${String(i + 1).padStart(3, "0")}`,
                status: "PACKAGED",
            },
        });
        booklets.push(b);
    }
    console.log(`✓ Booklets (${booklets.length} เล่ม, ids ${booklets[0]!.id}–${booklets[9]!.id})`);

    // ── 15. Bags (ids start at 10, 2 bags × 5 booklets) ──────────────────────
    await setAutoIncrement("bags", 10);
    for (let bagIdx = 0; bagIdx < 2; bagIdx++) {
        const bag = await prisma.bags.create({
            data: {
                campaign_id: cId,
                session_id: sId,
                bag_no: bagIdx + 1,
                count_items: 5,
                status: "CREATED",
                created_by_account_id: adminAcc.id,
            },
        });
        for (let bi = 0; bi < 5; bi++) {
            const bookletIdx = bagIdx * 5 + bi;
            const randomNum = 10001 + bookletIdx;
            await prisma.booklets.update({
                where: { id: booklets[bookletIdx]!.id },
                data: { bag_id: bag.id, seq_in_bag: bi + 1, random_num: String(randomNum), status: "PACKAGED" },
            });
        }
        console.log(`✓ Bag id=${bag.id} (bag_no=${bagIdx + 1})`);
    }

    // ── 16. Grading slots + scores (ids start at 10) ─────────────────────────
    await setAutoIncrement("grading_slots", 10);
    await setAutoIncrement("grading_scores", 10);
    await setAutoIncrement("grading_score_logs", 10);

    let slotCount = 0, scoreCount = 0, disputedCount = 0, resetCount = 0;

    for (let bi = 0; bi < 10; bi++) {
        const booklet = booklets[bi]!;

        for (let qi = 0; qi < 10; qi++) {
            const q = questions[qi]!;
            const isLaw2 = qi >= 5;
            const ss  = isLaw2 ? ss2 : ss1;
            const cs  = isLaw2 ? cs2 : cs1;
            const g1  = graders[isLaw2 ? 2 : 0]!;
            const g2  = graders[isLaw2 ? 3 : 1]!;

            const disputed = isDisputed(bi, qi);
            const reset    = isReset(bi, qi);

            const slotStatus = reset ? "RESET" : disputed ? "DISPUTED" : "COMPLETED";

            let s1: number, s2: number;
            if (reset)    { s1 = reset.g1;    s2 = reset.g2; }
            else if (disputed) { s1 = disputed.g1; s2 = disputed.g2; }
            else               { s1 = normalScore(bi, qi, 1); s2 = normalScore(bi, qi, 2); }

            // Create slot for grader 1
            const slot1 = await prisma.grading_slots.create({
                data: {
                    campaign_id: cId, session_id: sId,
                    booklet_id: booklet.id,
                    campaign_subject_id: cs.id,
                    session_subject_id: ss.id,
                    session_subject_question_id: q.id,
                    question_no: q.question_no,
                    grader_order: 1,
                    grader_id: g1.id,
                    status: slotStatus,
                },
            });
            // Create slot for grader 2
            const slot2 = await prisma.grading_slots.create({
                data: {
                    campaign_id: cId, session_id: sId,
                    booklet_id: booklet.id,
                    campaign_subject_id: cs.id,
                    session_subject_id: ss.id,
                    session_subject_question_id: q.id,
                    question_no: q.question_no,
                    grader_order: 2,
                    grader_id: g2.id,
                    status: slotStatus,
                },
            });
            slotCount += 2;

            // Create grading scores
            await prisma.grading_scores.createMany({
                data: [
                    { slot_id: slot1.id, score: s1, entered_by: g1.id },
                    { slot_id: slot2.id, score: s2, entered_by: g2.id },
                ],
                skipDuplicates: true,
            });
            scoreCount += 2;

            if (disputed) disputedCount++;
            if (reset) {
                resetCount++;
                // Create audit log for RESET cases
                await prisma.grading_score_logs.create({
                    data: {
                        campaign_id: cId,
                        session_id: sId,
                        booklet_id: booklet.id,
                        campaign_subject_id: cs.id,
                        session_subject_id: ss.id,
                        session_subject_question_id: q.id,
                        question_no: q.question_no,
                        slot_id1: slot1.id,
                        slot_id2: slot2.id,
                        grader1_id: g1.id,
                        grader2_id: g2.id,
                        old_score1: reset.g1 + 2,
                        old_score2: reset.g2 - 3,
                        new_score1: reset.g1,
                        new_score2: reset.g2,
                        reason: "RESET",
                        changed_by: adminAcc.id,
                        changed_at: new Date(),
                    },
                });
            }
        }
    }
    console.log(`✓ Grading slots (${slotCount}) + scores (${scoreCount})`);
    console.log(`  • COMPLETED: ${slotCount / 2 - disputedCount - resetCount} คู่`);
    console.log(`  • DISPUTED:  ${disputedCount} คู่ (รอรีเซ็ต)`);
    console.log(`  • RESET:     ${resetCount} คู่ (รีเซ็ตแล้ว + audit log)`);

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log("\n✅ Mock seed สำเร็จ!\n");
    console.log("─────────────────────────────────────────────");
    console.log(`Campaign ID : ${cId}`);
    console.log(`Session ID  : ${sId}`);
    console.log("─────────────────────────────────────────────");
    console.log("บัญชีผู้ใช้:");
    console.log("  admin     / Admin@12345  (ADMIN)");
    console.log("  manager01 / Admin@12345  (MANAGER)");
    console.log("  staff01   / Admin@12345  (STAFF)");
    console.log("  grader01-04 / Grader@12345 (GRADER)");
    console.log("─────────────────────────────────────────────");
    console.log("ฟีเจอร์ที่ทดสอบได้:");
    console.log("  /reports/bag-scores  → รายงานคะแนนในแต่ละถุง (ถุง 1-2, 10 ข้อ)");
    console.log("  /reset-scores        → รีเซ็ตคะแนน (5 DISPUTED + 2 RESET)");
    console.log("  /export              → ออกบัญชีรายชื่อผู้สอบผ่าน (top 5)");
    console.log("  /settings            → threshold=3, passing=5");
    console.log("─────────────────────────────────────────────\n");
}

main()
    .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
