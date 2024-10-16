import { convexTest } from "convex-test";
import schema from "./schema";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import { modules } from "./setup.test";

test("Insert into cache", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.cache.put, {
    name: "test",
    args: { key: "emma" },
    value: [1, 2, 3],
    expiration: 1000,
  });
  const result = await t.mutation(api.cache.get, {
    name: "test",
    args: { key: "emma" },
    expiration: null,
  });
  expect(result).not.toBeNull();
  expect(result?.value).toEqual([1, 2, 3]);
});
