import { v } from "convex/values";
import { action, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { FunctionHandle } from "convex/server";

export const getOrCreate = action({
  args: {
    fn: v.string(),
    name: v.string(),
    args: v.any(),
    expiration: v.union(v.float64(), v.null()),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    const { fn, ...rest } = args;
    const cached = await ctx.runMutation(api.cache.get, rest);
    if (cached !== null) return cached.value;

    const value = await ctx.runAction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fn as FunctionHandle<"action", any, any>,
      args.args
    );
    await ctx.runMutation(api.cache.put, { ...rest, value });
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
    const match = await ctx.db
      .query("values")
      .withIndex("key", (q) => q.eq("name", args.name).eq("args", args.args))
      .unique();

    if (!match) return null;
    if (match.expirationId) {
      await ctx.db.delete(match.expirationId);
    }
    await ctx.db.delete(match._id);
  },
});

export const removeAll = mutation({
  args: {
    name: v.optional(v.string()),
    after: v.optional(v.float64()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { name, after } = args;
    const query = name
      ? ctx.db.query("values").withIndex("key", (q) => q.eq("name", name))
      : after
        ? ctx.db
            .query("values")
            .withIndex("by_creation_time", (q) => q.gte("_creationTime", after))
        : ctx.db.query("values");
    const matches = await query.take(100);
    for (const match of matches) {
      if (match.expirationId) {
        await ctx.db.delete(match.expirationId);
      }
      await ctx.db.delete(match._id);
    }
    if (matches.length === 100) {
      await ctx.scheduler.runAfter(
        0,
        api.public.removeAll,
        "name" in args ? { name } : { after: matches[99]._creationTime }
      );
    }
  },
});
