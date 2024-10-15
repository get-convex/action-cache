# Cache component

**Note: Convex Components are currently in beta.**

Sometimes your app needs to fetch information from a third-party API that is slow or costs money. Caching can help! This is a Convex component that can cache the results of expensive functions and set an optional expiration. Expired entries are cleaned up via a cron job once a day.

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

## Installation

First, add `@convex-dev/action-cache` as an NPM dependency:

```sh
npm install @convex-dev/action-cache
```

Then, install the component into your Convex project within the `convex/convex.config.ts` configuration file:

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import cache from "@convex-dev/action-cache/convex.config.js";

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
