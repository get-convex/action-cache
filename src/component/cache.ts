import { v } from "convex/values";
import { mutation, MutationCtx } from "./_generated/server";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/**
 * Get a value from the cache, returning null if it doesn't exist or has expired.
 */
export const get = mutation({
  args: {
    name: v.string(),
    args: v.any(),
    expiration: v.union(v.float64(), v.null()),
  },
  returns: v.union(v.any(), v.null()),
  handler: getInner,
});

async function getInner(
  ctx: MutationCtx,
  args: { name: string; args: unknown; expiration: number | null }
) {
  const match = await ctx.db
    .query("values")
    .withIndex("key", (q) => q.eq("name", args.name).eq("args", args.args))
    .unique();
  if (!match) return null;
  const expirationDoc =
    match.expirationId && (await ctx.db.get(match.expirationId));
  // Invalidate expired values
  if (expirationDoc && expirationDoc.expiresAt <= Date.now()) {
    console.log("deleting old entry");
    await ctx.db.delete(match._id);
    await ctx.db.delete(expirationDoc._id);
    return null;
  }
  return match;
}

/**
 * Put a value into the cache. Updates the value if it already exists.
 * If expiration is non-null, it will set the expiration to that number of milliseconds from now.
 * If expiration is null, it will never expire.
 */
export const put = mutation({
  args: {
    name: v.string(),
    args: v.any(),
    value: v.any(),
    expiration: v.union(v.float64(), v.null()),
  },
  handler: async (ctx, args) => {
    const existing = await getInner(ctx, args);
    if (existing) {
      if (existing.value !== args.value) {
        await ctx.db.patch(existing._id, { value: args.value });
      }
    } else {
      const { expiration, ...rest } = args;
      const valueId = await ctx.db.insert("values", rest);
      if (expiration == null) return;
      const expirationId = await ctx.db.insert("expirations", {
        valueId,
        expiresAt: Date.now() + expiration,
      });
      await ctx.db.patch(valueId, { expirationId });
    }
  },
});
