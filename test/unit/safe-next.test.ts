import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("safeNext", () => {
  it("keeps a path on this app, with its query", () => {
    expect(safeNext("/staff")).toBe("/staff");
    expect(safeNext("/staff?page=2#top")).toBe("/staff?page=2#top");
    expect(safeNext(["/staff", "/home"])).toBe("/staff");
  });

  it.each([
    ["nothing", undefined],
    ["another site", "https://elsewhere.example"],
    ["a protocol-relative address", "//elsewhere.example"],
    ["a backslash the browser reads as a slash", "/\\elsewhere.example"],
    ["a tab the browser drops", "/\t/elsewhere.example"],
    ["a newline the browser drops", "/\n/elsewhere.example"],
    ["a script address", "javascript:alert(1)"],
  ])("sends %s to Home", (_name, next) => {
    expect(safeNext(next)).toBe("/home");
  });
});
