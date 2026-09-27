import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={compact 
          ? "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-md hover:from-amber-400 hover:to-yellow-400 active:scale-95 transition-all cursor-pointer"
          : "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-950 shadow-lg hover:from-amber-400 hover:to-yellow-400 active:scale-95 transition-all cursor-pointer w-full"
        }
        title="Cài đặt trò chơi về màn hình chính điện thoại để chơi không cần mạng"
      >
        <Download size={compact ? 13 : 16} className="text-slate-950" />
        <span>Cài App về điện thoại (Chơi Offline)</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={compact
            ? "inline-flex items-center gap-1.5 rounded-full bg-blue-900/60 border border-yellow-400/50 px-3 py-1.5 text-xs font-semibold text-yellow-300 hover:bg-blue-800 active:scale-95 transition-all"
            : "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-900/60 border border-yellow-400/50 px-4 py-2.5 text-xs sm:text-sm font-semibold text-yellow-300 hover:bg-blue-800 active:scale-95 transition-all w-full"
          }
        >
          <Smartphone size={compact ? 13 : 16} className="text-yellow-400" />
          <span>Thêm vào màn hình iPhone</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 text-left">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border-2 border-yellow-500/60 p-5 shadow-2xl text-white relative">
              <button 
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-3 right-3 text-slate-400 hover:text-white p-1"
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-2 text-yellow-400 font-bold text-base mb-2">
                <Smartphone size={20} /> Cài đặt trên iPhone / iPad
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-2">
                Để chơi game mọi lúc mọi nơi kể cả khi không có Wifi/4G:<br />
                1. Nhấn nút <strong>Chia sẻ (Share <span className="inline-block px-1 bg-slate-800 rounded">⎋</span>)</strong> trên thanh công cụ Safari.<br />
                2. Cuộn xuống và chọn <strong>&quot;Thêm vào MH chính&quot; (Add to Home Screen)</strong>.<br />
                3. Nhấn <strong>Thêm (Add)</strong> ở góc trên bên phải.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 py-2.5 text-xs sm:text-sm font-bold text-slate-950 hover:brightness-110 active:scale-98 transition"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
