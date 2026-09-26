export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers });
  if (response.status === 204) return undefined as T;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (response.ok) throw new Error("The server returned an unreadable response.");
  }

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "object" &&
      body.error !== null &&
      "message" in body.error &&
      typeof body.error.message === "string"
        ? body.error.message
        : "The request could not be completed. Please try again.";
    throw new Error(message);
  }
  return body as T;
}

export function messageFor(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : "Something went wrong. Your changes are still here; please try again.";
}
