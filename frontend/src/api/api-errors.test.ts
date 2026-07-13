import axios from "axios";
import { getApiError } from "./api-errors";

describe("getApiError", () => {
  it("maps backend field validation errors", () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          timestamp: "2026-01-01T00:00:00Z",
          status: 400,
          message: "Validation failed",
          path: "/api/auth/register",
          errors: ["email: must be a valid email address", "password: must not be blank"]
        }
      }
    };

    expect(getApiError(error as never)).toMatchObject({
      status: 400,
      message: "must be a valid email address",
      fieldErrors: {
        email: "must be a valid email address",
        password: "must not be blank"
      }
    });
  });

  it("surfaces non-field validation details when the backend message is generic", () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          timestamp: "2026-01-01T00:00:00Z",
          status: 400,
          message: "Validation failed",
          path: "/api/imports/preview",
          errors: ["No hourly rate is configured for 2026-01-01"]
        }
      }
    };

    expect(getApiError(error as never)).toMatchObject({
      status: 400,
      message: "No hourly rate is configured for 2026-01-01",
      errors: ["No hourly rate is configured for 2026-01-01"]
    });
  });

  it("maps network failures to a backend unavailable message", () => {
    const error = new axios.AxiosError("Network Error");

    expect(getApiError(error).message).toContain("could not reach the backend");
  });
});
