import { spawn } from "node:child_process";

const [, , task] = process.argv;

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
