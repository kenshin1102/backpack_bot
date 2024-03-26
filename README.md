# backpack_exchange

### Cài đặt

1. Cài đặt nodejs trên máy tính
 - Vào link https://nodejs.org/en/download, donwload phiên bản mới nhất về cài vào máy như cài phần mềm thông thường
2. Cài đặt git bash để chạy lệnh node
 - Vào link https://git-scm.com/download/win download `gitbash` về cài như một phần mềm thông thường
3. Đăng ký tài khoản BackPack nếu ai chưa có
- Vào link https://backpack.exchange/refer/ken (mình xin 1 ref), rồi đăng ký tài khoản, sàn này bắt KYC bằng căn cước công dân (tầm 1,2 phút là xong),
- Sau khi đăng ký xong vào link https://backpack.exchange/settings/api-keys để tạo API Key, chọn `New API key`, nhập tên rồi ấn `Generate` rồi nó đưa cho một cặp key, lưu cái cặp này lại nhé, tẹo dùng. Nhớ lưu lại chứ tẹo nó không show cho để copy đâu.
4. Download code từ github về máy
- Vào link https://github.com/kenshin1102/backpack_bot, chọn `code` -> `download zip` để tải code về, sau đó giải nén file này ra
5. Cài đặt code
- Vào thư mục code vừa giải nén, ấn chuột phải, chọn `git bash here` rồi gõ `npm install`
- Mở file `index.js` để chạy cặp SOL_USDC hoặc `index_wen.js` để chạy cặp WEN_USDC, tìm đến dòng `apisecret` và `apikey` để thay 2 cặp key lấy được ở bước 3 vào.
6. Chạy bot
- Trên terminal của git bash (chỗ vừa gõ npm install), gõ lệnh `node index.js` hoặc `node index_wen.js` để chạy bot
