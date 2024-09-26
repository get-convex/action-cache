import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  values: defineTable({
    key: v.string(), // Is it possible to generalize this?
    value: v.array(v.number()),
  }).index("key", ["key"]),
  lastUsed: defineTable({
    valuesId: v.id("values"),
    lastUsed: v.float64(),
  })
    .index("valuesId", ["valuesId"])
    .index("lastUsed", ["lastUsed"]),
});
