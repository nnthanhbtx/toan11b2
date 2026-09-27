/**
 * Google Sheet Integration Service for "Ai Là Triệu Phú - Toán 11"
 * Supports Vercel deployment, offline queueing, and automated background sync.
 */

export interface QuizResultPayload {
  id: string;
  timestamp: string;
  playerName: string;
  playerClass: string;
  score: number;
  totalQuestions: number;
  prize: string;
  timeSpent: string;
  setName: string;
  status: 'Chiến thắng (15/15)' | 'Trả lời sai' | 'Dừng cuộc chơi' | 'Hết thời gian' | 'Kiểm tra kết nối';
  details?: string;
  userAgent?: string;
}

export interface SubmissionHistoryItem extends QuizResultPayload {
  synced: boolean;
  syncError?: string;
}

const GOOGLE_SHEET_URL_KEY = 'ai_trieu_phu_sheet_url';
const OFFLINE_QUEUE_KEY = 'ai_trieu_phu_offline_queue';
const SUBMISSIONS_HISTORY_KEY = 'ai_trieu_phu_history';

/**
 * Full Apps Script code to copy and paste into Google Sheets (Extensions -> Apps Script)
 */
export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: TỰ ĐỘNG LƯU KẾT QUẢ "AI LÀ TRIỆU PHÚ TOÁN 11 - MR THANH BTX"
 * Hỗ trợ lưu tự động từ web Vercel, điện thoại di động và đồng bộ ngoại tuyến.
 * =========================================================================
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Chờ tối đa 15 giây để tránh xung đột ghi đồng thời từ nhiều học sinh
    lock.waitLock(15000);

    var contents = "";
    if (e && e.postData && e.postData.contents) {
      contents = e.postData.contents;
    } else if (e && e.parameter && e.parameter.data) {
      contents = e.parameter.data;
    }

    if (!contents) {
      return createJsonResponse({ status: "error", message: "Không tìm thấy nội dung gửi lên" });
    }

    var data = JSON.parse(contents);

    // Mở trang tính hiện tại hoặc trang tính có tên "KetQuaThi"
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("KetQuaThi");
    if (!sheet) {
      sheet = ss.getActiveSheet();
      if (sheet.getName() === "Trang tính 1" || sheet.getName() === "Sheet1") {
        sheet.setName("KetQuaThi");
      }
    }

    // Tự động tạo hàng tiêu đề nếu bảng tính đang trống
    if (sheet.getLastRow() === 0) {
      var headers = [
        "STT",
        "Thời Gian Nộp",
        "Họ Và Tên",
        "Lớp",
        "Số Câu Đúng",
        "Tổng Câu",
        "Tiền Thưởng",
        "Thời Gian Làm Bài",
        "Bộ Đề",
        "Kết Quả",
        "Chi Tiết",
        "Thiết Bị"
      ];
      sheet.appendRow(headers);
      
      // Định dạng dòng tiêu đề đẹp mắt chuyên nghiệp
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#0f172a"); // Xanh đậm sang trọng
      headerRange.setFontColor("#facc15"); // Chữ vàng nổi bật
      headerRange.setFontWeight("bold");
      headerRange.setHorizontalAlignment("center");
      headerRange.setVerticalAlignment("middle");
      sheet.setRowHeight(1, 35);
      sheet.setFrozenRows(1); // Cố định dòng tiêu đề
    }

    var stt = sheet.getLastRow(); // Số thứ tự tăng dần
    var nowVN = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");

    var rowData = [
      stt,
      data.timestamp || nowVN,
      data.playerName || "Khuyết danh",
      data.playerClass || "",
      data.score !== undefined ? data.score : 0,
      data.totalQuestions || 15,
      data.prize || "0 đ",
      data.timeSpent || "00:00",
      data.setName || "Mặc định",
      data.status || "Hoàn thành",
      data.details || "",
      data.userAgent || ""
    ];

    sheet.appendRow(rowData);

    // Căn giữa các cột thông số (STT, Thời gian, Lớp, Điểm, Tiền thưởng)
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 1).setHorizontalAlignment("center"); // STT
    sheet.getRange(lastRow, 2).setHorizontalAlignment("center"); // Ngày giờ
    sheet.getRange(lastRow, 4).setHorizontalAlignment("center"); // Lớp
    sheet.getRange(lastRow, 5).setHorizontalAlignment("center"); // Điểm
    sheet.getRange(lastRow, 6).setHorizontalAlignment("center"); // Tổng câu
    sheet.getRange(lastRow, 7).setHorizontalAlignment("right");  // Tiền thưởng
    sheet.getRange(lastRow, 8).setHorizontalAlignment("center"); // Thời gian

    lock.releaseLock();
    return createJsonResponse({ status: "success", message: "Đã lưu kết quả thành công!", row: lastRow });

  } catch (error) {
    if (lock) {
      try { lock.releaseLock(); } catch (err) {}
    }
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

function doGet(e) {
  // Phục vụ kiểm tra kết nối (Ping) từ giao diện Web App
  return createJsonResponse({
    status: "success",
    message: "Kết nối thành công tới Google Apps Script của GV Mr Thanh btx!",
    app: "Ai Là Triệu Phú - Toán 11 Lượng Giác",
    timestamp: Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss")
  });
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

/**
 * Get current configured Google Sheet Web App URL
 */
export function getGoogleSheetUrl(): string {
  if (typeof window === 'undefined') return '';
  const stored = localStorage.getItem(GOOGLE_SHEET_URL_KEY);
  if (stored && stored.trim().length > 0) {
    return stored.trim();
  }
  // Fallback to Vite environment variable if deployed on Vercel
  const envUrl = (import.meta as unknown as { env?: { VITE_GOOGLE_SHEET_URL?: string } }).env?.VITE_GOOGLE_SHEET_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim();
  }
  return '';
}

/**
 * Save Google Sheet Web App URL to localStorage
 */
export function setGoogleSheetUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const cleanUrl = url.trim();
  if (cleanUrl) {
    localStorage.setItem(GOOGLE_SHEET_URL_KEY, cleanUrl);
  } else {
    localStorage.removeItem(GOOGLE_SHEET_URL_KEY);
  }
}

