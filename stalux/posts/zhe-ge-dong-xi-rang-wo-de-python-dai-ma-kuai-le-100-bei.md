---
title: "这个东西让我的Python代码快了100倍"
abbrlink: zhe-ge-dong-xi-rang-wo-de-python-dai-ma-kuai-le-100-bei
date: "2022-11-15 14:20:20"
categories:
    - "杂记"
tags: []
desc: "转载于Python数据挖掘。Python 已经得到了全球程序员的喜爱，连续多期稳坐编程语言排行榜第一把交椅。但是还是遭到一些人的诟病，原因之一就是认为它运行缓慢。…"
---
转载于Python数据挖掘。

Python 已经得到了全球程序员的喜爱，连续多期稳坐编程语言排行榜第一把交椅。但是还是遭到一些人的诟病，原因之一就是认为它运行缓慢。 要是有一款能够自动优化我们代码的神器该有多好啊！

于是，大家都在想尽各种办法来提高 Python 代码的运行速度，大多数体现在写代码的习惯优化以及代码优化上。但是平时写代码注意太多这些方面可能会有糟糕的体验，甚至会不利于我们的工作效率。

今天就给大家带来这样的一款神器——taichi，**喜欢记得收藏、点赞。**

#### 文章目录

-   -   [taichi](https://blog.csdn.net/#taichi_8 "taichi")
    -   [安装](https://blog.csdn.net/#_22 "安装")
    -   [一个小例子](https://blog.csdn.net/#_39 "一个小例子")
    -   [总结](https://blog.csdn.net/#_276 "总结")

### taichi

Taichi 起步于 MIT 的计算机科学与人工智能实验室（CSAIL），设计初衷是便利计算机图形学研究人员的日常工作，帮助他们快速实现适用于 GPU 的视觉计算和物理模拟算法。

说人话就是 Taichi 是一个基于 Python 的领域特定语言，专为高性能能并行计算设计。

本来是服务于学术界的一款 DSL ，但是我们也可以拿来用在我们这些凡夫俗子的代码中（虽然有点大材小用）！

### 安装

Taichi 是一个 PyPI 包，所以使用 pip 命令即可安装：

`pip install taichi`

注意 taichi 安装的先决条件是：

-   Python: 3.7/3.8/3.9/3.10 (64-bit)

-   OS: Windows, OS X, and Linux (64-bit)

在使用命令安装的时候，如果遇到错误，可以使用管理员模式命令行进行安装。

### 一个小例子

我们先来用一个小栗子，感受一下它的鬼斧神工！

import time

def is_prime(n):
   result = True
   for k in range(2, int(n**0.5) + 1):
       if n % k == 0:
           result = False
           break
   return result

def count_primes(n: int) -> int:
   count = 0
   for k in range(2, n):
       if is_prime(k):
           count += 1
 
   return count

t0 = time.time()
print(count_primes(100000))
t1 = time.time()

print(t1-t0)

这个是我们以前经常用来做例子的统计质数个数。求100000以内速度比较快，但是到了1000000，运行时间就明显慢了下来，竟然需要3.38秒。

Python 的大型 for 循环或嵌套 for 循环总是导致运行时性能不佳。

我们只需导入 Taichi 或切换到 Taichi 的 GPU 后端，就能看到整体性能的大幅提升：

```
import time
import taichi as ti

ti.init()

@ti.func
def is_prime(n):
    result = True
    for k in range(2, int(n**0.5) + 1):
        if n % k == 0:
            result = False
            break
    return result

@ti.kernel
def count_primes(n: int) -> int:
    count = 0
    for k in range(2, n):
        if is_prime(k):
            count += 1

    return count

t0 = time.time()
print(count_primes(1000000))
t1 = time.time()

print(t1-t0)
```

在这里，我们只需要引入 taichi 库，然后加两个注解，速度直接飙到了0.1秒，速度提升了30多倍。如果我们把数字再扩大，速度提升会更明显！

没有使用之前，统计10000000以内质数使用 90 秒，使用之后，并且更改为 GPU 运行，使用 0.1秒。

我们还可以将 Taichi 的后端从 CPU 更改为 GPU 运行：

### 总结

这个库是中国人发明的，它就是毕业于清华大学，后来去麻省理工学院进修的胡渊鸣
