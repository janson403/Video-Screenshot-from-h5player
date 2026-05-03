# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [202605041220] - 2026-05-04

### Changed

- Removed hardcoded `KEY_MAP` object (60+ lines). Shortcut matching now relies entirely on the browser's native `event.key` property, making the code smaller and more maintainable.
  移除硬编码的 `KEY_MAP` 对象（60+ 行），快捷键匹配完全依赖浏览器原生 `event.key` 属性，代码更精简、更易维护。

- Updated "How to use" help text in Tampermonkey menu with detailed troubleshooting for popup blocking and CORS restrictions.
  更新油猴菜单「如何使用」帮助文本，补充了弹窗拦截和 CORS 限制的详细排查指引。

### Fixed

- Hotkey recorder no longer triggers a screenshot when re-binding the same key — the global shortcut is now temporarily disabled while the recorder overlay is open.
  修复快捷键录制界面中重新绑定相同按键时会触发截图的问题——录制界面打开时暂时禁用全局快捷键监听。

- Removed `clearMenu()` / `rebuildMenu()` / `GM_unregisterMenuCommand` entirely. Menu is now registered **once** via a global `window._vs_menuRegistered` guard, eliminating orphaned menu items after hotkey change. Menu title changed to static "Configure hotkey" since dynamic `(current: X)` display cannot be reliably updated without `GM_unregisterMenuCommand`.
  完全移除 `clearMenu()` / `rebuildMenu()` / `GM_unregisterMenuCommand`。菜单通过全局 `window._vs_menuRegistered` 标记只注册一次，消除换快捷键后遗留"孤儿"菜单项的问题。菜单标题改为静态的"Configure hotkey"，不再显示当前快捷键——因为 `GM_unregisterMenuCommand` 不可靠，无法安全地动态更新标题。

## [202604301545] - 2026-04-30

### Changed

- Changed screenshot preview background color to black for better visual experience.
  截图预览界面背景颜色改为黑色，提升预览观感。

## [202604301543] - 2026-04-30

### Fixed

- blob URL protection: skip `blob:` protocol videos during force reload and CORS error recovery to avoid breaking MSE streaming player internal state.
  blob URL 防护：强制 reload 和 CORS 错误恢复时均跳过 `blob:` 协议的视频，避免破坏 MSE 流媒体播放器内部状态。

- Fixed race condition with `_corsRecovering` flag: move the flag setting after recovery operation, add `loadstart` event listener to reset the flag, allowing retrigger on source change.
  修复 `_corsRecovering` 标记的竞态问题：将标记移至恢复操作之后设置，并新增 `loadstart` 事件监听以重置标记，支持视频换源后再次触发恢复流程。

### Changed

- Refactored CORS error recovery: use native setter (`nativeSet.call`) to bypass `video.src` hijacking, preventing automatic re-adding of `crossorigin` attribute.
  重构 CORS 错误恢复逻辑：使用原生 setter（`nativeSet.call`）绕过 `video.src` 劫持，确保恢复时不会自动重新添加 `crossorigin` 属性。

- Removed early return guard for `_corsRecovering` in error event, replaced with `blob:` check + nativeSet fallback for more reliable recovery.
  移除 `error` 事件中 `_corsRecovering` 的提前返回 guard，改用 `blob:` 检查 + nativeSet 兜底，使恢复流程更可靠。

## [202604300205] - 2026-04-30

### Changed

- Optimized video selection priority — viewport visibility is a hard requirement: invisible videos (scrolled out of view or too small) are eliminated. Visible video priority: hovered > playing (area doubled) > largest area.
  优化视频选择优先级，视口可见性是硬性门槛：不可见（滚动出视口或宽/高太小）的视频直接被淘汰，不参与评分。可见视频中优先级排序为：鼠标悬停 > 正在播放（面积翻倍） > 面积最大。

## [202604292335] - 2026-04-29

### Added

- Introduced `shadowHostMap` (WeakMap) for O(1) host → shadowRoot reverse lookup, replacing linear search.
  引入 `shadowHostMap`（WeakMap），实现 host → shadowRoot O(1) 反向查找，替代遍历搜索。

- Cache first video reference per shadowRoot as `_vsVideo`, prefer cache on hover (avoid `querySelector`), validate with `isConnected` to prevent stale refs in SPA scenarios.
  为每个 shadowRoot 缓存首视频引用到 `_vsVideo`，hover 时优先使用缓存（免 `querySelector`），同时以 `isConnected` 校验避免 SPA 场景下引用失效。

