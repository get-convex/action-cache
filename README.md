# Convex Action Cache Component

[![npm version](https://badge.fury.io/js/@convex-dev%2Faction-cache.svg)](https://badge.fury.io/js/@convex-dev%2Faction-cache)

**Note: Convex Components are currently in beta.**

<!-- START: Include on https://convex.dev/components -->

Sometimes your app needs to fetch information from a third-party API that is slow or costs money. Caching can help! This is a Convex component that can cache the results of expensive functions and set an optional expiration. Expired entries are cleaned up via a cron job once a day. The cache key is the `ActionCache`'s name (which can be the function or version) and the arguments to the action that generates the cache values.

```ts
import { Client } from "@convex-dev/cache";
import { action, components } from "./_generated/server";
import { ActionCache } from "@convex-dev/action-cache";

const cache = new ActionCache(components.cache, {
  action: internal.example.myExpensiveAction,
  name: "myExpensiveActionV1",
});

const myFunction = action({
  args: { actionArgs: v.any() },
  handler: async (ctx, { actionArgs }) => {
    await cache.getOrCreate(ctx, actionArgs);
  },
});
```

### Convex App

You'll need a Convex App to use the component. Run `npm create convex` or
follow any of the [Convex quickstarts](https://docs.convex.dev/home) to set one up.

## Installation

Install the component package:

```bash
npm install @convex-dev/action-cache
```

Create a `convex.config.ts` file in your app's `convex/` folder and install the component by calling `use`:

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import cache from "@convex-dev/action-cache/convex.config";

const app = defineApp();
app.use(cache);

export default app;
```

Finally, create a new `ActionCache` with optional name and expiration within your Convex project, and point it to the installed component.

- The `name` field can be used for identifying the function or version being used to create the values in the cache and can also be used for grouping entries to remove.
- The `expiration` field determines how long the cache entries are valid, in milliseconds.
  - If no `expiration` is provided, the cache entries are kept indefinitely.
  - If an `expiration` is provided, expired cache entries are deleted when they are retrieved and in a daily cron job.

```ts
// convex/index.ts
import { ActionCache } from "@convex-dev/cache";
import { components } from "./_generated/api";

const cache = new ActionCache(components.cache, {
  action: internal.example.myExpensiveAction,
  name: "myExpensiveActionV1",
  expiration: 1000 * 60 * 60 * 24 * 7, // 7 days
});
```

## Example

Suppose you're building an app that uses [vector search](https://docs.convex.dev/search/vector-search). Calculating embeddings is often expensive - in our case, we are using OpenAI's API which adds latency to every search and costs money to use. We can reduce the number of API calls by caching the results!

Start by defining the [Convex action](https://docs.convex.dev/functions/actions) that calls the API to create embeddings. Feel free to substitute your favorite embeddings API. You may need to adjust the vector dimensions in the schema in `example/schema.ts` accordingly.

Set your API key [environment variable](https://docs.convex.dev/production/environment-variables)

```bash
npx convex env set OPENAI_KEY <your-api-key>
```

```ts
export const embed = internalAction({
  args: { text: v.string() },
  handler: async (_ctx, { text }) => {
    const apiKey = process.env.OPENAI_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_KEY environment variable not set!");
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
    const vector = json["data"][0]["embedding"];
    console.log(`Computed embedding of "${text}": ${vector.length} dimensions`);
    return vector as number[];
  },
});
```

Create the embeddings cache:

```ts
const embeddingsCache = new ActionCache(components.cache, {
  action: internal.example.embed,
  name: "embed-v1",
});
```

Use the cache when you run a vector search:

```ts
export const vectorSearch = action({
  args: { query: v.string(), cuisines: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => {
    const embedding = await embeddingsCache.getOrCreate(ctx, {
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
      { results }
    );
    return rows;
  },
});
```

See more example usage in [example.ts](./example/convex/example.ts).

<!-- END: Include on https://convex.dev/components -->
