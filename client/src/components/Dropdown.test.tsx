// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dropdown } from "./Dropdown";

const options = [
  { value: "all", label: "All accounts" },
  { value: "bank", label: "Bank account" },
  { value: "cash", label: "Cash" },
];

function installPopoverMocks() {
  vi.stubGlobal("CSS", { supports: () => false });
  Object.defineProperties(HTMLElement.prototype, {
    showPopover: {
      configurable: true,
      value: function (this: HTMLElement) {
        this.dispatchEvent(Object.assign(new Event("toggle"), { newState: "open" }));
      },
    },
    hidePopover: {
      configurable: true,
      value: function (this: HTMLElement) {
        this.dispatchEvent(Object.assign(new Event("toggle"), { newState: "closed" }));
      },
    },
    scrollIntoView: { configurable: true, value: vi.fn() },
  });
}

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "showPopover");
  Reflect.deleteProperty(HTMLElement.prototype, "hidePopover");
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  vi.unstubAllGlobals();
});

describe("Dropdown", () => {
  it("opens the listbox and selects an option", async () => {
    installPopoverMocks();
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Dropdown ariaLabel="Filter by account" value="all" options={options} onChange={onChange} />);

    const trigger = screen.getByRole("combobox", { name: "Filter by account" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.click(within(document.querySelector(".dropdown-menu")!).getByText("Bank account"));
    expect(onChange).toHaveBeenCalledWith("bank");
  });

  it("supports arrow navigation and Enter selection", () => {
    installPopoverMocks();
    const onChange = vi.fn();
    render(<Dropdown ariaLabel="Account" value="all" options={options} onChange={onChange} />);

    const trigger = screen.getByRole("combobox", { name: "Account" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("bank");
  });

  it("opens with a typeahead match highlighted", () => {
    installPopoverMocks();
    render(<Dropdown ariaLabel="Account" value="all" options={options} onChange={vi.fn()} />);

    const trigger = screen.getByRole("combobox", { name: "Account" });
    fireEvent.keyDown(trigger, { key: "c" });

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-activedescendant", expect.stringContaining("cash"));
  });
});
