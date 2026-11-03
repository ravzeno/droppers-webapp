# Droppers Webapp Agent Notes

## Project layout

- `src/` is the computer-side backoffice Angular app (`droppers`): server storage, files, trash, device approvals, and incoming transfers.
- `device/` is the separate mobile/device portal Angular app (`droppers-device`): QR handoff, device access requests, waiting for approval, and file management.
- Both apps use the same Droppers service API. The service project is a sibling directory at `../droppers-service`.
- `proxy.conf.json` proxies `/api` to `http://127.0.0.1:8765` for local development.

## Development commands

- `npm start` runs the backoffice at `http://127.0.0.1:4200`.
- `npm run start:device` runs the device portal on port `4300` and binds to all interfaces, so a phone on the same LAN can open it.
- `npm run build` builds the backoffice.
- `npm run build:device` builds the device portal.
- The device app sends API calls directly to port `8765` through an HTTP interceptor. This lets the service apply its LAN device-token checks to file operations. Keep the backoffice's proxy-based requests local.

## Device pairing flow

1. In backoffice, open **Devices** and create a pairing QR.
2. The QR should contain an HTTP URL for the device portal with `sessionId` and `code` query parameters. Configure the service property `droppers.device-portal-url` to the phone-reachable portal URL (for LAN development, for example `http://<computer-lan-ip>:4300/`).
3. The device portal reads `sessionId` and the six-digit `code` from the query string and displays the device-name/access-request form. It also accepts `session_id` and `pairingCode` as query aliases.
4. The device submits `POST /api/v1/pairing/claims`, polls `GET /api/v1/pairing/claims/{claimId}`, and completes pairing after backoffice approval with `POST /api/v1/pairing/claims/{claimId}/complete`.
5. File and storage API calls from LAN devices use `X-Droppers-Token`. Do not remove this header or the matching service-side token validation.

Pairing sessions last 10 minutes. Device sessions default to 30 days and can be configured with `DROPPERS_DEVICE_SESSION_TTL_DAYS` in the service.

## LAN testing notes

- A phone and computer must be on the same reachable LAN; guest Wi-Fi/client isolation can prevent access.
- HTTP on the LAN is suitable only for temporary trusted-network testing. Do not treat it as a production transport; use HTTPS for deployment.
- `crypto.randomUUID()` is unavailable in some non-secure HTTP browser contexts, so device ID creation has a fallback. Keep this fallback for temporary HTTP testing.

## UI conventions

- Keep backoffice/server controls in `src/` and phone/device interactions in `device/`; avoid merging their navigation or responsibilities.
- The device portal is touch-first and Thai-language. Keep pairing errors and approval state visible, and avoid exposing the device token in the UI.
- Backoffice copy should describe scanning the QR, requesting access, and approving the device, rather than requiring a separate installed Droppers app.
