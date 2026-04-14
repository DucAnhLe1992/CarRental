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

const PORT =
  getPortFromArgs(process.argv.slice(2)) ??
  parsePort(process.env.PORT) ??
  parsePort(process.env.npm_config_port) ??
  3000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
