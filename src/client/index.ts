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

export class ActionCache<
  Action extends FunctionReference<"action", FunctionVisibility>,
> {
  public name: string;
  constructor(
    public component: UseApi<typeof api>,
    private args: {
      action: Action;
      name?: string;
      expiration?: number;
    }
  ) {
    this.name = this.args.name || getFunctionName(this.args.action);
  }
  async getOrCreate(ctx: RunActionCtx, args: FunctionArgs<Action>) {
    const fn = await createFunctionHandle(this.args.action);

    return ctx.runAction(this.component.public.getOrCreate, {
      fn,
      name: this.name,
      args,
      expiration: this.args.expiration || null,
    }) as FunctionReturnType<Action>;
  }

  async remove(ctx: RunMutationCtx, args: FunctionArgs<Action>) {
    return ctx.runMutation(this.component.public.remove, {
      name: this.name,
      args,
    });
  }

  async removeAllForAction(ctx: RunMutationCtx) {
    return ctx.runMutation(this.component.public.removeAll, {
      name: this.name,
    });
  }

  async removeAll(ctx: RunMutationCtx, component: UseApi<typeof api>) {
    return ctx.runMutation(component.public.removeAll, {});
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
