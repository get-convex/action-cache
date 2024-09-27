import {
  Expand,
  FunctionReference,
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
} from "convex/server";
import { GenericId } from "convex/values";
import { api } from "../component/_generated/api";

export class Client {
  constructor(public component: UseApi<typeof api>) {}
  async get(ctx: RunActionCtx, key: string, functionHandle: string) {
    return ctx.runAction(this.component.public.get, {
      key: key,
      functionHandle,
    });
  }

  async purge(ctx: RunMutationCtx, ts: number) {
    return ctx.runMutation(this.component.public.purge, { ts });
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
