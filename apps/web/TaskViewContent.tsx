import type { FormEvent } from "react";
import type { Task, TaskView } from "../../src/shared/task.js";
import { TaskRow } from "./TaskRow.js";

const emptyStates: Record<TaskView, { title: string; description: string; mark: string }> = {
  inbox: {
    title: "Your inbox is clear.",
    description: "Capture anything you don’t want to forget above.",
    mark: "+",
  },
  today: {
    title: "Your day is open.",
    description: "Move an inbox task to Today when you’re ready.",
    mark: "—",
  },
  completed: {
    title: "No completed tasks yet.",
    description: "Finished tasks will collect here.",
    mark: "✓",
  },
};

interface TaskViewContentProps {
  view: TaskView;
  tasks: Task[];
  loading: boolean;
  error: string | null;
  editingId: string | null;
  editTitle: string;
  saving: boolean;
  setEditTitle: (value: string) => void;
  onRetry: () => void;
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

export function TaskViewContent({
  view,
  tasks,
  loading,
  error,
  editingId,
  editTitle,
  saving,
  setEditTitle,
  onRetry,
  onChangeTask,
  onCancelEdit,
  onDelete,
  onEdit,
  onReorder,
  onSaveTitle,
}: TaskViewContentProps) {
  const List = view === "today" ? "ol" : "ul";
  const emptyState = emptyStates[view];

  return (
    <>
      {error && (
        <div className="error-message" role="alert">
          <p>{error}</p>
          <button onClick={onRetry} type="button">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p className="loading-state" role="status">
          Loading tasks…
        </p>
      ) : tasks.length > 0 ? (
        <List className="task-list">
          {tasks.map((task, index) => (
            <TaskRow
              key={task.id}
              task={task}
              view={view}
              index={index}
              total={tasks.length}
              editing={editingId === task.id}
              editTitle={editTitle}
              saving={saving}
              setEditTitle={setEditTitle}
              onChangeTask={onChangeTask}
              onCancelEdit={onCancelEdit}
              onDelete={onDelete}
              onEdit={onEdit}
              onReorder={onReorder}
              onSaveTitle={onSaveTitle}
            />
          ))}
        </List>
      ) : error ? null : (
        <div className="empty-state" role="status">
          <span aria-hidden="true" className="empty-mark">
            {emptyState.mark}
          </span>
          <h3>{emptyState.title}</h3>
          <p>{emptyState.description}</p>
        </div>
      )}
    </>
  );
}
