/*
 * FreeTube Fire TV – Fernbedienungs-Navigation
 *
 * Die Tasten der Fernbedienung werden NATIV in MainActivity.dispatchKeyEvent
 * abgefangen und hierher weitergereicht:
 *     window.__ftTv.key('up'|'down'|'left'|'right'|'enter'|'playpause'|
 *                       'play'|'pause'|'rewind'|'forward'|'menu')
 *     window.__ftTv.back()
 * So funktioniert die Steuerung unabhängig davon, ob die WebView gerade den
 * Android-Fokus hat.
 *
 * Rückgabewerte an Kotlin:
 *   'ok'      – erledigt
 *   'input'   – ein Textfeld wurde fokussiert -> Kotlin öffnet die Tastatur
 *   'handled' – (back) Zurück wurde hier verarbeitet (z. B. Vollbild verlassen)
 *   'none'    – (back) nichts zu tun, Kotlin macht normales Zurück
 */
(function () {
  'use strict'
  if (window.__ftTv) return

  var FOCUSABLE = [
    'a[href]', 'button', 'input', 'select', 'textarea', 'summary',
    '[tabindex]:not([tabindex="-1"])',
    '[role="button"]', '[role="link"]', '[role="tab"]', '[role="menuitem"]',
    '[role="option"]', '[role="checkbox"]', '[role="switch"]', '[role="radio"]',
    '.ftVideoPlayer'
  ].join(',')

  var PLAYER = '.ftVideoPlayer'

  // ---- Fokus-Rahmen, gut sichtbar aus 3 m Entfernung -----------------------
  function addStyle () {
    if (document.getElementById('ft-tv-style')) return
    var style = document.createElement('style')
    style.id = 'ft-tv-style'
    style.textContent =
      '*:focus{outline:4px solid #ffcc00 !important;outline-offset:2px !important;' +
      'box-shadow:0 0 0 6px rgba(255,204,0,.35) !important;}' +
      '.ftVideoPlayer:focus{outline-offset:-4px !important;}' +
      'html{scroll-behavior:auto !important;}'
    ;(document.head || document.documentElement).appendChild(style)
  }

  // ---- Hilfsfunktionen ------------------------------------------------------
  function isVisible (el) {
    if (!el || el.disabled) return false
    var r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) return false
    var s = window.getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') return false
    return true
  }

  function candidates () {
    var all = document.querySelectorAll(FOCUSABLE)
    var out = []
    for (var i = 0; i < all.length; i++) {
      if (isVisible(all[i])) out.push(all[i])
    }
    return out
  }

  function isTextInput (el) {
    if (!el) return false
    if (el.tagName === 'TEXTAREA') return true
    if (el.tagName !== 'INPUT') return el.isContentEditable === true
    var t = (el.type || 'text').toLowerCase()
    return ['text', 'search', 'email', 'url', 'number', 'password', 'tel'].indexOf(t) !== -1
  }

  function inPlayer (el) {
    return !!(el && el.closest && el.closest(PLAYER))
  }

  function isFullscreen () {
    return !!(document.fullscreenElement || document.webkitFullscreenElement)
  }

  function activeEl () {
    var a = document.activeElement
    if (!a || a === document.body || a === document.documentElement) return null
    return a
  }

  function focusEl (el) {
    if (!el) return
    if (el.tabIndex < 0 && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
    try { el.focus({ preventScroll: true }) } catch (e) { el.focus() }
    try {
      el.scrollIntoView({ block: 'center', inline: 'nearest' })
    } catch (e) {
      el.scrollIntoView(false)
    }
  }

  function firstInViewport (list) {
    var best = null
    var bestScore = Infinity
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect()
      if (r.bottom < 0 || r.top > window.innerHeight) continue
      var score = r.top * 2 + r.left
      if (score < bestScore) { bestScore = score; best = list[i] }
    }
    return best || list[0] || null
  }

  // Abstand in Bewegungsrichtung + gewichtete Querabweichung
  function score (dir, cr, r) {
    var primary, overlap, cross
    if (dir === 'left' || dir === 'right') {
      primary = dir === 'left' ? cr.left - r.right : r.left - cr.right
      if (primary < -cr.width / 2) return Infinity
      overlap = Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top)
      cross = overlap > 0 ? 0 : Math.abs((r.top + r.height / 2) - (cr.top + cr.height / 2))
    } else {
      primary = dir === 'up' ? cr.top - r.bottom : r.top - cr.bottom
      if (primary < -cr.height / 2) return Infinity
      overlap = Math.min(cr.right, r.right) - Math.max(cr.left, r.left)
      cross = overlap > 0 ? 0 : Math.abs((r.left + r.width / 2) - (cr.left + cr.width / 2))
    }
    if (primary < 0) primary = 0
    return primary + cross * 3
  }

  function move (dir) {
    var cur = activeEl()
    var list = candidates()
    if (!list.length) return
    if (!cur || !isVisible(cur)) {
      focusEl(firstInViewport(list))
      return
    }
    var cr = cur.getBoundingClientRect()
    var best = null
    var bestScore = Infinity
    for (var i = 0; i < list.length; i++) {
      var el = list[i]
      if (el === cur || el.contains(cur) || cur.contains(el)) continue
      var s = score(dir, cr, el.getBoundingClientRect())
      if (s < bestScore) { bestScore = s; best = el }
    }
    if (best) {
      focusEl(best)
      return
    }
    // Nichts mehr in dieser Richtung: Seite scrollen (lädt ggf. weitere Videos nach)
    if (dir === 'down') window.scrollBy(0, window.innerHeight * 0.6)
    if (dir === 'up') window.scrollBy(0, -window.innerHeight * 0.6)
  }

  function video () {
    return document.querySelector(PLAYER + ' video') || document.querySelector('video')
  }

  function togglePlay () {
    var v = video()
    if (!v) return false
    if (v.paused) v.play(); else v.pause()
    return true
  }

  function seek (delta) {
    var v = video()
    if (!v) return
    var max = isFinite(v.duration) ? v.duration : Infinity
    v.currentTime = Math.max(0, Math.min(max, v.currentTime + delta))
  }

  // Simulierter Tastendruck für FreeTubes eigene Player-Kurzbefehle
  var SYNTH = {
    left: ['ArrowLeft', 37], right: ['ArrowRight', 39],
    up: ['ArrowUp', 38], down: ['ArrowDown', 40]
  }
  function synthKey (dir) {
    var k = SYNTH[dir]
    var target = activeEl() || document.body
    var ev = new KeyboardEvent('keydown', { key: k[0], code: k[0], bubbles: true, cancelable: true })
    try {
      Object.defineProperty(ev, 'keyCode', { get: function () { return k[1] } })
      Object.defineProperty(ev, 'which', { get: function () { return k[1] } })
    } catch (e) {}
    target.dispatchEvent(ev)
  }

  function activate (el) {
    if (isTextInput(el)) {
      focusEl(el)
      return 'input'
    }
    if (el.tagName === 'SELECT') {
      // Dropdown ohne Maus: OK schaltet zur nächsten Option weiter
      var n = el.options.length
      if (n) {
        el.selectedIndex = (el.selectedIndex + 1) % n
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
      return 'ok'
    }
    if (el.matches(PLAYER)) {
      togglePlay()
      return 'ok'
    }
    el.click()
    return 'ok'
  }

  // ---- Öffentliche Schnittstelle für Kotlin --------------------------------
  window.__ftTv = {
    key: function (name) {
      addStyle()
      var a = activeEl()

      switch (name) {
        case 'playpause': togglePlay(); return 'ok'
        case 'play': { var v1 = video(); if (v1) v1.play(); return 'ok' }
        case 'pause': { var v2 = video(); if (v2) v2.pause(); return 'ok' }
        case 'rewind': seek(-10); return 'ok'
        case 'forward': seek(10); return 'ok'
        case 'menu': {
          var search = document.querySelector('.searchInput input, input[type="search"]')
          if (search) { focusEl(search); return 'input' }
          return 'ok'
        }
      }

      // Vollbild-Video: Pfeile an den Player (spulen/Lautstärke), OK = Play/Pause
      if (isFullscreen()) {
        if (name === 'enter') togglePlay()
        else synthKey(name)
        return 'ok'
      }

      if (name === 'enter') {
        if (!a) { move('down'); return 'ok' }
        return activate(a)
      }

      // Video-Player fokussiert: Links/Rechts spulen
      if (inPlayer(a) && (name === 'left' || name === 'right')) {
        synthKey(name)
        return 'ok'
      }

      // Textfeld: Links/Rechts bewegen den Cursor, am Rand wird navigiert
      if (isTextInput(a) && (name === 'left' || name === 'right') &&
          typeof a.selectionStart === 'number') {
        var pos = a.selectionStart
        var len = (a.value || '').length
        if (name === 'left' && pos > 0) { a.setSelectionRange(pos - 1, pos - 1); return 'ok' }
        if (name === 'right' && pos < len) { a.setSelectionRange(pos + 1, pos + 1); return 'ok' }
      }

      move(name)
      return 'ok'
    },

    back: function () {
      if (isFullscreen()) {
        var exit = document.exitFullscreen || document.webkitExitFullscreen
        if (exit) exit.call(document)
        return 'handled'
      }
      // Fokus in einem Textfeld: erst Feld verlassen
      var a = activeEl()
      if (isTextInput(a)) {
        a.blur()
        return 'handled'
      }
      return 'none'
    }
  }

  addStyle()
  // Beim Start etwas sinnvolles fokussieren, damit die Fernbedienung sofort greift
  setTimeout(function () {
    if (!activeEl()) {
      var list = candidates()
      if (list.length) focusEl(firstInViewport(list))
    }
  }, 1500)
})()
