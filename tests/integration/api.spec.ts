import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiClient } from "../../src/drivers/api/ApiClient";
import { RunningMockServer, startMockServer } from "../../src/mock/server";

describe("API and protocol mocks", () => {
  let server: RunningMockServer;
  let client: ApiClient;

  beforeAll(async () => {
    server = await startMockServer(3201);
    client = new ApiClient(server.url);
  });

  afterAll(async () => {
    await server.stop();
  });

  it("supports REST login", async () => {
    const response = await client.request<{ profile: { username: string } }>({
      method: "POST",
      path: "/api/auth/login",
      body: { username: "standard_user", password: "secret_sauce" }
    });

    expect(response.status).toBe(200);
    expect(response.body.profile.username).toBe("standard_user");
  });

  it("supports GraphQL queries", async () => {
    const response = await client.graphQL<{ data: { user: { username: string; role: string } } }>(
      "query User($username: String!) { user(username: $username) { username role } }",
      { username: "admin_user" }
    );

    expect(response.data.user.username).toBe("admin_user");
    expect(response.data.user.role).toBe("admin");
  });

  it("supports SOAP-style HTTP requests", async () => {
    const response = await fetch(`${server.url}/soap`, {
      method: "POST",
      headers: { "content-type": "application/soap+xml" },
      body: "<GetUserRequest><Username>standard_user</Username></GetUserRequest>"
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("<DisplayName>Standard User</DisplayName>");
  });
});
