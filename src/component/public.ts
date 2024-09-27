import { v } from "convex/values";
import { action, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { FunctionHandle } from "convex/server";

export const get = action({
  args: {
    key: v.string(),
    functionHandle: v.string(),
  },
  returns: v.array(v.number()),
  handler: async (ctx, { key, functionHandle }) => {
    const cached: number[] | null = (await ctx.runMutation(api.cache.get, {
      key,
    })) as number[] | null;
    if (cached !== null) return cached;

    const value = await ctx.runAction(
      functionHandle as FunctionHandle<"action", any, any>,
      {
        key,
      }
    );
    await ctx.runMutation(api.cache.put, { key, value });
    return value;
  },
});

export const purge = mutation({
  args: {
    ts: v.float64(),
  },
  handler: async (ctx, { ts }) => {
    const valuesToDelete = await ctx.db
      .query("lastUsed")
      .withIndex("lastUsed", (q) => q.lt("lastUsed", ts))
      .collect();
    const deletions = [];
    for (const value of valuesToDelete) {
      deletions.push(ctx.db.delete(value._id));
      deletions.push(ctx.db.delete(value.valuesId));
    }
    await Promise.all(deletions);
  },
});
