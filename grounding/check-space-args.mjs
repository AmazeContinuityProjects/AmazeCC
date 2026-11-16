import { readFileSync } from "node:fs";
const lines = readFileSync("grounding/gen-gitbook.mjs", "utf8").split("\n");
const bad = lines.filter((l) => l.includes("space(") && /, "[a-z-]+"\s*[),]/.test(l));
console.log("lines still carrying a 4th string arg to space():");
for (const l of bad) console.log(" ", l.trim());
console.log("count:", bad.length);
