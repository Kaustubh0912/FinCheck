// @vitest-environment jsdom
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddTransactionSheet } from "./AddTransactionSheet";

const mocks = vi.hoisted(() => ({
  saveMutate: vi.fn(),
  deleteMutate: vi.fn(),
  splitMutate: vi.fn(),
}));

vi.mock("./Sheet", () => ({
  Sheet: ({ open, title, children, footer }: {
    open: boolean;
    title?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
  }) => open ? <section aria-label={typeof title === "string" ? title : "Sheet"}>{children}{footer}</section> : null,
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: { currency: "INR" } }),
}));

vi.mock("../api/hooks", () => ({
  useAccounts: () => ({ data: [{
    id: "account-1", name: "Main account", type: "bank", archived: false,
    balance: 100_000, openingBalance: 100_000, goalTarget: null, color: "#000000", icon: "bank", createdAt: "", order: 0,
  }] }),
  useCategories: () => ({ data: [] }),
  useSaveTransaction: () => ({ isPending: false, mutate: mocks.saveMutate }),
  useDeleteTransaction: () => ({ isPending: false, mutate: mocks.deleteMutate }),
  useCreateSplit: () => ({ isPending: false, mutate: mocks.splitMutate }),
}));

vi.mock("../api/client", () => ({ errMessage: (error: unknown) => error instanceof Error ? error.message : "Request failed" }));
vi.mock("../lib/useDelayedPending", () => ({ useDelayedPending: () => false }));

describe("AddTransactionSheet", () => {
  beforeEach(() => {
    mocks.saveMutate.mockReset();
    mocks.deleteMutate.mockReset();
    mocks.splitMutate.mockReset();
  });

  it("closes after a successful save and announces the result", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mocks.saveMutate.mockImplementation((_data, callbacks) => callbacks.onSuccess());
    render(<AddTransactionSheet open onClose={onClose} />);

    await user.type(screen.getByRole("textbox", { name: "Amount" }), "25");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    expect(mocks.saveMutate).toHaveBeenCalledWith(
      expect.objectContaining({ type: "expense", amount: 25, fromAccountId: "account-1" }),
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    );
    expect(onClose).toHaveBeenCalledOnce();
    expect(await screen.findByRole("status")).toHaveTextContent("Transaction added");
  });

  it("keeps the form open and announces a server error", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mocks.saveMutate.mockImplementation((_data, callbacks) => callbacks.onError(new Error("Insufficient balance")));
    render(<AddTransactionSheet open onClose={onClose} />);

    await user.type(screen.getByRole("textbox", { name: "Amount" }), "25");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Insufficient balance");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Add transaction" })).toBeInTheDocument();
  });
});
