/**
 * The mock API's staff routes: /v1/me, staff, invitations, roles and
 * break-glass, with the API's rules where a screen shows their refusals
 * (own_membership, last_owner, cannot_grant, own_role, role_in_use,
 * own_break_glass). It does not check tokens; preview has no real sign-in.
 */
import { BAD_REQUEST, fail, isObject, readJson, send } from "./http.mjs";
import {
  breakGlass,
  CLINICAL_ROLES,
  customRoles,
  daysFromNow,
  INVITATION_DAYS,
  ME,
  memberships,
  newId,
  PERMISSION_ZONES,
  PERMISSIONS,
  PRETEND_BREAK_GLASS,
  ROLE_PERMISSIONS,
  signIns,
  STARTING_ROLES,
  TENANT_HEADER,
  TENANTS,
} from "./people.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 24 * 60 * 60 * 1000;

const past = (iso) => iso !== null && Date.parse(iso) <= Date.now();
const usable = (m) => m.status === "active" && !past(m.expiresAt);
const customRoleOf = (m) => customRoles.find((r) => r.id === m.customRoleId) ?? null;
const permissionsOf = (m) => (m.role === "custom" ? (customRoleOf(m)?.permissions ?? []) : ROLE_PERMISSIONS[m.role]);
const openBreakGlass = (m) => breakGlass.find((b) => b.membershipId === m.membershipId && Date.parse(b.endsAt) > Date.now());

function staffMember(m) {
  const custom = customRoleOf(m);
  return {
    membershipId: m.membershipId,
    userId: m.userId,
    email: m.email,
    displayName: m.displayName,
    role: m.role,
    customRole: custom ? { id: custom.id, name: custom.name } : null,
    status: m.status,
    invitedAt: m.invitedAt,
    invitationExpiresAt: m.invitedAt ? new Date(Date.parse(m.invitedAt) + INVITATION_DAYS * DAY).toISOString() : null,
    expiresAt: m.expiresAt,
    lastSignInAt: m.lastSignInAt,
  };
}

/** The caller's usable membership in the tenant the header names, or null with a reply already sent. */
function tenantOf(req, res, permission) {
  const tenantId = req.headers[TENANT_HEADER];
  if (typeof tenantId !== "string" || !UUID.test(tenantId)) {
    fail(res, 400, "tenant_required", `Choose a tenant first (${TENANT_HEADER})`);
    return null;
  }
  const mine = memberships.find((m) => m.tenantId === tenantId.toLowerCase() && m.userId === ME.userId && usable(m));
  if (!mine) {
    fail(res, 403, "not_a_member", "You aren't a member of that tenant");
    return null;
  }
  if (permission && !permissionsOf(mine).includes(permission)) {
    fail(res, 403, "forbidden", "You don't have permission to do that");
    return null;
  }
  return mine;
}

/** ADR 0030: you give or take away only a role whose permissions you all hold. */
function cannotGrant(res, mine, permissions) {
  const held = new Set(permissionsOf(mine));
  if (permissions.every((p) => held.has(p))) return false;
  fail(res, 403, "cannot_grant", "Only someone with every permission of that role can give or remove it");
  return true;
}

/** A role choice from a body: a starting role, or `custom` with one of the tenant's custom roles. */
function roleChoice(res, tenantId, body) {
  if (body.role === "custom") {
    const custom = customRoles.find((r) => r.tenantId === tenantId && r.id === body.customRoleId);
    if (!custom) return fail(res, 404, "not_found", "Role not found"), null;
    return { role: "custom", customRoleId: custom.id, permissions: custom.permissions };
  }
  if (!STARTING_ROLES.includes(body.role)) return fail(res, 400, "bad_request", BAD_REQUEST), null;
  return { role: body.role, customRoleId: null, permissions: ROLE_PERMISSIONS[body.role] };
}

const findMember = (mine, id) => memberships.find((m) => m.tenantId === mine.tenantId && m.membershipId === id);

