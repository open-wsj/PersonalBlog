---
title: "GNOME 50 (Wayland) 桌面网速悬浮窗：TopHat 部署实录与三个踩坑"
abbrlink: gnome-50-wayland-zhuo-mian-wang-su-xuan-fu-chuang-tophat-bu
date: "2026-11-03 20:05:52"
categories:
    - "Linux 桌面"
tags: []
desc: "想在 Ubuntu 的 GNOME 桌面上常驻一个「网速悬浮窗」：不占顶栏、不打断工作、全屏看视频或跑下载时也能瞄一眼实时上下行速率。本文记录在一台 GNOME Shell 50.1 +…"
---
### 背景

想在 Ubuntu 的 GNOME 桌面上常驻一个「网速悬浮窗」：不占顶栏、不打断工作、全屏看视频或跑下载时也能瞄一眼实时上下行速率。

本文记录在一台 GNOME Shell 50.1 + Wayland 的机器上部署 TopHat 扩展的完整过程，包括两个真正卡住人的坑：** 缺少 GTop 绑定 ** 和 ** 用户扩展总开关被关闭 ** 。

### 环境

| 项目 | 值 |
| --- | --- |
| 发行版 | Ubuntu（GNOME 桌面） |
| GNOME Shell | 50.1 |
| 会话类型 | Wayland |
| 网卡 | enp4s0（有线）/ 无线网卡各一 |

先确认自己的环境：

```bash
gnome-shell --version
echo $XDG_SESSION_TYPE
```

### 为什么不直接用 conky / nload

-   `nload`、`iftop`、`bmon` 是终端工具，想要「悬浮」只能开一个置顶终端窗口，观感差且占地方。
-   `conky` 在 Wayland 下**无法置顶**：Wayland 不允许客户端自己设置 always-on-top，透明和置顶效果都会失效。
-   GNOME Shell 扩展运行在 Shell 进程内，天然可以叠加在普通窗口和全屏窗口之上，是 Wayland 下做悬浮 HUD 的正路。

### 选型：TopHat

TopHat 是一个可拖动的悬浮面板，显示 CPU、内存、磁盘、网络速率，支持 GNOME 45–50，处于「Active」状态，下载量约 29 万。

它默认就能浮在桌面一角，只保留 Network 项就是纯粹的网速悬浮窗。

### 部署步骤

#### 1. 下载并安装扩展

扩展页：[https://extensions.gnome.org/extension/5219/tophat/](https://extensions.gnome.org/extension/5219/tophat/)

用命令行安装（注意 URL 里的 `version_tag` 对应版本号，可从扩展页的 download 链接获得）：

```bash
curl -L -o /tmp/tophat.zip \
  "https://extensions.gnome.org/download-extension/tophat@fflewddur.github.io.shell-extension.zip?version_tag=69837"

gnome-extensions install --force /tmp/tophat.zip
```

确认解压位置：

```bash
ls ~/.local/share/gnome-shell/extensions/
# tophat@fflewddur.github.io
```

#### 2. 补上 GTop 依赖（坑一）

TopHat 通过 GTop 读取系统指标。系统里通常已有 `libgtop-2.0-11`，但**缺少 GObject Introspection 绑定**，GJS 里 `import GTop` 会直接失败，表现是扩展状态一直停在 `INITIALIZED`，`enable` 命令不报错但也不生效。

```bash
sudo apt install gir1.2-gtop-2.0
```

验证 typelib 是否到位：

```bash
ls /usr/lib/x86_64-linux-gnu/girepository-1.0/ | grep -i gtop
# GTop-2.0.typelib
```

#### 3. 启用扩展（坑二）

```bash
gnome-extensions enable tophat@fflewddur.github.io
```

如果这时还是：

```
已启用: 否
状态: INITIALIZED
```

先别急着重启，查这个开关：

```bash
gsettings get org.gnome.shell disable-user-extensions
```

我遇到的实际情况是返回 `true` —— **GNOME 的「用户扩展」总开关处于关闭状态**。这个开关一关，所有第三方扩展（不管是否写进 `enabled-extensions`）都会被 Shell 整体跳过，状态永远停在 INITIALIZED。

打开它：

```bash
gsettings set org.gnome.shell disable-user-extensions false
```

打开后无需重启 Shell，扩展会立即被重新评估。验证：

```bash
gnome-extensions info tophat@fflewddur.github.io | grep -E "已启用|状态"
```

期望：

```
已启用: 是
状态: ACTIVE
```

### 关于「开机自启动」

GNOME 扩展**不需要**额外的自启动配置，也不要去写 `~/.config/autostart` 或 systemd unit。

-   启用状态保存在 gsettings：`org.gnome.shell enabled-extensions`
-   每次登录时 GNOME Shell 启动，会读取该列表并自动加载扩展
-   效果等同于开机自启，且是持久化的

```bash
gsettings get org.gnome.shell enabled-extensions
# ['...', 'tophat@fflewddur.github.io']
```

### 使用与调优

右键悬浮面板进入设置，可以：

-   调整面板位置（左 / 右 / 可拖动）
-   调整不透明度，让它更「小部件」化
-   只勾选 Network，关掉 CPU / 内存 / 磁盘，就得到纯网速悬浮窗

### 排错清单

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `gnome-extensions enable` 报「扩展不存在」 | 当前 Shell 会话还没扫描到新装的扩展 | Wayland 下注销重登录一次 |
| 状态一直 `INITIALIZED`，`enable` 不报错 | 缺 `gir1.2-gtop-2.0` | `sudo apt install gir1.2-gtop-2.0` |
| 装好依赖后仍不启用 | `disable-user-extensions` 为 `true` | `gsettings set org.gnome.shell disable-user-extensions false` |
| 所有第三方扩展突然集体消失 | Shell 崩溃后进入安全模式，自动关闭用户扩展 | 同上一条，检查该开关 |
| 扩展加载报错 | JS 异常 | `journalctl _COMM=gnome-shell -b -o cat |

#### 一个容易误解的点

「挂起后重新登录」不等于「注销重登录」。系统挂起唤醒只是解锁，GNOME Shell 进程并没有重启，新装的扩展依然不会被加载。要真正让 Shell 重新扫描扩展，必须**注销并重新登录**：

```bash
gnome-session-quit --logout --no-prompt
```

Wayland 下 `Alt+F2` 输入 `r` 重启 Shell 的方式不可用（仅 X11 有效）。

### 卸载与回退

```bash
gnome-extensions disable tophat@fflewddur.github.io
rm -rf ~/.local/share/gnome-shell/extensions/tophat@fflewddur.github.io
```

若不需要 GTop 绑定，可一并移除（注意别误删 `libgtop-2.0-11`，部分系统组件可能依赖它）：

```bash
sudo apt remove gir1.2-gtop-2.0
```

### 小结

三个关键点：

1.  **TopHat 需要 `gir1.2-gtop-2.0`**，只装 `libgtop` 运行库不够。
2.  **`disable-user-extensions` 是总闸**，它为 `true` 时所有第三方扩展静默失效，且不影响扩展列表的展示，极具迷惑性。
3.  **GNOME 扩展天生随登录自启**，无需任何额外的自启动配置；改完扩展只需重新登录，不需要重启整机。

### 参考

-   TopHat 扩展页：[https://extensions.gnome.org/extension/5219/tophat/](https://extensions.gnome.org/extension/5219/tophat/)
-   TopHat 源码：[https://github.com/fflewddur/tophat](https://github.com/fflewddur/tophat)
-   GNOME Shell 扩展文档：[https://gjs.guide/extensions/](https://gjs.guide/extensions/)
