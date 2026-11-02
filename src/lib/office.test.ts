import { describe, expect, it } from "vitest";
import {
  fileFolder,
  fileName,
  fileStem,
  nameProblem,
  officeKind,
  parseCsv,
  saveBody,
  siblingPath,
  writeCsv,
} from "./office";

describe("officeKind", () => {
  it("knows each file type, in any case", () => {
    expect(officeKind("C:\\a\\Report.DOCX")).toBe("word");
    expect(officeKind("C:\\a\\numbers.xlsx")).toBe("sheet");
    expect(officeKind("C:\\a\\numbers.csv")).toBe("sheet");
    expect(officeKind("C:\\a\\paper.pdf")).toBe("pdf");
  });

  it("leaves everything else alone", () => {
    expect(officeKind("C:\\a\\talk.pwpptx")).toBeNull();
    expect(officeKind("C:\\a\\page.html")).toBeNull();
    expect(officeKind("C:\\a.pdf\\no-extension")).toBeNull();
  });
});

describe("paths", () => {
  it("splits a Windows path", () => {
    expect(fileName("C:\\a\\b\\Report.docx")).toBe("Report.docx");
    expect(fileFolder("C:\\a\\b\\Report.docx")).toBe("C:\\a\\b");
  });
});

describe("renaming", () => {
  it("edits the name without its type", () => {
    expect(fileStem("C:\\a\\Term 1.notes.docx")).toBe("Term 1.notes");
  });

  it("stays in the same folder", () => {
    expect(siblingPath("C:\\a\\b\\old.pdf", "new.pdf")).toBe("C:\\a\\b\\new.pdf");
  });

  it("refuses names Windows refuses", () => {
    expect(nameProblem("Term 1 notes")).toBeNull();
    expect(nameProblem("a/b")).not.toBeNull();
    expect(nameProblem("what?")).not.toBeNull();
    expect(nameProblem("ends with dot.")).not.toBeNull();
    expect(nameProblem("CON")).not.toBeNull();
  });
});

describe("saveBody", () => {
  it("puts the length of the path first", () => {
    const body = saveBody("C:/é.pdf", new Uint8Array([9, 8]));
    expect(new DataView(body.buffer).getUint32(0, true)).toBe(9);
    expect(new TextDecoder().decode(body.subarray(4, 13))).toBe("C:/é.pdf");
    expect([...body.subarray(13)]).toEqual([9, 8]);
  });
});

describe("CSV", () => {
  it("reads plain rows, with either line ending", () => {
    expect(parseCsv("a,b\r\nc,d\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("keeps commas, quotes and line breaks inside a quoted cell", () => {
    expect(parseCsv('"Smith, John","say ""hi""","two\nlines"')).toEqual([
      ["Smith, John", 'say "hi"', "two\nlines"],
    ]);
  });

  it("keeps empty cells and drops the Excel byte-order mark", () => {
    expect(parseCsv("\uFEFFa,,c")).toEqual([["a", "", "c"]]);
  });

  it("writes what it reads", () => {
    const rows = [
      ["Smith, John", 'say "hi"'],
      ["two\nlines", ""],
    ];
    expect(parseCsv(writeCsv(rows))).toEqual(rows);
  });
});
