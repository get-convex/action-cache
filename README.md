# Convex Action Cache Component

[![npm version](https://badge.fury.io/js/@convex-dev%2Faction-cache.svg)](https://badge.fury.io/js/@convex-dev%2Faction-cache)

<!-- START: Include on https://convex.dev/components -->

Sometimes your app needs to fetch information from a third-party API that is
slow or costs money. Caching can help! This is a Convex component that can cache
the results of expensive functions and set an optional TTL. Expired entries are
cleaned up via a cron job once a day. The cache key is the `ActionCache`'s name
(defaults to function name) and the arguments to the action that generates the
cache values.

```ts
import { action } from "./_generated/server";
import { components } from "./_generated/api";
import { ActionCache } from "@convex-dev/action-cache";

const cache = new ActionCache(components.actionCache, {
  action: internal.example.myExpensiveAction,
});

export const myFunction = action({
  // NOTE: If we're returning the result, we need explicitly type the return value.
  // Refer to https://docs.convex.dev/functions/actions#dealing-with-circular-type-inference for more info.
  handler: async (ctx, args): Promise<{ text: string }> => {
    // Call it with the parameters to `myExpensiveAction`
    const result = await cache.fetch(ctx, { foo: "bar" });

    // Do something with the result or just return it
    return result;
  },
});

export const myExpensiveAction = internalAction({
  args: { foo: v.string() },
  handler: async (ctx, args): Promise<{ text: string }> {
    const data = await generateLLMResponse(ctx, args);
    return data;
  }
})
```

To invalidate the cache, you can set a new name explicitly and/or clear cached
values by name.

## Pre-requisite: Convex

You'll need an existing Convex project to use the component. Convex is a hosted
backend platform, including a database, serverless functions, and a ton more you
can learn about [here](https://docs.convex.dev/get-started).

Run `npm create convex` or follow any of the
[quickstarts](https://docs.convex.dev/home) to set one up.

## Installation

Install the component package:

```bash
npm install @convex-dev/action-cache
```

Create a `convex.config.ts` file in your app's `convex/` folder and install the
component by calling `use`:

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import cache from "@convex-dev/action-cache/convex.config.js";

const app = defineApp();
app.use(cache);

export default app;
```

Finally, create a new `ActionCache` with optional name and expiration within
your Convex project, and point it to the installed component.

- The `name` field can be used for identifying the function or version being
  used to create the values in the cache and can also be used for grouping
  entries to remove.
- The `ttl` (Time-To-Live) field determines how long the cache entries are
  valid, in milliseconds.
  - If no `ttl` is provided, the cache entries are kept indefinitely.
  - If an `ttl` is provided, expired cache entries are deleted when they are
    retrieved and in a daily cron job.

```ts
import { ActionCache } from "@convex-dev/action-cache";
import { components } from "./_generated/api";

const cache = new ActionCache(components.actionCache, {
  action: internal.example.myExpensiveAction,
  name: "myExpensiveActionV1",
  ttl: 1000 * 60 * 60 * 24 * 7, // 7 days
});
```

## Example

Suppose you're building an app that uses
[vector search](https://docs.convex.dev/search/vector-search). Calculating
embeddings is often expensive - in our case, we are using OpenAI's API which
adds latency to every search and costs money to use. We can reduce the number of
API calls by caching the results!

Start by defining the [Convex action](https://docs.convex.dev/functions/actions)
that calls the API to create embeddings. Feel free to substitute your favorite
embeddings API. You may need to adjust the vector dimensions in the schema in
`example/schema.ts` accordingly.

Set your API key
[environment variable](https://docs.convex.dev/production/environment-variables)

```bash
npx convex env set OPENAI_API_KEY <your-api-key>
```

```ts
export const embed = internalAction({
  args: { text: v.string() },
  handler: async (_ctx, { text }) => {
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
    const vector = json["data"][0]["embedding"];
    console.log(`Computed embedding of "${text}": ${vector.length} dimensions`);
    return vector as number[];
  },
});
```

Create the embeddings cache:

```ts
const embeddingsCache = new ActionCache(components.actionCache, {
  action: internal.example.embed,
  name: "embed-v1",
});
```

Use the cache when you run a vector search:

```ts
export const vectorSearch = action({
  args: { query: v.string(), cuisines: v.array(v.string()) },
  handler: async (ctx, args) => {
    const embedding = await embeddingsCache.fetch(ctx, {
      text: args.query,
    });
    const results = await ctx.vectorSearch("foods", "by_embedding", {
      vector: embedding,
      limit: 16,
      filter: (q) =>
        q.or(...args.cuisines.map((cuisine) => q.eq("cuisine", cuisine))),
    });
    const rows: SearchResult[] = await ctx.runQuery(
      internal.example.fetchResults,
      { results },
    );
    return rows;
  },
});
```

### Defining multiple caches

You can use the same component for multiple actions, or multiple versions of the
same action. You can specify a custom `name` argument to denote which cache you
want to use, or change the name to start fresh, like `embed-v2`.

If the return value changes, it is important to change the name so you don't get
unexpected values.

### Updating the cache before it expires

It's convenient to lazily run the action when there is a cache miss. However,
this means that some requests will be slow, and many competeing requests may
race to all run the action and populate the cache.

You can avoid this by calling `fetch` with the `force` option. This will force
the action to run and update the cache, even if there is a cache hit. In the
meantime, other requests will get a cache hit.

If you call this from a cron job, the cache will always have an entry (unless
the action fails).

### Clearing values

To clear old values, you can:

1. Remove one entry by arguments.

   ```ts
   await embeddingsCache.remove(ctx, { text: "target text" });
   ```

2. Remove all entries for the current name (defaults to function name). This is
   useful if you updated the implementation and want to clear

   ```ts
   await embeddingsCache.removeAllForName(ctx);
   ```

3. Remove all entries in the component, including all names.
   ```ts
   await embeddingsCache.removeAll(ctx);
   ```

See more example usage in [example.ts](./example/convex/example.ts).

<!-- END: Include on https://convex.dev/components -->
