# FreeTube TV auf dem Fire TV Stick HD installieren

Gilt für: **Fire TV Stick HD (AFTSS), Fire OS 7.7.x** – und alle anderen Fire-TV-Geräte
mit Fire OS 7 oder 8 (Android 9/11). Nicht für Geräte mit Vega OS.

Du brauchst die Datei `FreeTubeTV-<version>.apk`, z. B. `FreeTubeTV-0.25.3.1.apk` (aus dem GitHub-Build, siehe README).

---

## Schritt 1 – Entwickleroptionen am Fire TV freischalten

Ab Fire OS 7.6 sind die Entwickleroptionen versteckt:

1. **Einstellungen** (Zahnrad) → **Mein Fire TV** → **Info**
2. Den ersten Eintrag (**Fire TV Stick**) markieren und **7× hintereinander OK** drücken,
   bis „Kein Bedarf, du bist bereits Entwickler" bzw. „Du bist jetzt Entwickler" erscheint.
3. Einmal **Zurück** – unter **Mein Fire TV** gibt es jetzt **Entwickleroptionen**.
4. Dort einschalten:
   - **ADB-Debugging** → **EIN** (für Weg A)
   - **Apps unbekannter Herkunft installieren** → für die App, mit der du installierst
     (z. B. *Downloader*), auf **EIN** (für Weg B)

Die **IP-Adresse** des Sticks findest du unter
**Einstellungen → Mein Fire TV → Info → Netzwerk**.

---

## Weg A – per ADB vom PC (empfohlen, kein Tippen mit der Fernbedienung)

PC und Fire TV müssen im selben Netz sein.

```bash
# adb installieren
sudo dnf install android-tools        # Fedora/RHEL/Rocky
# sudo apt install adb                # Debian/Ubuntu

# mitgeliefertes Skript (verbindet, installiert, startet):
./scripts/install-firetv.sh 192.168.1.50 FreeTubeTV-0.25.3.1.apk
```

Oder von Hand:

```bash
adb connect 192.168.1.50:5555
adb install -r FreeTubeTV-*.apk
```

Beim **ersten** `adb connect` erscheint am Fernseher **„USB-Debugging zulassen?"** →
Haken bei **„Immer von diesem Computer zulassen"** und **OK**. Danach den Befehl wiederholen,
falls `unauthorized` angezeigt wurde.

---

## Weg B – direkt am Stick mit der App „Downloader"

1. Im Amazon Appstore die App **Downloader** (von AFTVnews) suchen und installieren.
2. In den Entwickleroptionen bei **Apps unbekannter Herkunft installieren** → **Downloader** → **EIN**.
3. Downloader öffnen, ins URL-Feld die **direkte Download-Adresse der APK** eintippen, z. B.
   `https://github.com/dd6ds/freetube-firetv/releases/latest/download/FreeTubeTV-latest.apk`
   (diese Adresse zeigt immer auf die neueste Version – jeder Build legt ein Release an).
   Tipp: Lange URLs mit einem Kurzlink-Dienst kürzen, dann ist das Tippen erträglich.
4. Nach dem Download **Installieren** wählen, danach **Fertig** (oder **Öffnen**).
5. Downloader bietet an, die APK zu löschen → **Löschen** (spart Speicher, der Stick hat nur 8 GB).

---

## Schritt 2 – App starten

Die App heißt **FreeTube TV** und erscheint unter **Apps** (Kachelsymbol rechts in der
Startleiste → „Alle Apps"). Mit **Menü-Taste (≡) → Verschieben** kannst du sie nach vorne holen.

### Bedienung mit der Fernbedienung

| Taste | Funktion |
|---|---|
| Pfeiltasten | Fokus (gelber Rahmen) zum nächsten Element bewegen |
| OK | Anklicken / Video öffnen |
| Zurück | Vollbild/Textfeld verlassen → vorherige Seite → auf der Startseite **2× Zurück = App beenden** |
| ≡ Menü | Suchfeld fokussieren (Bildschirmtastatur öffnet sich mit OK) |
| ⏯ Play/Pause | Video starten/anhalten |
| ⏪ / ⏩ | 10 Sekunden zurück / vor |
| Links/Rechts auf dem Player | 5 Sekunden spulen (FreeTube-Kurzbefehl) |

Für Vollbild: Player fokussieren und die Vollbild-Schaltfläche in der Player-Leiste
anklicken. Im Vollbild gehen alle Tasten direkt an den Player.

---

## Empfohlene Einstellungen in FreeTube TV (1 GB RAM!)

Unter **Einstellungen** in der App:

- **Allgemein → Bevorzugte API: Lokale API** (Standard; Invidious nur, falls Lokal zickt)
- **Player → Standardqualität: 720p oder 1080p**, nicht „Auto/4K" – der Stick kann max. 1080p
- **Player → Videoformat: DASH** (bei Rucklern testweise **Legacy** ausprobieren)
- **Darstellung → Thumbnails/Animationen** reduzieren, wenn die Oberfläche träge ist

---

## Updates

Neue APK einfach **über die alte installieren** (`adb install -r …` bzw. erneut per Downloader).
Abos, Verlauf und Playlists bleiben erhalten – **aber nur**, wenn beide APKs mit demselben
Schlüssel signiert sind (fester Schlüssel per Secret, siehe README).

Fehlermeldung **„App nicht installiert"** / `INSTALL_FAILED_UPDATE_INCOMPATIBLE` bedeutet:
anderer Schlüssel. Dann:

1. In FreeTube TV: **Einstellungen → Datensicherung → Abonnements/Verlauf/Playlists exportieren**
2. Alte App deinstallieren: **Einstellungen → Anwendungen → Installierte Anwendungen verwalten →
   FreeTube TV → Deinstallieren** (oder `adb uninstall io.freetubeapp.freetube.firetv`)
3. Neue APK installieren, Daten wieder importieren.

---

## Fehlerbehebung

| Problem | Lösung |
|---|---|
| „App nicht installiert" beim ersten Mal | Prüfen, ob für Downloader „Apps unbekannter Herkunft" an ist; genug freier Speicher? (**Einstellungen → Mein Fire TV → Info → Speicher**) |
| `INSTALL_FAILED_OLDER_SDK` | Gerät hat Fire OS < 7 – wird nicht unterstützt |
| App startet, weißer/schwarzer Bildschirm | Einmal komplett beenden: **Einstellungen → Anwendungen → … → FreeTube TV → Beenden erzwingen**, neu starten. Hilft das nicht: Logs holen (unten) |
| Videos laden nicht / „Sign in to confirm…" | YouTube blockiert gerade die lokale API → in den Einstellungen auf **Invidious** umstellen oder auf ein FreeTube-Update warten |
| Fokusrahmen verschwindet | Einmal eine Pfeiltaste drücken; notfalls Zurück und wieder in die Seite |
| Oberfläche sehr langsam | Andere Apps beenden (1 GB RAM), Qualität auf 720p, Stick neu starten |

**Logs für die Fehlersuche** (mit Weg-A-Verbindung):

```bash
adb logcat -c
# App starten, Fehler auslösen, dann:
adb logcat -d | grep -iE "freetube|chromium|AndroidRuntime" > freetube-tv.log
```

**WebView-Version prüfen** (FreeTube braucht einen aktuellen Chromium-Unterbau):

```bash
adb shell dumpsys package com.amazon.webview.chromium | grep versionName
```

Ist sie sehr alt, hilft oft ein Fire-OS-Update:
**Einstellungen → Mein Fire TV → Info → Nach Updates suchen**.
