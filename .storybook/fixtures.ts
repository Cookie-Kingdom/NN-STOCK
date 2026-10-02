// Databases for organism stories, built by the real `mutate` so every derived number
// (stock, cost, yield) is what the app would show.
import { seed, type Database } from "@/lib/store";
import { sampleData } from "@/lib/store/demo";

/** The day the stories stand on: "today" for every figure that takes one. */
export const day = "2026-09-09";

/** The approved sample: three Lots, two POs, 35 days of both branches. */
export const demoDb: Database = sampleData(day);

/** A new system: the settings, and nothing jotted yet. */
export const emptyDb: Database = structuredClone(seed);
