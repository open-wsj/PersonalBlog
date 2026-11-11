---
title: "ROS使用的bug总结"
abbrlink: ros-shi-yong-de-bug-zong-jie
date: "2022-08-19 22:15:13"
categories:
    - "嵌入式"
tags: []
desc: "[rospack] Error: package 'xxxxxxxxxxx' not found"
---
1，[rospack] Error: package 'xxxxxxxxxxx' not found

解决方法，终端输入

```
source ./devel/setup.bash
```

之后再

```
rosrun 功能包 可执行文件
```
