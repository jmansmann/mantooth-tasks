import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { Task, TaskView } from "../../src/shared/task.js";
import { TaskConflictError, TaskNotFoundError, TaskValidationError } from "./task-errors.js";
import type { TaskRepository } from "./task-service.js";

interface TaskRow {
  id: string;
  title: string;
  status: TaskView;
  today_position: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface Migration {
  version: number;
  sql: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 240),
        status TEXT NOT NULL CHECK (status IN ('inbox', 'today', 'completed')),
        today_position INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        CHECK (
          (status = 'inbox' AND today_position IS NULL AND completed_at IS NULL) OR
          (status = 'today' AND today_position IS NOT NULL AND completed_at IS NULL) OR
          (status = 'completed' AND today_position IS NULL AND completed_at IS NOT NULL)
        )
      );
      CREATE UNIQUE INDEX tasks_today_position_unique
        ON tasks(today_position) WHERE status = 'today';
      CREATE INDEX tasks_inbox_created ON tasks(created_at, id) WHERE status = 'inbox';
      CREATE INDEX tasks_completed_at ON tasks(completed_at, id) WHERE status = 'completed';
    `,
  },
];

export function createTaskStore(databasePath: string): TaskRepository {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  }

  const database = new Database(databasePath);
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  if (databasePath !== ":memory:") {
    database.pragma("journal_mode = WAL");
    database.pragma("synchronous = NORMAL");
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    database
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .map((row) => {
        return (row as { version: number }).version;
      }),
  );
  const maxKnownVersion = migrations.at(-1)?.version ?? 0;
  const maxAppliedVersion = Math.max(0, ...applied);
  if (maxAppliedVersion > maxKnownVersion) {
    database.close();
    throw new Error("Database schema is newer than this application supports.");
  }

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    const migrate = database.transaction(() => {
      database.exec(migration.sql);
      database
        .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
        .run(migration.version, new Date().toISOString());
    });
    migrate.immediate();
  }

  const selectTask = database.prepare("SELECT * FROM tasks WHERE id = ?");

  function requireTask(id: string): TaskRow {
    const row = selectTask.get(id) as TaskRow | undefined;
    if (!row) throw new TaskNotFoundError();
    return row;
  }

  function getTask(id: string): Task {
    return toTask(requireTask(id));
  }

  function compactToday(updatedAt: string) {
    const rows = database
      .prepare(
        "SELECT id, today_position FROM tasks WHERE status = 'today' ORDER BY today_position",
      )
      .all() as Array<{ id: string; today_position: number }>;
    if (rows.length === 0) return;

    const offset = Math.max(...rows.map((row) => row.today_position)) + 1;
    const shift = database.prepare(
      "UPDATE tasks SET today_position = ?, updated_at = ? WHERE id = ? AND status = 'today'",
    );
    rows.forEach((row) => {
      shift.run(row.today_position + offset, updatedAt, row.id);
    });

    const setPosition = database.prepare(
      "UPDATE tasks SET today_position = ?, updated_at = ? WHERE id = ? AND status = 'today'",
    );
    rows.forEach((row, position) => {
      setPosition.run(position, updatedAt, row.id);
    });
  }

  function assertCurrentStatus(row: TaskRow, status: TaskView, action: string) {
    if (row.status !== status) {
      throw new TaskConflictError(`Only ${status} tasks can be ${action}.`);
    }
  }

  return {
    create(title) {
      const now = new Date().toISOString();
      const id = randomUUID();
      database
        .prepare(
          "INSERT INTO tasks (id, title, status, created_at, updated_at) VALUES (?, ?, 'inbox', ?, ?)",
        )
        .run(id, title, now, now);
      return getTask(id);
    },

    list(view) {
      const order =
        view === "today"
          ? "today_position ASC"
          : view === "completed"
            ? "completed_at DESC, id ASC"
            : "created_at ASC, id ASC";
      const rows = database
        .prepare(`SELECT * FROM tasks WHERE status = ? ORDER BY ${order}`)
        .all(view) as TaskRow[];
      return rows.map(toTask);
    },

    updateTitle(id, title) {
      requireTask(id);
      database
        .prepare("UPDATE tasks SET title = ?, updated_at = ? WHERE id = ?")
        .run(title, new Date().toISOString(), id);
      return getTask(id);
    },

    moveToToday(id) {
      const move = database.transaction(() => {
        const task = requireTask(id);
        if (task.status === "today") return toTask(task);
        assertCurrentStatus(task, "inbox", "moved into Today");
        const nextPosition = database
          .prepare(
            "SELECT COALESCE(MAX(today_position) + 1, 0) AS position FROM tasks WHERE status = 'today'",
          )
          .get() as { position: number };
        database
          .prepare(
            "UPDATE tasks SET status = 'today', today_position = ?, updated_at = ? WHERE id = ?",
          )
          .run(nextPosition.position, new Date().toISOString(), id);
        return getTask(id);
      });
      return move.immediate();
    },

    moveToInbox(id) {
      const move = database.transaction(() => {
        const task = requireTask(id);
        if (task.status === "inbox") return toTask(task);
        assertCurrentStatus(task, "today", "moved back to Inbox");
        const now = new Date().toISOString();
        database
          .prepare(
            "UPDATE tasks SET status = 'inbox', today_position = NULL, updated_at = ? WHERE id = ?",
          )
          .run(now, id);
        compactToday(now);
        return getTask(id);
      });
      return move.immediate();
    },

    reorderToday(ids) {
      const reorder = database.transaction(() => {
        const currentIds = database
          .prepare("SELECT id FROM tasks WHERE status = 'today'")
          .all()
          .map((row) => (row as { id: string }).id);
        const requestedIds = new Set(ids);
        if (requestedIds.size !== ids.length || ids.length !== currentIds.length) {
          throw new TaskValidationError("Order must contain exactly the Today tasks.");
        }
        if (currentIds.some((id) => !requestedIds.has(id))) {
          throw new TaskValidationError("Order must contain exactly the Today tasks.");
        }

        const currentPositions = database
          .prepare("SELECT MAX(today_position) AS position FROM tasks WHERE status = 'today'")
          .get() as { position: number | null };
        const offset = (currentPositions.position ?? -1) + ids.length + 1;
        const shift = database.prepare(
          "UPDATE tasks SET today_position = today_position + ?, updated_at = ? WHERE id = ? AND status = 'today'",
        );
        const now = new Date().toISOString();
        currentIds.forEach((id) => {
          shift.run(offset, now, id);
        });

        const setPosition = database.prepare(
          "UPDATE tasks SET today_position = ?, updated_at = ? WHERE id = ? AND status = 'today'",
        );
        ids.forEach((id, position) => {
          setPosition.run(position, now, id);
        });
        return ids.map(getTask);
      });
      return reorder.immediate();
    },

    complete(id) {
      const complete = database.transaction(() => {
        const task = requireTask(id);
        if (task.status === "completed") return toTask(task);
        const now = new Date().toISOString();
        database
          .prepare(
            "UPDATE tasks SET status = 'completed', today_position = NULL, completed_at = ?, updated_at = ? WHERE id = ?",
          )
          .run(now, now, id);
        if (task.status === "today") compactToday(now);
        return getTask(id);
      });
      return complete.immediate();
    },

    reopen(id) {
      const reopen = database.transaction(() => {
        const task = requireTask(id);
        assertCurrentStatus(task, "completed", "reopened");
        database
          .prepare(
            "UPDATE tasks SET status = 'inbox', completed_at = NULL, updated_at = ? WHERE id = ?",
          )
          .run(new Date().toISOString(), id);
        return getTask(id);
      });
      return reopen.immediate();
    },

    remove(id) {
      const remove = database.transaction(() => {
        const task = requireTask(id);
        database.prepare("DELETE FROM tasks WHERE id = ?").run(id);
        if (task.status === "today") compactToday(new Date().toISOString());
      });
      remove.immediate();
    },

    isReady() {
      try {
        database.prepare("SELECT 1 FROM schema_migrations WHERE version = ?").get(maxKnownVersion);
        database.prepare("SELECT 1 FROM tasks LIMIT 1").get();
        return true;
      } catch {
        return false;
      }
    },

    close() {
      if (database.open) database.close();
    },
  };
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    position: row.today_position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}
