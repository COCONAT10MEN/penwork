import type { WorkerOps } from "./worker";

/**
 * Runs a PDF tool in the worker. One worker for the whole app, started the first time a tool is
 * used, so opening a PDF costs nothing extra.
 */

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  progress?: (done: number, total: number) => void;
};

let worker: Worker | null = null;
const pending = new Map<number, Pending>();
let nextId = 1;

function start(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (
    e: MessageEvent<{ id: number; result?: unknown; error?: string; progress?: [number, number] }>,
  ) => {
    const job = pending.get(e.data.id);
    if (!job) return;
    if (e.data.progress) {
      job.progress?.(...e.data.progress);
      return;
    }
    pending.delete(e.data.id);
    if (e.data.error !== undefined) job.reject(new Error(e.data.error));
    else job.resolve(e.data.result);
  };
  return worker;
}

type Args<K extends keyof WorkerOps> = WorkerOps[K] extends (...a: infer A) => unknown
  ? A extends [...infer Head, (done: number, total: number) => void]
    ? Head
    : A
  : never;
type Result<K extends keyof WorkerOps> = WorkerOps[K] extends (...a: never[]) => infer R
  ? Awaited<R>
  : never;

export function runTool<K extends keyof WorkerOps>(
  op: K,
  args: Args<K>,
  progress?: (done: number, total: number) => void,
): Promise<Result<K>> {
  const w = start();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, progress });
    w.postMessage({ id, op, args });
  });
}
