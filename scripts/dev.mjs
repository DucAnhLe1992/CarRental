import { spawn } from "node:child_process";

const DEFAULT_BACKEND_PORT = 3000;
const DEFAULT_FRONTEND_PORT = 5173;

function parseNumber(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return undefined;
  }
  return parsed;
}

function getPortArg(argv, name) {
  const flag = `--${name}`;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === flag) {
      return parseNumber(argv[index + 1]);
    }

    if (token.startsWith(`${flag}=`)) {
      return parseNumber(token.split("=")[1]);
    }
  }

  return undefined;
}

function getPortOption(argv, envValue, name) {
  return getPortArg(argv, name) ?? parseNumber(envValue);
}

function startProcess(command, args, env) {
  return spawn(command, args, {
    env,
    shell: true,
    stdio: "inherit",
  });
}

const cliArgs = process.argv.slice(2);
const backendPort =
  getPortOption(cliArgs, process.env.npm_config_backend_port, "backend-port") ??
  DEFAULT_BACKEND_PORT;
const frontendPort =
  getPortOption(cliArgs, process.env.npm_config_frontend_port, "frontend-port") ??
  DEFAULT_FRONTEND_PORT;

console.log(`Starting backend on http://localhost:${backendPort}`);
console.log(`Starting frontend on http://localhost:${frontendPort}`);

const backend = startProcess("npm", ["--prefix", "backend", "run", "dev"], {
  ...process.env,
  PORT: String(backendPort),
});

const frontend = startProcess(
  "npm",
  ["--prefix", "frontend", "run", "dev", "--", "--port", String(frontendPort), "--strictPort"],
  {
    ...process.env,
    VITE_API_URL: `http://localhost:${backendPort}`,
  }
);

const children = [backend, frontend];
let isShuttingDown = false;

function shutdown() {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
}

for (const child of children) {
  child.on("exit", (code) => {
    if (!isShuttingDown) {
      shutdown();
      process.exit(code ?? 0);
    }
  });
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});
