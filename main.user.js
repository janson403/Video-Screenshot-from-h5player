// ==UserScript==
// @name         Video Screenshot with Shift + S from h5player
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  按下Shift+S键进行视频截图，支持shadow dom和iframe跨域
// @author       Pingyi ZHENG
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @downloadURL  https://raw.giteeusercontent.com/jason403/Video-Screenshot-with-Shift-S-from-h5player/raw/master/main.js
// @updateURL    https://raw.giteeusercontent.com/jason403/Video-Screenshot-with-Shift-S-from-h5player/raw/master/main.js
// ==/UserScript==

;(function () {
  'use strict'

  // 支持的媒体标签
  const supportMediaTags = ['video', 'bwp-video']

  // 存储媒体元素列表
  let mediaElementList = []

  // 存储shadow dom列表
  let shadowDomList = []

  // 存储当前激活的播放器实例
  let activePlayerInstance = null

  // 存储原始方法
  const originalMethods = {
    Object: {
      defineProperty: Object.defineProperty,
      getOwnPropertyDescriptors: Object.getOwnPropertyDescriptors,
    },
    Element: {
      attachShadow: Element.prototype.attachShadow,
    },
    Map: Map,
  }

  // 劫持attachShadow方法
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
          // 强制使用 open mode
          arg[0].mode = 'open'
        }
        const shadowRoot = this._attachShadow.apply(this, arg)
        // 存一份shadowDomList
        shadowDomList.push(shadowRoot)

        /* 让shadowRoot里面的元素有机会访问shadowHost */
        shadowRoot._shadowHost = this

        // 在document下面添加 addShadowRoot 自定义事件
        const shadowEvent = new window.CustomEvent('addShadowRoot', {
          shadowRoot,
          detail: {
            shadowRoot,
            message: 'addShadowRoot',
            time: new Date(),
          },
          bubbles: true,
          cancelable: true,
        })
        document.dispatchEvent(shadowEvent)

        if (isClosed) {
          /**
           * 通过defineProperty来设置shadowRoot，get的时候返回null
           * 让外部感知到的还是closed的shadowRoot，防止误判或针对性检测
           */
          Object.defineProperty(this, 'shadowRoot', {
            get() {
              return null
            },
          })
        }

        return shadowRoot
      }
      window._hasHackAttachShadow_ = true
    } catch (e) {
      console.error('hackAttachShadow error by video capture script', e)
    }
  }

  // 检查是否为媒体元素
  function isMediaElement(element) {
    return (
      element instanceof HTMLVideoElement ||
      element instanceof HTMLAudioElement ||
      element.HTMLVideoElement === true
    )
  }

  // 检查是否为视频元素
  function isVideoElement(element) {
    return element instanceof HTMLVideoElement || element.HTMLVideoElement === true
  }

  // 检查是否在可编辑元素内
  function isEditableTarget(target) {
    return (
      target.isContentEditable ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT'
    )
  }

  // 检查是否在iframe内
  function isInIframe() {
    return window.self !== window.top
  }

  // 检查是否在跨域iframe内
  function isInCrossOriginFrame() {
    try {
      return window.top.location.host !== window.location.host
    } catch (e) {
      return true
    }
  }

  // 遍历父节点
  function eachParentNode(element, callback) {
    let current = element
    while (current) {
      callback(current)
      current = current.parentNode
    }
  }

  // 检查元素是否在视口中
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

  // 媒体核心功能
  const mediaCore = (function () {
    let hasMediaCoreInit = false
    let hasProxyHTMLMediaElement = false
    let originDescriptors = {}
    const originMethods = {}
    const mediaElementList = []
    const mediaElementHandler = []
    const mediaMap = new Map()

    const firstUpperCase = (str) => str.replace(/^\S/, (s) => s.toUpperCase())
    function isHTMLMediaElement(el) {
      return el instanceof HTMLMediaElement
    }

    /**
     * 根据HTMLMediaElement的实例对象创建增强控制的相关API函数
     */
    function createMediaPlusApi(mediaElement) {
      if (!isHTMLMediaElement(mediaElement)) {
        return false
      }

      let mediaPlusApi = mediaMap.get(mediaElement)
      if (mediaPlusApi) {
        return mediaPlusApi
      }

      /* 创建MediaPlusApi对象 */
      mediaPlusApi = {}
      const mediaPlusBaseApi = {
        /**
         * 创建锁，阻止外部逻辑操作mediaElement相关的属性或函数
         */
        lock(keyName, duration) {
          const infoKey = `__${keyName}_info__`
          mediaPlusApi[infoKey] = mediaPlusApi[infoKey] || {}
          mediaPlusApi[infoKey].lock = true

          /* 解锁时间信息 */
          duration = Number(duration)
          if (!Number.isNaN(duration) && duration > 0) {
            mediaPlusApi[infoKey].unLockTime = Date.now() + duration
          }
        },
        unLock(keyName) {
          const infoKey = `__${keyName}_info__`
          mediaPlusApi[infoKey] = mediaPlusApi[infoKey] || {}
          mediaPlusApi[infoKey].lock = false
          mediaPlusApi[infoKey].unLockTime = Date.now() - 100
        },
        isLock(keyName) {
          const info = mediaPlusApi[`__${keyName}_info__`] || {}

          if (info.unLockTime) {
            /* 延时锁根据当前时间计算是否还处于锁状态 */
            return Date.now() < info.unLockTime
          } else {
            return info.lock || false
          }
        },

        /* 注意：调用此处的get和set和apply不受锁的限制 */
        get(keyName) {
          if (
            originDescriptors[keyName] &&
            originDescriptors[keyName].get &&
            !originMethods[keyName]
          ) {
            return originDescriptors[keyName].get.apply(mediaElement)
          }
        },
        set(keyName, val) {
          if (
            originDescriptors[keyName] &&
            originDescriptors[keyName].set &&
            !originMethods[keyName] &&
            typeof val !== 'undefined'
          ) {
            return originDescriptors[keyName].set.apply(mediaElement, [val])
          }
        },
        apply(keyName) {
          if (originMethods[keyName] instanceof Function) {
            const args = Array.from(arguments)
            args.shift()
            return originMethods[keyName].apply(mediaElement, args)
          }
        },
      }

      mediaPlusApi = { ...mediaPlusApi, ...mediaPlusBaseApi }

      /**
       * 扩展api列表
       */
      const extApiKeys = ['playbackRate', 'volume', 'currentTime', 'play', 'pause']
      const baseApiKeys = Object.keys(mediaPlusBaseApi)
      extApiKeys.forEach((key) => {
        baseApiKeys.forEach((baseKey) => {
          /* 当key对应的是函数时，不应该有get、set的api，而应该有apply的api */
          if (originMethods[key] instanceof Function) {
            if (baseKey === 'get' || baseKey === 'set') {
              return true
            }
          } else if (baseKey === 'apply') {
            return true
          }

          mediaPlusApi[`${baseKey}${firstUpperCase(key)}`] = function () {
            return mediaPlusBaseApi[baseKey].apply(null, [key, ...arguments])
          }
        })
      })

      mediaMap.set(mediaElement, mediaPlusApi)

      return mediaPlusApi
    }

    /* 检测到media对象的处理逻辑，依赖Proxy对media函数的代理 */
    function mediaDetectHandler(ctx) {
      if (isHTMLMediaElement(ctx) && !mediaElementList.includes(ctx)) {
        mediaElementList.push(ctx)
        createMediaPlusApi(ctx)

        try {
          mediaElementHandler.forEach((handler) => {
            handler instanceof Function && handler(ctx)
          })
        } catch (e) {}
      }
    }

    /* 代理方法play和pause方法，确保能正确暂停和播放 */
    function proxyPrototypeMethod(element, methodName) {
      const originFunc = element && element.prototype[methodName]
      if (!originFunc) return

      element.prototype[methodName] = new Proxy(originFunc, {
        apply(target, ctx, args) {
          mediaDetectHandler(ctx)

          /* 对播放暂停逻辑进行增强处理，例如允许通过mediaPlusApi进行锁定 */
          if (['play', 'pause'].includes(methodName)) {
            const mediaPlusApi = createMediaPlusApi(ctx)
            if (mediaPlusApi && mediaPlusApi.isLock(methodName)) {
              return
            }
          }

          const result = target.apply(ctx, args)

          return result
        },
      })
    }

    /**
     * 劫持 playbackRate、volume、currentTime 属性，并增加锁定的逻辑
     */
    function hijackPrototypeProperty(element, property) {
      if (!element || !element.prototype || !originDescriptors[property]) {
        return false
      }

      Object.defineProperty(element.prototype, property, {
        configurable: true,
        enumerable: true,
        get: function () {
          const val = originDescriptors[property].get.apply(this, arguments)

          const mediaPlusApi = createMediaPlusApi(this)
          if (mediaPlusApi && mediaPlusApi.isLock(property)) {
            if (property === 'playbackRate') {
              return 1
            }
          }

          return val
        },
        set: function (value) {
          if (property === 'src') {
            mediaDetectHandler(this)
          }

          /* 对调速、调音和进度控制逻辑进行增强处理 */
          if (['playbackRate', 'volume', 'currentTime'].includes(property)) {
            const mediaPlusApi = createMediaPlusApi(this)
            if (mediaPlusApi && mediaPlusApi.isLock(property)) {
              return
            }
          }

          return originDescriptors[property].set.apply(this, arguments)
        },
      })
    }

    function mediaPlus(mediaElement) {
      return createMediaPlusApi(mediaElement)
    }

    function mediaProxy() {
      if (!hasProxyHTMLMediaElement) {
        const proxyMethods = ['play', 'pause', 'load', 'addEventListener']
        proxyMethods.forEach((methodName) => {
          proxyPrototypeMethod(HTMLMediaElement, methodName)
        })

        const hijackProperty = ['playbackRate', 'volume', 'currentTime', 'src']
        hijackProperty.forEach((property) => {
          hijackPrototypeProperty(HTMLMediaElement, property)
        })

        hasProxyHTMLMediaElement = true
      }

      return hasProxyHTMLMediaElement
    }

    /**
     * 媒体标签检测，可以检测出video、audio、以及其它标签名经过改造后的媒体Element
     */
    function mediaChecker(handler) {
      if (!(handler instanceof Function) || mediaElementHandler.includes(handler)) {
        return mediaElementList
      } else {
        mediaElementHandler.push(handler)
      }

      if (!hasProxyHTMLMediaElement) {
        mediaProxy()
      }

      return mediaElementList
    }

    /**
     * 初始化mediaCore相关功能
     */
    function init(mediaCheckerHandler) {
      if (hasMediaCoreInit) {
        return false
      }

      originDescriptors = Object.getOwnPropertyDescriptors(HTMLMediaElement.prototype)

      Object.keys(HTMLMediaElement.prototype).forEach((key) => {
        try {
          if (HTMLMediaElement.prototype[key] instanceof Function) {
            originMethods[key] = HTMLMediaElement.prototype[key]
          }
        } catch (e) {}
      })

      mediaCheckerHandler =
        mediaCheckerHandler instanceof Function ? mediaCheckerHandler : function () {}
      mediaChecker(mediaCheckerHandler)

      hasMediaCoreInit = true
      return true
    }

    return {
      init,
      mediaPlus,
      mediaChecker,
      originDescriptors,
      originMethods,
      mediaElementList,
    }
  })()

  // 获取媒体元素列表
  function getPlayerList() {
    const list = []

    function findPlayer(context) {
      supportMediaTags.forEach((tagName) => {
        context.querySelectorAll(tagName).forEach(function (player) {
          if (player.tagName.toLowerCase() === 'bwp-video') {
            // 将B站的BWP-VIDEO标识为HTMLVideoElement
            player.HTMLVideoElement = true
          }

          if (isMediaElement(player) && !list.includes(player)) {
            list.push(player)
          }
        })
      })
    }

    // 查找普通DOM中的媒体元素
    findPlayer(document)

    // 查找shadow dom中的媒体元素
    if (shadowDomList && shadowDomList.length > 0) {
      shadowDomList.forEach(function (shadowRoot) {
        findPlayer(shadowRoot)
      })
    }

    return list
  }

  // 智能获取当前播放器实例
  function getCurrentPlayer() {
    // 优先返回当前激活的播放器
    if (activePlayerInstance && isVideoElement(activePlayerInstance)) {
      return activePlayerInstance
    }

    // 否则返回最后一个视频元素
    const mediaList = getPlayerList().filter(isVideoElement)
    if (mediaList.length) {
      // 优先选择在视口中的视频
      const visibleMedia = mediaList.filter(isInViewPort)
      if (visibleMedia.length) {
        return visibleMedia[visibleMedia.length - 1]
      }
      return mediaList[mediaList.length - 1]
    }
    return null
  }

  // 截图功能
  function capture(video, title) {
    if (!video) return false

    const currentTime = `${Math.floor(video.currentTime / 60)}'${(video.currentTime % 60).toFixed(3)}''`
    const captureTitle = title || `${document.title}_${currentTime}`

    // 截图核心逻辑
    video.setAttribute('crossorigin', 'anonymous')
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    previewCanvas(canvas, captureTitle)

    return canvas
  }

  // 预览截图
  function previewCanvas(canvas, title) {
    canvas.style = 'max-width:100%'
    const previewPage = window.open('', '_blank')
    previewPage.document.title = `capture preview - ${title || 'Untitled'}`
    previewPage.document.body.style.textAlign = 'center'
    previewPage.document.body.appendChild(canvas)
  }

  // 处理键盘事件
  function handleKeyDown(event) {
    // 检查是否在可编辑元素内
    if (isEditableTarget(event.target)) {
      return
    }

    // 检查是否按下了Shift+S
    if (event.shiftKey && event.key.toLowerCase() === 's') {
      event.preventDefault()

      // 尝试在当前窗口截图
      const player = getCurrentPlayer()
      if (player) {
        capture(player)
      } else if (isInIframe()) {
        // 如果当前在iframe内且没有找到视频，尝试向父窗口发送消息
        window.parent.postMessage({ type: 'VIDEO_CAPTURE_REQUEST' }, '*')
      } else {
        // 尝试在所有iframe中查找视频
        const iframes = document.querySelectorAll('iframe')
        let found = false

        iframes.forEach((iframe) => {
          try {
            const iframeWindow = iframe.contentWindow
            if (iframeWindow) {
              iframeWindow.postMessage({ type: 'VIDEO_CAPTURE' }, '*')
              found = true
            }
          } catch (e) {
            // 跨域iframe，无法直接访问
          }
        })

        if (!found) {
          console.log('未找到视频元素')
        }
      }
    }
  }

  // 处理消息事件
  function handleMessage(event) {
    if (event.data && event.data.type === 'VIDEO_CAPTURE') {
      const player = getCurrentPlayer()
      if (player) {
        capture(player)
      }
    } else if (event.data && event.data.type === 'VIDEO_CAPTURE_REQUEST') {
      // 父窗口收到子窗口的截图请求
      const player = getCurrentPlayer()
      if (player) {
        capture(player)
      }
    }
  }

  // 监听鼠标事件，记录当前激活的播放器
  function handleMouseOver(event) {
    let target = event.target
    while (target) {
      if (isVideoElement(target)) {
        activePlayerInstance = target
        break
      }
      target = target.parentNode
    }
  }

  // 初始化
  function init() {
    // 劫持attachShadow方法
    hackAttachShadow()

    // 初始化mediaCore
    mediaCore.init(function (mediaElement) {
      // 当检测到新的媒体元素时的处理
      if (isVideoElement(mediaElement)) {
        // 可以在这里添加额外的处理逻辑
      }
    })

    // 监听键盘事件
    document.addEventListener('keydown', handleKeyDown, true)

    // 监听消息事件
    window.addEventListener('message', handleMessage, false)

    // 监听鼠标事件
    document.addEventListener('mouseover', handleMouseOver, true)

    // 定期更新媒体元素列表
    setInterval(function () {
      mediaElementList = getPlayerList()
    }, 1000)

    console.log('视频截图增强脚本已加载，按Shift+S进行截图')
  }

  // 执行初始化
  init()
})()
