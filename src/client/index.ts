import {
  createFunctionHandle,
  Expand,
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  FunctionVisibility,
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
  getFunctionName,
} from "convex/server";
import type { GenericId, JSONValue } from "convex/values";
import { api } from "../component/_generated/api";

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
    public component: UseApi<typeof api>,
    private config: ActionCacheConfig<Action>
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
    ctx: RunQueryCtx & RunMutationCtx & RunActionCtx,
    args: FunctionArgs<Action>,
    opts?: { ttl?: number; force?: boolean }
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
        })
      );
    }
  }

  /**
   * Removes the cache value for the given arguments.
   * @param ctx - The Convex mutation context.
   * @param args - The arguments to the action the generates the cache values.
   * @returns
   */
  async remove(ctx: RunMutationCtx, args: FunctionArgs<Action>) {
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
  async removeAllForName(ctx: RunMutationCtx, opts?: { batchSize?: number }) {
    return ctx.runMutation(this.component.lib.removeAll, {
      name: this.name,
      ...opts,
    });
  }

  /**
   * Clear all values in the cache.
   * @param ctx - The Convex mutation context.
   * @param before - (optional) Remove all values created before this timestamp.
   * Defaults to now (all values).
   * @returns
   */
  async removeAll(ctx: RunMutationCtx, before?: number) {
    return ctx.runMutation(this.component.lib.removeAll, { before });
  }
}

export async function removeAll(
  ctx: RunMutationCtx,
  component: UseApi<typeof api>,
  before?: number
) {
  return ctx.runMutation(component.lib.removeAll, { before });
}

/* Type utils follow */

type RunMutationCtx = {
  runMutation: GenericMutationCtx<GenericDataModel>["runMutation"];
};
type RunActionCtx = {
  runAction: GenericActionCtx<GenericDataModel>["runAction"];
};
type RunQueryCtx = {
  runQuery: GenericQueryCtx<GenericDataModel>["runQuery"];
};

export type OpaqueIds<T> =
  T extends GenericId<infer _T>
    ? string
    : T extends (infer U)[]
      ? OpaqueIds<U>[]
      : T extends object
        ? { [K in keyof T]: OpaqueIds<T[K]> }
        : T;

export type UseApi<API> = Expand<{
  [mod in keyof API]: API[mod] extends FunctionReference<
    infer FType,
    "public",
    infer FArgs,
    infer FReturnType,
    infer FComponentPath
  >
    ? FunctionReference<
        FType,
        "internal",
        OpaqueIds<FArgs>,
        OpaqueIds<FReturnType>,
        FComponentPath
      >
    : UseApi<API[mod]>;
}>;
