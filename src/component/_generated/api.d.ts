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
import type * as public from "../public.js";

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
  public: typeof public;
}>;
export type Mounts = {
  cache: {
    get: FunctionReference<
      "mutation",
      "public",
      { key: string },
      Array<number> | null
    >;
    put: FunctionReference<
      "mutation",
      "public",
      { key: string; value: Array<number> },
      any
    >;
  };
  public: {
    get: FunctionReference<
      "action",
      "public",
      { functionHandle: string; key: string },
      Array<number>
    >;
    purge: FunctionReference<"mutation", "public", { ts: number }, any>;
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

/* prettier-ignore-end */
