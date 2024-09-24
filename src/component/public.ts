import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { api, fullApiWithMounts, internal } from "./_generated/api";

export const get = action({
  args: {
    key: v.string(),
    functionHandle: v.string(),
  },
  returns: v.array(v.number()),
  handler: async (ctx, { key, functionHandle }) => {
    // First try the cache
    const cached: number[] | null = (await ctx.runMutation(
      api.cache.getFromCache,
      { key }
    )) as number[] | null;
    if (cached) return cached;
    else return [];
    // Then try the function
  },
});
