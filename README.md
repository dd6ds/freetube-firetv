# FreeTube TV – FreeTube für Amazon Fire TV

Baut aus [FreeTube Android](https://github.com/MarmadileManteater/FreeTubeAndroid)
(der Android-Portierung von [FreeTube](https://freetubeapp.io/)) eine APK, die auf dem
**Fire TV Stick HD (Fire OS 7.7, Android 9, 32-bit)** läuft und mit der Fernbedienung
bedienbar ist.

> Das Original-FreeTube ist eine Electron-Desktop-App und läuft nicht auf Android.
> FreeTube Android packt dieselbe Oberfläche in eine Android-WebView – darauf baut dieses Kit auf.

## Was das Kit an FreeTube Android ändert

| Änderung | Warum |
|---|---|
| `minSdk 29 → 28` | Upstream verlangt Android 10, Fire OS 7 ist Android 9 → sonst „App nicht installiert" |
| `LEANBACK_LAUNCHER` + 320×180-Banner | App erscheint im Fire-TV-Launcher unter „Apps" |
| `touchscreen required=false`, `largeHeap` | Fire TV hat keinen Touchscreen; mehr Heap bei 1 GB RAM |
| D-Pad-Navigation (`firetv/firetv-dpad.js`) | Pfeiltasten bewegen einen gelben Fokusrahmen, OK klickt, Medientasten steuern das Video, Menü → Suche |
| Fernbedienung nativ in `MainActivity.dispatchKeyEvent` abgefangen | funktioniert unabhängig vom WebView-Fokus |
| Automatisches Vollbild | Video startet beim Anklicken direkt im Vollbild (echte Fullscreen-API, sonst CSS-Vollbild) |
| Zurück-Taste | Vollbild verlassen → Seitenverlauf → auf der Startseite 2× Zurück = App beenden (statt nur Hintergrund) |
| Standard: Abo-Feeds über RSS | weniger Anfragen an YouTube → seltener IP-Sperren (in den Einstellungen abschaltbar) |
| Upstream = neuestes Release-Tag (z. B. 0.25.3.1) | stabile Version statt Entwicklungszweig; Versionsnummer = Upstream-Release |
| Eigene App-ID `io.freetubeapp.freetube.firetv`, Name „FreeTube TV" | kollidiert nicht mit einer normalen FreeTube-Android-Installation |

Der Upstream-Code wird **nicht** ins Repo kopiert; der Workflow holt ihn bei jedem Build frisch
und wendet `firetv/apply-firetv.py` an. So bekommst du FreeTube-Updates durch einfaches Neu-Bauen.

## APK bauen (GitHub Actions)

1. Neues GitHub-Repo anlegen (z. B. `dd6ds/freetube-firetv`) und den Inhalt dieses Ordners pushen:
   ```bash
   cd freetube-firetv
   git init -b main
   git config user.email "dd6ds@eclipso.de"
   git config user.name  "DD6DS"
   git add . && git commit -m "FreeTube TV: Fire-TV-Build-Kit"
   git remote add origin git@github.com:dd6ds/freetube-firetv.git
   git push -u origin main
   ```
2. **Empfohlen – fester Signaturschlüssel** (sonst klappen Updates nicht ohne Deinstallation):
   ```bash
   ./scripts/make-keystore.sh          # erzeugt freetube-tv.keystore + gibt Secrets aus
   gh secret set KEYSTORE_PASSWORD -b '<passwort>'
   gh secret set KEY_ALIAS -b 'freetubetv'
   gh secret set KEYSTORE_B64 < freetube-tv.keystore.b64
   ```
   Keystore sicher aufheben, **nicht committen** (steht in `.gitignore`).
3. Der Push startet den Build automatisch (**Actions → Build FreeTube TV**), Dauer ca. 8–12 min.
   Manuell: *Run workflow* – leer lassen = neuestes Upstream-Release (z. B. 0.25.3.1), oder ein Tag/Branch eintragen.
4. Ergebnis:
   - **Artefakt** `FreeTubeTV-<version>` im Workflow-Lauf (ZIP mit APK + SHA256SUMS) – Download nur eingeloggt.
   - **Release**: jeder Lauf legt automatisch ein GitHub-Release unter
     `https://github.com/dd6ds/freetube-firetv/releases` an (Tag `v<version>-tv<Build-Nr.>`), mit
     `FreeTubeTV-<version>.apk` und `FreeTubeTV-latest.apk`. Feste Adresse der neuesten APK:
     `https://github.com/dd6ds/freetube-firetv/releases/latest/download/FreeTubeTV-latest.apk`
   - Voraussetzung: **Settings → Actions → General → Workflow permissions → „Read and write permissions“**.

## Installation auf dem Fire TV Stick

→ **[ANLEITUNG-INSTALLATION.md](ANLEITUNG-INSTALLATION.md)** (ADB vom PC oder Downloader-App).

## Lokal patchen (ohne GitHub)

Mit Android SDK + JDK 17 + Node 22 + pnpm 10:

```bash
git clone -b 0.25.3.1 https://github.com/MarmadileManteater/FreeTubeAndroid upstream
python3 firetv/apply-firetv.py upstream --source-only           # VOR dem pack-Schritt!
cd upstream && pnpm i && pnpm run pack:android && cd ..
python3 firetv/apply-firetv.py upstream --version 0.25.3.1   # NACH dem pack-Schritt!
cd upstream/android && ./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

## Bekannte Grenzen

- **Fire OS 7.7 / Android 9:** Upstream testet nur ab Android 10. Der Workflow lässt Android-Lint
  auf API-28-Inkompatibilitäten laufen und meldet Treffer als Warnung (Artefakt `lint-report`).
- **Oberfläche:** FreeTube ist für Maus/Touch gebaut. Die D-Pad-Navigation macht es bedienbar,
  ist aber kein natives 10-Fuß-Interface wie bei SmartTube. Einzelne Menüs (Dropdowns,
  Einstellungs-Dialoge) können hakelig sein.
- **Leistung:** 1 GB RAM und ein schwacher Quad-Core – 720p/1080p ja, Animationen besser aus.
- **Amazon-WebView:** FreeTube braucht einen aktuellen Chromium-Unterbau; Fire-OS-Updates einspielen.
- **YouTube-Änderungen:** Wenn die lokale API bricht, hilft meist nur ein neuer Build mit
  aktuellem Upstream (einfach den Workflow erneut starten) oder Umstellen auf Invidious.

## Struktur

```
.github/workflows/build-firetv.yml   CI: Upstream holen → packen → patchen → APK
firetv/apply-firetv.py               alle Fire-TV-Änderungen (idempotent)
firetv/firetv-dpad.js                Fernbedienungs-Navigation (window.__ftTv, in die WebView injiziert)
firetv/MainActivityTv.kt.in          nativer Tasten-Abgriff + Zurück/Beenden (wird in MainActivity eingesetzt)
firetv/res/firetv_banner.png         Launcher-Banner 320×180
scripts/make-keystore.sh             fester Signaturschlüssel + Secret-Werte
scripts/install-firetv.sh            Installation/Update per ADB über WLAN
ANLEITUNG-INSTALLATION.md            Installationsanleitung (Deutsch)
```

Lizenz: wie FreeTube / FreeTube Android – **AGPL-3.0**. Wenn du APKs weitergibst, gehört der
Quellcode (dieses Repo + der verwendete Upstream-Commit) mit dazu.
