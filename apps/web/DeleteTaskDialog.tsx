import { useEffect, useRef } from "react";
import type { Task } from "../../src/shared/task.js";

interface DeleteTaskDialogProps {
  task: Task | null;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteTaskDialog({ task, error, onCancel, onConfirm }: DeleteTaskDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (task && !dialog.open) dialog.showModal();
    if (!task && dialog.open) dialog.close();
  }, [task]);

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby="delete-title"
      className="delete-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClose={onCancel}
    >
      <p className="section-kicker">PLEASE CONFIRM</p>
      <h2 id="delete-title">Delete this task?</h2>
      <p className="dialog-copy">
        “{task?.title}” will be removed permanently. This can’t be undone.
      </p>
      {error && (
        <p className="dialog-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button onClick={onCancel} type="button">
          Keep task
        </button>
        <button className="danger-action" onClick={onConfirm} type="button">
          Delete task
        </button>
      </div>
    </dialog>
  );
}
