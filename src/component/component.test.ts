import { convexTest } from "convex-test";
import schema from "./schema";
import { expect } from "vitest";
import { api } from "./_generated/api";
import { modules } from "./setup.test";
import { DAY } from "./cache";
import { test as fcTest, fc } from "@fast-check/vitest";

fcTest.prop({ key: fc.array(fc.string()), value: fc.array(fc.float()) })(
  "Get and put work",
  async ({ key, value }) => {
    const t = convexTest(schema, modules);
    const empty = await t.mutation(api.cache.get, {
      name: "test",
      args: { key },
      expiration: null,
    });
    expect(empty).toBeNull();
    await t.mutation(api.cache.put, {
      name: "test",
      args: { key },
      value,
      expiration: 1000,
    });
    const result = await t.mutation(api.cache.get, {
      name: "test",
      args: { key },
      expiration: null,
    });
    expect(result).not.toBeNull();
    expect(result?.value).toEqual(value);
  }
);

fcTest.prop({ key: fc.array(fc.string()), value: fc.array(fc.float()) })(
  "Put with expiration works",
  async ({ key, value }) => {
    const t = convexTest(schema, modules);
    await t.mutation(api.cache.put, {
      name: "test",
      args: { key },
      value,
      expiration: 1000,
    });
    await t.run(async (ctx) => {
      const expirations = await ctx.db.query("expirations").collect();
      expect(expirations).toHaveLength(1);
      expect(expirations[0].expiresAt < Date.now() + 1000);
    });
    const result = await t.mutation(api.cache.get, {
      name: "test",
      args: { key },
      expiration: null,
    });
    expect(result).not.toBeNull();
    expect(result?.value).toEqual(value);
  }
);

fcTest.prop({ key: fc.array(fc.string()), value: fc.array(fc.float()) })(
  "Getting with a expiration on cache hit does not update previous indefinite expiration",
  async ({ key, value }) => {
    const t = convexTest(schema, modules);
    await t.mutation(api.cache.put, {
      name: "test",
      args: { key },
      value,
      expiration: null,
    });
    await t.mutation(api.cache.get, {
      name: "test",
      args: { key },
      expiration: 1000,
    });
    await t.run(async (ctx) => {
      const expirations = await ctx.db.query("expirations").collect();
      expect(expirations).toHaveLength(0);
    });
  }
);

fcTest.prop({ key: fc.array(fc.string()), value: fc.array(fc.float()) })(
  "Getting an expired value returns null",
  async ({ key, value }) => {
    const t = convexTest(schema, modules);
    await t.mutation(api.cache.put, {
      name: "test",
      args: { key },
      value,
      expiration: 0,
    });
    const result = await t.mutation(api.cache.get, {
      name: "test",
      args: { key },
      expiration: null,
    });
    expect(result).toBeNull();
  }
);
