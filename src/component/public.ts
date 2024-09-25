import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { FunctionHandle } from "convex/server";

export const get = action({
  args: {
    key: v.string(),
    functionHandle: v.string(),
  },
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
  },
});
