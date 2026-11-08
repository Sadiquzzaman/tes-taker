import { describe, expect, it } from "vitest";
import { classLabel } from "./classLabel";

describe("classLabel", () => {
  it("names a class by its subject and section, or by the section alone", () => {
    expect(classLabel({ section: { name: "A", class_name: "Class 6" }, subject: { name: "Mathematics" } })).toBe("Mathematics · Class 6 A");
    expect(classLabel({ section: { name: "A", class_name: "Class 6" }, subject: null })).toBe("Class 6 A");
    expect(classLabel({ section: { name: "A", class_name: "Class 6" } })).toBe("Class 6 A");
  });
});
