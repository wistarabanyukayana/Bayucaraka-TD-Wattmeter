const { spawnSync } = require("node:child_process");

const builderCli = require.resolve("electron-builder/cli.js");
const args = process.argv.slice(2);
const env = {
  ...process.env,
};

function appendNodeOption(option) {
  if (!String(env.NODE_OPTIONS || "").includes(option)) {
    env.NODE_OPTIONS = [env.NODE_OPTIONS, option].filter(Boolean).join(" ");
  }
}

appendNodeOption("--no-deprecation");

const result = spawnSync(process.execPath, [builderCli, ...args], {
  env,
  stdio: "inherit",
});

process.exit(result.status === null ? 1 : result.status);
