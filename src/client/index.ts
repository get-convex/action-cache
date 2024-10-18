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
  getFunctionName,
} from "convex/server";
import { GenericId } from "convex/values";
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
   * If not provided, the cache entry will be stored indefinitely.
   * This default can be overriden on a per-entry basis.
   * Note: It may be evicted from the cache before this time.
   */
  ttl?: number;
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
    ctx: RunActionCtx,
    args: FunctionArgs<Action>,
    opts?: { ttl: number }
  ) {
    const fn = await createFunctionHandle(this.config.action);

    return ctx.runAction(this.component.public.fetch, {
      fn,
      name: this.name,
      args,
      ttl: opts?.ttl ?? this.config.ttl ?? null,
    }) as FunctionReturnType<Action>;
  }

  /**
   * Removes the cache value for the given arguments.
   * @param ctx - The Convex mutation context.
   * @param args - The arguments to the action the generates the cache values.
   * @returns
   */
  async remove(ctx: RunMutationCtx, args: FunctionArgs<Action>) {
    return ctx.runMutation(this.component.public.remove, {
      name: this.name,
      args,
    });
  }

  /**
   * Clear the cache of all values associated with the name of this `ActionCache`.
   * @param ctx - The Convex mutation context.
   * @returns
   */
  async removeAllForName(ctx: RunMutationCtx) {
    return ctx.runMutation(this.component.public.removeAll, {
      name: this.name,
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
    return ctx.runMutation(this.component.public.removeAll, { before });
  }
}

/* Type utils follow */

type RunMutationCtx = {
  runMutation: GenericMutationCtx<GenericDataModel>["runMutation"];
};
type RunActionCtx = {
  runAction: GenericActionCtx<GenericDataModel>["runAction"];
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
