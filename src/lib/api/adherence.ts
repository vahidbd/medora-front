import { request } from "./client";
import type { AdherenceFlag, AdherenceFlagDetail, AdherenceFlagResolution, AdherenceFlagStatus, CareTeamSideEffect } from "./types";

const id = (value: string) => encodeURIComponent(value);

/**
 * The care team's adherence flags (docs/decisions/adherence.md in
 * medora-backend). The list carries no patient words; reading one flag,
 * and the side effect behind it, is the audited step that does (ADH10).
 */
export const adherenceApi = {
  list: async (tenant: string, status: AdherenceFlagStatus) =>
    (await request<{ adherenceFlags: AdherenceFlag[] }>(`/adherence/flags?status=${status}`, { tenant })).adherenceFlags,
  get: (tenant: string, adherenceFlagId: string) => request<AdherenceFlagDetail>(`/adherence/flags/${id(adherenceFlagId)}`, { tenant }),
  resolve: (tenant: string, adherenceFlagId: string, resolution: AdherenceFlagResolution) =>
    request<AdherenceFlagDetail>(`/adherence/flags/${id(adherenceFlagId)}/resolve`, { method: "POST", body: resolution, tenant }),
  /** Undoes a mistaken resolution with a new open adherence flag; the resolved one stays as it was (ADH7). */
  reopen: (tenant: string, adherenceFlagId: string) =>
    request<AdherenceFlagDetail>(`/adherence/flags/${id(adherenceFlagId)}/reopen`, { method: "POST", tenant }),
  sideEffect: (tenant: string, sideEffectId: string) => request<CareTeamSideEffect>(`/side-effects/${id(sideEffectId)}`, { tenant }),
};
