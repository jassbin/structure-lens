import { AppShell } from "@/components/shared/app-shell";
import { BottomTabs } from "@/components/shared/bottom-tabs";
import { AuthGate } from "@/components/shared/auth-gate";
import { MapScreen } from "@/components/screens/map-screen";

export default function MapPage() {
  return (
    <AppShell tab={<BottomTabs />}>
      <AuthGate>
        <MapScreen />
      </AuthGate>
    </AppShell>
  );
}
