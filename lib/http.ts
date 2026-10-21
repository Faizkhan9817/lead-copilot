import { AIError } from "./ai";

// One place that turns any thrown error into a JSON response the UI can show.
export function errorResponse(err: unknown): Response {
  const message = err instanceof Error ? err.message : "Unexpected error";
  console.error("[api]", message);
  // AIError messages are written for users; other errors (DB etc.) are shown as-is so nothing fails silently.
  return Response.json({ error: message }, { status: err instanceof AIError ? 502 : 500 });
}
