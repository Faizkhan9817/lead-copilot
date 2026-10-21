import { useState } from "react";
import type { Lead } from "@/lib/schemas";

// Small shared display pieces, so badges look the same everywhere.

const TAG_STYLES = {
  hot: "bg-red-100 text-red-700 ring-red-200",
  warm: "bg-amber-100 text-amber-800 ring-amber-200",
  cold: "bg-blue-100 text-blue-700 ring-blue-200",
};

export function TagBadge({ tag }: { tag: Lead["tag"] }) {
  if (!tag) return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Not analyzed</span>;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ring-1 ${TAG_STYLES[tag]}`}>{tag}</span>
  );
}

export function ScoreBadge({ score, tag }: { score: number | null; tag: Lead["tag"] }) {
  if (score === null) return null;
  const color = tag ? TAG_STYLES[tag] : "bg-gray-100 text-gray-600 ring-gray-200";
  return (
    <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1 ${color}`}>
      {score}
    </span>
  );
}

export function UrgencyFlag({ urgency }: { urgency: Lead["urgency"] }) {
  if (urgency !== "high") return null; // only flag what needs attention; medium/low would be noise
  return <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Urgent</span>;
}

export function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {children}
    </section>
  );
}

export function Bullets({ items, empty = "None" }: { items: string[]; empty?: string }) {
  if (items.length === 0) return <p className="text-sm text-gray-400">{empty}</p>;
  return (
    <ul className="space-y-1 text-sm">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-gray-400">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>;
}

// fetch wrapper: parses JSON and throws the server's error message, so callers just catch and display it.
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

// Runs an async action with a loading flag and an error message, the pattern every AI button needs.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="mt-2 text-xs font-medium text-gray-600 hover:text-gray-900"
    >
      {copied ? "Copied ✓" : "Copy to clipboard"}
    </button>
  );
}

export function Button({ children, primary, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  const style = primary
    ? "bg-gray-900 font-medium text-white hover:bg-gray-700"
    : "border border-gray-300 bg-white hover:bg-gray-50";
  return (
    <button {...props} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm disabled:opacity-50 ${style} ${props.className ?? ""}`}>
      {children}
    </button>
  );
}

export function formatDate(iso: string): string {
  return new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
