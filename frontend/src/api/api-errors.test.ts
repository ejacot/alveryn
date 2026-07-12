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
      message: "Validation failed",
      fieldErrors: {
        email: "must be a valid email address",
        password: "must not be blank"
      }
    });
  });

  it("maps network failures to a backend unavailable message", () => {
    const error = new axios.AxiosError("Network Error");

    expect(getApiError(error).message).toContain("could not reach the backend");
  });
});
