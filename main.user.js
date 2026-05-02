// ==UserScript==
// @name         Video Screenshot from h5player
// @namespace    https://gitee.com/jason403/Video-Screenshot-from-h5player/
// @version      202605030240
// @description  Press custom hotkey to take video screenshots, supports shadow DOM and cross-origin iframes
// @author       Pingyi ZHENG
// @match        *://*/*
// @grant        unsafeWindow
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-start
// @downloadURL  https://raw.giteeusercontent.com/jason403/Video-Screenshot-from-h5player/raw/master/main.user.js
// @updateURL    https://raw.giteeusercontent.com/jason403/Video-Screenshot-from-h5player/raw/master/main.user.js
// @license      GPL
// ==/UserScript==

;(function () {
  'use strict'

  /* ============================================
   * 1. Save native functions (before any hijacking)
   * ============================================ */
  const native = {
    Object: { defineProperty: Object.defineProperty },
    addEventListener: EventTarget.prototype.addEventListener,
    removeEventListener: EventTarget.prototype.removeEventListener,
    srcDescriptor: Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src') || null,
  }

  /* ============================================
   * 2. Configuration
   * ============================================ */
  const CONFIG_KEY = 'vs_screenshot_config'
  const defaultConfig = {
    screenshotKey: 'S',
  }

  function loadConfig() {
    try {
      const saved = GM_getValue(CONFIG_KEY, null)
      if (saved && typeof saved === 'object') {
        return Object.assign({}, defaultConfig, saved)
      }
    } catch (e) {
      console.warn('[VS] Failed to load config, using defaults')
    }
    return Object.assign({}, defaultConfig)
  }

  function saveConfig(conf) {
    try {
      GM_setValue(CONFIG_KEY, conf)
    } catch (e) {
      console.warn('[VS] Failed to save config')
    }
  }

  let config = loadConfig()

  /* ============================================
   * 3. Utility Functions
   * ============================================ */
  function isInIframe() {
    return window.self !== window.top
  }

  const SUPPORTED_VIDEO_TAGS = ['video', 'bwp-video']
  const SUPPORTED_SELECTOR = SUPPORTED_VIDEO_TAGS.join(', ')

  function isVideoElement(el) {
    return (
      el instanceof HTMLVideoElement ||
      el.HTMLVideoElement === true ||
      (el.tagName && SUPPORTED_VIDEO_TAGS.includes(el.tagName.toLowerCase()))
    )
  }

  function debounce(fn, delay) {
    let timer = null
    return function (...args) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        fn.apply(this, args)
      }, delay)
    }
  }

  /* ============================================
   * 4. Aggressive CORS Strategy + Auto Recovery
   * ============================================ */

  /**
   * Setup video CORS + reload (aggressive strategy)
   * Force reload already-loaded videos to ensure crossorigin takes effect
   * Attach error event listener: if CORS causes load failure, remove crossorigin and retry
   */
  /**
   * Wait for metadata to be ready before seeking, more stable than directly assigning currentTime
   * Extracted as a shared utility to avoid code duplication
   */
  function seekToTimeAfterLoad(video, currentTime) {
    let seekDone = false
    const seekToTime = function () {
      if (seekDone) return
      seekDone = true
      try {
        video.currentTime = currentTime
      } catch (e) {}
      video.removeEventListener('loadedmetadata', seekToTime)
      video.removeEventListener('canplay', seekToTime)
    }
    video.addEventListener('loadedmetadata', seekToTime)
    video.addEventListener('canplay', seekToTime)

    /* Fallback: force seek after 3 seconds if neither event fired */
    setTimeout(seekToTime, 3000)
  }

  function setupVideoWithCorsRecovery(video) {
    if (video._corsSetupDone) return
    video._corsSetupDone = true

    /* First-time crossorigin setup */
    if (!video.hasAttribute('crossorigin')) {
      video.setAttribute('crossorigin', 'anonymous')
    }

    /* If video is already loaded, force reload to apply CORS (skip blob URLs to avoid breaking MSE players) */
    if (video.src && !video.src.startsWith('blob:') && video.readyState > 0) {
      const originalSrc = video.src
      const currentTime = video.currentTime
      const paused = video.paused

      video.src = ''
      video.load()

      setTimeout(() => {
        if (!originalSrc) return
        video.src = originalSrc
        if (!paused) video.play().catch(() => {})

        seekToTimeAfterLoad(video, currentTime)
      }, 0)
    }

    /* Error recovery: auto-remove crossorigin attribute and retry on CORS failure */
    video.addEventListener('error', function onCorsError() {
      if (!video.hasAttribute('crossorigin')) return

      const mediaError = video.error
      /* MEDIA_ERR_SRC_NOT_SUPPORTED(4) or MEDIA_ERR_NETWORK(2) may be caused by CORS */
      if (
        mediaError &&
        (mediaError.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED ||
          mediaError.code === MediaError.MEDIA_ERR_NETWORK)
      ) {
        console.warn('[VS] Video failed to load due to CORS, removing crossorigin and retrying')

        const paused = video.paused
        const currentTime = video.currentTime
        const src = video.currentSrc || video.src

        /* Skip blob URLs to avoid breaking MSE player internal state */
        if (src && src.startsWith('blob:')) return

        /* Bypass hijacking, use native setter to set src, prevent auto re-adding crossorigin */
        const nativeSet = native.srcDescriptor && native.srcDescriptor.set
        if (!nativeSet) return

        video.removeAttribute('crossorigin')

        /* video.src = '' via native setter */
        nativeSet.call(video, '')
        video.load()

        setTimeout(() => {
          if (!src) return
          /* video.src = src via native setter as well, otherwise hijack would re-add crossorigin */
          nativeSet.call(video, src)
          if (!paused) video.play().catch(() => {})

          seekToTimeAfterLoad(video, currentTime)
        }, 0)
      }
    })

    /* playing event tracking: set as active video when none is hovered, do not override hover priority */
    video.addEventListener('playing', function onPlaying() {
      if (!activeVideo) activeVideo = video
    })
  }

  /* ============================================
   * 5. Prototype Hijacking (auto-add crossorigin to videos)
   * ============================================ */

  /**
   * Hijack HTMLVideoElement.prototype.setAttribute
   * Automatically insert crossorigin when setting src
   */
  function hijackVideoSetAttribute() {
    const originalSetAttribute = HTMLVideoElement.prototype.setAttribute
    HTMLVideoElement.prototype.setAttribute = function (name, value) {
      if (name === 'src' && !this.hasAttribute('crossorigin')) {
        originalSetAttribute.call(this, 'crossorigin', 'anonymous')
      }
      return originalSetAttribute.call(this, name, value)
    }
  }

  /**
   * Hijack HTMLMediaElement.prototype.src property setter
   * Automatically insert crossorigin when assigning video.src = '...'
   */
  function hijackVideoSrcProperty() {
    const descriptor = native.srcDescriptor
    if (!descriptor) return

    const originalSet = descriptor.set
    if (originalSet) {
      Object.defineProperty(HTMLMediaElement.prototype, 'src', {
        configurable: true,
        enumerable: true,
        get: descriptor.get,
        set: function (value) {
          if (!this.hasAttribute('crossorigin')) {
            this.setAttribute('crossorigin', 'anonymous')
          }
          return originalSet.call(this, value)
        },
      })
    }
  }

  /* ============================================
   * 6. Core Screenshot
   * ============================================ */
  const videoCapturer = {
    capture(video) {
      if (!video || !isVideoElement(video)) {
        console.warn('[VS] Invalid video element')
        return false
      }
      if (!video.videoWidth || !video.videoHeight) {
        console.warn('[VS] Video has not loaded any frames yet')
        return false
      }

      const t = video.currentTime
      const ts = `${Math.floor(t / 60)}'${(t % 60).toFixed(2)}"`

      const title = `${document.title.replace(/[<>:"/\\|?*]/g, '_')}_${ts}`

      /* CORS is already set by prototype hijacking and setupVideoWithCorsRecovery,
         skip re-setting here (keep fallback just in case) */
      if (!video.hasAttribute('crossorigin')) {
        try {
          video.setAttribute('crossorigin', 'anonymous')
        } catch (e) {}
      }

      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        console.warn('[VS] Cannot get canvas context')
        return false
      }

      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      } catch (e) {
        console.warn('[VS] drawImage failed (CORS?)', e)
        return false
      }

      console.log('[VS] Screenshot captured', { title, w: canvas.width, h: canvas.height })

      this.preview(canvas, title)
      return true
    },

    preview(canvas, title) {
      canvas.style = 'max-width:100%'
      const previewPage = window.open('', '_blank')
      previewPage.document.title = `capture preview - ${title || 'Untitled'}`
      previewPage.document.body.style.textAlign = 'center'
      previewPage.document.body.style.backgroundColor = 'black'
      previewPage.document.body.style.margin = '0'
      previewPage.document.body.appendChild(canvas)
    },
  }

  /* ============================================
   * 7. Video Element Detection & DOM Monitoring
   * ============================================ */
  const shadowHostMap = new WeakMap()
  let shadowDomList = []
  let vsHackShadow = false
  let activeVideo = null

  /* Mouse hover tracking for active video (3-layer strategy: parentNode → composedPath forward → composedPath reverse) */
  function handleMouseOver(event) {
    /* Layer 1: parentNode fast path — regular DOM + open shadow cache hit */
    let target = event.target
    while (target) {
      if (isVideoElement(target)) {
        activeVideo = target
        return
      }
      if (target.shadowRoot) {
        const cached = target.shadowRoot._vsVideo
        if (cached && cached.isConnected && isVideoElement(cached)) {
          activeVideo = cached
          return
        }
        const videoInShadow = target.shadowRoot.querySelector(SUPPORTED_SELECTOR)
        if (videoInShadow) {
          activeVideo = videoInShadow
          return
        }
      }
      target = target.parentNode
    }

    /* Layer 2: composedPath forward traversal — match video in event path directly (including closed shadow) */
    const path = event.composedPath()
    for (let i = 0; i < path.length; i++) {
      if (isVideoElement(path[i])) {
        activeVideo = path[i]
        return
      }
    }

    /* Layer 3: composedPath reverse traversal — lookup closed shadow video via host cache */
    for (let i = path.length - 1; i >= 0; i--) {
      const el = path[i]
      if (el instanceof ShadowRoot) {
        const cached = el._vsVideo
        if (cached && cached.isConnected && isVideoElement(cached)) {
          activeVideo = cached
          return
        }
      }
      if (el.nodeType === 1) {
        const sr = shadowHostMap.get(el)
        if (sr) {
          const cached = sr._vsVideo
          if (cached && cached.isConnected && isVideoElement(cached)) {
            activeVideo = cached
            return
          }
          const videoInShadow = sr.querySelector(SUPPORTED_SELECTOR)
          if (videoInShadow) {
            activeVideo = videoInShadow
            return
          }
        }
      }
    }

    /* Mouse not hovering any video, clear active video */
    activeVideo = null
  }

  function findBestVideo() {
    /* Prefer the mouse-hover-tracked video */
    if (activeVideo && isVideoElement(activeVideo)) {
      try {
        if (activeVideo.isConnected) {
          return activeVideo
        }
      } catch (e) {}
    }

    const allVideos = [...document.querySelectorAll(SUPPORTED_SELECTOR)]
    const shadowVideos = []
    shadowDomList.forEach((sr) => {
      try {
        const videos = sr.querySelectorAll(SUPPORTED_SELECTOR)
        sr._vsVideo = videos.length > 0 ? videos[0] : null
        videos.forEach((v) => shadowVideos.push(v))
      } catch (e) {}
    })
    const candidates = [...allVideos, ...shadowVideos]
    if (!candidates.length) return null

    const visible = candidates.filter((v) => {
      try {
        const r = v.getBoundingClientRect()
        return (
          r.width > 100 &&
          r.height > 50 &&
          r.top < window.innerHeight &&
          r.bottom > 0 &&
          r.left < window.innerWidth &&
          r.right > 0
        )
      } catch (e) {
        return false
      }
    })
    if (!visible.length) return candidates.find((v) => v.videoWidth > 0) || candidates[0]
    if (visible.length === 1) return visible[0]

    let best = null,
      bestScore = -1
    visible.forEach((v) => {
      try {
        const r = v.getBoundingClientRect()
        let score = r.width * r.height
        /* Playing videos get extra weight */
        if (!v.paused && v.readyState > 2) score *= 2
        /* Hovered video has highest priority, ignore area */
        if (v === activeVideo) score = Infinity
        if (score > bestScore) {
          bestScore = score
          best = v
        }
      } catch (e) {}
    })
    return best
  }

  function scanVideoElements() {
    /* Clean up destroyed Shadow DOMs, also clean WeakMap */
    shadowDomList = shadowDomList.filter(function (sr) {
      if (!sr || !sr.isConnected) {
        if (sr && sr.host) shadowHostMap.delete(sr.host)
        return false
      }
      return true
    })
    /* Scan regular DOM for videos */
    document.querySelectorAll(SUPPORTED_SELECTOR).forEach((v) => {
      if (v.tagName.toLowerCase() !== 'video') v.HTMLVideoElement = true
      setupVideoWithCorsRecovery(v)
    })
    /* Scan Shadow DOM for videos and cache _vsVideo */
    shadowDomList.forEach((sr) => {
      try {
        const videos = sr.querySelectorAll(SUPPORTED_SELECTOR)
        sr._vsVideo = videos.length > 0 ? videos[0] : null
        videos.forEach((v) => {
          if (v.tagName.toLowerCase() !== 'video') v.HTMLVideoElement = true
          setupVideoWithCorsRecovery(v)
        })
      } catch (e) {}
    })
  }

  /* ============================================
   * 8. Shadow DOM Bypass
   * ============================================ */
  function hackAttachShadow() {
    if (vsHackShadow) return
    try {
      window.Element.prototype._attachShadow = window.Element.prototype.attachShadow
      window.Element.prototype.attachShadow = function () {
        const arg = arguments
        const isClosed = arg[0] && arg[0].mode === 'closed'

        /* Change mode to open to access internal video */
        if (arg[0] && arg[0].mode) arg[0].mode = 'open'

        const shadowRoot = this._attachShadow.apply(this, arg)
        if (!shadowDomList.includes(shadowRoot)) {
          shadowDomList.push(shadowRoot)
          shadowHostMap.set(this, shadowRoot)
        }

        /* If originally closed mode, fake shadowRoot as null to avoid breaking site behavior */
        if (isClosed) {
          native.Object.defineProperty(this, 'shadowRoot', {
            configurable: true,
            enumerable: true,
            get() {
              return null
            },
          })
        }

        /* Scan newly created Shadow DOM for videos and cache _vsVideo */
        try {
          const videos = shadowRoot.querySelectorAll(SUPPORTED_SELECTOR)
          shadowRoot._vsVideo = videos.length > 0 ? videos[0] : null
          videos.forEach((v) => {
            if (v.tagName.toLowerCase() !== 'video') v.HTMLVideoElement = true
            setupVideoWithCorsRecovery(v)
          })
        } catch (e) {}

        return shadowRoot
      }
      vsHackShadow = true
    } catch (e) {
      console.warn('[VS] Shadow DOM bypass failed')
    }
  }

  function initDOMObserver() {
    const debouncedScan = debounce(scanVideoElements, 100)
    const observer = new MutationObserver(() => debouncedScan())
    observer.observe(document.documentElement, { childList: true, subtree: true })
    document.addEventListener('addShadowRoot', (e) => {
      if (e.detail && e.detail.shadowRoot) {
        const sr = e.detail.shadowRoot
        if (!shadowDomList.includes(sr)) {
          shadowDomList.push(sr)
          if (sr.host) shadowHostMap.set(sr.host, sr)
        }
        try {
          const videos = sr.querySelectorAll(SUPPORTED_SELECTOR)
          sr._vsVideo = videos.length > 0 ? videos[0] : null
          videos.forEach((v) => {
            if (v.tagName.toLowerCase() !== 'video') v.HTMLVideoElement = true
            setupVideoWithCorsRecovery(v)
          })
        } catch (e) {}
      }
    })
  }

  /* ============================================
   * 9. Cross-page Iframe Message Handling
   * ============================================ */
  function handleMessage(event) {
    if (event.data && event.data.type === 'VIDEO_CAPTURE') {
      const video = findBestVideo()
      if (video) videoCapturer.capture(video)
    } else if (event.data && event.data.type === 'VIDEO_CAPTURE_REQUEST') {
      /* Capture on this page if video exists, otherwise forward to child iframes */
      const video = findBestVideo()
      if (video) {
        videoCapturer.capture(video)
      } else {
        const iframes = document.querySelectorAll('iframe')
        iframes.forEach((iframe) => {
          try {
            iframe.contentWindow.postMessage({ type: 'VIDEO_CAPTURE' }, '*')
          } catch (e) {}
        })
      }
    }
  }

  /* ============================================
   * 10. Hotkey Listener
   * ============================================ */
  let keydownHandler = null

  function parseShortcut(str) {
    const parts = str.split('+').map((s) => s.trim())
    const r = {
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
      key: '',
    }
    parts.forEach((p) => {
      const lp = p.toLowerCase()
      if (lp === 'ctrl' || lp === 'control') r.ctrl = true
      else if (lp === 'alt') r.alt = true
      else if (lp === 'shift') r.shift = true
      else if (lp === 'meta' || lp === 'win' || lp === 'cmd') r.meta = true
      else r.key = p
    })
    return r
  }

  function matchShortcut(event) {
    const p = parseShortcut(config.screenshotKey)
    if (
      event.ctrlKey !== p.ctrl ||
      event.altKey !== p.alt ||
      event.shiftKey !== p.shift ||
      event.metaKey !== p.meta
    )
      return false
    if (event.key.toUpperCase() !== p.key.toUpperCase()) return false
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return false
    return true
  }

  function registerKeyHandler() {
    if (keydownHandler) native.removeEventListener.call(document, 'keydown', keydownHandler, true)
    keydownHandler = function (event) {
      const t = event.target
      if (
        (t.getAttribute && t.getAttribute('contenteditable') === 'true') ||
        /INPUT|TEXTAREA|SELECT/.test(t.nodeName)
      )
        return
      if (matchShortcut(event)) {
        event.preventDefault()
        event.stopPropagation()
        const video = findBestVideo()
        if (!video) {
          /* No video on current page, try delegating via iframes */
          if (isInIframe()) {
            window.parent.postMessage({ type: 'VIDEO_CAPTURE_REQUEST' }, '*')
          } else {
            const iframes = document.querySelectorAll('iframe')
            iframes.forEach((iframe) => {
              try {
                iframe.contentWindow.postMessage({ type: 'VIDEO_CAPTURE' }, '*')
              } catch (e) {}
            })
          }
          return
        }
        console.log('[VS] Screenshot triggered, hotkey:', config.screenshotKey)
        videoCapturer.capture(video)
      }
    }
    native.addEventListener.call(document, 'keydown', keydownHandler, true)
  }

  /* ============================================
   * 11. Hotkey Recorder UI (inline overlay)
   * ============================================ */
  let recorderEl = null

  function removeRecorder() {
    if (recorderEl) {
      recorderEl.remove()
      recorderEl = null
      // Re-enable the global screenshot hotkey
      registerKeyHandler()
    }
  }

  function showKeyRecorder() {
    removeRecorder()

    // Temporarily disable the global screenshot hotkey while recording
    if (keydownHandler) {
      native.removeEventListener.call(document, 'keydown', keydownHandler, true)
    }

    const overlay = document.createElement('div')
    overlay.id = '_vs_key_recorder'
    const currentKey = config.screenshotKey || 'S'
    overlay.innerHTML = `
      <div class="_vs_modal">
        <div class="_vs_modal-title">Set Screenshot Hotkey</div>
        <div class="_vs_modal-hint">Current: ${currentKey} — Press a new key combination, or click Save to keep it</div>
        <div class="_vs_modal-display _vs_active">
          <span class="_vs_key_placeholder">Waiting for key...</span>
        </div>
        <div class="_vs_modal-actions">
          <button class="_vs_btn _vs_btn-cancel">Cancel</button>
          <button class="_vs_btn _vs_btn-save">Save</button>
        </div>
      </div>`

    const STYLE_ID = '_vs_recorder_style'
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = `
        #_vs_key_recorder {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          z-index: 2147483647; display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        ._vs_modal {
          background: #fff; border-radius: 16px; padding: 28px 36px 24px;
          min-width: 340px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          text-align: center; animation: _vs_fadeIn 0.2s ease;
        }
        @keyframes _vs_fadeIn { from { opacity:0; transform:scale(0.95) } to { opacity:1; transform:scale(1) } }
        ._vs_modal-title { font-size: 17px; font-weight: 600; color: #1d1d1f; margin-bottom: 8px; }
        ._vs_modal-hint { font-size: 13px; color: #86868b; margin-bottom: 20px; }
        ._vs_modal-display {
          margin: 0 auto 20px; padding: 16px; border-radius: 12px;
          background: #f5f5f7; min-height: 48px; display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        ._vs_modal-display._vs_active { background: #e8f0fe; }
        ._vs_key_placeholder { font-size: 22px; font-weight: 500; color: #999; letter-spacing: 0.5px; }
        ._vs_key_placeholder._vs_recorded { color: #1d1d1f; }
        ._vs_modal-actions { display: flex; gap: 12px; justify-content: center; }
        ._vs_btn {
          padding: 8px 24px; border-radius: 20px; border: none; font-size: 14px;
          font-weight: 500; cursor: pointer; transition: all 0.15s; outline: none;
        }
        ._vs_btn-cancel { background: #f5f5f7; color: #515154; }
        ._vs_btn-cancel:hover { background: #e8e8ed; }
        ._vs_btn-save { background: #0071e3; color: #fff; }
        ._vs_btn-save:hover:not(._vs_disabled) { background: #0077ed; }
        ._vs_btn-save._vs_disabled { opacity: 0.4; cursor: not-allowed; }`
      document.head.appendChild(style)
    }

    document.body.appendChild(overlay)
    recorderEl = overlay

    const placeholder = overlay.querySelector('._vs_key_placeholder')
    const display = overlay.querySelector('._vs_modal-display')
    const saveBtn = overlay.querySelector('._vs_btn-save')
    const cancelBtn = overlay.querySelector('._vs_btn-cancel')

    let recordedKey = currentKey
    let ignoreNextUp = false

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        removeRecorder()
        return
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        return
      }

      ignoreNextUp = true

      const parts = []
      if (e.ctrlKey) parts.push('Ctrl')
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')
      if (e.metaKey) parts.push('Meta')

      const key = e.key
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
        parts.push(key.length === 1 ? key.toUpperCase() : key)
      }

      recordedKey = parts.join('+')
      if (recordedKey) {
        placeholder.textContent = recordedKey
        placeholder.className = '_vs_key_placeholder _vs_recorded'
        display.classList.add('_vs_active')
        saveBtn.disabled = false
        saveBtn.classList.remove('_vs_disabled')
      }
      e.preventDefault()
      e.stopPropagation()
    }

    const onKeyUp = (e) => {
      if (ignoreNextUp) {
        e.preventDefault()
        e.stopPropagation()
        ignoreNextUp = false
        return
      }
      if (e.key === 'Escape') {
        removeRecorder()
        return
      }
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) removeRecorder()
    })
    cancelBtn.addEventListener('click', removeRecorder)
    saveBtn.addEventListener('click', () => {
      if (!recordedKey) return
      config.screenshotKey = recordedKey
      saveConfig(config)
      registerKeyHandler()
      removeRecorder()
      console.log('[VS] Hotkey updated to:', recordedKey)
    })

    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keyup', onKeyUp, true)

    const cleanup = () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('keyup', onKeyUp, true)
    }
    const removalObs = new MutationObserver(() => {
      if (!document.getElementById('_vs_key_recorder')) {
        cleanup()
        removalObs.disconnect()
      }
    })
    removalObs.observe(document.body, { childList: true })
  }

  /* ============================================
   * 12. Tampermonkey Menu
   * ============================================ */
  function registerMenu() {
    /* Global guard: only the first context registers menu items */
    if (window._vs_menuRegistered) return
    window._vs_menuRegistered = true

    const items = [
      {
        title: 'Configure hotkey',
        fn: showKeyRecorder,
      },
      {
        title: 'How to use',
        fn: () =>
          alert(
            'Press the shortcut to take a screenshot. If pressing the shortcut does not produce any results:\n' +
              '1. The browser may have blocked the popup window — check the address bar for blocked popup prompts.\n' +
              '2. Cross-origin (CORS) restrictions may prevent the script from reading video data. Press F12 to open Developer Tools and check the Console tab for related error messages.',
          ),
      },
    ]
    items.forEach((item) => {
      try {
        GM_registerMenuCommand(item.title, item.fn)
      } catch (e) {
        console.warn('[VS] Menu registration failed:', item.title)
      }
    })
  }

  /* ============================================
   * 13. Initialization
   * ============================================ */
  function init() {
    console.log('[VS] Video screenshot tool loaded')

    /* === Prototype hijacking (execute early to auto-add crossorigin to new videos) === */
    hijackVideoSetAttribute()
    hijackVideoSrcProperty()

    /* === Shadow DOM bypass === */
    hackAttachShadow()

    /* === Scan existing videos === */
    scanVideoElements()

    /* === DOM mutation observer (auto-setup CORS when new videos appear) === */
    initDOMObserver()

    /* === Mouse hover tracking === */
    document.addEventListener('mouseover', handleMouseOver, true)

    /* === Cross-origin iframe messages === */
    window.addEventListener('message', handleMessage, false)

    /* === Hotkey === */
    registerKeyHandler()

    /* === Tampermonkey menu === */
    registerMenu()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  window.addEventListener('beforeunload', () => {
    if (keydownHandler) document.removeEventListener('keydown', keydownHandler, true)
  })
})()
