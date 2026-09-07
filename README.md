# Vàng Nhật Anh – Website

Website giới thiệu sản phẩm và bảng giá vàng của **Công ty TNHH Vàng Nhật Anh** (716 Lạc Long Quân, Tây Hồ, Hà Nội).
Chạy hoàn toàn trên GitHub Pages, không cần máy chủ.

- Repo này (`vangnhatanh`): **mã nguồn** website + trang quản trị (`/admin`).
- Repo [`adminvangnhatanh`](https://github.com/duybui2203/adminvangnhatanh): **dữ liệu** (danh mục, sản phẩm, giá, thông tin công ty) và **ảnh**.

## Cấu trúc

```
index.html              trang chủ
admin/index.html        trang quản trị (đăng nhập hunghien / hunghien)
assets/css/style.css    giao diện chính
assets/css/admin.css    giao diện admin
assets/js/config.js     cấu hình: tài khoản GitHub, tên repo dữ liệu, tài khoản admin
assets/js/app.js        logic trang chủ (slider, danh mục, sản phẩm, bảng giá)
assets/js/github.js     gọi GitHub Contents API để đọc/ghi repo dữ liệu
assets/js/admin.js      logic trang quản trị
```

## Bật website lần đầu

1. Push repo này lên GitHub (nhánh `main`).
2. Vào **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main` / `/ (root)` → Save.
3. Sau 1–2 phút web chạy tại `https://duybui2203.github.io/vangnhatanh/`.
4. Repo `adminvangnhatanh` phải để **Public** thì web mới đọc được dữ liệu và ảnh.

## Trang quản trị

1. Mở web → bấm icon người dùng góc phải → đăng nhập `hunghien` / `hunghien`.
2. Lần đầu vào tab **Kết nối GitHub**, dán *Personal Access Token*:
   - Tạo tại https://github.com/settings/personal-access-tokens/new
   - Repository access: *Only select repositories* → chọn `adminvangnhatanh`
   - Permissions → Repository permissions → **Contents: Read and write**
   - Token chỉ lưu trong trình duyệt đang dùng (localStorage), không đưa vào code.
3. Sau đó thêm/sửa danh mục, sản phẩm, giá Vàng Nhật Anh, thông tin công ty. Mỗi lần lưu là một commit vào repo dữ liệu.
4. Ảnh tải lên được tự nén (WebP, tối đa 1600px) trước khi đưa lên GitHub.
5. Website ngoài cập nhật sau tối đa **5 phút** (cache của raw.githubusercontent.com).

### Đổi mật khẩu admin

Mật khẩu lưu dạng băm SHA-256 trong `assets/js/config.js`. Tạo băm mới:

```bash
printf 'mat-khau-moi' | shasum -a 256
```

Dán kết quả vào `admin.passHash`, đổi `admin.user` nếu muốn, rồi push lại.

## Chạy thử trên máy

```bash
# tại thư mục cha chứa cả 2 repo
python3 -m http.server 8765
# mở: http://localhost:8765/vangnhatanh/?data=http://localhost:8765/adminvangnhatanh/
```

## Bảng giá vàng

Các dòng SJC, DOJI, BTMC, Phú Quý, BTMH do GitHub Actions trong repo `adminvangnhatanh` tự lấy mỗi 15 phút
(xem `scripts/fetch-prices.mjs` bên đó). Dòng **Vàng Nhật Anh** chỉnh tay trong admin.
