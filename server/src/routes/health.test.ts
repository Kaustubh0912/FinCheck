import { describe, it, expect } from "vitest";
import request from "supertest";
import { testApp } from "../test/app";

describe("GET /api/health", () => {
  it("returns 200 with ok: true and service name", async () => {
    const res = await request(testApp).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, service: "fincheck" });
  });
});
