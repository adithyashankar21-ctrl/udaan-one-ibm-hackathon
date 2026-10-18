/**
 * Runs Python code in the browser with Pyodide (CPython compiled to WebAssembly) inside a
 * Web Worker, so a slow or endless loop can be stopped without freezing the page.
 * Nothing is sent to the server. Pyodide (~10 MB) is downloaded only on the first run.
 */

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
const TIMEOUT_MS = 10000;

const WORKER_SOURCE = `
importScripts('${PYODIDE_URL}pyodide.js');
let ready = loadPyodide({ indexURL: '${PYODIDE_URL}' });
self.onmessage = async (e) => {
  const { id, code } = e.data;
  const out = [];
  try {
    const py = await ready;
    py.setStdout({ batched: (s) => out.push(s) });
    py.setStderr({ batched: (s) => out.push(s) });
    await py.loadPackagesFromImports(code);
    const result = await py.runPythonAsync(code);
    if (result !== undefined && result !== null && out.length === 0) out.push(String(result));
    self.postMessage({ id, ok: true, output: out.join('\\n') });
  } catch (err) {
    const msg = String(err && err.message || err);
    // Keep only the useful end of a Python traceback
    const lines = msg.split('\\n').filter((l) => !l.includes('/lib/python') && !l.includes('_pyodide'));
    self.postMessage({ id, ok: false, output: out.join('\\n'), error: lines.join('\\n').trim() });
  }
};
`;

export interface RunResult {
  ok: boolean;
  output: string;
  error?: string;
  timedOut?: boolean;
}

let worker: Worker | null = null;
let warmed = false;
let seq = 0;

function getWorker() {
  if (!worker) {
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    worker = new Worker(url);
  }
  return worker;
}

/** True once Python has loaded at least once in this tab (later runs are instant). */
export const pythonWarm = () => warmed;

export function runPython(code: string): Promise<RunResult> {
  const w = getWorker();
  const id = ++seq;
  return new Promise((resolve) => {
    // The first run includes downloading Python itself, so allow it longer
    const limit = warmed ? TIMEOUT_MS : TIMEOUT_MS + 50000;
    const timer = setTimeout(() => {
      w.terminate();
      worker = null;
      warmed = false;
      resolve({ ok: false, output: '', timedOut: true, error: `Stopped after ${Math.round(limit / 1000)} seconds — check for a loop that never ends.` });
    }, limit);
    const onMessage = (e: MessageEvent) => {
      if (e.data?.id !== id) return;
      clearTimeout(timer);
      w.removeEventListener('message', onMessage);
      warmed = true;
      resolve({ ok: e.data.ok, output: e.data.output || '', error: e.data.error });
    };
    w.addEventListener('message', onMessage);
    w.addEventListener(
      'error',
      () => {
        clearTimeout(timer);
        worker = null;
        resolve({ ok: false, output: '', error: 'Python could not load. Check your internet connection and try again.' });
      },
      { once: true }
    );
    w.postMessage({ id, code });
  });
}
