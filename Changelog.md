# Changelog

## 202604292335

- 引入 `shadowHostMap`（WeakMap），实现 host→shadowRoot O(1) 反向查找，替代遍历搜索。
- 重构 `handleMouseOver` 为三层悬停策略：parentNode 快速路径 + `_vsVideo` 缓存命中 → composedPath 正向直击视频 → composedPath 反向 host 查找跨越 closed shadow 边界。
- 为每个 shadowRoot 缓存首视频引用到 `_vsVideo`，hover 时优先使用缓存（免 `querySelector`），同时以 `isConnected` 校验避免 SPA 场景下引用失效。
- `scanVideoElements` 清理已断开 shadowRoot 时同步删除 `shadowHostMap` 条目。
- `hackAttachShadow` 和 `addShadowRoot` 事件处理器同步注册 WeakMap 映射 + 缓存 `_vsVideo`。
- 优先选择鼠标悬停的视频，随后是正在播放中的视频，最后是视口中面积最大的视频。

## 202604292252

- 引入 `SUPPORTED_VIDEO_TAGS` 和 `SUPPORTED_SELECTOR` 常量，集中管理视频标签，便于扩展更多第三方视频标签。
- `isVideoElement` / `scanVideoElements` 等函数改用泛化判断，非标准视频标签从硬编码 `bwp-video` 改为 `SUPPORTED_VIDEO_TAGS` 动态匹配。
- 重构 `window._shadowDomList_` 和 `window._vs_hack_shadow_` 为模块内部变量，减少全局命名空间污染。
- MutationObserver 扫描增加 100ms 防抖（`debounce`），降低频繁 DOM 变化的性能开销。

## 202604292132

- 新增快捷键录制 UI，直接在页面浮层中录制组合键。
- 保存原生函数引用（native 对象），避免多次劫持造成的冲突。
- CORS 激进策略：加载失败时自动移除 `crossorigin` 属性并重试恢复。
- 截图后可选自动暂停视频（默认开启），便于定格画面。
- 优化视频查找逻辑，优先选择视口中面积最大的可见视频。
- 油猴菜单支持动态更新和取消注册（`GM_unregisterMenuCommand`）。
- 页面卸载（`beforeunload`）时清理事件监听器和菜单。
- 配置文件持久化存储优化，统一使用 `vs_screenshot_config` 键名。
- 更完善的 Shadow DOM 处理，清理已断开连接的 shadow root。

## 202604281355

- 新增自定义快捷键设置功能，需要从油猴菜单中进行设置。

## 1.2

- 使用MutationObserver监听shadow dom变化。

## 1.1

- 将crossorigin的时机改为在视频加载完成后设置。

## 1.0

- 初始版本，支持shadow dom和iframe跨域。
