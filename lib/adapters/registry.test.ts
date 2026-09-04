import { describe, expect, it } from "vitest";
import { detectAts } from "./registry";

describe("detectAts", () => {
  it("recognises Greenhouse board URLs", () => {
    expect(detectAts("https://boards.greenhouse.io/stripe")).toEqual({
      atsType: "greenhouse",
      atsSlug: "stripe",
    });
    expect(detectAts("https://job-boards.greenhouse.io/figma/jobs/123")).toEqual({
      atsType: "greenhouse",
      atsSlug: "figma",
    });
  });

  it("recognises Lever URLs", () => {
    expect(detectAts("https://jobs.lever.co/palantir/abc-123")).toEqual({
      atsType: "lever",
      atsSlug: "palantir",
    });
  });

  it("recognises Ashby URLs", () => {
    expect(detectAts("https://jobs.ashbyhq.com/ramp")).toEqual({
      atsType: "ashby",
      atsSlug: "ramp",
    });
  });

  it("recognises Recruitee + Personio subdomains", () => {
    expect(detectAts("https://acme.recruitee.com/o/backend-engineer")).toEqual({
      atsType: "recruitee",
      atsSlug: "acme",
    });
    expect(detectAts("https://acme.jobs.personio.de/")).toEqual({
      atsType: "personio",
      atsSlug: "acme",
    });
  });

  it("parses a Workday composite slug", () => {
    expect(
      detectAts("https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite"),
    ).toEqual({ atsType: "workday", atsSlug: "nvidia::wd5::NVIDIAExternalCareerSite" });
  });

  it("returns null for unknown hosts", () => {
    expect(detectAts("https://example.com/careers")).toBeNull();
  });
});
