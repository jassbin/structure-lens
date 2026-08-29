import { AppShell } from "@/components/shared/app-shell";
import { BottomTabs } from "@/components/shared/bottom-tabs";
import { ReportScreen } from "@/components/screens/report-screen";

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell tab={<BottomTabs />}>
      <AuthGate>
        <ReportScreen id={id} />
      </AuthGate>
    </AppShell>
  );
}
