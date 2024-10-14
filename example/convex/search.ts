import { action } from "./_generated/server";
import { v } from "convex/values";
import { SearchResult } from "./vectorDemo";
import { internal } from "./_generated/api";
import { getEmbedding } from "./cache";

export const vectorSearch = action({
  args: { query: v.string(), cuisines: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => {
    const embedding = await getEmbedding(ctx, args.query);
    let results;
    const cuisines = args.cuisines;
    if (cuisines !== undefined) {
      results = await ctx.vectorSearch("foods", "by_embedding", {
        vector: embedding,
        limit: 16,
        filter: (q) =>
          q.or(...cuisines.map((cuisine) => q.eq("cuisine", cuisine))),
      });
    } else {
      results = await ctx.vectorSearch("foods", "by_embedding", {
        vector: embedding,
        limit: 16,
      });
    }
    const rows: SearchResult[] = await ctx.runQuery(
      internal.vectorDemo.fetchResults,
      { results },
    );
    return rows;
  },
});
