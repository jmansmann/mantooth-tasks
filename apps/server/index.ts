import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApplication } from "./app.js";
import { createTaskStore } from "./store.js";

const port = Number(process.env.PORT ?? 8080);
const webRoot = fileURLToPath(new URL("../../../web/", import.meta.url));
const dataDirectory = process.env.DATA_DIR ?? "/data";
const store = createTaskStore(join(dataDirectory, "tasks.sqlite3"));
const app = createApplication(store, webRoot);
const server = createServer(app);
server.listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({ event: "server.listening", port }));
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const forceClose = setTimeout(() => {
    server.closeAllConnections();
    store.close();
    process.exit(1);
  }, 10_000);
  forceClose.unref();
  server.close(() => {
    clearTimeout(forceClose);
    store.close();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
