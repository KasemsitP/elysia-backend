import { Elysia, t } from "elysia";
import { requireSession } from "../../cores/session";
import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";

// /me endpoints — ใช้ session.account_id โดยตรง ไม่ต้องส่ง id เอง (ปลอดภัยกว่า)
export const meRoutes = new Elysia({ prefix: "/me" })
    .use(requireSession)
    // ── ข้อมูลบัญชีตัวเอง ───────────────────────────────────────────────────
    .get("/", async ({ session, set }) => {
        const account = await prisma.accounts.findFirst({
            where: { id: session.account_id, deleted_at: null },
            select: {
                id: true,
                username: true,
                full_name: true,
                email: true,
                role_id: true,
                active: true,
                campaign_id: true,
                title: true,
            },
        });
        if (!account) throw new AppError("ไม่พบบัญชีผู้ใช้", 404);
        set.status = 200;
        return { success: true, message: "ดึงข้อมูลตัวเองสำเร็จ", data: account };
    })
    // ── Grader profile ───────────────────────────────────────────────────────
    // ปลอดภัยกว่า /graders/:graderId เพราะ user ไม่สามารถ guess grader_id คนอื่นได้
    .get(
        "/grader-profile",
        async ({ session, set }) => {
            if (session.role_id !== 4) throw new AppError("บัญชีนี้ไม่ใช่ผู้ตรวจ", 403);

            const grader = await prisma.graders.findFirst({
                where: { account_id: session.account_id, deleted_at: null },
                include: {
                    exam_campaigns: { select: { id: true, name: true, year_be: true, is_unlock: true } },
                },
            });
            if (!grader) throw new AppError("ไม่พบข้อมูลผู้ตรวจ", 404);
            set.status = 200;
            return { success: true, message: "ดึงข้อมูลผู้ตรวจสำเร็จ", data: grader };
        },
    )
    // ── My grader assignments ────────────────────────────────────────────────
    .get(
        "/grader-assignments",
        async ({ session, query, set }) => {
            if (session.role_id !== 4) throw new AppError("บัญชีนี้ไม่ใช่ผู้ตรวจ", 403);

            const grader = await prisma.graders.findFirst({
                where: { account_id: session.account_id, deleted_at: null },
            });
            if (!grader) throw new AppError("ไม่พบข้อมูลผู้ตรวจ", 404);

            const data = await prisma.grader_assignments.findMany({
                where: {
                    grader_id: grader.id,
                    active: true,
                    deleted_at: null,
                    ...(query.campaign_id !== undefined && { campaign_id: Number(query.campaign_id) }),
                },
                include: {
                    session_subject_questions: { select: { id: true, question_no: true, label: true, max_score: true } },
                    campaign_subjects: { select: { id: true, code: true, name: true } },
                    sessions: { select: { id: true, session_code: true, day_no: true } },
                },
                orderBy: { id: "asc" },
            });
            set.status = 200;
            return { success: true, message: "ดึงข้อมูลงานตรวจสำเร็จ", data };
        },
        { query: t.Object({ campaign_id: t.Optional(t.String()) }) },
    )
    // ── My active grading drafts ─────────────────────────────────────────────
    .get(
        "/grading/drafts/active",
        async ({ session, set }) => {
            if (session.role_id !== 4) throw new AppError("บัญชีนี้ไม่ใช่ผู้ตรวจ", 403);

            const grader = await prisma.graders.findFirst({
                where: { account_id: session.account_id, deleted_at: null },
            });
            if (!grader) throw new AppError("ไม่พบข้อมูลผู้ตรวจ", 404);

            const data = await prisma.grading_score_drafts.findMany({
                where: { grader_id: grader.id, status: "DRAFT", deleted_at: null },
                include: {
                    booklets: { select: { id: true, random_num: true, seq_in_bag: true, bag_id: true } },
                    grading_slots: { select: { id: true, grader_order: true, status: true } },
                    session_subject_questions: { select: { question_no: true, label: true, max_score: true } },
                },
                orderBy: { id: "asc" },
            });
            set.status = 200;
            return { success: true, message: "ดึงข้อมูล draft สำเร็จ", data };
        },
    )
    // ── My active work lock ──────────────────────────────────────────────────
    .get(
        "/grading/work-lock",
        async ({ session, set }) => {
            if (session.role_id !== 4) throw new AppError("บัญชีนี้ไม่ใช่ผู้ตรวจ", 403);

            const grader = await prisma.graders.findFirst({
                where: { account_id: session.account_id, deleted_at: null },
            });
            if (!grader) throw new AppError("ไม่พบข้อมูลผู้ตรวจ", 404);

            const data = await prisma.grader_work_locks.findFirst({
                where: { grader_id: grader.id, status: "ACTIVE" },
            });
            set.status = 200;
            return { success: true, message: "ดึง work lock สำเร็จ", data };
        },
    );
