import { v } from "convex/values";
import { action, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { FunctionHandle } from "convex/server";
import { del } from "./cache";
import { lookup } from "./cache";

export const fetch = action({
  args: {
    fn: v.string(),
    name: v.string(),
    args: v.any(),
    ttl: v.union(v.float64(), v.null()),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    const { fn, ...rest } = args;
    const result = await ctx.runQuery(api.cache.get, rest);
    if (result.kind === "hit") {
      return result.value;
    }
    const value = await ctx.runAction(
      fn as FunctionHandle<"action">,
      args.args
    );
    await ctx.runMutation(api.cache.put, { ...rest, value, expiredEntry: result.expiredEntry });
    return value;
  },
});

export const remove = mutation({
  args: {
    name: v.string(),
    args: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const match = await lookup(ctx, args);
    if (match) {
      await del(ctx, match);
    }    
  },
});

export const removeAll = mutation({
  args: {
    name: v.optional(v.string()),
    before: v.optional(v.float64()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { name, before } = args;
    const query = name
      ? ctx.db.query("values").withIndex("key", (q) => q.eq("name", name))
      : ctx.db
          .query("values")
          .withIndex("by_creation_time", (q) =>
            q.lte("_creationTime", before ?? Date.now())
          );
    const matches = await query.order("desc").take(100);
    for (const match of matches) {
      await del(ctx, match);
    }
    if (matches.length === 100) {
      await ctx.scheduler.runAfter(
        0,
        api.lib.removeAll,
        name ? { name } : { before: matches[99]._creationTime }
      );
    }
  },
});
