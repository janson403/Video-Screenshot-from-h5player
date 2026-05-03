// ==UserScript==
// @name         Video Screenshot from h5player
// @name:zh      视频截图工具（提取自h5player）
// @description  Press custom hotkey to take video screenshots, supports shadow DOM and cross-origin iframes
// @description:zh  按自定义快捷键截取视频画面，支持 Shadow DOM 和跨域 iframe
// @namespace    https://gitee.com/jason403/Video-Screenshot-from-h5player/
// @version      202605041220
// @author       Pingyi ZHENG
// @icon         data:image/png;base64,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
// @match        *://*/*
// @grant        unsafeWindow
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-start
// @downloadURL  https://raw.giteeusercontent.com/jason403/Video-Screenshot-from-h5player/raw/master/main.user.js
// @updateURL    https://raw.giteeusercontent.com/jason403/Video-Screenshot-from-h5player/raw/master/main.user.js
// @license      GPL
// ==/UserScript==

// original-author ankvps
// original-license GPL
// original-script https://h5player.anzz.site/h5player.user.js
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
