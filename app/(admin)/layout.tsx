import { EmailGate } from "@/app/components/EmailGate";
import { AuthSessionTouch } from "@/app/components/AuthSessionTouch";
import { resolveCurrentUser } from "@/app/server/auth/identity";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await resolveCurrentUser();

  if (!user) {
    return <EmailGate />;
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <AuthSessionTouch />
      {children}
    </div>
  );
}
