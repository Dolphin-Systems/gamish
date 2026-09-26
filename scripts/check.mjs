import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

async function collectJavaScript(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await collectJavaScript(path));
    else if (entry.name.endsWith(".js") || entry.name.endsWith(".mjs")) paths.push(path);
  }
  return paths;
}

const files = ["app.js", "audio.js", "game.js", "admin.js"];
for (const directory of ["api", "lib", "scripts"]) {
  files.push(...await collectJavaScript(directory));
}

for (const file of files) {
  if (file === "scripts/check.mjs") continue;
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Syntax checked ${files.length - 1} JavaScript files.`);
