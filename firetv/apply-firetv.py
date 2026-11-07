#!/usr/bin/env python3
"""
Patcht einen Checkout von FreeTube Android (MarmadileManteater/FreeTubeAndroid)
zu einer Fire-TV-tauglichen App.

Aufruf:
    python3 firetv/apply-firetv.py <pfad-zum-freetubeandroid-checkout> [--version 0.25.3.1]

Was geändert wird:
  1. minSdk 29 -> 28            (Fire OS 7 = Android 9 = API 28)
  2. Eigene App-ID io.freetubeapp.freetube.firetv, Name "FreeTube TV"
     (läuft parallel zu einer evtl. installierten FreeTube-Android-App)
  3. Manifest: LEANBACK_LAUNCHER, TV-Banner, kein Touchscreen nötig, largeHeap
  4. Fernbedienung: Tasten werden in MainActivity.dispatchKeyEvent abgefangen
     und an firetv-dpad.js (window.__ftTv) weitergereicht
  5. Zurück: Vollbild verlassen -> Seite zurück -> auf der Startseite
     2x Zurück = App wirklich beenden
Das Skript ist idempotent (mehrfaches Ausführen schadet nicht).

Reihenfolge:
  1. apply-firetv.py <repo> --source-only   (VOR pack:android: Standard-Einstellungen)
  2. pnpm run pack:android
  3. apply-firetv.py <repo> --version X      (NACH pack:android: Android-Teil + Assets)
"""
import argparse
import json
import re
import shutil
import sys
from pathlib import Path

MARK = "FIRETV-PATCH"
HERE = Path(__file__).resolve().parent


def die(msg):
    print(f"FEHLER: {msg}", file=sys.stderr)
    sys.exit(1)


def edit(path: Path, fn, what):
    text = path.read_text(encoding="utf-8")
    new = fn(text)
    if new is None:
        die(f"{what}: Anker in {path} nicht gefunden – hat sich der Upstream-Code geändert?")
    if new != text:
        path.write_text(new, encoding="utf-8")
        print(f"  ✔ {what}")
    else:
        print(f"  = {what} (schon gepatcht)")


