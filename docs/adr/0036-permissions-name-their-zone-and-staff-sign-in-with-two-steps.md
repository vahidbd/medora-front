# 0036. Permissions name their data zone, clinical ones need a clinical role or break-glass, and every staff session has two steps

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: ADM-03, ADM-06, ADM-07
- Regulation: Privacy Act 1988 (APP 11)
- Sign-off: needed (permissions and patient data)

## Context

[0030](0030-security-baseline-from-the-first-route.md) says someone in every tenant always holds full access, and that only someone who holds a permission may grant it. The PRD also says a tenant's owner sees no clinical notes by default, that anyone outside the care team reaches clinical data only through a logged and reviewed break-glass, that tenants make their own roles, that only people change access, and that every staff member signs in with a second factor. A role key on its own can't say which of its permissions open clinical data, and a tenant-made role must not slip clinical access to a business role.

## Decision

- **Every permission names the data zone it opens** (`PERMISSION_ZONES` in `src/lib/permissions.ts`): `clinical`, `operational`, `marketing` or `platform` ([0007](0007-three-data-zones.md)). A module that adds a permission adds its zone in the same pull request.
- **Starting roles live in code, custom roles in the tenant's data.** `ROLES` and `ROLE_PERMISSIONS` are the same for every tenant and can't be edited there. A custom role is a row in `platform.roles`, copied from a starting role, and a membership on it has `role = 'custom'` and `custom_role_id`. Code checks permissions, never role keys.
- **Clinical permissions need a clinical role.** A clinical-zone permission is usable only by `prescriber`, `clinician`, `medical_director`, or a custom role copied from one of them. Anyone else whose role holds one, the owner included, opens break-glass first: a reason, 60 minutes, an audit entry and an event, then a review by someone else who holds `break_glass:review`. The auth plugin applies this rule for every route, and a refused request answers `break_glass_required`.
- **Only people change access** ([0012](0012-ai-agents-act-through-the-api-as-a-role.md)). Inviting, changing a membership and editing a role have no agent tool, their services refuse any actor that isn't a person, and `AGENT_FORBIDDEN_PERMISSIONS` lists the keys no agent role may hold. Editing a role is granting: the editor must hold both its old and its new permissions, and nobody edits the role they hold.
- **Every staff session has two steps.** A route that acts in a tenant refuses a token without a verified second factor (`two_step_required`). There is no setting to turn this off, per tenant or per role.
- **Medora decides access, the sign-in service only proves identity** ([0011](0011-clerk-signs-in-staff-and-patients.md)). An invitation becomes a membership on the person's next sign-in within 14 days, and a membership can carry an end date after which it stops working.

## Consequences

- A tenant can make any role it needs without a release, and a starting role gains a new module's permissions everywhere at once.
- Every clinical module inherits break-glass and the role rule by adding its keys with the `clinical` zone; none writes its own check.
- An owner who needs a patient's notes for a complaint or an incident opens break-glass and is reviewed. That is slower by design.
- Staff can't work until they have set up a second factor. Sign-in service settings must allow it and require it (`docs/launch-checklist.md`).
- Owed: break-glass can be tried end to end only once the first clinical-zone permission exists; until then unit tests use injected zones.

## Where it lives

- `src/lib/permissions.ts` (`PERMISSION_ZONES`, `ROLE_PERMISSIONS`, `CLINICAL_ROLES`, `usablePermissions`, `assertCanGrant`), `src/plugins/auth.ts`, `src/plugins/route-rules.ts` (`access: 'member'`).
- `platform.roles`, `platform.memberships` (`custom_role_id`, `invited_at`, `expires_at`), `platform.break_glass`, `platform.sign_ins`, and `platform.my_access()` and `platform.accept_invitations()` in `src/db/migrations/0002_staff_access.sql`.
- `src/modules/staff/` (roles, invitations, break-glass), `test/unit/permissions.test.ts`, `test/integration/staff-access.test.ts`.
- Frontend: the staff and roles screens and `can(permission)`, which only reflect what the API decides.
- Rulings: `docs/decisions/admin.md` ADM1 to ADM8.
