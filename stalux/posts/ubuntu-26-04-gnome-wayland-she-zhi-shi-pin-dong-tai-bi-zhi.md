---
title: "Ubuntu 26.04 + GNOME Wayland 设置视频动态壁纸（Hidamari 实测可用）"
abbrlink: ubuntu-26-04-gnome-wayland-she-zhi-shi-pin-dong-tai-bi-zhi
date: "2026-11-11 19:13:39"
categories:
    - "Linux 桌面"
tags: []
desc: "判断能不能用，只看工具是否支持，不要看教程年份GNOME 用 Mutter，不实现 wlr-layer-shell，所以 mpvpaper…"
---
### 一、先说结论

在 Ubuntu 26.04（GNOME Shell 50）+ Wayland 环境下，想要"视频当壁纸"，目前**唯一开箱可用**的方案是 **Hidamari**（Flatpak 安装，官方明确支持 GNOME Wayland）。

网上流传的一大堆教程（mpvpaper、Komorebi、Wallpaper Engine 的 linux-wallpaperengine 移植版、swww、hyprpaper）在你这台机器上**全部无效**，原因不是装错了，而是底层协议不支持，见下一节。

我的环境：

```
Ubuntu 26.04.1 LTS
GNOME Shell 50.1
XDG_SESSION_TYPE=wayland
XDG_CURRENT_DESKTOP=ubuntu:GNOME
```

可用以下命令确认自己的环境：

```bash
cat /etc/os-release | head -n 3
gnome-shell --version
echo $XDG_SESSION_TYPE $XDG_CURRENT_DESKTOP
```

### 二、为什么大部分方案在 GNOME Wayland 上不能用

几乎所有 Linux 视频壁纸工具，本质都是"把视频窗口垫到桌面最底层"，它们依赖 Wayland 的 **wlr-layer-shell** 协议来创建背景层。

而 GNOME 使用的窗口管理器是 **Mutter**，Mutter **不实现 wlr-layer-shell**（这是 wlroots 系合成器的协议）。所以：

-   mpvpaper：只支持 wlroots 合成器（Sway、Hyprland 等）
-   komorebi：KDE/GNOME 时代的 X11 方案
-   hyprpaper：Hyprland 专用
-   linux-wallpaperengine（Wallpaper Engine 的 Linux 移植）：依赖 layer-shell，GNOME 下不显示

还有个坑：用 X11 时代的 xwinwrap 也不行，因为你跑的就是 Wayland 会话。

这一点是选型的关键，判断方法只有一条：**工具是否声明支持 GNOME Wayland**，而不是看它是不是"能放视频"。

### 三、方案对比

| 方案 | 效果 | 是否适用 GNOME Wayland |
| --- | --- | --- |
| Hidamari | mp4 视频循环播放，可静音、可开机自启 | 适用（官方声明支持） |
| GNOME 内置 timed wallpaper | 多张图片按时间渐变切换 | 适用（系统原生） |
| mpvpaper / hyprpaper | 视频壁纸 | 不适用（需 wlr-layer-shell） |
| Komorebi / xwinwrap | 视频壁纸 | 不适用（X11 方案） |
| linux-wallpaperengine | 播放 Wallpaper Engine 资源 | 不适用（需 layer-shell） |

如果你只是想让桌面"动起来"，用系统自带的定时壁纸就够，零安装零占用；如果要真正的视频效果，用 Hidamari。

### 四、安装 Hidamari

Hidamari 已上架 Flathub，直接用 Flatpak 装。注意一个坑：**系统级 flathub 源不能用 `--user` 安装**，如果没加过用户级源，会报错 `未发现用于 "flathub" 的远程引用`。

```bash
# 1. 添加用户级 Flathub 源（已存在则跳过）
flatpak remote-add --user --if-not-exists flathub \
  https://dl.flathub.org/repo/flathub.flatpakrepo

# 2. 安装（会一并拉取 org.gnome.Platform 运行时，体积较大）
flatpak install --user -y flathub io.github.jeffshee.Hidamari

# 3. 启动
flatpak run io.github.jeffshee.Hidamari
```

确认装好了：

```bash
flatpak list --app | grep -i hidamari
flatpak ps
```

### 五、使用：选视频、应用、开机自启

Hidamari 是图形界面程序，**命令行没有传视频文件的参数**，它只支持这几个选项：

```
-p, --pause       启动前延迟若干秒
-b, --background  只启动壁纸，不显示主窗口
-d, --debug       输出调试日志
-r, --reset       重置用户配置
```

所以视频必须在界面里选：

1.  打开 Hidamari，点 **Open**（也可以直接把视频拖进窗口）
2.  在显示器列表里选中你的屏幕（比如 DP-3）
3.  点 **Apply**，壁纸立即生效

右上角菜单 → **Preferences**，建议开启以下几项：

-   **Autostart after login**：开机自动启动，不用每次手动开
-   **Mute**：壁纸不吃声音
-   **Pause when maximized**（默认已开）：有窗口最大化时自动暂停解码，笔记本省电
-   **Static wallpaper blur**（GNOME 专属）：把当前帧模糊后作为静态底图，桌面图标区域更干净

使用要点：

-   关掉设置窗口后**壁纸会继续播放**，这是正常行为，不是没关掉
-   想彻底停止：`flatpak kill io.github.jeffshee.Hidamari`
-   换视频：重新打开窗口，Open 选新文件，再 Apply

### 六、踩坑记录

**1. 配置文件在哪里**

Hidamari 的配置在沙箱内：

```
~/.var/app/io.github.jeffshee.Hidamari/config/glib-2.0/settings/config.json
```

`data_source` 字段记录每个显示器对应的视频路径，`mode` 为 `MODE_NULL` 表示当前没设置视频。启动时终端会打印完整配置，用来判断到底有没有选中视频很方便。

**2. 启动后 `flatpak ps` 显示多个进程**

主进程加若干辅助进程，属正常现象，不要以为重复启动了。

**3. Flatpak 沙箱与文件访问**

在 GUI 里选文件走的是 portal，没有任何问题；但如果想用命令行 `--file-forwarding` 传文件进去，Hidamari 并不支持。这也是为什么必须走图形界面。

**4. 关于画质与功耗**

Hidamari 会把视频拉伸铺满屏幕，所以**没必要用 4K 素材**，1080p 的循环视频完全够用，还能大幅降低解码压力。视频壁纸本身会持续占用 GPU 解码，笔记本建议插电时使用。

**5. 没有 ffprobe 怎么查视频参数**

最小化安装的 Ubuntu 默认没有 `ffprobe`，不要直接拿它判断视频分辨率。可以装 `ffmpeg`，或者干脆在 Hidamari 里看一下实际效果。

### 七、备选：不用安装的系统原生动态壁纸

如果不想装任何东西，GNOME 原生支持**定时壁纸**：准备多张图片，写一个 XML 描述文件放到 `~/.local/share/backgrounds/`，再用 `gsettings` 把 `org.gnome.desktop.background picture-uri` 指向这个 XML，就能实现按时间自动渐变切换（比如白天一套、夜间一套）。

它不是视频，但胜在零依赖、零功耗、完全稳定，对长时间办公的机器更友好。

### 八、总结

-   判断能不能用，只看工具是否支持 **GNOME Wayland**，不要看教程年份
-   GNOME 用 Mutter，不实现 wlr-layer-shell，所以 mpvpaper 一类工具全部出局
-   视频壁纸选 **Hidamari**（Flathub），安装时注意加用户级 flathub 源
-   必须图形界面选视频，系统设置里记得开 Autostart、Mute、Pause when maximized
-   素材 1080p 足够，注意功耗
