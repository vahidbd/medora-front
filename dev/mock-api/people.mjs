/**
 * The mock API's made-up tenants, staff and roles, held in memory and
 * reset on every start. Shapes follow the API's contract
 * (medora-backend/contract/openapi.json); every person here is invented.
 */

export const TENANT_HEADER = "x-medora-tenant";

export const STARTING_ROLES = [
  "owner",
  "admin",
  "medical_director",
  "prescriber",
  "clinician",
  "support",
  "finance",
  "operations",
  "marketing",
  "compliance",
];
export const CLINICAL_ROLES = new Set(["prescriber", "clinician", "medical_director"]);
export const PERMISSIONS = [
  "staff:read",
  "staff:manage",
  "roles:manage",
  "break_glass:review",
  "tenant:manage",
  "brands:manage",
  "catalogue:read",
  "catalogue:manage",
];
export const PERMISSION_ZONES = Object.fromEntries(
  PERMISSIONS.map((key) => [key, key.startsWith("catalogue:") ? "operational" : "platform"]),
);

/** As the API's ROLE_PERMISSIONS (src/lib/permissions.ts). */
export const ROLE_PERMISSIONS = {
  owner: [...PERMISSIONS],
  admin: ["staff:read", "staff:manage", "roles:manage", "tenant:manage", "brands:manage", "catalogue:read", "catalogue:manage"],
  medical_director: ["staff:read", "break_glass:review", "catalogue:read"],
  prescriber: ["staff:read", "catalogue:read"],
  clinician: ["staff:read", "catalogue:read"],
  support: ["staff:read", "catalogue:read"],
  finance: ["staff:read", "catalogue:read"],
  operations: ["staff:read", "catalogue:read", "catalogue:manage"],
  marketing: ["staff:read", "catalogue:read"],
  compliance: ["staff:read", "catalogue:read"],
};

// The preview person. The mock Clerk session (dev/mock-clerk) is the same person.
// Also platform staff, so preview shows the platform screens (docs/decisions/admin.md ADM15).
export const ME = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "owner@example.test",
  displayName: "Alex Morgan",
  platformStaff: true,
};

export const TENANTS = [
  {
    tenantId: "10000000-0000-4000-8000-000000000001",
    tenantName: "Harbour Health (demo)",
    timeZone: "Australia/Sydney",
    createdAt: "2026-10-01T00:00:00.000Z",
  },
  {
    tenantId: "10000000-0000-4000-8000-000000000002",
    tenantName: "Coastal Skin (demo)",
    timeZone: "Australia/Brisbane",
    createdAt: "2026-10-15T00:00:00.000Z",
  },
];
const [harbour, coastal] = TENANTS.map((t) => t.tenantId);

const DAY = 24 * 60 * 60 * 1000;
export const daysFromNow = (days) => new Date(Date.now() + days * DAY).toISOString();
export const INVITATION_DAYS = 14;

let nextId = 1;
export const newId = (prefix) => `${prefix}-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;
const person = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const customRoles = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    tenantId: harbour,
    name: "Weekend support",
    description: "Covers the weekend queue. Sees staff, nothing else yet.",
    basedOn: "support",
    clinical: false,
    permissions: ["staff:read"],
    updatedAt: daysFromNow(-12),
  },
];

function member(tenantId, userId, email, displayName, role, extra = {}) {
  return {
    membershipId: newId("20000000"),
    tenantId,
    userId,
    email,
    displayName,
    role,
    customRoleId: null,
    status: "active",
    invitedAt: null,
    expiresAt: null,
    lastSignInAt: daysFromNow(-1),
    ...extra,
  };
}

export const memberships = [
  member(harbour, ME.userId, ME.email, ME.displayName, "owner", { lastSignInAt: daysFromNow(0) }),
  member(harbour, person(9), "jamie.ross@example.test", "Jamie Ross", "owner"),
  member(harbour, person(2), "sam.lee@example.test", "Sam Lee", "clinician"),
  member(harbour, person(3), "jordan.patel@example.test", "Jordan Patel", "prescriber"),
  member(harbour, person(4), "riley.chen@example.test", "Riley Chen", "support"),
  member(harbour, person(5), "casey.nguyen@example.test", null, "finance"),
  member(harbour, person(6), "drew.walker@example.test", "Drew Walker", "support", { status: "suspended", lastSignInAt: daysFromNow(-40) }),
  member(harbour, person(10), "robin.ellis@example.test", "Robin Ellis", "clinician", { expiresAt: daysFromNow(30) }),
  member(harbour, person(11), "blake.young@example.test", "Blake Young", "custom", {
    customRoleId: "30000000-0000-4000-8000-000000000001",
  }),
  member(harbour, person(12), "avery.kim@example.test", "Avery Kim", "support", {
    status: "invited",
    invitedAt: daysFromNow(-3),
    lastSignInAt: null,
  }),
  member(harbour, person(13), "quinn.harper@example.test", null, "operations", {
    status: "invited",
    invitedAt: daysFromNow(-20),
    lastSignInAt: null,
  }),
  member(coastal, ME.userId, ME.email, ME.displayName, "clinician"),
  member(coastal, person(7), "morgan.brooks@example.test", "Morgan Brooks", "owner"),
  member(coastal, person(8), "taylor.reid@example.test", "Taylor Reid", "clinician"),
];

/**
 * Break-glass. No clinical permission exists yet, so the real API offers
 * break-glass to nobody until a module adds one. Preview pretends the
 * owner's role at Harbour holds one, so its screens can be seen and tested.
 */
export const PRETEND_BREAK_GLASS = new Set([`${harbour}:owner`]);

export const breakGlass = [
  {
    breakGlassId: "40000000-0000-4000-8000-000000000001",
    tenantId: harbour,
    membershipId: memberships[1].membershipId,
    userId: memberships[1].userId,
    email: memberships[1].email,
    reason: "Looking into complaint 2 about a delayed order",
    openedAt: daysFromNow(-2),
    endsAt: new Date(Date.parse(daysFromNow(-2)) + 60 * 60 * 1000).toISOString(),
    reviewedAt: null,
    reviewNote: null,
  },
];

/** Recent sign-ins: the same made-up history for everyone, from documentation addresses (RFC 5737). */
export const signIns = () =>
  [0, 1, 3, 6].map((days, i) => ({
    at: daysFromNow(-days),
    clientIp: `203.0.113.${10 + i}`,
    device: i % 2 === 0 ? "Safari on macOS" : "Chrome on Windows",
    secondFactor: true,
  }));
