import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [, , task] = process.argv;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

loadLocalEnv(path.join(projectRoot, ".env"));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for Prisma commands.");
  process.exit(1);
}

const env = {
  ...process.env,
  DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL,
};

if (!process.env.DIRECT_URL) {
  console.warn(
    "DIRECT_URL is not set. Falling back to DATABASE_URL for Prisma CLI commands.",
  );
}

const taskCommands = {
  generate: [["prisma", "generate"]],
  "migrate-deploy": [["prisma", "migrate", "deploy"]],
  setup: [
    ["prisma", "generate"],
    ["prisma", "migrate", "deploy"],
  ],
  "vercel-build": [
    ["prisma", "generate"],
    ["prisma", "migrate", "deploy"],
    ["react-router", "build"],
  ],
};

const commands = taskCommands[task];

if (!commands) {
  console.error(
    `Unknown Prisma task "${task}". Expected one of: ${Object.keys(taskCommands).join(", ")}`,
  );
  process.exit(1);
}

for (const [command, ...args] of commands) {
  await run(command, args);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
      shell: true,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? 1}`));
    });

    child.on("error", reject);
  });
}

function loadLocalEnv(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(filePath, "utf8");

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}
