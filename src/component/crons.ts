import { cronJobs } from "convex/server";
import { api } from "./_generated/api";
import { mutation } from "./_generated/server";
import { v } from "convex/values";

const crons = cronJobs();

export const purge = mutation({
  args: {
    expiresAt: v.optional(v.float64()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const expiresAt = args.expiresAt ?? Date.now();
    const valuesToDelete = await ctx.db
      .query("metadata")
      .withIndex("expiresAt", (q) => q.lte("expiresAt", expiresAt!))
      .order("desc")
      .take(10);
    const deletions = [];
    for (const value of valuesToDelete) {
      deletions.push(ctx.db.delete(value._id));
      deletions.push(ctx.db.delete(value.valueId));
    }
    await Promise.all(deletions);
    if (valuesToDelete.length === 10) {
      console.debug("More than 10 values to delete, scheduling another purge");
      await ctx.scheduler.runAfter(0, api.crons.purge, {
        expiresAt: expiresAt ? valuesToDelete[9].expiresAt : undefined,
      });
    } else if (valuesToDelete.length > 0) {
      console.debug("Cache purge complete");
    }
  },
});

crons.interval("expire", { hours: 24 }, api.crons.purge, {});

export default crons;
