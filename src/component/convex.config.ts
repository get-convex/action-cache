import { defineComponent } from "convex/server";
import crons from "@convex-dev/crons/convex.config";

const component = defineComponent("cache");
component.use(crons);
export default component;
