import { prisma } from "../../cores/prisma";
import { AppError } from "../../cores/errors";

export const dashboardService = {
    // ── 1. Overview ───────────────────────────────────────────────────────────────
    async overview() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
            totalCampaigns,
            activeCampaigns,
            totalBooklets,
            packagedBooklets,
            totalBags,
            totalGraders,
            totalUsers,
            scanLogsToday,
            completedSlots,
            disputedSlots,
            totalSlots,
        ] = await Promise.all([
            prisma.exam_campaigns.count({ where: { deleted_at: null } }),
            prisma.exam_campaigns.count({ where: { deleted_at: null, is_active: true } }),
            prisma.booklets.count({ where: { deleted_at: null } }),
            prisma.booklets.count({ where: { deleted_at: null, status: "PACKAGED" } }),
            prisma.bags.count({ where: { deleted_at: null } }),
            prisma.graders.count({ where: { deleted_at: null } }),
            prisma.users.count({ where: { deleted_at: null } }),
            prisma.qr_scan_logs.count({ where: { scanned_at: { gte: today } } }),
            prisma.grading_slots.count({ where: { deleted_at: null, status: "COMPLETED" } }),
            prisma.grading_slots.count({ where: { deleted_at: null, status: "DISPUTED" } }),
            prisma.grading_slots.count({ where: { deleted_at: null } }),
        ]);

        return {
            success: true,
            message: "ดึงข้อมูล overview สำเร็จ",
            data: {
                campaigns: { total: totalCampaigns, active: activeCampaigns },
                booklets: {
                    total: totalBooklets,
                    packaged: packagedBooklets,
                    unpackaged: totalBooklets - packagedBooklets,
                },
                bags: { total: totalBags },
                graders: { total: totalGraders },
                candidates: { total: totalUsers },
                grading: {
                    total_slots: totalSlots,
                    completed_slots: completedSlots,
                    disputed_slots: disputedSlots,
                    open_slots: totalSlots - completedSlots - disputedSlots,
                    completion_pct: totalSlots > 0 ? Math.round((completedSlots / totalSlots) * 100) : 0,
                },
                scan_logs_today: scanLogsToday,
            },
        };
    },

    // ── 2. Workflow ───────────────────────────────────────────────────────────────
    async workflow(campaignId: number) {
        const campaign = await prisma.exam_campaigns.findFirst({
            where: { id: campaignId, deleted_at: null },
        });
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const [
            sessionsCount,
            campaignSubjectsCount,
            userCampaignsCount,
            examRoomsCount,
            bookletsCount,
            bagsCount,
            gradersCount,
            graderAssignmentsCount,
            totalSlots,
            completedSlots,
            disputedSlots,
        ] = await Promise.all([
            prisma.sessions.count({ where: { campaign_id: campaignId, deleted_at: null } }),
            prisma.campaign_subjects.count({ where: { campaign_id: campaignId, deleted_at: null } }),
            prisma.user_campaigns.count({ where: { campaign_id: campaignId, deleted_at: null } }),
            prisma.exam_rooms.count({ where: { campaign_id: campaignId, deleted_at: null } }),
            prisma.booklets.count({ where: { campaign_id: campaignId, deleted_at: null } }),
            prisma.bags.count({ where: { campaign_id: campaignId, deleted_at: null } }),
            prisma.graders.count({ where: { campaign_id: campaignId, deleted_at: null } }),
            prisma.grader_assignments.count({ where: { campaign_id: campaignId, active: true, deleted_at: null } }),
            prisma.grading_slots.count({ where: { campaign_id: campaignId, deleted_at: null } }),
            prisma.grading_slots.count({ where: { campaign_id: campaignId, status: "COMPLETED", deleted_at: null } }),
            prisma.grading_slots.count({ where: { campaign_id: campaignId, status: "DISPUTED", deleted_at: null } }),
        ]);

        const gradingDone = totalSlots > 0 && completedSlots === totalSlots && disputedSlots === 0;
        const gradingInProgress = totalSlots > 0 && completedSlots > 0 && completedSlots < totalSlots;

        const steps = [
            {
                step: 1,
                key: "setup_campaign",
                label: "สร้างรอบสอบ",
                done: true,
                in_progress: false,
                detail: { campaign_id: campaign.id, name: campaign.name },
            },
            {
                step: 2,
                key: "setup_sessions",
                label: "ตั้งค่า Session และวิชา",
                done: sessionsCount > 0 && campaignSubjectsCount > 0,
                in_progress: false,
                detail: { sessions: sessionsCount, subjects: campaignSubjectsCount },
            },
            {
                step: 3,
                key: "setup_candidates",
                label: "เพิ่มผู้สมัครและห้องสอบ",
                done: userCampaignsCount > 0 && examRoomsCount > 0,
                in_progress: false,
                detail: { candidates: userCampaignsCount, rooms: examRoomsCount },
            },
            {
                step: 4,
                key: "generate_booklets",
                label: "สร้าง Booklet",
                done: bookletsCount > 0,
                in_progress: false,
                detail: { booklets: bookletsCount },
            },
            {
                step: 5,
                key: "pack_bags",
                label: "แพ็คถุง",
                done: bagsCount > 0,
                in_progress: false,
                detail: { bags: bagsCount },
            },
            {
                step: 6,
                key: "assign_graders",
                label: "มอบหมายผู้ตรวจ",
                done: gradersCount > 0 && graderAssignmentsCount > 0,
                in_progress: false,
                detail: { graders: gradersCount, assignments: graderAssignmentsCount },
            },
            {
                step: 7,
                key: "grading",
                label: "ตรวจข้อสอบ",
                done: gradingDone,
                in_progress: gradingInProgress,
                detail: {
                    total_slots: totalSlots,
                    completed_slots: completedSlots,
                    disputed_slots: disputedSlots,
                    progress_pct: totalSlots > 0 ? Math.round((completedSlots / totalSlots) * 100) : 0,
                },
            },
            {
                step: 8,
                key: "unlock_results",
                label: "ปลดล็อกผลสอบ",
                done: campaign.is_unlock,
                in_progress: false,
                detail: { is_unlock: campaign.is_unlock },
            },
        ];

        const currentStep = steps.find((s) => !s.done)?.step ?? 8;

        return {
            success: true,
            message: "ดึงข้อมูล workflow สำเร็จ",
            data: {
                campaign_id: campaignId,
                campaign_name: campaign.name,
                current_step: currentStep,
                steps,
            },
        };
    },

    // ── 3. Recent Activities ──────────────────────────────────────────────────────
    async recentActivities(campaignId?: number, limit = 20) {
        const take = Math.min(limit, 100);

        if (campaignId) {
            const [scanLogs, incidents, confirmedSlots] = await Promise.all([
                prisma.qr_scan_logs.findMany({
                    where: { campaign_id: campaignId },
                    orderBy: { scanned_at: "desc" },
                    take,
                    select: {
                        id: true,
                        scan_context: true,
                        scan_result: true,
                        scanned_at: true,
                        bag_id: true,
                        booklet_id: true,
                        accounts: { select: { full_name: true, username: true } },
                    },
                }),
                prisma.booklet_incident_reports.findMany({
                    where: { campaign_id: campaignId, deleted_at: null },
                    orderBy: { created_at: "desc" },
                    take,
                    select: {
                        id: true,
                        incident_type: true,
                        title: true,
                        status: true,
                        severity: true,
                        booklet_id: true,
                        created_at: true,
                    },
                }),
                prisma.grading_slots.findMany({
                    where: { campaign_id: campaignId, status: "COMPLETED", deleted_at: null },
                    orderBy: { updated_at: "desc" },
                    take,
                    select: {
                        id: true,
                        booklet_id: true,
                        updated_at: true,
                        graders: { select: { accounts: { select: { full_name: true, username: true } } } },
                    },
                }),
            ]);

            const activities = [
                ...scanLogs.map((s) => ({
                    type: "SCAN" as const,
                    timestamp: s.scanned_at,
                    description: `สแกน QR (${s.scan_context}) — ${s.scan_result}`,
                    actor: s.accounts?.full_name ?? s.accounts?.username ?? "ไม่ระบุ",
                    meta: { bag_id: s.bag_id, booklet_id: s.booklet_id },
                })),
                ...incidents.map((i) => ({
                    type: "INCIDENT" as const,
                    timestamp: i.created_at,
                    description: `แจ้งเหตุ [${i.severity}] ${i.incident_type}: ${i.title} (${i.status})`,
                    actor: "-",
                    meta: { incident_id: i.id, booklet_id: i.booklet_id },
                })),
                ...confirmedSlots.map((s) => ({
                    type: "GRADING_CONFIRMED" as const,
                    timestamp: s.updated_at,
                    description: `ยืนยันการตรวจ booklet #${s.booklet_id}`,
                    actor: s.graders?.accounts?.full_name ?? s.graders?.accounts?.username ?? "ไม่ระบุ",
                    meta: { slot_id: s.id, booklet_id: s.booklet_id },
                })),
            ]
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .slice(0, take);

            return { success: true, message: "ดึงกิจกรรมล่าสุดสำเร็จ", data: activities };
        }

        // Global view — use activity_logs
        const logs = await prisma.activity_logs.findMany({
            orderBy: { event_time: "desc" },
            take,
            include: {
                accounts: { select: { full_name: true, username: true } },
            },
        });

        const activities = logs.map((l) => ({
            type: "ACTIVITY" as const,
            timestamp: l.event_time,
            description: `${l.action}${l.object_type ? ` [${l.object_type}#${l.object_id}]` : ""}`,
            actor: l.accounts?.full_name ?? l.accounts?.username ?? l.actor_type,
            meta: { object_type: l.object_type, object_id: l.object_id },
        }));

        return { success: true, message: "ดึงกิจกรรมล่าสุดสำเร็จ", data: activities };
    },

    // ── 4. Active Campaigns ───────────────────────────────────────────────────────
    async activeCampaigns() {
        const campaigns = await prisma.exam_campaigns.findMany({
            where: { is_active: true, deleted_at: null },
            orderBy: { created_at: "desc" },
        });

        const data = await Promise.all(
            campaigns.map(async (c) => {
                const [totalBooklets, packagedBooklets, totalBags, totalGraders, totalSlots, completedSlots, disputedSlots] =
                    await Promise.all([
                        prisma.booklets.count({ where: { campaign_id: c.id, deleted_at: null } }),
                        prisma.booklets.count({ where: { campaign_id: c.id, status: "PACKAGED", deleted_at: null } }),
                        prisma.bags.count({ where: { campaign_id: c.id, deleted_at: null } }),
                        prisma.graders.count({ where: { campaign_id: c.id, deleted_at: null } }),
                        prisma.grading_slots.count({ where: { campaign_id: c.id, deleted_at: null } }),
                        prisma.grading_slots.count({ where: { campaign_id: c.id, status: "COMPLETED", deleted_at: null } }),
                        prisma.grading_slots.count({ where: { campaign_id: c.id, status: "DISPUTED", deleted_at: null } }),
                    ]);

                return {
                    id: c.id,
                    name: c.name,
                    year_be: c.year_be,
                    campaign_size: c.campaign_size,
                    site: c.site,
                    is_unlock: c.is_unlock,
                    qr_active: c.qr_active,
                    booklets: { total: totalBooklets, packaged: packagedBooklets },
                    bags: totalBags,
                    graders: totalGraders,
                    grading_progress: {
                        total: totalSlots,
                        completed: completedSlots,
                        disputed: disputedSlots,
                        pct: totalSlots > 0 ? Math.round((completedSlots / totalSlots) * 100) : 0,
                    },
                };
            }),
        );

        return { success: true, message: "ดึงข้อมูลรอบสอบที่ active สำเร็จ", data };
    },

    // ── 5. Grading Progress ───────────────────────────────────────────────────────
    async grading(campaignId: number) {
        const campaign = await prisma.exam_campaigns.findFirst({
            where: { id: campaignId, deleted_at: null },
        });
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const [totalSlots, completedSlots, disputedSlots, openSlots, inProgressSlots] = await Promise.all([
            prisma.grading_slots.count({ where: { campaign_id: campaignId, deleted_at: null } }),
            prisma.grading_slots.count({ where: { campaign_id: campaignId, status: "COMPLETED", deleted_at: null } }),
            prisma.grading_slots.count({ where: { campaign_id: campaignId, status: "DISPUTED", deleted_at: null } }),
            prisma.grading_slots.count({ where: { campaign_id: campaignId, status: "OPEN", deleted_at: null } }),
            prisma.grading_slots.count({ where: { campaign_id: campaignId, status: "IN_PROGRESS", deleted_at: null } }),
        ]);

        const graders = await prisma.graders.findMany({
            where: { campaign_id: campaignId, deleted_at: null },
            include: { accounts: { select: { full_name: true, username: true } } },
        });

        const graderStats = await Promise.all(
            graders.map(async (g) => {
                const [done, inProg, open] = await Promise.all([
                    prisma.grading_slots.count({ where: { grader_id: g.id, campaign_id: campaignId, status: "COMPLETED" } }),
                    prisma.grading_slots.count({ where: { grader_id: g.id, campaign_id: campaignId, status: "IN_PROGRESS" } }),
                    prisma.grading_slots.count({ where: { grader_id: g.id, campaign_id: campaignId, status: "OPEN" } }),
                ]);
                const total = done + inProg + open;
                return {
                    grader_id: g.id,
                    full_name: g.accounts?.full_name ?? "-",
                    username: g.accounts?.username ?? "-",
                    completed: done,
                    in_progress: inProg,
                    open,
                    total,
                    pct: total > 0 ? Math.round((done / total) * 100) : 0,
                };
            }),
        );

        const bags = await prisma.bags.findMany({
            where: { campaign_id: campaignId, deleted_at: null },
            orderBy: { bag_no: "asc" },
            select: { id: true, bag_no: true },
        });

        const bagStats = await Promise.all(
            bags.map(async (b) => {
                const [total, completed, disputed] = await Promise.all([
                    prisma.grading_slots.count({ where: { booklets: { bag_id: b.id }, deleted_at: null } }),
                    prisma.grading_slots.count({ where: { booklets: { bag_id: b.id }, status: "COMPLETED" } }),
                    prisma.grading_slots.count({ where: { booklets: { bag_id: b.id }, status: "DISPUTED" } }),
                ]);
                return {
                    bag_id: b.id,
                    bag_no: b.bag_no,
                    total_slots: total,
                    completed_slots: completed,
                    disputed_slots: disputed,
                    pct: total > 0 ? Math.round((completed / total) * 100) : 0,
                };
            }),
        );

        return {
            success: true,
            message: "ดึงข้อมูลความคืบหน้าการตรวจสำเร็จ",
            data: {
                campaign_id: campaignId,
                summary: {
                    total_slots: totalSlots,
                    completed_slots: completedSlots,
                    disputed_slots: disputedSlots,
                    open_slots: openSlots,
                    in_progress_slots: inProgressSlots,
                    completion_pct: totalSlots > 0 ? Math.round((completedSlots / totalSlots) * 100) : 0,
                },
                graders: graderStats,
                bags: bagStats,
            },
        };
    },

    // ── 6. Unlock Checklist ───────────────────────────────────────────────────────
    async unlockChecklist(campaignId: number) {
        const campaign = await prisma.exam_campaigns.findFirst({
            where: { id: campaignId, deleted_at: null },
            include: { campaign_settings: { where: { deleted_at: null, active: true } } },
        });
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const [
            totalSlots,
            completedSlots,
            disputedSlots,
            openSlots,
            inProgressSlots,
            totalBooklets,
            packagedBooklets,
            emptyBagsCount,
            activeOtpCount,
            openIncidents,
        ] = await Promise.all([
            prisma.grading_slots.count({ where: { campaign_id: campaignId, deleted_at: null } }),
            prisma.grading_slots.count({ where: { campaign_id: campaignId, status: "COMPLETED", deleted_at: null } }),
            prisma.grading_slots.count({ where: { campaign_id: campaignId, status: "DISPUTED", deleted_at: null } }),
            prisma.grading_slots.count({ where: { campaign_id: campaignId, status: "OPEN", deleted_at: null } }),
            prisma.grading_slots.count({ where: { campaign_id: campaignId, status: "IN_PROGRESS", deleted_at: null } }),
            prisma.booklets.count({ where: { campaign_id: campaignId, deleted_at: null } }),
            prisma.booklets.count({ where: { campaign_id: campaignId, status: "PACKAGED", deleted_at: null } }),
            prisma.bags.count({
                where: {
                    campaign_id: campaignId,
                    deleted_at: null,
                    booklets: { none: { deleted_at: null } },
                },
            }),
            prisma.twofactor_sessions.count({
                where: {
                    campaign_id: campaignId,
                    status: "PENDING",
                    expires_at: { gt: new Date() },
                },
            }),
            prisma.booklet_incident_reports.count({
                where: { campaign_id: campaignId, status: "OPEN", deleted_at: null },
            }),
        ]);

        const hasPassingSettings = campaign.campaign_settings.some((s) => s.setting_key === "passing_policy");

        const checklist = [
            {
                key: "all_grading_completed",
                label: "ตรวจข้อสอบครบทุก slot",
                done: totalSlots > 0 && completedSlots === totalSlots,
                detail: { total: totalSlots, completed: completedSlots, open: openSlots, in_progress: inProgressSlots },
            },
            {
                key: "no_disputed_slots",
                label: "ไม่มี slot ที่ยังค้างข้อโต้แย้ง",
                done: disputedSlots === 0,
                detail: { disputed: disputedSlots },
            },
            {
                key: "all_booklets_packaged",
                label: "สมุดคำตอบทุกเล่มอยู่ในถุงแล้ว",
                done: totalBooklets > 0 && packagedBooklets === totalBooklets,
                detail: { total: totalBooklets, packaged: packagedBooklets, unpackaged: totalBooklets - packagedBooklets },
            },
            {
                key: "no_empty_bags",
                label: "ไม่มีถุงที่ไม่มีสมุด",
                done: emptyBagsCount === 0,
                detail: { empty_bags: emptyBagsCount },
            },
            {
                key: "passing_settings_configured",
                label: "ตั้งค่าเกณฑ์ผ่าน/ไม่ผ่านแล้ว",
                done: hasPassingSettings,
                detail: { has_passing_policy: hasPassingSettings },
            },
            {
                key: "no_active_otp",
                label: "ไม่มี OTP ค้างอยู่",
                done: activeOtpCount === 0,
                detail: { active_otp_count: activeOtpCount },
            },
            {
                key: "no_open_incidents",
                label: "ไม่มีเหตุการณ์ที่ยังค้างอยู่",
                done: openIncidents === 0,
                detail: { open_incidents: openIncidents },
            },
        ];

        const passedCount = checklist.filter((c) => c.done).length;

        return {
            success: true,
            message: "ดึง unlock checklist สำเร็จ",
            data: {
                campaign_id: campaignId,
                is_already_unlocked: campaign.is_unlock,
                ready_to_unlock: checklist.every((c) => c.done) && !campaign.is_unlock,
                checklist_summary: { passed: passedCount, total: checklist.length },
                checklist,
            },
        };
    },
};
