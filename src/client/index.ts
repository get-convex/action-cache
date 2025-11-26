import {
  createFunctionHandle,
  type FunctionArgs,
  type FunctionReference,
  type FunctionReturnType,
  type FunctionVisibility,
  type GenericActionCtx,
  type GenericDataModel,
  type GenericMutationCtx,
  getFunctionName,
} from "convex/server";
import type { JSONValue } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";

export interface ActionCacheConfig<
  Action extends FunctionReference<"action", FunctionVisibility>,
> {
  /**
   * The action that generates the cache values.
   */
  action: Action;
  /**
   * The name of the action cache. The name is part of the cache key and can be
   * used for versioning. Defaults to the name of the action.
   */
  name?: string;
  /**
   * The maximum number of milliseconds this cache entry is valid for.
   * If not provided, the cache entry will not automatically expire.
   * This default can be overriden on a per-entry basis by calling `fetch`
   * with the `ttl` option.
   * If the TTL differs between when the cache entry was created and when it is
   * fetched, the shorter of the TTLs will be used.
   */
  ttl?: number;
  /**
   * Whether to log cache hits and misses.
   */
  log?: boolean;
}

export class ActionCache<
  Action extends FunctionReference<"action", FunctionVisibility>,
> {
  /**
   * The name of the action cache. The name is part of the cache key and can be
   * used for versioning. Defaults to the name of the action.
   */
  public name: string;
  /**
   * A read-through cache wrapping an action. It calls the action on a miss.
   * @param component - The registered action cache from `components`.
   * @param config - The configuration for this action cache.
   */
  constructor(
    public component: ComponentApi,
    private config: ActionCacheConfig<Action>,
  ) {
    this.name = this.config.name || getFunctionName(this.config.action);
  }
  /**
   * Fetch the cache value for the given arguments, calling the action to create it
   * if the value is expired or does not exist.
   * @param ctx - The Convex action context.
   * @param args - The arguments to the action the generates the cache values.
   * @param opts - Optionally override the default cache TTL for this entry.
   * @returns - The cache value
   */
  async fetch(
    ctx: ActionCtx,
    args: FunctionArgs<Action>,
    opts?: {
      /**
       * How long to cache the value for. Overrides the default TTL.
       */
      ttl?: number;
      /**
       * Whether to force a cache miss.
       * If true, the action will be called and the result will be cached.
       * This can be useful if you want to update the cache before it expires.
       */
      force?: boolean;
    },
  ) {
    const fn = await createFunctionHandle(this.config.action);
    const ttl = opts?.ttl ?? this.config.ttl ?? null;
    const result = await ctx.runQuery(this.component.lib.get, {
      name: this.name,
      args,
      // If we're forcing a cache miss, we want to get the current value.
      ttl: opts?.force ? 0 : ttl,
    });
    if (result.kind === "hit") {
      this.#log({ get: "hit" });
      return result.value as FunctionReturnType<Action>;
    }
    const value = await ctx.runAction(fn, args);
    const putResult = await ctx.runMutation(this.component.lib.put, {
      name: this.name,
      args,
      value,
      expiredEntry: result.expiredEntry,
      ttl,
    });
    this.#log({
      get: "miss",
      put: putResult.cacheHit
        ? "hit"
        : putResult.deletedExpiredEntry
          ? "replaced"
          : "created",
    });
    return value as FunctionReturnType<Action>;
  }

  #log(args: Record<string, JSONValue>) {
    if (this.config.log) {
      console.log(
        JSON.stringify({
          type: "action-cache-stats",
          name: this.name,
          ...args,
        }),
      );
    }
  }

  /**
   * Removes the cache value for the given arguments.
   * @param ctx - The Convex mutation context.
   * @param args - The arguments to the action the generates the cache values.
   * @returns
   */
  async remove(ctx: MutationCtx | ActionCtx, args: FunctionArgs<Action>) {
    return ctx.runMutation(this.component.lib.remove, {
      name: this.name,
      args,
    });
  }

  /**
   * Clear the cache of all values associated with the name of this `ActionCache`.
   * @param ctx - The Convex mutation context.
   * @param opts - Optionally override the default batch size.
   */
  async removeAllForName(
    ctx: MutationCtx | ActionCtx,
    opts?: { batchSize?: number },
  ) {
    return ctx.runMutation(this.component.lib.removeAll, {
      name: this.name,
      batchSize: opts?.batchSize,
    });
  }

  /**
   * @deprecated Use `import { removeAll } from "@convex-dev/action-cache"`.
   * This one may imply it is only removing all values with this name/function.
   */
  async removeAll(ctx: MutationCtx | ActionCtx, before?: number) {
    return ctx.runMutation(this.component.lib.removeAll, { before });
  }
}

/**
 * Clear all values in the cache.
 * @param ctx - The Convex mutation context.
 * @param before - (optional) Remove all values created before this timestamp.
 * Defaults to now (all values).
 * @returns
 */
export async function removeAll(
  ctx: MutationCtx | ActionCtx,
  component: ComponentApi,
  before?: number,
) {
  return ctx.runMutation(component.lib.removeAll, { before });
}

/* Type utils follow */

type MutationCtx = Pick<
  GenericMutationCtx<GenericDataModel>,
  "runQuery" | "runMutation"
>;
type ActionCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "runQuery" | "runMutation" | "runAction"
>;
