import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Check, 
  Copy, 
  Send, 
  RefreshCw, 
  X, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  CloudOff, 
  Cloud, 
  HelpCircle,
  Clock,
  Sparkles,
  Wifi
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getGoogleSheetUrl, 
  setGoogleSheetUrl, 
  testSheetConnection, 
  getOfflineQueue, 
  syncOfflineQueue, 
  getSubmissionsHistory,
  SubmissionHistoryItem,
  GOOGLE_APPS_SCRIPT_CODE 
} from '../services/googleSheetService';

interface GoogleSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleSheetModal: React.FC<GoogleSheetModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'config' | 'code' | 'history'>('config');
  const [urlInput, setUrlInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [history, setHistory] = useState<SubmissionHistoryItem[]>([]);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const currentUrl = getGoogleSheetUrl();
      setUrlInput(currentUrl);
      setTestResult(null);
      setSavedSuccess(false);
      refreshData();
    }
  }, [isOpen]);

  const refreshData = () => {
    setOfflineCount(getOfflineQueue().length);
    setHistory(getSubmissionsHistory());
  };

  const handleSaveUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setGoogleSheetUrl(urlInput);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleTestConnection = async () => {
    if (!urlInput.trim()) {
      setTestResult({ success: false, message: 'Vui lòng nhập hoặc dán URL Google Apps Script trước.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testSheetConnection(urlInput);
      setTestResult(res);
      if (res.success) {
        setGoogleSheetUrl(urlInput);
        refreshData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({ success: false, message: `Lỗi kết nối: ${msg}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = GOOGLE_APPS_SCRIPT_CODE;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncOfflineQueue();
      refreshData();
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  const currentConfiguredUrl = getGoogleSheetUrl();
  const isConnected = !!currentConfiguredUrl;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 text-left">
        <motion.div 
          initial={{ scale: 0.92, opacity: 0, y: 15 }} 
          animate={{ scale: 1, opacity: 1, y: 0 }} 
          exit={{ scale: 0.92, opacity: 0, y: 15 }}
          className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] flex flex-col text-white relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/80">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400">
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  Kết Nối Google Sheet Lưu Điểm
                  {isConnected ? (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/40 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Đã kết nối
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-600 font-semibold">
                      Chưa cấu hình
                    </span>
                  )}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400">
                  Tự động lưu điểm học sinh lên Google Trang tính (Hỗ trợ Vercel & Offline)
                </p>
              </div>
            </div>

            <button 
              id="close-google-sheet-modal"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-1.5 my-3 p-1 bg-slate-800/80 rounded-xl border border-slate-700/60 text-xs">
            <button
              onClick={() => setActiveTab('config')}
              className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'config'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <FileSpreadsheet size={14} /> Cấu hình & Kiểm tra
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'code'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Copy size={14} /> Mã Apps Script & Hướng dẫn
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Clock size={14} /> Lịch sử ({history.length})
              {offlineCount > 0 && (
                <span className="bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full font-black text-[10px]">
                  {offlineCount}
                </span>
              )}
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 text-xs sm:text-sm">
            
            {/* TAB 1: CONFIGURATION & TEST */}
            {activeTab === 'config' && (
              <div className="space-y-3.5">
                <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/80 space-y-2.5">
                  <label className="block text-xs font-bold text-slate-200">
                    URL Ứng dụng web Google Apps Script (Web App URL):
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="url"
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-600 focus:border-emerald-400 text-white px-3 py-2 rounded-xl text-xs font-mono outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveUrl}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Check size={14} /> Lưu
                    </button>
                  </div>
                  {savedSuccess && (
                    <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 size={12} /> Đã lưu URL thành công vào bộ nhớ máy!
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 leading-normal">
                    💡 <em>Gợi ý:</em> Sau khi dán code vào Google Sheet và chọn Triển khai (Deploy) làm Ứng dụng web (Web App), bạn copy đường dẫn kết thúc bằng <code className="text-yellow-400">/exec</code> và dán vào đây.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isTesting}
                    onClick={handleTestConnection}
                    className="flex-1 min-w-[180px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isTesting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> Đang kiểm tra kết nối...
                      </>
                    ) : (
                      <>
                        <Send size={14} /> Gửi 1 dòng kiểm tra tới Sheet
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('code')}
                    className="bg-slate-800 hover:bg-slate-700 text-yellow-400 border border-yellow-500/40 font-bold py-2.5 px-3.5 rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <HelpCircle size={14} /> Xem cách lấy mã
                  </button>
                </div>

                {/* Test Result Feedback */}
                {testResult && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-xl border flex items-start gap-2 text-xs leading-relaxed ${
                      testResult.success 
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200' 
                        : 'bg-red-950/40 border-red-500/50 text-red-200'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold">{testResult.success ? 'Kiểm tra thành công!' : 'Chưa thể kết nối!'}</div>
                      <div>{testResult.message}</div>
                    </div>
                  </motion.div>
                )}

                {/* Offline Queue Status */}
                <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {offlineCount > 0 ? (
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                        <CloudOff size={16} />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                        <Cloud size={16} />
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-bold text-white">
                        Hàng đợi ngoại tuyến: {offlineCount} bài thi
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {offlineCount > 0 
                          ? 'Các bài thi làm khi mất mạng sẽ tự động gửi khi có Internet.' 
                          : 'Tất cả bài thi đều đã được đồng bộ an toàn.'}
                      </div>
                    </div>
                  </div>

                  {offlineCount > 0 && (
                    <button
                      disabled={isSyncing}
                      onClick={handleManualSync}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} /> Đồng bộ ngay
                    </button>
                  )}
                </div>

                {/* Vercel Deployment Note */}
                <div className="bg-blue-950/30 p-3 rounded-xl border border-blue-500/30 text-xs text-blue-200 leading-relaxed">
                  <strong className="text-yellow-300 block mb-1">🚀 Lưu ý khi triển khai lên Vercel:</strong>
                  Khi đưa website lên Vercel, bạn có thể thiết lập biến môi trường <code className="bg-black/40 px-1 py-0.5 rounded text-amber-300">VITE_GOOGLE_SHEET_URL</code> là đường link Apps Script của bạn. Như vậy toàn bộ học sinh khi mở link Vercel sẽ tự động nộp bài về trang tính của bạn mà không cần phải cài đặt thủ công trên từng máy!
                </div>
              </div>
            )}

            {/* TAB 2: APPS SCRIPT CODE & STEP-BY-STEP INSTRUCTIONS */}
            {activeTab === 'code' && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                  <span className="text-xs font-bold text-slate-200">
                    Mã nguồn dán vào Google Apps Script:
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check size={14} className="text-white" /> Đã sao chép!
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Sao chép toàn bộ mã
                      </>
                    )}
                  </button>
                </div>

                {/* Code block viewer */}
                <div className="relative">
                  <pre className="bg-[#0b1329] border border-slate-700 text-emerald-400 p-3.5 rounded-xl text-[11px] sm:text-xs font-mono max-h-56 overflow-y-auto overflow-x-auto leading-relaxed select-all">
                    {GOOGLE_APPS_SCRIPT_CODE}
                  </pre>
                </div>

                {/* Step-by-step instructions */}
                <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/70 space-y-2.5 text-xs text-slate-300 leading-relaxed">
                  <div className="font-bold text-yellow-400 text-sm flex items-center gap-1.5">
                    <Sparkles size={16} /> Các bước thiết lập trong 1 phút:
                  </div>

                  <div className="space-y-2 pl-1">
                    <div className="flex gap-2 items-start">
                      <span className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center shrink-0 font-bold text-[11px]">1</span>
                      <div>
                        Mở Google Sheets (Trang tính mới) tại <strong className="text-white">sheets.google.com</strong>, đặt tên ví dụ: <code className="text-yellow-300">Điểm Ai Là Triệu Phú Toán 11</code>.
                      </div>
                    </div>

                    <div className="flex gap-2 items-start">
                      <span className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center shrink-0 font-bold text-[11px]">2</span>
                      <div>
                        Trên thanh menu của Google Sheet, chọn: <strong className="text-white">Tiện ích mở rộng</strong> (Extensions) &rarr; <strong className="text-white">Apps Script</strong>.
                      </div>
                    </div>

                    <div className="flex gap-2 items-start">
                      <span className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center shrink-0 font-bold text-[11px]">3</span>
                      <div>
                        Xóa sạch mã mặc định trong file <code className="text-blue-300">Mã.gs</code>, bấm nút <strong>Sao chép mã</strong> ở trên và dán vào &rarr; Bấm biểu tượng <strong>Lưu dự án (💾)</strong>.
                      </div>
                    </div>

                    <div className="flex gap-2 items-start">
                      <span className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center shrink-0 font-bold text-[11px]">4</span>
                      <div>
                        Bấm nút màu xanh <strong className="text-emerald-400">Triển khai (Deploy)</strong> ở góc trên bên phải &rarr; Chọn <strong className="text-white">Tùy chọn triển khai mới (New deployment)</strong>.
                      </div>
                    </div>

                    <div className="flex gap-2 items-start">
                      <span className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center shrink-0 font-bold text-[11px]">5</span>
                      <div>
                        Nhấn biểu tượng Bánh răng ⚙️ bên cạnh "Chọn loại" &rarr; Chọn <strong className="text-white">Ứng dụng web (Web app)</strong>.
                      </div>
                    </div>

                    <div className="flex gap-2 items-start">
                      <span className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center shrink-0 font-bold text-[11px]">6</span>
                      <div>
                        Thiết lập quan trọng:
                        <ul className="list-disc pl-4 mt-1 space-y-0.5 text-slate-300">
                          <li>Thực thi dưới dạng (Execute as): <strong className="text-yellow-300">Tôi (Me)</strong></li>
                          <li>Ai có quyền truy cập (Who has access): <strong className="text-emerald-400 font-bold">Bất kỳ ai (Anyone)</strong> *(Bắt buộc để học sinh gửi bài tự động)*</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex gap-2 items-start">
                      <span className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center shrink-0 font-bold text-[11px]">7</span>
                      <div>
                        Bấm <strong>Triển khai (Deploy)</strong> &rarr; Cấp quyền truy cập nếu Google hỏi &rarr; <strong>Sao chép URL ứng dụng web (đuôi /exec)</strong> và dán vào tab Cấu hình!
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: LOCAL SUBMISSION HISTORY */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Lịch sử các lần nộp bài trên thiết bị này ({history.length} bản ghi):</span>
                  {offlineCount > 0 && (
                    <button
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} /> Đồng bộ ngay ({offlineCount})
                    </button>
                  )}
                </div>

                {history.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    Chưa có bài thi nào được ghi nhận trên thiết bị này. Khi học sinh hoàn thành bài thi, kết quả sẽ tự động lưu vào đây và Google Sheet!
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {history.map((item) => (
                      <div 
                        key={item.id}
                        className="bg-slate-800/60 p-2.5 sm:p-3 rounded-xl border border-slate-700 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs truncate">
                              {item.playerName} ({item.playerClass})
                            </span>
                            <span className="text-[10px] bg-blue-900/60 text-blue-300 px-1.5 py-0.5 rounded">
                              {item.score}/15 câu
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>{item.timestamp}</span>
                            <span>&bull;</span>
                            <span className="text-yellow-400 font-bold">{item.prize} đ</span>
                            <span>&bull;</span>
                            <span>{item.status}</span>
                          </div>
                        </div>

                        <div>
                          {item.synced ? (
                            <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <Check size={10} /> Đã gửi Sheet
                            </span>
                          ) : (
                            <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <CloudOff size={10} /> Chờ có mạng
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-700/80 mt-3 flex justify-between items-center text-xs">
            <span className="text-slate-400 text-[11px]">
              Tác giả: <strong className="text-yellow-400">Mr Thanh btx</strong>
            </span>
            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-5 rounded-xl transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
