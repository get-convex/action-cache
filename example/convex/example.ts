import { v } from "convex/values";
import {
  query,
  action,
  internalMutation,
  internalAction,
  mutation,
} from "./_generated/server";
import { internal, components } from "./_generated/api";
import { ActionCache, removeAll } from "@convex-dev/action-cache";
import schema from "./schema";

const geocodingCache = new ActionCache(components.actionCache, {
  action: internal.example.geocode,
  name: "geocode",
  ttl: 1000 * 60 * 60 * 24 * 7, // 1 week: locations don't change
});

const weatherCache = new ActionCache(components.actionCache, {
  action: internal.example.getWeather,
  name: "weather",
  ttl: 1000 * 60 * 5, // 5 minutes: weather can change quickly!
});

type Weather = {
  updated: string;
  temperature: number;
  feelsLike: number;
};

export const geocode = internalAction({
  args: { location: v.string() },
  handler: async (_ctx, { location }): Promise<[lat: number, long: number]> => {
    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`;
    const geocodingResponse = await fetch(geocodingUrl);
    const geocodingData = (await geocodingResponse.json()) as {
      results: {
        latitude: number;
        longitude: number;
        name: string;
      }[];
    };
    const result = geocodingData.results[0];
    if (!result) {
      throw new Error(`No geocoding result found for ${location}`);
    }
    console.log("geocoded location", location, result);
    return [result.latitude, result.longitude];
  },
});

export const getWeather = internalAction({
  args: { latitude: v.number(), longitude: v.number() },
  handler: async (_ctx, { latitude, longitude }): Promise<Weather> => {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code&wind_speed_unit=mph&temperature_unit=fahrenheit`;

    const response = await fetch(weatherUrl);
    const data = (await response.json()) as {
      current: {
        time: string;
        temperature_2m: number;
        apparent_temperature: number;
      };
    };
    console.log("got weather for location", data.current);
    return {
      updated: data.current.time,
      temperature: Number(data.current.temperature_2m),
      feelsLike: Number(data.current.apparent_temperature),
    };
  },
});

export const getWeatherForLocation = action({
  args: { location: v.optional(v.string()), force: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<Weather> => {
    const location = args.location ?? "New York";
    const start = Date.now();
    const [lat, long] = await geocodingCache.fetch(
      ctx,
      { location },
      { force: args.force }
    );
    const weather = await weatherCache.fetch(
      ctx,
      { latitude: lat, longitude: long },
      { force: args.force }
    );
    const end = Date.now();
    console.log(`getWeatherForLocation(${location}) took ${end - start}ms`);
    return weather;
  },
});

export const populate = action({
  args: {},
  handler: async (ctx) => {
    for (const location of ["New York", "San Francisco", "Tokyo"]) {
      const [lat, long] = await geocodingCache.fetch(ctx, {
        location,
      });
      await weatherCache.fetch(ctx, {
        latitude: lat,
        longitude: long,
      });
    }
  },
});

export const testConcurrently = action({
  args: {
    places: v.array(v.string()),
    clear: v.optional(v.boolean()),
  },
  handler: async (ctx, { places, clear }) => {
    if (clear) {
      await geocodingCache.removeAll(ctx);
    }
    const start = Date.now();
    const promises = [];
    for (const location of places) {
      const promise = async () => {
        const start = Date.now();
        await geocodingCache.fetch(ctx, { location });
        const end = Date.now();
        return end - start;
      };
      promises.push(promise());
    }
    const individualDurations = await Promise.all(promises);
    const totalDuration = Date.now() - start;
    console.log(
      `Loaded weather for ${places.length} places in ${totalDuration}ms`
    );
    for (const individualDuration of individualDurations) {
      console.log(`  Fetch: ${individualDuration}ms`);
    }
  },
});

export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    // Remove one entry by arguments.
    await geocodingCache.remove(ctx, { location: "New York" });
    // Remove all entries for this function.
    await geocodingCache.removeAllForName(ctx);
    // Remove all entries for all functions the component.
    await removeAll(ctx, components.actionCache);
  },
});
