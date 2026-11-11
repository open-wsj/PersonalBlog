---
title: "Python进阶教程：多线程与多进程"
abbrlink: python-jin-jie-jiao-cheng-duo-xian-cheng-yu-duo-jin-cheng
date: "2026-08-16 02:24:52"
categories:
    - "Python"
tags: []
desc: "本文介绍了Python中多线程与多进程的使用方法。主要内容包括：1）多线程的创建方式（直接调用和继承Thread类）及线程池使用；2）线程安全与锁机制；3）多进程的适用场景（CPU密集型任务）及进程池…"
---
#### 目录

-   [Python进阶教程：多线程与多进程](#Python_2)
-   -   [一、为什么需要并发](#_6)
    -   [二、多线程：threading](#threading_10)
    -   -   [2.1 创建线程的两种方式](#21__12)
        -   [2.2 多线程加速 I/O 任务](#22__IO__39)
    -   [三、线程安全与锁](#_64)
    -   [四、线程池：ThreadPoolExecutor](#ThreadPoolExecutor_89)
    -   [五、多进程：multiprocessing](#multiprocessing_111)
    -   [六、进程池：ProcessPoolExecutor](#ProcessPoolExecutor_133)
    -   [七、如何选择：线程还是进程？](#_146)
    -   [八、实战：并发下载器](#_154)
    -   [总结](#_180)

> 本文是 **Python 入门教程系列** 的第 6 篇。前面介绍了网络编程与数据抓取，本篇讲解 Python 并发编程的核心：**多线程**与**多进程**。

### 一、为什么需要并发

当程序有大量 I/O 操作（网络请求、文件读写）或计算密集任务时，串行执行会浪费大量等待时间。**并发编程**能让多个任务同时推进，大幅提升效率。

### 二、多线程：threading

#### 2.1 创建线程的两种方式

```python
import threading
import time

# 方式一：直接传入函数
def worker(name, seconds):
    time.sleep(seconds)
    print(f"{name} 完成")

t1 = threading.Thread(target=worker, args=("任务1", 1))
t1.start()
t1.join()  # 等待线程结束

# 方式二：继承 Thread 类
class MyThread(threading.Thread):
    def run(self):
        for i in range(3):
            time.sleep(0.5)
            print(f"{self.name} 运行中：{i}")

t2 = MyThread()
t2.start()
t2.join()
```

#### 2.2 多线程加速 I/O 任务

```python
import threading
import time

def download(name, delay):
    time.sleep(delay)  # 模拟网络请求
    print(f"{name} 下载完成，耗时{delay}s")

tasks = [("文件A", 2), ("文件B", 1), ("文件C", 3)]
threads = []
start = time.time()

for name, delay in tasks:
    t = threading.Thread(target=download, args=(name, delay))
    t.start()
    threads.append(t)

for t in threads:
    t.join()

print(f"总耗时：{time.time() - start:.1f}s")  # 约 3s 而非 6s
```

### 三、线程安全与锁

多个线程同时修改共享数据可能出错，需要加锁保护：

```python
import threading

counter = 0
lock = threading.Lock()

def increment(n):
    global counter
    for _ in range(n):
        with lock:  # 加锁保护临界区
            counter += 1

threads = [threading.Thread(target=increment, args=(100000,)) for _ in range(10)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print(counter)  # 正确结果 1000000
```

### 四、线程池：ThreadPoolExecutor

手动管理线程较繁琐，推荐使用线程池：

```python
from concurrent.futures import ThreadPoolExecutor
import time

def task(i):
    time.sleep(0.5)
    return i * i

with ThreadPoolExecutor(max_workers=4) as pool:
    # 提交单个任务
    future = pool.submit(task, 5)
    print(future.result())  # 25

    # 批量提交
    results = list(pool.map(task, range(6)))
    print(results)  # [0, 1, 4, 9, 16, 25]
```

### 五、多进程：multiprocessing

Python 的 GIL（全局解释器锁）使多线程无法真正并行执行 CPU 密集型任务，此时应使用多进程：

```python
from multiprocessing import Process
import os

def compute(name):
    print(f"进程 {name}，PID={os.getpid()}")
    total = sum(range(10**7))
    print(f"{name} 计算结果：{total}")

if __name__ == "__main__":
    processes = [Process(target=compute, args=(f"P{i}",)) for i in range(4)]
    for p in processes:
        p.start()
    for p in processes:
        p.join()
    print("所有进程执行完毕")
```

### 六、进程池：ProcessPoolExecutor

```python
from concurrent.futures import ProcessPoolExecutor

def heavy_calc(x):
    return sum(range(x))

with ProcessPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(heavy_calc, [10**6] * 4))
    print(results)
```

### 七、如何选择：线程还是进程？

| 场景 | 推荐 | 原因 |
| --- | --- | --- |
| 网络请求、文件读写等 I/O 密集 | 多线程 / 异步 | GIL 影响小，线程开销小 |
| CPU 计算密集（如图像处理、算法） | 多进程 | 绕过 GIL，利用多核 CPU |
| 任务数很多 | 线程池 / 进程池 | 复用资源，避免频繁创建销毁 |

### 八、实战：并发下载器

综合运用线程池，写一个模拟并发下载器：

```python
from concurrent.futures import ThreadPoolExecutor
import time
import random

def download_file(url):
    """模拟下载文件"""
    size = random.randint(1, 10)
    time.sleep(size * 0.1)
    return f"{url} 下载完成（{size}MB）"

urls = [f"https://example.com/file{i}.zip" for i in range(10)]

start = time.time()
with ThreadPoolExecutor(max_workers=5) as pool:
    results = list(pool.map(download_file, urls))

for r in results:
    print(r)
print(f"全部下载完成，总耗时：{time.time() - start:.1f}s")
```

### 总结

本篇介绍了多线程（threading、线程池）、多进程（multiprocessing、进程池）、锁机制以及线程/进程的选择策略，并用并发下载器串联实战。下一篇将介绍**数据库操作**，敬请期待！
