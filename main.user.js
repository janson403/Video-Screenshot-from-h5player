// ==UserScript==
// @name         Video Screenshot from h5player
// @namespace    https://gitee.com/jason403/Video-Screenshot-from-h5player/
// @version      202604292252
// @description  按下自定义快捷键进行视频截图，支持shadow dom和iframe跨域
// @author       Pingyi ZHENG
// @match        *://*/*
// @grant        unsafeWindow
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-start
// @downloadURL  https://raw.giteeusercontent.com/jason403/video-Screenshot-from-h5player/raw/master/main.user.js
// @updateURL    https://raw.giteeusercontent.com/jason403/Video-Screenshot-from-h5player/raw/master/main.user.js
// @license      GPL
// ==/UserScript==

;(function () {
  'use strict'

  /* ============================================
   * 1. 保存原生函数（必须在任何劫持前保存）
   * ============================================ */
  const native = {
    Object: { defineProperty: Object.defineProperty },
    addEventListener: EventTarget.prototype.addEventListener,
    removeEventListener: EventTarget.prototype.removeEventListener,
    setAttribute: HTMLVideoElement.prototype.setAttribute,
    srcDescriptor: Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src') || null,
  }

  /* ============================================
   * 2. 配置管理
   * ============================================ */
  const CONFIG_KEY = 'vs_screenshot_config'
  const defaultConfig = {
    screenshotKey: 'S',
    pauseAfterCapture: true,
  }

  const KEY_MAP = {
    A: 65,
    B: 66,
    C: 67,
    D: 68,
    E: 69,
    F: 70,
    G: 71,
    H: 72,
    I: 73,
    J: 74,
    K: 75,
    L: 76,
    M: 77,
    N: 78,
    O: 79,
    P: 80,
    Q: 81,
    R: 82,
    S: 83,
    T: 84,
    U: 85,
    V: 86,
    W: 87,
    X: 88,
    Y: 89,
    Z: 90,
    0: 48,
    1: 49,
    2: 50,
    3: 51,
    4: 52,
    5: 53,
    6: 54,
    7: 55,
    8: 56,
    9: 57,
    Enter: 13,
    Escape: 27,
    Space: 32,
    F1: 112,
    F2: 113,
    F3: 114,
    F4: 115,
    F5: 116,
    F6: 117,
    F7: 118,
    F8: 119,
    F9: 120,
    F10: 121,
    F11: 122,
    F12: 123,
    ';': 186,
    '=': 187,
    ',': 188,
    '-': 189,
    '.': 190,
    '/': 191,
    '`': 192,
    '[': 219,
    '\\': 220,
    ']': 221,
    "'": 222,
  }

  function loadConfig() {
    try {
      const saved = GM_getValue(CONFIG_KEY, null)
      if (saved && typeof saved === 'object') {
        return Object.assign({}, defaultConfig, saved)
      }
    } catch (e) {
      console.warn('[VS] 加载配置失败，使用默认配置')
    }
    return Object.assign({}, defaultConfig)
  }

  function saveConfig(conf) {
    try {
      GM_setValue(CONFIG_KEY, conf)
    } catch (e) {
      console.warn('[VS] 保存配置失败')
    }
  }

  let config = loadConfig()

  /* ============================================
   * 3. 工具函数
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
   * 4. CORS 激进策略 + 错误自动恢复
   * ============================================ */

  /**
   * 设置视频 CORS + reload（激进策略，如 main.user.js）
   * 对已加载视频强制 reload 以确保 crossoverigin 生效
   * 附加 error 事件监听：若因 CORS 加载失败，自动移除 crossorigin 并重试
   */
  function setupVideoWithCorsRecovery(video) {
    if (video._corsSetupDone) return
    video._corsSetupDone = true

    /* 首次设置 crossorigin */
    if (!video.hasAttribute('crossorigin')) {
      video.setAttribute('crossorigin', 'anonymous')
    }

    /* 如果视频已加载，强制重载以应用CORS设置 */
    if (video.src && video.readyState > 0) {
      const originalSrc = video.src
      const currentTime = video.currentTime
      const paused = video.paused

      video.src = ''
      video.load()

      setTimeout(() => {
        if (!originalSrc) return
        video.src = originalSrc
        if (!paused) video.play().catch(() => {})

        /* 等元数据就绪再恢复进度，比直接赋 currentTime 更稳定 */
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

        /* 兜底：3秒后仍未触发则强试 */
        setTimeout(seekToTime, 3000)
      }, 0)
    }

    /* 错误恢复：CORS加载失败时自动移除属性并重试 */
    video.addEventListener('error', function onCorsError() {
      if (!video.hasAttribute('crossorigin')) return
      if (video._corsRecovering) return

      const mediaError = video.error
      /* MEDIA_ERR_SRC_NOT_SUPPORTED(4) 或 MEDIA_ERR_NETWORK(2) 可能是 CORS 导致 */
      if (
        mediaError &&
        (mediaError.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED ||
          mediaError.code === MediaError.MEDIA_ERR_NETWORK)
      ) {
        console.warn('[VS] 视频因CORS限制加载失败，自动移除crossorigin重试')

        video._corsRecovering = true
        const paused = video.paused
        const currentTime = video.currentTime
        const src = video.currentSrc || video.src

        video.removeAttribute('crossorigin')

        video.src = ''
        video.load()

        setTimeout(() => {
          if (!src) return
          video.src = src
          if (!paused) video.play().catch(() => {})

          /* 等元数据就绪再恢复进度 */
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
          setTimeout(seekToTime, 3000)
        }, 0)
      }
    })

    /* playing 事件追踪：无悬停时设为当前目标，不覆盖鼠标悬停优先 */
    video.addEventListener('playing', function onPlaying() {
      if (!activeVideo) activeVideo = video
    })
  }

  /* ============================================
   * 5. 原型劫持（自动为视频添加 crossorigin）
   * ============================================ */

  /**
   * 劫持 HTMLVideoElement.prototype.setAttribute
   * 当设置 src 时自动插入 crossorigin
   */
  function hijackVideoSetAttribute() {
    const originalSetAttribute = HTMLVideoElement.prototype.setAttribute
    HTMLVideoElement.prototype.setAttribute = function (name, value) {
      if (name === 'src' && !this.hasAttribute('crossorigin')) {
        this._corsSet = true
        originalSetAttribute.call(this, 'crossorigin', 'anonymous')
      }
      return originalSetAttribute.call(this, name, value)
    }
  }

  /**
   * 劫持 HTMLMediaElement.prototype.src 属性 setter
   * 通过 video.src = '...' 赋值时自动插入 crossorigin
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
            this._corsSet = true
            this.setAttribute('crossorigin', 'anonymous')
          }
          return originalSet.call(this, value)
        },
      })
    }
  }

  /* ============================================
   * 6. 截图核心
   * ============================================ */
  const videoCapturer = {
    capture(video) {
      if (!video || !isVideoElement(video)) {
        console.warn('[VS] 无效的视频元素')
        return false
      }
      if (!video.videoWidth || !video.videoHeight) {
        console.warn('[VS] 视频尚未加载出画面')
        return false
      }

      const t = video.currentTime
      const ts = `${Math.floor(t / 60)}'${(t % 60).toFixed(2)}"`

      const title = `screenshot_${document.title.replace(/[<>:"/\\|?*]/g, '_')}_${ts}`

      /* CORS 已在原型劫持和 setupVideoWithCorsRecovery 中提前设置，
         此处不再重复设置（但保留兜底以防边缘情况） */
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
        console.warn('[VS] 无法获取 canvas 上下文')
        return false
      }

      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      } catch (e) {
        console.warn('[VS] drawImage 失败（CORS?）', e)
        return false
      }

      console.log('[VS] 截图成功', { title, w: canvas.width, h: canvas.height })

      if (config.pauseAfterCapture && !video.paused) {
        video.pause()
        console.log('[VS] 已暂停定格画面')
      }

      this.preview(canvas, title)
      return true
    },

    preview(canvas, title) {
      canvas.style = 'max-width:100%'
      const previewPage = window.open('', '_blank')
      previewPage.document.title = `capture preview - ${title || 'Untitled'}`
      previewPage.document.body.style.textAlign = 'center'
      previewPage.document.body.style.margin = '0'
      previewPage.document.body.appendChild(canvas)
    },
  }

  /* ============================================
   * 7. 视频元素查找 & DOM 监听
   * ============================================ */
  let activeVideo = null
  let shadowDomList = []
  let vsHackShadow = false

  /* 鼠标悬停追踪当前活动的视频（如 main.user.js） */
  function handleMouseOver(event) {
    let target = event.target
    while (target) {
      if (isVideoElement(target)) {
        activeVideo = target
        break
      }
      /* 检查 Shadow DOM 中的视频 */
      if (target.shadowRoot) {
        const videoInShadow = target.shadowRoot.querySelector(SUPPORTED_SELECTOR)
        if (videoInShadow) {
          activeVideo = videoInShadow
          break
        }
      }
      target = target.parentNode
    }
  }

  function findBestVideo() {
    /* 优先使用鼠标悬停追踪的视频 */
    if (activeVideo && isVideoElement(activeVideo)) {
      try {
        if (document.contains(activeVideo)) {
          return activeVideo
        }
      } catch (e) {}
    }

    const allVideos = [...document.querySelectorAll(SUPPORTED_SELECTOR)]
    const shadowVideos = []
    shadowDomList.forEach((sr) => {
      try {
        sr.querySelectorAll(SUPPORTED_SELECTOR).forEach((v) => shadowVideos.push(v))
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
        /* 正在播放的视频获得额外权重 */
        if (!v.paused && v.readyState > 2) score *= 2
        if (score > bestScore) {
          bestScore = score
          best = v
        }
      } catch (e) {}
    })
    return best
  }

  function scanVideoElements() {
    /* 清理已销毁的 Shadow DOM 列表 */
    shadowDomList = shadowDomList.filter(function (sr) {
      return sr && sr.isConnected
    })
    /* 扫描常规 DOM 中的视频 */
    document.querySelectorAll(SUPPORTED_SELECTOR).forEach((v) => {
      if (v.tagName.toLowerCase() !== 'video') v.HTMLVideoElement = true
      setupVideoWithCorsRecovery(v)
    })
    /* 扫描 Shadow DOM 中的视频 */
    shadowDomList.forEach((sr) => {
      try {
        sr.querySelectorAll(SUPPORTED_SELECTOR).forEach((v) => {
          if (v.tagName.toLowerCase() !== 'video') v.HTMLVideoElement = true
          setupVideoWithCorsRecovery(v)
        })
      } catch (e) {}
    })
  }

  /* ============================================
   * 8. Shadow DOM 破解
   * ============================================ */
  function hackAttachShadow() {
    if (vsHackShadow) return
    try {
      window.Element.prototype._attachShadow = window.Element.prototype.attachShadow
      window.Element.prototype.attachShadow = function () {
        const arg = arguments
        const isClosed = arg[0] && arg[0].mode === 'closed'

        /* 改为 open 以便访问内部 video */
        if (arg[0] && arg[0].mode) arg[0].mode = 'open'

        const shadowRoot = this._attachShadow.apply(this, arg)
        if (!shadowDomList.includes(shadowRoot)) shadowDomList.push(shadowRoot)

        /* 如果原是 closed 模式，伪装 shadowRoot 为 null 避免破坏站点行为 */
        if (isClosed) {
          native.Object.defineProperty(this, 'shadowRoot', {
            configurable: true,
            enumerable: true,
            get() {
              return null
            },
          })
        }

        /* 在新创建的 Shadow DOM 中扫描视频 */
        try {
          shadowRoot.querySelectorAll(SUPPORTED_SELECTOR).forEach((v) => {
            if (v.tagName.toLowerCase() !== 'video') v.HTMLVideoElement = true
            setupVideoWithCorsRecovery(v)
          })
        } catch (e) {}

        return shadowRoot
      }
      vsHackShadow = true
    } catch (e) {
      console.warn('[VS] Shadow DOM 破解失败')
    }
  }

  function initDOMObserver() {
    const debouncedScan = debounce(scanVideoElements, 100)
    const observer = new MutationObserver(() => debouncedScan())
    observer.observe(document.documentElement, { childList: true, subtree: true })
    document.addEventListener('addShadowRoot', (e) => {
      if (e.detail && e.detail.shadowRoot) {
        const sr = e.detail.shadowRoot
        if (!shadowDomList.includes(sr)) shadowDomList.push(sr)
        try {
          sr.querySelectorAll(SUPPORTED_SELECTOR).forEach((v) => {
            if (v.tagName.toLowerCase() !== 'video') v.HTMLVideoElement = true
            setupVideoWithCorsRecovery(v)
          })
        } catch (e) {}
      }
    })
  }

  /* ============================================
   * 9. Iframe 跨页面消息处理（如 main.user.js）
   * ============================================ */
  function handleMessage(event) {
    if (event.data && event.data.type === 'VIDEO_CAPTURE') {
      const video = findBestVideo()
      if (video) videoCapturer.capture(video)
    } else if (event.data && event.data.type === 'VIDEO_CAPTURE_REQUEST') {
      /* 本页有视频则截图，否则转发给子 iframe */
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
   * 10. 快捷键监听
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
      keyCode: 0,
    }
    parts.forEach((p) => {
      const lp = p.toLowerCase()
      if (lp === 'ctrl' || lp === 'control') r.ctrl = true
      else if (lp === 'alt') r.alt = true
      else if (lp === 'shift') r.shift = true
      else if (lp === 'meta' || lp === 'win' || lp === 'cmd') r.meta = true
      else r.key = p
    })
    if (r.key) r.keyCode = KEY_MAP[r.key] || r.key.toUpperCase().charCodeAt(0)
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
    const ek = event.key.toUpperCase()
    if (ek !== p.key.toUpperCase() && event.keyCode !== p.keyCode) return false
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
          /* 当前页无视频，尝试通过 iframe 委托 */
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
        console.log('[VS] 截图触发，快捷键:', config.screenshotKey)
        videoCapturer.capture(video)
      }
    }
    native.addEventListener.call(document, 'keydown', keydownHandler, true)
  }

  /* ============================================
   * 11. 快捷键录制 UI（inline 浮层）
   * ============================================ */
  let recorderEl = null

  function removeRecorder() {
    if (recorderEl) {
      recorderEl.remove()
      recorderEl = null
    }
  }

  function showKeyRecorder() {
    removeRecorder()

    const overlay = document.createElement('div')
    overlay.id = '_vs_key_recorder'
    overlay.innerHTML = `
      <div class="_vs_modal">
        <div class="_vs_modal-title">设置截图快捷键</div>
        <div class="_vs_modal-hint">请按下你想要绑定的组合键</div>
        <div class="_vs_modal-display">
          <span class="_vs_key_placeholder">等待按键...</span>
        </div>
        <div class="_vs_modal-actions">
          <button class="_vs_btn _vs_btn-cancel">取消</button>
          <button class="_vs_btn _vs_btn-save _vs_disabled" disabled>保存</button>
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

    let recordedKey = ''
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
      rebuildMenu()
      removeRecorder()
      console.log('[VS] 快捷键已更新为:', recordedKey)
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
   * 12. 油猴菜单
   * ============================================ */
  let menuIds = []

  function clearMenu() {
    menuIds.forEach((id) => {
      try {
        GM_unregisterMenuCommand(id)
      } catch (e) {}
    })
    menuIds = []
  }

  function rebuildMenu() {
    clearMenu()
    registerMenu()
  }

  function registerMenu() {
    const items = [
      {
        title: `[截图] 修改快捷键 (当前: ${config.screenshotKey})`,
        fn: showKeyRecorder,
      },
    ]
    items.forEach((item) => {
      try {
        const id = GM_registerMenuCommand(item.title, item.fn)
        menuIds.push(id)
      } catch (e) {
        console.warn('[VS] 注册菜单失败:', item.title)
      }
    })
  }

  /* ============================================
   * 13. 初始化
   * ============================================ */
  function init() {
    console.log('[VS] 视频截图工具 v1.2.0 已加载')

    /* === 原型劫持（尽早执行，确保新创建的 video 自动带上 crossorigin） === */
    hijackVideoSetAttribute()
    hijackVideoSrcProperty()

    /* === Shadow DOM 破解 === */
    hackAttachShadow()

    /* === 扫描已有视频 === */
    scanVideoElements()

    /* === DOM 变化监听（新视频出现时自动设置 CORS） === */
    initDOMObserver()

    /* === 鼠标悬停追踪 === */
    document.addEventListener('mouseover', handleMouseOver, true)

    /* === Iframe 跨域消息 === */
    window.addEventListener('message', handleMessage, false)

    /* === 快捷键 === */
    registerKeyHandler()

    /* === 油猴菜单 === */
    registerMenu()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  window.addEventListener('beforeunload', () => {
    if (keydownHandler) document.removeEventListener('keydown', keydownHandler, true)
    clearMenu()
  })
})()
