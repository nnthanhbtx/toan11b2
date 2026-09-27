import React from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useOnlineStatus } from '../useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-emerald-950/90 border border-emerald-400/80 px-3.5 py-1 text-[11px] sm:text-xs font-semibold text-emerald-200 shadow-xl backdrop-blur-md animate-fade-in pointer-events-none">
      <WifiOff size={13} className="text-emerald-400 animate-pulse" />
      <span>Chế độ ngoại tuyến: Hoạt động 100% không cần Wifi</span>
    </div>
  );
};
