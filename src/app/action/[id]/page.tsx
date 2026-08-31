import { AppShell } from "@/components/shared/app-shell";
import { ActionScreen } from "@/components/screens/action-screen";

export default async function ActionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell>
      <ActionScreen id={id} />
    </AppShell>
  );
}
