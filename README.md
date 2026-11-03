# Droppers Webapp

เว็บแอปสำหรับจัดการไฟล์บน Droppers แบ่งเป็นสองส่วน ได้แก่ backoffice สำหรับคอมพิวเตอร์ และ device portal สำหรับโทรศัพท์หรืออุปกรณ์ในเครือข่ายเดียวกัน ทั้งสองแอปใช้ Droppers service API ร่วมกัน

## ส่วนประกอบ

- **Backoffice** (`src/`): จัดการพื้นที่จัดเก็บ ไฟล์ ถังขยะ การอนุมัติอุปกรณ์ และไฟล์ที่รับเข้ามา
- **Device portal** (`device/`): จับคู่ผ่าน QR ขอสิทธิ์ใช้งาน รอการอนุมัติ และจัดการไฟล์จากอุปกรณ์
- **Droppers service**: API ที่ทั้งสองแอปเชื่อมต่อ โดยปกติรันที่ `http://127.0.0.1:8765`

## สิ่งที่ต้องมี

- Node.js และ npm
- Droppers service ที่กำลังทำงาน

ติดตั้ง dependencies จากโฟลเดอร์โปรเจกต์:

```bash
npm install
```

## เริ่มใช้งานในเครื่อง

เริ่ม backoffice ที่ `http://localhost:4200`:

```bash
npm start
```

backoffice ส่ง API ผ่าน Angular development proxy ซึ่งตั้งค่าไว้ใน `proxy.conf.json` ให้ชี้ไปที่ `http://127.0.0.1:8765`

เริ่ม device portal ที่ port `4300` และเปิดรับการเชื่อมต่อจากอุปกรณ์ในเครือข่าย:

```bash
npm run start:device
```

ตั้งค่า `droppers.device-portal-url` ใน Droppers service ให้เป็น URL ของ device portal ที่โทรศัพท์เข้าถึงได้ เช่น `http://<computer-lan-ip>:4300/` จากนั้นให้คอมพิวเตอร์และโทรศัพท์อยู่บนเครือข่ายเดียวกัน และตรวจสอบว่าเครือข่ายไม่ได้เปิด client isolation

## จับคู่อุปกรณ์

1. เปิดหน้า **Devices** ใน backoffice แล้วสร้าง QR สำหรับจับคู่
2. สแกน QR ด้วยโทรศัพท์เพื่อเปิด device portal และกรอกชื่ออุปกรณ์พร้อมส่งคำขอเข้าถึง
3. อนุมัติคำขอใน backoffice
4. เมื่ออนุมัติแล้ว device portal จะจับคู่เสร็จและใช้งานไฟล์ได้

Pairing session มีอายุ 10 นาที ส่วน device session มีอายุเริ่มต้น 30 วัน และกำหนดได้ด้วย `DROPPERS_DEVICE_SESSION_TTL_DAYS` ใน service

## API และความปลอดภัย

- Backoffice ใช้ proxy ของ Angular เพื่อเรียก `/api` ในเครื่อง
- Device portal เรียก service ที่ port `8765` โดยตรง เพื่อให้ service ตรวจสอบ LAN device token สำหรับการทำงานกับไฟล์
- คง header `X-Droppers-Token` ไว้สำหรับคำขอจากอุปกรณ์ อย่าแสดง device token ใน UI
- HTTP บน LAN เหมาะสำหรับทดสอบชั่วคราวในเครือข่ายที่เชื่อถือได้เท่านั้น การใช้งานจริงควรตั้งค่า HTTPS
- บาง browser context ที่เป็น HTTP อาจไม่มี `crypto.randomUUID()` แอปจึงมี fallback สำหรับการสร้าง device ID

## Build

สร้าง backoffice:

```bash
npm run build
```

สร้าง device portal:

```bash
npm run build:device
```

ไฟล์ build จะอยู่ใน `dist/` ซึ่งไม่ควร commit; dependencies ใน `node_modules/` และ Angular cache ใน `.angular/` ก็ถูกละเว้นผ่าน `.gitignore`
