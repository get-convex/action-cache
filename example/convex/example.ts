import { v } from "convex/values";
import {
  query,
  action,
  internalMutation,
  internalQuery,
  internalAction,
  mutation,
} from "./_generated/server";
import { internal, components } from "./_generated/api";
import { CUISINES, EXAMPLE_DATA } from "./constants";
import { ActionCache } from "@convex-dev/action-cache";

const embeddingsCache = new ActionCache(components.actionCache, {
  action: internal.example.embed,
  name: "embed-v1",
});

export const embed = internalAction({
  args: { text: v.string() },
  handler: async (_ctx, { text }): Promise<number[]> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable not set!");
    }
    const req = { input: text, model: "text-embedding-ada-002" };
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req),
    });
    if (!resp.ok) {
      const msg = await resp.text();
      throw new Error(`OpenAI API error: ${msg}`);
    }
    const json = await resp.json();
    const vector = json["data"][0]["embedding"] as number[];
    console.log(`Computed embedding of "${text}": ${vector.length} dimensions`);
    return vector;
  },
});

export const populate = action({
  args: {},
  handler: async (ctx) => {
    for (const doc of EXAMPLE_DATA) {
      const embedding = await embeddingsCache.fetch(ctx, {
        text: doc.description,
      });
      await ctx.runMutation(internal.example.insertRow, {
        cuisine: doc.cuisine,
        description: doc.description,
        embedding,
      });
    }
  },
});

export const insert = action({
  args: { cuisine: v.string(), description: v.string() },
  handler: async (ctx, args) => {
    const embedding = await embeddingsCache.fetch(ctx, {
      text: args.description,
    });
    const doc = {
      cuisine: args.cuisine,
      description: args.description,
      embedding,
    };
    await ctx.runMutation(internal.example.insertRow, doc);
  },
});

export const insertRow = internalMutation({
  args: {
    description: v.string(),
    cuisine: v.string(),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    if (!Object.prototype.hasOwnProperty.call(CUISINES, args.cuisine)) {
      throw new Error(`Invalid cuisine: ${args.cuisine}`);
    }
    await ctx.db.insert("foods", args);
  },
});

export const list = query(async (ctx) => {
  const docs = await ctx.db.query("foods").order("desc").take(10);
  return docs.map((doc) => {
    return { _id: doc._id, description: doc.description, cuisine: doc.cuisine };
  });
});

export const fetchResults = internalQuery({
  args: {
    results: v.array(v.object({ _id: v.id("foods"), _score: v.float64() })),
  },
  handler: async (ctx, args) => {
    const out: SearchResult[] = [];
    for (const result of args.results) {
      const doc = await ctx.db.get(result._id);
      if (!doc) {
        continue;
      }
      out.push({
        _id: doc._id,
        description: doc.description,
        cuisine: doc.cuisine,
        _score: result._score,
      });
    }
    return out;
  },
});

export const vectorSearch = action({
  args: { query: v.string(), cuisines: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => {
    const embedding = await embeddingsCache.fetch(ctx, {
      text: args.query,
    });
    let results;
    const cuisines = args.cuisines;
    if (cuisines !== undefined) {
      results = await ctx.vectorSearch("foods", "by_embedding", {
        vector: embedding,
        limit: 16,
        filter: (q) =>
          q.or(...cuisines.map((cuisine) => q.eq("cuisine", cuisine))),
      });
    } else {
      results = await ctx.vectorSearch("foods", "by_embedding", {
        vector: embedding,
        limit: 16,
      });
    }
    const rows: SearchResult[] = await ctx.runQuery(
      internal.example.fetchResults,
      { results },
    );
    return rows;
  },
});

export type SearchResult = {
  _id: string;
  description: string;
  cuisine: string;
  _score: number;
};

export const test = action({
  args: {},
  handler: async (ctx) => {
    const embedding = await embeddingsCache.fetch(ctx, {
      text: "test",
    });
    if (embedding.length !== 1536) {
      throw new Error(`Expected 1536 dimensions, got ${embedding.length}`);
    }
    console.log("Got embedding!");
  },
});

export const testConcurrently = action({
  args: {
    text: v.string(),
    count: v.number(),
  },
  handler: async (ctx, args) => {
    const start = Date.now();
    const promises = [];
    for (let i = 0; i < args.count; i++) {
      const promise = async () => {
        const start = Date.now();
        const embedding = await embeddingsCache.fetch(ctx, { text: args.text });
        if (embedding.length !== 1536) {
          throw new Error(`Expected 1536 dimensions, got ${embedding.length}`);
        }
        const end = Date.now();
        return end - start;
      };
      promises.push(promise());
    }
    const individualDurations = await Promise.all(promises);
    const totalDuration = Date.now() - start;
    console.log(`Loaded ${args.count} embeddings in ${totalDuration}ms`);
    for (const individualDuration of individualDurations) {
      console.log(`  Fetch: ${individualDuration}ms`);
    }
  },
});

export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    // Remove one entry by arguments.
    await embeddingsCache.remove(ctx, { text: "test" });
    // Remove all entries for this function.
    await embeddingsCache.removeAllForName(ctx);
    // Remove all entries for all functions the component.
    await embeddingsCache.removeAll(ctx);
  },
});
