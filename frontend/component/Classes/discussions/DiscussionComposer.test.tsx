import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LockedFeatureProvider from "@/component/Subscription/LockedFeatureProvider";
import { renderApp } from "@/i18n/test-utils";
import DiscussionComposer from "./DiscussionComposer";

type Uploaded = { id: string; key: string; url: string; file_name: string; mime_type: string; size: number; kind: "file"; storage_warning: boolean };

const uploadMedia = vi.fn();
vi.mock("@/utils/media/uploadMedia", () => ({
  uploadMedia: (...args: unknown[]) => uploadMedia(...args),
  resolveMediaUrl: (url: string) => url,
}));
vi.mock("@/hooks/organization/useBillingAccess", () => ({ default: () => ({ role: "TEACHER", canManageBilling: true }) }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

const pick = (name = "notes.pdf") => {
  const input = document.querySelector('input[type="file"][accept^=".pdf"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["%PDF-1.4"], name, { type: "application/pdf" })] } });
};

describe("DiscussionComposer uploads (FND-15, FND-16)", () => {
  it("shows upload progress, then the file with its final size and the 90% storage warning", async () => {
    let finish: (value: Uploaded) => void = () => {};
    uploadMedia.mockImplementation((_purpose: string, _file: File, _classId: string, options: { onProgress: (p: number) => void }) => {
      options.onProgress(42);
      return new Promise<Uploaded>((resolve) => (finish = resolve));
    });
    renderApp(<DiscussionComposer classId="class-1" onSubmit={vi.fn()} />);

    pick();
    expect(await screen.findByText("Uploading… 42%")).toBeTruthy();
    expect(uploadMedia.mock.calls[0][2]).toBe("class-1");

    await act(async () =>
      finish({ id: "f-1", key: "f-1", url: "/api/v1/files/f-1/content", file_name: "notes.pdf", mime_type: "application/pdf", size: 2048, kind: "file", storage_warning: true }),
    );
    expect(screen.getByText("notes.pdf")).toBeTruthy();
    expect(screen.getByText("2.0 KB")).toBeTruthy();
    expect(screen.getByText("Your workspace has used 90% of its storage. Uploads stop when it is full.")).toBeTruthy();
    expect(screen.queryByText(/Uploading/)).toBeNull();
  });

  it("opens the plan-limit dialog when the storage is full", async () => {
    uploadMedia.mockRejectedValue({ response: { status: 403, data: { code: "PLAN_LIMIT_REACHED", limit: "max_storage_mb", message: "Your storage is full" } } });
    renderApp(
      <LockedFeatureProvider>
        <DiscussionComposer classId="class-1" onSubmit={vi.fn()} />
      </LockedFeatureProvider>,
    );

    pick();
    expect(await screen.findByText("Plan limit reached")).toBeTruthy();
    expect(screen.getByText("Storage (MB)")).toBeTruthy();
  });
});
