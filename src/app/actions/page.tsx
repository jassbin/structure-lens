import { AppShell } from "@/components/shared/app-shell";
import { BottomTabs } from "@/components/shared/bottom-tabs";
import { ActionsListScreen } from "@/components/screens/actions-list-screen";

export default function ActionsPage() {
  return (
    <AppShell tab={<BottomTabs />}>
      <ActionsListScreen />
    </AppShell>
  );
}
