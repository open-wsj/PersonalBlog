---
title: "ubuntu安装时窗口太小，点不到应用"
abbrlink: ubuntu-an-zhuang-shi-chuang-kou-tai-xiao-dian-bu-dao-ying
date: "2022-08-10 23:50:03"
categories:
    - "Linux 桌面"
tags: []
desc: "要注意的是，两数字间是x字母，⽽不是数字键区的*号。另外此效果，只能在当前运⾏虚拟机下有效，如果关了虚拟机，之后就没⽤了。所以你必需，⽴刻在system setting⾥点击display…"
---
1，Ctrl+Alt+T打开终端

2，输入命令

```
xrandr -s 1280x800
```

后⾯的1280x800就是分辨率⼤⼩，只要敲击enter，⽴即显⽰效果

要注意的是，两数字间是x字母，⽽不是数字键区的*号。另外，此效果，只能在当前运⾏虚拟机下有效，如果关了虚拟机，之后就没⽤了。所以你必需，⽴刻在system setting⾥点击display，找到分辨率修改，并点击apply进⾏应⽤。

另外，刚按完虚拟机之后，是没有root密码的，你需要设置⼀下

```
sudo passwd root
```

输入几次新密码即可。
