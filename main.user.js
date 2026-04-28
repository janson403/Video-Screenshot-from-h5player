// ==UserScript==
// @name         Video Screenshot from h5player
// @namespace    https://gitee.com/jason403/Video-Screenshot-from-h5player/
// @version      202604281355
// @description  按下自定义快捷键进行视频截图，支持shadow dom和iframe跨域
// @author       Pingyi ZHENG
// @match        *://*/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @downloadURL  https://raw.giteeusercontent.com/jason403/Video-Screenshot-from-h5player/raw/master/main.user.js
// @updateURL    https://raw.giteeusercontent.com/jason403/Video-Screenshot-from-h5player/raw/master/main.user.js
// ==/UserScript==

;(function () {
  'use strict'

  // 支持的视频标签类型
  const supportMediaTags = ['video', 'bwp-video']
  // 存储所有Shadow DOM根节点的列表
  let shadowDomList = []
  // 当前活跃的视频播放器实例
  let activePlayerInstance = null

  // 快捷键配置
  let shortcutConfig = {
    key: GM_getValue('videoCapture_key', 's'),
    shiftKey: GM_getValue('videoCapture_shiftKey', true),
    ctrlKey: GM_getValue('videoCapture_ctrlKey', false),
    altKey: GM_getValue('videoCapture_altKey', false),
  }

  /**
   * 设置视频元素的CORS属性，解决跨域截图问题
   * @param {HTMLVideoElement} video - 视频元素
   */
  function setVideoCors(video) {
    // 参数校验：非视频元素或已设置过CORS则直接返回
    if (!video || !(video instanceof HTMLVideoElement)) return
    if (video._corsSet) return
    video._corsSet = true

    // 添加crossorigin属性以允许跨域访问视频帧
    if (!video.hasAttribute('crossorigin')) {
      video.setAttribute('crossorigin', 'anonymous')
    }

    // 如果视频已加载，重新加载以应用CORS设置
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

  /**
   * 劫持HTMLVideoElement的setAttribute方法
   * 当设置src属性时自动添加crossorigin属性
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
   * 劫持HTMLMediaElement的src属性setter
   * 通过属性赋值方式设置src时自动添加crossorigin
   */
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

  /**
   * DOM元素就绪监听器
   * 使用MutationObserver监听DOM变化，当匹配的元素出现时执行回调
   * @param {string} selector - CSS选择器
   * @param {Function} fn - 回调函数
   * @param {ShadowRoot} [shadowRoot] - Shadow DOM根节点（可选）
   * @returns {MutationObserver} - 返回观察器实例
   */
  function ready(selector, fn, shadowRoot) {
    const win = window
    const doc = shadowRoot || win.document
    const MutationObserver = win.MutationObserver || win.WebKitMutationObserver
    let observer

    // 检查并处理已存在的匹配元素
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

    // 创建MutationObserver监听DOM变化
    if (!observer) {
      observer = new MutationObserver(check)
      observer.observe(shadowRoot || doc.documentElement, {
        childList: true,
        subtree: true,
      })
    }

    return observer
  }

  /**
   * 劫持Element.prototype.attachShadow方法
   * 将所有closed模式的Shadow DOM强制改为open模式，以便访问其中的视频元素
   */
  function hackAttachShadow() {
    if (window._hasHackAttachShadow_) return
    try {
      shadowDomList = []
      window._shadowDomList_ = shadowDomList

      // 保存原始方法
      Element.prototype._attachShadow = Element.prototype.attachShadow
      Element.prototype.attachShadow = function () {
        const arg = arguments
        const isClosed = arg[0] && arg[0].mode === 'closed'

        // 将closed模式强制改为open模式
        if (arg[0] && arg[0].mode) {
          arg[0].mode = 'open'
        }
        const shadowRoot = this._attachShadow.apply(this, arg)
        shadowDomList.push(shadowRoot)
        shadowRoot._shadowHost = this

        // 触发自定义事件通知Shadow DOM创建
        const shadowEvent = new window.CustomEvent('addShadowRoot', {
          shadowRoot,
          detail: { shadowRoot, message: 'addShadowRoot', time: new Date() },
          bubbles: true,
          cancelable: true,
        })
        document.dispatchEvent(shadowEvent)

        // 如果原本是closed模式，伪装成closed（外部访问shadowRoot返回null）
        if (isClosed) {
          Object.defineProperty(this, 'shadowRoot', {
            get() {
              return null
            },
          })
        }

        // 在新创建的Shadow DOM中监听视频元素
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

  /**
   * 判断元素是否为视频元素
   * @param {HTMLElement} element - 待判断的元素
   * @returns {boolean}
   */
  function isVideoElement(element) {
    return (
      element instanceof HTMLVideoElement ||
      element.HTMLVideoElement === true ||
      (element.tagName && element.tagName.toLowerCase() === 'bwp-video')
    )
  }

  /**
   * 判断目标元素是否为可编辑区域（避免在输入时触发截图）
   * @param {HTMLElement} target - 目标元素
   * @returns {boolean}
   */
  function isEditableTarget(target) {
    return (
      target.isContentEditable ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT'
    )
  }

  /**
   * 判断当前页面是否在iframe中
   * @returns {boolean}
   */
  function isInIframe() {
    return window.self !== window.top
  }

  /**
   * 判断元素是否在视口中
   * @param {HTMLElement} element - 待判断的元素
   * @returns {boolean}
   */
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

  /**
   * 获取所有视频播放器列表（包括常规DOM和Shadow DOM）
   * @returns {HTMLElement[]} - 视频元素数组
   */
  function getPlayerList() {
    const list = []

    // 在指定上下文中查找视频元素
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

    // 在常规DOM中查找
    findPlayer(document)

    // 在所有Shadow DOM中查找
    if (shadowDomList && shadowDomList.length > 0) {
      shadowDomList.forEach(function (shadowRoot) {
        findPlayer(shadowRoot)
      })
    }

    return list
  }

  /**
   * 获取当前活动的视频播放器
   * 优先返回鼠标悬停的播放器，否则返回视口中最大的视频
   * @returns {HTMLElement|null}
   */
  function getCurrentPlayer() {
    // 优先检查缓存的活跃播放器
    if (activePlayerInstance && isVideoElement(activePlayerInstance)) {
      try {
        if (document.contains(activePlayerInstance)) {
          return activePlayerInstance
        }
      } catch (e) {}
    }

    const mediaList = getPlayerList().filter(isVideoElement)
    if (mediaList.length === 0) return null

    // 优先选择视口中的视频
    const visibleMedia = mediaList.filter(isInViewPort)
    if (visibleMedia.length > 0) {
      // 返回视口中面积最大的视频
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

    // 返回最后找到的视频作为后备
    return mediaList[mediaList.length - 1]
  }

  /**
   * 在新窗口中预览截图
   * @param {HTMLCanvasElement} canvas - 包含截图的canvas元素
   */
  function preview(canvas) {
    canvas.style = 'max-width:100%'
    const previewPage = window.open('', '_blank')
    previewPage.document.title = `capture preview`
    previewPage.document.body.style.textAlign = 'center'
    previewPage.document.body.appendChild(canvas)
  }

  /**
   * 执行视频截图
   * @param {HTMLVideoElement} video - 视频元素
   * @returns {HTMLCanvasElement|false} - 返回canvas元素或false
   */
  function capture(video) {
    if (!video) return false
    // readyState >= 2 表示至少有一帧可用于截图
    if (video.readyState < 2) return false

    try {
      const canvas = document.createElement('canvas')
      // 使用视频的实际尺寸或后备尺寸
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

  /**
   * 检查是否匹配自定义快捷键
   * @param {KeyboardEvent} event - 键盘事件
   * @returns {boolean}
   */
  function matchShortcut(event) {
    const keyMatch = event.key.toLowerCase() === shortcutConfig.key.toLowerCase()
    const shiftMatch = event.shiftKey === shortcutConfig.shiftKey
    const ctrlMatch = event.ctrlKey === shortcutConfig.ctrlKey
    const altMatch = event.altKey === shortcutConfig.altKey
    return keyMatch && shiftMatch && ctrlMatch && altMatch
  }

  /**
   * 获取当前快捷键显示文本
   * @returns {string}
   */
  function getShortcutText() {
    const parts = []
    if (shortcutConfig.ctrlKey) parts.push('Ctrl')
    if (shortcutConfig.shiftKey) parts.push('Shift')
    if (shortcutConfig.altKey) parts.push('Alt')
    parts.push(shortcutConfig.key.toUpperCase())
    return parts.join(' + ')
  }

  /**
   * 显示快捷键设置弹窗
   */
  function showShortcutSettings() {
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 99999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `

    const dialog = document.createElement('div')
    dialog.style.cssText = `
      background: #fff;
      border-radius: 12px;
      padding: 24px;
      width: 90%;
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `

    const title = document.createElement('h2')
    title.textContent = '设置截图快捷键'
    title.style.cssText = `
      margin: 0 0 20px 0;
      font-size: 18px;
      color: #333;
      text-align: center;
    `

    const currentShortcut = document.createElement('p')
    currentShortcut.textContent = `当前快捷键: ${getShortcutText()}`
    currentShortcut.style.cssText = `
      text-align: center;
      margin: 0 0 20px 0;
      color: #666;
      font-size: 14px;
    `

    const container = document.createElement('div')
    container.style.cssText = 'display: flex; flex-direction: column; gap: 12px;'

    // Ctrl键选项
    const ctrlDiv = document.createElement('div')
    ctrlDiv.style.cssText = 'display: flex; align-items: center; gap: 10px;'
    const ctrlCheckbox = document.createElement('input')
    ctrlCheckbox.type = 'checkbox'
    ctrlCheckbox.checked = shortcutConfig.ctrlKey
    ctrlCheckbox.style.cssText = 'width: 18px; height: 18px;'
    const ctrlLabel = document.createElement('label')
    ctrlLabel.textContent = 'Ctrl'
    ctrlLabel.style.cssText = 'font-size: 14px; color: #333;'
    ctrlDiv.appendChild(ctrlCheckbox)
    ctrlDiv.appendChild(ctrlLabel)

    // Shift键选项
    const shiftDiv = document.createElement('div')
    shiftDiv.style.cssText = 'display: flex; align-items: center; gap: 10px;'
    const shiftCheckbox = document.createElement('input')
    shiftCheckbox.type = 'checkbox'
    shiftCheckbox.checked = shortcutConfig.shiftKey
    shiftCheckbox.style.cssText = 'width: 18px; height: 18px;'
    const shiftLabel = document.createElement('label')
    shiftLabel.textContent = 'Shift'
    shiftLabel.style.cssText = 'font-size: 14px; color: #333;'
    shiftDiv.appendChild(shiftCheckbox)
    shiftDiv.appendChild(shiftLabel)

    // Alt键选项
    const altDiv = document.createElement('div')
    altDiv.style.cssText = 'display: flex; align-items: center; gap: 10px;'
    const altCheckbox = document.createElement('input')
    altCheckbox.type = 'checkbox'
    altCheckbox.checked = shortcutConfig.altKey
    altCheckbox.style.cssText = 'width: 18px; height: 18px;'
    const altLabel = document.createElement('label')
    altLabel.textContent = 'Alt'
    altLabel.style.cssText = 'font-size: 14px; color: #333;'
    altDiv.appendChild(altCheckbox)
    altDiv.appendChild(altLabel)

    // 按键输入
    const keyDiv = document.createElement('div')
    keyDiv.style.cssText = 'display: flex; flex-direction: column; gap: 6px;'
    const keyLabel = document.createElement('label')
    keyLabel.textContent = '按键'
    keyLabel.style.cssText = 'font-size: 14px; color: #333;'
    const keyInput = document.createElement('input')
    keyInput.type = 'text'
    keyInput.value = shortcutConfig.key
    keyInput.maxLength = 1
    keyInput.style.cssText = `
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 16px;
      text-align: center;
      text-transform: uppercase;
    `

    const hint = document.createElement('p')
    hint.textContent = '提示：请输入单个字母或数字键'
    hint.style.cssText = 'font-size: 12px; color: #999; margin: 4px 0 0 0;'

    keyDiv.appendChild(keyLabel)
    keyDiv.appendChild(keyInput)
    keyDiv.appendChild(hint)

    container.appendChild(ctrlDiv)
    container.appendChild(shiftDiv)
    container.appendChild(altDiv)
    container.appendChild(keyDiv)

    // 按钮区域
    const buttons = document.createElement('div')
    buttons.style.cssText = 'display: flex; gap: 12px; margin-top: 20px;'

    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = '取消'
    cancelBtn.style.cssText = `
      flex: 1;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: #fff;
      color: #666;
      font-size: 14px;
      cursor: pointer;
    `
    cancelBtn.addEventListener('click', () => document.body.removeChild(overlay))

    const saveBtn = document.createElement('button')
    saveBtn.textContent = '保存'
    saveBtn.style.cssText = `
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 6px;
      background: #007bff;
      color: #fff;
      font-size: 14px;
      cursor: pointer;
    `
    saveBtn.addEventListener('click', () => {
      const newKey = keyInput.value.toLowerCase()
      if (!newKey.match(/^[a-zA-Z0-9]$/)) {
        alert('请输入有效的按键（字母或数字）')
        return
      }

      shortcutConfig = {
        key: newKey,
        shiftKey: shiftCheckbox.checked,
        ctrlKey: ctrlCheckbox.checked,
        altKey: altCheckbox.checked,
      }

      GM_setValue('videoCapture_key', shortcutConfig.key)
      GM_setValue('videoCapture_shiftKey', shortcutConfig.shiftKey)
      GM_setValue('videoCapture_ctrlKey', shortcutConfig.ctrlKey)
      GM_setValue('videoCapture_altKey', shortcutConfig.altKey)

      alert(`快捷键已设置为: ${getShortcutText()}`)
      document.body.removeChild(overlay)
    })

    buttons.appendChild(cancelBtn)
    buttons.appendChild(saveBtn)

    dialog.appendChild(title)
    dialog.appendChild(currentShortcut)
    dialog.appendChild(container)
    dialog.appendChild(buttons)
    overlay.appendChild(dialog)

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) document.body.removeChild(overlay)
    })

    document.body.appendChild(overlay)
  }

  /**
   * 键盘事件处理函数
   * 监听自定义快捷键触发截图
   */
  function handleKeyDown(event) {
    if (isEditableTarget(event.target)) return
    if (matchShortcut(event)) {
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

  /**
   * 跨页面消息处理函数
   * 处理来自iframe或父页面的截图请求
   */
  function handleMessage(event) {
    if (event.data && event.data.type === 'VIDEO_CAPTURE') {
      const player = getCurrentPlayer()
      if (player) capture(player)
    } else if (event.data && event.data.type === 'VIDEO_CAPTURE_REQUEST') {
      const player = getCurrentPlayer()
      if (player) {
        capture(player)
      } else {
        // 继续向子iframe转发请求
        const iframes = document.querySelectorAll('iframe')
        iframes.forEach((iframe) => {
          try {
            iframe.contentWindow.postMessage({ type: 'VIDEO_CAPTURE' }, '*')
          } catch (e) {}
        })
      }
    }
  }

  /**
   * 鼠标悬停事件处理函数
   * 追踪当前鼠标悬停的视频元素
   */
  function handleMouseOver(event) {
    let target = event.target
    while (target) {
      if (isVideoElement(target)) {
        activePlayerInstance = target
        break
      }
      // 检查Shadow DOM中的视频
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

  /**
   * 初始化函数
   * 设置所有必要的劫持、监听器和事件处理
   */
  function init() {
    // 注册油猴菜单命令
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand(`设置截图快捷键 (当前: ${getShortcutText()})`, showShortcutSettings)
    }

    // 劫持attachShadow以支持Shadow DOM
    hackAttachShadow()
    // 劫持视频元素的属性设置方法
    hijackVideoSetAttribute()
    hijackVideoSrcProperty()

    // 监听常规DOM中的视频元素
    supportMediaTags.forEach((tagName) => {
      ready(tagName, function (element) {
        if (element.tagName.toLowerCase() === 'bwp-video') {
          element.HTMLVideoElement = true
        }
        setVideoCors(element)
      })
    })

    // 监听Shadow DOM创建事件
    document.addEventListener('addShadowRoot', function (e) {
      const shadowRoot = e.detail.shadowRoot
      if (shadowRoot && !shadowDomList.includes(shadowRoot)) {
        shadowDomList.push(shadowRoot)
      }
    })

    // 添加全局事件监听器
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('message', handleMessage, false)
    document.addEventListener('mouseover', handleMouseOver, true)
  }

  // 启动脚本
  init()
})()
