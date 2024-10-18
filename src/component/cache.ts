import { v } from "convex/values";
import { mutation, MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

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
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const match = await lookup(ctx, args);
    if (!match) return null;
    const metadataDoc =
      match.metadataId && (await ctx.db.get(match.metadataId));
    // Invalidate expired values
    if (metadataDoc && metadataDoc.expiresAt <= Date.now()) {
      await del(ctx, match);
      return null;
    }
    return match;
  },
});

export async function lookup(
  ctx: MutationCtx,
  args: { name: string; args: unknown }
) {
  return ctx.db
    .query("values")
    .withIndex("key", (q) => q.eq("name", args.name).eq("args", args.args))
    .unique();
}

export async function del(ctx: MutationCtx, value: Doc<"values">) {
  if (value.metadataId) {
    await ctx.db.delete(value.metadataId);
  }
  await ctx.db.delete(value._id);
}

/**
 * Put a value into the cache. Updates the value if it already exists.
 * If ttl is non-null, it will set the expiration to that number of milliseconds from now.
 * If ttl is null, it will never expire.
 */
export const put = mutation({
  args: {
    name: v.string(),
    args: v.any(),
    value: v.any(),
    ttl: v.union(v.float64(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await lookup(ctx, args);
    if (existing) await del(ctx, existing);
    const { ttl, ...rest } = args;
    const valueId = await ctx.db.insert("values", rest);
    if (ttl !== null) {
      const expiresAt = Date.now() + ttl;
      const metadataId = await ctx.db.insert("metadata", {
        valueId,
        expiresAt,
      });
      await ctx.db.patch(valueId, {
        metadataId,
      });
    }
  },
});
