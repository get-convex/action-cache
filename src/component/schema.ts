import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  values: defineTable({
    name: v.string(),
    args: v.any(),
    value: v.array(v.number()),
    expirationId: v.optional(v.id("expirations")),
  }).index("key", ["name", "args"]),
  expirations: defineTable({
    valueId: v.id("values"),
    expiresAt: v.float64(),
  }).index("expiresAt", ["expiresAt"]),
});
