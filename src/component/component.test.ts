import { convexTest } from "convex-test";
import schema from "./schema";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import { modules } from "./setup.test";

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

test("Getting with expiration within a day debounces", async () => {
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
    expiration: 1000,
  });
  await t.run(async (ctx) => {
    const expirations = await ctx.db.query("expirations").collect();
    expect(expirations).toHaveLength(1);
    expect(expirations[0].expiresAt < Date.now() + 1000);
  });
});
