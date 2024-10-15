# Convex Action Cache Component

[![npm version](https://badge.fury.io/js/@convex-dev%2Faction-cache.svg)](https://badge.fury.io/js/@convex-dev%2Faction-cache)

**Note: Convex Components are currently in beta.**

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
- The `expiration` field determines how long the cache entries are kept, in milliseconds, debounced by day.
  - If no `expiration` is provided, the cache entries are kept indefinitely.
  - If an `expiration` is provided, whenever the cache value is read, the value is set to expire after the current time + expiration. There is a cron job that runs once a day to remove expired entries.

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

# 🧑‍🏫 What is Convex?

[Convex](https://convex.dev) is a hosted backend platform with a
built-in database that lets you write your
[database schema](https://docs.convex.dev/database/schemas) and
[server functions](https://docs.convex.dev/functions) in
[TypeScript](https://docs.convex.dev/typescript). Server-side database
[queries](https://docs.convex.dev/functions/query-functions) automatically
[cache](https://docs.convex.dev/functions/query-functions#caching--reactivity) and
[subscribe](https://docs.convex.dev/client/react#reactivity) to data, powering a
[realtime `useQuery` hook](https://docs.convex.dev/client/react#fetching-data) in our
[React client](https://docs.convex.dev/client/react). There are also clients for
[Python](https://docs.convex.dev/client/python),
[Rust](https://docs.convex.dev/client/rust),
[ReactNative](https://docs.convex.dev/client/react-native), and
[Node](https://docs.convex.dev/client/javascript), as well as a straightforward
[HTTP API](https://docs.convex.dev/http-api/).

The database supports
[NoSQL-style documents](https://docs.convex.dev/database/document-storage) with
[opt-in schema validation](https://docs.convex.dev/database/schemas),
[relationships](https://docs.convex.dev/database/document-ids) and
[custom indexes](https://docs.convex.dev/database/indexes/)
(including on fields in nested objects).

The
[`query`](https://docs.convex.dev/functions/query-functions) and
[`mutation`](https://docs.convex.dev/functions/mutation-functions) server functions have transactional,
low latency access to the database and leverage our
[`v8` runtime](https://docs.convex.dev/functions/runtimes) with
[determinism guardrails](https://docs.convex.dev/functions/runtimes#using-randomness-and-time-in-queries-and-mutations)
to provide the strongest ACID guarantees on the market:
immediate consistency,
serializable isolation, and
automatic conflict resolution via
[optimistic multi-version concurrency control](https://docs.convex.dev/database/advanced/occ) (OCC / MVCC).

The [`action` server functions](https://docs.convex.dev/functions/actions) have
access to external APIs and enable other side-effects and non-determinism in
either our
[optimized `v8` runtime](https://docs.convex.dev/functions/runtimes) or a more
[flexible `node` runtime](https://docs.convex.dev/functions/runtimes#nodejs-runtime).

Functions can run in the background via
[scheduling](https://docs.convex.dev/scheduling/scheduled-functions) and
[cron jobs](https://docs.convex.dev/scheduling/cron-jobs).

Development is cloud-first, with
[hot reloads for server function](https://docs.convex.dev/cli#run-the-convex-dev-server) editing via the
[CLI](https://docs.convex.dev/cli),
[preview deployments](https://docs.convex.dev/production/hosting/preview-deployments),
[logging and exception reporting integrations](https://docs.convex.dev/production/integrations/),
There is a
[dashboard UI](https://docs.convex.dev/dashboard) to
[browse and edit data](https://docs.convex.dev/dashboard/deployments/data),
[edit environment variables](https://docs.convex.dev/production/environment-variables),
[view logs](https://docs.convex.dev/dashboard/deployments/logs),
[run server functions](https://docs.convex.dev/dashboard/deployments/functions), and more.

There are built-in features for
[reactive pagination](https://docs.convex.dev/database/pagination),
[file storage](https://docs.convex.dev/file-storage),
[reactive text search](https://docs.convex.dev/text-search),
[vector search](https://docs.convex.dev/vector-search),
[https endpoints](https://docs.convex.dev/functions/http-actions) (for webhooks),
[snapshot import/export](https://docs.convex.dev/database/import-export/),
[streaming import/export](https://docs.convex.dev/production/integrations/streaming-import-export), and
[runtime validation](https://docs.convex.dev/database/schemas#validators) for
[function arguments](https://docs.convex.dev/functions/args-validation) and
[database data](https://docs.convex.dev/database/schemas#schema-validation).

Everything scales automatically, and it’s [free to start](https://www.convex.dev/plans).
