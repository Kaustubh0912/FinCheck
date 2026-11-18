// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { SmartDateInput } from "./SmartDateInput";

describe("SmartDateInput", () => {
  it("parses shorthand dates as the user edits", () => {
    const onChange = vi.fn();
    render(<SmartDateInput value="2025-12-31" onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText("e.g. 1.1.26, 1 jan, 21, t"), {
      target: { value: "1.1.26" },
    });

    expect(onChange).toHaveBeenCalledWith("2026-01-01");
  });

  it("shows an error hint when an invalid date is left", () => {
    render(<SmartDateInput value="2025-12-31" onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText("e.g. 1.1.26, 1 jan, 21, t");

    fireEvent.change(input, { target: { value: "31.2.26" } });
    fireEvent.blur(input);

    expect(screen.getByText(/Couldn’t read that/i)).toBeInTheDocument();
    expect(input).toHaveClass("input-error");
  });
});
