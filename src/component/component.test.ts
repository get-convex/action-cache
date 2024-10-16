import { convexTest } from "convex-test";
import schema from "./schema";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import { modules } from "./setup.test";
import { DAY } from "./cache";

test("Get and put work", async () => {
  const t = convexTest(schema, modules);
  const empty = await t.mutation(api.cache.get, {
    name: "test",
    args: { key: "some random text" },
    expiration: null,
  });
  expect(empty).toBeNull();
  await t.mutation(api.cache.put, {
    name: "test",
    args: { key: "some random text" },
    value: [1, 2, 3],
    expiration: 1000,
  });
  const result = await t.mutation(api.cache.get, {
    name: "test",
    args: { key: "some random text" },
    expiration: null,
  });
  expect(result).not.toBeNull();
  expect(result?.value).toEqual([1, 2, 3]);
});

test("Put with expiration works", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cache.put, {
    name: "test",
    args: { key: "some random text" },
    value: [1, 2, 3],
    expiration: 1000,
  });
  await t.run(async (ctx) => {
    const expirations = await ctx.db.query("expirations").collect();
    expect(expirations).toHaveLength(1);
    expect(expirations[0].expiresAt < Date.now() + 1000);
  });
  const result = await t.mutation(api.cache.get, {
    name: "test",
    args: { key: "some random text" },
    expiration: null,
  });
  expect(result).not.toBeNull();
  expect(result?.value).toEqual([1, 2, 3]);
});

test("Getting with a expiration updates expiration if no expiration before", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cache.put, {
    name: "test",
    args: { key: "some random text" },
    value: [1, 2, 3],
    expiration: null,
  });
  await t.mutation(api.cache.get, {
    name: "test",
    args: { key: "some random text" },
    expiration: 1000,
  });
  await t.run(async (ctx) => {
    const expirations = await ctx.db.query("expirations").collect();
    expect(expirations).toHaveLength(1);
    expect(expirations[0].expiresAt < Date.now() + 1000);
  });
});

test("Getting without expiration removes expiration", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cache.put, {
    name: "test",
    args: { key: "some random text" },
    value: [1, 2, 3],
    expiration: 1000,
  });
  await t.mutation(api.cache.get, {
    name: "test",
    args: { key: "some random text" },
    expiration: null,
  });
  await t.run(async (ctx) => {
    const expirations = await ctx.db.query("expirations").collect();
    expect(expirations).toHaveLength(0);
  });
});

test("Getting with expiration more than a day past old one should update", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cache.put, {
    name: "test",
    args: { key: "some random text" },
    value: [1, 2, 3],
    expiration: 1000,
  });
  const dayFromNow = Date.now() + DAY;
  await t.mutation(api.cache.get, {
    name: "test",
    args: { key: "some random text" },
    expiration: 1000 + DAY,
  });
  await t.run(async (ctx) => {
    const expirations = await ctx.db.query("expirations").collect();
    expect(expirations).toHaveLength(1);
    expect(expirations[0].expiresAt).toBeGreaterThan(dayFromNow);
  });
});

test("Getting with expiration where the old expiration is less than a day before should not update", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cache.put, {
    name: "test",
    args: { key: "some random text" },
    value: [1, 2, 3],
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
    args: { key: "some random text" },
    expiration: DAY / 2,
  });
  await t.run(async (ctx) => {
    const expirations = await ctx.db.query("expirations").collect();
    expect(expirations).toHaveLength(1);
    expect(expirations[0].expiresAt).toBeLessThan(halfDayFromNow);
  });
});

test("Getting with expiration before existing expiration should update?", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cache.put, {
    name: "test",
    args: { key: "some random text" },
    value: [1, 2, 3],
    expiration: 2 * DAY,
  });
  await t.run(async (ctx) => {
    const expirations = await ctx.db.query("expirations").collect();
    expect(expirations).toHaveLength(1);
  });
  const halfDayFromNow = Date.now() + DAY / 2;
  await t.mutation(api.cache.get, {
    name: "test",
    args: { key: "some random text" },
    expiration: DAY / 2,
  });
  await t.run(async (ctx) => {
    const expirations = await ctx.db.query("expirations").collect();
    expect(expirations).toHaveLength(1);
    // expect(expirations[0].expiresAt).eq(halfDayFromNow);
  });
});
