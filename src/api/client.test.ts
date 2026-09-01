import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { apiRequest, ApiError } from "@/api/client";
import { useSessionStore } from "@/auth/session-store";

describe("apiRequest error detail normalization", () => {
  it("uses the string detail as-is for the common {detail: string} error shape", async () => {
    useSessionStore.setState({ accessToken: "t", username: "u", actingRole: "SUPERADMIN" });
    server.use(http.get("*/v1/test-plain-error", () => HttpResponse.json({ detail: "No customer with that id" }, { status: 404 })));

    await expect(apiRequest("/v1/test-plain-error")).rejects.toMatchObject({
      detail: "No customer with that id",
    });
  });

  it("flattens a FastAPI pydantic-validation array detail into a readable string, never '[object Object]'", async () => {
    useSessionStore.setState({ accessToken: "t", username: "u", actingRole: "SUPERADMIN" });
    server.use(
      http.post("*/v1/test-array-error", () =>
        HttpResponse.json(
          {
            detail: [
              {
                type: "value_error",
                loc: ["body", "branches", 0],
                msg: "Value error, branch 'X1': base_url is required for VSCU",
                input: {},
                ctx: { error: {} },
              },
            ],
          },
          { status: 422 },
        ),
      ),
    );

    try {
      await apiRequest("/v1/test-array-error", { method: "POST", body: {} });
      expect.unreachable("apiRequest should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.detail).toContain("base_url is required for VSCU");
      expect(apiErr.detail).not.toContain("[object Object]");
    }
  });
});
