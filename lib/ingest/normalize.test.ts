import { describe, expect, it } from "vitest";
import { normalizeJob, normalizeTitle, isEarlyCareerFriendly } from "./normalize";
import type { RawJob } from "@/lib/adapters/types";

const base: RawJob = {
  sourceUid: "1",
  title: "Software Engineer",
  url: "https://example.com/jobs/1",
};

describe("normalizeTitle", () => {
  it("strips trailing req IDs and parentheses", () => {
    expect(normalizeTitle("Backend Engineer (REQ-1234)")).toBe("Backend Engineer");
    expect(normalizeTitle("Data Analyst - 90210")).toBe("Data Analyst");
    expect(normalizeTitle("  Product   Manager  ")).toBe("Product Manager");
  });
});

describe("normalizeJob", () => {
  it("splits and dedupes locations, detects remote", () => {
    const j = normalizeJob(
      { ...base, location: "Remote - US", locations: ["Remote - US", "New York, NY"] },
      "ats",
    );
    expect(j.is_remote).toBe(true);
    expect(j.locations).toContain("New York, NY");
    expect(j.locations.filter((l) => l === "Remote - US")).toHaveLength(1);
  });

  it("maps employment types", () => {
    expect(normalizeJob({ ...base, employmentType: "Full-time" }, "ats").employment_type).toBe("full_time");
    expect(normalizeJob({ ...base, employmentType: "Contract" }, "ats").employment_type).toBe("contract");
  });

  it("ignores bogus posted dates", () => {
    expect(normalizeJob({ ...base, postedAt: "0001-01-01" }, "ats").posted_at).toBeNull();
    expect(normalizeJob({ ...base, postedAt: "2025-03-01T00:00:00Z" }, "ats").posted_at).toBe(
      "2025-03-01T00:00:00.000Z",
    );
  });

  it("carries confidence through", () => {
    expect(normalizeJob({ ...base, confidence: 0.5 }, "ai").confidence).toBe(0.5);
  });
});

describe("isEarlyCareerFriendly", () => {
  it("needs a meaningful share of early-career roles", () => {
    const mk = (early: boolean) => normalizeJob({ ...base, title: early ? "SWE Intern" : "Staff SWE" }, "ats");
    expect(isEarlyCareerFriendly([mk(true), mk(true), mk(true), mk(false)])).toBe(true);
    expect(isEarlyCareerFriendly([mk(false), mk(false), mk(false), mk(false)])).toBe(false);
  });
});
