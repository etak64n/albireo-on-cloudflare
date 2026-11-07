// Before `pnpm stack:deploy` changes anything, it checks that the access key of the bucket
// can do what albireo does with it. The browser sends files and the parts of videos to URLs
// that the Worker signs, and reads them back; the Worker starts and aborts multipart uploads,
// and deletes the files of a video, an attachment, or a picture that someone deletes. The
// check does each of these on keys under albireo-check/, and deletes what it writes.

import type { ObjectStore } from "../worker/storage.ts";

/** What the access key must be allowed to do in the bucket. */
export type StoragePermission = "delete objects" | "write objects" | "read objects" | "upload videos in parts";

export interface MissingPermission {
  permission: StoragePermission;
  /** What the storage service answered. */
  reason: string;
}

/** Sends a request to a signed URL, as the browser does. */
export type Send = (url: string, init: RequestInit) => Promise<Response>;

const CHECK_BODY = "albireo checks the access key of the bucket.";

/**
 * Returns the permissions that the access key lacks, one entry each, by the requests that the
 * bucket refuses. Deleting comes first, on a key that holds no object, so that a key that may
 * not delete stops the check before it writes anything that it could not remove.
 */
export async function missingStoragePermissions(store: ObjectStore, send: Send, checkId: string): Promise<MissingPermission[]> {
  const key = `albireo-check/${checkId}`;
  const missing: MissingPermission[] = [];
  const attempt = async (permission: StoragePermission, action: () => Promise<void>): Promise<boolean> => {
    try {
      await action();
      return true;
    } catch (error) {
      if (!missing.some((item) => item.permission === permission)) {
        missing.push({ permission, reason: error instanceof Error ? error.message : String(error) });
      }
      return false;
    }
  };

  if (!(await attempt("delete objects", () => store.deleteObject(`${key}-none`)))) return missing;
  const written = await attempt("write objects", async () => {
    const response = await send(await store.presignPut(key, "text/plain"), {
      method: "PUT",
      headers: { "content-type": "text/plain" },
      body: CHECK_BODY,
    });
    if (!response.ok) throw new Error(`A PUT to a signed URL failed with HTTP ${response.status}.`);
  });
  if (written) {
    await attempt("read objects", async () => {
      const response = await send(await store.presignGet(key), { method: "GET" });
      if (!response.ok) throw new Error(`A GET of a signed URL failed with HTTP ${response.status}.`);
      if ((await response.text()) !== CHECK_BODY) throw new Error("A GET of a signed URL returned other bytes than the PUT sent.");
    });
    await attempt("delete objects", () => store.deleteObject(key));
  }
  await attempt("upload videos in parts", async () => {
    const uploadId = await store.createMultipartUpload(`${key}-parts`, "video/mp4");
    await store.abortMultipartUpload(`${key}-parts`, uploadId);
  });
  return missing;
}

/** The error that stops the deploy, with the permissions to give and what the bucket answered. */
export function missingPermissionsMessage(bucket: string, missing: readonly MissingPermission[]): string {
  const names = missing.map((item) => item.permission);
  const list = names.length === 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1) ?? ""}`;
  return [
    `Please give the access key in .env.production permission to ${list} in the bucket ${bucket}, then deploy again. The deploy stopped before it changed anything.`,
    ...missing.map((item) => `  ${item.permission}: ${item.reason}`),
  ].join("\n");
}
