import { defineApp } from "convex/server";
import cache from "@convex-dev/cache/convex.config";

const app = defineApp();
app.use(cache);

export default app;
