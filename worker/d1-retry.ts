// Reads of D1 run again after an error that may pass, such as a lost connection or a reset of
// the object of the database, twice at most. Writes and batches run once, since a write that D1
// made before its answer got lost must not happen twice. The Worker reads D1 through this
// (worker/index.ts); the tests use an in-memory database without it.

import { retry } from "../shared/retry.ts";
import type { D1Database, D1PreparedStatement } from "./env.ts";

// The messages of D1 for failures that the documentation of D1 says to try again.
const PASSING = /network connection lost|reset|overloaded|internal error|timed? ?out|try again/i;

export function isPassingD1Error(error: unknown): boolean {
  return error instanceof Error && PASSING.test(error.message);
}

const READ_RETRY = { attempts: 3, firstDelayMs: 100, retryable: isPassingD1Error };

/** The database, with reads that run again after an error that may pass. */
export function readsAgainWhileBusy(db: D1Database): D1Database {
  // D1 runs a batch only of its own statements, so each wrapper keeps the one that it wraps.
  const originals = new WeakMap<D1PreparedStatement, D1PreparedStatement>();
  const wrap = (statement: D1PreparedStatement): D1PreparedStatement => {
    const wrapped: D1PreparedStatement = {
      bind: (...values) => wrap(statement.bind(...values)),
      first: <T,>() => retry(() => statement.first<T>(), READ_RETRY),
      all: <T,>() => retry(() => statement.all<T>(), READ_RETRY),
      run: () => statement.run(),
    };
    originals.set(wrapped, statement);
    return wrapped;
  };
  return {
    prepare: (query) => wrap(db.prepare(query)),
    batch: (statements) => db.batch(statements.map((statement) => originals.get(statement) ?? statement)),
  };
}