def must_sub(pattern, repl, text, flags=0):
    new, n = re.subn(pattern, repl, text, count=1, flags=flags)
    return new if n else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("repo", type=Path)
    ap.add_argument("--source-only", action="store_true",
                    help="nur Änderungen am Web-Quellcode (src/) – VOR `pnpm run pack:android` ausführen")
    ap.add_argument("--version", default=None,
                    help="Versionsnummer setzen, z. B. 0.25.3.1 (= Upstream-Release-Tag)")
    args = ap.parse_args()
    repo = args.repo.resolve()
    app = repo / "android" / "app"
    src = app / "src" / "main"
    kt = src / "java" / "io" / "freetubeapp" / "freetube"
    if not (app / "build.gradle.kts").exists():
        die(f"{repo} sieht nicht wie ein FreeTubeAndroid-Checkout aus")

    print("FreeTube → Fire TV Patch")

    # 0. Standard-Einstellungen im Web-Quellcode --------------------------------
    #    (wird beim Packen gebündelt, muss also VOR pack:android passieren)
    settings_js = repo / "src" / "renderer" / "store" / "modules" / "settings.js"

    def p_settings(t):
        if "useRssFeeds: true" in t:
            return t
        # Abos per RSS laden: weniger Anfragen an YouTube -> weniger IP-Sperren
        return must_sub(r"useRssFeeds: false,", "useRssFeeds: true, // " + MARK, t)
    edit(settings_js, p_settings, "Standard: Abo-Feeds über RSS abrufen")

    if args.source_only:
        print("Fertig (nur Quellcode).")
        return

    # 1. minSdk ---------------------------------------------------------------
    def p_gradle(t):
        if "minSdk = 28" in t:
            return t
        return must_sub(r"minSdk\s*=\s*29", "minSdk = 28 // " + MARK + ": Fire OS 7 / Android 9", t)
    edit(app / "build.gradle.kts", p_gradle, "minSdk 28")

    # versionCode +500: liegt sicher über allen früheren Kit-Builds (0.25.3-firetv-N),
    # damit sich die neue Version ohne Deinstallation drüberinstallieren lässt
    def p_vcode(t):
        if "versionInfo.versionCode + 500" in t:
            return t
        return must_sub(r"versionCode = versionInfo\.versionCode\b",
                        "versionCode = versionInfo.versionCode + 500 // " + MARK, t)
    edit(app / "build.gradle.kts", p_vcode, "versionCode-Offset")

    # 2. App-ID / Name / Version ---------------------------------------------
    pkg_path = repo / "package.json"
    pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
    changed = False
    if pkg.get("name") != "freetube.firetv":
        pkg["name"] = "freetube.firetv"
        changed = True
    if pkg.get("productName") != "FreeTube TV":
        pkg["productName"] = "FreeTube TV"
        changed = True
    if args.version and pkg.get("version") != args.version:
        if not re.fullmatch(r"\d+\.\d+\.\d+(\.\d+)?", args.version):
            die(f"Ungültige Version '{args.version}' (erwartet z. B. 0.25.3.1)")
        pkg["version"] = args.version
        changed = True
    if changed:
        pkg_path.write_text(json.dumps(pkg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"  ✔ package.json: name={pkg['name']} version={pkg['version']}")
    else:
        print("  = package.json (schon gepatcht)")

    edit(src / "res" / "values" / "strings.xml",
         lambda t: t.replace(">FreeTube Android<", ">FreeTube TV<") if ">FreeTube TV<" not in t
         else t, "App-Name 'FreeTube TV'")
    settings = repo / "android" / "settings.gradle.kts"
    edit(settings, lambda t: t.replace('"FreeTube Android"', '"FreeTube TV"'), "Gradle-Projektname")

    # 3. Manifest ------------------------------------------------------------
    def p_manifest(t):
        if MARK in t:
            return t
        t = must_sub(r'(<uses-permission android:name="android.permission.INTERNET"\s*/>)',
                     r'\1\n  <!-- ' + MARK + ' -->\n'
                     r'  <uses-feature android:name="android.software.leanback" android:required="false" />\n'
                     r'  <uses-feature android:name="android.hardware.touchscreen" android:required="false" />',
                     t)
        if t is None:
            return None
        t = must_sub(r'(<application\b)', r'\1\n    android:banner="@drawable/firetv_banner"\n'
                     r'    android:largeHeap="true"', t)
        if t is None:
            return None
        return must_sub(r'(<category android:name="android.intent.category.LAUNCHER"\s*/>)',
                        r'\1\n        <category android:name="android.intent.category.LEANBACK_LAUNCHER" />', t)
    edit(src / "AndroidManifest.xml", p_manifest, "Manifest: Leanback-Launcher, Banner, Touch optional")

    # 4. D-Pad-JS injizieren -------------------------------------------------
    def p_webview(t):
        if MARK in t:
            return t
        t = must_sub(r"(settings\.javaScriptEnabled = true\n)",
                     r"\1    // " + MARK + ": Fernbedienung braucht Fokus auf der WebView\n"
                     r"    isFocusable = true\n    isFocusableInTouchMode = true\n", t)
        if t is None:
            return None
        inject = (
            "        // " + MARK + ": D-Pad-Navigation für Fire TV\n"
            "        try {\n"
            '          val tvJs = context.assets.open("firetv-dpad.js").bufferedReader().use { it.readText() }\n'
            "          view?.evaluateJavascript(tvJs, null)\n"
            "          view?.requestFocus()\n"
            "        } catch (e: Exception) {\n"
            '          android.util.Log.w("FreeTubeTV", "firetv-dpad.js konnte nicht geladen werden", e)\n'
            "        }\n")
        m = re.search(r"override fun onPageFinished\(view: WebView\?, url: String\?\) \{\n", t)
        if not m:
            return None
        return t[:m.end()] + inject + t[m.end():]
    edit(kt / "webviews" / "FreeTubeWebView.kt", p_webview, "WebView: Fokus + D-Pad-Skript")

    # 5. Fernbedienung nativ abfangen + Zurück/Beenden -----------------------
    tv_kotlin = (HERE / "MainActivityTv.kt.in").read_text(encoding="utf-8")

    def p_activity(t):
        if MARK in t:
            return t
        m = re.search(r"  override fun onBack\(\) \{\n.*?\n  \}\n", t, re.S)
        if not m:
            return None
        return t[:m.start()] + tv_kotlin + t[m.end():]
    edit(kt / "MainActivity.kt", p_activity, "Fernbedienung (dispatchKeyEvent) + Zurück/Beenden")

    # 6. Dateien kopieren ----------------------------------------------------
    assets = src / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    shutil.copy2(HERE / "firetv-dpad.js", assets / "firetv-dpad.js")
    print("  ✔ assets/firetv-dpad.js")
    if not (assets / "index.html").exists():
        print("  ⚠ assets/index.html fehlt – wurde `pnpm run pack:android` schon ausgeführt?")

    banner_dir = src / "res" / "drawable-xhdpi"
    banner_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(HERE / "res" / "firetv_banner.png", banner_dir / "firetv_banner.png")
    print("  ✔ res/drawable-xhdpi/firetv_banner.png")

    print("Fertig.")


if __name__ == "__main__":
    main()
