---
title: "Python进阶教程：异步编程（asyncio）"
abbrlink: python-jin-jie-jiao-cheng-yi-bu-bian-cheng-asyncio
date: "2026-08-20 09:51:37"
categories:
    - "Python"
tags: []
desc: "异步编程让程序在等待 I/O 时不阻塞，而是继续执行其他任务。单线程内实现并发，无锁竞争上下文切换开销极小适合大量 I/O 等待场景（网络请求、数据库）Python 3.7+…"
---
#### 目录

-   [Python进阶教程：异步编程（asyncio）](#Pythonasyncio_2)
-   -   [一、什么是异步编程](#_6)
    -   [二、协程基础](#_16)
    -   [三、并发执行多个任务](#_30)
    -   [四、asyncio.create_task](#asynciocreate_task_57)
    -   [五、异步 HTTP 请求](#_HTTP__78)
    -   [六、asyncio 与同步代码混合](#asyncio__105)
    -   [七、超时与取消](#_126)
    -   [八、实战：异步下载器](#_146)
    -   [总结](#_170)

> 本文是 **Python 入门教程系列** 的第 12 篇（扩展篇）。前面第 6 篇介绍了多线程与多进程，本篇讲解**异步编程**（asyncio），它是 I/O 密集任务最高效的并发方案。

### 一、什么是异步编程

异步编程让程序在等待 I/O 时**不阻塞**，而是继续执行其他任务。与多线程相比：

-   单线程内实现并发，**无锁竞争**
-   上下文切换开销极小
-   适合大量 I/O 等待场景（网络请求、数据库）

Python 3.7+ 使用 `async` / `await` 关键字。

### 二、协程基础

```python
import asyncio

async def hello():
    print("开始执行")
    await asyncio.sleep(1)  # 模拟异步等待
    print("执行完成")

# 运行协程
asyncio.run(hello())
```

### 三、并发执行多个任务

```python
import asyncio
import time

async def fetch(name, delay):
    print(f"{name} 开始请求...")
    await asyncio.sleep(delay)
    print(f"{name} 完成！")
    return f"{name}的数据"

async def main():
    start = time.perf_counter()

    # 并发执行多个协程
    results = await asyncio.gather(
        fetch("请求A", 2),
        fetch("请求B", 1),
        fetch("请求C", 3),
    )
    print(results)
    print(f"总耗时：{time.perf_counter() - start:.1f}s")  # 约 3s 而非 6s

asyncio.run(main())
```

### 四、asyncio.create_task

```python
import asyncio

async def worker(name, delay):
    await asyncio.sleep(delay)
    return f"{name} 完成"

async def main():
    # 创建任务（不立即 await，让它们并行）
    task1 = asyncio.create_task(worker("任务1", 2))
    task2 = asyncio.create_task(worker("任务2", 1))

    # 等待所有任务
    results = await asyncio.gather(task1, task2)
    print(results)

asyncio.run(main())
```

### 五、异步 HTTP 请求

配合 aiohttp 库实现真正的异步网络请求：

```python
# pip install aiohttp
import asyncio
import aiohttp
import time

async def fetch_url(session, url):
    async with session.get(url) as resp:
        return await resp.text()

async def main():
    urls = ["https://httpbin.org/get"] * 5
    async with aiohttp.ClientSession() as session:
        start = time.perf_counter()
        # 并发请求
        responses = await asyncio.gather(
            *(fetch_url(session, url) for url in urls)
        )
        print(f"完成 {len(responses)} 个请求，耗时 {time.perf_counter()-start:.2f}s")

asyncio.run(main())
```

### 六、asyncio 与同步代码混合

```python
import asyncio
import time

def sync_blocking():
    """模拟阻塞操作（如 CPU 计算、旧库调用）"""
    time.sleep(2)
    return "同步结果"

async def main():
    print("开始")
    # 用 run_in_executor 把阻塞操作丢到线程池
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, sync_blocking)
    print(result)

asyncio.run(main())
```

### 七、超时与取消

```python
import asyncio

async def slow_task():
    await asyncio.sleep(10)
    return "终于完成了"

async def main():
    try:
        # 3 秒超时
        result = await asyncio.wait_for(slow_task(), timeout=3)
        print(result)
    except asyncio.TimeoutError:
        print("任务超时，已取消")

asyncio.run(main())  # 任务超时，已取消
```

### 八、实战：异步下载器

```python
import asyncio
import aiohttp
import time

async def download(session, index):
    """模拟异步下载文件"""
    await asyncio.sleep(index * 0.3)
    return f"文件{index} 下载完成"

async def main():
    async with aiohttp.ClientSession() as session:
        start = time.perf_counter()
        tasks = [download(session, i) for i in range(1, 8)]
        results = await asyncio.gather(*tasks)
        for r in results:
            print(r)
        print(f"总耗时：{time.perf_counter()-start:.2f}s")

asyncio.run(main())
```

### 总结

本篇介绍了 asyncio 的协程、任务并发、异步 HTTP、超时控制等核心概念，并提供了异步下载器实战。选择并发方案的建议：I/O 密集用 asyncio（最高效）或多线程，CPU 密集用多进程。
