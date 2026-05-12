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

// Ask the OS directly whether any process is listening on the port.
// Works on Windows (PowerShell) and falls back to ss/netstat on Linux/macOS.
function isPortFree(port) {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    const [cmd, args] = isWindows
      ? ["powershell", ["-NoProfile", "-Command",
          `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Measure-Object).Count`]]
      : ["sh", ["-c", `ss -tln 2>/dev/null | grep -q ':${port} ' || netstat -tln 2>/dev/null | grep -q ':${port} '`]];

    let output = "";
    const ps = spawn(cmd, args, { stdio: ["ignore", "pipe", "ignore"] });
    ps.stdout?.on("data", (d) => { output += d; });
    ps.on("close", (code) => {
      if (isWindows) {
        resolve(parseInt(output.trim(), 10) === 0);
      } else {
        // exit 0 means grep matched → port in use
        resolve(code !== 0);
      }
    });
    ps.on("error", () => resolve(true)); // if check fails, assume free
  });
}

async function findFreePort(preferred) {
  for (let port = preferred; port < preferred + 20; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found starting from ${preferred}`);
}

function startProcess(command, args, env) {
  return spawn(command, args, {
    env,
    shell: true,
    stdio: "inherit",
  });
}

const cliArgs = process.argv.slice(2);
const preferredBackendPort =
  getPortOption(cliArgs, process.env.npm_config_backend_port, "backend-port") ??
  DEFAULT_BACKEND_PORT;
const preferredFrontendPort =
  getPortOption(cliArgs, process.env.npm_config_frontend_port, "frontend-port") ??
  DEFAULT_FRONTEND_PORT;

const backendPort = await findFreePort(preferredBackendPort);
const frontendPort = await findFreePort(preferredFrontendPort);

if (backendPort !== preferredBackendPort) {
  console.warn(`Port ${preferredBackendPort} is in use, backend will use port ${backendPort}.`);
}
if (frontendPort !== preferredFrontendPort) {
  console.warn(`Port ${preferredFrontendPort} is in use, frontend will use port ${frontendPort}.`);
}

console.log(`Starting backend on http://localhost:${backendPort}`);
console.log(`Starting frontend on http://localhost:${frontendPort}`);

const backend = startProcess("npm", ["--prefix", "backend", "run", "dev"], {
  ...process.env,
  PORT: String(backendPort),
});

const frontend = startProcess(
  "npm",
  ["--prefix", "frontend", "run", "dev", "--", "--port", String(frontendPort)],
  {
    ...process.env,
    VITE_API_URL: `http://localhost:${backendPort}`,
    VITE_API_PORT: String(backendPort),
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
