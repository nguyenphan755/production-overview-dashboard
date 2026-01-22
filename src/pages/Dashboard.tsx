import React, { useEffect, useState } from "react";
import { CompanyHeader } from "../components/CompanyHeader";
import { TabNavigation } from "../components/TabNavigation";
import { ProductionOverview } from "../components/tabs/ProductionOverview";
import { QualityControl } from "../components/tabs/QualityControl";
import { EquipmentStatus } from "../components/tabs/EquipmentStatus";
import { EquipmentDetail } from "../components/tabs/EquipmentDetail";
import { PerformanceAnalytics } from "../components/tabs/PerformanceAnalytics";
import { Maintenance } from "../components/tabs/Maintenance";
import { ProductionSchedule } from "../components/tabs/ProductionSchedule";
import { Activity, BarChart3, Calendar, ClipboardCheck, Settings, Shield, Wrench } from "lucide-react";
import AccountManagement from "./AccountManagement";
import type { AuthUser } from "../services/authApi";

type DashboardProps = {
  onLogout: () => void;
  user: AuthUser;
  token: string;
};

export default function Dashboard({ onLogout, user, token }: DashboardProps) {
  const [activeTab, setActiveTab] = useState("production");
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handleMachineClick = (machineId: string) => {
    setSelectedMachineId(machineId);
    // Automatically switch to Equipment tab when a machine is clicked
    setActiveTab("equipment");
  };

  const handleBackToEquipment = () => {
    setSelectedMachineId(null);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "production":
        return <ProductionOverview onMachineClick={handleMachineClick} />;
      case "quality":
        return <QualityControl />;
      case "equipment":
        // If a machine is selected, show detail page
        if (selectedMachineId) {
          return <EquipmentDetail machineId={selectedMachineId} onBack={handleBackToEquipment} />;
        }
        // Otherwise show equipment overview
        return <EquipmentStatus onMachineClick={handleMachineClick} />;
      case "analytics":
        return <PerformanceAnalytics />;
      case "maintenance":
        return <Maintenance />;
      case "schedule":
        return <ProductionSchedule />;
      case "accounts":
        return <AccountManagement token={token} />;
      default:
        return <ProductionOverview onMachineClick={handleMachineClick} />;
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
    <div className="min-h-screen bg-gradient-to-br from-[#0A1E3A] via-[#0E2F4F] to-[#0A1E3A] p-3 mobile-bottom-padding">
      <div className="flex justify-end px-2 pb-2">
        <button
          type="button"
          onClick={onLogout}
          className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white"
        >
          Đăng xuất
        </button>
      </div>
      <CompanyHeader />
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
      {renderTabContent()}
    </div>
  );
}
