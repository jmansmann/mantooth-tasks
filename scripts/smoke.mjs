import { randomUUID } from "node:crypto";

const baseUrl = process.env.SMOKE_URL ?? "http://127.0.0.1:18090";
const title = `mantooth-smoke-${randomUUID()}`;
let taskId;
let failure;

try {
  const created = await fetch(`${baseUrl}/api/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (created.status !== 201) throw new Error(`Task creation returned HTTP ${created.status}.`);
  const task = await created.json();
  taskId = task.id;

  const listed = await fetch(`${baseUrl}/api/tasks?view=inbox`);
  if (!listed.ok) throw new Error(`Task listing returned HTTP ${listed.status}.`);
  const tasks = await listed.json();
  if (!tasks.some((item) => item.id === taskId && item.title === title)) {
    throw new Error("Created task was not returned by the inbox API.");
  }

  console.log(`Smoke test created and retrieved task ${taskId}.`);
} catch (reason) {
  failure = reason;
}

if (taskId) {
  try {
    const removed = await fetch(`${baseUrl}/api/tasks/${taskId}`, { method: "DELETE" });
    if (removed.status !== 204)
      throw new Error(`Smoke task cleanup returned HTTP ${removed.status}.`);
    console.log("Smoke test task removed.");
  } catch (reason) {
    failure ??= reason;
  }
}

if (failure) throw failure;
