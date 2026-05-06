import { Factory, MapPin, Clock, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';

type CompanyHeaderProps = {
  onLogout?: () => void;
};

export function CompanyHeader({ onLogout }: CompanyHeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('vi-VN', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <>
      <div className="desktop-only mb-2 rounded-2xl bg-gradient-to-r from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5" style={{ height: '100px' }}>
          {/* Company Info */}
          <div className="flex items-center gap-6">
            {/* Logo/Icon Area */}
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#34E7F8] to-[#4FFFBC] flex items-center justify-center shadow-[0_0_30px_rgba(52,231,248,0.4)]">
              <Factory className="w-9 h-9 text-[#0A1E3A]" strokeWidth={2.5} />
            </div>

            {/* Company Name & Location */}
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 
                  className="text-3xl tracking-wide"
                  style={{
                    color: 'var(--accent)',
                    backgroundColor: 'unset',
                    background: 'unset',
                    backgroundImage: 'none'
                  }}
                >
                  CADIVI
                </h1>
                <div className="w-px h-8 bg-gradient-to-b from-transparent via-white/40 to-transparent"></div>
                <span 
                  className="text-xl"
                  style={{
                    fontSize: '35px',
                    fontFamily: '"Segoe UI Emoji"',
                    color: 'rgba(53, 248, 86, 1)'
                  }}
                >
                  Production Overview
                </span>
              </div>
              <div className="flex items-center gap-4 text-white/60">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#FFB86C]" />
                  <span>Shop Floor Tân Á</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-white/40"></div>
                <span className="text-sm">Manufacturing Execution System</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-left">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-[#34E7F8]" />
                <div className="text-3xl text-[#34E7F8] tracking-wider font-mono">
                  {formatTime(currentTime)}
                </div>
              </div>
              <div className="text-white/60 text-sm">
                {formatDate(currentTime)}
              </div>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white"
                aria-label="Đăng xuất"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Decorative gradient line */}
        <div className="h-1 bg-gradient-to-r from-[#34E7F8] via-[#4FFFBC] to-[#34E7F8]"></div>
      </div>

      <div className="mobile-only mb-2 rounded-2xl bg-gradient-to-r from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden">
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#34E7F8] to-[#4FFFBC] flex items-center justify-center shadow-[0_0_20px_rgba(52,231,248,0.35)]">
                <Factory className="w-6 h-6 text-[#0A1E3A]" strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-lg text-white tracking-wide">CADIVI</div>
                <div className="text-xs text-white/60">Production Overview</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Clock className="w-4 h-4 text-[#34E7F8]" />
                  <div className="text-lg text-[#34E7F8] tracking-wider font-mono">
                    {formatTime(currentTime)}
                  </div>
                </div>
                <div className="text-white/60 text-xs">
                  {formatDate(currentTime)}
                </div>
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white"
                  aria-label="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-white/60 text-xs">
            <MapPin className="w-3.5 h-3.5 text-[#FFB86C]" />
            <span>Shop Floor Tân Á</span>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#34E7F8] via-[#4FFFBC] to-[#34E7F8]"></div>
      </div>
    </>
  );
}
