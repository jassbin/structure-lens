import { AppShell } from "@/components/shared/app-shell";
import { ShareScreen } from "@/components/screens/share-screen";

export default async function SharePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <AppShell showTabs={false}>
      <ShareScreen code={code} />
    </AppShell>
  );
}
