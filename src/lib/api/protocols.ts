import { request } from "./client";
import type { NewProgram, NewProtocol, Program, ProgramChange, ProtocolDetail, ProtocolSummary, ProtocolTemplate, ProtocolVersion, SignOff } from "./types";

const id = (value: string) => encodeURIComponent(value);

/** Protocols, their versions and sign-off (docs/decisions/intake.md INT1 to INT4, INT10). */
export const protocolsApi = {
  templates: async (tenant: string) => (await request<{ templates: ProtocolTemplate[] }>("/protocol-templates", { tenant })).templates,
  list: async (tenant: string) => (await request<{ protocols: ProtocolSummary[] }>("/protocols", { tenant })).protocols,
  get: (tenant: string, protocolId: string) => request<ProtocolDetail>(`/protocols/${id(protocolId)}`, { tenant }),
  version: (tenant: string, protocolId: string, version: number) =>
    request<ProtocolVersion>(`/protocols/${id(protocolId)}/versions/${version}`, { tenant }),
  create: (tenant: string, input: NewProtocol) => request<ProtocolDetail>("/protocols", { method: "POST", body: input, tenant }),
  startDraft: (tenant: string, protocolId: string) => request<ProtocolVersion>(`/protocols/${id(protocolId)}/draft`, { method: "POST", tenant }),
  saveDraft: (tenant: string, protocolId: string, definition: Record<string, unknown>) =>
    request<ProtocolVersion>(`/protocols/${id(protocolId)}/draft`, { method: "PUT", body: { definition }, tenant }),
  signOff: (tenant: string, protocolId: string, input: SignOff) =>
    request<ProtocolVersion>(`/protocols/${id(protocolId)}/sign-off`, { method: "POST", body: input, tenant }),
  withdraw: (tenant: string, protocolId: string, reason: string) =>
    request<ProtocolVersion>(`/protocols/${id(protocolId)}/withdraw`, { method: "POST", body: { reason }, tenant }),
};

/** Programs: one brand's offer on one protocol (INT9). */
export const programsApi = {
  list: async (tenant: string) => (await request<{ programs: Program[] }>("/programs", { tenant })).programs,
  create: (tenant: string, input: NewProgram) => request<Program>("/programs", { method: "POST", body: input, tenant }),
  change: (tenant: string, programId: string, change: ProgramChange) =>
    request<Program>(`/programs/${id(programId)}`, { method: "PATCH", body: change, tenant }),
};
