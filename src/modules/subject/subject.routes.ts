import { Elysia } from "elysia"
import { subjectService } from "./subject.service"







export const subjectRoutes = new Elysia({ prefix: "/subject" })
    .get("/", async ({ set }) => {
        const result = await subjectService.findAllSubject();
        set.status = 200;
        return result;
    })
    .post("/", async({body , set}) =>{
        const result = await subjectService.createSubject();
    }) 
