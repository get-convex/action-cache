import { convexTest } from "convex-test";
import schema from "./schema";
import { expect } from "vitest";
import { api } from "./_generated/api";
import { modules } from "./setup.test";
import { test as fcTest, fc } from "@fast-check/vitest";

fcTest.prop({ key: fc.array(fc.string()), value: fc.array(fc.float()) })(
  "Get and put work",
  async ({ key, value }) => {
    const t = convexTest(schema, modules);
    const empty = await t.mutation(api.cache.get, {
      name: "test",
      args: { key },
      ttl: null,
    });
    expect(empty).toBeNull();
    await t.mutation(api.cache.put, {
      name: "test",
      args: { key },
      value,
      ttl: 1000,
    });
    const result = await t.mutation(api.cache.get, {
      name: "test",
      args: { key },
      ttl: null,
    });
    expect(result).not.toBeNull();
    expect(result?.value).toEqual(value);
  }
);

fcTest.prop({ key: fc.array(fc.string()), value: fc.array(fc.float()) })(
  "Put with ttl works",
  async ({ key, value }) => {
    const t = convexTest(schema, modules);
    await t.mutation(api.cache.put, {
      name: "test",
      args: { key },
      value,
      ttl: 1000,
    });
    await t.run(async (ctx) => {
      const metadata = await ctx.db.query("metadata").collect();
      expect(metadata).toHaveLength(1);
      expect(metadata[0].expiresAt < Date.now() + 1000);
    });
    const result = await t.mutation(api.cache.get, {
      name: "test",
      args: { key },
      ttl: null,
    });
    expect(result).not.toBeNull();
    expect(result?.value).toEqual(value);
  }
);

fcTest.prop({ key: fc.array(fc.string()), value: fc.array(fc.float()) })(
  "Getting with a ttl on cache hit does not update previous indefinite ttl",
  async ({ key, value }) => {
    const t = convexTest(schema, modules);
    await t.mutation(api.cache.put, {
      name: "test",
      args: { key },
      value,
      ttl: null,
    });
    await t.mutation(api.cache.get, {
      name: "test",
      args: { key },
      ttl: 1000,
    });
    await t.run(async (ctx) => {
      const metadata = await ctx.db.query("metadata").collect();
      expect(metadata).toHaveLength(0);
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
      ttl: 0,
    });
    const result = await t.mutation(api.cache.get, {
      name: "test",
      args: { key },
      ttl: null,
    });
    expect(result).toBeNull();
  }
);
