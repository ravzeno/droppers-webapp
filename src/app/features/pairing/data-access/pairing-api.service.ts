import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface PairingSession {
  sessionId: string;
  code: string;
  qrPayload: string;
  qrCodeDataUrl: string;
  expiresAt: string;
}

export interface PairingClaim {
  id: string;
  sessionId: string;
  deviceId: string;
  deviceName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class PairingApiService {
  private readonly http = inject(HttpClient);

  create() {
    return this.http.post<PairingSession>('/api/v1/pairing', {});
  }

  pendingClaims() {
    return this.http.get<PairingClaim[]>('/api/v1/pairing/claims/pending');
  }

  approveClaim(id: string) {
    return this.http.post<PairingClaim>(
      `/api/v1/pairing/claims/${encodeURIComponent(id)}/approve`,
      {},
    );
  }
}