- `hackAttachShadow` and `addShadowRoot` event handlers now register WeakMap mapping and cache `_vsVideo` synchronously.
  `hackAttachShadow` 和 `addShadowRoot` 事件处理器同步注册 WeakMap 映射 + 缓存 `_vsVideo`。

### Changed

- Refactored `handleMouseOver` into a 3-layer hover strategy: parentNode fast path + `_vsVideo` cache hit → composedPath forward match → composedPath reverse host lookup across closed shadow boundaries.
  重构 `handleMouseOver` 为三层悬停策略：parentNode 快速路径 + `_vsVideo` 缓存命中 → composedPath 正向直击视频 → composedPath 反向 host 查找跨越 closed shadow 边界。

### Fixed

- `scanVideoElements` now also deletes `shadowHostMap` entries when cleaning up disconnected shadowRoots.
  `scanVideoElements` 清理已断开 shadowRoot 时同步删除 `shadowHostMap` 条目。

## [202604292252] - 2026-04-29

### Added

- Introduced `SUPPORTED_VIDEO_TAGS` and `SUPPORTED_SELECTOR` constants for centralized video tag management and easier third-party tag extension.
  引入 `SUPPORTED_VIDEO_TAGS` 和 `SUPPORTED_SELECTOR` 常量，集中管理视频标签，便于扩展更多第三方视频标签。

### Changed

- `isVideoElement` / `scanVideoElements` now use generalized checks, switching from hardcoded `bwp-video` to dynamic `SUPPORTED_VIDEO_TAGS` matching.
  `isVideoElement` / `scanVideoElements` 等函数改用泛化判断，非标准视频标签从硬编码 `bwp-video` 改为 `SUPPORTED_VIDEO_TAGS` 动态匹配。

- Refactored `window._shadowDomList_` and `window._vs_hack_shadow_` to module-internal variables to reduce global namespace pollution.
  重构 `window._shadowDomList_` 和 `window._vs_hack_shadow_` 为模块内部变量，减少全局命名空间污染。

- Added 100ms debounce to MutationObserver scans to reduce performance overhead from frequent DOM changes.
  MutationObserver 扫描增加 100ms 防抖（`debounce`），降低频繁 DOM 变化的性能开销。

## [202604292132] - 2026-04-29

### Added

- Added hotkey recorder UI — record key combinations directly in an overlay on the page.
  新增快捷键录制 UI，直接在页面浮层中录制组合键。

- Save native function references (native object) to avoid conflicts from multiple hijackings.
  保存原生函数引用（native 对象），避免多次劫持造成的冲突。

- Aggressive CORS strategy: auto-remove `crossorigin` attribute on load failure and retry.
  CORS 激进策略：加载失败时自动移除 `crossorigin` 属性并重试恢复。

- Auto-pause video after screenshot (enabled by default) for easier frame freezing.
  截图后自动暂停视频（默认开启），便于定格画面。

- Tampermonkey menu now supports dynamic updates and unregistration (`GM_unregisterMenuCommand`).
  油猴菜单支持动态更新和取消注册（`GM_unregisterMenuCommand`）。

- Clean up event listeners and menu on `beforeunload`.
  页面卸载（`beforeunload`）时清理事件监听器和菜单。

### Changed

- Optimized video search to prefer the largest visible video in viewport.
  优化视频查找逻辑，优先选择视口中面积最大的可见视频。

- Optimized config persistence, unified key name to `vs_screenshot_config`.
  配置文件持久化存储优化，统一使用 `vs_screenshot_config` 键名。

### Fixed

- Improved Shadow DOM handling with cleanup of disconnected shadow roots.
  更完善的 Shadow DOM 处理，清理已断开连接的 shadow root。

## [202604281355] - 2026-04-28

### Added

- Added custom hotkey configuration via Tampermonkey menu.
  新增自定义快捷键设置功能，从油猴菜单中进行设置。

## [1.2]

### Added

- Use MutationObserver to monitor shadow DOM changes.
  使用 MutationObserver 监听 shadow DOM 变化。

## [1.1]

### Changed

- Changed `crossorigin` setup timing to after video load completes.
  将 `crossorigin` 的时机改为在视频加载完成后设置。

## [1.0]

### Added

- Initial release, supports shadow DOM and cross-origin iframe screenshots.
  初始版本，支持 shadow DOM 和 iframe 跨域截图。
