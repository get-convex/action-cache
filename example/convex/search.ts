import { action, components } from "./_generated/server";
import { v } from "convex/values";
import { SearchResult } from "./vectorDemo";
import { api, internal } from "./_generated/api";
import { Client } from "@convex-dev/cache";
import { createFunctionHandle } from "convex/server";

const cacheClient = new Client(components.cache);

export const vectorSearch = action({
  args: { query: v.string(), cuisines: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => {
    const functionHandle = await createFunctionHandle(
      api.vectorDemo.embedAction
    );
    const embedding = await cacheClient.get(ctx, args.query, functionHandle);
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
      { results }
    );
    return rows;
  },
});
