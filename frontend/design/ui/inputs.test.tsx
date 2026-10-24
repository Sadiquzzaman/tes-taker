import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/i18n/test-utils";
import Checkbox from "./Checkbox";
import Combobox from "./Combobox";
import DatePicker from "./DatePicker";
import FileDrop from "./FileDrop";
import Input from "./Input";
import RadioGroup from "./Radio";
import Select from "./Select";
import Switch from "./Switch";

afterEach(() => cleanup());

describe("Input", () => {
  it("connects the label, hint and error to the field", () => {
    renderWithIntl(<Input label="Phone" hint="11 digits" error="Phone number must be 11 digits" required />);

    const input = screen.getByLabelText(/Phone/);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = input.getAttribute("aria-describedby")!.split(" ");
    expect(describedBy.map((id) => document.getElementById(id)?.textContent)).toEqual([
      "11 digits",
      "Phone number must be 11 digits",
    ]);
    expect(screen.getByText("(required)", { exact: false })).toBeTruthy();
  });

  it("says 'required' in Bangla on a Bangla page", () => {
    renderWithIntl(<Input label="ফোন" required />, "bn");
    expect(screen.getByText("(আবশ্যক)", { exact: false })).toBeTruthy();
  });
});

describe("Select, DatePicker", () => {
  it("offers an empty first choice in the page language", () => {
    renderWithIntl(<Select label="Class" options={[{ value: "9a", label: "9A" }]} />, "bn");
    expect(screen.getByRole("option", { name: "বেছে নিন…" })).toBeTruthy();
  });

  it("returns the date as YYYY-MM-DD", () => {
    const onChange = vi.fn();
    renderWithIntl(<DatePicker label="Exam date" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Exam date"), { target: { value: "2026-10-24" } });
    expect(onChange).toHaveBeenCalledWith("2026-10-24");
  });
});

describe("Checkbox, RadioGroup, Switch", () => {
  it("shows a part-selected checkbox", () => {
    renderWithIntl(<Checkbox label="All" indeterminate readOnly />);
    expect((screen.getByLabelText("All") as HTMLInputElement).indeterminate).toBe(true);
  });

  it("groups radios under their question and reports the choice", () => {
    const onChange = vi.fn();
    renderWithIntl(
      <RadioGroup
        legend="Exam mode"
        name="mode"
        value="online"
        onChange={onChange}
        options={[
          { value: "online", label: "Online" },
          { value: "offline", label: "On paper" },
        ]}
      />,
    );
    expect(screen.getByRole("group", { name: "Exam mode" })).toBeTruthy();
    fireEvent.click(screen.getByLabelText("On paper"));
    expect(onChange).toHaveBeenCalledWith("offline");
  });

  it("toggles a switch", () => {
    const Example = () => {
      const [on, setOn] = useState(false);
      return <Switch label="Notify me" checked={on} onChange={setOn} />;
    };
    renderWithIntl(<Example />);

    const toggle = screen.getByRole("switch", { name: "Notify me" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });
});

describe("Combobox", () => {
  const options = [
    { value: "phy", label: "Physics", detail: "PHY-101" },
    { value: "chem", label: "Chemistry", detail: "CHE-101" },
    { value: "ban", label: "বাংলা" },
  ];

  it("filters as you type, searching the detail too, and picks with the keyboard", async () => {
    const onChange = vi.fn();
    renderWithIntl(<Combobox label="Subject" options={options} value={null} onChange={onChange} />);

    const input = screen.getByRole("combobox", { name: "Subject" });
    fireEvent.change(input, { target: { value: "che-1" } });
    await waitFor(() => expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["ChemistryCHE-101"]));

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("chem"));
  });

  it("says when nothing matches", async () => {
    renderWithIntl(<Combobox label="Subject" options={options} value={null} onChange={() => {}} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzz" } });
    await waitFor(() => expect(screen.getByText("No results")).toBeTruthy());
  });
});

describe("FileDrop", () => {
  it("accepts small files and reports files over the limit", () => {
    const onFiles = vi.fn();
    renderWithIntl(<FileDrop label="Photos" onFiles={onFiles} maxSizeMb={1} multiple acceptLabel="JPG" />);

    const small = new File(["x"], "page-1.jpg", { type: "image/jpeg" });
    const big = new File([new Uint8Array(2 * 1024 * 1024)], "huge.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Photos"), { target: { files: [small, big] } });

    expect(onFiles).toHaveBeenCalledWith([small]);
    expect(screen.getByText("huge.jpg is larger than 1 MB")).toBeTruthy();
  });

  it("shows each file's progress", () => {
    renderWithIntl(<FileDrop label="Photos" onFiles={() => {}} items={[{ id: "a", name: "page-1.jpg", progress: 40 }]} />, "bn");

    const bar = screen.getByRole("progressbar", { name: "page-1.jpg" });
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
    expect(screen.getByText("৪০%")).toBeTruthy();
  });
});
