import { describe, expect, it } from "vitest";
import { missingPermissionsMessage, missingStoragePermissions, type Send } from "../stack/storage-check.ts";
import { StorageError } from "../worker/storage.ts";
import { MemoryObjectStore } from "./support/object-store.ts";

/** A bucket behind the signed URLs of a MemoryObjectStore, which may refuse PUTs or GETs. */
function signedUrls(store: MemoryObjectStore, refuse: { put?: boolean; get?: boolean } = {}) {
  const bodies = new Map<string, string>();
  const calls: string[] = [];
  const send: Send = async (url, init) => {
    const key = new URL(url).pathname.slice(1);
    calls.push(`${init.method ?? "GET"} ${key}`);
    if (init.method === "PUT") {
      if (refuse.put === true) return new Response("<Error><Code>AccessDenied</Code></Error>", { status: 403 });
      const body = String(init.body);
      bodies.set(key, body);
      store.objects.set(key, { size: body.length });
      return new Response(null, { status: 200 });
    }
    if (refuse.get === true) return new Response(null, { status: 403 });
    const body = store.objects.has(key) ? bodies.get(key) : undefined;
    return body === undefined ? new Response(null, { status: 404 }) : new Response(body);
  };
  return { send, calls };
}

describe("missingStoragePermissions", () => {
  it("finds nothing missing when the key may do everything, and leaves nothing in the bucket", async () => {
    const store = new MemoryObjectStore();
    const { send, calls } = signedUrls(store);
    expect(await missingStoragePermissions(store, send, "check-1")).toEqual([]);
    expect(calls).toEqual(["PUT albireo-check/check-1", "GET albireo-check/check-1"]);
    expect(store.deletedKeys).toEqual(["albireo-check/check-1-none", "albireo-check/check-1"]);
    expect(store.objects.size).toBe(0);
    expect([...store.uploads.values()].map((upload) => [upload.key, upload.state])).toEqual([["albireo-check/check-1-parts", "aborted"]]);
  });

  it("stops at a key that may not delete, before it writes anything that it could not remove", async () => {
    const store = new MemoryObjectStore();
    store.failDeletionOf = "albireo-check/check-1-none";
    const { send, calls } = signedUrls(store);
    expect(await missingStoragePermissions(store, send, "check-1")).toEqual([
      { permission: "delete objects", reason: "DeleteObject failed with HTTP 403 (AccessDenied: Access Denied)." },
    ]);
    expect(calls).toEqual([]);
    expect(store.uploads.size).toBe(0);
  });

  it("names a key that may not write, and still checks the uploads in parts", async () => {
    const store = new MemoryObjectStore();
    const { send, calls } = signedUrls(store, { put: true });
    expect(await missingStoragePermissions(store, send, "check-1")).toEqual([
      { permission: "write objects", reason: "A PUT to a signed URL failed with HTTP 403." },
    ]);
    expect(calls).toEqual(["PUT albireo-check/check-1"]);
    expect(store.uploads.size).toBe(1);
  });

  it("names a key that may not read or start uploads in parts", async () => {
    const store = new MemoryObjectStore();
    store.createMultipartUpload = async () => {
      throw new StorageError("CreateMultipartUpload failed with HTTP 403 (AccessDenied: Access Denied).");
    };
    const { send } = signedUrls(store, { get: true });
    const missing = await missingStoragePermissions(store, send, "check-1");
    expect(missing.map((item) => item.permission)).toEqual(["read objects", "upload videos in parts"]);
    // The object of the check goes, though the key could not read it back.
    expect(store.objects.size).toBe(0);
  });
});

describe("missingPermissionsMessage", () => {
  it("asks for every missing permission in one sentence, with what the bucket answered", () => {
    expect(
      missingPermissionsMessage("albireo-videos", [
        { permission: "delete objects", reason: "DeleteObject failed with HTTP 403 (AccessDenied: Access Denied)." },
      ]),
    ).toBe(
      "Please give the access key in .env.production permission to delete objects in the bucket albireo-videos, then deploy again. "
        + "The deploy stopped before it changed anything.\n"
        + "  delete objects: DeleteObject failed with HTTP 403 (AccessDenied: Access Denied).",
    );
    const message = missingPermissionsMessage("albireo-videos", [
      { permission: "write objects", reason: "A" },
      { permission: "read objects", reason: "B" },
      { permission: "upload videos in parts", reason: "C" },
    ]);
    expect(message.split("\n")[0]).toContain("permission to write objects, read objects and upload videos in parts in the bucket albireo-videos");
  });
});