function me(req, res) {
  send(res, 200, {
    userId: ME.userId,
    email: ME.email,
    displayName: ME.displayName,
    secondFactor: true,
    memberships: memberships
      .filter((m) => m.userId === ME.userId)
      .map((m) => {
        const custom = customRoleOf(m);
        const open = openBreakGlass(m);
        return {
          membershipId: m.membershipId,
          tenantId: m.tenantId,
          tenantName: TENANTS.find((t) => t.tenantId === m.tenantId).tenantName,
          role: m.role,
          customRole: custom ? { id: custom.id, name: custom.name } : null,
          status: m.status,
          expiresAt: m.expiresAt,
          permissions: [...permissionsOf(m)],
          breakGlass: { available: PRETEND_BREAK_GLASS.has(`${m.tenantId}:${m.role}`), until: open ? open.endsAt : null },
        };
      }),
  });
}

async function changeMember(req, res, [id]) {
  const mine = tenantOf(req, res, "staff:manage");
  if (!mine) return;
  const body = await readJson(req);
  const keys = ["role", "customRoleId", "status", "expiresAt"];
  if (!isObject(body) || !Object.keys(body).every((k) => keys.includes(k)) || Object.keys(body).length === 0) {
    return fail(res, 400, "bad_request", BAD_REQUEST);
  }
  const target = findMember(mine, id);
  if (!target) return fail(res, 404, "not_found", "Staff member not found");
  if (target.userId === ME.userId) return fail(res, 403, "own_membership", "You can't change your own role or access. Ask another owner.");
  if (target.status === "invited") {
    return fail(res, 409, "still_invited", "This person hasn’t accepted their invitation yet. Resend or withdraw it instead.");
  }
  const next = body.role === undefined ? null : roleChoice(res, mine.tenantId, body);
  if (body.role !== undefined && !next) return;
  if (next && (cannotGrant(res, mine, permissionsOf(target)) || cannotGrant(res, mine, next.permissions))) return;
  const status = body.status ?? target.status;
  const role = next?.role ?? target.role;
  const losesOwner = target.role === "owner" && target.status === "active" && (role !== "owner" || status !== "active");
  const owners = memberships.filter((m) => m.tenantId === mine.tenantId && m.role === "owner" && m.status === "active");
  if (losesOwner && owners.length <= 1) return fail(res, 409, "last_owner", "Every tenant needs at least one active owner");
  if (next) Object.assign(target, { role: next.role, customRoleId: next.customRoleId });
  if (body.expiresAt !== undefined) target.expiresAt = body.expiresAt;
  target.status = status;
  send(res, 200, staffMember(target));
}

async function invite(req, res) {
  const mine = tenantOf(req, res, "staff:manage");
  if (!mine) return;
  const body = await readJson(req);
  if (!isObject(body) || typeof body.email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) {
    return fail(res, 400, "bad_request", BAD_REQUEST);
  }
  const choice = roleChoice(res, mine.tenantId, body);
  if (!choice || cannotGrant(res, mine, choice.permissions)) return;
  const email = body.email.trim().toLowerCase();
  const existing = memberships.find((m) => m.tenantId === mine.tenantId && m.email === email);
  if (existing && existing.status !== "invited") {
    return fail(res, 409, "already_member", "That person already has access here. Change their role instead.");
  }
  const row = existing ?? {
    membershipId: newId("20000000"),
    tenantId: mine.tenantId,
    userId: newId("00000000"),
    email,
    displayName: body.displayName ?? null,
    lastSignInAt: null,
  };
  Object.assign(row, { role: choice.role, customRoleId: choice.customRoleId, status: "invited", invitedAt: daysFromNow(0), expiresAt: body.expiresAt ?? null });
  if (!existing) memberships.push(row);
  send(res, 201, { member: staffMember(row), email: "sent" });
}

function invitation(req, res, [id], method) {
  const mine = tenantOf(req, res, "staff:manage");
  if (!mine) return;
  const target = findMember(mine, id);
  if (!target) return fail(res, 404, "not_found", "Staff member not found");
  if (target.status !== "invited") return fail(res, 409, "not_invited", "This person has already accepted their invitation");
  if (method === "DELETE") {
    memberships.splice(memberships.indexOf(target), 1);
    return send(res, 200, { membershipId: id });
  }
  target.invitedAt = daysFromNow(0);
  send(res, 200, { member: staffMember(target), email: "sent" });
}

const memberCount = (tenantId, match) => memberships.filter((m) => m.tenantId === tenantId && m.status !== "invited" && match(m)).length;
const customRoleReply = (r) => ({
  id: r.id,
  name: r.name,
  description: r.description,
  basedOn: r.basedOn,
  clinical: r.clinical,
  permissions: [...r.permissions].sort(),
  memberCount: memberCount(r.tenantId, (m) => m.customRoleId === r.id),
  updatedAt: r.updatedAt,
});

