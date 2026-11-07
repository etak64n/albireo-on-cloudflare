// Security headers of the pages of the browser app.
//
// The Content-Security-Policy names what a page may load and where its scripts may
// connect. Videos, thumbnails, pictures, and attachments come from the storage service
// through signed URLs, and uploads send their parts there, so the policy allows the
// bucket of the storage settings and nothing else outside the origin of albireo.

import type { Env } from "./env.ts";
import { objectUrl } from "./storage.ts";

type StorageBindings = Pick<Env, "STORAGE_TYPE" | "S3_ENDPOINT" | "S3_BUCKET" | "S3_URL_STYLE">;

/** Headers that every page of the browser app carries. */
export function pageHeaders(env: StorageBindings): Record<string, string> {
  return {
    "Content-Security-Policy": contentSecurityPolicy(storageSource(env)),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "X-Content-Type-Options": "nosniff",
  };
}

/**
 * The start of every object URL that the Worker signs, as a source of the policy, or
 * null when no other origin holds the objects: the local R2 bucket of `cf dev` answers
 * on the origin of albireo, and settings without an endpoint or a bucket sign nothing.
 */
export function storageSource(env: StorageBindings): string | null {
  if (env.STORAGE_TYPE !== "s3" || env.S3_ENDPOINT === undefined || env.S3_ENDPOINT === "" || env.S3_BUCKET === "") {
    return null;
  }
  let bucket: URL;
  try {
    bucket = objectUrl(
      {
        endpoint: env.S3_ENDPOINT,
        bucket: env.S3_BUCKET,
        urlStyle: env.S3_URL_STYLE === "virtual-hosted" ? "virtual-hosted" : "path",
      },
      "",
    );
  } catch {
    return null;
  }
  // A source ends at whitespace, a semicolon, or a comma. Should the path hold one,
  // the origin alone still allows the bucket.
  return /[\s;,]/.test(bucket.href) ? bucket.origin : bucket.href;
}

export function contentSecurityPolicy(storage: string | null): string {
  const bucket = storage === null ? [] : [storage];
  const directives: string[][] = [
    ["default-src", "'self'"],
    // 'wasm-unsafe-eval' lets the preview of slides run its WebAssembly. Cloudflare Web
    // Analytics, when the zone turns it on, adds its script to every page.
    ["script-src", "'self'", "'wasm-unsafe-eval'", "https://static.cloudflareinsights.com"],
    // The components and the player add style elements and style attributes.
    ["style-src", "'self'", "'unsafe-inline'"],
    // blob: and data: are pictures and videos that the browser makes from a chosen file.
    ["img-src", "'self'", "data:", "blob:", ...bucket],
    ["media-src", "'self'", "blob:", ...bucket],
    ["connect-src", "'self'", ...bucket],
    ["font-src", "'self'", "data:"],
    ["worker-src", "'self'", "blob:"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
  ];
  return directives.map((directive) => directive.join(" ")).join("; ");
}
