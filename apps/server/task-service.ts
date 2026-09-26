import { MAX_TITLE_LENGTH, type Task, type TaskView } from "../../src/shared/task.js";
import { TaskValidationError } from "./task-errors.js";

export interface TaskRepository {
  create(title: string): Task;
  list(view: TaskView): Task[];
  updateTitle(id: string, title: string): Task;
  moveToToday(id: string): Task;
  moveToInbox(id: string): Task;
  reorderToday(ids: string[]): Task[];
  complete(id: string): Task;
  reopen(id: string): Task;
  remove(id: string): void;
  isReady(): boolean;
  close(): void;
}

export function createTaskService(repository: TaskRepository) {
  return {
    create(title: unknown) {
      return repository.create(normalizeTitle(title));
    },

    list(view: TaskView) {
      return repository.list(view);
    },

    updateTitle(id: string, title: unknown) {
      return repository.updateTitle(id, normalizeTitle(title));
    },

    moveToToday(id: string) {
      return repository.moveToToday(id);
    },

    moveToInbox(id: string) {
      return repository.moveToInbox(id);
    },

    reorderToday(ids: string[]) {
      return repository.reorderToday(ids);
    },

    complete(id: string) {
      return repository.complete(id);
    },

    reopen(id: string) {
      return repository.reopen(id);
    },

    remove(id: string) {
      repository.remove(id);
    },

    isReady() {
      return repository.isReady();
    },

    close() {
      repository.close();
    },
  };
}

function normalizeTitle(value: unknown): string {
  if (typeof value !== "string") {
    throw new TaskValidationError("Task title must be text.");
  }

  const title = value.trim();
  if (title.length === 0) {
    throw new TaskValidationError("Task title cannot be empty.");
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new TaskValidationError(`Task title cannot exceed ${MAX_TITLE_LENGTH} characters.`);
  }
  return title;
}
