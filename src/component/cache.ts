import { MutationCtx, QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export async function lookup(
  ctx: QueryCtx,
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