/**
 * Get local history of submissions
 */
export function getSubmissionsHistory(): SubmissionHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SUBMISSIONS_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Add or update item in local history
 */
function recordSubmissionHistory(item: SubmissionHistoryItem): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getSubmissionsHistory();
    const existingIndex = list.findIndex(h => h.id === item.id);
    if (existingIndex >= 0) {
      list[existingIndex] = item;
    } else {
      list.unshift(item);
    }
    // Keep max 50 recent entries locally
    localStorage.setItem(SUBMISSIONS_HISTORY_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    // Local storage full or private mode safe
  }
}

/**
 * Get offline queue
 */
export function getOfflineQueue(): QuizResultPayload[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Add item to offline queue
 */
function addToOfflineQueue(item: QuizResultPayload): void {
  if (typeof window === 'undefined') return;
  try {
    const queue = getOfflineQueue();
    // Prevent duplicate entries
    if (!queue.some(q => q.id === item.id)) {
      queue.push(item);
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch {
    // ignore
  }
}

/**
 * Remove item from offline queue
 */
function removeFromOfflineQueue(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const queue = getOfflineQueue().filter(q => q.id !== id);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

/**
 * Dispatch an HTTP request to Google Apps Script Web App
 * Uses 'no-cors' mode with 'text/plain' to avoid CORS preflight failures on Google Apps Script redirects
 */
async function sendToGoogleScript(url: string, payload: QuizResultPayload): Promise<boolean> {
  const bodyText = JSON.stringify(payload);
  
  // Try sending via standard fetch with mode 'no-cors'
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: bodyText
    });
    return true;
  } catch (err) {
    console.warn('Fetch to Google Apps Script encountered an error:', err);
    // Fallback: try navigator.sendBeacon if available
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        const blob = new Blob([bodyText], { type: 'text/plain;charset=utf-8' });
        const beaconSuccess = navigator.sendBeacon(url, blob);
        if (beaconSuccess) return true;
      } catch (beaconErr) {
        console.warn('Beacon fallback failed:', beaconErr);
      }
    }
    throw err;
  }
}

/**
 * Test connectivity with the given Web App URL
 */
