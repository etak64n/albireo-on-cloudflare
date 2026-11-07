// Entry point of the albireo Worker. It answers /api/* and, in a deployment,
// returns the pages of the browser app from the static assets with their
// security headers. The built files under /assets/ never run the Worker.

import { fetchAccessIdentity, remoteKeySet } from "./access.ts";
import { createApp } from "./app.ts";
import { randomId } from "./ids.ts";
import { S3ObjectStore } from "./storage.ts";

export default createApp({
  keySetFor: remoteKeySet,
  fetchIdentity: fetchAccessIdentity,
  objectStoreFor: (config) => new S3ObjectStore(config.storage, config.signedUrlTtlSeconds),
  now: () => new Date(),
  newId: randomId,
});
