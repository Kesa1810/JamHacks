# SaberSync (JamHacks)

Phone-as-lightsaber controller for a Beat Saber–style game on your computer.

## Quick start

```bash
npm install
npm run dev
```

Open **http://localhost:5173** on your computer, scan the QR code with your phone, and allow motion access.

## How it works

- **Computer (host):** Shows QR code + full-screen beat arena when phone connects
- **Phone (controller):** Tilt/swing to move the lightsaber on screen
- **Any network:** Uses a Cloudflare tunnel so phones don't need same Wi‑Fi

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start server + Vite on port 5173 |
| `dev.bat` | Windows: kill port 5173 and start dev server |
| `allow-firewall.bat` | Windows firewall rule for local Wi‑Fi fallback |

## Repo

https://github.com/Kesa1810/JamHacks