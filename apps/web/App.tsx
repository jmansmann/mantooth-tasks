import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Task, TaskView } from "../../src/shared/task.js";
import { messageFor, request } from "./api.js";
import { DeleteTaskDialog } from "./DeleteTaskDialog.js";
import { PlannerHeader, TASK_VIEWS } from "./PlannerHeader.js";
import { TaskViewContent } from "./TaskViewContent.js";

export function App() {
  const [view, setView] = useState<TaskView>("inbox");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const quickAddRef = useRef<HTMLInputElement>(null);
  const viewHeadingRef = useRef<HTMLHeadingElement>(null);

  const loadTasks = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      setTasks([]);
      try {
        const result = await request<Task[]>(
          `/api/tasks?view=${view}`,
          signal ? { signal } : undefined,
        );
        if (!signal?.aborted) setTasks(result);
      } catch (reason) {
        if (!signal?.aborted) setError(messageFor(reason));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [view],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadTasks(controller.signal);
    return () => controller.abort();
  }, [loadTasks]);

  useEffect(() => {
    quickAddRef.current?.focus();
  }, []);

  const viewLabel = TASK_VIEWS.find((item) => item.id === view)?.label ?? "Inbox";

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.trim();
    if (!title || saving) return;
    setSaving(true);
    setError(null);
    setAnnouncement("");
    try {
      const created = await request<Task>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      setDraft("");
      if (view === "inbox") setTasks((current) => [...current, created]);
      setAnnouncement("Task added to Inbox.");
      quickAddRef.current?.focus();
    } catch (reason) {
      setError(messageFor(reason));
      quickAddRef.current?.focus();
    } finally {
      setSaving(false);
    }
  }

  async function saveTitle(event: FormEvent<HTMLFormElement>, task: Task) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await request<Task>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: editTitle }),
      });
      setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setEditingId(null);
      setAnnouncement("Task title updated.");
      quickAddRef.current?.focus();
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setSaving(false);
    }
  }

  async function changeTask(task: Task, path: string, method: "POST" | "DELETE", message: string) {
    setError(null);
    try {
      await request<Task>(path, { method });
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setAnnouncement(message);
      focusHeading();
    } catch (reason) {
      setError(messageFor(reason));
    }
  }

  async function reorder(taskIndex: number, direction: -1 | 1) {
    const targetIndex = taskIndex + direction;
    if (targetIndex < 0 || targetIndex >= tasks.length) return;
    const ordered = [...tasks];
    const moving = ordered[taskIndex];
    const displaced = ordered[targetIndex];
    if (!moving || !displaced) return;
    ordered[taskIndex] = displaced;
    ordered[targetIndex] = moving;
    setError(null);
    try {
      const updated = await request<Task[]>("/api/tasks/today-order", {
        method: "PUT",
        body: JSON.stringify({ ids: ordered.map((task) => task.id) }),
      });
      setTasks(updated);
      setAnnouncement("Today order updated.");
    } catch (reason) {
      setError(messageFor(reason));
    }
  }

  async function deleteTask() {
    if (!pendingDelete) return;
    const task = pendingDelete;
    setError(null);
    try {
      await request<void>(`/api/tasks/${task.id}`, { method: "DELETE" });
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setPendingDelete(null);
      setAnnouncement("Task deleted.");
      focusHeading();
    } catch (reason) {
      setError(messageFor(reason));
    }
  }

  function focusHeading() {
    window.requestAnimationFrame(() => viewHeadingRef.current?.focus());
  }

  return (
    <main className="planner">
      <PlannerHeader
        view={view}
        draft={draft}
        saving={saving}
        quickAddRef={quickAddRef}
        onDraftChange={setDraft}
        onSubmit={submitTask}
        onViewChange={setView}
      />

      <section aria-labelledby="view-title" aria-busy={loading} className="task-view">
        <div className="section-heading">
          <div>
            <p className="section-kicker">YOUR TASKS</p>
            <h2 id="view-title" ref={viewHeadingRef} tabIndex={-1}>
              {viewLabel}
            </h2>
          </div>
          {!loading && <span className="task-count">{tasks.length}</span>}
        </div>

        <TaskViewContent
          view={view}
          tasks={tasks}
          loading={loading}
          error={pendingDelete ? null : error}
          editingId={editingId}
          editTitle={editTitle}
          saving={saving}
          setEditTitle={setEditTitle}
          onRetry={() => void loadTasks()}
          onChangeTask={changeTask}
          onCancelEdit={() => setEditingId(null)}
          onDelete={setPendingDelete}
          onEdit={(selected) => {
            setEditingId(selected.id);
            setEditTitle(selected.title);
          }}
          onReorder={reorder}
          onSaveTitle={saveTitle}
        />
        <p className="visually-hidden" aria-live="polite">
          {announcement}
        </p>
      </section>

      <DeleteTaskDialog
        task={pendingDelete}
        error={pendingDelete ? error : null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={deleteTask}
      />
    </main>
  );
}
