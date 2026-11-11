---
title: "Espressif-IDE中文汉化教程全网首发"
abbrlink: espressif-ide-zhong-wen-han-hua-jiao-cheng-quan-wang-shou-fa
date: "2023-01-17 22:03:49"
categories:
    - "嵌入式"
tags: []
desc: "Espressif-IDE中文汉化教程"
---
### 改为中文后启动失败问题的解决

IDE语言选择Chinese之后，正常情况下，会出现退出后不能够正常运行的情况。如下所示

![4bb8db96bab74e2d96c2ba6d616ffae6.png](https://i-blog.csdnimg.cn/blog_migrate/a1f0725c77bcec38cc8389d46a568e23.png)

这个则应该是缺少合适的java环境，需要安装有java11或者以上的环境，可以通过以下链接安装java17,[Java Downloads | Oracle![](https://i-blog.csdnimg.cn/blog_migrate/039a84e0f347bb45be0e5dcf71ea800a.png)https://www.oracle.com/java/technologies/downloads/](https://www.oracle.com/java/technologies/downloads/ "Java Downloads | Oracle")

笔者安装的是java8所以不行，但是安装好java11后还是有报错信息。这里可以尝试重新安装 乐鑫IDE（这一步应该是必须的，不清楚的原因是，这些步骤是github的管理员对笔者安装的帮助，笔者是按照这些步骤进行的。）

但是依然会有报错信息，如下所示。

![44abd86d6a9b4ac8a7707c94534528c5.png](https://i-blog.csdnimg.cn/blog_migrate/36747f38230a6f791f36520f727300ad.png)

![e5529dea71cc42d4aadb2e1d112b7964.png](https://i-blog.csdnimg.cn/blog_migrate/af4a9e6c9926e093257a5d1e6a0327f2.png)

这个时候只需更改ini文件即可。我的路径如下

D:\Espressif\tools\espressif-ide\2.7.0\espressif-ide.ini

采用记事本编辑，更改为以下内容

```cpp
-startup

plugins/org.eclipse.equinox.launcher_1.6.400.v20210924-0641.jar

--launcher.library

plugins/org.eclipse.equinox.launcher.win32.win32.x86_64_1.2.600.v20220720-1916

-data

@noDefault

-vm

C:\Program Files\Java\jdk-11.0.9\bin\server\jvm.dll

-vmargs

-Xms256m

-Xmx2048m

-Dosgi.requiredJavaVersion=11

-Dosgi.instance.area.default=@user.home/espressif-workspace
```

额外注意的是**C:\Program Files\Java\jdk-11.0.9\bin\server\jvm.dll** 是笔者的Java相关路径，你应该改为你自己的。

改完之后你就会发现可以正常打开IDE了，但是汉化不彻底，如下图所示。![54f0fd5036394446ac545d919bd88130.png](https://i-blog.csdnimg.cn/blog_migrate/9012104da3817af042b54408eebf2323.png)

### 上面的是解决启动的bug,下面则是最核心的汉化步骤了。

**操作步骤**

 **打开IDE 界面 选择菜单 【Help】→【Install new software…】**

 **添加语言包地址 ： https://download.eclipse.org/technology/babel/update-site/latest/**

 **选择 语言包 中文简体 ： 【……in Chinese(Simplified)】**这一步骤要注意，选择语言包的时候最好点开里面取消.rt.rap语言包的选定，不然欢迎界面会报错（这一步则参考了某个网友的方案）。

 **一直 【Next】 ，然后 选择全部，最后【Finish】**

最终界面如下图,如果有其他问题可以评论或者通过GitHub账户OPEN-F联系。

![711339f11cbd42a8adfa6ff4bba5b375.png](https://i-blog.csdnimg.cn/blog_migrate/848dbd42a792ca7488b6e7ebcaf0d92d.png)

![e4c6e050a6194b79881f1c0366906bcc.png](https://i-blog.csdnimg.cn/blog_migrate/250f7e5e37194683c239c16f666cc039.png)

![d5f5a75fcab544e993b31f5510594f42.png](https://i-blog.csdnimg.cn/blog_migrate/63decb6d4b1b0bf5b07daaef7ae4e2e7.png)
