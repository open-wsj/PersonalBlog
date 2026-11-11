---
title: "关于大越创新的板载USB–TTL通信失败问题的修复"
abbrlink: guan-yu-da-yue-chuang-xin-de-ban-zai-usb-ttl-tong-xin-shi
date: "2022-11-08 11:15:07"
categories:
    - "嵌入式"
tags: []
desc: "问题描述：这几天用大越创新stm32f103rct6（升级版）进行传感器读取，发现使用板载串口，电脑识别ch340驱动比较慢，而且发送数据会卡死（如果判断没问题的话是单片机卡了），重新启动串口后…"
---
### 问题描述：

这几天用大越创新stm32f103rct6（升级版）进行传感器读取，发现使用板载串口，电脑识别ch340驱动比较慢，而且发送数据会卡死（如果判断没问题的话是单片机卡了），重新启动串口后，接收一小部分数据后又卡死。

### 问题解决：

首先考虑到是通信芯片老化，于是进行换新，发现问题依旧，之后查看电路图如下↓

![](https://i-blog.csdnimg.cn/blog_migrate/53798bf42c16b2bc8a61b5eaaae6b977.jpeg)

可以发现三个问题，

#### 1.ch340c的34引脚接了10K的电阻（会使电平处在边沿时间变长）。

#### 2.电路通信方式选择的是一件下载的方式（实际上这种下载方式在stm32系列的单片机并不常用）。

#### 3.供电电源应该用0.1uf的退偶电容，这个板子并联了两个104电容。

下面我们看官方的芯片手册，如下↓

![](https://i-blog.csdnimg.cn/blog_migrate/ccd2e4d7c9e82a51704d8426bfebfb43.jpeg)

![](https://i-blog.csdnimg.cn/blog_migrate/90f208b3465b5cec66612a9ff68c2998.jpeg)

###  解决方案：

1，取掉Q1和Q2两个三极管。

2，考虑短接R13和R14两个电阻，或者用0欧电阻代替。

3，电源104电容换105。

### 最终结果：

等待更新。

2022年11月8日更新

拆掉两个三极管后，如下↓

![](https://i-blog.csdnimg.cn/blog_migrate/cdee9d4d3f672354275840d38ca57f78.jpeg)

通信正常，问题解决。

2022年11月9日更新

检查发现R13和R14两个电阻已经被更换为0欧电阻（应该是店家刊误，或者是故意这样防止盗版吧）

![](https://i-blog.csdnimg.cn/blog_migrate/fe216230ae2c1b21ed9b1f740e881d2e.jpeg)

客服也是相当实在了。
