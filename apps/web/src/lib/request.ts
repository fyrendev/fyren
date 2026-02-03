/**
 * Request helper that automatically handles server vs client URL resolution.
 * - Server-side (SSR): Uses NEXT_PUBLIC_INTERNAL_API_URL for direct backend access
 * - Client-side: Uses relative URLs that get proxied via Next.js rewrites
 */

function getBaseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_INTERNAL_API_URL || "";
  }
  return "";
}

type RequestOptions = RequestInit & {
  next?: { revalidate?: number | false; tags?: string[] };
};

/**
 * Make a request to the API. Works identically on server and client.
 *
 * @example
 * // Simple GET
 * const res = await request("/api/v1/status");
 * const data = await res.json();
 *
 * @example
 * // POST with body
 * const res = await request("/api/v1/admin/components", {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({ name: "API" }),
 * });
 */
export async function request(path: string, options?: RequestOptions): Promise<Response> {
  const url = `${getBaseUrl()}${path}`;
  return fetch(url, options);
}

/**
 * Make a GET request and parse JSON response.
 *
 * @example
 * const data = await request.get<StatusResponse>("/api/v1/status");
 */
request.get = async function get<T>(path: string, options?: RequestOptions): Promise<T> {
  const res = await request(path, { ...options, method: "GET" });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
};

/**
 * Make a POST request with JSON body.
 *
 * @example
 * const data = await request.post<Component>("/api/v1/admin/components", { name: "API" });
 */
request.post = async function post<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  const res = await request(path, {
    ...options,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
};

/**
 * Make a PUT request with JSON body.
 */
request.put = async function put<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  const res = await request(path, {
    ...options,
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
};

/**
 * Make a PATCH request with JSON body.
 */
request.patch = async function patch<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  const res = await request(path, {
    ...options,
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
};

/**
 * Make a DELETE request.
 */
request.delete = async function del<T>(path: string, options?: RequestOptions): Promise<T> {
  const res = await request(path, { ...options, method: "DELETE" });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
};
