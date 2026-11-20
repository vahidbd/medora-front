/**
 * The mock API's tenant set-up routes: settings, the onboarding checklist,
 * companies, brands and their domains, and platform staff's routes, with
 * the API's rules where a screen shows their refusals (abn_invalid,
 * abn_taken, slug_taken, colour_unreadable, support_email_required,
 * domain_unverified, host_taken, last_verified_domain, company_has_brands).
 * Made-up businesses only; the ABNs are invented numbers that pass the checksum.
 */
import { BAD_REQUEST, fail, isObject, readJson, send } from "./http.mjs";
import { daysFromNow, ME, memberships, newId, TENANTS } from "./people.mjs";
import { tenantOf, usable } from "./staff.mjs";

const [harbour, coastal] = TENANTS.map((t) => t.tenantId);
const TIME_ZONES = [
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Adelaide",
  "Australia/Darwin",
  "Australia/Perth",
  "Australia/Hobart",
  "Australia/Lord_Howe",
  "Australia/Eucla",
  "Australia/Broken_Hill",
  "Indian/Christmas",
  "Indian/Cocos",
  "Antarctica/Macquarie",
];
const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

const companies = [
  {
    companyId: "50000000-0000-4000-8000-000000000001",
    tenantId: harbour,
    legalName: "Harbour Health Pty Ltd",
    tradingName: "Harbour Health",
    abn: "11000372193",
    state: "NSW",
    updatedAt: daysFromNow(-30),
  },
  {
    companyId: "50000000-0000-4000-8000-000000000002",
    tenantId: coastal,
    legalName: "Coastal Skin Pty Ltd",
    tradingName: null,
    abn: "11001670909",
    state: "QLD",
    updatedAt: daysFromNow(-20),
  },
];

function brandRow(n, tenantId, companyId, name, slug, status, extra = {}) {
  return {
    brandId: `60000000-0000-4000-8000-00000000000${n}`,
    tenantId,
    companyId,
    name,
    slug,
    status,
    supportEmail: "help@example.test",
    supportPhone: null,
    primaryColour: null,
    logoUrl: null,
    updatedAt: daysFromNow(-10),
    ...extra,
  };
}

const brands = [
  brandRow(1, harbour, companies[0].companyId, "Harbour Health", "harbour-health", "live", {
    primaryColour: "#1f6feb",
    supportPhone: "1300 000 000",
  }),
  brandRow(2, harbour, companies[0].companyId, "Harbour Skin", "harbour-skin", "draft", { supportEmail: null }),
  brandRow(3, coastal, companies[1].companyId, "Coastal Skin", "coastal-skin", "live"),
];

const domains = [
  {
    domainId: "70000000-0000-4000-8000-000000000001",
    brandId: brands[0].brandId,
    host: "app.harbour-health.example",
    createdAt: daysFromNow(-25),
    verifiedAt: daysFromNow(-24),
  },
  {
    domainId: "70000000-0000-4000-8000-000000000002",
    brandId: brands[1].brandId,
    host: "skin.harbour-health.example",
    createdAt: daysFromNow(-2),
    verifiedAt: null,
  },
  {
    domainId: "70000000-0000-4000-8000-000000000003",
    brandId: brands[2].brandId,
    host: "app.coastal-skin.example",
    createdAt: daysFromNow(-18),
    verifiedAt: daysFromNow(-17),
  },
];

// Checks, as the API makes them (src/modules/brands/checks.ts in the backend).

const WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
const abnValid = (abn) => /^\d{11}$/.test(abn) && WEIGHTS.reduce((t, w, i) => t + (Number(abn[i]) - (i === 0 ? 1 : 0)) * w, 0) % 89 === 0;

function normaliseHost(typed) {
  const host = String(typed)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) && host.length <= 253 ? host : null;
}

