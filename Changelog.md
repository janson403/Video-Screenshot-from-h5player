# Changelog

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
