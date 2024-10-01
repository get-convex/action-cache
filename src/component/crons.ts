import { cronJobs } from "convex/server";
import { api, internal } from "./_generated/api";
import { internalMutation, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";

const crons = cronJobs();

export const purge = mutation({
  args: {
    expiresAt: v.optional(v.float64()),
  },
  returns: v.null(),
  handler: purgeInner,
});

async function purgeInner(
  ctx: MutationCtx,
  { expiresAt }: { expiresAt?: number }
) {
  const valuesToDelete = await ctx.db
    .query("expirations")
    .withIndex(
      "expiresAt",
      expiresAt ? (q) => q.lte("expiresAt", expiresAt!) : undefined
    )
    .order("desc")
    .take(100);
  const deletions = [];
  for (const value of valuesToDelete) {
    deletions.push(ctx.db.delete(value._id));
    deletions.push(ctx.db.delete(value.valueId));
  }
  await Promise.all(deletions);
  if (valuesToDelete.length === 100) {
    console.log("More than 100 values to delete, scheduling another purge");
    await ctx.scheduler.runAfter(0, api.crons.purge, {
      expiresAt: expiresAt ? valuesToDelete[99].expiresAt : undefined,
    });
  } else {
    console.log("Purge complete");
  }
}

crons.interval("expire", { hours: 24 }, internal.crons.expire);

export const expire = internalMutation({
  args: {},
  handler: async (ctx) => {
    await purgeInner(ctx, { expiresAt: Date.now() });
  },
});

export default crons;
