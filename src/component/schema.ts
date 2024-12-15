import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  values: defineTable({
    name: v.string(),
    args: v.any(),
    value: v.any(),
    metadataId: v.optional(v.id("metadata")),
  }).index("key", ["name", "args"]),
  metadata: defineTable({
    valueId: v.id("values"),
    expiresAt: v.float64(),
  }).index("expiresAt", ["expiresAt"]),
});
