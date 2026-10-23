import { act, cleanup, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { useIsClient, useStorageItem } from "./useBrowserStorage";

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

describe("useIsClient", () => {
  it("is false when rendered on the server", () => {
    const Probe = () => <span>{String(useIsClient())}</span>;

    expect(renderToString(<Probe />)).toContain("false");
  });

  it("is true in the browser", () => {
    const { result } = renderHook(() => useIsClient());

    expect(result.current).toBe(true);
  });
});

describe("useStorageItem", () => {
  it("returns undefined on the server, so markup does not depend on storage", () => {
    localStorage.setItem("user", "stored");
    const Probe = () => <span>{String(useStorageItem("local", "user"))}</span>;

    expect(renderToString(<Probe />)).toContain("undefined");
  });

  it("reads localStorage and sessionStorage in the browser", () => {
    localStorage.setItem("user", '{"full_name":"Nadia"}');
    sessionStorage.setItem("testId", "t1");

    expect(renderHook(() => useStorageItem("local", "user")).result.current).toBe('{"full_name":"Nadia"}');
    expect(renderHook(() => useStorageItem("session", "testId")).result.current).toBe("t1");
    expect(renderHook(() => useStorageItem("session", "missing")).result.current).toBeNull();
  });

  it("updates when another tab changes the value", () => {
    const { result } = renderHook(() => useStorageItem("local", "user"));
    expect(result.current).toBeNull();

    act(() => {
      localStorage.setItem("user", "changed");
      window.dispatchEvent(new StorageEvent("storage", { key: "user" }));
    });

    expect(result.current).toBe("changed");
  });
});
