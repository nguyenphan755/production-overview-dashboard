import { Activity, ClipboardCheck, Settings, BarChart3, Wrench, Calendar } from 'lucide-react';

interface TabItem {
  id: string;
  label: string;
  icon: any;
}

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  tabs?: TabItem[];
}

export function TabNavigation({ activeTab, onTabChange, tabs: tabsProp }: TabNavigationProps) {
  const baseTabs: TabItem[] = [
    { id: 'production', label: 'Production', icon: Activity },
    { id: 'quality', label: 'Quality', icon: ClipboardCheck },
    { id: 'equipment', label: 'Equipment', icon: Settings },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'schedule', label: 'Schedule', icon: Calendar }
  ];
  const tabs = tabsProp ?? baseTabs;

  return (
    <>
      <div className="desktop-only mb-2 rounded-2xl bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-2">
        <div className="flex gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                  transition-all duration-300 group touch-target
                  ${isActive 
                    ? 'bg-gradient-to-r from-[#34E7F8]/30 to-[#4FFFBC]/20 border border-[#34E7F8]/50 shadow-lg shadow-[#34E7F8]/20' 
                    : 'hover:bg-white/10 border border-transparent'
                  }
                `}
              >
                <Icon 
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-[#34E7F8]' : 'text-white/60 group-hover:text-white/80'
                  }`}
                  strokeWidth={2.5}
                />
                <span className={`text-sm tracking-wide transition-colors ${
                  isActive ? 'text-white' : 'text-white/60 group-hover:text-white/80'
                }`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mobile-bottom-nav">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`mobile-nav-item transition-all ${
                isActive
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'text-white/60'
              }`}
              aria-label={tab.label}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-[#34E7F8]' : 'text-white/60'}`} strokeWidth={2.5} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
