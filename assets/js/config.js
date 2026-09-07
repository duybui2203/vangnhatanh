// Cấu hình chung cho website và trang admin.
window.VNA_CONFIG = {
  owner: 'duybui2203',            // tài khoản GitHub
  dataRepo: 'adminvangnhatanh',   // repo chứa dữ liệu + ảnh sản phẩm
  branch: 'main',
  // Tài khoản admin (mật khẩu được lưu dạng băm SHA-256, không lưu chữ thường)
  admin: { user: 'hunghien', passHash: 'f3884f2add5922ea0077b3e9b7c37c8391da559dda9bbc9bbaadf7152bb84e08' },
  pricesRefreshMs: 60 * 1000,     // tần suất làm mới bảng giá trên trình duyệt
  slideDelayMs: 3000,             // pageview tự chuyển sau 3 giây
};
// Nơi đọc dữ liệu: mặc định là raw.githubusercontent.com của repo dữ liệu.
// Khi chạy thử local có thể truyền ?data=http://localhost:8081/ để đọc từ máy.
(function () {
  const c = window.VNA_CONFIG;
  const q = new URLSearchParams(location.search).get('data');
  if (q) sessionStorage.setItem('vna_data_base', q);
  c.dataBase = sessionStorage.getItem('vna_data_base') || `https://raw.githubusercontent.com/${c.owner}/${c.dataRepo}/${c.branch}/`;
})();
