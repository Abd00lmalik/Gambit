// Lightweight local compile check (no foundry needed in restricted sandboxes).
// Mirrors foundry.toml: src=contracts, test/, solc 0.8.x, optimizer 200 runs.
// Usage: node script/compile.mjs [files...]  (default: contracts/ + test/)
import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const ROOT = path.resolve(import.meta.dirname, "..");
const REMAPPINGS = [
  ["@openzeppelin/contracts/", "node_modules/@openzeppelin/contracts/"],
  ["forge-std/", "Gambit/lib/forge-std/src/"],
];

function resolveImport(fromDir, spec) {
  for (const [alias, target] of REMAPPINGS) {
    if (spec.startsWith(alias)) return path.join(ROOT, target, spec.slice(alias.length));
  }
  if (spec.startsWith(".")) return path.resolve(fromDir, spec);
  return path.join(ROOT, spec);
}

const sources = {}; // key = import specifier, value = {content}
const queue = [];
const addFile = (abs, importKey) => {
  const key = importKey ?? path.relative(ROOT, abs);
  if (sources[key]) return;
  sources[key] = { content: fs.readFileSync(abs, "utf8") };
  queue.push([key, abs]);
};

const args = process.argv.slice(2);
if (args.length > 0) {
  for (const a of args) addFile(path.resolve(ROOT, a));
} else {
  for (const dir of ["contracts", "test"]) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      if (f.endsWith(".sol")) addFile(path.join(ROOT, dir, f));
    }
  }
}

while (queue.length) {
  const [file, abs] = queue.shift();
  const content = sources[file].content;
  const importRe = /import\s+(?:[^;'"]*?"([^"]+)"|'([^']+)')\s*;/g;
  let m;
  while ((m = importRe.exec(content))) {
    const spec = m[1] || m[2];
    // Key for the imported file: relative imports are namespaced under the importer's key dir
    const importKey = spec.startsWith(".")
      ? path.posix.normalize(path.posix.join(path.posix.dirname(file), spec))
      : spec;
    const resolved = resolveImport(abs ? path.dirname(abs) : ROOT, spec);
    if (fs.existsSync(resolved)) addFile(resolved, importKey);
    else throw new Error(`Unresolved import "${spec}" in ${file} → ${resolved}`);
  }
}

const input = {
  language: "Solidity",
  sources: Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, { content: v.content }])),
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "paris",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

let errors = 0;
for (const e of output.errors || []) {
  const severe = e.severity === "error";
  if (severe) errors++;
  console.error(`${severe ? "ERROR" : "WARN"}: ${e.formattedMessage}`);
}
const compiled = Object.keys(output.contracts || {});
console.log(`\nCompiled ${compiled.length} contracts: ${compiled.join(", ")}`);
if (errors > 0) {
  console.error(`✗ ${errors} error(s)`);
  process.exit(1);
}
console.log("✓ compile OK");
