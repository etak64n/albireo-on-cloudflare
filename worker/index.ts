// Entry point of the albireo Worker. It answers /api/* and, in a deployment,
// returns the pages of the browser app from the static assets with their
// security headers. The built files under /assets/ never run the Worker.
// Every request reads D1 through readsAgainWhileBusy (worker/d1-retry.ts).

import { fetchAccessIdentity, remoteKeySet } from "./access.ts";
import { createApp } from "./app.ts";
import { readsAgainWhileBusy } from "./d1-retry.ts";
import type { Env } from "./env.ts";
import { randomId } from "./ids.ts";
import { S3ObjectStore } from "./storage.ts";

const app = createApp({
  keySetFor: remoteKeySet,
  fetchIdentity: fetchAccessIdentity,
  objectStoreFor: (config) => new S3ObjectStore(config.storage, config.signedUrlTtlSeconds),
  now: () => new Date(),
  newId: randomId,
});

export default {
  fetch: (request: Request, env: Env, context: Parameters<typeof app.fetch>[2]) =>
    app.fetch(request, { ...env, DB: readsAgainWhileBusy(env.DB) }, context),
};
