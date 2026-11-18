// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { BudgetWidget } from "./BudgetWidget";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: { currency: "INR" } }),
}));

describe("BudgetWidget", () => {
  it("renders the daily spending allowance as a native meter", () => {
    render(<BudgetWidget expense={20_000} todayExpense={1_000} monthlyBudget={100_000} />);

    const meter = screen.getByRole("meter", { name: "Daily spending allowance" });
    expect(meter).toHaveAttribute("min", "0");
    expect(meter).toHaveAttribute("aria-valuetext", expect.stringContaining("spent of"));
    expect(screen.getByText(/spent today/i)).toBeInTheDocument();
  });

  it("marks overspending with a danger state", () => {
    const { container } = render(
      <BudgetWidget expense={95_000} todayExpense={90_000} monthlyBudget={100_000} />
    );

    expect(container.querySelector(".budget-widget")).toHaveAttribute("data-status", "danger");
    expect(screen.getByText(/over budget/i)).toBeInTheDocument();
  });

  it("renders nothing when no monthly budget is configured", () => {
    const { container } = render(<BudgetWidget expense={0} todayExpense={0} monthlyBudget={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
