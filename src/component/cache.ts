import { v } from "convex/values";
import { mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/**
 * Get a value from the cache, returning null if it doesn't exist or has expired.
 * It will consider the value expired if the original TTL has passed or if the
 * value is older than the new TTL.
 */
export const get = query({
  args: {
    name: v.string(),
    args: v.any(),
    ttl: v.union(v.float64(), v.null()),
  },
  returns: v.union(
    v.object({
      kind: v.literal("hit"),
      value: v.any(),
    }),
    v.object({
      kind: v.literal("miss"),
      expiredEntry: v.optional(v.object({    
        _creationTime: v.number(),
      })),
    })
  ),
  handler: async (ctx, args) => {
    const match = await lookup(ctx, args);
    if (!match) {
      return { kind: "miss" } as const;
    }
    // Take the minimum of the existing TTL and the argument TTL, if provided. 
    // Note that the background job will only cleanup entries according to their
    // original TTL.
    let expiresAt: number | null = null;
    if (match.metadataId) {
      const metadataDoc = await ctx.db.get(match.metadataId);
      expiresAt = metadataDoc?.expiresAt ?? null;
    }
    if (args.ttl) {
      expiresAt = Math.min(expiresAt ?? Infinity, match._creationTime + args.ttl);
    }
    if (expiresAt && expiresAt <= Date.now()) {
      return { kind: "miss", expiredEntry: { _creationTime: match._creationTime } } as const;
    }
    return { kind: "hit", value: match.value } as const;
  },
});

/**
 * Put a value into the cache after observing a cache miss. This will update the 
 * cache entry if no one has touched it since we observed the miss.
 * 
 * If ttl is non-null, it will set the expiration to that number of milliseconds from now.
 * If ttl is null, it will never expire.
 */
export const put = mutation({
  args: {
    name: v.string(),
    args: v.any(),
    value: v.any(),
    ttl: v.union(v.float64(), v.null()),
    expiredEntry: v.optional(v.object({      
      _creationTime: v.number(),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const match = await lookup(ctx, args);    

    // If someone else has written to the key since we computed the value, just
    // drop our update.
    if (match && args.expiredEntry) {
      if (args.expiredEntry._creationTime > match._creationTime) {
        return;
      }      
    }

    // Otherwise, delete the existing entry and insert a new one.
    if (match) {
      await del(ctx, match);
    }
    const valueId = await ctx.db.insert("values", {
      name: args.name,
      args: args.args,
      value: args.value,
    });
    if (args.ttl !== null) {
      const expiresAt = Date.now() + args.ttl;
      const metadataId = await ctx.db.insert("metadata", {
        valueId,
        expiresAt,
      });
      await ctx.db.patch(valueId, {
        metadataId,
      });        
    }
  }
})

export async function lookup(ctx: QueryCtx, args: { name: string, args: any }) {
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