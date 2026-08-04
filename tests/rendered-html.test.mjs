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

async function readSource(relativePath) {
  return fs.readFile(path.join(projectRoot, relativePath), "utf8");
}

async function importTypescriptModule(relativePath, cache = new Map()) {
  const absolutePath = path.resolve(projectRoot, relativePath);
  if (cache.has(absolutePath)) return cache.get(absolutePath);
  const modulePromise = (async () => {
    const source = await fs.readFile(absolutePath, "utf8");
    let output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    const imports = [...output.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g)];
    for (const match of imports) {
      const specifier = match[1];
      const dependencyPath = path.resolve(path.dirname(absolutePath), specifier.endsWith(".ts") ? specifier : `${specifier}.ts`);
      const dependencyRelativePath = path.relative(projectRoot, dependencyPath);
      const dependencyModule = await importTypescriptModule(dependencyRelativePath, cache);
      const dependencySource = `data:text/javascript;base64,${Buffer.from(await dependencyModule.source).toString("base64")}`;
      output = output.replaceAll(`"${specifier}"`, `"${dependencySource}"`).replaceAll(`'${specifier}'`, `'${dependencySource}'`);
    }
    return { module: await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`), source: output };
  })();
  cache.set(absolutePath, modulePromise);
  return modulePromise;
}

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

test("server-renders the Chinese Qianlin Travel homepage", async () => {
  const response = await request("/", { headers: { accept: "text/html" } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(html, /<title>黔林旅行社｜贵州旅游咨询与定制行程<\/title>/i);
  assert.match(html, /提交出行想法/);
  assert.match(html, /hero-carousel-controls/);
  assert.match(html, /\/images\/hero\/hero-01\.webp/);
  assert.match(html, /\/images\/hero\/hero-02\.webp/);
  assert.match(html, /如何提交旅行咨询？/);
  assert.match(html, /如何获得行程报价？/);
  assert.match(html, /智能规划贵州行程/);
  assert.match(html, /生成参考行程/);
  assert.doesNotMatch(html, /Featured Guizhou Tours|Enquire About This Tour|Explore Tours|页面展示的参考线路|页面价格为参考起价|选择线路|Browse a reference route|Qingyan Ancient Town|Zhenyuan Ancient Town|青岩古镇|镇远古城|体验贵州|Experience Guizhou|贵州的六个片段|Guizhou in six frames|section-gallery|gallery-grid|tour-card|From ¥/i);
  assert.doesNotMatch(html, /<a[^>]+href="#tours"/i);
});

test("keeps Chinese language, metadata and enquiry interaction as the default", async () => {
  const languageSource = await readSource("components/LanguageContext.tsx");
  const layoutSource = await readSource("app/layout.tsx");
  const pageSource = await readSource("app/page.tsx");
  const contactSource = await readSource("components/Contact.tsx");
  const destinationsSource = await readSource("components/Destinations.tsx");
  const destinationsDataSource = await readSource("data/destinations.ts");
  const toursDataSource = await readSource("data/tours.ts");
  const formSource = await readSource("components/CustomizeForm.tsx");
  assert.match(languageSource, /useState<Language>\("zh"\)/);
  assert.match(languageSource, /qianlin-language/);
  assert.match(languageSource, /localStorage/);
  assert.match(layoutSource, /lang="zh-CN"/);
  assert.match(layoutSource, /黔林旅行社｜贵州旅游咨询与定制行程/);
  assert.match(pageSource, /<Contact onEnquire=\{\(\) => openCustomize\(\)\} \/>/);
  assert.match(contactSource, /<button type="button"/);
  assert.match(contactSource, /onClick=\{onEnquire\}/);
  assert.match(destinationsSource, /<button type="button"/);
  assert.match(destinationsSource, /onSelectDestination\(name\)/);
  assert.match(destinationsSource, /String\(destinations\.length\)\.padStart/);
  assert.doesNotMatch(destinationsDataSource, /Qingyan Ancient Town|Zhenyuan Ancient Town|青岩古镇|镇远古城/);
  assert.match(toursDataSource, /tours:\s*Tour\[\]\s*=\s*\[\]/);
  assert.match(pageSource, /inquiryPrefill/);
  assert.match(formSource, /initialPlaces/);
  assert.match(formSource, /defaultValue=\{initialPlaces\}/);
  assert.match(formSource, /initialMessage/);
  assert.match(formSource, /defaultValue=\{initialMessage\}/);
});

test("keeps the hero carousel local, accessible and motion-aware", async () => {
  const heroSource = await readSource("components/Hero.tsx");
  const siteConfigSource = await readSource("data/siteConfig.ts");
  const navbarSource = await readSource("components/Navbar.tsx");
  assert.equal((siteConfigSource.match(/id: "hero-0[1-4]"/g) ?? []).length, 4);
  assert.match(siteConfigSource, /hero-02\.webp/);
  assert.match(siteConfigSource, /hero-04\.webp/);
  assert.match(heroSource, /role="group"/);
  assert.match(heroSource, /aria-current/);
  assert.match(heroSource, /alt=\{activeIndex === index \? slide\.alt\[language\] : ""\}/);
  assert.match(heroSource, /aria-hidden=\{activeIndex === index \? undefined : true\}/);
  assert.match(heroSource, /AUTO_ADVANCE_MS = 6000/);
  assert.match(navbarSource, /event\.key !== "Escape"/);
  assert.match(navbarSource, /aria-controls="mobile-navigation"/);
  assert.match(navbarSource, /关闭导航菜单/);
});

test("keeps itinerary planning provider-neutral and deterministic", async () => {
  const plannerSource = await readSource("components/ItineraryPlanner.tsx");
  const pageSource = await readSource("app/page.tsx");
  const entrySource = await readSource("lib/itinerary/generateItinerary.ts");
  const providerSource = await readSource("lib/itinerary/providers/localItineraryProvider.ts");
  const typesSource = await readSource("lib/itinerary/types.ts");
  const envExample = await readSource(".env.example");
  assert.match(plannerSource, /generateItinerary\(/);
  assert.doesNotMatch(plannerSource, /localItineraryProvider|OpenAI|DashScope|百炼/);
  assert.match(pageSource, /<ItineraryPlanner tenantId=\{company\.id\}/);
  assert.match(pageSource, /initialMessage=\{inquiryPrefill\.message\}/);
  assert.match(entrySource, /ITINERARY_PROVIDER/);
  assert.match(entrySource, /return "local"/);
  assert.match(entrySource, /UNSUPPORTED_PROVIDER/);
  assert.doesNotMatch(providerSource, /\bfetch\s*\(/);
  assert.doesNotMatch(typesSource, /messages|choices|completion/);
  assert.match(envExample, /ITINERARY_PROVIDER=local/);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_ITINERARY/);
  assert.doesNotMatch(envExample, /ITINERARY_API_KEY=.+/);

  const previousProvider = process.env.ITINERARY_PROVIDER;
  process.env.ITINERARY_PROVIDER = "local";
  try {
    const { module: itineraryModule } = await importTypescriptModule("lib/itinerary/generateItinerary.ts");
    const input = { tenantId: "qianlin-travel", destinationIds: ["huangguoshu-waterfall", "xijiang-miao-village", "libo-xiaoqikong", "fanjing-mountain"], days: 2, travelers: "6+", startCity: "Guiyang", endCity: "Guiyang", language: "zh" };
    const firstPlan = await itineraryModule.generateItinerary(input);
    const secondPlan = await itineraryModule.generateItinerary(input);
    const stops = firstPlan.days.flatMap((day) => day.stops.map((stop) => stop.destinationId));
    assert.deepEqual(firstPlan, secondPlan);
    assert.equal(firstPlan.generatedBy, "local");
    assert.equal(firstPlan.days.length, 2);
    assert.equal(new Set(stops).size, stops.length);
    assert.ok(firstPlan.unassignedDestinationIds.length > 0);

    process.env.ITINERARY_PROVIDER = "unsupported";
    await assert.rejects(() => itineraryModule.generateItinerary(input), (error) => error?.code === "UNSUPPORTED_PROVIDER");
  } finally {
    if (previousProvider === undefined) delete process.env.ITINERARY_PROVIDER;
    else process.env.ITINERARY_PROVIDER = previousProvider;
  }
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
