// `pnpm stack:deploy` and `pnpm stack:delete`: create, update, or delete every
// Cloudflare resource of this albireo deployment. Sign in with `cf auth login`
// first. The settings come from albireo.config.ts and the storage keys from
// .env.production. The deploy first checks that the storage keys may do what
// albireo does in the bucket (stack/storage-check.ts).
//
//   pnpm stack:deploy
//   pnpm stack:delete [--confirm <stack name>]

import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateSettings, type AlbireoSettings } from "../config/settings.ts";
import { isPassingStatus, retry } from "../shared/retry.ts";
import { S3ObjectStore } from "../worker/storage.ts";
import { projectCf } from "./cf.ts";
import { parseEnvFile } from "./env-file.ts";
import { deleteStack, deployStack, describe, stackResources, STACK_TAG, type SecretsFile, type StackSecrets } from "./stack.ts";
import { missingPermissionsMessage, missingStoragePermissions } from "./storage-check.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const USAGE = "Usage: pnpm stack:deploy | pnpm stack:delete [--confirm <stack name>]";

async function main(args: string[]): Promise<void> {
  const [command, ...options] = args;
  if (command !== "deploy" && command !== "delete") throw new Error(USAGE);
  const settings = await readSettings();
  const cf = projectCf(ROOT);
  const log = (line: string) => console.log(line);

  if (command === "deploy") {
    if (options.length > 0) throw new Error(USAGE);
    const env = readProductionEnv();
    const s3AccessKeyId = env.get("S3_ACCESS_KEY_ID") ?? "";
    const s3SecretAccessKey = env.get("S3_SECRET_ACCESS_KEY") ?? "";
    if (s3AccessKeyId === "" || s3SecretAccessKey === "") {
      throw new Error("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY in .env.production must hold the keys of the production storage.");
    }
    console.log(`Deploying the stack ${settings.workerName}.`);
    await checkStorageKeys(settings, { s3AccessKeyId, s3SecretAccessKey });
    deployStack({ settings, secrets: { s3AccessKeyId, s3SecretAccessKey }, cf, log, writeSecretsFile });
    console.log(`\nalbireo runs at https://${settings.production.domain}/`);
    return;
  }

  const confirmation = readConfirmOption(options);
  const { resources, others } = stackResources(cf, settings.workerName);
  if (resources.length === 0) {
    console.log(`No resource carries the tag ${STACK_TAG}=${settings.workerName}.`);
  } else {
    console.log(`The stack ${settings.workerName} has these resources:`);
    for (const resource of resources) console.log(`  ${describe(resource)}`);
    if (resources.some((resource) => resource.type === "d1_database")) {
      console.log("\nDeleting the D1 database erases the library: the titles, the series, the comments, and the history.");
    }
    if (!(await confirmed(settings.workerName, confirmation))) {
      console.log("Nothing was deleted.");
      return;
    }
    deleteStack({ cf, log, resources });
  }
  // What the stack does not own, which stays where it is.
  const storage = settings.production.storage;
  console.log("\nDelete these yourself if you no longer need them:");
  console.log(`  The videos in the bucket ${storage.bucket} at ${storage.endpoint}, and its access keys in .env.production`);
  for (const other of others) console.log(`  ${other}, which carries the tag of the stack but is not a resource that albireo creates`);
}

/** Stops the deploy before it changes anything when the storage keys may not do what albireo does in the bucket. */
async function checkStorageKeys(settings: AlbireoSettings, secrets: StackSecrets): Promise<void> {
  const storage = settings.production.storage;
  const store = new S3ObjectStore(
    {
      endpoint: storage.endpoint,
      region: storage.region,
      bucket: storage.bucket,
      urlStyle: storage.urlStyle,
      accessKeyId: secrets.s3AccessKeyId,
      secretAccessKey: secrets.s3SecretAccessKey,
    },
    600,
  );
  const missing = await missingStoragePermissions(store, sendAgainWhileBusy, randomUUID());
  if (missing.length > 0) throw new Error(missingPermissionsMessage(storage.bucket, missing));
  console.log(`Bucket ${storage.bucket}: the access key reads, writes, and deletes objects, and uploads videos in parts`);
}

/**
 * Sends a request to a signed URL, and again after a lost connection or a busy storage service,
 * as the storage client of the Worker does. The same PUT or GET may run twice without harm.
 */
function sendAgainWhileBusy(url: string, init: RequestInit): Promise<Response> {
  return retry(
    async () => {
      const response = await fetch(url, init);
      if (isPassingStatus(response.status)) throw new BusyResponse(response);
      return response;
    },
    { attempts: 3, firstDelayMs: 1000, retryable: (error) => error instanceof BusyResponse || error instanceof TypeError },
  ).catch((error: unknown) => {
    // After the last attempt, the answer of the storage service names the problem.
    if (error instanceof BusyResponse) return error.response;
    throw error;
  });
}

/** An answer of the storage service that may pass, such as 503, kept to return after the last attempt. */
class BusyResponse extends Error {
  readonly response: Response;
  constructor(response: Response) {
    super(`The storage service answered ${response.status}.`);
    this.response = response;
  }
}

async function readSettings(): Promise<AlbireoSettings> {
  const file = join(ROOT, "albireo.config.ts");
  if (!existsSync(file)) throw new Error("albireo.config.ts does not exist. Copy albireo.config.example.ts to it and fill in the values.");
  const module = (await import(pathToFileURL(file).href)) as { default: unknown };
  return validateSettings(module.default);
}

function readProductionEnv(): Map<string, string> {
  const file = join(ROOT, ".env.production");
  if (!existsSync(file)) throw new Error(".env.production does not exist. Copy .env.example to it and fill in the keys of the production storage.");
  return parseEnvFile(readFileSync(file, "utf8"));
}

function readConfirmOption(options: string[]): string | null {
  if (options.length === 0) return null;
  const [flag, value] = options;
  if (flag !== "--confirm" || value === undefined || options.length !== 2) throw new Error(USAGE);
  return value;
}

/** The person types the stack name, or passes it with --confirm where nobody can type. */
async function confirmed(stack: string, confirmation: string | null): Promise<boolean> {
  if (confirmation !== null) return confirmation === stack;
  if (!process.stdin.isTTY) throw new Error(`Pass --confirm ${stack} to delete the stack without a prompt.`);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await prompt.question(`\nType ${stack} to delete all of them: `)).trim() === stack;
  } finally {
    prompt.close();
  }
}

/** The secrets for cf deploy, in a folder that only this user can read, which is removed after the deploy. */
function writeSecretsFile(values: Record<string, string>): SecretsFile {
  const folder = mkdtempSync(join(tmpdir(), "albireo-"));
  const path = join(folder, "secrets.json");
  writeFileSync(path, `${JSON.stringify(values, null, 2)}\n`, { mode: 0o600 });
  return { path, remove: () => rmSync(folder, { recursive: true, force: true }) };
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? `\n${error.message}` : error);
  process.exitCode = 1;
}
