// ==UserScript==
// @name         Video Screenshot with Shift + S from h5player
// @namespace    https://gitee.com/jason403/Video-Screenshot-with-Shift-S-from-h5player/
// @version      1.2
// @description  按下Shift+S键进行视频截图，支持shadow dom和iframe跨域
// @author       Pingyi ZHENG
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @downloadURL  https://raw.giteeusercontent.com/jason403/Video-Screenshot-with-Shift-S-from-h5player/raw/master/main.user.js
// @updateURL    https://raw.giteeusercontent.com/jason403/Video-Screenshot-with-Shift-S-from-h5player/raw/master/main.user.js
// ==/UserScript==

;(function () {
  'use strict'

  const supportMediaTags = ['video', 'bwp-video']
  let shadowDomList = []
  let activePlayerInstance = null

  function setVideoCors(video) {
    if (!video || !(video instanceof HTMLVideoElement)) return
    if (video._corsSet) return
    video._corsSet = true

    if (!video.hasAttribute('crossorigin')) {
      video.setAttribute('crossorigin', 'anonymous')
    }

    if (video.src && video.readyState > 0) {
      const originalSrc = video.src
      const currentTime = video.currentTime
      const paused = video.paused

      video.src = ''
      video.load()

      setTimeout(() => {
        video.src = originalSrc
        video.currentTime = currentTime
        if (!paused) {
          video.play().catch(() => {})
        }
      }, 0)
    }
  }

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

  function hijackVideoSrcProperty() {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')
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

  function ready(selector, fn, shadowRoot) {
    const win = window
    const doc = shadowRoot || win.document
    const MutationObserver = win.MutationObserver || win.WebKitMutationObserver
    let observer

    function check() {
      const elements = doc.querySelectorAll(selector)
      elements.forEach(function (element) {
        if (!element._isMutationReady_) {
          element._isMutationReady_ = true
          fn.call(element, element)
        }
      })
    }

    check()

    if (!observer) {
      observer = new MutationObserver(check)
      observer.observe(shadowRoot || doc.documentElement, {
        childList: true,
        subtree: true,
      })
    }

    return observer
  }

  function hackAttachShadow() {
    if (window._hasHackAttachShadow_) return
    try {
      shadowDomList = []
      window._shadowDomList_ = shadowDomList

      Element.prototype._attachShadow = Element.prototype.attachShadow
      Element.prototype.attachShadow = function () {
        const arg = arguments
        const isClosed = arg[0] && arg[0].mode === 'closed'

        if (arg[0] && arg[0].mode) {
          arg[0].mode = 'open'
        }
        const shadowRoot = this._attachShadow.apply(this, arg)
        shadowDomList.push(shadowRoot)
        shadowRoot._shadowHost = this

        const shadowEvent = new window.CustomEvent('addShadowRoot', {
          shadowRoot,
          detail: { shadowRoot, message: 'addShadowRoot', time: new Date() },
          bubbles: true,
          cancelable: true,
        })
        document.dispatchEvent(shadowEvent)

        if (isClosed) {
          Object.defineProperty(this, 'shadowRoot', {
            get() {
              return null
            },
          })
        }

        supportMediaTags.forEach((tagName) => {
          ready(
            tagName,
            function (element) {
              if (element.tagName.toLowerCase() === 'bwp-video') {
                element.HTMLVideoElement = true
              }
              setVideoCors(element)
            },
            shadowRoot,
          )
        })

        return shadowRoot
      }
      window._hasHackAttachShadow_ = true
    } catch (e) {}
  }

  function isVideoElement(element) {
    return (
      element instanceof HTMLVideoElement ||
      element.HTMLVideoElement === true ||
      (element.tagName && element.tagName.toLowerCase() === 'bwp-video')
    )
  }

  function isEditableTarget(target) {
    return (
      target.isContentEditable ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT'
    )
  }

  function isInIframe() {
    return window.self !== window.top
  }

  function isInViewPort(element) {
    if (!element) return false
    const rect = element.getBoundingClientRect()
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    )
  }

  function getPlayerList() {
    const list = []

    function findPlayer(context) {
      supportMediaTags.forEach((tagName) => {
        try {
          context.querySelectorAll(tagName).forEach(function (player) {
            if (player.tagName.toLowerCase() === 'bwp-video') {
              player.HTMLVideoElement = true
            }
            if (isVideoElement(player) && !list.includes(player)) {
              list.push(player)
            }
          })
        } catch (e) {}
      })
    }

    findPlayer(document)

    if (shadowDomList && shadowDomList.length > 0) {
      shadowDomList.forEach(function (shadowRoot) {
        findPlayer(shadowRoot)
      })
    }

    return list
  }

  function getCurrentPlayer() {
    if (activePlayerInstance && isVideoElement(activePlayerInstance)) {
      try {
        if (document.contains(activePlayerInstance)) {
          return activePlayerInstance
        }
      } catch (e) {}
    }

    const mediaList = getPlayerList().filter(isVideoElement)
    if (mediaList.length === 0) return null

    const visibleMedia = mediaList.filter(isInViewPort)
    if (visibleMedia.length > 0) {
      let largestVideo = visibleMedia[0]
      let largestArea = 0
      visibleMedia.forEach((video) => {
        const rect = video.getBoundingClientRect()
        const area = rect.width * rect.height
        if (area > largestArea) {
          largestArea = area
          largestVideo = video
        }
      })
      return largestVideo
    }

    return mediaList[mediaList.length - 1]
  }

  function preview(canvas) {
    canvas.style = 'max-width:100%'
    const previewPage = window.open('', '_blank')
    previewPage.document.title = `capture preview`
    previewPage.document.body.style.textAlign = 'center'
    previewPage.document.body.appendChild(canvas)
  }

  function capture(video) {
    if (!video) return false
    if (video.readyState < 2) return false

    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || video.width || 1920
      canvas.height = video.videoHeight || video.height || 1080
      const context = canvas.getContext('2d')
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      preview(canvas)
      return canvas
    } catch (e) {
      console.error('[video-capture] capture failed', e)
      return false
    }
  }

  function handleKeyDown(event) {
    if (isEditableTarget(event.target)) return
    if (event.shiftKey && event.key.toLowerCase() === 's') {
      event.preventDefault()

      const player = getCurrentPlayer()
      if (player) {
        capture(player)
      } else if (isInIframe()) {
        window.parent.postMessage({ type: 'VIDEO_CAPTURE_REQUEST' }, '*')
      } else {
        const iframes = document.querySelectorAll('iframe')
        let found = false
        iframes.forEach((iframe) => {
          try {
            const iframeWindow = iframe.contentWindow
            if (iframeWindow) {
              iframeWindow.postMessage({ type: 'VIDEO_CAPTURE' }, '*')
              found = true
            }
          } catch (e) {}
        })
      }
    }
  }

  function handleMessage(event) {
    if (event.data && event.data.type === 'VIDEO_CAPTURE') {
      const player = getCurrentPlayer()
      if (player) capture(player)
    } else if (event.data && event.data.type === 'VIDEO_CAPTURE_REQUEST') {
      const player = getCurrentPlayer()
      if (player) {
        capture(player)
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

  function handleMouseOver(event) {
    let target = event.target
    while (target) {
      if (isVideoElement(target)) {
        activePlayerInstance = target
        break
      }
      if (target.shadowRoot) {
        const videoInShadow = target.shadowRoot.querySelector('video, bwp-video')
        if (videoInShadow) {
          activePlayerInstance = videoInShadow
          break
        }
      }
      target = target.parentNode
    }
  }

  function init() {
    hackAttachShadow()
    hijackVideoSetAttribute()
    hijackVideoSrcProperty()

    supportMediaTags.forEach((tagName) => {
      ready(tagName, function (element) {
        if (element.tagName.toLowerCase() === 'bwp-video') {
          element.HTMLVideoElement = true
        }
        setVideoCors(element)
      })
    })

    document.addEventListener('addShadowRoot', function (e) {
      const shadowRoot = e.detail.shadowRoot
      if (shadowRoot && !shadowDomList.includes(shadowRoot)) {
        shadowDomList.push(shadowRoot)
      }
    })

    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('message', handleMessage, false)
    document.addEventListener('mouseover', handleMouseOver, true)
  }

  init()
})()
