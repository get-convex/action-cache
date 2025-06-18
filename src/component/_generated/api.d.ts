/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as cache from "../cache.js";
import type * as crons from "../crons.js";
import type * as lib from "../lib.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  cache: typeof cache;
  crons: typeof crons;
  lib: typeof lib;
}>;
export type Mounts = {
  crons: {
    purge: FunctionReference<
      "mutation",
      "public",
      { expiresAt?: number },
      null
    >;
  };
  lib: {
    get: FunctionReference<
      "query",
      "public",
      { args: any; name: string; ttl: number | null },
      { kind: "hit"; value: any } | { expiredEntry?: string; kind: "miss" }
    >;
    put: FunctionReference<
      "mutation",
      "public",
      {
        args: any;
        expiredEntry?: string;
        name: string;
        ttl: number | null;
        value: any;
      },
      { cacheHit: boolean; deletedExpiredEntry: boolean }
    >;
    remove: FunctionReference<
      "mutation",
      "public",
      { args: any; name: string },
      null
    >;
    removeAll: FunctionReference<
      "mutation",
      "public",
      { batchSize?: number; before?: number; name?: string },
      null
    >;
  };
};
// For now fullApiWithMounts is only fullApi which provides
// jump-to-definition in component client code.
// Use Mounts for the same type without the inference.
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
