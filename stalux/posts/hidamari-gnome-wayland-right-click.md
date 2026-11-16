---
title: "Hidamari 动态壁纸吃掉 GNOME 桌面右键菜单：用 X Shape 实现点击穿透"
abbrlink: hidamari-gnome-wayland-right-click
date: "2026-11-16 14:05:00"
categories:
    - "Linux"
tags: ["GNOME", "Wayland", "Hidamari", "XWayland", "桌面美化"]
desc: "GNOME Wayland 用 Hidamari 播放动态壁纸后桌面右键菜单被覆盖，通过分析源码定位根因，并用 X Shape 将壁纸窗口输入区域置空实现点击穿透。"
---


## 一、现象

Ubuntu 26.04 + GNOME Shell 50.1（Wayland）上，用 Hidamari（Flatpak `io.github.jeffshee.Hidamari`）播放视频动态壁纸后，在桌面任意位置右键，弹出的不是熟悉的 GNOME 桌面菜单，而是 Hidamari 自己的菜单：

```
Show Hidamari
Toggle Mute Audio
Toggle Play/Pause
Reload
I'm Feeling Lucky
Quit Hidamari
```

原本的「新建文件夹 / 粘贴 / 全选 / 排列图标 / 更改壁纸 / 显示设置」全部消失，桌面图标也不能右键了。换成静态壁纸就一切正常，说明问题出在壁纸层。

## 二、先说结论

不是托盘图标的问题，也不是 DING 桌面扩展的问题。

Hidamari 的播放器窗口是铺满屏幕的桌面层窗口，它在代码里**主动监听鼠标右键并弹出自己的菜单**，事件被 `return True` 吃掉，下面的桌面窗口根本收不到。Hidamari 3.7 没有任何配置项可以关闭这个行为。

修复思路：既然播放器是 XWayland 窗口，就把它的 **X Shape 输入区域（input shape）置空**。XWayland 会把空的输入区域同步成 Wayland 的 `wl_surface.set_input_region`，于是鼠标事件直接穿透到下层，交还给桌面图标扩展。

## 三、排查过程

### 3.1 排除托盘菜单

一开始怀疑是 Hidamari 的系统托盘菜单被贴到了桌面上。验证：

```bash
# 配置里 is_show_systray 为 false
cat ~/.var/app/io.github.jeffshee.Hidamari/config/hidamari/config.json | grep systray

# 没有任何 hidamari-systray 进程
pgrep -af hidamari

# StatusNotifierWatcher 里也查不到 Hidamari 的托盘项
gdbus call --session --dest org.kde.StatusNotifierWatcher \
  --object-path /StatusNotifierWatcher \
  --method org.freedesktop.DBus.Properties.Get \
  org.kde.StatusNotifierWatcher RegisteredStatusNotifierItems
```

三项都不成立，托盘被排除。

### 3.2 排除 DING 桌面扩展

桌面右键菜单由 `ding@rastersoft.com`（Desktop Icons NG）提供，而 Hidamari 有一处针对 DING 的兼容逻辑：启动时把扩展禁用再启用一次，好让图标画在壁纸之上。手动重载 DING 后右键行为没有变化，说明不是扩展没加载。

### 3.3 找到真正的原因

翻 Hidamari 源码（Flatpak 内路径）：

```bash
flatpak run --command=sh io.github.jeffshee.Hidamari -c \
  'sed -n 275,295p /app/share/hidamari/hidamari/player/video_player.py'
```

```python
def _on_button_press_event(self, widget, event):
    if event.type == Gdk.EventType.BUTTON_PRESS and event.button == 3:
        if not self.menu:
            self.menu = build_menu(MODE_VIDEO)
        self.menu.popup_at_pointer()
        return True
    return False
```

`PlayerWindow` 连接了 `button-press-event`，右键直接弹菜单并消费事件。窗口类型是 `Gdk.WindowTypeHint.DESKTOP`、尺寸等于整块屏幕，所以整个桌面区域的右键都被它接管。

## 四、方案：把输入区域清空

### 4.1 为什么能穿透

播放器嵌入 VLC 需要 X11 窗口 id（`player.set_xwindow(self.get_window().get_xid())`），所以它在 Wayland 会话下运行在 XWayland 里。XWayland 会把 X 窗口的 Shape input region 同步到对应的 Wayland surface：

- 输入区域 = 整个窗口 → 点击由该 surface 处理（现状）；
- 输入区域 = 空 → 该 surface 不参与命中测试，点击落到下面的桌面窗口。

视觉完全不受影响，只有输入被放行。

### 4.2 用 ctypes 调用 libX11 / libXext

不需要安装 `python-xlib`，系统自带的 `libX11.so.6` + `libXext.so.6` 就够了：

```python
import ctypes
import ctypes.util

_SHAPE_INPUT, _SHAPE_SET, _UNSORTED = 2, 0, 0

x11 = ctypes.CDLL(ctypes.util.find_library("X11") or "libX11.so.6")
xext = ctypes.CDLL(ctypes.util.find_library("Xext") or "libXext.so.6")

x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
x11.XDefaultRootWindow.restype = ctypes.c_ulong
x11.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
xext.XShapeCombineRectangles.argtypes = [
    ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_int, ctypes.c_int,
    ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int,
]


def make_clickthrough(dpy, win):
    # 传入空的矩形列表即把 input shape 设为空
    xext.XShapeCombineRectangles(
        dpy, win, _SHAPE_INPUT, 0, 0, None, 0, _SHAPE_SET, _UNSORTED)
    x11.XFlush(dpy)
```

