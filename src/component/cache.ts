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
  },
  returns: v.union(v.any(), v.null()),
  handler: getInner,
});

async function getInner(
  ctx: MutationCtx,
  args: { name: string; args: unknown }
) {
  const match = await ctx.db
    .query("values")
    .withIndex("key", (q) => q.eq("name", args.name).eq("args", args.args))
    .unique();
  if (!match) return null;
  const metadataDoc = match.metadataId && (await ctx.db.get(match.metadataId));
  // Invalidate expired values
  if (metadataDoc && metadataDoc.expiresAt <= Date.now()) {
    await ctx.db.delete(match._id);
    await ctx.db.delete(metadataDoc._id);
    return null;
  }
  return match;
}

/**
 * Put a value into the cache. Updates the value if it already exists.
 * If ttl is non-null, it will set the ttl to that number of milliseconds from now.
 * If ttl is null, it will never expire.
 */
export const put = mutation({
  args: {
    name: v.string(),
    args: v.any(),
    value: v.any(),
    ttl: v.union(v.float64(), v.null()),
  },
  handler: async (ctx, args) => {
    const existing = await getInner(ctx, args);
    const { ttl, ...rest } = args;
    if (existing) {
      if (existing.value !== args.value) {
        await ctx.db.patch(existing._id, {
          value: args.value,
          metadataId: ttl === null ? undefined : existing.metadataId,
        });
        if (existing.metadataId) {
          if (ttl === null) {
            await ctx.db.delete(existing.metadataId);
          } else {
            await ctx.db.patch(existing.metadataId, {
              expiresAt: Date.now() + ttl,
            });
          }
        }
      }
    } else {
      const valueId = await ctx.db.insert("values", rest);
      if (ttl !== null) {
        const metadataId = await ctx.db.insert("metadata", {
          valueId,
          expiresAt: Date.now() + ttl,
        });
        await ctx.db.patch(valueId, { metadataId });
      }
    }
  },
});
