import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "purge embeddings not used in the last day",
  { hours: 1 }, // every hour
  internal.cache.purgeEmbeddings
);

export default crons;
