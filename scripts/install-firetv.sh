#!/usr/bin/env bash
# Installiert / aktualisiert FreeTube TV per ADB über WLAN auf dem Fire TV Stick.
#
#   ./scripts/install-firetv.sh <IP-des-Fire-TV> [pfad/zur/FreeTubeTV-*.apk]
#
# Vorher am Fire TV: Einstellungen → Mein Fire TV → Entwickleroptionen →
# "ADB-Debugging" EIN. Beim ersten Verbinden erscheint am Fernseher eine
# Abfrage "USB-Debugging zulassen?" → mit "Immer zulassen" bestätigen.
set -euo pipefail

IP="${1:?Bitte IP-Adresse des Fire TV angeben (Einstellungen → Mein Fire TV → Info → Netzwerk)}"
APK="${2:-$(ls -t FreeTubeTV-*.apk 2>/dev/null | head -1 || true)}"
PKG="io.freetubeapp.freetube.firetv"

command -v adb >/dev/null || { echo "adb fehlt: sudo dnf install android-tools  (bzw. apt install adb)"; exit 1; }
[ -f "$APK" ] || { echo "APK nicht gefunden: '$APK'"; exit 1; }

echo "→ Verbinde mit $IP:5555 …"
adb connect "$IP:5555"
echo "   (Falls 'unauthorized': am Fernseher die Abfrage bestätigen und Skript erneut starten)"
sleep 2
adb -s "$IP:5555" wait-for-device

echo "→ Gerät: $(adb -s "$IP:5555" shell getprop ro.product.model | tr -d '\r')," \
     "Android $(adb -s "$IP:5555" shell getprop ro.build.version.release | tr -d '\r')"

echo "→ Installiere $APK …"
if ! adb -s "$IP:5555" install -r "$APK"; then
  echo
  echo "Installation fehlgeschlagen. Häufigste Ursache: INSTALL_FAILED_UPDATE_INCOMPATIBLE"
  echo "(neue APK mit anderem Schlüssel signiert). Dann vorher Daten sichern"
  echo "(FreeTube → Einstellungen → Datensicherung → Exportieren) und:"
  echo "  adb -s $IP:5555 uninstall $PKG"
  exit 1
fi

echo "→ Starte FreeTube TV …"
adb -s "$IP:5555" shell monkey -p "$PKG" -c android.intent.category.LEANBACK_LAUNCHER 1 >/dev/null 2>&1 || true
echo "Fertig."
