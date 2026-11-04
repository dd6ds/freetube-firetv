/*
 * FreeTube Fire TV – D-Pad / Fernbedienungs-Navigation
 *
 * Wird von FreeTubeWebView nach jedem Seitenaufbau injiziert.
 * Macht die (für Maus/Touch gebaute) FreeTube-Oberfläche mit den
 * Pfeiltasten der Fire-TV-Fernbedienung bedienbar ("spatial navigation").
 *
 *   Pfeiltasten  -> nächstes Element in dieser Richtung fokussieren
 *   OK / Enter   -> Element anklicken
 *   Play/Pause   -> laufendes Video starten/pausieren
 *   << / >>      -> 10 s zurück / vor
 *   Menü (≡)     -> Suchfeld fokussieren
 *
 * Im Video-Player (fokussiert) spulen Links/Rechts, im Vollbild gehen
 * alle Tasten an den Player.
 */
(function () {
  'use strict'
  if (window.__ftTvDpad) return
  window.__ftTvDpad = true

  var FOCUSABLE = [
    'a[href]', 'button', 'input', 'select', 'textarea', 'summary',
    '[tabindex]:not([tabindex="-1"])',
    '[role="button"]', '[role="link"]', '[role="tab"]', '[role="menuitem"]',
    '[role="option"]', '[role="checkbox"]', '[role="switch"]', '[role="radio"]',
    '.ftVideoPlayer'
  ].join(',')

  var PLAYER = '.ftVideoPlayer'
  var FOCUS_COLOR = '#ffcc00'

  // ---- Fokus-Rahmen, gut sichtbar aus 3 m Entfernung -----------------------
  var style = document.createElement('style')
  style.textContent =
    '*:focus{outline:4px solid ' + FOCUS_COLOR + ' !important;outline-offset:2px !important;' +
    'box-shadow:0 0 0 6px rgba(255,204,0,.35) !important;}' +
    '.ftVideoPlayer:focus{outline-offset:-4px !important;}' +
    'html{scroll-behavior:auto !important;}'
  ;(document.head || document.documentElement).appendChild(style)

  // ---- Hilfsfunktionen ------------------------------------------------------
  function isVisible (el) {
    if (el.disabled) return false
    var r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) return false
    var s = window.getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') return false
    // Element muss auf der Seite liegen (nicht weit außerhalb)
    if (r.bottom < -5000 || r.top > window.innerHeight + 5000) return false
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

  function isNativeActivatable (el) {
    var tag = el.tagName
    if (tag === 'BUTTON' || tag === 'SUMMARY') return true
    if (tag === 'A' && el.hasAttribute('href')) return true
    if (isTextInput(el)) return true
    return false
  }

  function inPlayer (el) {
    return !!(el && el.closest && el.closest(PLAYER))
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
    var cur = document.activeElement
    if (!cur || cur === document.body || cur === document.documentElement) cur = null
    var list = candidates()
    if (!list.length) return false
    if (!cur || !isVisible(cur)) {
      focusEl(firstInViewport(list))
      return true
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
      return true
    }
    // Nichts mehr in dieser Richtung: Seite scrollen (lädt ggf. weitere Videos nach)
    if (dir === 'down') window.scrollBy(0, window.innerHeight * 0.6)
    if (dir === 'up') window.scrollBy(0, -window.innerHeight * 0.6)
    return true
  }

  function video () {
    return document.querySelector(PLAYER + ' video') || document.querySelector('video')
  }

  var DIRS = {
    ArrowLeft: 'left', Left: 'left', 37: 'left',
    ArrowUp: 'up', Up: 'up', 38: 'up',
    ArrowRight: 'right', Right: 'right', 39: 'right',
    ArrowDown: 'down', Down: 'down', 40: 'down'
  }

  function stop (e) {
    e.preventDefault()
    e.stopPropagation()
    if (e.stopImmediatePropagation) e.stopImmediatePropagation()
  }

  window.addEventListener('keydown', function (e) {
    var key = e.key
    var code = e.keyCode
    var active = document.activeElement
    var v

    // ---- Medientasten der Fernbedienung ----
    if (key === 'MediaPlayPause' || code === 179 || key === 'MediaPlay' || code === 126 ||
        key === 'MediaPause' || code === 127) {
      v = video()
      if (v) {
        if (key === 'MediaPlay' || code === 126) v.play()
        else if (key === 'MediaPause' || code === 127) v.pause()
        else if (v.paused) v.play(); else v.pause()
        stop(e)
      }
      return
    }
    if (key === 'MediaRewind' || code === 227 || key === 'MediaFastForward' || code === 228) {
      v = video()
      if (v) {
        var delta = (key === 'MediaRewind' || code === 227) ? -10 : 10
        v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + delta))
        stop(e)
      }
      return
    }
    // Menü-Taste -> Suche
    if (key === 'ContextMenu' || code === 93 || code === 82) {
      var search = document.querySelector('.searchInput input, input[type="search"]')
      if (search) { focusEl(search); stop(e) }
      return
    }

    var dir = DIRS[key] || DIRS[code]

    // ---- Vollbild-Video: alles an den Player durchreichen ----
    if (document.fullscreenElement || document.webkitFullscreenElement) return

    if (dir) {
      // Video-Player fokussiert: Links/Rechts = spulen (FreeTube-Shortcut)
      if (inPlayer(active) && (dir === 'left' || dir === 'right')) return

      // Textfeld: Links/Rechts bewegen den Cursor, außer am Rand
      if (isTextInput(active) && (dir === 'left' || dir === 'right')) {
        var len = (active.value || '').length
        var pos = active.selectionStart
        if (pos !== null && pos !== undefined) {
          if (dir === 'left' && pos > 0) return
          if (dir === 'right' && pos < len) return
        }
      }
      if (move(dir)) stop(e)
      return
    }

    // ---- OK / Enter ----
    if (key === 'Enter' || code === 13 || code === 23) {
      if (!active || active === document.body) return
      if (inPlayer(active) && active.matches(PLAYER)) {
        v = video()
        if (v) { if (v.paused) v.play(); else v.pause(); stop(e) }
        return
      }
      if (isNativeActivatable(active)) return // Browser erledigt das selbst
      stop(e)
      active.click()
    }
  }, true)

  // Beim Start etwas sinnvolles fokussieren, damit die Fernbedienung sofort greift
  setTimeout(function () {
    if (!document.activeElement || document.activeElement === document.body) {
      var list = candidates()
      if (list.length) focusEl(firstInViewport(list))
    }
  }, 1500)
})()
