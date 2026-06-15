import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { CompanyHeader } from "../components/CompanyHeader";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { TabNavigation } from "../components/TabNavigation";
import { ProductionOverview } from "../components/tabs/ProductionOverview";
import { QualityControl } from "../components/tabs/QualityControl";
import { EquipmentStatus } from "../components/tabs/EquipmentStatus";
import { Maintenance } from "../components/tabs/Maintenance";
import { ProductionSchedule } from "../components/tabs/ProductionSchedule";
import { Activity, BarChart3, Calendar, ClipboardCheck, Settings, Shield, Wrench } from "lucide-react";
import AccountManagement from "./AccountManagement";
import type { AuthUser } from "../services/authApi";
import { useMachines } from "../hooks/useProductionData";
import { useBobbinCutDetectorForFleet } from "../hooks/useBobbinCutRecordsFixed";
import { useEquipmentOeeRollup } from "../hooks/useEquipmentOeeRollup";
import { usePastShiftReportOee } from "../hooks/usePastShiftReportOee";
import type { EquipmentOeeMode } from "../utils/equipmentOeeDisplay";
import { getLastCompletedShiftSelection } from "../utils/shiftCalculator";
import { UserPresenceProvider } from "../hooks/useUserPresence";

const EquipmentDetailTab = lazy(() =>
  import("../components/tabs/EquipmentDetail").then((m) => ({ default: m.EquipmentDetail }))
);
const PerformanceAnalyticsTab = lazy(() =>
  import("../components/tabs/PerformanceAnalytics").then((m) => ({ default: m.PerformanceAnalytics }))
);

const tabSuspenseFallback = (
  <div className="flex justify-center py-16 text-white/50 text-sm">Loading…</div>
);

type DashboardProps = {
  onLogout: () => void;
  user: AuthUser;
  token: string;
};

