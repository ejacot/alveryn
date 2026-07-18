import axios from "axios";
import { i18n } from "../i18n";
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
          path: "/api/work-records",
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

  it("localizes work record time overlap conflicts with the conflicting interval", async () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          timestamp: "2026-01-01T00:00:00Z",
          status: 409,
          message: "This work record overlaps an existing activity from 09:00 to 17:00.",
          code: "WORK_RECORD_TIME_OVERLAP",
          path: "/api/work-records",
          errors: []
        }
      }
    };

    await i18n.changeLanguage("en");
    expect(getApiError(error as never).message).toBe(
      "This activity overlaps an existing activity from 09:00 to 17:00."
    );

    await i18n.changeLanguage("de");
    expect(getApiError(error as never).message).toBe(
      "Diese Aktivität überschneidet sich mit einer bestehenden Aktivität von 09:00 bis 17:00."
    );

    await i18n.changeLanguage("ro");
    expect(getApiError(error as never).message).toBe(
      "Această activitate se suprapune cu o activitate existentă între 09:00 și 17:00."
    );

    await i18n.changeLanguage("en");
  });
});
