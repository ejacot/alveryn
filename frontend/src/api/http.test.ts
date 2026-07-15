import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearTokens, getStoredAccessToken, markSessionActive, setStoredAccessToken } from "./auth-storage";
import { __resetHttpStateForTests, http, setAuthFailureHandler } from "./http";

describe("http refresh queue", () => {
  let httpMock: MockAdapter;
  let axiosMock: MockAdapter;

  beforeEach(() => {
    localStorage.clear();
    clearTokens();
    __resetHttpStateForTests();
    httpMock = new MockAdapter(http);
    axiosMock = new MockAdapter(axios);
  });

  afterEach(() => {
    httpMock.restore();
    axiosMock.restore();
    setAuthFailureHandler(null);
  });

  it("resumes pending requests after a single refresh", async () => {
    setStoredAccessToken("expired-access");
    markSessionActive();

    httpMock.onGet("/api/me").replyOnce(401);
    httpMock.onGet("/api/dashboard").replyOnce(401);
    httpMock.onGet("/api/me").reply(200, { data: { ok: true } });
    httpMock.onGet("/api/dashboard").reply(200, { data: { ok: true } });

    axiosMock.onPost("/api/auth/refresh").reply(200, {
      data: {
        accessToken: "next-access",
        tokenType: "Bearer",
        accessTokenExpiresIn: 900,
        user: {
          id: "1",
          email: "alveryn@example.com",
          emailVerified: true,
          status: "ACTIVE",
          lastLoginAt: null
        }
      }
    });

    const responses = await Promise.all([http.get("/api/me"), http.get("/api/dashboard")]);

    expect(responses).toHaveLength(2);
    expect(axiosMock.history.post).toHaveLength(1);
    expect(getStoredAccessToken()).toBe("next-access");
  });

  it("rejects queued requests and clears session when refresh fails", async () => {
    const onFailure = vi.fn();
    setAuthFailureHandler(onFailure);
    setStoredAccessToken("expired-access");
    markSessionActive();

    httpMock.onGet("/api/me").replyOnce(401);
    httpMock.onGet("/api/dashboard").replyOnce(401);
    axiosMock.onPost("/api/auth/refresh").reply(401, {
      timestamp: "2026-01-01T00:00:00Z",
      status: 401,
      message: "Invalid refresh token",
      path: "/api/auth/refresh",
      errors: []
    });

    const results = await Promise.allSettled([http.get("/api/me"), http.get("/api/dashboard")]);

    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(getStoredAccessToken()).toBeNull();
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it("does not attempt refresh for login failures", async () => {
    httpMock.onPost("/api/auth/login").reply(401, {
      timestamp: "2026-01-01T00:00:00Z",
      status: 401,
      message: "Invalid email or password",
      path: "/api/auth/login",
      errors: []
    });

    await expect(
      http.post("/api/auth/login", { email: "alveryn@example.com", password: "bad" })
    ).rejects.toBeDefined();

    expect(axiosMock.history.post).toHaveLength(0);
  });
});
