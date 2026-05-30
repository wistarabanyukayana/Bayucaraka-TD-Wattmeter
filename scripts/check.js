const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CHECK_DIRS = [
  "WattmeterViewer/src",
  "WattmeterFirebase/src",
  "electron",
  "scripts",
];

function collectJavaScriptFiles(relativeDir) {
  const absoluteDir = path.join(ROOT, relativeDir);
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  return fs.readdirSync(absoluteDir, { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = path.join(relativeDir, entry.name);
      const absolutePath = path.join(ROOT, relativePath);

      if (entry.isDirectory()) {
        return collectJavaScriptFiles(relativePath);
      }

      return entry.isFile() && entry.name.endsWith(".js") ? [absolutePath] : [];
    });
}

const files = CHECK_DIRS.flatMap(collectJavaScriptFiles).sort();

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: ROOT,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
