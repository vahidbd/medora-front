import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("writes a header and rows, each line ending in CRLF, with null as an empty cell", () => {
    expect(
      toCsv(
        ["a", "b"],
        [
          [1, null],
          [true, "x"],
        ],
      ),
    ).toBe("a,b\r\n1,\r\ntrue,x\r\n");
  });

  it("quotes a cell with a comma, a quote or a line break, doubling its quotes", () => {
    expect(toCsv(["v"], [["one, two"], ['say "hi"'], ["line\nbreak"]])).toBe('v\r\n"one, two"\r\n"say ""hi"""\r\n"line\nbreak"\r\n');
  });

  it("starts a text cell a spreadsheet would run as a formula with an apostrophe", () => {
    expect(toCsv(["v"], [["=SUM(A1)"], ["+61"], ["-x"], ["@cmd"], ["\tx"]])).toBe("v\r\n'=SUM(A1)\r\n'+61\r\n'-x\r\n'@cmd\r\n'\tx\r\n");
  });

  it("leaves numbers alone, negative ones too", () => {
    expect(toCsv(["v"], [[-5], [8900]])).toBe("v\r\n-5\r\n8900\r\n");
  });
});
