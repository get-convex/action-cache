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
  "Getting with a expiration updates expiration if no expiration before",
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
      expect(expirations).toHaveLength(1);
      expect(expirations[0].expiresAt < Date.now() + 1000);
    });
  }
);

fcTest.prop({ key: fc.array(fc.string()), value: fc.array(fc.float()) })(
  "Getting without expiration removes expiration",
  async ({ key, value }) => {
    const t = convexTest(schema, modules);
    await t.mutation(api.cache.put, {
      name: "test",
      args: { key },
      value,
      expiration: 1000,
    });
    await t.mutation(api.cache.get, {
      name: "test",
      args: { key },
      expiration: null,
    });
    await t.run(async (ctx) => {
      const expirations = await ctx.db.query("expirations").collect();
      expect(expirations).toHaveLength(0);
    });
  }
);

fcTest.prop({ key: fc.array(fc.string()), value: fc.array(fc.float()) })(
  "Getting with expiration more than a day past old one should update",
  async ({ key, value }) => {
    const t = convexTest(schema, modules);
    await t.mutation(api.cache.put, {
      name: "test",
      args: { key },
      value,
      expiration: 1000,
    });
    const dayFromNow = Date.now() + DAY;
    await t.mutation(api.cache.get, {
      name: "test",
      args: { key },
      expiration: 2000 + DAY,
    });
    await t.run(async (ctx) => {
      const expirations = await ctx.db.query("expirations").collect();
      expect(expirations).toHaveLength(1);
      expect(expirations[0].expiresAt).toBeGreaterThan(dayFromNow);
    });
  }
);

fcTest.prop({ key: fc.array(fc.string()), value: fc.array(fc.float()) })(
  "Getting with expiration where the old expiration is less than a day before should not update",
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
    const halfDayFromNow = Date.now() + DAY / 2;
    await t.mutation(api.cache.get, {
      name: "test",
      args: { key },
      expiration: DAY / 2,
    });
    await t.run(async (ctx) => {
      const expirations = await ctx.db.query("expirations").collect();
      expect(expirations).toHaveLength(1);
      expect(expirations[0].expiresAt).toBeLessThan(halfDayFromNow);
    });
  }
);

fcTest.prop({ key: fc.array(fc.string()), value: fc.array(fc.float()) })(
  "Getting with expiration before existing expiration should update",
  async ({ key, value }) => {
    const t = convexTest(schema, modules);
    const dayFromNow = Date.now() + DAY;
    await t.mutation(api.cache.put, {
      name: "test",
      args: { key },
      value,
      expiration: 2 * DAY,
    });
    await t.run(async (ctx) => {
      const expirations = await ctx.db.query("expirations").collect();
      expect(expirations).toHaveLength(1);
    });
    await t.mutation(api.cache.get, {
      name: "test",
      args: { key },
      expiration: DAY / 2,
    });
    await t.run(async (ctx) => {
      const expirations = await ctx.db.query("expirations").collect();
      expect(expirations).toHaveLength(1);
      expect(expirations[0].expiresAt).toBeLessThan(dayFromNow);
    });
  }
);
