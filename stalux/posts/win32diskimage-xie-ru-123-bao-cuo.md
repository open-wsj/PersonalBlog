---
title: "Win32DiskImage写入123报错"
abbrlink: win32diskimage-xie-ru-123-bao-cuo
date: "2023-01-17 21:54:38"
categories:
    - "杂记"
tags: []
desc: "将SD卡格式化为FAT32，然后向其中写一个img文件。利用读卡器将SD卡连接在主机上，然后使用win32disimager软件向指定盘符写时报错123"
---
今天需要将SD卡格式化为FAT32，然后向其中写一个img文件。利用读卡器将SD卡连接在主机上，然后使用win32disimager软件向指定盘符写时报错123

**原因**

Win32DiskImage不支持中文路径

**解决方法**

将写入的路径改为英文

成功！！！！！

![](https://i-blog.csdnimg.cn/blog_migrate/71a61cb9e73499dbe1b4abc1d33f2537.png)
