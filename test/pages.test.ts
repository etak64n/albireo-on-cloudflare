import { describe, expect, it } from "vitest";
import type { ApiErrorBody } from "../shared/api.ts";
import { contentSecurityPolicy, pageHeaders, storageSource } from "../worker/security-headers.ts";
import { createTestApp, PAGE_HTML } from "./support/app.ts";

/** The sources of one directive of a policy, such as ["'self'", "blob:"] for media-src. */
function directive(policy: string | null, name: string): string[] | undefined {
  for (const part of (policy ?? "").split(";")) {
    const [key, ...sources] = part.trim().split(/\s+/);
    if (key === name) return sources;
  }
  return undefined;
}

const BUCKET = "https://s3.example.com/albireo-videos/";

describe("pages", () => {
  it("returns a page of the browser app with a policy that allows the bucket", async () => {
    const app = await createTestApp();
    const response = await app.request("/videos/video00000000001");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await response.text()).toBe(PAGE_HTML);
    const policy = response.headers.get("content-security-policy");
    expect(directive(policy, "connect-src")).toEqual(["'self'", BUCKET]);
    expect(directive(policy, "media-src")).toEqual(["'self'", "blob:", BUCKET]);
    expect(directive(policy, "img-src")).toEqual(["'self'", "data:", "blob:", BUCKET]);
    expect(directive(policy, "frame-ancestors")).toEqual(["'none'"]);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("puts the headers on a 304, which updates the headers of the page that the browser keeps", async () => {
    const app = await createTestApp();
    const response = await app.request("/", { headers: { "if-none-match": '"page"' } });
    expect(response.status).toBe(304);
    expect(response.headers.get("content-security-policy")).toBe(pageHeaders(app.env)["Content-Security-Policy"]);
  });

  it("needs no Access token, because pages hold no data", async () => {
    const app = await createTestApp();
    expect((await app.request("/")).status).toBe(200);
  });

  it("answers a path under /api that no endpoint takes with an error, not with a page", async () => {
    const app = await createTestApp();
    const response = await app.signedRequest("/api/no-such-endpoint");
    expect(response.status).toBe(404);
    expect(((await response.json()) as ApiErrorBody).error.code).toBe("not_found");
  });
});

describe("storageSource", () => {
  it("is the bucket in the path of the endpoint", () => {
    const env = { STORAGE_TYPE: "s3", S3_ENDPOINT: "https://s3.example.com", S3_BUCKET: "albireo-videos", S3_URL_STYLE: "path" };
    expect(storageSource(env)).toBe("https://s3.example.com/albireo-videos/");
  });

  it("is the bucket in the hostname with virtual-hosted URLs", () => {
    const env = { STORAGE_TYPE: "s3", S3_ENDPOINT: "https://s3.example.com", S3_BUCKET: "albireo-videos", S3_URL_STYLE: "virtual-hosted" };
    expect(storageSource(env)).toBe("https://albireo-videos.s3.example.com/");
  });

  it("keeps the path of the endpoint", () => {
    const env = { STORAGE_TYPE: "s3", S3_ENDPOINT: "https://storage.example.com/s3/", S3_BUCKET: "albireo-videos", S3_URL_STYLE: "path" };
    expect(storageSource(env)).toBe("https://storage.example.com/s3/albireo-videos/");
  });

  it("is null for the local R2 bucket of cf dev, which answers on the origin of albireo", () => {
    expect(storageSource({ STORAGE_TYPE: "local-r2", S3_BUCKET: "albireo-local", S3_URL_STYLE: "path" })).toBeNull();
  });

  it("is null when the endpoint is not a URL", () => {
    expect(storageSource({ STORAGE_TYPE: "s3", S3_ENDPOINT: "s3.example.com", S3_BUCKET: "albireo-videos", S3_URL_STYLE: "path" })).toBeNull();
  });
});

describe("contentSecurityPolicy", () => {
  it("allows only the origin of albireo when no bucket is elsewhere", () => {
    const policy = contentSecurityPolicy(null);
    expect(directive(policy, "connect-src")).toEqual(["'self'"]);
    expect(directive(policy, "media-src")).toEqual(["'self'", "blob:"]);
  });

  it("runs the WebAssembly of the slide preview and no script from elsewhere but Web Analytics", () => {
    expect(directive(contentSecurityPolicy(BUCKET), "script-src")).toEqual([
      "'self'",
      "'wasm-unsafe-eval'",
      "https://static.cloudflareinsights.com",
    ]);
  });
});