export default function Dashboard({ onLogout, user, token }: DashboardProps) {
  const [activeTab, setActiveTab] = useState("production");
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keep bobbin detector running for all production lines globally.
  const { machines, loading: machinesLoading } = useMachines(undefined, { activeTab });
  useBobbinCutDetectorForFleet(machines);

  // Error boundary - catch any rendering errors
  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error("❌ App Error:", error.error);
      setHasError(true);
      setErrorMessage(error.error?.message || "Unknown error");
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("❌ Unhandled Promise Rejection:", event.reason);
      setHasError(true);
      setErrorMessage(event.reason?.message || "Promise rejection");
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [equipmentOeeMode, setEquipmentOeeMode] = useState<EquipmentOeeMode>("realtime");
  const initCompletedShift = useMemo(() => getLastCompletedShiftSelection(), []);
  const [referenceDate, setReferenceDate] = useState(initCompletedShift.shiftDate);
  const [pastIsoShiftNumber, setPastIsoShiftNumber] = useState<1 | 2 | 3>(initCompletedShift.shiftNumber);

  const pastShiftHookSelection = useMemo(
    () => ({ shiftDate: referenceDate, shiftNumber: pastIsoShiftNumber }),
    [referenceDate, pastIsoShiftNumber]
  );

  const analyticsRollup = useEquipmentOeeRollup(
    equipmentOeeMode === "past_shift" ? "realtime" : equipmentOeeMode,
    activeTab === "equipment" && equipmentOeeMode !== "past_shift",
    referenceDate
  );

  const pastShiftReport = usePastShiftReportOee(
    activeTab === "equipment" && equipmentOeeMode === "past_shift",
    pastShiftHookSelection,
    token
  );

  const equipmentOeeRollupByMachine =
    equipmentOeeMode === "past_shift" ? pastShiftReport.byMachineId : analyticsRollup.byMachineId;
  const equipmentOeeScope =
    equipmentOeeMode === "past_shift" ? pastShiftReport.scope : analyticsRollup.scope;
  const equipmentOeeRollupLoading =
    equipmentOeeMode === "past_shift" ? pastShiftReport.loading : analyticsRollup.loading;
  const equipmentOeeRollupError =
    equipmentOeeMode === "past_shift" ? pastShiftReport.error : analyticsRollup.error;

  const handleMachineClick = useCallback((machineId: string) => {
    setSelectedMachineId(machineId);
    setActiveTab("equipment");
  }, []);

  const handleBackToEquipment = useCallback(() => {
    setSelectedMachineId(null);
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case "production":
        return (
          <ProductionOverview
            onMachineClick={handleMachineClick}
            machines={machines}
            machinesLoading={machinesLoading}
          />
        );
      case "quality":
        return <QualityControl />;
      case "equipment":
        // If a machine is selected, show detail page
        if (selectedMachineId) {
          return (
            <EquipmentDetailTab
              machineId={selectedMachineId}
              onBack={handleBackToEquipment}
              equipmentOeeMode={equipmentOeeMode}
              onEquipmentOeeModeChange={setEquipmentOeeMode}
              equipmentOeeRollupByMachine={equipmentOeeRollupByMachine}
              equipmentOeeScope={equipmentOeeScope}
              equipmentOeeRollupLoading={equipmentOeeRollupLoading}
              equipmentOeeRollupError={equipmentOeeRollupError}
              referenceDate={referenceDate}
              onReferenceDateChange={setReferenceDate}
              pastIsoShiftNumber={pastIsoShiftNumber}
              onPastIsoShiftNumberChange={setPastIsoShiftNumber}
              authToken={token}
            />
          );
        }
        // Otherwise show equipment overview
        return (
          <EquipmentStatus
            machines={machines}
            machinesLoading={machinesLoading}
            onMachineClick={handleMachineClick}
            equipmentOeeMode={equipmentOeeMode}
            onEquipmentOeeModeChange={setEquipmentOeeMode}
            equipmentOeeRollupByMachine={equipmentOeeRollupByMachine}
            equipmentOeeScope={equipmentOeeScope}
            equipmentOeeRollupLoading={equipmentOeeRollupLoading}
            equipmentOeeRollupError={equipmentOeeRollupError}
            referenceDate={referenceDate}
            onReferenceDateChange={setReferenceDate}
            pastIsoShiftNumber={pastIsoShiftNumber}
            onPastIsoShiftNumberChange={setPastIsoShiftNumber}
            authToken={token}
          />
        );
      case "analytics":
        return (
          <PerformanceAnalyticsTab machines={machines} machinesLoading={machinesLoading} />
        );
      case "maintenance":
        return <Maintenance machines={machines} />;
      case "schedule":
        return <ProductionSchedule machines={machines} />;
      case "accounts":
        return <AccountManagement token={token} />;
      default:
        return (
          <ProductionOverview
            onMachineClick={handleMachineClick}
            machines={machines}
            machinesLoading={machinesLoading}
          />
        );
    }
  };

  // Reset selected machine when switching tabs
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSelectedMachineId(null);
  };

  // Show error message if there's an error
  if (hasError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A1E3A] via-[#0E2F4F] to-[#0A1E3A] p-4 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 max-w-2xl">
          <h1 className="text-2xl font-bold text-red-400 mb-4">⚠️ Error Loading Dashboard</h1>
          <p className="text-white/80 mb-4">{errorMessage || "An error occurred"}</p>
          <p className="text-white/60 text-sm mb-4">Check browser console (F12) for details.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <UserPresenceProvider token={token}>
      <div className="mes-dashboard min-h-screen bg-gradient-to-br from-[#0A1E3A] via-[#0E2F4F] to-[#0A1E3A] p-3 mobile-bottom-padding">
        <CompanyHeader onLogout={onLogout} />
      <TabNavigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        tabs={[
          { id: "production", label: "Production", icon: Activity },
          { id: "quality", label: "Quality", icon: ClipboardCheck },
          { id: "equipment", label: "Equipment", icon: Settings },
          { id: "analytics", label: "Analytics", icon: BarChart3 },
          { id: "maintenance", label: "Maintenance", icon: Wrench },
          { id: "schedule", label: "Schedule", icon: Calendar },
          ...(user.role === "admin" || user.role === "supervisor"
            ? [{ id: "accounts", label: "Accounts", icon: Shield }]
            : []),
        ]}
      />
      <ErrorBoundary fallbackTitle="This tab hit a rendering error">
        <Suspense fallback={tabSuspenseFallback}>{renderTabContent()}</Suspense>
      </ErrorBoundary>
      </div>
    </UserPresenceProvider>
  );
}