export async function testSheetConnection(url: string): Promise<{ success: boolean; message: string }> {
  const cleanUrl = url.trim();
  if (!cleanUrl) {
    return { success: false, message: 'Vui lòng nhập đường dẫn URL Google Apps Script.' };
  }
  if (!cleanUrl.startsWith('https://script.google.com/macros/s/')) {
    return { 
      success: false, 
      message: 'URL không đúng định dạng. Đường dẫn phải bắt đầu bằng: https://script.google.com/macros/s/.../exec' 
    };
  }

  try {
    // Test sending a ping payload
    const testPayload: QuizResultPayload = {
      id: 'test_' + Date.now(),
      timestamp: new Date().toLocaleString('vi-VN'),
      playerName: 'Kiểm tra hệ thống',
      playerClass: 'Admin Test',
      score: 15,
      totalQuestions: 15,
      prize: '85.000.000',
      timeSpent: '00:05',
      setName: 'Kiểm tra kết nối',
      status: 'Kiểm tra kết nối',
      details: 'Dòng kiểm tra kết nối từ ứng dụng Ai Là Triệu Phú Toán 11',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
    };

    await sendToGoogleScript(cleanUrl, testPayload);
    return { 
      success: true, 
      message: 'Kết nối thành công! Một dòng kiểm tra mẫu đã được gửi tới Google Sheet của bạn.' 
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { 
      success: false, 
      message: `Không thể kết nối tới Google Apps Script: ${errorMsg}. Vui lòng kiểm tra lại quyền truy cập đã đặt là "Bất kỳ ai (Anyone)" chưa.` 
    };
  }
}

/**
 * Auto-send quiz results to Google Sheet
 * Handles online, offline, and queued modes automatically
 */
export async function saveQuizResultToSheet(result: QuizResultPayload): Promise<{
  success: boolean;
  status: 'sent' | 'queued' | 'no_url';
  message: string;
}> {
  const url = getGoogleSheetUrl();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Record into local history
  recordSubmissionHistory({
    ...result,
    synced: false
  });

  if (!url) {
    return {
      success: false,
      status: 'no_url',
      message: 'Chưa cài đặt liên kết Google Sheet. Kết quả đã được lưu trong lịch sử trên thiết bị.'
    };
  }

  if (!isOnline) {
    // Queue for later sync when internet reconnects
    addToOfflineQueue(result);
    return {
      success: true,
      status: 'queued',
      message: 'Thiết bị đang ngoại tuyến. Kết quả đã được xếp hàng và sẽ tự động gửi khi có mạng Internet.'
    };
  }

  try {
    await sendToGoogleScript(url, result);
    // Mark as synced in history
    recordSubmissionHistory({
      ...result,
      synced: true
    });
    return {
      success: true,
      status: 'sent',
      message: 'Đã tự động lưu kết quả vào Google Sheet thành công!'
    };
  } catch (error) {
    // Network failed during send, push to offline queue
    addToOfflineQueue(result);
    return {
      success: true,
      status: 'queued',
      message: 'Gửi tạm thời thất bại do mạng chậm. Đã đưa vào hàng đợi tự động gửi lại.'
    };
  }
}

/**
 * Sync all queued offline submissions to Google Sheet
 */
export async function syncOfflineQueue(): Promise<{
  syncedCount: number;
  remainingCount: number;
}> {
  const url = getGoogleSheetUrl();
  if (!url) return { syncedCount: 0, remainingCount: getOfflineQueue().length };

  const queue = getOfflineQueue();
  if (queue.length === 0) return { syncedCount: 0, remainingCount: 0 };

  let syncedCount = 0;
  for (const item of queue) {
    try {
      await sendToGoogleScript(url, item);
      removeFromOfflineQueue(item.id);
      recordSubmissionHistory({ ...item, synced: true });
      syncedCount++;
    } catch {
      // stop if network fails again
      break;
    }
  }

  return {
    syncedCount,
    remainingCount: getOfflineQueue().length
  };
}

/**
 * Setup listener to auto-sync when network returns
 */
export function initAutoSyncListener(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => {
    syncOfflineQueue().then(({ syncedCount }) => {
      if (syncedCount > 0) {
        console.log(`[GoogleSheet] Tự động đồng bộ thành công ${syncedCount} kết quả thi ngoại tuyến!`);
      }
    });
  };

  window.addEventListener('online', handleOnline);

  // Also attempt sync on initial load if queue has items and we are online
  if (navigator.onLine && getOfflineQueue().length > 0) {
    setTimeout(handleOnline, 2500);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
