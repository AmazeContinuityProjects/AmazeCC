import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";
import SelectField from "../components/custom/shared/primitives/SelectField";

/**
 * The one option selector the app uses.
 *
 * Every `<select>` in the repo was replaced by this, so the two behaviours worth
 * pinning are the ones a native element gave for free and a custom control has to
 * re-provide: the *value* comes back (not an event), and the field stays
 * nameable now that `OptionPicker` accepts no `aria-*` passthrough.
 */

afterEach(cleanup);

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Bravo" },
  { value: "c", label: "Charlie" },
];

/** A host that mirrors the real call shape: state plus a `SelectField`. */
function Host({ initial = "b" }: { initial?: string }) {
  const [v, setV] = useState(initial);
  return (
    <>
      <SelectField value={v} options={OPTIONS} onChange={(next) => setV(next)} />
      <output data-testid="value">{v}</output>
    </>
  );
}

describe("SelectField", () => {
  it("renders the selected option's label on the trigger", () => {
    render(<Host initial="c" />);
    expect(screen.getByRole("button").textContent).toContain("Charlie");
  });

  it("hands onChange the value, not an event", () => {
    // The mistake this guards is passing a handler that still reads
    // `e.target.value` - which silently becomes `undefined` against a custom
    // control, and only shows up as a field that never changes.
    render(<Host />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("Alpha"));
    expect(screen.getByTestId("value").textContent).toBe("a");
  });

  it("passes an aria-label through to the wrapper, since OptionPicker cannot", () => {
    render(
      <SelectField
        value="a"
        options={OPTIONS}
        onChange={() => {}}
        role="group"
        aria-label="Pick one"
      />,
    );
    expect(screen.getByLabelText("Pick one")).toBeTruthy();
  });

  it("keeps the trigger focusable", () => {
    // A native select is keyboard reachable; the replacement has to be too.
    render(<Host />);
    const trigger = screen.getByRole("button");
    expect(trigger.tagName).toBe("BUTTON");
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
  });

  it("opens a searchable list for long option sets", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      value: `v${i}`,
      label: `Option ${i}`,
    }));
    render(<SelectField value="v0" options={many} onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button"));
    // More than 8 entries switches the search input on by default.
    expect(screen.getByPlaceholderText(/search/i)).toBeTruthy();
  });

  it("does not offer a search box for short lists", () => {
    render(<Host />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByPlaceholderText(/search/i)).toBeNull();
  });

  it("honours an explicit searchable override", () => {
    render(
      <SelectField value="a" options={OPTIONS} onChange={() => {}} searchable={false} />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByPlaceholderText(/search/i)).toBeNull();
  });

  it("does not mutate the caller's options array", () => {
    // `OptionPicker` re-filters on every keystroke, so it must not be handed the
    // array a caller may be rendering from.
    const options = [...OPTIONS];
    render(<SelectField value="a" options={options} onChange={() => {}} />);
    expect(options).toEqual(OPTIONS);
    expect(options).toHaveLength(3);
  });

  it("stringifies non-string values so numbers survive the round trip", () => {
    render(
      <SelectField
        value={75 as unknown as "75"}
        options={[
          { value: "75", label: "75%" },
          { value: "80", label: "80%" },
        ]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("button").textContent).toContain("75%");
  });

  it("sizes the trigger through the size prop, not a class the caller has to win", () => {
    // Tailwind emits `h-*` ascending, so an `h-9` in `className` loses to an
    // `h-10` in the shared token no matter where it sits in the string. The size
    // prop is the only thing that reliably changes the height.
    //
    // The rules are written on the wrapper and reach the trigger through
    // `[&>button:first-child]`, so the wrapper is where they have to be read.
    const classesAt = (ui: React.ReactElement) => {
      const { unmount } = render(ui);
      const wrapper = screen.getByRole("button").parentElement as HTMLElement;
      const cls = `${wrapper.className} ${screen.getByRole("button").firstElementChild?.className ?? ""}`;
      unmount();
      return cls;
    };

    const picker = (size?: "xs" | "sm" | "md" | "lg" | "xl" | "auto") => (
      <SelectField
        value="a"
        options={OPTIONS}
        onChange={() => {}}
        {...(size ? { size } : {})}
      />
    );

    const heights = (["xs", "sm", "md", "lg", "xl", "auto"] as const).map(
      (s) => (classesAt(picker(s)).match(/first-child\]:h-([\w-]+)/) || [])[1],
    );
    expect(heights).toEqual(["6", "7", "8", "11", "10", "auto"]);
    // All six distinct, so no two sizes collapse onto the same rule.
    expect(new Set(heights).size).toBe(6);

    // The default matches the old `py-3` select.
    expect((classesAt(picker()).match(/first-child\]:h-([\w-]+)/) || [])[1]).toBe("10");
  });

  it("sizes the label as well as the button", () => {
    // The label is a child carrying its own `text-sm`, so a size on the button
    // alone would be ignored.
    render(<SelectField value="a" options={OPTIONS} onChange={() => {}} size="xs" />);
    const trigger = screen.getByRole("button");
    const wrapper = trigger.parentElement as HTMLElement;
    expect(wrapper.className).toContain("first-child]:h-6");
    expect(wrapper.className).toContain("first-child_span]:text-[10px]");
  });
});
