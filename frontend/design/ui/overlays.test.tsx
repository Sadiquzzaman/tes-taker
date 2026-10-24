import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/i18n/test-utils";
import ConfirmDialog from "./ConfirmDialog";
import Drawer from "./Drawer";
import Modal from "./Modal";
import Toast from "./Toast";

afterEach(() => cleanup());

describe("Modal and Drawer", () => {
  it("is a named dialog that closes with Esc and with its close button", async () => {
    const onClose = vi.fn();
    renderWithIntl(
      <Modal open onClose={onClose} title="Publish results?" description="Students will see the marks.">
        <p>32 students</p>
      </Modal>,
    );

    const dialog = await screen.findByRole("dialog", { name: "Publish results?" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    onClose.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("can require the user to finish (no Esc)", async () => {
    const onClose = vi.fn();
    renderWithIntl(<Drawer open onClose={onClose} title="Edit class" dismissible={false} hideClose />);

    const dialog = await screen.findByRole("dialog", { name: "Edit class" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });
});

describe("ConfirmDialog", () => {
  it("starts on Cancel so Enter never confirms by accident", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderWithIntl(
      <ConfirmDialog open tone="danger" title="Delete Physics 9A?" confirmLabel="Delete class" onConfirm={onConfirm} onCancel={onCancel} />,
    );

    await waitFor(() => expect(document.activeElement?.textContent).toBe("Cancel"));
    fireEvent.click(screen.getByRole("button", { name: "Delete class" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("uses translated buttons on a Bangla page", async () => {
    renderWithIntl(<ConfirmDialog open title="মুছবেন?" onConfirm={() => {}} onCancel={() => {}} />, "bn");
    expect(await screen.findByRole("button", { name: "বাতিল" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "নিশ্চিত করুন" })).toBeTruthy();
  });
});

describe("Toast", () => {
  it("interrupts screen readers only for errors", () => {
    renderWithIntl(<Toast tone="error" title="Could not save" onClose={() => {}} />);
    expect(screen.getByRole("alert").textContent).toContain("Could not save");
    cleanup();
    renderWithIntl(<Toast tone="success" title="Saved" onClose={() => {}} />);
    expect(screen.getByRole("status").textContent).toContain("Saved");
  });
});
