import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithIntl } from "@/i18n/test-utils";
import Table, { type TableColumn } from "./Table";

type Row = { id: string; name: string; roll: number | null };

const ROWS: Row[] = [
  { id: "a", name: "Nadia", roll: 12 },
  { id: "b", name: "Arif", roll: 3 },
  { id: "c", name: "Rafi", roll: null },
];

const COLUMNS: TableColumn<Row>[] = [
  { key: "name", header: "Name", cell: (row) => row.name, sortValue: (row) => row.name },
  { key: "roll", header: "Roll", cell: (row) => row.roll ?? "—", sortValue: (row) => row.roll },
];

afterEach(() => cleanup());

// The desktop table (the phone cards render the same rows in a second, CSS-hidden list).
const table = () => screen.getByRole("table", { name: "Students" });
const names = () =>
  within(table())
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell").at(-2)?.textContent);

const Selectable = () => {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <>
      <Table caption="Students" columns={COLUMNS} rows={ROWS} getRowId={(row) => row.id} selectable selectedIds={selected} onSelectionChange={setSelected} />
      <output>{selected.join(",")}</output>
    </>
  );
};

describe("Table", () => {
  it("sorts by a column, ascending then descending, with empty values last", () => {
    renderWithIntl(<Table caption="Students" columns={COLUMNS} rows={ROWS} getRowId={(row) => row.id} />);
    const header = within(table()).getAllByRole("columnheader")[1];

    fireEvent.click(within(table()).getByRole("button", { name: "Sort by Roll" }));
    expect(header.getAttribute("aria-sort")).toBe("ascending");
    expect(names()).toEqual(["Arif", "Nadia", "Rafi"]);

    fireEvent.click(within(table()).getByRole("button", { name: "Sort by Roll" }));
    expect(header.getAttribute("aria-sort")).toBe("descending");
    expect(names()).toEqual(["Nadia", "Arif", "Rafi"]);
  });

  it("selects rows one by one or all at once", () => {
    renderWithIntl(<Selectable />);

    fireEvent.click(within(table()).getAllByRole("checkbox", { name: "Select row" })[0]);
    expect(screen.getByRole("status").textContent).toBe("a");
    expect((within(table()).getByRole("checkbox", { name: "Select all rows" }) as HTMLInputElement).indeterminate).toBe(true);

    fireEvent.click(within(table()).getByRole("checkbox", { name: "Select all rows" }));
    expect(screen.getByRole("status").textContent).toBe("a,b,c");
    fireEvent.click(within(table()).getByRole("checkbox", { name: "Select all rows" }));
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("shows placeholders while loading and a message when empty", () => {
    const { rerender } = renderWithIntl(<Table caption="Students" columns={COLUMNS} rows={[]} getRowId={(row) => row.id} loading />);
    expect(screen.getByRole("table").closest("[aria-busy]")?.getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByText("Nothing here yet")).toBeNull();

    rerender(<Table caption="Students" columns={COLUMNS} rows={[]} getRowId={(row) => row.id} />);
    expect(screen.getAllByText("Nothing here yet").length).toBeGreaterThan(0);
  });

  it("shows each row as a labelled card on phones", () => {
    renderWithIntl(<Table caption="Students" columns={COLUMNS} rows={ROWS.slice(0, 1)} getRowId={(row) => row.id} />);
    const term = screen.getAllByText("Roll").find((element) => element.tagName === "DT");
    expect(term?.nextElementSibling?.textContent).toBe("12");
  });
});
