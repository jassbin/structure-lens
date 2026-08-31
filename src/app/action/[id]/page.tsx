import { AppShell } from "@/components/shared/app-shell";
import { BottomTabs } from "@/components/shared/bottom-tabs";
import { ActionScreen } from "@/components/screens/action-screen";

export default async function ActionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell tab={<BottomTabs />}>
      <ActionScreen id={id} />
    </AppShell>
  );
}
