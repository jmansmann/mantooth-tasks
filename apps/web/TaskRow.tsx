import { useEffect, useRef } from "react";
import type { FormEvent } from "react";
import type { Task, TaskView } from "../../src/shared/task.js";

export interface TaskRowProps {
  task: Task;
  view: TaskView;
  index: number;
  total: number;
  editing: boolean;
  editTitle: string;
  saving: boolean;
  setEditTitle: (value: string) => void;
  onChangeTask: (
    task: Task,
    path: string,
    method: "POST" | "DELETE",
    announcement: string,
  ) => Promise<void>;
  onCancelEdit: () => void;
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onReorder: (index: number, direction: -1 | 1) => Promise<void>;
  onSaveTitle: (event: FormEvent<HTMLFormElement>, task: Task) => Promise<void>;
}

export function TaskRow({
  task,
  view,
  index,
  total,
  editing,
  editTitle,
  saving,
  setEditTitle,
  onChangeTask,
  onCancelEdit,
  onDelete,
  onEdit,
  onReorder,
  onSaveTitle,
}: TaskRowProps) {
  const editInputRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (editing) editInputRef.current?.focus();
  }, [editing]);

  function cancelEdit() {
    onCancelEdit();
    window.requestAnimationFrame(() => editButtonRef.current?.focus());
  }

  return (
    <li className="task-row">
      <div className="task-row-content">
        {view !== "completed" ? (
          <input
            aria-label={`Complete task: ${task.title}`}
            checked={false}
            className="task-checkbox"
            onChange={() =>
              void onChangeTask(task, `/api/tasks/${task.id}/completion`, "POST", "Task completed.")
            }
            type="checkbox"
          />
        ) : (
          <span aria-hidden="true" className="completed-mark">
            ✓
          </span>
        )}

        <div className="task-copy">
          {editing ? (
            <form className="edit-form" onSubmit={(event) => void onSaveTitle(event, task)}>
              <label className="visually-hidden" htmlFor={`edit-${task.id}`}>
                Edit task title
              </label>
              <input
                ref={editInputRef}
                id={`edit-${task.id}`}
                maxLength={240}
                onChange={(event) => setEditTitle(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") cancelEdit();
                }}
                value={editTitle}
              />
              <button disabled={saving || !editTitle.trim()} type="submit">
                Save title
              </button>
              <button onClick={cancelEdit} type="button">
                Cancel
              </button>
            </form>
          ) : (
            <>
              <span className={view === "completed" ? "task-title is-complete" : "task-title"}>
                {task.title}
              </span>
              {task.completedAt && (
                <time className="completed-date" dateTime={task.completedAt}>
                  Completed{" "}
                  {new Date(task.completedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              )}
            </>
          )}
        </div>
      </div>

      {!editing && (
        <div className="task-actions">
          {view === "inbox" && (
            <button
              aria-label={`Move to Today: ${task.title}`}
              className="subtle-action"
              onClick={() =>
                void onChangeTask(task, `/api/tasks/${task.id}/today`, "POST", "Moved to Today.")
              }
              type="button"
            >
              Today
            </button>
          )}
          {view === "today" && (
            <>
              <button
                aria-label={`Move up: ${task.title}`}
                disabled={index === 0}
                onClick={() => void onReorder(index, -1)}
                type="button"
              >
                ↑
              </button>
              <button
                aria-label={`Move down: ${task.title}`}
                disabled={index === total - 1}
                onClick={() => void onReorder(index, 1)}
                type="button"
              >
                ↓
              </button>
              <button
                aria-label={`Move to Inbox: ${task.title}`}
                className="subtle-action"
                onClick={() =>
                  void onChangeTask(
                    task,
                    `/api/tasks/${task.id}/today`,
                    "DELETE",
                    "Moved to Inbox.",
                  )
                }
                type="button"
              >
                Inbox
              </button>
            </>
          )}
          {view === "completed" && (
            <button
              aria-label={`Reopen task: ${task.title}`}
              className="subtle-action"
              onClick={() =>
                void onChangeTask(
                  task,
                  `/api/tasks/${task.id}/completion`,
                  "DELETE",
                  "Task reopened in Inbox.",
                )
              }
              type="button"
            >
              Reopen
            </button>
          )}
          <button
            aria-label={`Edit task: ${task.title}`}
            className="subtle-action"
            ref={editButtonRef}
            onClick={() => onEdit(task)}
            type="button"
          >
            Edit
          </button>
          <button
            aria-label={`Delete task: ${task.title}`}
            className="delete-action"
            onClick={() => onDelete(task)}
            type="button"
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}
