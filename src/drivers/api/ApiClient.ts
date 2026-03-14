import axios, { AxiosInstance } from "axios";
import { ApiRequest, ApiResponse } from "../../core/contracts";

export class ApiClient {
  private readonly client: AxiosInstance;

  constructor(baseURL: string, headers?: Record<string, string>) {
    this.client = axios.create({ baseURL, headers });
  }

  async request<T = unknown>(request: ApiRequest): Promise<ApiResponse<T>> {
    const response = await this.client.request<T>({
      method: request.method,
      url: request.path,
      headers: request.headers,
      data: request.body
    });

    return {
      status: response.status,
      headers: Object.fromEntries(
        Object.entries(response.headers).map(([key, value]) => [key, String(value)])
      ),
      body: response.data
    };
  }

  async graphQL<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await this.request<T>({
      method: "POST",
      path: "/graphql",
      body: { query, variables },
      headers: { "content-type": "application/json" }
    });
    return response.body;
  }
}
