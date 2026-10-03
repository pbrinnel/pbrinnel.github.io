// A pool of workers (worker.js) that runs seeds in parallel, one per CPU core less one
// for the page, queueing the rest.
//
//   const pool = LAB.Pool({ v, size })
//   pool.run({ texts, seed, days, bunnyCap, progressEvery }, onProgress) → Promise<result>
//   pool.cancelAll()       queued jobs resolve with endReason 'canceled'; running ones stop
//                          at their next day
//   pool.size, pool.busy, pool.queued
(function (root) {
  'use strict';
  const LAB = root.LAB = root.LAB || {};

  // Leave a core for the page so the UI stays responsive while seeds run.
  const DEFAULT_SIZE = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));

  LAB.Pool = function (opts) {
    const size = opts.size || DEFAULT_SIZE;
    const workers = [];   // { w, ready: Promise, job: null | { id, resolve, onProgress } }
    const queue = [];
    let nextId = 1;

    function spawn() {
      const w = new Worker(`worker.js?v=${opts.v}`);
      const slot = { w, job: null };
      slot.ready = new Promise(res => {
        w.onmessage = e => {
          const m = e.data;
          if (m.type === 'ready') return res();
          if (!slot.job || m.id !== slot.job.id) return;
          if (m.type === 'progress') { if (slot.job.onProgress) slot.job.onProgress(m); }
          else if (m.type === 'done') { const j = slot.job; slot.job = null; j.resolve(m.result); pump(); }
        };
      });
      w.onerror = e => {
        const j = slot.job;
        slot.job = null;
        if (j) j.resolve({ endReason: 'error', error: e.message || 'worker failed' });
        pump();
      };
      w.postMessage({ type: 'init', v: opts.v });
      workers.push(slot);
      return slot;
    }

    function pump() {
      while (queue.length) {
        let slot = workers.find(s => !s.job);
        if (!slot && workers.length < size) slot = spawn();
        if (!slot) return;
        const job = queue.shift();
        slot.job = job;
        slot.ready.then(() => slot.w.postMessage(Object.assign({ type: 'run', id: job.id }, job.msg)));
      }
    }

    return {
      size,
      get busy() { return workers.filter(s => s.job).length; },
      get queued() { return queue.length; },
      run(msg, onProgress) {
        return new Promise(resolve => {
          queue.push({ id: nextId++, msg, resolve, onProgress });
          pump();
        });
      },
      cancelAll() {
        while (queue.length) queue.shift().resolve({ endReason: 'canceled' });
        for (const s of workers) if (s.job) s.w.postMessage({ type: 'cancel', id: s.job.id });
      },
    };
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
