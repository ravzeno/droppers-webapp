import { Component, effect, inject, OnInit, signal } from "@angular/core";
import { CommonModule, DatePipe } from "@angular/common";
import { firstValueFrom } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { FileApiService } from "./features/explorer/data-access/file-api.service";
import { FileEntry } from "./core/models/file-entry";
import {
  TrashApiService,
  TrashEntry,
} from "./features/trash/data-access/trash-api.service";
import {
  PairingApiService,
  PairingSession,
} from "./features/pairing/data-access/pairing-api.service";
import {
  DeviceApiService,
  Device,
} from "./features/devices/data-access/device-api.service";
import { PairingClaim } from "./features/pairing/data-access/pairing-api.service";
import {
  TransferApiService,
  UploadTransfer,
} from "./features/explorer/data-access/transfer-api.service";

type AppView = "overview" | "files" | "trash" | "transfers" | "devices";

function savedView(): AppView {
  try {
    const value = sessionStorage.getItem("droppers-current-view");
    return value === "files" || value === "trash" || value === "transfers" || value === "devices"
      ? value
      : "overview";
  } catch {
    return "overview";
  }
}

function savedPath() {
  try {
    return sessionStorage.getItem("droppers-current-path") || "";
  } catch {
    return "";
  }
}

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: ` <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 19h14"/></svg></span><span>droppers</span>
      </div>
      <div class="server-badge">
        <span class="server-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg></span><span class="status-dot" [class.offline]="!online()"></span
        ><span
          ><b>This computer</b
          ><small>{{
            online() ? "Server is running" : "Server offline"
          }}</small></span
        >
      </div>
      <p class="nav-label">YOUR COMPUTER</p>
      <nav aria-label="Server navigation">
        <button
          class="nav"
          [class.active]="view() === 'overview'"
          (click)="view.set('overview')"
        >
          <span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></svg></span><span class="nav-copy"><b>Overview</b><small>Home and activity</small></span>
        </button>
        <button
          class="nav"
          [class.active]="view() === 'files'"
          (click)="view.set('files')"
        >
          <span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v1H5a2 2 0 0 0-2 2z"/><path d="M3 12a2 2 0 0 1 2-2h16l-2 8a2 2 0 0 1-2 1H5a2 2 0 0 1-2-2z"/></svg></span><span class="nav-copy"><b>Files</b><small>Browse saved files</small></span>
        </button>
        <button
          class="nav"
          [class.active]="view() === 'trash'"
          (click)="showTrash()"
        >
          <span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5m4-5v5"/></svg></span><span class="nav-copy"><b>Trash</b><small>Restore deleted files</small></span>
          <span class="count" *ngIf="trashItems().length">{{
            trashItems().length
          }}</span>
        </button>
      </nav>
      <p class="nav-label connected-label">DEVICES</p>
      <nav aria-label="Connected devices navigation">
        <button
          class="nav"
          [class.active]="view() === 'devices'"
          (click)="showDevices()"
        >
          <span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg></span><span class="nav-copy"><b>Devices</b><small>Manage trusted devices</small></span>
          <span class="count" *ngIf="devices().length">{{
            devices().length
          }}</span>
        </button>
        <button
          class="nav"
          [class.active]="view() === 'transfers'"
          (click)="showTransfers()"
        >
          <span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 4h16l2 8v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7z"/><path d="M2 12h6l2 3h4l2-3h6"/></svg></span><span class="nav-copy"><b>Incoming files</b><small>Files sent to this computer</small></span>
          <span class="count" *ngIf="transfers().length">{{
            transfers().length
          }}</span>
        </button>
      </nav>
      <div class="storage-mini">
        <small>SAVING FILES TO</small
        ><b>{{ rootName() || "Choose a folder" }}</b
        ><button class="change" (click)="chooseFolder()">Change folder</button>
      </div>
    </aside>
    <main class="main-area">
      <header class="page-header">
        <div>
          <p class="eyebrow">DROPPERS / THIS COMPUTER</p>
          <h1>
            {{
              view() === "overview"
                ? "Your server"
                : view() === "files"
                  ? "Files on this computer"
                  : view() === "trash"
                    ? "Trash"
                    : view() === "transfers"
                      ? "Incoming files"
                      : "Connected devices"
            }}
          </h1>
        </div>
        <div class="server-status" [class.offline]="!online()">
          <span class="status-dot" [class.offline]="!online()"></span
          >{{ online() ? "Ready to receive" : "Offline" }}
        </div>
      </header>
      @if (!root()) {
        <section class="setup-panel">
          <div class="setup-icon">▰</div>
          <div>
            <p class="eyebrow">FIRST, CHOOSE A DESTINATION</p>
            <h2>Where should Droppers save files?</h2>
            <p>
              Choose a folder on this computer. Files sent from your phone or
              another computer will arrive here.
            </p>
            <form class="root-form" (submit)="setRoot($event)">
              <label for="storage-path">Folder path on this computer</label>
              <div class="input-row">
                <input
                  id="storage-path"
                  type="text"
                  placeholder="/home/you/Downloads/Droppers"
                /><button class="button primary" type="submit">
                  Use this folder
                </button>
              </div>
            </form>
          </div>
        </section>
      } @else if (view() === "overview") {
        <section class="home-hero">
          <div class="hero-copy">
            <span class="hero-kicker"><span class="hero-live-dot"></span> YOUR PRIVATE FILE HUB</span>
            <h2>Send it here.<br /><em>It’s that simple.</em></h2>
            <p>Connect your phone or another computer, then send files straight to this device.</p>
            <button class="hero-button" (click)="showDevices()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>
              Connect a device <span aria-hidden="true">→</span>
            </button>
          </div>
          <div class="hero-art" aria-hidden="true">
            <span class="hero-orbit orbit-one"></span><span class="hero-orbit orbit-two"></span>
            <span class="hero-device"><svg viewBox="0 0 24 24"><path d="M12 16V4m-5 5 5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg></span>
            <span class="hero-file hero-file-one"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8m-8 4h8"/></svg></span>
            <span class="hero-file hero-file-two"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></span>
          </div>
          <div class="hero-footnote"><span class="status-dot"></span> This computer is ready to receive</div>
        </section>
        <section class="overview-grid home-summary">
          <article class="info-panel storage-panel">
            <div class="summary-heading"><span class="panel-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v1H5a2 2 0 0 0-2 2z"/><path d="M3 12a2 2 0 0 1 2-2h16l-2 8a2 2 0 0 1-2 1H5a2 2 0 0 1-2-2z"/></svg></span><span class="tag good">READY</span></div>
            <p class="eyebrow">FILE DESTINATION</p>
            <h3>{{ root() }}</h3>
            <button class="text-link" (click)="view.set('files')">Browse saved files <span>→</span></button>
          </article>
          <article class="info-panel devices-panel">
            <div class="summary-heading"><span class="panel-icon device-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg></span><span class="tag">{{ devices().length }} {{ devices().length === 1 ? 'DEVICE' : 'DEVICES' }}</span></div>
            <p class="eyebrow">CONNECTED DEVICES</p>
            <h3>{{ devices().length ? devices().length + (devices().length === 1 ? ' device is ready' : ' devices are ready') : 'No devices connected yet' }}</h3>
            <button class="text-link" (click)="showDevices()">Manage devices <span>→</span></button>
          </article>
        </section>
        <section class="how-panel home-how">
          <div class="how-heading"><div><p class="eyebrow">THREE QUICK STEPS</p><h2>From phone to folder</h2></div><button class="text-link" (click)="showDevices()">Get started <span>→</span></button></div>
          <div class="steps">
            <div class="step"><span class="step-number">1</span><div><b>Connect your device</b><p>Create a pairing QR code.</p></div></div>
            <div class="step"><span class="step-number">2</span><div><b>Approve the request</b><p>Scan the QR and allow access here.</p></div></div>
            <div class="step"><span class="step-number">3</span><div><b>Send your files</b><p>They’ll arrive in {{ rootName() }}.</p></div></div>
          </div>
        </section>
        <section class="recent-head">
          <div>
            <p class="eyebrow">LATEST ACTIVITY</p>
            <h2>Recent incoming files</h2>
          </div>
          <button class="text-link" (click)="showTransfers()">
            See all <span>→</span>
          </button>
        </section>
        <section class="activity-list">
          @if (!transfers().length) {
            <div class="activity-empty">
              Files sent from your devices will show up here.
            </div>
          } @else {
            @for (transfer of transfers().slice(0, 4); track transfer.id) {
              <div class="activity-row">
                <span class="file-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></span>
                <div class="activity-name">
                  <b>{{ transfer.fileName }}</b
                  ><small
                    >{{ transfer.destinationPath || "Home" }} ·
                    {{ transfer.createdAt | date: "MMM d, h:mm a" }}</small
                  >
                </div>
                <span class="transfer-status" [class.failed]="transfer.status === 'FAILED'"><span class="transfer-status-dot"></span>{{ transfer.status === 'COMPLETED' ? 'Received' : transfer.status === 'FAILED' ? 'Failed' : transfer.status }}</span>
              </div>
            }
          }
        </section>
      } @else if (view() === "files") {
        <section class="toolbar">
          <div class="crumbs">
            <button (click)="load('')">Home</button>
            @for (crumb of breadcrumbs(); track crumb.path) {
              <span>/</span
              ><button (click)="load(crumb.path)">{{ crumb.label }}</button>
            }
          </div>
          <div class="toolbar-actions">
            <input class="file-search" type="search" placeholder="Search this folder" aria-label="Search files" [value]="fileQuery()" (input)="fileQuery.set($any($event.target).value)" />
            <select aria-label="Sort files" [value]="fileSort()" (change)="fileSort.set($any($event.target).value)"><option value="name">Name</option><option value="modified">Modified</option><option value="size">Size</option></select>
            <button
              class="button secondary"
              [disabled]="!currentPath()"
              (click)="goUp()"
            >
              ↑ Up</button
            ><button class="button secondary" (click)="filePicker.click()">
              Upload</button
            ><button class="button primary" (click)="createFolder()">
              + New folder</button
            ><input #filePicker type="file" hidden (change)="upload($event)" />
          </div>
        </section>
        <section
          class="file-list"
          (dragover)="allowDrop($event)"
          (drop)="dropFiles($event)"
        >
          <div class="list-head">
            <span>Name</span><span>Modified</span><span>Size</span><span></span>
          </div>
          @if (loading()) {
            <div class="empty-state">Loading this folder…</div>
          } @else if (!entries().length) {
            <div class="empty-state">
              <span class="empty-mark">▤</span><b>This folder is empty</b
              ><span>Drop files here, upload, or create a folder.</span>
            </div>
          } @else {
            @for (entry of visibleEntries(); track entry.path) {
              <div class="file-row">
                <span class="file-name" (dblclick)="openEntry(entry)"
                  ><i>{{ entry.type === "DIRECTORY" ? "▰" : "—" }}</i
                  >{{ entry.name }}</span
                ><span>{{ entry.modifiedAt | date: "MMM d, y" }}</span
                ><span>{{
                  entry.type === "DIRECTORY" ? "—" : formatSize(entry.size)
                }}</span
                ><span class="row-actions"
                  ><button
                    *ngIf="entry.type === 'DIRECTORY'"
                    (click)="openEntry(entry)"
                  >
                    Open</button
                  ><button (click)="rename(entry)">Rename</button
                  ><button (click)="move(entry)">Move</button
                  ><button
                    *ngIf="entry.type === 'FILE'"
                    (click)="download(entry)"
                  >
                    Download</button
                  ><button class="danger" (click)="trash(entry)">
                    Trash
                  </button></span
                >
              </div>
            }
          }
        </section>
      } @else if (view() === "devices") {
        <section class="connect-intro">
          <div>
            <p class="eyebrow">ส่งไฟล์เข้าคอมพิวเตอร์เครื่องนี้</p>
            <h2>เชื่อมต่อมือถือหรือคอมพิวเตอร์</h2>
            <p>
              สแกน QR เพื่อขอเข้าใช้งาน แล้วกดยืนยันคำขอที่หน้านี้ เชื่อมต่อครั้งเดียวก็ส่งไฟล์ได้ทุกเมื่อ
            </p>
          </div>
          <button class="button primary" (click)="startPairing()">
            สร้าง QR สำหรับเชื่อมต่อ
          </button>
        </section>
        @if (pairing()) {
          <section class="pairing-panel">
            <div class="qr-wrap">
              <img
                *ngIf="pairing()!.qrCodeDataUrl"
                [src]="pairing()!.qrCodeDataUrl"
                alt="QR code to pair device"
              /><span *ngIf="!pairing()!.qrCodeDataUrl" class="qr-placeholder"
                >▦</span
              >
            </div>
            <div class="pair-instructions">
              <p class="eyebrow">รหัสใช้ครั้งเดียว</p>
              <h3>1. เปิดกล้องมือถือแล้วสแกน QR นี้</h3>
              <div class="pair-code">{{ pairing()!.code }}</div>
              <button class="button" type="button" (click)="copyPairingLink()">
                {{ pairingLinkCopied() ? "คัดลอกลิงก์แล้ว ✓" : "คัดลอกลิงก์สำหรับเปิดบนมือถือ" }}
              </button>
              <p class="pair-expiry">
                มือถือจะเปิดหน้า Droppers ให้ตั้งชื่อและส่งคำขอ จากนั้นกลับมากดยอมรับคำขอที่นี่ · รหัสหมดอายุเวลา
                {{ pairing()!.expiresAt | date: "shortTime" }}.
              </p>
              <details class="manual-entry">
                <summary>สแกนไม่ได้? ดูรหัสสำหรับกรอกเอง</summary>
                <p>รหัสเชื่อมต่อ <strong>{{ pairing()!.code }}</strong></p>
                <code>{{ pairing()!.sessionId }}</code>
              </details>
            </div>
          </section>
        }
        @if (pendingClaims().length) {
          <section class="section-block">
            <div class="section-title">
              <div>
                <p class="eyebrow">WAITING FOR YOU</p>
                <h2>2. ยืนยันคำขอจากอุปกรณ์</h2>
              </div>
            </div>
            <div class="file-list">
              @for (claim of pendingClaims(); track claim.id) {
                <div class="device-row">
                  <span class="device-avatar">▣</span>
                  <div class="activity-name">
                    <b>{{ claim.deviceName }}</b
                    ><small
                      >ส่งคำขอเมื่อ
                      {{ claim.createdAt | date: "MMM d, h:mm a" }}</small
                    >
                  </div>
                  <button class="button primary" (click)="approve(claim)">
                    อนุญาตอุปกรณ์
                  </button>
                </div>
              }
            </div>
          </section>
        } @else if (pairing()) {
          <section class="approval-hint" role="status">
            <span class="approval-hint-icon">⌛</span>
            <div>
              <b>รอคำขอจากมือถือของคุณ</b>
              <p>เมื่อส่งคำขอแล้ว ชื่ออุปกรณ์จะแสดงที่นี่ให้คุณตรวจสอบและอนุญาต</p>
            </div>
          </section>
        }
        <section class="section-block">
          <div class="section-title">
            <div>
              <p class="eyebrow">อุปกรณ์ที่อนุญาตแล้ว</p>
              <h2>อุปกรณ์ของคุณ</h2>
            </div>
          </div>
          <div class="file-list">
            @if (!devices().length) {
              <div class="empty-state compact">
                <b>ยังไม่มีอุปกรณ์ที่เชื่อมต่อ</b
                ><span>กด “สร้าง QR สำหรับเชื่อมต่อ” แล้วสแกนด้วยมือถือเพื่อเริ่มต้น</span>
              </div>
            } @else {
              @for (device of devices(); track device.id) {
                <div class="device-row">
                  <span class="device-avatar">▣</span>
                  <div class="activity-name">
                    <b>{{ device.name }}</b
                    ><small
                      >Connected {{ device.pairedAt | date: "MMM d, y" }} ·
                      {{
                        device.lastSeenAt
                          ? "Last active " + (device.lastSeenAt | date: "MMM d, y, h:mm a")
                          : "Not seen yet"
                      }}</small
                    >
                  </div>
                  <button
                    class="button danger-outline"
                    (click)="revoke(device)"
                  >
                    Remove
                  </button>
                </div>
              }
            }
          </div>
        </section>
      } @else if (view() === "transfers") {
        <section class="section-title page-section-title">
          <div>
            <p class="eyebrow">SENT FROM YOUR DEVICES</p>
            <h2>Incoming files</h2>
          </div>
        </section>
        <section class="file-list">
          @if (!transfers().length) {
            <div class="empty-state">
              <span class="empty-mark">⇧</span><b>No incoming files yet</b
              ><span>Connect a phone or computer to send files here.</span
              ><button class="button secondary" (click)="showDevices()">
                Connect a device
              </button>
            </div>
          } @else {
            @for (transfer of transfers(); track transfer.id) {
              <div class="activity-row">
                <span class="file-icon">—</span>
                <div class="activity-name">
                  <b>{{ transfer.fileName }}</b
                    ><small
                    >{{ transfer.destinationPath || "Home" }} ·
                    {{ transfer.createdAt | date: "MMM d, y, h:mm a" }}{{ transfer.failureReason ? ' · ' + transfer.failureReason : '' }}</small
                  >
                </div>
                <span
                  class="transfer-status"
                  [class.failed]="transfer.status === 'FAILED'"
                  >{{ transfer.status }}</span
                >
              </div>
            }
          }
        </section>
      } @else {
        <section class="section-title page-section-title">
          <div>
            <p class="eyebrow">REMOVED FILES</p>
            <h2>Trash</h2>
          </div>
        </section>
        <section class="file-list">
          @if (!trashItems().length) {
            <div class="empty-state">
              <span class="empty-mark">⌫</span><b>Trash is empty</b
              ><span>Files you move here can be restored.</span>
            </div>
          } @else {
            @for (item of trashItems(); track item.id) {
              <div class="file-row">
                <span class="file-name"
                  ><i>{{ item.type === "DIRECTORY" ? "▰" : "—" }}</i
                  >{{ item.name }}</span
                ><span>{{ item.originalPath }}</span
                ><span>{{ item.deletedAt | date: "MMM d, y" }}</span
                ><span class="row-actions"
                  ><button (click)="restore(item)">Restore</button
                  ><button class="danger" (click)="permanentlyDelete(item)">
                    Delete forever
                  </button></span
                >
              </div>
            }
          }
        </section>
      }
      @if (dialog(); as activeDialog) {
        <div class="modal-backdrop" (click)="dialog.set(null)">
          <form
            class="modal"
            role="dialog"
            aria-modal="true"
            [attr.aria-label]="activeDialog.title"
            (click)="$event.stopPropagation()"
            (submit)="submitDialog($event)"
          >
            <h2>{{ activeDialog.title }}</h2>
            <label
              >{{ activeDialog.label
              }}<input
                *ngIf="!activeDialog.confirm"
                name="dialogValue"
                [value]="activeDialog.value"
                autofocus
            /></label>
            <div class="modal-actions">
              <button
                type="button"
                class="button secondary"
                (click)="dialog.set(null)"
              >
                Cancel</button
              ><button
                type="submit"
                class="button"
                [class.danger-action]="activeDialog.confirm"
                [class.primary]="!activeDialog.confirm"
              >
                {{ activeDialog.confirm ? "Confirm" : "Save" }}
              </button>
            </div>
          </form>
        </div>
      }
      @if (error()) {
        <div class="toast" role="status">{{ error() }}</div>
      }
      @if (uploading()) { <div class="upload-progress" role="status"><b>{{uploading()}}</b><span>{{uploadPercent()}}%</span><progress max="100" [value]="uploadPercent()"></progress><button class="button secondary" (click)="cancelUpload()">Cancel upload</button></div> }
      @if (retryFile()) { <div class="upload-retry" role="alert"><span>{{retryFile()!.name}} לאสำเร็จ</span><button class="button secondary" (click)="retryUpload()">ลองอีกครั้ง</button><button class="button secondary" (click)="retryFile.set(null)">ปิด</button></div> }
    </main>
  </div>`,
})
export class AppComponent implements OnInit {
  private http = inject(HttpClient);
  private files = inject(FileApiService);
  private trashApi = inject(TrashApiService);
  private pairingApi = inject(PairingApiService);
  private deviceApi = inject(DeviceApiService);
  private transferApi = inject(TransferApiService);
  root = signal("");
  rootName = signal("");
  currentPath = signal(savedPath());
  entries = signal<FileEntry[]>([]);
  fileQuery = signal("");
  fileSort = signal("name");
  uploading = signal("");
  uploadPercent = signal(0);
  retryFile = signal<File | null>(null);
  activeTransferId = signal("");
  uploadCancelled = false;
  trashItems = signal<TrashEntry[]>([]);
  devices = signal<Device[]>([]);
  pendingClaims = signal<PairingClaim[]>([]);
  pairing = signal<PairingSession | null>(null);
  pairingLinkCopied = signal(false);
  transfers = signal<UploadTransfer[]>([]);
  view = signal<AppView>(savedView());
  private persistNavigation = effect(() => {
    try {
      sessionStorage.setItem("droppers-current-view", this.view());
      sessionStorage.setItem("droppers-current-path", this.currentPath());
    } catch {
      // Keep navigation usable when browser storage is unavailable.
    }
  });
  online = signal(false);
  loading = signal(false);
  error = signal("");
  dialog = signal<{
    title: string;
    label: string;
    value: string;
    confirm: boolean;
    action: (value: string) => Promise<void>;
  } | null>(null);
  async ngOnInit() {
    try {
      await firstValueFrom(this.http.get("/api/v1/health"));
      this.online.set(true);
      const settings = await firstValueFrom(
        this.http.get<{ root: string; }>("/api/v1/storage/root"),
      );
      this.root.set(settings.root);
      this.rootName.set(settings.root.split("/").filter(Boolean).pop() || "");
      if (settings.root) await this.load(this.currentPath());
      await Promise.all([this.loadTransfers(), this.loadDevices()]);
      if (this.view() === "trash") await this.loadTrash();
      if (this.view() === "devices") await this.loadPendingClaims();
    } catch {
      this.fail("Backend unavailable. Start the Droppers server.");
    }
  }
  breadcrumbs() {
    let built = "";
    return this.currentPath()
      .split("/")
      .filter(Boolean)
      .map((label) => ({
        label,
        path: (built = built ? built + "/" + label : label),
      }));
  }
  visibleEntries() {
    const query = this.fileQuery().trim().toLocaleLowerCase();
    return this.entries().filter((entry) => !query || entry.name.toLocaleLowerCase().includes(query)).slice().sort((a,b) => {
      if (a.type !== b.type) return a.type === "DIRECTORY" ? -1 : 1;
      if (this.fileSort() === "size") return b.size - a.size;
      if (this.fileSort() === "modified") return b.modifiedAt.localeCompare(a.modifiedAt);
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });
  }
  chooseFolder() {
    this.root.set("");
    this.rootName.set("");
  }
  async setRoot(event: SubmitEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const input = form.querySelector("input");
    const path = input?.value.trim();
    if (!path) return this.fail("Enter a folder path.");
    try {
      const result = await firstValueFrom(
        this.http.put<{ root: string; }>("/api/v1/storage/root", { path }),
      );
      this.root.set(result.root);
      this.rootName.set(result.root.split("/").filter(Boolean).pop() || "");
      await this.load("");
    } catch (e) {
      this.fail(this.message(e));
    }
  }
  async load(path: string) {
    this.loading.set(true);
    try {
      const r = await firstValueFrom(this.files.list(path));
      this.currentPath.set(r.path);
      this.entries.set(r.items);
    } catch (e) {
      this.fail(this.message(e));
    } finally {
      this.loading.set(false);
    }
  }
  openEntry(e: FileEntry) {
    if (e.type === "DIRECTORY") void this.load(e.path);
  }
  goUp() {
    const s = this.currentPath().split("/");
    s.pop();
    void this.load(s.join("/"));
  }
  createFolder() {
    this.openDialog("Create folder", "Folder name", "", false, async (name) => {
      if (!name.trim()) return this.fail("Enter a folder name.");
      try {
        await firstValueFrom(
          this.files.createFolder(this.currentPath(), name.trim()),
        );
        await this.load(this.currentPath());
      } catch (e) {
        this.fail(this.message(e));
      }
    });
  }
  rename(e: FileEntry) {
    this.openDialog("Rename item", "New name", e.name, false, async (name) => {
      if (!name.trim() || name === e.name) return;
      try {
        await firstValueFrom(this.files.rename(e.path, name.trim()));
        await this.load(this.currentPath());
      } catch (x) {
        this.fail(this.message(x));
      }
    });
  }
  move(e: FileEntry) {
    this.openDialog(
      "Move item",
      "Destination folder (leave blank for Home)",
      "",
      false,
      async (destination) => {
        try {
          await firstValueFrom(this.files.move(e.path, destination.trim()));
          await this.load(this.currentPath());
        } catch (x) {
          this.fail(this.message(x));
        }
      },
    );
  }
  trash(e: FileEntry) {
    this.openDialog(
      "Move to Trash?",
      `Move “${e.name}” to Trash?`,
      "",
      true,
      async () => {
        try {
          await firstValueFrom(this.files.trash(e.path));
          await this.load(this.currentPath());
          await this.loadTrash();
        } catch (x) {
          this.fail(this.message(x));
        }
      },
    );
  }
  async upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    input.value = "";
    if (file) await this.uploadFile(file);
  }
  allowDrop(event: DragEvent) {
    event.preventDefault();
  }
  async dropFiles(event: DragEvent) {
    event.preventDefault();
    for (const file of Array.from(event.dataTransfer?.files ?? []))
      await this.uploadFile(file);
  }
  private async uploadFile(file: File) {
    this.uploadCancelled = false;
    this.uploading.set(file.name);
    this.uploadPercent.set(0);
    this.retryFile.set(null);
    try {
      const transfer = await firstValueFrom(
        this.transferApi.createAndFind(this.currentPath(), file.name, file.size),
      );
      this.activeTransferId.set(transfer.id);
      await firstValueFrom(this.transferApi.uploadContent(transfer.id, file, (percent) => this.uploadPercent.set(percent)));
      await this.loadTransfers();
      await this.load(this.currentPath());
    } catch (e) {
      await this.loadTransfers();
      if (!this.uploadCancelled) this.retryFile.set(file);
      this.fail(this.message(e));
    } finally {
      this.activeTransferId.set("");
      this.uploading.set("");
    }
  }
  async cancelUpload() {
    const id = this.activeTransferId();
    this.uploadCancelled = true;
    if (id) { try { await firstValueFrom(this.transferApi.cancel(id)); } catch (e) { this.fail(this.message(e)); } }
    this.uploading.set("");
    this.uploadPercent.set(0);
  }
  retryUpload() { const file = this.retryFile(); if (file) void this.uploadFile(file); }
  download(e: FileEntry) {
    window.open(
      "/api/v1/files/download?path=" + encodeURIComponent(e.path),
      "_blank",
    );
  }
  async showTransfers() {
    this.view.set("transfers");
    await this.loadTransfers();
  }
  async showTrash() {
    this.view.set("trash");
    await this.loadTrash();
  }
  async loadTrash() {
    try {
      this.trashItems.set(await firstValueFrom(this.trashApi.list()));
    } catch (e) {
      this.fail(this.message(e));
    }
  }
  async showDevices() {
    this.view.set("devices");
    await Promise.all([this.loadDevices(), this.loadPendingClaims()]);
  }
  async loadDevices() {
    try {
      this.devices.set(await firstValueFrom(this.deviceApi.list()));
    } catch (e) {
      this.fail(this.message(e));
    }
  }
  async loadPendingClaims() {
    try {
      this.pendingClaims.set(
        await firstValueFrom(this.pairingApi.pendingClaims()),
      );
    } catch (e) {
      this.fail(this.message(e));
    }
  }
  async approve(claim: PairingClaim) {
    try {
      await firstValueFrom(this.pairingApi.approveClaim(claim.id));
      await this.loadPendingClaims();
      await this.loadDevices();
    } catch (e) {
      this.fail(this.message(e));
    }
  }
  async loadTransfers() {
    try {
      this.transfers.set(await firstValueFrom(this.transferApi.recent()));
    } catch (e) {
      this.fail(this.message(e));
    }
  }
  async startPairing() {
    try {
      this.pairing.set(await firstValueFrom(this.pairingApi.create()));
    } catch (e) {
      this.fail(this.message(e));
    }
  }
  async copyPairingLink() {
    const link = this.pairing()?.qrPayload;
    if (!link) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const field = document.createElement("textarea");
        field.value = link;
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand("copy");
        field.remove();
        if (!copied) throw new Error("Copy command failed");
      }

      this.pairingLinkCopied.set(true);
      window.setTimeout(() => this.pairingLinkCopied.set(false), 2500);
    } catch {
      this.fail("Could not copy the pairing link. You can enter the session ID and code manually.");
    }
  }
  revoke(device: Device) {
    this.openDialog(
      "Revoke device access?",
      `Revoke access for “${device.name}”?`,
      "",
      true,
      async () => {
        try {
          await firstValueFrom(this.deviceApi.revoke(device.id));
          await this.loadDevices();
        } catch (e) {
          this.fail(this.message(e));
        }
      },
    );
  }
  async restore(e: TrashEntry) {
    try {
      await firstValueFrom(this.trashApi.restore(e.id));
      await this.loadTrash();
    } catch (x) {
      this.fail(this.message(x));
    }
  }
  permanentlyDelete(e: TrashEntry) {
    this.openDialog(
      "Delete permanently?",
      `Delete “${e.name}” permanently? This cannot be undone.`,
      "",
      true,
      async () => {
        try {
          await firstValueFrom(this.trashApi.permanentlyDelete(e.id));
          await this.loadTrash();
        } catch (x) {
          this.fail(this.message(x));
        }
      },
    );
  }
  private openDialog(
    title: string,
    label: string,
    value: string,
    confirm: boolean,
    action: (value: string) => Promise<void>,
  ) {
    this.dialog.set({ title, label, value, confirm, action });
  }
  async submitDialog(event: SubmitEvent) {
    event.preventDefault();
    const dialog = this.dialog();
    if (!dialog) return;
    const form = event.currentTarget as HTMLFormElement;
    const value = dialog.confirm
      ? ""
      : String(new FormData(form).get("dialogValue") ?? "");
    this.dialog.set(null);
    await dialog.action(value);
  }
  formatSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    const units = ["KB", "MB", "GB", "TB"];
    let v = bytes,
      i = -1;
    do {
      v /= 1024;
      i++;
    } while (v >= 1024 && i < units.length - 1);
    return v.toFixed(v >= 10 ? 0 : 1) + " " + units[i];
  }
  private fail(message: string) {
    this.error.set(message);
    window.setTimeout(() => this.error.set(""), 5000);
  }
  private message(e: unknown) {
    if (e instanceof Error) return e.message;
    return e && typeof e === "object" && "error" in e
      ? String(
        (e as { error: { message?: string; }; }).error?.message ||
        "Request failed",
      )
      : "Request failed";
  }
}
