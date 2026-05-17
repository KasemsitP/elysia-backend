
import { sessionRepo } from "./session.repo";
import { AppError } from "../../cores/errors";
import type { sessionCreateBodySchema } from "./session.type";



export const sessionService = {

    async findAllSession() {
        const data = await sessionRepo.findAllSession();
        return { success: true, data };
    },
    async findSessionByCampaign(campaign_id: number) {
        const data = await sessionRepo.findCampaignById(campaign_id);
        if (!data) throw new AppError("ไม่พบรอบสอบ", 404);
        return { success: true, data };
    },
    async findSessionById(session_id: number) {
        const data = await sessionRepo.findSessionById(session_id);
        if (!data) throw new AppError("ไม่พบวันที่สอบ", 404);
        return { success: true, data };
    },

    async createSession(input: sessionCreateBodySchema) {
        const data = await sessionRepo.sessionCreate(input);
        return { success: true, data };
    },


}