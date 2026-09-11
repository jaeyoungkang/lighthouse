// @promise promise:story-chain-event-contract
// @aspect aspect:admin-access-control
// @check acceptance-check:story-chain-event-contract-admin-event-catalog

import { redirect } from "next/navigation";

export default function AdminIndexPage() {
  redirect("/admin/analytics");
}
