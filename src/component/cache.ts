import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const get = mutation({
  args: {
    key: v.string(),
  },
  returns: v.union(v.array(v.number()), v.null()),
  handler: async (ctx, { key }) => {
    const match = await ctx.db
      .query("values")
      .withIndex("key", (q) => q.eq("key", key))
      .collect();
    if (match.length > 1)
      throw new Error(`Found multiple values for key: ${key}`);
    if (match.length == 0) return null;
    const valuesId = match[0]._id;
    const lastUpdatedWithId = await ctx.db
      .query("lastUsed")
      .withIndex("valuesId", (q) => q.eq("valuesId", valuesId))
      .collect();
    if (lastUpdatedWithId.length != 1)
      throw new Error(
        `Expected exactly one lastUpdated doc for valuesId: ${valuesId}`,
      );
    const lastUpdatedDoc = lastUpdatedWithId[0];
    await ctx.db.patch(lastUpdatedDoc._id, {
      lastUsed: Date.now(),
    });
    return match[0].value;
  },
});

export const put = mutation({
  args: {
    key: v.string(),
    value: v.array(v.number()),
  },
  handler: async (ctx, { key, value }) => {
    const id = await ctx.db.insert("values", { key, value });
    await ctx.db.insert("lastUsed", {
      valuesId: id,
      lastUsed: Date.now(),
    });
  },
});
