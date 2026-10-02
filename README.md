# SeqreSign — CSR eSign platform

Secure eSign for examination centre **Satisfactory Reports (CSR)**. The exam office creates a project per exam event, onboards one signatory per centre, and sends each a secure link. The signatory verifies their mobile number with an OTP, uploads or scans the CSR, takes a live photo (face check + GPS), and signs with a second mobile OTP. The system stamps every page, appends a certificate page, and stores the signed PDF encrypted.

- **Admin dashboard** (desktop): `/admin`
- **Signatory web app** (mobile): `/s/<token>` from the SMS, or `/sign` without a link (mobile + OTP gate)
- Opening `/` sends phones (and any screen narrower than 820 px) to `/sign`, desktops to `/admin`.

## Run locally

Requires Node 20+ and PostgreSQL.

```bash
npm install            # also copies MediaPipe + pdf.js assets into /public
npm run db:migrate     # create tables
npm run db:seed        # create the Super Admin from .env
npm run build && npm start   # production, http://localhost:3000
# or: npm run dev
```

If Homebrew PostgreSQL refuses to start on macOS with "postmaster became multithreaded", start it with a locale:

```bash
LC_ALL=en_US.UTF-8 pg_ctl -D /opt/homebrew/var/postgresql@16 -l /opt/homebrew/var/log/postgresql@16.log start
```

### Testing on a real phone

Camera and GPS only work on `https://` or `localhost`. To open the app from a phone on the same Wi-Fi:

```bash
npm run dev:lan        # https://<your-computer-ip>:3000 with a self-signed certificate
```

Set `APP_URL` in `.env` to that address so SMS links point to it.

## Configuration (`.env`)

| Variable | What it does |
|---|---|
| `DATABASE_URL` | PostgreSQL connection |
| `APP_URL` | Base URL used in signing links |
| `JWT_SECRET` | Signs admin and signatory sessions |
| `STORAGE_KEY` | 32-byte hex AES-256-GCM key for every stored file. **Back it up** — losing it makes stored files unreadable |
| `STORAGE_DIR` | Where encrypted files live (default `./storage`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Super Admin created by `npm run db:seed` (re-run to reset the password) |
| `SMS_MODE` | `authkey` sends real SMS · `console` prints OTPs and links to the server log |
| `AUTHKEY_API_KEY`, `AUTHKEY_OTP_SID` | Authkey account and OTP template |
| `AUTHKEY_OTP_VARS` | Maps the template's `{#variable#}` names to values, e.g. `otp={otp}&site={site}`. Placeholders: `{otp}` `{site}` `{minutes}`. Names must match the template exactly or the SMS arrives with blanks |
| `AUTHKEY_LINK_VARS` | Same for the link template. Placeholders: `{name}` `{link}` |
| `OTP_TTL_MINUTES` | OTP validity (default 10) — keep it equal to what the SMS text promises |
| `AUTHKEY_LINK_SID` | Authkey DLT template for the signing-link SMS (variables `name`, `link`). Until set, share links with WhatsApp / Copy link |

## How signing works

1. **Access OTP** — 6 digits, 10-minute expiry (`OTP_TTL_MINUTES`), 30 s resend cooldown, 5 attempts. Verifying sets a 2-hour session for that mobile number only.
2. **Upload** — PDF / JPG / PNG, any number of pages, merged into one PDF. Replaceable until signed.
3. **Live photo** — front camera only (no gallery), MediaPipe face detection in the browser, GPS required.
4. **Consent** — two declarations, recorded in the audit log.
5. **Signing OTP** — separate OTP bound to that CSR. On success the PDF is stamped on every page (photo, name, centre, IST time, OTP ref, GPS, document ID) and a certificate page is appended (photo signature, OTP signature, device, IP, original SHA-256, audit trail). The record is then locked — no further changes.

See `docs/sample-signed-csr.pdf` for an example output.

## Project layout

```
src/app/admin/…           admin pages (login, overview, project tracker, import, audit)
src/app/s/[token]         signatory flow
src/app/sign              direct access (no link)
src/app/api/admin/…       admin APIs (projects, import, send links, export, zip, files, audit)
src/app/api/sign/…        signatory APIs (OTP, upload, photo, sign, download)
src/lib/pdf.ts            merge uploads, stamp pages, certificate
src/lib/storage.ts        encrypted storage (swap for S3 later behind the same interface)
src/lib/sms.ts            Authkey / console SMS
design/project/           the design canvas source (look and motion reference)
```