const channel = (v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
const readable = (hex) => Math.max(contrast(hex, "#ffffff"), contrast(hex, "#0a0a0a")) >= 4.5;

// Replies.

const domainOf = (d) => ({ domainId: d.domainId, host: d.host, verifiedAt: d.verifiedAt });
/** A row without its tenant id, which the API's replies never carry. */
function withoutTenant(row) {
  const copy = { ...row };
  delete copy.tenantId;
  return copy;
}
const brandOf = (b) => ({ ...withoutTenant(b), domains: domains.filter((d) => d.brandId === b.brandId).map(domainOf) });
const companyOf = (c) => ({ ...withoutTenant(c), brandCount: brands.filter((b) => b.companyId === c.companyId).length });
const settingsOf = (tenantId) => {
  const t = TENANTS.find((x) => x.tenantId === tenantId);
  return { tenantId, name: t.tenantName, timeZone: t.timeZone };
};

function holds(tenantId, role) {
  return memberships.some((m) => m.tenantId === tenantId && m.role === role && usable(m));
}

function onboarding(tenantId) {
  const liveVerified = brands.some(
    (b) => b.tenantId === tenantId && b.status === "live" && domains.some((d) => d.brandId === b.brandId && d.verifiedAt),
  );
  const items = [
    { key: "company", done: companies.some((c) => c.tenantId === tenantId) },
    { key: "live_brand", done: liveVerified },
    { key: "medical_director", done: holds(tenantId, "medical_director") },
    { key: "prescriber", done: holds(tenantId, "prescriber") },
  ];
  return { ready: items.every((i) => i.done), items };
}

async function body(req, res, keys) {
  const value = await readJson(req);
  if (!isObject(value) || !Object.keys(value).every((k) => keys.includes(k))) return (fail(res, 400, "bad_request", BAD_REQUEST), null);
  return value;
}

// Tenant settings and the checklist.

async function tenantSettings(req, res, _params, method) {
  const mine = tenantOf(req, res, method === "PATCH" ? "tenant:manage" : undefined);
  if (!mine) return;
  if (method === "GET") return send(res, 200, settingsOf(mine.tenantId));
  const change = await body(req, res, ["name", "timeZone"]);
  if (!change) return;
  if (change.timeZone !== undefined && !TIME_ZONES.includes(change.timeZone)) return fail(res, 400, "bad_request", BAD_REQUEST);
  const tenant = TENANTS.find((t) => t.tenantId === mine.tenantId);
  if (typeof change.name === "string" && change.name.trim()) tenant.tenantName = change.name.trim();
  if (change.timeZone) tenant.timeZone = change.timeZone;
  send(res, 200, settingsOf(mine.tenantId));
}

function checklist(req, res) {
  const mine = tenantOf(req, res);
  if (mine) send(res, 200, onboarding(mine.tenantId));
}

// Companies.

function listCompanies(req, res) {
  const mine = tenantOf(req, res);
  if (mine) send(res, 200, { companies: companies.filter((c) => c.tenantId === mine.tenantId).map(companyOf) });
}

function companyFields(res, tenantId, input, before) {
  const abn = input.abn === undefined ? before?.abn : String(input.abn).replace(/\s+/g, "");
  if (!abnValid(abn)) return (fail(res, 400, "abn_invalid", "That ABN isn't valid. Check the 11 digits."), null);
  if (companies.some((c) => c.tenantId === tenantId && c.abn === abn && c.companyId !== before?.companyId)) {
    return (fail(res, 409, "abn_taken", "Another company here already has that ABN"), null);
  }
  const state = input.state ?? before?.state;
  if (!STATES.includes(state)) return (fail(res, 400, "bad_request", BAD_REQUEST), null);
  return {
    legalName: input.legalName ?? before?.legalName,
    tradingName: input.tradingName === undefined ? (before?.tradingName ?? null) : input.tradingName,
    abn,
    state,
  };
}

async function createCompany(req, res) {
  const mine = tenantOf(req, res, "tenant:manage");
  if (!mine) return;
  const input = await body(req, res, ["legalName", "tradingName", "abn", "state"]);
  if (!input) return;
  const fields = companyFields(res, mine.tenantId, input, null);
  if (!fields) return;
  const company = { companyId: newId("50000000"), tenantId: mine.tenantId, ...fields, updatedAt: new Date().toISOString() };
  companies.push(company);
  send(res, 201, companyOf(company));
}

async function changeCompany(req, res, [id], method) {
  const mine = tenantOf(req, res, "tenant:manage");
  if (!mine) return;
  const company = companies.find((c) => c.tenantId === mine.tenantId && c.companyId === id);
  if (!company) return fail(res, 404, "not_found", "Company not found");
  if (method === "DELETE") {
    if (brands.some((b) => b.companyId === id))
      return fail(res, 409, "company_has_brands", "This company still has brands. Move them to another company first.");
    companies.splice(companies.indexOf(company), 1);
    return send(res, 200, { companyId: id });
  }
  const input = await body(req, res, ["legalName", "tradingName", "abn", "state"]);
  if (!input) return;
  const fields = companyFields(res, mine.tenantId, input, company);
  if (!fields) return;
  if (fields.abn !== company.abn && brands.some((b) => b.companyId === id && b.status !== "draft")) {
    return fail(res, 409, "abn_fixed", "A company with a live or paused brand keeps its ABN. Add a new company instead.");
  }
  Object.assign(company, fields, { updatedAt: new Date().toISOString() });
  send(res, 200, companyOf(company));
}

// Brands and domains.

function listBrands(req, res) {
  const mine = tenantOf(req, res);
  if (mine) send(res, 200, { brands: brands.filter((b) => b.tenantId === mine.tenantId).map(brandOf) });
}

const BRAND_KEYS = ["companyId", "name", "supportEmail", "supportPhone", "primaryColour", "logoUrl"];

function brandFields(res, tenantId, input, before) {
  const companyId = input.companyId ?? before?.companyId;
  if (!companies.some((c) => c.tenantId === tenantId && c.companyId === companyId))
    return (fail(res, 400, "company_not_found", "Choose one of your companies"), null);
  if (before && before.status !== "draft" && companyId !== before.companyId)
    return (fail(res, 409, "company_fixed", "A live or paused brand stays with its company"), null);
  const colour = input.primaryColour === undefined ? before?.primaryColour : input.primaryColour;
  if (colour && (!/^#[0-9a-f]{6}$/i.test(colour) || !readable(colour))) {
    return (fail(res, 400, "colour_unreadable", "Text can't be read on that colour. Choose a darker or lighter one."), null);
  }
  const supportEmail = input.supportEmail === undefined ? before?.supportEmail : input.supportEmail;
  if (before && before.status !== "draft" && !supportEmail)
    return (fail(res, 409, "support_email_required", "A live or paused brand needs a support email"), null);
  const pick = (key) => (input[key] === undefined ? (before?.[key] ?? null) : input[key]);
  return {
    companyId,
    name: input.name ?? before?.name,
    supportEmail: supportEmail ?? null,
    supportPhone: pick("supportPhone"),
    primaryColour: colour ? colour.toLowerCase() : null,
    logoUrl: pick("logoUrl"),
  };
}

async function createBrand(req, res) {
  const mine = tenantOf(req, res, "brands:manage");
  if (!mine) return;
  const input = await body(req, res, [...BRAND_KEYS, "slug"]);
  if (!input) return;
  const slug = String(input.slug ?? "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 2 || slug.length > 40) return fail(res, 400, "bad_request", BAD_REQUEST);
  if (brands.some((b) => b.slug === slug)) return fail(res, 409, "slug_taken", "Another brand already uses that address name");
  const fields = brandFields(res, mine.tenantId, input, null);
  if (!fields) return;
  const brand = {
    brandId: newId("60000000"),
    tenantId: mine.tenantId,
    ...fields,
    slug,
    status: "draft",
    updatedAt: new Date().toISOString(),
  };
  brands.push(brand);
  send(res, 201, brandOf(brand));
}

const findBrand = (mine, id) => brands.find((b) => b.tenantId === mine.tenantId && b.brandId === id);

async function changeBrand(req, res, [id]) {
  const mine = tenantOf(req, res, "brands:manage");
  if (!mine) return;
  const brand = findBrand(mine, id);
  if (!brand) return fail(res, 404, "not_found", "Brand not found");
  const input = await body(req, res, BRAND_KEYS);
  if (!input) return;
  const fields = brandFields(res, mine.tenantId, input, brand);
  if (!fields) return;
  Object.assign(brand, fields, { updatedAt: new Date().toISOString() });
  send(res, 200, brandOf(brand));
}

async function brandStatus(req, res, [id]) {
  const mine = tenantOf(req, res, "brands:manage");
  if (!mine) return;
  const brand = findBrand(mine, id);
  if (!brand) return fail(res, 404, "not_found", "Brand not found");
  const input = await body(req, res, ["status"]);
  if (!input || !["live", "paused"].includes(input.status)) return input && fail(res, 400, "bad_request", BAD_REQUEST);
  if (input.status === "paused" && brand.status !== "live") return fail(res, 409, "not_live", "Only a live brand can be paused");
  if (input.status === "live") {
    if (!brand.supportEmail) return fail(res, 409, "support_email_required", "Add a support email before going live");
    if (!domains.some((d) => d.brandId === id && d.verifiedAt)) {
      return fail(res, 409, "domain_unverified", "A brand goes live once Medora has verified one of its domains");
    }
  }
  brand.status = input.status;
  brand.updatedAt = new Date().toISOString();
  send(res, 200, brandOf(brand));
}

async function addDomain(req, res, [id]) {
  const mine = tenantOf(req, res, "brands:manage");
  if (!mine) return;
  const brand = findBrand(mine, id);
  if (!brand) return fail(res, 404, "not_found", "Brand not found");
  const input = await body(req, res, ["host"]);
  if (!input) return;
  const host = normaliseHost(input.host ?? "");
  if (!host) return fail(res, 400, "host_invalid", "Enter a domain like app.example.com.au");
  if (domains.some((d) => d.host === host)) return fail(res, 409, "host_taken", "That domain is already in use");
  domains.push({ domainId: newId("70000000"), brandId: id, host, createdAt: new Date().toISOString(), verifiedAt: null });
  send(res, 201, brandOf(brand));
}

function removeDomain(req, res, [id, domainId]) {
  const mine = tenantOf(req, res, "brands:manage");
  if (!mine) return;
  const brand = findBrand(mine, id);
  const domain = domains.find((d) => d.brandId === id && d.domainId === domainId);
  if (!brand || !domain) return fail(res, 404, "not_found", "Domain not found");
  const verifiedLeft = domains.filter((d) => d.brandId === id && d.domainId !== domainId && d.verifiedAt).length;
  if (brand.status !== "draft" && domain.verifiedAt && verifiedLeft === 0) {
    return fail(res, 409, "last_verified_domain", "This is the brand's only verified domain. Add another and have it verified first.");
  }
  domains.splice(domains.indexOf(domain), 1);
  send(res, 200, { domainId });
}

// Platform staff: no tenant header (ADM14, ADM15).

function platformOnly(res) {
  if (ME.platformStaff) return true;
  fail(res, 403, "forbidden", "You don't have permission to do that");
  return false;
}

const platformTenant = (t) => ({
  tenantId: t.tenantId,
  name: t.tenantName,
  timeZone: t.timeZone,
  createdAt: t.createdAt,
  ownerJoined: memberships.some((m) => m.tenantId === t.tenantId && m.role === "owner" && m.status === "active"),
  brands: brands.filter((b) => b.tenantId === t.tenantId).length,
  liveBrands: brands.filter((b) => b.tenantId === t.tenantId && b.status === "live").length,
});

async function platformTenants(req, res, _params, method) {
  if (!platformOnly(res)) return;
  if (method === "GET")
    return send(res, 200, { tenants: [...TENANTS].sort((a, b) => a.tenantName.localeCompare(b.tenantName)).map(platformTenant) });
  const input = await body(req, res, ["name", "timeZone", "ownerEmail", "ownerName"]);
  if (!input) return;
  if (!String(input.name ?? "").trim() || !TIME_ZONES.includes(input.timeZone) || !/^[^@\s]+@[^@\s]+$/.test(input.ownerEmail ?? "")) {
    return fail(res, 400, "bad_request", BAD_REQUEST);
  }
  const tenant = {
    tenantId: newId("10000000"),
    tenantName: input.name.trim(),
    timeZone: input.timeZone,
    createdAt: new Date().toISOString(),
  };
  TENANTS.push(tenant);
  memberships.push({
    membershipId: newId("20000000"),
    tenantId: tenant.tenantId,
    userId: newId("00000000"),
    email: input.ownerEmail.trim().toLowerCase(),
    displayName: input.ownerName?.trim() || null,
    role: "owner",
    customRoleId: null,
    status: "invited",
    invitedAt: new Date().toISOString(),
    expiresAt: null,
    lastSignInAt: null,
  });
  send(res, 201, { tenant: platformTenant(tenant), email: "sent" });
}

function ownerInvitation(req, res, [tenantId]) {
  if (!platformOnly(res)) return;
  const joined = memberships.some((m) => m.tenantId === tenantId && m.role === "owner" && m.status === "active");
  const invited = memberships.find((m) => m.tenantId === tenantId && m.role === "owner" && m.status === "invited");
  if (joined || !invited) return fail(res, 404, "not_found", "Owner invitation not found");
  invited.invitedAt = new Date().toISOString();
  send(res, 200, { tenantId, email: "sent" });
}

function platformDomains(req, res) {
  if (!platformOnly(res)) return;
  const waiting = new URL(req.url, "http://mock").searchParams.get("waiting") !== "false";
  const rows = domains
    .filter((d) => !waiting || !d.verifiedAt)
    .map((d) => {
      const brand = brands.find((b) => b.brandId === d.brandId);
      const tenant = TENANTS.find((t) => t.tenantId === brand.tenantId);
      return { ...d, tenantId: brand.tenantId, tenantName: tenant.tenantName, brandId: brand.brandId, brandName: brand.name };
    });
  send(res, 200, { domains: rows });
}

function verifyDomain(req, res, [domainId]) {
  if (!platformOnly(res)) return;
  const domain = domains.find((d) => d.domainId === domainId);
  if (!domain) return fail(res, 404, "not_found", "Domain not found");
  domain.verifiedAt ??= new Date().toISOString();
  send(res, 200, { domainId, host: domain.host });
}

export const tenantSetupRoutes = [
  ["GET", /^\/v1\/tenant$/, tenantSettings],
  ["PATCH", /^\/v1\/tenant$/, tenantSettings],
  ["GET", /^\/v1\/tenant\/onboarding$/, checklist],
  ["GET", /^\/v1\/companies$/, listCompanies],
  ["POST", /^\/v1\/companies$/, createCompany],
  ["PATCH", /^\/v1\/companies\/([^/]+)$/, changeCompany],
  ["DELETE", /^\/v1\/companies\/([^/]+)$/, changeCompany],
  ["GET", /^\/v1\/brands$/, listBrands],
  ["POST", /^\/v1\/brands$/, createBrand],
  ["PATCH", /^\/v1\/brands\/([^/]+)$/, changeBrand],
  ["POST", /^\/v1\/brands\/([^/]+)\/status$/, brandStatus],
  ["POST", /^\/v1\/brands\/([^/]+)\/domains$/, addDomain],
  ["DELETE", /^\/v1\/brands\/([^/]+)\/domains\/([^/]+)$/, removeDomain],
  ["GET", /^\/v1\/platform\/tenants$/, platformTenants],
  ["POST", /^\/v1\/platform\/tenants$/, platformTenants],
  ["POST", /^\/v1\/platform\/tenants\/([^/]+)\/owner-invitation$/, ownerInvitation],
  ["GET", /^\/v1\/platform\/domains$/, platformDomains],
  ["POST", /^\/v1\/platform\/domains\/([^/]+)\/verify$/, verifyDomain],
];