### 4.3 找到正确的窗口

桌面上会同时存在多个 `hidamari` 窗口（1x1、10x10 的辅助窗口，以及 GUI 窗口），必须只处理铺满屏幕的那个：

```bash
xwininfo -root -tree
```

```
0x120004e "hidamari": ("hidamari" "Hidamari")  199x176+1267+281
0x1200003 "hidamari": ("hidamari" "Hidamari")  1920x1080+0+0   <- 壁纸窗口
0x1200001 "hidamari": ("hidamari" "Hidamari")  10x10+10+10
```

判断条件：`WM_NAME == "hidamari"`、已映射、宽高 ≥ 屏幕宽高。

### 4.4 需要轮询

以下情况都会重建窗口，之前设置的 input shape 随之失效：

- Hidamari 重启（包括开机自启）；
- 切换显示器 / 改分辨率；
- 播放器进程因换视频而重建。

所以守护进程每 2 秒扫描一次，只对"没见过的新窗口"应用一次，避免反复刷 X 请求：

```python
def apply_clickthrough(dpy, applied):
    root = x11.XDefaultRootWindow(dpy)
    ...
    for win in children:
        if win in applied or not is_fullscreen_hidamari(dpy, win):
            continue
        applied.add(win)
        make_clickthrough(dpy, win)
```

同时用 `XSetErrorHandler` 吞掉窗口销毁时的 `BadWindow` 报错，否则日志会被刷屏：

```python
_X_ERROR_HANDLER = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.c_void_p, ctypes.c_void_p)
_IGNORE_X_ERROR = _X_ERROR_HANDLER(lambda dpy, ev: 0)
x11.XSetErrorHandler(_IGNORE_X_ERROR)
```

完整脚本放在 `~/.local/bin/hidamari-clickthrough.py`，支持 `--once`（只处理当前窗口）和 `--dry-run`（只检测不改动）。

## 五、开机自启

### 5.1 Hidamari 本身

Hidamari 其实**自带**自启开关（Preferences → Autostart after login）。Flatpak 版本通过 XDG Desktop Portal 申请后台自启，并写一个沙箱内的标记文件用于回显勾选状态。

如果不想点 GUI，手动等价做法是写宿主自启项：

```ini
# ~/.config/autostart/io.github.jeffshee.Hidamari.desktop
[Desktop Entry]
Type=Application
Name=Hidamari
Exec=/usr/bin/flatpak run --command=hidamari io.github.jeffshee.Hidamari -b
Icon=io.github.jeffshee.Hidamari
Terminal=false
Categories=GTK;Utility;
StartupNotify=true
X-Flatpak=io.github.jeffshee.Hidamari
X-GNOME-Autostart-enabled=true
```

注意：`-b` 表示后台启动，不要和 GUI 里的开关同时开，否则会有两个自启项（Hidamari 是单实例，不会崩，但很乱）。

### 5.2 穿透守护

```ini
# ~/.config/autostart/hidamari-clickthrough.desktop
[Desktop Entry]
Type=Application
Name=Hidamari 壁纸点击穿透
Exec=/usr/bin/python3 /home/wsj/.local/bin/hidamari-clickthrough.py
Terminal=false
NoDisplay=true
X-GNOME-Autostart-enabled=true
```

两个文件都可以用 `desktop-file-validate` 校验。守护进程自己会等待 `DISPLAY` 就绪，启动顺序无所谓。

## 六、效果

- 桌面任意位置右键 → 恢复 GNOME/DING 菜单（新建文件夹、粘贴、排列图标、更改壁纸、显示设置）；
- 桌面图标点击、框选、双击打开全部正常；
- 动态壁纸照常播放，视觉无任何变化；
- 代价：壁纸上的 Hidamari 右键菜单不再出现。需要暂停/静音/换视频时，打开 `flatpak run io.github.jeffshee.Hidamari` 的界面操作即可。

## 七、注意事项

1. **只适用于 XWayland 窗口**。Hidamari 因为 VLC 走 X11 才能用这招；如果哪天改成原生 Wayland + layer-shell，input shape 就无效了（届时应该直接由合成器决定命中测试）。
2. **不要把输入区域设成"只有图标区域"**。DING 需要完整屏幕来响应框选和空白处右键，留一块空白反而会让部分区域失去响应。
3. **轮询间隔别太激进**。2 秒足够，`XQueryTree` 本身很轻，但没必要 200ms。
4. **注销重登后要重新应用**（守护进程已自启，自动处理）；若手动 kill 了守护，重跑脚本即可。
5. 想彻底不要 Hidamari 右键菜单、又不想搞穿透，只能改 Flatpak 里的 Python 源码（重建运行时或覆盖 `/app`），成本和维护性都更差，不推荐。

## 八、参考

- Hidamari：`https://github.com/jeffshee/hidamari`
- Flatpak：`io.github.jeffshee.Hidamari` 3.7
- 环境：Ubuntu 26.04 / GNOME Shell 50.1 / Wayland / 扩展 `ding@rastersoft.com`
- 验证时间：2026-11-16，实机生效
