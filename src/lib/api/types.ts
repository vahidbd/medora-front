import type { paths } from "./schema";

/*
 * Names for the API's shapes, all taken from the generated contract
 * (schema.d.ts, ADR 0014). A shape the API changes changes here at once,
 * and the type check finds every screen it touches.
 */

type Json<T> = T extends { content: { "application/json": infer Body } } ? Body : never;
type Reply<Path extends keyof paths, Method extends keyof paths[Path]> = paths[Path][Method] extends { responses: { 200: infer R } }
  ? Json<R>
  : never;
type Created<Path extends keyof paths, Method extends keyof paths[Path]> = paths[Path][Method] extends { responses: { 201: infer R } }
  ? Json<R>
  : never;
type RequestBody<Path extends keyof paths, Method extends keyof paths[Path]> = paths[Path][Method] extends {
  requestBody?: { content: { "application/json": infer Body } };
}
  ? Body
  : never;

/** The signed-in person and the tenants they belong to (GET /v1/me). */
export type Me = Reply<"/v1/me", "get">;
export type Membership = Me["memberships"][number];
export type Role = Membership["role"];
export type MembershipStatus = Membership["status"];
export type Permission = Membership["permissions"][number];

/** A tenant's staff (GET /v1/staff). */
export type StaffMember = Reply<"/v1/staff", "get">["staff"][number];
export type MembershipChange = RequestBody<"/v1/staff/{membershipId}", "patch">;
export type StaffList = Reply<"/v1/staff", "get">;
export type SignIn = Reply<"/v1/me/sign-ins", "get">["signIns"][number];

/** Inviting someone (POST /v1/staff/invitations): the member, and whether the email went out. */
export type InvitationInput = RequestBody<"/v1/staff/invitations", "post">;
export type InvitationReply = Created<"/v1/staff/invitations", "post">;

/** Roles (GET /v1/roles): the starting roles, the tenant's custom roles and every permission with its zone. */
export type RolesReply = Reply<"/v1/roles", "get">;
export type StartingRole = RolesReply["startingRoles"][number];
export type StartingRoleKey = StartingRole["key"];
export type CustomRole = RolesReply["customRoles"][number];
export type DataZone = RolesReply["permissions"][number]["zone"];
export type RoleInput = RequestBody<"/v1/roles", "post">;
export type RoleUpdate = RequestBody<"/v1/roles/{roleId}", "patch">;

/** Break-glass (ADR 0036): opened by the person, reviewed by someone else. */
export type BreakGlassRecord = Reply<"/v1/break-glass", "get">["breakGlass"][number];

/** Agents (ADR 0037): each agent's settings, why it is off, its tools and this month's use (GET /v1/agents). */
export type AgentsReply = Reply<"/v1/agents", "get">;
export type AgentSummary = AgentsReply["agents"][number];
export type AgentKind = AgentSummary["agent"];
export type AgentChannel = AgentSummary["channels"][number];
export type AgentToolLine = AgentSummary["tools"][number];
export type AgentOffReason = NonNullable<AgentSummary["off"]>;
export type AgentEvals = AgentSummary["evals"];
export type AgentChange = RequestBody<"/v1/agents/{agent}", "patch">;

/** Runs: metadata, cost and how each ended, never text (GET /v1/agent-runs). */
export type AgentRun = Reply<"/v1/agent-runs", "get">["runs"][number];
export type AgentRunStatus = AgentRun["status"];
export type AgentRunTrigger = AgentRun["trigger"];

/** One conversation as the model saw it, for agents:transcripts (GET /v1/agent-conversations/{id}). */
export type AgentConversation = Reply<"/v1/agent-conversations/{conversationId}", "get">;
export type AgentMessage = AgentConversation["messages"][number];
export type AgentMessageRole = AgentMessage["role"];
export type AgentBlock = AgentMessage["blocks"][number];

/** Proposals: a change an agent wants made, shown as an approval card (GET /v1/agent-proposals). */
export type Proposal = Reply<"/v1/agent-proposals/{proposalId}", "get">;
export type ProposalStatus = Proposal["status"];
export type ApproveInput = RequestBody<"/v1/agent-proposals/{proposalId}/approve", "post">;
export type DecisionReason = RequestBody<"/v1/agent-proposals/{proposalId}/reject", "post">["reason"];
