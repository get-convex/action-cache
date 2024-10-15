import { v } from "convex/values";
import { mutation, MutationCtx } from "./_generated/server";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Get a value from the cache, optionally updating its expiration.
 * If you don't provide an expiration, it will just return the value or null.
 * If expiration is null, it will ensure there isn't an expiration set for it.
 * If expiration is a number, it will set the expiration to that number of milliseconds from now,
 * unless it won't expire soon (defined by expiration time - one day).
 */
export const get = mutation({
  args: {
    name: v.string(),
    args: v.any(),
    expiration: v.optional(v.union(v.float64(), v.null())),
  },
  returns: v.union(v.any(), v.null()),
  handler: getInner,
});

async function getInner(
  ctx: MutationCtx,
  args: { name: string; args: unknown; expiration?: number | null | undefined }
) {
  const match = await ctx.db
    .query("values")
    .withIndex("key", (q) => q.eq("name", args.name).eq("args", args.args))
    .unique();
  if (!match) return null;
  if (args.expiration === undefined) {
    return match;
  }
  const expirationDoc =
    match.expirationId && (await ctx.db.get(match.expirationId));
  if (args.expiration == null) {
    if (expirationDoc) {
      await ctx.db.delete(expirationDoc._id);
      await ctx.db.patch(match._id, { expirationId: undefined });
    }
    return match;
  }
  const expiresAt = Date.now() + args.expiration;
  if (!expirationDoc) {
    const expirationId = await ctx.db.insert("expirations", {
      valueId: match._id,
      expiresAt,
    });
    await ctx.db.patch(match._id, { expirationId });
    return match;
  }
  // Debounce updates by a day
  if (expirationDoc.expiresAt < expiresAt - DAY) {
    await ctx.db.patch(expirationDoc._id, { expiresAt });
  }
  return match;
}

/**
 * Put a value into the cache. Updates the value if it already exists.
 * If expiration is non-null, it will set the expiration to that number of milliseconds from now.
 * If expiration is null, it won't expire unless a later `get` call sets an expiration.
 */
export const put = mutation({
  args: {
    name: v.string(),
    args: v.any(),
    value: v.array(v.number()),
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
      await ctx.db.insert("expirations", {
        valueId,
        expiresAt: Date.now() + expiration,
      });
    }
  },
});
