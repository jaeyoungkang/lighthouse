import { createClient as createSupabaseBrowserClient } from "@/app/lib/supabase/client";

const amplitudeKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
if (amplitudeKey) {
  void initializeAmplitude().then(() => {
    void bindSupabaseIdentityToAnalytics();
  });
}

async function bindSupabaseIdentityToAnalytics(): Promise<void> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user.email;
    if (email) identifyAnalyticsUser(email);

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        void resetAmplitude();
        return;
      }
      const nextEmail = session?.user.email;
      if (nextEmail) identifyAnalyticsUser(nextEmail);
    });
  } catch {
    // fire-and-forget
  }
}

function identifyAnalyticsUser(email: string): void {
  void import("@/app/lib/track")
    .then(({ identifyUser }) => {
      identifyUser(email);
    })
    .catch(() => undefined);
}

function resetAmplitude(): Promise<void> {
  return import("@/app/lib/analytics/amplitude-unified-client")
    .then(({ resetLoadedAmplitudeModule }) => {
      resetLoadedAmplitudeModule();
    })
    .catch(() => undefined);
}

function initializeAmplitude(): Promise<void> {
  return import("@/app/lib/analytics/amplitude-unified-client")
    .then(({ initializeAmplitudeUnifiedModule }) => initializeAmplitudeUnifiedModule())
    .then(() => undefined)
    .catch(() => undefined);
}
