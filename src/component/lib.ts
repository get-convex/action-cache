import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { del } from "./cache";
import { lookup } from "./cache";
import { Doc, Id } from "./_generated/dataModel";

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
      expiredEntry: v.optional(v.id("values")),
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
      expiresAt = Math.min(
        expiresAt ?? Infinity,
        match._creationTime + args.ttl
      );
    }
    if (expiresAt && expiresAt <= Date.now()) {
      return { kind: "miss", expiredEntry: match._id } as const;
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
    expiredEntry: v.optional(v.id("values")),
  },
  returns: v.object({
    cacheHit: v.boolean(),
    deletedExpiredEntry: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const match = await lookup(ctx, args);

    // Try to reuse an existing entry if present.
    if (match && canReuseCacheEntry(args.expiredEntry, match, args.ttl)) {
      return { cacheHit: true, deletedExpiredEntry: false };
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
    return { cacheHit: false, deletedExpiredEntry: !!match };
  },
});

function canReuseCacheEntry(
  expiredEntry: Id<"values"> | undefined,
  existingEntry: Doc<"values">,
  ttl: number | null
) {
  // If we're setting a TTL and the previous entry doesn't have one, we can't reuse it.
  if (!existingEntry.metadataId && ttl !== null) {
    return false;
  }
  // Similarly, if we don't have a TTL and the previous entry does, we can't reuse it.
  if (existingEntry.metadataId && ttl === null) {
    return false;
  }
  // Don't reuse the entry we previously observed as expired.
  if (expiredEntry && existingEntry._id === expiredEntry) {
    return false;
  }
  return true;
}

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
    batchSize: v.optional(v.number()),
    before: v.optional(v.float64()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { name, before } = args;
    const batchSize = args.batchSize ?? 100;
    const query = name
      ? ctx.db.query("values").withIndex("key", (q) => q.eq("name", name))
      : ctx.db
          .query("values")
          .withIndex("by_creation_time", (q) =>
            q.lte("_creationTime", before ?? Date.now())
          );
    const matches = await query.order("desc").take(batchSize);
    for (const match of matches) {
      await del(ctx, match);
    }
    if (matches.length === batchSize) {
      await ctx.scheduler.runAfter(
        0,
        api.lib.removeAll,
        name ? { name } : { before: matches[batchSize - 1]!._creationTime }
      );
    }
  },
});
