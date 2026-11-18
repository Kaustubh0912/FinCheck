// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./client";
import { useInfiniteTransactions } from "./hooks";

vi.mock("./client", () => ({
  api: { get: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

afterEach(() => vi.clearAllMocks());

describe("useInfiniteTransactions", () => {
  it("requests 40-row offset pages and stops when the total is reached", async () => {
    const firstPage = Array.from({ length: 2 }, (_, index) => ({ id: `txn-${index}` }));
    const secondPage = [{ id: "txn-2" }];
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: firstPage, headers: { "x-total-count": "3" } } as never)
      .mockResolvedValueOnce({ data: secondPage, headers: { "x-total-count": "3" } } as never);

    const { result } = renderHook(
      () => useInfiniteTransactions({ type: "expense", q: "coffee" }, 2),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    expect(result.current.hasNextPage).toBe(true);
    expect(api.get).toHaveBeenNthCalledWith(1, "/transactions", {
      params: { type: "expense", q: "coffee", limit: 2, skip: 0 },
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(api.get).toHaveBeenNthCalledWith(2, "/transactions", {
      params: { type: "expense", q: "coffee", limit: 2, skip: 2 },
    });
    expect(result.current.hasNextPage).toBe(false);
  });

  it("does not fetch when disabled", async () => {
    const { result } = renderHook(() => useInfiniteTransactions({}, 40, false), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(api.get).not.toHaveBeenCalled();
  });
});
