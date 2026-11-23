# Tab Network Governor

[English](README.md)

**Tab Network Governor（TNG）** 是一个面向长期驻留 Web App 标签页的浏览器侧网络/生命周期治理工具。

现代 SPA/PWA 即使已经处于后台，也可能继续轮询、同步、发送遥测、失败重试或维持实时连接。当浏览器长期打开大量标签时，这些“每个标签一点点”的后台活动会被放大成 API 限流、额外网络流量、CPU/RAM 压力与重试风暴。

TNG 把策略从“每个标签都是完整在线客户端”改成“前台标签正常联网；后台标签按策略冻结/阻断”。

本项目是**站点无关**的非官方工具，与任何具体平台厂商均无隶属或背书关系。

## 三种实现

| 能力 | Full 扩展 | Lite 扩展 | Portable Userscript |
|---|:---:|:---:|:---:|
| 按 Site Pattern 显式启用 | ✅ | ✅ | ✅ |
| 后台 `fetch()` 软冻结 | ✅ | — | ✅ |
| 后台 XHR 软冻结 | ✅ | — | ✅ |
| 后台 `sendBeacon()` 吞掉 | ✅ | — | ✅ |
| 排队 GET/HEAD 去重 | ✅ | — | ✅ |
| 回前台错峰恢复 | ✅ | — | ✅ |
| 浏览器网络层硬阻断 | ✅ | ✅ | — |
| WebSocket/WebTransport/ping 漏网兜底 | ✅ | ✅ | — |
| DNR 解锁 ACK 后才恢复请求 | ✅ | — | — |
| 无法安装外部扩展时的兼容方案 | — | — | ✅* |

`*` 需要目标浏览器/客户端能够运行 Userscript 管理器。

### Full Extension（推荐）

采用双层结构：MAIN world 的 Soft Freeze 让后台 `fetch/XHR` 等待而不是报错，减少本地重试风暴；DNR Hard Firewall 在浏览器网络层兜底，继续挡住绕过页面 Hook 的 runtime 流量。

从后台切回前台时，页面必须先拿到“DNR 已实际解除”的 ACK，再释放积压请求。

### Lite Extension

只使用 DNR。代码更小、侵入更低，但页面可能看到网络失败并自行重试。


### Site Pattern 语义

配置不会替用户补协议或扩大范围：

- `example.com` → 精确域名，同时匹配 HTTP + HTTPS；
- `https://example.com` → 仅 HTTPS；
- `*.example.com` → 仅子域，同时匹配 HTTP + HTTPS；
- `https://*.example.com` → 仅 HTTPS 子域；
- `example.com:8080` → 两种协议，但只治理 8080 端口。

路径、query 与 fragment 不会被静默裁掉。详细规则见 `docs/site-patterns.md`。

### Portable Userscript

用于无法安装常规扩展的环境。它保留 Soft Freeze 的核心思想，但没有浏览器网络层 DNR，因此无法保证覆盖 Worker、WebSocket、预先缓存的原生 API 引用等旁路。

## 快速使用

### Chromium Full/Lite 扩展

1. 打开 `chrome://extensions`；
2. 打开开发者模式；
3. 加载 `extension/full` 或 `extension/lite`；
4. 打开需要治理的网站；
5. 点击工具栏 TNG 图标，选择 **Enable on this site**。

TNG 默认**不管理任何站点**，权限按用户声明的 Site Pattern 请求。

### Portable Userscript

1. 安装 `userscript/tab-network-governor.user.js`；
2. 打开目标站点；
3. 从脚本管理器菜单执行 **TNG: enable exact current site**；
4. 刷新页面一次，让 Hook 从 `document-start` 生效。

为了保持站点无关，Userscript 元数据会匹配 HTTP(S) 页面，但未被任何 Site Pattern 命中的页面会立即退出，不安装 Hook。

## 核心行为

```text
visible
  → 正常联网

hidden
  → Full/Userscript：fetch/XHR 软冻结
  → Full：DNR 兜底硬阻断
  → Lite：DNR 直接硬阻断

hidden → visible（Full）
  → 先撤 DNR
  → 等 ACK
  → 再逐步恢复积压请求
```

前台已经发出去、正在运行的请求不会因为切到后台就被强制中止。

## 安全边界

- 按 Site Pattern 显式启用，默认不治理任何站点；
- 初始化状态无法确认时 fail-open，优先避免误杀前台；
- 用户主动切到某个标签时，扩展会把该 tab 从 DNR hidden 集合中移除，作为第二道 fail-open；
- 不读取/上传 Cookie、Authorization Header、页面正文、Prompt 或响应体；
- 不加载远程代码。

## 注意

有些应用确实需要后台联网，例如通话、告警、实时监控、上传、协作或媒体播放。对这些站点启用 aggressive freeze 会有意暂停后台实时行为。

## 项目来源

这套机制最初来自对几十个长期驻留的现代 AI Web App 标签的真实调试：后台同步被多标签放大并触发 API 限流，随后逐步演化出 DNR、Soft Freeze 与 ACK 恢复机制。具体平台只是首个测试案例，并不是架构依赖。

## 开源与隐私

- 隐私说明：[`PRIVACY.md`](PRIVACY.md)
- 权限说明：[`docs/permissions.md`](docs/permissions.md)
- 测试矩阵：[`docs/testing.md`](docs/testing.md)
- 贡献指南：[`CONTRIBUTING.md`](CONTRIBUTING.md)
- 发布检查表：[`docs/release-checklist.md`](docs/release-checklist.md)

TNG 不包含项目方遥测，不上传浏览历史、页面正文、Cookie、Authorization Header、凭据或响应体。

## License

MIT。
