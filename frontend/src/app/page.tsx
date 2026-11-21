import { Workspace } from "@/features/datasets/workspace";
import { AccountGate } from "@/features/auth/account-gate";
export default function Page() {
  return <AccountGate><Workspace /></AccountGate>;
}
