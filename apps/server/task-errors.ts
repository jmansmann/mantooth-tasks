export class TaskNotFoundError extends Error {
  constructor() {
    super("Task not found.");
    this.name = "TaskNotFoundError";
  }
}

export class TaskConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskConflictError";
  }
}

export class TaskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskValidationError";
  }
}
