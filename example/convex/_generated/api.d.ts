/* prettier-ignore-start */

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
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as search from "../search.js";
import type * as vectorDemo from "../vectorDemo.js";

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
  constants: typeof constants;
  crons: typeof crons;
  search: typeof search;
  vectorDemo: typeof vectorDemo;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {
  cache: {
    cache: {
      get: FunctionReference<
        "mutation",
        "internal",
        { key: string },
        Array<number> | null
      >;
      put: FunctionReference<
        "mutation",
        "internal",
        { key: string; value: Array<number> },
        any
      >;
    };
    public: {
      get: FunctionReference<
        "action",
        "internal",
        { functionHandle: string; key: string },
        Array<number>
      >;
      purge: FunctionReference<"mutation", "internal", { ts: number }, any>;
    };
  };
};

/* prettier-ignore-end */
