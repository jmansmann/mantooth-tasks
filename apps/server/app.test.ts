import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Task } from "../../src/shared/task.js";
import { createApplication } from "./app.js";
import { createTaskStore } from "./store.js";

describe("task HTTP API", () => {
  let directory: string;
  let store: ReturnType<typeof createTaskStore>;
  let app: ReturnType<typeof createApplication>;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "mantooth-tasks-api-"));
    store = createTaskStore(join(directory, "tasks.sqlite3"));
    app = createApplication(store);
  });

  afterEach(() => {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });

  async function createTask(title: string): Promise<Task> {
    const response = await request(app).post("/api/tasks").send({ title });
    expect(response.status).toBe(201);
    return response.body as Task;
  }

  it("creates a trimmed task, lists it, and rejects malformed task input", async () => {
    const created = await createTask("  Write the first draft  ");
    expect(created.title).toBe("Write the first draft");
    expect(created.status).toBe("inbox");
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);

    const listed = await request(app).get("/api/tasks?view=inbox");
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual([created]);

    const invalid = await request(app).post("/api/tasks").send({ title: "   " });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe("INVALID_INPUT");
    expect(invalid.body.error.message).toBeTruthy();

    await request(app)
      .post("/api/tasks")
      .send({ title: "t".repeat(241) })
      .expect(422);
    await request(app).post("/api/tasks").send({ title: 42 }).expect(422);
    await request(app).post("/api/tasks").send({ title: "Valid", extra: true }).expect(422);
    await request(app).get("/api/tasks?view=inbox").expect(200).expect([created]);
  });

  it("moves, orders, edits, completes, reopens, and deletes tasks", async () => {
    const first = await createTask("Make a list");
    const second = await createTask("Pick up bread");
    await request(app).post(`/api/tasks/${first.id}/today`).expect(200);
    await request(app).post(`/api/tasks/${second.id}/today`).expect(200);

    const reordered = await request(app)
      .put("/api/tasks/today-order")
      .send({ ids: [second.id, first.id] })
      .expect(200);
    expect(reordered.body.map((task: Task) => task.id)).toEqual([second.id, first.id]);

    const invalidOrder = await request(app)
      .put("/api/tasks/today-order")
      .send({ ids: [first.id, first.id] })
      .expect(422);
    expect(invalidOrder.body.error.code).toBe("INVALID_INPUT");
    const stillOrdered = await request(app).get("/api/tasks?view=today").expect(200);
    expect(stillOrdered.body.map((task: Task) => task.id)).toEqual([second.id, first.id]);

    await request(app).delete(`/api/tasks/${second.id}/today`).expect(200);
    const afterMoveOut = await request(app).get("/api/tasks?view=today").expect(200);
    expect(afterMoveOut.body.map((task: Task) => task.id)).toEqual([first.id]);
    const inbox = await request(app).get("/api/tasks?view=inbox").expect(200);
    expect(inbox.body.map((task: Task) => task.id)).toContain(second.id);
    await request(app).post(`/api/tasks/${second.id}/today`).expect(200);
    await request(app)
      .put("/api/tasks/today-order")
      .send({ ids: [second.id, first.id] })
      .expect(200);

    const edited = await request(app)
      .patch(`/api/tasks/${first.id}`)
      .send({ title: "Make a better list" })
      .expect(200);
    expect(edited.body.title).toBe("Make a better list");

    const completed = await request(app).post(`/api/tasks/${first.id}/completion`).expect(200);
    expect(completed.body.status).toBe("completed");
    expect(completed.body.completedAt).toBeTruthy();
    await request(app).get("/api/tasks?view=completed").expect(200);

    const reopened = await request(app).delete(`/api/tasks/${first.id}/completion`).expect(200);
    expect(reopened.body.status).toBe("inbox");
    await request(app).delete(`/api/tasks/${first.id}`).expect(204);
    await request(app).get("/api/tasks?view=inbox").expect(200).expect([]);
  });

  it("returns consistent errors for invalid views, malformed JSON, and missing tasks", async () => {
    const invalidView = await request(app).get("/api/tasks?view=archive").expect(400);
    expect(invalidView.body.error.code).toBe("INVALID_QUERY");

    const malformed = await request(app)
      .post("/api/tasks")
      .set("content-type", "application/json")
      .send("{")
      .expect(400);
    expect(malformed.body.error.code).toBe("MALFORMED_JSON");

    const missing = await request(app)
      .patch("/api/tasks/00000000-0000-4000-8000-000000000000")
      .send({ title: "Update a missing task" })
      .expect(404);
    expect(missing.body.error.code).toBe("NOT_FOUND");
    expect(JSON.stringify(missing.body)).not.toContain("SQLITE");
  });

  it("keeps liveness independent and readiness dependent on database usability", async () => {
    await request(app).get("/healthz").expect(200, "ok");
    await request(app).get("/readyz").expect(200, "ok");
    store.close();
    await request(app).get("/healthz").expect(200, "ok");
    await request(app).get("/readyz").expect(503, "not ready");
  });
});
