import { app } from "./app";
import { env } from "./cores/env";

app.listen(env.PORT);


console.log(`server running on port ${env.PORT}`)