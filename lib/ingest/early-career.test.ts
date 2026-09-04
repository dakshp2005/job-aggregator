import { describe, expect, it } from "vitest";
import { classifyEarlyCareer } from "./early-career";

describe("classifyEarlyCareer", () => {
  const ec = (t: string, ...rest: (string | null | undefined)[]) =>
    classifyEarlyCareer(t, rest[0], rest[1], rest[2]).isEarlyCareer;

  it("flags internships and new-grad roles", () => {
    expect(ec("Software Engineer Intern")).toBe(true);
    expect(ec("2025 New Grad Software Engineer")).toBe(true);
    expect(ec("Graduate Data Analyst")).toBe(true);
    expect(ec("Associate Software Engineer (Campus)")).toBe(true);
    expect(ec("Apprentice Developer")).toBe(true);
    expect(ec("Software Engineer I")).toBe(true);
  });

  it("does not flag senior / staff / lead roles", () => {
    expect(ec("Senior Software Engineer")).toBe(false);
    expect(ec("Staff ML Engineer")).toBe(false);
    expect(ec("Engineering Manager, New Products")).toBe(false);
    expect(ec("Principal Architect")).toBe(false);
    expect(ec("Software Engineer II")).toBe(false);
  });

  it("respects an explicit intern employment type", () => {
    expect(ec("Software Engineer", null, "Internship")).toBe(true);
  });

  it("uses the description for entry-level signals", () => {
    expect(ec("Software Engineer", "This is an entry-level role, 0-2 years experience.")).toBe(true);
    expect(ec("Software Engineer", "Requires 6+ years of experience.")).toBe(false);
  });

  it("returns a plausible experience level", () => {
    expect(classifyEarlyCareer("Senior Backend Engineer").experienceLevel).toBe("senior");
    expect(classifyEarlyCareer("Data Science Intern").experienceLevel).toBe("intern");
  });
});
