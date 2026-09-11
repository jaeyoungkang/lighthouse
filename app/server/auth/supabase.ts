import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function requireEnv(
  name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "SUPABASE_SERVICE_ROLE_KEY",
): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

/** 서버 컴포넌트 · Route Handler용 Supabase 클라이언트 (사용자 세션 기반, RLS 적용) */
type CreateSupabaseClientOptions = {
  readonly signal?: AbortSignal;
};

function createSignalBoundFetch(signal: AbortSignal): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!init?.signal) {
      return fetch(input, { ...init, signal });
    }

    const controller = new AbortController();
    const abort = () => {
      controller.abort();
    };
    signal.addEventListener("abort", abort, { once: true });
    init.signal.addEventListener("abort", abort, { once: true });
    try {
      if (signal.aborted || init.signal.aborted) controller.abort();
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      signal.removeEventListener("abort", abort);
      init.signal.removeEventListener("abort", abort);
    }
  };
}

export async function createClient(options: CreateSupabaseClientOptions = {}) {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component에서는 cookie 설정이 불가할 수 있다
          }
        },
      },
      ...(options.signal ? { global: { fetch: createSignalBoundFetch(options.signal) } } : {}),
    },
  );
}

/** 서비스 롤 키 기반 Supabase 클라이언트 (RLS 우회, 서버 내부 전용) */
export function createAdminClient() {
  return createAdminSupabaseClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}
