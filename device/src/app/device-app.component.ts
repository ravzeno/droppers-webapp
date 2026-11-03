import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { CommonModule, DatePipe } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DeviceEntryRowComponent } from './device-entry-row.component';

interface PairingRequest {
  claimId: string;
  pairToken: string;
  status: string;
}
interface PairingClaim {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED';
}
interface StorageInfo {
  configured: boolean;
  rootName: string;
  totalBytes: number;
  usableBytes: number;
  usedBytes: number;
}
interface FileEntry {
  name: string;
  path: string;
  type: 'FILE' | 'DIRECTORY';
  size: number;
  mimeType: string | null;
  modifiedAt: string;
}
interface FileList {
  path: string;
  parentPath: string;
  items: FileEntry[];
}
interface TrashEntry {
  id: string;
  name: string;
  originalPath: string;
  type: string;
  size: number;
  deletedAt: string;
}
interface UploadTransfer {
  id: string;
  destinationPath: string;
  fileName: string;
  expectedBytes: number | null;
  status: string;
  createdAt: string;
}
interface PageResponse<T> {
  items: T[];
  totalPages: number;
  totalElement: number;
}
type Dialog = {
  title: string;
  label: string;
  value?: string;
  danger?: boolean;
  options?: string[];
  action: (value: string) => Promise<void>;
};
@Component({
  selector: 'device-root', standalone: true, imports: [CommonModule, DatePipe, DeviceEntryRowComponent],
  template: `
  <div class="device-app">
    <header class="topbar"><a class="brand" href="/"><span class="brand-mark">↓</span><span>droppers</span></a><div class="top-context"><span class="online-dot"></span>{{ storage()?.rootName || 'อุปกรณ์' }}</div></header>
    @if (stage() === 'pair') {
      <main class="pair-page">
        <section class="pair-card">
          <div class="step-badge">เชื่อมต่ออุปกรณ์</div>
          <span class="hero-icon">⇩</span>
          @if (!sessionId() || !code()) {
            <h1>เชื่อมต่อกับคอมของคุณ</h1>
            <p class="intro">เปิดกล้องมือถือแล้วสแกน QR ที่แสดงบนหน้าจอ Droppers ของคอม ระบบจะพาคุณกลับมาที่หน้านี้</p>
            <div class="how-scan"><span>1</span><p>เปิดกล้องมือถือ แล้วเล็งไปที่ QR บนคอม</p><span>2</span><p>แตะลิงก์ที่กล้องแสดง เพื่อกลับมาหน้านี้</p></div>
            <button class="btn secondary wide" type="button" (click)="startScanner()">เปิดกล้องสแกน QR</button>
            @if (cameraActive()) {
              <div class="scanner-preview">
                <video #scannerVideo autoplay muted playsinline></video>
                <p>เล็งกล้องไปที่ QR บนหน้าจอคอม</p>
                <button class="btn secondary" type="button" (click)="stopScanner()">ปิดกล้อง</button>
              </div>
            }
            <form class="paste-form" (submit)="readPairLink($event)"><label for="pair-link">หรือวางลิงก์จาก QR ที่นี่</label><div class="input-wrap"><input id="pair-link" name="pairLink" type="url" placeholder="http://192.168.1.x:4300/?sessionId=…&code=…" autocomplete="off"><button class="btn secondary" type="submit">เปิดลิงก์</button></div></form>
            <form class="pair-form" (submit)="enterPairingDetails($event)">
              <label for="pair-session-id">กรอกรหัสเองจากหน้าจอคอม</label>
              <input id="pair-session-id" name="sessionId" type="text" placeholder="Session ID" autocomplete="off" required>
              <input id="pair-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="รหัสจับคู่ 6 หลัก" aria-label="รหัสจับคู่ 6 หลัก" required>
              <button class="btn primary wide" type="submit">ใช้รหัสจับคู่</button>
            </form>
          } @else {
            <p class="eyebrow">คำขอจับคู่จากคอมเครื่องนี้</p><h1>อนุญาตอุปกรณ์นี้</h1><p class="intro">ตั้งชื่อให้มือถือ แล้วส่งคำขอให้เจ้าของคอมอนุมัติ</p>
            <div class="server-address"><small>กำลังเชื่อมต่อกับ</small><b>{{serverAddress()}}</b><span>รหัสจับคู่ {{code()}}</span></div>
            <form class="pair-form" (submit)="requestAccess($event)"><label for="device-name">ชื่ออุปกรณ์</label><input id="device-name" name="deviceName" [value]="deviceName()" maxlength="48" required><button class="btn primary wide" type="submit" [disabled]="busy()">{{busy() ? 'กำลังส่งคำขอ…' : 'ส่งคำขอเชื่อมต่อ'}}</button></form>
          }
          @if (error()) { <p class="inline-error" role="alert">{{error()}}</p> }
        </section><p class="privacy-note">การเข้าถึงต้องได้รับอนุมัติจากคอมก่อน</p>
      </main>
    } @else if (stage() === 'waiting') {
      <main class="state-page"><section class="state-card"><span class="pending-mark">◷</span><p class="eyebrow">คำขอส่งแล้ว</p><h1>รอเจ้าของคอมอนุมัติ</h1><p>เปิดหน้า Devices บนคอม แล้วกด “Allow device” เพื่ออนุญาต {{deviceName()}}</p><div class="waiting-line"><span></span>กำลังรอการยืนยัน…</div><button class="text-button" (click)="cancelPairing()">ยกเลิกคำขอ</button></section></main>
    } @else if (stage() === 'files') {
      <main class="files-page">
        <section class="device-welcome"><div><p class="eyebrow">เชื่อมต่อแล้ว</p><h1>ส่งไฟล์เข้าคอม</h1><p>ไฟล์จะถูกบันทึกลงใน <b>{{storage()?.rootName}}</b> บนคอมของคุณ</p></div><span class="connected-mark">✓</span></section>
        @if (storage(); as info) { <section class="storage-meter"><div class="meter-label"><span>พื้นที่ว่าง</span><b>{{formatSize(info.usableBytes)}} จาก {{formatSize(info.totalBytes)}}</b></div><div class="meter-track"><span [style.width.%]="usagePercent(info)"></span></div><small>ที่จัดเก็บ: {{info.rootName}}</small></section> }
        <div class="file-toolbar"><div class="crumbs"><button (click)="loadFiles('')">ไฟล์ของฉัน</button>@for (part of breadcrumbs(); track part.path) { <span>/</span><button (click)="loadFiles(part.path)">{{part.name}}</button> }</div><div class="toolbar-buttons"><button class="btn secondary" [disabled]="!currentPath()" (click)="goUp()">↑ กลับ</button><button class="btn secondary" (click)="createFolder()">+ โฟลเดอร์</button><button class="btn primary" (click)="picker.click()">＋ เลือกไฟล์</button><input #picker type="file" multiple hidden (change)="uploadFiles($event)"></div></div>
        <section class="file-panel" (dragover)="allowDrop($event)" (drop)="dropFiles($event)">
          <div class="file-panel-heading"><div><h2>{{currentPath() || 'ไฟล์ของฉัน'}}</h2><span>{{entries().length}} รายการ</span></div></div>
          @if (busy()) { <div class="empty-state">กำลังโหลด…</div> }
          @else if (!entries().length) { <div class="empty-state"><span class="empty-icon">▤</span><b>โฟลเดอร์นี้ยังว่าง</b><span>เลือกไฟล์จากมือถือ หรือวางไฟล์ที่นี่</span><button class="btn primary" (click)="picker.click()">เลือกไฟล์จากมือถือ</button></div> }
          @else { @for (entry of entries(); track entry.path) { <device-entry-row [icon]="entry.type === 'DIRECTORY' ? '▰' : '—'" [title]="entry.name" [details]="(entry.type === 'DIRECTORY' ? 'โฟลเดอร์' : formatSize(entry.size)) + ' · ' + (entry.modifiedAt | date:'d MMM y')" actionLabel="•••" (open)="entry.type === 'DIRECTORY' ? loadFiles(entry.path) : download(entry)" (action)="openFileActions(entry)" /> } }
        </section>
        <section class="bottom-nav"><button [class.selected]="section() === 'files'" (click)="section.set('files')"><span>▤</span>ไฟล์</button><button [class.selected]="section() === 'trash'" (click)="showTrash()"><span>⌫</span>ถังขยะ</button><button (click)="disconnect()"><span>↗</span>ออกจากระบบ</button></section>
      </main>
    } @else {
      <main class="files-page"><section class="device-welcome"><div><p class="eyebrow">รายการที่ลบ</p><h1>ถังขยะ</h1><p>กู้คืนไฟล์กลับไปยังตำแหน่งเดิมได้</p></div><button class="btn secondary" (click)="section.set('files'); loadFiles(currentPath())">กลับไปไฟล์</button></section><section class="file-panel">@if (!trashItems().length) { <div class="empty-state"><span class="empty-icon">⌫</span><b>ถังขยะว่าง</b></div> } @else { @for (item of trashItems(); track item.id) { <device-entry-row icon="—" [title]="item.name" [details]="item.originalPath + ' · ' + (item.deletedAt | date:'d MMM y')" actionLabel="กู้คืน" (action)="restore(item)" /> } }</section><section class="bottom-nav"><button (click)="section.set('files'); loadFiles(currentPath())"><span>▤</span>ไฟล์</button><button class="selected"><span>⌫</span>ถังขยะ</button><button (click)="disconnect()"><span>↗</span>ออกจากระบบ</button></section></main>
    }
    @if (dialog(); as dlg) { <div class="sheet-backdrop" (click)="dialog.set(null)"><form class="action-sheet" (click)="$event.stopPropagation()" (submit)="submitDialog($event)"><div class="sheet-grab"></div><h2>{{dlg.title}}</h2>@if (dlg.options?.length) { <div class="sheet-options">@for (option of dlg.options; track option) { <button type="button" class="sheet-option" [class.option-danger]="option === 'ลบ'" (click)="chooseAction(option)">{{option}}</button> }</div> } @else if (dlg.danger) { <p class="confirm-copy">{{dlg.label}}</p> } @else { <label>{{dlg.label}}<input name="actionValue" [value]="dlg.value || ''" autofocus></label> }@if (!dlg.options?.length) { <div class="sheet-buttons"><button type="button" class="btn secondary" (click)="dialog.set(null)">ยกเลิก</button><button type="submit" class="btn" [class.primary]="!dlg.danger" [class.danger-btn]="dlg.danger">{{dlg.danger ? 'ยืนยัน' : 'บันทึก'}}</button></div> }</form></div> }
    @if (toast()) { <div class="toast" role="status">{{toast()}}</div> }
  </div>`
})
export class DeviceAppComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private poller?: ReturnType<typeof setTimeout>;
  private cameraStream?: MediaStream;
  private scanTimer?: ReturnType<typeof setTimeout>;
  private scannerVideo?: ElementRef<HTMLVideoElement>;

  @ViewChild('scannerVideo') set scannerVideoElement(element: ElementRef<HTMLVideoElement> | undefined) {
    this.scannerVideo = element;
  }

  stage = signal<'pair' | 'waiting' | 'files'>('pair');
  section = signal<'files' | 'trash'>('files');
  sessionId = signal('');
  code = signal('');
  claimId = signal('');
  pairToken = signal('');
  deviceId = signal('');
  deviceName = signal('');
  accessToken = signal('');
  storage = signal<StorageInfo | null>(null);
  currentPath = signal('');
  entries = signal<FileEntry[]>([]);
  trashItems = signal<TrashEntry[]>([]);
  busy = signal(false);
  error = signal('');
  toast = signal('');
  dialog = signal<Dialog | null>(null);
  cameraActive = signal(false);

  async ngOnInit() {
    this.deviceId.set(this.getOrCreateId());
    this.deviceName.set(localStorage.getItem('droppers-device-name') || 'มือถือของฉัน');

    const params = new URLSearchParams(location.search);
    const sessionId = params.get('sessionId') || params.get('session_id') || '';
    const code = params.get('code') || params.get('pairingCode') || '';
    const hasPairingLink = Boolean(sessionId && /^\d{6}$/.test(code));

    if (hasPairingLink) {
      this.sessionId.set(sessionId);
      this.code.set(code);
    }

    const token = localStorage.getItem('droppers-access-token') || '';
    // A saved device session takes precedence over pairing details left in the
    // address bar. Mobile browsers restore the original QR URL after closing a tab.
    if (token) {
      this.accessToken.set(token);
      try {
        await this.loadStorage();
        this.clearPairingQuery();
        this.stage.set('files');
        await this.loadFiles('');
        return;
      } catch {
        this.clearAccessToken();
      }
    }

    const pending = this.readPending();
    if (pending) {
      this.claimId.set(pending.claimId);
      this.pairToken.set(pending.pairToken);
      this.deviceName.set(pending.deviceName);
      this.stage.set('waiting');
      this.pollClaim();
      return;
    }
  }

  ngOnDestroy() {
    if (this.poller) clearTimeout(this.poller);
    this.stopScanner();
  }

  async startScanner() {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      this.fail('การใช้กล้องต้องเปิดหน้าเว็บผ่าน HTTPS หรือ localhost ใช้วางลิงก์หรือกรอกรหัสแทนได้');
      return;
    }

    const Detector = (window as Window & {
      BarcodeDetector?: new (options: { formats: string[] }) => {
        detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
      };
    }).BarcodeDetector;
    if (!Detector) {
      this.fail('เบราว์เซอร์นี้ยังไม่รองรับการสแกน QR ในหน้าเว็บ ใช้วางลิงก์หรือกรอกรหัสแทนได้');
      return;
    }

    this.error.set('');
    this.cameraActive.set(true);
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const video = this.scannerVideo?.nativeElement;
      if (!video) throw new Error('ไม่พบหน้าต่างแสดงภาพจากกล้อง');
      video.srcObject = this.cameraStream;
      await video.play();
      void this.scanFrame(new Detector({ formats: ['qr_code'] }));
    } catch {
      this.stopScanner();
      this.fail('เปิดกล้องไม่ได้ ตรวจสอบสิทธิ์กล้องหรือใช้วางลิงก์แทน');
    }
  }

  stopScanner() {
    if (this.scanTimer) clearTimeout(this.scanTimer);
    this.cameraStream?.getTracks().forEach((track) => track.stop());
    this.cameraStream = undefined;
    if (this.scannerVideo) this.scannerVideo.nativeElement.srcObject = null;
    this.cameraActive.set(false);
  }

  private async scanFrame(detector: {
    detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
  }) {
    const video = this.scannerVideo?.nativeElement;
    if (!this.cameraActive() || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      if (this.cameraActive()) this.scanTimer = setTimeout(() => void this.scanFrame(detector), 250);
      return;
    }

    try {
      const [result] = await detector.detect(video);
      if (result?.rawValue) {
        this.stopScanner();
        this.applyPairingLink(result.rawValue);
        return;
      }
    } catch {
      this.stopScanner();
      this.fail('สแกน QR ไม่สำเร็จ ลองวางลิงก์หรือกรอกรหัสแทน');
      return;
    }

    this.scanTimer = setTimeout(() => void this.scanFrame(detector), 250);
  }

  serverAddress() {
    return `${location.protocol}//${location.hostname}:8765`;
  }

  private getOrCreateId() {
    const key = 'droppers-device-id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = globalThis.crypto?.randomUUID?.()
        ?? `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(key, id);
    }
    return id;
  }

  readPairLink(event: SubmitEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const raw = String(new FormData(form).get('pairLink') || '').trim();

    this.applyPairingLink(raw);
  }

  private applyPairingLink(raw: string) {
    try {
      const url = new URL(raw);
      const sessionId = url.searchParams.get('sessionId') || url.searchParams.get('session_id') || '';
      const code = url.searchParams.get('code') || url.searchParams.get('pairingCode') || '';
      if (!sessionId || !/^\d{6}$/.test(code)) throw new Error('Invalid pairing link');

      this.sessionId.set(sessionId);
      this.code.set(code);
      history.replaceState(
        {},
        '',
        `${location.pathname}?sessionId=${encodeURIComponent(sessionId)}&code=${encodeURIComponent(code)}`,
      );
    } catch {
      this.fail('QR หรือลิงก์ไม่ถูกต้อง ลองอีกครั้ง');
    }
  }

  enterPairingDetails(event: SubmitEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const sessionId = String(new FormData(form).get('sessionId') || '').trim();
    const code = String(new FormData(form).get('code') || '').trim();
    if (!sessionId || !/^\d{6}$/.test(code)) {
      this.fail('กรุณากรอก Session ID และรหัสจับคู่ 6 หลัก');
      return;
    }

    this.sessionId.set(sessionId);
    this.code.set(code);
    history.replaceState(
      {},
      '',
      `${location.pathname}?sessionId=${encodeURIComponent(sessionId)}&code=${encodeURIComponent(code)}`,
    );
  }

  async requestAccess(event: SubmitEvent) {
    event.preventDefault();
    if (!this.sessionId() || !this.code()) {
      this.fail('ยังไม่มีข้อมูลจับคู่จาก QR');
      return;
    }

    const form = event.currentTarget as HTMLFormElement;
    const name = String(new FormData(form).get('deviceName') || '').trim();
    if (!name) {
      this.fail('กรุณาตั้งชื่ออุปกรณ์');
      return;
    }

    this.busy.set(true);
    this.error.set('');
    try {
      const result = await firstValueFrom(
        this.http.post<PairingRequest>('/api/v1/pairing/claims', {
          sessionId: this.sessionId(),
          code: this.code(),
          deviceId: this.deviceId(),
          deviceName: name,
        }),
      );
      this.claimId.set(result.claimId);
      this.pairToken.set(result.pairToken);
      this.deviceName.set(name);
      localStorage.setItem('droppers-device-name', name);
      localStorage.setItem(
        'droppers-pending-pair',
        JSON.stringify({
          sessionId: this.sessionId(),
          claimId: result.claimId,
          pairToken: result.pairToken,
          deviceName: name,
        }),
      );
      // Pairing URLs contain short-lived credentials. The pending claim is saved
      // locally, so there is no need to keep those credentials in browser history.
      this.clearPairingQuery();
      this.stage.set('waiting');
      this.pollClaim();
    } catch (error) {
      this.fail(this.errorMessage(error, 'ส่งคำขอไม่สำเร็จ รหัสอาจหมดอายุ'));
    } finally {
      this.busy.set(false);
    }
  }

  private async pollClaim() {
    if (!this.claimId()) return;

    try {
      const claim = await firstValueFrom(
        this.http.get<PairingClaim>(
          `/api/v1/pairing/claims/${encodeURIComponent(this.claimId())}`,
        ),
      );
      if (claim.status === 'REJECTED') {
        this.fail('คำขอถูกปฏิเสธจากคอม');
        this.stage.set('pair');
        localStorage.removeItem('droppers-pending-pair');
        return;
      }
      if (claim.status === 'APPROVED') {
        await this.completePairing();
        return;
      }
    } catch (error) {
      this.fail(this.errorMessage(error, 'ตรวจสอบสถานะคำขอไม่ได้'));
    }

    this.poller = setTimeout(() => this.pollClaim(), 2000);
  }

  private async completePairing() {
    this.busy.set(true);
    try {
      const result = await firstValueFrom(
        this.http.post<{ deviceId: string; accessToken: string }>(
          `/api/v1/pairing/claims/${encodeURIComponent(this.claimId())}/complete`,
          { pairToken: this.pairToken() },
        ),
      );
      this.accessToken.set(result.accessToken);
      localStorage.setItem('droppers-access-token', result.accessToken);
      localStorage.removeItem('droppers-pending-pair');
      await this.loadStorage();
      this.stage.set('files');
      await this.loadFiles('');
      this.say('เชื่อมต่อสำเร็จ');
    } catch (error) {
      this.fail(this.errorMessage(error, 'ยืนยันการเชื่อมต่อไม่สำเร็จ'));
      this.poller = setTimeout(() => this.pollClaim(), 2500);
    } finally {
      this.busy.set(false);
    }
  }

  private readPending(): {
    claimId: string;
    pairToken: string;
    deviceName: string;
  } | null {
    try {
      const value = localStorage.getItem('droppers-pending-pair');
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  cancelPairing() {
    if (this.poller) clearTimeout(this.poller);
    localStorage.removeItem('droppers-pending-pair');
    this.claimId.set('');
    this.pairToken.set('');
    this.stage.set('pair');
  }

  private headers() {
    return new HttpHeaders({ 'X-Droppers-Token': this.accessToken() });
  }

  private async loadStorage() {
    const info = await firstValueFrom(
      this.http.get<StorageInfo>('/api/v1/mobile/storage', { headers: this.headers() }),
    );
    if (!info.configured) throw new Error('ยังไม่ได้ตั้งค่าโฟลเดอร์บนคอม');
    this.storage.set(info);
  }

  async loadFiles(path: string) {
    this.section.set('files');
    this.busy.set(true);
    try {
      const params = path ? new HttpParams().set('path', path) : new HttpParams();
      const result = await firstValueFrom(
        this.http.get<FileList>('/api/v1/files', { headers: this.headers(), params }),
      );
      this.currentPath.set(result.path);
      this.entries.set(result.items);
    } catch (error) {
      this.fail(this.errorMessage(error, 'โหลดไฟล์ไม่สำเร็จ'));
    } finally {
      this.busy.set(false);
    }
  }

  breadcrumbs() {
    let path = '';
    return this.currentPath().split('/').filter(Boolean).map((name) => {
      path = path ? `${path}/${name}` : name;
      return { name, path };
    });
  }

  goUp() {
    const parts = this.currentPath().split('/').filter(Boolean);
    parts.pop();
    void this.loadFiles(parts.join('/'));
  }

  async uploadFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    for (const file of files) await this.uploadOne(file);
  }

  allowDrop(event: DragEvent) {
    event.preventDefault();
  }

  async dropFiles(event: DragEvent) {
    event.preventDefault();
    for (const file of Array.from(event.dataTransfer?.files || [])) {
      await this.uploadOne(file);
    }
  }

  private async uploadOne(file: File) {
    this.busy.set(true);
    const destinationPath = this.currentPath();
    const headers = this.headers();

    try {
      const before = await firstValueFrom(
        this.http.get<UploadTransfer[]>('/api/v1/transfers/uploads', { headers }),
      );
      await firstValueFrom(
        this.http.post<void>(
          '/api/v1/transfers/uploads',
          { destinationPath, fileName: file.name, expectedBytes: file.size },
          { headers },
        ),
      );
      const after = await firstValueFrom(
        this.http.get<UploadTransfer[]>('/api/v1/transfers/uploads', { headers }),
      );
      const previousIds = new Set(before.map((transfer) => transfer.id));
      const transfer = after.find(
        (item) =>
          !previousIds.has(item.id) &&
          item.status === 'STAGING' &&
          item.fileName === file.name &&
          item.destinationPath === destinationPath &&
          item.expectedBytes === file.size,
      );
      if (!transfer) throw new Error('ไม่พบรายการอัปโหลดที่เพิ่งสร้าง');

      await firstValueFrom(
        this.http.put(
          `/api/v1/transfers/uploads/${encodeURIComponent(transfer.id)}/content`,
          file,
          {
            headers: headers.set('Content-Type', 'application/octet-stream'),
            responseType: 'json',
          },
        ),
      );
      await this.loadFiles(destinationPath);
      this.say(`ส่ง ${file.name} สำเร็จ`);
    } catch (error) {
      this.fail(this.errorMessage(error, `ส่ง ${file.name} ไม่สำเร็จ`));
    } finally {
      this.busy.set(false);
    }
  }

  async download(entry: FileEntry) {
    try {
      const blob = await firstValueFrom(
        this.http.get('/api/v1/files/download', {
          headers: this.headers(),
          params: { path: entry.path },
          responseType: 'blob',
        }),
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = entry.name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      this.fail(this.errorMessage(error, 'ดาวน์โหลดไม่สำเร็จ'));
    }
  }

  createFolder() {
    this.openDialog('สร้างโฟลเดอร์', 'ชื่อโฟลเดอร์', '', async (name) => {
      if (!name.trim()) {
        this.fail('กรุณาระบุชื่อโฟลเดอร์');
        return;
      }
      try {
        await firstValueFrom(
          this.http.post(
            '/api/v1/folders',
            { parentPath: this.currentPath(), name: name.trim() },
            { headers: this.headers() },
          ),
        );
        await this.loadFiles(this.currentPath());
      } catch (error) {
        this.fail(this.errorMessage(error, 'สร้างโฟลเดอร์ไม่สำเร็จ'));
      }
    });
  }

  openFileActions(entry: FileEntry) {
    const options = entry.type === 'DIRECTORY'
      ? ['เปิด', 'เปลี่ยนชื่อ', 'ย้าย', 'ลบ']
      : ['ดาวน์โหลด', 'เปลี่ยนชื่อ', 'ย้าย', 'ลบ'];
    this.dialog.set({
      title: entry.name,
      label: '',
      options,
      action: async (action) => {
        if (action === 'เปิด') {
          await this.loadFiles(entry.path);
        } else if (action === 'ดาวน์โหลด') {
          await this.download(entry);
        } else if (action === 'ลบ') {
          this.confirmTrash(entry);
        } else if (action === 'เปลี่ยนชื่อ') {
          this.renameFile(entry);
        } else if (action === 'ย้าย') {
          this.moveFile(entry);
        }
      },
    });
  }

  private confirmTrash(entry: FileEntry) {
    this.openDialog('ย้ายไปถังขยะ?', `ย้าย “${entry.name}” ไปถังขยะ`, undefined, async () => {
      try {
        await firstValueFrom(
          this.http.delete('/api/v1/files', {
            headers: this.headers(),
            params: { path: entry.path },
          }),
        );
        await this.loadFiles(this.currentPath());
      } catch (error) {
        this.fail(this.errorMessage(error, 'ลบไฟล์ไม่สำเร็จ'));
      }
    }, true);
  }

  private renameFile(entry: FileEntry) {
    this.openDialog('เปลี่ยนชื่อ', 'ชื่อใหม่', entry.name, async (name) => {
      try {
        await firstValueFrom(
          this.http.patch(
            '/api/v1/files/rename',
            { path: entry.path, newName: name.trim() },
            { headers: this.headers() },
          ),
        );
        await this.loadFiles(this.currentPath());
      } catch (error) {
        this.fail(this.errorMessage(error, 'เปลี่ยนชื่อไม่สำเร็จ'));
      }
    });
  }

  private moveFile(entry: FileEntry) {
    this.openDialog(
      'ย้ายไฟล์',
      'พาธโฟลเดอร์ปลายทาง (เว้นว่างเพื่อย้ายไปหน้าแรก)',
      '',
      async (destinationDirectory) => {
        try {
          await firstValueFrom(
            this.http.post(
              '/api/v1/files/move',
              { source: entry.path, destinationDirectory: destinationDirectory.trim() },
              { headers: this.headers() },
            ),
          );
          await this.loadFiles(this.currentPath());
        } catch (error) {
          this.fail(this.errorMessage(error, 'ย้ายไฟล์ไม่สำเร็จ'));
        }
      },
    );
  }

  async chooseAction(action: string) {
    const dialog = this.dialog();
    this.dialog.set(null);
    await dialog?.action(action);
  }

  async showTrash() {
    this.section.set('trash');
    this.busy.set(true);
    try {
      const page = await firstValueFrom(
        this.http.get<PageResponse<TrashEntry>>('/api/v1/trash', {
          headers: this.headers(),
          params: { page: 1, pageSize: 500 },
        }),
      );
      this.trashItems.set(page.items);
    } catch (error) {
      this.fail(this.errorMessage(error, 'โหลดถังขยะไม่สำเร็จ'));
    } finally {
      this.busy.set(false);
    }
  }

  async restore(item: TrashEntry) {
    try {
      await firstValueFrom(
        this.http.post(
          `/api/v1/trash/${encodeURIComponent(item.id)}/restore`,
          {},
          { headers: this.headers() },
        ),
      );
      await this.showTrash();
      this.say('กู้คืนไฟล์แล้ว');
    } catch (error) {
      this.fail(this.errorMessage(error, 'กู้คืนไม่สำเร็จ'));
    }
  }

  private openDialog(
    title: string,
    label: string,
    value: string | undefined,
    action: (value: string) => Promise<void>,
    danger = false,
  ) {
    this.dialog.set({ title, label, value, danger, action });
  }

  async submitDialog(event: SubmitEvent) {
    event.preventDefault();
    const dialog = this.dialog();
    if (!dialog) return;

    const form = event.currentTarget as HTMLFormElement;
    const value = String(new FormData(form).get('actionValue') || '');
    this.dialog.set(null);
    await dialog.action(value);
  }

  formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;

    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let index = -1;
    do {
      size /= 1024;
      index++;
    } while (size >= 1024 && index < units.length - 1);

    return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`;
  }

  usagePercent(info: StorageInfo) {
    return info.totalBytes
      ? Math.min(100, Math.max(0, (info.usedBytes / info.totalBytes) * 100))
      : 0;
  }

  private clearAccessToken() {
    localStorage.removeItem('droppers-access-token');
    this.accessToken.set('');
  }

  private clearPairingQuery() {
    if (location.search) history.replaceState({}, '', location.pathname);
  }

  disconnect() {
    this.clearAccessToken();
    localStorage.removeItem('droppers-pending-pair');
    this.storage.set(null);
    this.stage.set('pair');
    this.sessionId.set('');
    this.code.set('');
    history.replaceState({}, '', location.pathname);
  }

  private errorMessage(error: unknown, fallback: string) {
    if (error && typeof error === 'object') {
      const response = error as {
        status?: number;
        message?: string;
        error?: { status?: number; message?: string; error?: string } | string;
      };
      const body = response.error;
      const status = response.status ?? (typeof body === 'object' ? body?.status : undefined);

      if (status === 426) {
        return 'Service บังคับใช้ HTTPS สำหรับการเชื่อมต่อผ่าน LAN ตั้ง DROPPERS_REQUIRE_TLS_FOR_LAN=false เพื่อทดสอบผ่าน HTTP แล้ว restart service';
      }
      if (status === 0) {
        return 'ติดต่อ service ไม่ได้ ตรวจสอบ IP, firewall และ DROPPERS_BIND_ADDRESS';
      }
      if (status === 400 || status === 403) {
        return 'Service ปฏิเสธ host หรือ origin ตรวจสอบ DROPPERS_ALLOWED_HOSTS ให้มี IP ของคอม';
      }
      if (typeof body === 'object' && body?.message) return body.message;
      if (typeof body === 'object' && body?.error) return body.error;
      if (response.message && !(error instanceof Error)) return response.message;
      if (error instanceof Error && response.status === undefined) return error.message;
      if (status) return `${fallback} (HTTP ${status})`;
    }
    return fallback;
  }

  private fail(message: string) {
    this.error.set(message);
  }

  private say(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(''), 3200);
  }
}
