# BrickBreaker-v2.0.1-assetdemo.apk — how to verify remote assets on your phone

This build of Brick Breaker loads its art from our asset backend at boot.
Whatever collection is **active** in the dashboard is what the game shows —
no reinstall, no rebuild.

In order to verify the new assets on a new device, we need the backend
running first. Right now the backend URL is baked in as
**`http://192.168.29.199:5000`** (Roshani's machine on Wi-Fi), so put both
devices on the same network, and follow this:

## On the host machine (Roshani)

1. Backend running on port 5000 (it binds all interfaces).
2. Dashboard: http://localhost:5173 — log in, pick/edit the collection,
   make sure it is set **Active for game**.
3. First time a phone connects, Windows Firewall may prompt — allow
   Node.js on private networks.

## On the phone

1. Install the APK (allow "install from unknown sources").
2. Join the **same Wi-Fi** as the host machine.
3. Open the game. That's it — during the loading screen it fetches the
   active collection and swaps the art in.

## Verifying it worked

- The bricks / ball / paddle / background match whatever the dashboard's
  active collection holds. Change an asset in the dashboard (upload with the
  same name), **close and reopen the game** on the phone → the art updates.
- If the backend is off, unreachable, or the phone is on the wrong network,
  the game silently starts with its **built-in art** after a ~4 s pause —
  that's by design (fail-open), so "it looks like the normal game" on a
  device that can't reach the backend is expected, not a crash.

## Asset naming (what to upload in the dashboard)

The upload **name is the slot** (case and file extension ignored):
`brick0`–`brick5`, `brickCracked0`–`5`, `brickBonus`, `brickStone`,
`rdBall0` (the ball in play — `ball` is only a fallback), `padWood`,
`padWide`, `padSticky`, `padCannon`, `lvbg1`–`lvbg13` (level backgrounds).
Anything else is ignored and listed as `skipped` in the game's console.

## Notes

- If the host machine's Wi-Fi IP changes (DHCP), the APK needs a re-patch +
  rebuild with the new IP — or set a DHCP reservation for the host.
- This demo build has the INTERNET permission and allows cleartext HTTP to
  the LAN — the **Play Store build does not** (it stays fully offline).
  Don't upload this variant to Play.
