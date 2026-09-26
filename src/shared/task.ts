export const MAX_TITLE_LENGTH = 240;

export type TaskView = "inbox" | "today" | "completed";

export interface Task {
  id: string;
  title: string;
  status: TaskView;
  position: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface TaskErrorBody {
  error: {
    code: string;
    message: string;
  };
}
