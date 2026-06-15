import { memo } from "react";
import { Sun, Users } from "lucide-react";
import { useUserPresence } from "../hooks/useUserPresence";

type OnlineUsersCounterProps = {
  compact?: boolean;
};

function PresenceSunIcon({ compact, isLive }: { compact: boolean; isLive: boolean }) {
  const size = compact ? "h-5 w-5" : "h-6 w-6";
  const sunSize = compact ? "h-4 w-4" : "h-5 w-5";

  if (!isLive) {
    return (
      <span className={`relative flex ${size} shrink-0 items-center justify-center`}>
        <Sun className={`${sunSize} text-white/30`} strokeWidth={2} />
      </span>
    );
  }

  return (
    <span className={`relative flex ${size} shrink-0 items-center justify-center`}>
      <span className="presence-breath-ring absolute inset-0 rounded-full bg-[#FFB86C]/30" />
      <span className="presence-breath-ring-delay absolute inset-0 rounded-full bg-[#4FFFBC]/20" />
      <Sun
        className={`presence-breath-sun relative ${sunSize} text-[#FFB86C]`}
        fill="#FFB86C"
        strokeWidth={1.75}
      />
    </span>
  );
}

export const OnlineUsersCounter = memo(function OnlineUsersCounter({
  compact = false,
}: OnlineUsersCounterProps) {
  const { count, users, isLive, toggleLive, isLoading } = useUserPresence();

  const label = isLoading ? "—" : String(count);
  const tooltip = isLive
    ? `${count} người đang trực tuyến${users.length ? `: ${users.map((u) => u.username).join(", ")}` : ""} — nhấn để tắt theo dõi realtime`
    : "Theo dõi realtime đang tắt — nhấn để bật";

  return (
    <button
      type="button"
      onClick={toggleLive}
      className={`group flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-left transition-colors hover:bg-white/10 ${
        compact ? "px-2 py-1.5" : ""
      }`}
      title={tooltip}
      aria-label={tooltip}
      aria-pressed={isLive}
    >
      <PresenceSunIcon compact={compact} isLive={isLive} />

      <Users
        className={`shrink-0 text-[#34E7F8] ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`}
      />

      <div className={compact ? "text-right" : ""}>
        <div
          className={`font-mono tracking-wide text-[#4FFFBC] ${
            compact ? "text-base leading-none" : "text-2xl leading-none"
          }`}
        >
          {label}
        </div>
        {!compact && (
          <div className="text-xs text-white/50">
            {isLive ? "đang trực tuyến" : "theo dõi tắt"}
          </div>
        )}
      </div>
    </button>
  );
});
