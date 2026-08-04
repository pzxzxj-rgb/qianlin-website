import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const toursSource = await fs.readFile(path.join(projectRoot, "lib/tours.ts"), "utf8");
const toursModule = ts.transpileModule(toursSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { getVisibleTours } = await import(`data:text/javascript;base64,${Buffer.from(toursModule).toString("base64")}`);
const toursComponentSource = await fs.readFile(path.join(projectRoot, "components/Tours.tsx"), "utf8");

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

function request(path, init = {}) {
  return worker.fetch(new Request(`http://localhost${path}`, init), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

function validPayload(overrides = {}) {
  return { name: "张三", phone: "189 8512-7882", travelers: "2", privacyConsent: true, email: "", ...overrides };
}

async function postInquiry(payload, options = {}) {
  return request("/api/inquiries", { method: "POST", headers: { "Content-Type": "application/json", ...options.headers }, body: options.body ?? JSON.stringify(payload) });
}

test("server-renders the Qianlin Travel homepage", async () => {
  const response = await request("/", { headers: { accept: "text/html" } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Qianlin Travel \| Discover Guizhou, Your Way<\/title>/i);
  assert.match(html, /Create Your Private/);
  assert.match(html, /hero-carousel-controls/);
  assert.match(html, /\/images\/hero\/hero-01\.webp/);
  assert.match(html, /Frequently Asked Questions/);
  assert.doesNotMatch(html, /Featured Guizhou Tours|Enquire About This Tour|Explore Tours|旅游线路|体验贵州|Experience Guizhou|贵州的六个片段|Guizhou in six frames|section-gallery|gallery-grid|tour-card|From ¥/i);
  assert.doesNotMatch(html, /<a[^>]+href="#tours"/i);
});

test("filters only published featured tours for the current tenant", () => {
  const makeTour = (id, overrides = {}) => ({
    id,
    tenantId: "qianlin-travel",
    slug: id,
    title: { zh: id, en: id },
    description: { zh: "描述", en: "Description" },
    featured: true,
    displayOrder: 10,
    status: "published",
    ...overrides,
  });
  const fixtures = [
    makeTour("published-late", { displayOrder: 20 }),
    makeTour("published-first", { displayOrder: 1 }),
    makeTour("draft", { status: "draft", displayOrder: 0 }),
    makeTour("archived", { status: "archived", displayOrder: 2 }),
    makeTour("not-featured", { featured: false, displayOrder: 3 }),
    makeTour("other-tenant", { tenantId: "other-travel", displayOrder: 0 }),
  ];
  assert.deepEqual(getVisibleTours(fixtures, "qianlin-travel").map((tour) => tour.id), ["published-first", "published-late"]);
  assert.deepEqual(getVisibleTours([], "qianlin-travel"), []);
});

test("Tours keeps stable ids and consultation prefill wiring", () => {
  assert.match(toursComponentSource, /key=\{tour\.id\}/);
  assert.match(toursComponentSource, /onBook\(title\)/);
});

test("renders legal pages, sitemap and robots", async () => {
  for (const path of ["/privacy", "/terms", "/refund"]) {
    const response = await request(path, { headers: { accept: "text/html" } });
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), /黔林旅行社|Qianlin Travel/);
  }
  const sitemap = await request("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  const sitemapText = await sitemap.text();
  assert.match(sitemapText, /<loc>http:\/\/localhost:3000\/?<\/loc>/);
  assert.match(sitemapText, /\/privacy/);
  const robots = await request("/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Sitemap: http:\/\/localhost:3000\/sitemap\.xml/i);
});

test("rejects malformed JSON and unsupported content types", async () => {
  const malformed = await postInquiry({}, { body: "{", headers: { "Content-Type": "application/json" } });
  assert.equal(malformed.status, 400);
  const unsupported = await request("/api/inquiries", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "hello" });
  assert.equal(unsupported.status, 415);
});

test("validates required fields, phone, email and privacy consent", async () => {
  for (const payload of [validPayload({ name: "" }), validPayload({ phone: "" }), validPayload({ phone: "12345678901" }), validPayload({ email: "not-an-email" }), validPayload({ privacyConsent: false })]) {
    const response = await postInquiry(payload);
    assert.equal(response.status, 400);
  }
});

test("rejects honeypot and oversized field values without exposing internals", async () => {
  const honeypot = await postInquiry(validPayload({ website: "bot" }));
  assert.equal(honeypot.status, 400);
  const tooLong = await postInquiry(validPayload({ message: "x".repeat(2001) }));
  assert.equal(tooLong.status, 400);
  assert.doesNotMatch(await tooLong.text(), /SQL|D1|drizzle|no such table|stack/i);
  const tooLargeBody = await postInquiry({}, { body: JSON.stringify({ message: "x".repeat(33 * 1024) }) });
  assert.equal(tooLargeBody.status, 413);
});

test("allows an optional email and hides storage errors", async () => {
  const response = await postInquiry(validPayload({ email: "" }));
  assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /SQL|D1|drizzle|no such table|stack/i);
});
