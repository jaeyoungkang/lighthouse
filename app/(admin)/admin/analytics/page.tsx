// @promise promise:story-chain-event-contract
// @aspect aspect:admin-access-control
// @check acceptance-check:story-chain-event-contract-admin-event-catalog

import { notFound } from "next/navigation";
import { AnalyticsEventsDashboard } from "@/app/components/admin/AnalyticsEventsDashboard";
import { ForbiddenError, UnauthenticatedError } from "@/app/server/auth/auth-errors";
import { requireInternalAdminUser } from "@/app/server/auth/internal-admin";
import { loadEventContract } from "@/app/server/services/analytics/event-contract";
import { loadStoryChain } from "@/app/server/services/story-chain/loader";

async function requireAdminUserOrNotFound() {
  try {
    return await requireInternalAdminUser();
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof UnauthenticatedError) {
      notFound();
    }
    throw error;
  }
}

export default async function AnalyticsEventsPage() {
  const user = await requireAdminUserOrNotFound();
  const contract = loadEventContract(process.cwd());
  const chain = loadStoryChain(process.cwd());
  const requiredEventNames = chain.promises.flatMap((promise) => promise.requiredEvents ?? []);

  return (
    <AnalyticsEventsDashboard
      eventDefinitions={contract.events}
      requiredEventNames={requiredEventNames}
      userEmail={user.email}
    />
  );
}
