/**
 * =========================================================================================
 * GOOGLE APPS SCRIPT: TỰ ĐỘNG LƯU KẾT QUẢ THI "AI LÀ TRIỆU PHÚ TOÁN 11 - MR THANH BTX"
 * Tương thích 100% khi chạy trên Vercel, điện thoại Android, iOS và chế độ Ngoại Tuyến (Offline PWA)
 * =========================================================================================
 * 
 * HƯỚNG DẪN CÀI ĐẶT TRÊN GOOGLE SHEETS:
 * 1. Tạo 1 Google Trang tính (Google Sheets) mới, đặt tên ví dụ: "Bảng Điểm Ai Là Triệu Phú Toán 11"
 * 2. Trên thanh menu, chọn: Tiện ích mở rộng (Extensions) -> Apps Script
 * 3. Xóa toàn bộ mã mặc định trong tệp Mã.gs, sau đó sao chép toàn bộ nội dung file này dán vào.
 * 4. Nhấn nút "Lưu dự án" (biểu tượng đĩa mềm 💾).
 * 5. Nhấn nút "Triển khai" (Deploy) màu xanh ở góc trên bên phải -> Chọn "Tùy chọn triển khai mới" (New deployment).
 * 6. Nhấn vào biểu tượng Bánh răng ⚙️ bên cạnh "Chọn loại" -> Chọn "Ứng dụng web" (Web app).
 * 7. Thiết lập như sau (RẤT QUAN TRỌNG):
 *    - Mô tả (Description): Ai La Trieu Phu Toan 11
 *    - Thực thi dưới dạng (Execute as): Tôi (Me - địa chỉ email của bạn)
 *    - Ai có quyền truy cập (Who has access): Bất kỳ ai (Anyone)  <-- BẮT BUỘC để học sinh gửi điểm không cần đăng nhập
 * 8. Nhấn "Triển khai" (Deploy) -> Nhấn "Ủy quyền truy cập" (Authorize access) và chọn tài khoản Google của bạn (nếu có cảnh báo, chọn Nâng cao/Advanced -> Đi tới dự án).
 * 9. Sao chép "URL ứng dụng web" (Web App URL) có đuôi dạng ".../exec" và dán vào mục "Kết nối Google Sheet" trên app!
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Chờ tối đa 15 giây để xử lý an toàn đồng thời nhiều học sinh nộp bài cùng lúc
    lock.waitLock(15000);

    var contents = "";
    if (e && e.postData && e.postData.contents) {
      contents = e.postData.contents;
    } else if (e && e.parameter && e.parameter.data) {
      contents = e.parameter.data;
    }

    if (!contents) {
      return createJsonResponse({ 
        status: "error", 
        message: "Không tìm thấy nội dung gửi lên" 
      });
    }

    var data = JSON.parse(contents);

    // Mở trang tính
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("KetQuaThi");
    if (!sheet) {
      sheet = ss.getActiveSheet();
      if (sheet.getName() === "Trang tính 1" || sheet.getName() === "Sheet1") {
        sheet.setName("KetQuaThi");
      }
    }

    // Tự động tạo hàng tiêu đề nếu bảng tính chưa có dữ liệu
    if (sheet.getLastRow() === 0) {
      var headers = [
        "STT",
        "Thời Gian Nộp",
        "Họ Và Tên",
        "Lớp",
        "Số Câu Đúng",
        "Tổng Số Câu",
        "Mức Tiền Thưởng",
        "Thời Gian Làm Bài",
        "Bộ Đề",
        "Hình Thức Kết Thúc",
        "Chi Tiết Ghi Chú",
        "Thiết Bị"
      ];
      sheet.appendRow(headers);
      
      // Định dạng dòng tiêu đề sang trọng phong cách Ai Là Triệu Phú
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#0a0a23"); // Xanh đen sang trọng
      headerRange.setFontColor("#facc15"); // Chữ vàng ánh kim
      headerRange.setFontWeight("bold");
      headerRange.setFontSize(11);
      headerRange.setHorizontalAlignment("center");
      headerRange.setVerticalAlignment("middle");
      sheet.setRowHeight(1, 38);
      sheet.setFrozenRows(1); // Cố định dòng tiêu đề
    }

    var stt = sheet.getLastRow(); // Số thứ tự dòng
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

    // Canh lề đẹp mắt cho dòng mới chèn
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 1).setHorizontalAlignment("center"); // STT
    sheet.getRange(lastRow, 2).setHorizontalAlignment("center"); // Thời gian
    sheet.getRange(lastRow, 4).setHorizontalAlignment("center"); // Lớp
    sheet.getRange(lastRow, 5).setHorizontalAlignment("center"); // Câu đúng
    sheet.getRange(lastRow, 6).setHorizontalAlignment("center"); // Tổng câu
    sheet.getRange(lastRow, 7).setHorizontalAlignment("right");  // Tiền thưởng
    sheet.getRange(lastRow, 8).setHorizontalAlignment("center"); // Thời gian làm bài
    sheet.getRange(lastRow, 10).setHorizontalAlignment("center"); // Trạng thái

    // Đánh màu nổi bật theo kết quả
    var statusCell = sheet.getRange(lastRow, 10);
    if (data.status && data.status.indexOf("Chiến thắng") !== -1) {
      statusCell.setBackground("#dcfce7"); // Xanh lá nhạt
      statusCell.setFontColor("#166534");
      statusCell.setFontWeight("bold");
    } else if (data.status && data.status.indexOf("Dừng cuộc chơi") !== -1) {
      statusCell.setBackground("#fef9c3"); // Vàng nhạt
      statusCell.setFontColor("#854d0e");
    }

    sheet.setRowHeight(lastRow, 28);

    lock.releaseLock();
    return createJsonResponse({ 
      status: "success", 
      message: "Đã lưu kết quả thành công!", 
      row: lastRow 
    });

  } catch (error) {
    if (lock) {
      try { lock.releaseLock(); } catch (err) {}
    }
    return createJsonResponse({ 
      status: "error", 
      message: error.toString() 
    });
  }
}

function doGet(e) {
  // Kiểm tra kết nối từ app (Health Check)
  return createJsonResponse({
    status: "success",
    message: "Kết nối thành công tới Google Apps Script của GV Mr Thanh btx!",
    app: "Ai Là Triệu Phú - Toán 11 Lượng Giác",
    author: "Mr Thanh btx",
    serverTime: Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss")
  });
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
