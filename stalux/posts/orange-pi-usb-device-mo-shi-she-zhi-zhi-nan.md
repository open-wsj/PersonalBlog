---
title: "Orange Pi USB Device 模式设置指南"
abbrlink: orange-pi-usb-device-mo-shi-she-zhi-zhi-nan
date: "2026-07-02 12:53:25"
categories:
    - "嵌入式"
tags: []
desc: "本文介绍了在Orange Pi开发板上设置USB为设备模式的两种方法。推荐使用set_device.sh脚本，执行简单命令即可完成设置；也可手动操作，通过echo命令写入mode文件并重启服务…"
---
### 背景

在 Orange Pi 开发板上使用 Payload-SDK 时，需要将 USB 接口设置为 device 模式。

### 设置方法

#### 方法1: 使用 set_device.sh 脚本（推荐）

```bash
sudo /usr/local/bin/set_device.sh
```

脚本内容：

```bash
#!/bin/bash
sudo bash -c "echo device > /sys/kernel/debug/usb/fc000000.usb/mode"
sudo systemctl restart usbdevice
```

#### 方法2: 手动设置

```bash
sudo bash -c "echo device > /sys/kernel/debug/usb/fc000000.usb/mode"
sudo systemctl restart usbdevice
```

### 验证

```bash
sudo cat /sys/kernel/debug/usb/fc000000.usb/mode
# 输出应为: device
```

### 注意事项

-   `/sys/kernel/debug/usb/` 路径需要使用 `sudo` 才能访问，普通用户无法查看
-   USB 控制器地址为 `fc000000.usb`