function listRoles(req, res) {
  const mine = tenantOf(req, res, "staff:read");
  if (!mine) return;
  send(res, 200, {
    startingRoles: STARTING_ROLES.map((key) => ({
      key,
      clinical: CLINICAL_ROLES.has(key),
      permissions: [...ROLE_PERMISSIONS[key]].sort(),
      memberCount: memberCount(mine.tenantId, (m) => m.role === key),
    })),
    customRoles: customRoles.filter((r) => r.tenantId === mine.tenantId).map(customRoleReply),
    permissions: PERMISSIONS.map((key) => ({ key, zone: PERMISSION_ZONES[key] })),
  });
}

function validRole(body, creating) {
  if (!isObject(body)) return false;
  const keys = creating ? ["basedOn", "name", "description", "permissions"] : ["name", "description", "permissions"];
  if (!Object.keys(body).every((k) => keys.includes(k)) || Object.keys(body).length === 0) return false;
  if (creating && !STARTING_ROLES.includes(body.basedOn)) return false;
  if ((creating || body.name !== undefined) && (typeof body.name !== "string" || !body.name.trim() || body.name.length > 60)) return false;
  if (body.permissions !== undefined && (!Array.isArray(body.permissions) || !body.permissions.every((p) => PERMISSIONS.includes(p)))) return false;
  return creating ? Array.isArray(body.permissions) : true;
}

function nameTaken(res, tenantId, name, id) {
  if (!customRoles.some((r) => r.tenantId === tenantId && r.id !== id && r.name.toLowerCase() === name.trim().toLowerCase())) return false;
  fail(res, 409, "role_name_taken", "Another role already has that name");
  return true;
}

async function createRole(req, res) {
  const mine = tenantOf(req, res, "roles:manage");
  if (!mine) return;
  const body = await readJson(req);
  if (!validRole(body, true)) return fail(res, 400, "bad_request", BAD_REQUEST);
  const permissions = [...new Set(body.permissions)].sort();
  if (cannotGrant(res, mine, permissions) || nameTaken(res, mine.tenantId, body.name)) return;
  const role = {
    id: newId("30000000"),
    tenantId: mine.tenantId,
    name: body.name.trim(),
    description: (body.description ?? "").trim(),
    basedOn: body.basedOn,
    clinical: CLINICAL_ROLES.has(body.basedOn),
    permissions,
    updatedAt: daysFromNow(0),
  };
  customRoles.push(role);
  send(res, 201, customRoleReply(role));
}

async function changeRole(req, res, [id], method) {
  const mine = tenantOf(req, res, "roles:manage");
  if (!mine) return;
  const role = customRoles.find((r) => r.tenantId === mine.tenantId && r.id === id);
  if (!role) return fail(res, 404, "not_found", "Role not found");
  if (mine.customRoleId === id) return fail(res, 403, "own_role", "You can't edit the role you hold. Ask another admin.");
  if (cannotGrant(res, mine, role.permissions)) return;
  if (method === "DELETE") {
    if (memberships.some((m) => m.customRoleId === id)) {
      return fail(res, 409, "role_in_use", "Someone still has this role. Give them another role first.");
    }
    customRoles.splice(customRoles.indexOf(role), 1);
    return send(res, 200, { roleId: id });
  }
  const body = await readJson(req);
  if (!validRole(body, false)) return fail(res, 400, "bad_request", BAD_REQUEST);
  const permissions = body.permissions === undefined ? role.permissions : [...new Set(body.permissions)].sort();
  if (cannotGrant(res, mine, permissions) || (body.name !== undefined && nameTaken(res, mine.tenantId, body.name, id))) return;
  Object.assign(role, {
    ...(body.name === undefined ? {} : { name: body.name.trim() }),
    ...(body.description === undefined ? {} : { description: body.description.trim() }),
    permissions,
    updatedAt: daysFromNow(0),
  });
  send(res, 200, customRoleReply(role));
}

/** A break-glass row as the API sends it: everything but the tenant, which the request already names. */
const breakGlassReply = (row) => {
  const reply = { ...row };
  delete reply.tenantId;
  return reply;
};

