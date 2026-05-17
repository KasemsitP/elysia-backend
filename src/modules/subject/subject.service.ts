import { subjectRepo } from "./subject.repo"





export const subjectService = {
    async findAllSubject() {
        return await subjectRepo.findAllSubject();
    },
    async createSubject(){
        
    }
}