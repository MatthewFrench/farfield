import { describe, expect, it } from "vitest";
import { DateValueFormatter } from "@/Application/DomainModel/DateValueFormatter";

describe("DateValueFormatter", () => {
  it("formats same-day UNIX-second values with explicit locale and time zone", () => {
    const formatter = new DateValueFormatter({
      locales: "en-US",
      timeZone: "UTC",
      readCurrentDate: () => new Date("1970-01-01T05:00:00.000Z"),
    });

    expect(formatter.format(0)).toBe("12:00 AM");
    expect(formatter.format(3_600)).toBe("01:00 AM");
  });

  it("formats older timestamps as compact day-age labels", () => {
    const formatter = new DateValueFormatter({
      locales: "en-US",
      timeZone: "UTC",
      readCurrentDate: () => new Date("1970-01-03T00:00:00.000Z"),
    });

    expect(formatter.format(0)).toBe("2d ago");
    expect(formatter.format(86_400)).toBe("1d ago");
  });

  it("formats same-day ISO timestamps and preserves invalid strings", () => {
    const formatter = new DateValueFormatter({
      locales: "en-US",
      timeZone: "UTC",
      readCurrentDate: () => new Date("1970-01-01T14:00:00.000Z"),
    });

    expect(formatter.format("1970-01-01T13:05:00.000Z")).toBe("01:05 PM");
    expect(formatter.format("not-a-date")).toBe("not-a-date");
  });

  it("returns empty text for missing values", () => {
    const formatter = new DateValueFormatter();

    expect(formatter.format(null)).toBe("");
    expect(formatter.format(undefined)).toBe("");
  });
});
