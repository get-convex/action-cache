import { Client } from "@convex-dev/cache";
import { createFunctionHandle } from "convex/server";
import { ActionCtx, components, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";

const cacheClient = new Client(components.cache);

export async function getEmbedding(ctx: ActionCtx, text: string) {
  const functionHandle = await createFunctionHandle(api.vectorDemo.embed);
  return await cacheClient.get(ctx, text, functionHandle);
}

export const purgeEmbeddings = internalMutation({
  handler: async (ctx) => {
    const ts = Date.now() - 24 * 60 * 60 * 1000;
    await cacheClient.purge(ctx, ts);
  },
});
