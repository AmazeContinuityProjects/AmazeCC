/**
 * The campus period tables, and the one campus the planner runs on.
 *
 * This data used to live at the top of `FFCSTimetableTab`, which meant any
 * consumer that only wanted the schema — the share page rendering a received
 * plan, a future campus picker — had to import the whole 2,500-line tab
 * component to read three JSON files. As a lib module it costs a handful of
 * kilobytes of JSON wherever it is imported from.
 *
 * `GLOBAL_CAMPUS` is a constant, not a setting: the app ships one course
 * report (`public/ffcs/ffcsReport.csv`) for one campus, and a picker that
 * swapped the schema under a report that no longer matches it would be a
 * setting that lies. When per-campus reports exist, this is where the
 * per-campus wiring starts.
 */

import chennaiSchema from "@/data/campus/chennai.json";
import apSchema from "@/data/campus/ap.json";
import bhopalSchema from "@/data/campus/bhopal.json";

export const CAMPUS_SCHEMAS: Record<string, any> = {
  chennai: chennaiSchema,
  ap: apSchema,
  bhopal: bhopalSchema,
};

export const GLOBAL_CAMPUS = "chennai";

export const getTimetableSchema = () => CAMPUS_SCHEMAS[GLOBAL_CAMPUS];