async function openOrClose(req, res, _params, method, pathname) {
  const mine = tenantOf(req, res);
  if (!mine) return;
  if (pathname.endsWith("/close")) {
    const ended = breakGlass.filter((b) => b.membershipId === mine.membershipId && Date.parse(b.endsAt) > Date.now());
    for (const row of ended) row.endsAt = new Date().toISOString();
    return send(res, 200, { breakGlass: ended.map(breakGlassReply) });
  }
  const body = await readJson(req);
  const reason = isObject(body) && typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 10 || reason.length > 500) return fail(res, 400, "bad_request", BAD_REQUEST);
  if (!PRETEND_BREAK_GLASS.has(`${mine.tenantId}:${mine.role}`)) {
    return fail(res, 409, "break_glass_not_needed", "Your role already has the access it needs, or has no clinical access to open");
  }
  const row = openBreakGlass(mine) ?? {
    breakGlassId: newId("40000000"),
    tenantId: mine.tenantId,
    membershipId: mine.membershipId,
    userId: ME.userId,
    email: ME.email,
    reason,
    openedAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    reviewedAt: null,
    reviewNote: null,
  };
  if (!breakGlass.includes(row)) breakGlass.unshift(row);
  send(res, 201, breakGlassReply(row));
}

function listBreakGlass(req, res) {
  const mine = tenantOf(req, res, "break_glass:review");
  if (!mine) return;
  const unreviewed = new URL(req.url ?? "/", "http://mock").searchParams.get("unreviewed") !== "false";
  const rows = breakGlass.filter((b) => b.tenantId === mine.tenantId && (!unreviewed || b.reviewedAt === null));
  send(res, 200, { breakGlass: rows.map(breakGlassReply) });
}

async function reviewBreakGlass(req, res, [id]) {
  const mine = tenantOf(req, res, "break_glass:review");
  if (!mine) return;
  const row = breakGlass.find((b) => b.tenantId === mine.tenantId && b.breakGlassId === id);
  if (!row) return fail(res, 404, "not_found", "Break-glass not found");
  if (row.userId === ME.userId) return fail(res, 403, "own_break_glass", "Someone else reviews your break-glass");
  const body = await readJson(req);
  Object.assign(row, { reviewedAt: new Date().toISOString(), reviewNote: isObject(body) && body.note ? String(body.note).trim() : null });
  send(res, 200, breakGlassReply(row));
}

function staffList(req, res) {
  const mine = tenantOf(req, res, "staff:read");
  if (mine) send(res, 200, { staff: memberships.filter((m) => m.tenantId === mine.tenantId).map(staffMember) });
}

function staffSignIns(req, res, [id]) {
  const mine = tenantOf(req, res, "staff:manage");
  if (!mine) return;
  if (!findMember(mine, id)) return fail(res, 404, "not_found", "Staff member");
  send(res, 200, { signIns: signIns() });
}

/** [method, path pattern, handler(req, res, params, method, pathname)] */
export const staffRoutes = [
  ["GET", /^\/v1\/me$/, me],
  ["GET", /^\/v1\/me\/sign-ins$/, (req, res) => send(res, 200, { signIns: signIns() })],
  ["GET", /^\/v1\/staff$/, staffList],
  ["POST", /^\/v1\/staff\/invitations$/, invite],
  ["PATCH", /^\/v1\/staff\/([^/]+)$/, changeMember],
  ["POST", /^\/v1\/staff\/([^/]+)\/invitation$/, invitation],
  ["DELETE", /^\/v1\/staff\/([^/]+)\/invitation$/, invitation],
  ["GET", /^\/v1\/staff\/([^/]+)\/sign-ins$/, staffSignIns],
  ["GET", /^\/v1\/roles$/, listRoles],
  ["POST", /^\/v1\/roles$/, createRole],
  ["PATCH", /^\/v1\/roles\/([^/]+)$/, changeRole],
  ["DELETE", /^\/v1\/roles\/([^/]+)$/, changeRole],
  ["POST", /^\/v1\/break-glass$/, openOrClose],
  ["POST", /^\/v1\/break-glass\/close$/, openOrClose],
  ["GET", /^\/v1\/break-glass$/, listBreakGlass],
  ["POST", /^\/v1\/break-glass\/([^/]+)\/review$/, reviewBreakGlass],
];
