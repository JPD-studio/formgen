interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  BASIC_AUTH_USER?: string;
  BASIC_AUTH_PASSWORD?: string;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const password = env.BASIC_AUTH_PASSWORD;
    if (!password) {
      // No password configured — serve normally.
      return env.ASSETS.fetch(request);
    }

    const user = env.BASIC_AUTH_USER ?? "formgen";
    const expected = `Basic ${btoa(`${user}:${password}`)}`;
    const provided = request.headers.get("Authorization") ?? "";

    if (!timingSafeEqual(provided, expected)) {
      return new Response("Authentication required", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="formgen", charset="UTF-8"',
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
