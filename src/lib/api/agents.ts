import { request } from "./client";
import type { AgentChange, AgentConversation, AgentKind, AgentRun, AgentsReply, AgentSummary, ApproveInput, DecisionReason, Proposal } from "./types";

const id = (value: string) => encodeURIComponent(value);

export const agentsApi = {
  list: (tenant: string) => request<AgentsReply>("/agents", { tenant }),
  change: (tenant: string, agent: AgentKind, change: AgentChange) =>
    request<AgentSummary>(`/agents/${id(agent)}`, { method: "PATCH", body: change, tenant }),
  /** Every agent in the tenant stops; resuming brings back each one's own setting. */
  pause: (tenant: string) => request<{ paused: boolean }>("/agents/pause", { method: "POST", tenant }),
  resume: (tenant: string) => request<{ paused: boolean }>("/agents/resume", { method: "POST", tenant }),
  runs: async (tenant: string) => (await request<{ runs: AgentRun[] }>("/agent-runs", { tenant })).runs,
  /** The model-side transcript. Every read is audited by the API. */
  conversation: (tenant: string, conversationId: string) =>
    request<AgentConversation>(`/agent-conversations/${id(conversationId)}`, { tenant }),
};

export const proposalsApi = {
  /** Only the proposals the viewer could approve. */
  list: async (tenant: string, state: "pending" | "decided") =>
    (await request<{ proposals: Proposal[] }>(`/agent-proposals?state=${state}`, { tenant })).proposals,
  approve: (tenant: string, proposalId: string, input: ApproveInput) =>
    request<Proposal>(`/agent-proposals/${id(proposalId)}/approve`, { method: "POST", body: input, tenant }),
  reject: (tenant: string, proposalId: string, reason: DecisionReason) =>
    request<Proposal>(`/agent-proposals/${id(proposalId)}/reject`, { method: "POST", body: { reason }, tenant }),
};
