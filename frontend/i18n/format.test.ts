import { describe, expect, it } from "vitest";
import { formatClock, formatDate, formatDateTime, formatFileSize, formatNumber, formatTwoDigits } from "./format";

describe("format helpers", () => {
  it("writes numbers with Bangla digits in Bangla", () => {
    expect(formatNumber(2026, "bn")).toBe("২,০২৬");
    expect(formatNumber(2026, "en")).toBe("2,026");
    // Bangla groups lakhs and crores.
    expect(formatNumber(1234567, "bn")).toBe("১২,৩৪,৫৬৭");
  });

  it("pads to two digits", () => {
    expect(formatTwoDigits(7, "bn")).toBe("০৭");
    expect(formatTwoDigits(7, "en")).toBe("07");
  });

  it("shows file sizes in the largest whole unit (FND-15, FND-16)", () => {
    expect(formatFileSize(1.4 * 1024 * 1024, "en")).toBe("1.4 MB");
    expect(formatFileSize(500 * 1024 * 1024, "bn")).toBe("৫০০ MB");
    expect(formatFileSize(50 * 1024 ** 3, "en")).toBe("50 GB");
    expect(formatFileSize(12_800, "en")).toBe("13 kB");
    expect(formatFileSize(0, "en")).toBe("0 byte");
  });

  it("shows a countdown as MM:SS", () => {
    expect(formatClock(65, "en")).toBe("01:05");
    expect(formatClock(65, "bn")).toBe("০১:০৫");
    expect(formatClock(-3, "en")).toBe("00:00");
  });

  it("shows dates in Dhaka time, not the device's", () => {
    // 20:30 UTC on 23 Oct is already 24 Oct (02:30) in Dhaka.
    const lateEvening = "2026-10-23T20:30:00.000Z";
    expect(formatDate(lateEvening, "en")).toBe("24 Oct 2026");
    expect(formatDate(lateEvening, "bn")).toContain("২৪");
    expect(formatDateTime(lateEvening, "en")).toBe("24 Oct 2026, 02:30");
    expect(formatDateTime("2026-10-24T09:30:00.000Z", "bn")).toBe("২৪ অক্টো, ২০২৬, ১৫:৩০");
  });
});
