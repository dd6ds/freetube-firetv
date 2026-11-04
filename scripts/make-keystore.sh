#!/usr/bin/env bash
# Erzeugt EINMALIG einen festen Signaturschlüssel für FreeTube TV und gibt die
# Werte für die GitHub-Secrets aus. Mit festem Schlüssel lassen sich neue
# Versionen einfach über die alte installieren (Abos/Verlauf bleiben erhalten).
#
# Benötigt: keytool (Teil jedes JDK, z.B. dnf install java-17-openjdk-headless)
set -euo pipefail

OUT="${1:-freetube-tv.keystore}"
ALIAS="freetubetv"

if [ -e "$OUT" ]; then
  echo "$OUT existiert schon – nicht überschreiben (sonst passen Updates nicht mehr)." >&2
  exit 1
fi

# Nur Buchstaben/Ziffern, damit das sed im Workflow nicht stolpert
PASS="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)"

keytool -genkeypair -v \
  -keystore "$OUT" -storetype PKCS12 \
  -alias "$ALIAS" -keyalg RSA -keysize 4096 -validity 36500 \
  -storepass "$PASS" -keypass "$PASS" \
  -dname "CN=FreeTube TV, O=private"

echo
echo "=== In GitHub: Settings → Secrets and variables → Actions → New repository secret ==="
echo "KEYSTORE_PASSWORD = $PASS"
echo "KEY_ALIAS         = $ALIAS"
echo "KEYSTORE_B64      = (Inhalt der Datei ${OUT}.b64)"
base64 -w0 "$OUT" > "${OUT}.b64"
echo
echo "Mit gh-CLI geht es auch direkt:"
echo "  gh secret set KEYSTORE_PASSWORD -b '$PASS'"
echo "  gh secret set KEY_ALIAS -b '$ALIAS'"
echo "  gh secret set KEYSTORE_B64 < ${OUT}.b64"
echo
echo "WICHTIG: $OUT + Passwort sicher aufbewahren und NICHT ins Repo committen."
