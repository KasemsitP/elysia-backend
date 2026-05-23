import { Elysia } from "elysia";
import { openapi } from "@elysia/openapi";
import { cors } from "@elysia/cors";
import { logger } from "@grotto/logysia";
import { errorHandler } from "./cores/error-handler";
import { prisma } from "./cores/prisma";
import { csrfPlugin } from "./cores/csrf";

// Auth & Session
import { authRoutes } from "./modules/auth/auth.routes";
import { meRoutes } from "./modules/me/me.routes";

// Master Data
import { subjectRoutes } from "./modules/subject/subject.routes";
import { userRoutes } from "./modules/users/users.routes";

// Campaign Setup
import { campaignRoutes } from "./modules/campaign/campaign.routes";
import { campaignSubjectRoutes } from "./modules/campaign-subjects/campaign-subjects.routes";
import { campaignSettingRoutes } from "./modules/campaign-settings/campaign-settings.routes";
import { campaignKeyRoutes } from "./modules/campaign-keys/campaign-keys.routes";

// Rooms & Candidates
import { examRoomRoutes } from "./modules/exam-rooms/exam-rooms.routes";
import { userCampaignRoutes } from "./modules/user-campaigns/user-campaigns.routes";
import { seatRoutes } from "./modules/seats/seat.route";

// Sessions & Questions
import { sessionRoutes } from "./modules/session/session.routes";
import { sessionSubjectRoutes } from "./modules/session-subjects/session-subjects.routes";
import { sessionSubjectQuestionRoutes } from "./modules/session-subject-questions/session-subject-questions.routes";

// Booklets & Bags
import { bookletRoutes } from "./modules/booklets/booklets.routes";
import { bagRoutes } from "./modules/bags/bags.routes";
import { scanLogRoutes } from "./modules/scan-logs/scan-logs.routes";

// Grading
import { graderRoutes } from "./modules/grader/grader.routes";
import { graderAssignmentRoutes } from "./modules/grader-assignments/grader-assignments.routes";
import { gradingRoutes } from "./modules/grading/grading.routes";

// Dashboard
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";

// Signsheet
import { signsheetRoutes } from "./modules/signsheet/signsheet.route";

// Reports & Incidents
import { reportRoutes } from "./modules/reports/reports.routes";
import { incidentRoutes } from "./modules/incidents/incidents.routes";
import { bookletNoteRoutes } from "./modules/booklet-notes/booklet-notes.routes";

// System
import { otpRoutes } from "./modules/otp/otp.routes";
import { notificationRoutes } from "./modules/notifications/notifications.routes";

export const app = new Elysia()
    // ── Health (no auth, no CSRF) ─────────────────────────────────────────────
    .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() }))
    .get("/health/db", async ({ set }) => {
        try {
            await prisma.$queryRaw`SELECT 1`;
            return { status: "ok", database: "connected" };
        } catch {
            set.status = 503;
            return { status: "error", database: "disconnected" };
        }
    })
    .use(openapi({
        documentation: {
            info: {
                title: "Exam Management API",
                version: "1.0.0",
                description: [
                    "API สำหรับระบบจัดการข้อสอบและตรวจคะแนน",
                    "",
                    "## Authentication",
                    "ใช้ Cookie-based session — เรียก `POST /api/auth/login` ก่อน จากนั้น cookie `sid` จะถูกส่งอัตโนมัติ",
                    "",
                    "## CSRF",
                    "ทุก mutation (POST/PATCH/DELETE) ต้องส่ง header `X-CSRF-Token` — ขอ token ได้จาก `GET /api/csrf-token`",
                ].join("\n"),
            },
            tags: [
                { name: "Auth",      description: "Login, logout, session management" },
                { name: "Campaigns", description: "Campaign lifecycle management" },
                { name: "Sessions",  description: "Exam session and subject setup" },
                { name: "Booklets",  description: "Booklet generation and QR management" },
                { name: "Bags",      description: "Bag packaging with QR scan" },
                { name: "Grading",   description: "Grading flow: slots, drafts, confirm" },
                { name: "Reports",   description: "Score reports and passing list" },
                { name: "Users",     description: "Candidate and room management" },
                { name: "System",    description: "OTP, notifications, settings" },
            ],
        },
        // Scalar UI → http://localhost:PORT/reference
        // OpenAPI JSON → http://localhost:PORT/openapi
    }))
    .use(logger())
    .use(cors({
        origin: process.env.FRONTEND_URL ?? true,
        credentials: true,
        allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-XSRF-Token"],
        exposeHeaders: ["X-CSRF-Token"],
    }))
    .use(errorHandler)
    // ── CSRF protection (global, skips login) ────────────────────────────────
    .use(csrfPlugin)
    .group("/api", (app) =>
        app
            .get("/", () => ({ message: "Elysia is running" }))
            // Auth
            .use(authRoutes)
            .use(meRoutes)
            // Master Data
            .use(subjectRoutes)
            .use(userRoutes)
            // Campaign
            .use(campaignRoutes)
            .use(campaignSubjectRoutes)
            .use(campaignSettingRoutes)
            .use(campaignKeyRoutes)
            // Rooms & Candidates
            .use(examRoomRoutes)
            .use(userCampaignRoutes)
            .use(seatRoutes)
            // Sessions
            .use(sessionRoutes)
            .use(sessionSubjectRoutes)
            .use(sessionSubjectQuestionRoutes)
            // Booklets & Bags
            .use(bookletRoutes)
            .use(bagRoutes)
            .use(scanLogRoutes)
            // Grading
            .use(graderRoutes)
            .use(graderAssignmentRoutes)
            .use(gradingRoutes)
            // Dashboard
            .use(dashboardRoutes)
            // Signsheet
            .use(signsheetRoutes)
            // Reports & Incidents
            .use(reportRoutes)
            .use(incidentRoutes)
            .use(bookletNoteRoutes)
            // System
            .use(otpRoutes)
            .use(notificationRoutes),
    );

export type App = typeof app;
