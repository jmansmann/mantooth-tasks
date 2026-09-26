import type { FormEvent, RefObject } from "react";
import type { TaskView } from "../../src/shared/task.js";

export const TASK_VIEWS: Array<{ id: TaskView; label: string }> = [
  { id: "inbox", label: "Inbox" },
  { id: "today", label: "Today" },
  { id: "completed", label: "Completed" },
];

interface PlannerHeaderProps {
  view: TaskView;
  draft: string;
  saving: boolean;
  quickAddRef: RefObject<HTMLInputElement | null>;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onViewChange: (view: TaskView) => void;
}

export function PlannerHeader({
  view,
  draft,
  saving,
  quickAddRef,
  onDraftChange,
  onSubmit,
  onViewChange,
}: PlannerHeaderProps) {
  return (
    <>
      <header className="masthead">
        <p className="eyebrow">MANTOOTH · DAILY PLANNER</p>
        <h1>Make room for what matters.</h1>
        <p className="intro">A small place to gather your thoughts and choose what comes next.</p>
      </header>

      <form className="quick-add" onSubmit={onSubmit}>
        <label htmlFor="quick-add-title">Capture a task</label>
        <div className="quick-add-row">
          <input
            ref={quickAddRef}
            autoComplete="off"
            id="quick-add-title"
            maxLength={240}
            name="title"
            onChange={(event) => onDraftChange(event.currentTarget.value)}
            placeholder="Add a task to your inbox"
            value={draft}
          />
          <button className="primary-action" disabled={saving || !draft.trim()} type="submit">
            {saving ? "Adding…" : "Add task"}
          </button>
        </div>
      </form>

      <nav aria-label="Task views" className="view-nav">
        {TASK_VIEWS.map((item) => (
          <button
            key={item.id}
            aria-current={view === item.id ? "page" : undefined}
            onClick={() => onViewChange(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>
    </>
  );
}
