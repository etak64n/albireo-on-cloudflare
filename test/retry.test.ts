import { afterEach, describe, expect, it, vi } from "vitest";
import { isPassingStatus, retry } from "../shared/retry.ts";
import { fetchAccessIdentity } from "../worker/access.ts";
import { readsAgainWhileBusy } from "../worker/d1-retry.ts";
import type { D1Database, D1PreparedStatement, D1Result } from "../worker/env.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("retry", () => {
  it("runs an action again after a failure that may pass, waiting twice as long each time", async () => {
    const waits: number[] = [];
    let attempts = 0;
    const result = await retry(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error("busy");
        return "done";
      },
      { attempts: 3, firstDelayMs: 100, retryable: () => true, wait: async (ms) => void waits.push(ms) },
    );
    expect(result).toBe("done");
    expect(waits).toEqual([100, 200]);
  });

  it("stops at a failure that cannot pass, and after the last attempt", async () => {
    let attempts = 0;
    const failing = () =>
      retry(
        async () => {
          attempts += 1;
          throw new Error(attempts === 1 ? "busy" : "gone");
        },
        { attempts: 3, firstDelayMs: 1, retryable: (error) => error instanceof Error && error.message === "busy", wait: async () => undefined },
      );
    await expect(failing()).rejects.toThrow("gone");
    expect(attempts).toBe(2);
  });

  it("counts 429 and the failures of a server as passing, and the mistakes of a request as not", () => {
    expect([429, 500, 502, 503, 504].every(isPassingStatus)).toBe(true);
    expect([400, 401, 403, 404, 409, 501].some(isPassingStatus)).toBe(false);
  });
});

/** A database whose reads fail with the given errors before they answer. */
function flakyDatabase(failures: string[]) {
  const runs: string[] = [];
  const batches: D1PreparedStatement[][] = [];
  const created: D1PreparedStatement[] = [];
  const statement = (query: string): D1PreparedStatement => {
    const made: D1PreparedStatement = {
    bind: () => statement(query),
    first: async <T,>() => {
      const failure = failures.shift();
      if (failure !== undefined) throw new Error(failure);
      return { query } as T;
    },
    all: async <T,>() => {
      const failure = failures.shift();
      if (failure !== undefined) throw new Error(failure);
      return { results: [{ query } as T], meta: {} } as D1Result<T>;
    },
    run: async () => {
      runs.push(query);
      const failure = failures.shift();
      if (failure !== undefined) throw new Error(failure);
      return { results: [], meta: { changes: 1 } };
    },
    };
    created.push(made);
    return made;
  };
  const db: D1Database = {
    prepare: (query) => statement(query),
    batch: async (statements) => {
      batches.push(statements);
      return [];
    },
  };
  return { db, runs, batches, created };
}

describe("readsAgainWhileBusy", () => {
  it("reads again after an error that D1 says may pass", async () => {
    const { db } = flakyDatabase(["D1_ERROR: Network connection lost."]);
    const reads = readsAgainWhileBusy(db);
    await expect(reads.prepare("SELECT 1").bind().all()).resolves.toMatchObject({ results: [{ query: "SELECT 1" }] });
  });

  it("stops at an error in the query, and runs a write once", async () => {
    const reads = readsAgainWhileBusy(flakyDatabase(["D1_ERROR: no such column: titel"]).db);
    await expect(reads.prepare("SELECT titel").first()).rejects.toThrow("no such column");

    const writes = flakyDatabase(["D1_ERROR: Network connection lost."]);
    await expect(readsAgainWhileBusy(writes.db).prepare("INSERT").run()).rejects.toThrow("Network connection lost");
    expect(writes.runs).toEqual(["INSERT"]);
  });

  it("hands D1 its own statements in a batch", async () => {
    const { db, batches, created } = flakyDatabase([]);
    const reads = readsAgainWhileBusy(db);
    const wrappers = [reads.prepare("DELETE FROM a").bind("x"), reads.prepare("DELETE FROM b")];
    await reads.batch(wrappers);
    const handed = batches[0] ?? [];
    expect(handed).toHaveLength(2);
    expect(handed.every((statement) => created.includes(statement))).toBe(true);
    expect(handed.some((statement) => wrappers.includes(statement))).toBe(false);
  });
});

describe("fetchAccessIdentity", () => {
  it("asks Access again after a busy answer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ idp: { type: "onetimepin" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchAccessIdentity("https://team.cloudflareaccess.com", "token")).resolves.toEqual({ idp: { type: "onetimepin" } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not ask again after a refusal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchAccessIdentity("https://team.cloudflareaccess.com", "token")).rejects.toThrow("answered 403");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
