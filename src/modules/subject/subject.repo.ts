import { prisma, type Tx } from "../../cores/prisma";






export const subjectRepo = {
    async findAllSubject(tx?: Tx) {
        const client = tx ?? prisma;
        return await client.subjects.findMany();
    }
}






