import { cleanup, fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import ReadingPassage from "./ReadingPassage";

const part: IeltsPaperPart = { id: "p1", module: "READING", part_no: 1, title: null, content: "<p>Glass was first made in Egypt.</p>", audio_file_id: null, image_file_id: null, groups: [] };

/** Re-renders the passage on demand, as the test screen does every second for its timer. */
const Ticking = () => {
  const [tick, setTick] = useState(0);
  return (
    <>
      <button type="button" onClick={() => setTick(tick + 1)}>
        tick {tick}
      </button>
      <ReadingPassage attemptId="a1" part={part} />
    </>
  );
};

afterEach(() => cleanup());

describe("Reading passage highlights (IEL-05)", () => {
  it("keeps a highlight when the screen re-renders", async () => {
    renderApp(<Ticking />);
    const paragraph = await screen.findByText("Glass was first made in Egypt.");
    const range = document.createRange();
    range.setStart(paragraph.firstChild as Text, 0);
    range.setEnd(paragraph.firstChild as Text, 5);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    fireEvent.mouseUp(paragraph);
    fireEvent.click(screen.getByRole("button", { name: "Highlight" }));
    expect(document.querySelector("mark")?.textContent).toBe("Glass");
    fireEvent.click(screen.getByRole("button", { name: /tick/ }));
    fireEvent.click(screen.getByRole("button", { name: /tick/ }));
    expect(document.querySelector("mark")?.textContent).toBe("Glass");
    // Typing notes re-renders the passage's own component too.
    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: "Egypt" } });
    expect(document.querySelector("mark")?.textContent).toBe("Glass");
  });
});
