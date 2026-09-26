import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { z, ZodError } from "zod";
import { MAX_TITLE_LENGTH } from "../../src/shared/task.js";
import { TaskConflictError, TaskNotFoundError, TaskValidationError } from "./task-errors.js";
import { createTaskService, type TaskRepository } from "./task-service.js";

const taskViewSchema = z.enum(["inbox", "today", "completed"]);
const taskIdSchema = z.string().uuid();
const titleSchema = z.string().trim().min(1).max(MAX_TITLE_LENGTH);
const createTaskSchema = z.object({ title: titleSchema }).strict();
const updateTaskSchema = z.object({ title: titleSchema }).strict();
const reorderSchema = z.object({ ids: z.array(taskIdSchema).max(2000) }).strict();

export function createApplication(repository: TaskRepository, webRoot?: string) {
  const app = express();
  const tasks = createTaskService(repository);

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "128kb", strict: true }));

  app.get("/healthz", (_request, response) => response.status(200).send("ok"));
  app.get("/readyz", (_request, response) => {
    if (!tasks.isReady()) return response.status(503).send("not ready");
    return response.status(200).send("ok");
  });

  app.get("/api/tasks", (request, response) => {
    const view = taskViewSchema.safeParse(request.query.view);
    if (!view.success) {
      return sendError(response, 400, "INVALID_QUERY", "Choose inbox, today, or completed.");
    }
    return response.json(tasks.list(view.data));
  });

  app.post("/api/tasks", (request, response) => {
    const input = createTaskSchema.safeParse(request.body);
    if (!input.success) {
      return sendError(response, 422, "INVALID_INPUT", "Enter a task title up to 240 characters.");
    }
    return response.status(201).json(tasks.create(input.data.title));
  });

  app.patch("/api/tasks/:id", (request, response) => {
    const id = parseId(request.params.id);
    if (!id) return sendError(response, 400, "INVALID_ID", "Task ID must be a UUID.");
    const input = updateTaskSchema.safeParse(request.body);
    if (!input.success) {
      return sendError(response, 422, "INVALID_INPUT", "Enter a task title up to 240 characters.");
    }
    return response.json(tasks.updateTitle(id, input.data.title));
  });

  app.post("/api/tasks/:id/today", (request, response) => {
    const id = parseId(request.params.id);
    if (!id) return sendError(response, 400, "INVALID_ID", "Task ID must be a UUID.");
    return response.json(tasks.moveToToday(id));
  });

  app.delete("/api/tasks/:id/today", (request, response) => {
    const id = parseId(request.params.id);
    if (!id) return sendError(response, 400, "INVALID_ID", "Task ID must be a UUID.");
    return response.json(tasks.moveToInbox(id));
  });

  app.put("/api/tasks/today-order", (request, response) => {
    const input = reorderSchema.safeParse(request.body);
    if (!input.success) {
      return sendError(response, 422, "INVALID_INPUT", "Provide the ordered Today task IDs.");
    }
    return response.json(tasks.reorderToday(input.data.ids));
  });

  app.post("/api/tasks/:id/completion", (request, response) => {
    const id = parseId(request.params.id);
    if (!id) return sendError(response, 400, "INVALID_ID", "Task ID must be a UUID.");
    return response.json(tasks.complete(id));
  });

  app.delete("/api/tasks/:id/completion", (request, response) => {
    const id = parseId(request.params.id);
    if (!id) return sendError(response, 400, "INVALID_ID", "Task ID must be a UUID.");
    return response.json(tasks.reopen(id));
  });

  app.delete("/api/tasks/:id", (request, response) => {
    const id = parseId(request.params.id);
    if (!id) return sendError(response, 400, "INVALID_ID", "Task ID must be a UUID.");
    tasks.remove(id);
    return response.status(204).end();
  });

  if (webRoot) {
    app.use(express.static(webRoot, { index: false, maxAge: "1y", immutable: true }));
    app.get("/", (_request, response) => response.sendFile(`${webRoot}/index.html`));
  }

  app.use("/api", (_request, response) =>
    sendError(response, 404, "NOT_FOUND", "API route not found."),
  );
  app.use((_request, response) => response.status(404).send("Not found"));

  const errors: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (error instanceof TaskNotFoundError) {
      return sendError(response, 404, "NOT_FOUND", error.message);
    }
    if (error instanceof TaskConflictError) {
      return sendError(response, 409, "CONFLICT", error.message);
    }
    if (error instanceof TaskValidationError || error instanceof ZodError) {
      return sendError(response, 422, "INVALID_INPUT", "The task request is not valid.");
    }

    const requestError = error as { status?: number; type?: string };
    if (requestError.type === "entity.parse.failed") {
      return sendError(response, 400, "MALFORMED_JSON", "Request body must be valid JSON.");
    }
    if (requestError.status === 413) {
      return sendError(response, 413, "REQUEST_TOO_LARGE", "Request body is too large.");
    }

    console.error(JSON.stringify({ event: "request.failed", error: describeError(error) }));
    return sendError(response, 500, "INTERNAL_ERROR", "The request could not be completed.");
  };
  app.use(errors);

  return app;
}

function parseId(value: string | string[] | undefined): string | null {
  const result = taskIdSchema.safeParse(value);
  return result.success ? result.data : null;
}

function sendError(response: express.Response, status: number, code: string, message: string) {
  return response.status(status).json({ error: { code, message } });
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
