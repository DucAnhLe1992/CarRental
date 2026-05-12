import "dotenv/config";
import app from "./app.js";

function parsePort(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return undefined;
  }

  return parsed;
}

function getPortFromArgs(args: string[]): number | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === "--port" || token === "-p") {
      return parsePort(args[index + 1]);
    }

    if (token.startsWith("--port=")) {
      return parsePort(token.split("=")[1]);
    }

    if (token.startsWith("-p=")) {
      return parsePort(token.split("=")[1]);
    }
  }

  return undefined;
}

const PREFERRED_PORT =
  getPortFromArgs(process.argv.slice(2)) ??
  parsePort(process.env.PORT) ??
  3000;

function startServer(port: number): void {
  const server = app.listen(port);

  server.once("listening", () => {
    console.log(`Server is running on http://localhost:${port}`);
  });

  server.once("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      const next = port + 1;
      console.warn(`Port ${port} is in use, trying ${next}…`);
      server.close();
      startServer(next);
    } else {
      console.error("Failed to start server:", err.message);
      process.exit(1);
    }
  });
}

startServer(PREFERRED_PORT);
