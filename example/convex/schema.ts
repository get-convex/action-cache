import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { CUISINES, Cuisine } from "./constants";

const cuisines = Object.keys(CUISINES) as Cuisine[];

export const vCuisines = v.union(
  ...cuisines.map((cuisine) => v.literal(cuisine))
);

export default defineSchema({
  foods: defineTable({
    description: v.string(),
    cuisine: vCuisines,
    embedding: v.array(v.float64()),
  }).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["cuisine"],
  }),
});
