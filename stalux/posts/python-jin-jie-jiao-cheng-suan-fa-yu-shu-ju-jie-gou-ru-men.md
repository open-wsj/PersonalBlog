---
title: "Python进阶教程：算法与数据结构入门"
abbrlink: python-jin-jie-jiao-cheng-suan-fa-yu-shu-ju-jie-gou-ru-men
date: "2026-08-24 02:25:20"
categories:
    - "Python"
tags: []
desc: "本篇介绍了时间复杂度、常用数据结构（栈、队列）、排序与查找算法、递归和动态规划入门，并用 LRU 缓存串联实战。刷题建议：从 LeetCode 简单题开始，每天 1-2 题，坚持就是胜利。"
---
#### 目录

-   [Python进阶教程：算法与数据结构入门](#Python_2)
-   -   [一、时间复杂度](#_6)
    -   [二、常用数据结构](#_18)
    -   -   [2.1 列表与字典](#21__20)
        -   [2.2 栈（Stack）](#22_Stack_34)
        -   [2.3 队列（Queue）](#23_Queue_47)
    -   [三、排序算法](#_59)
    -   -   [3.1 冒泡排序（O(n²)）](#31_On_61)
        -   [3.2 快速排序（O(n log n)）](#32_On_log_n_75)
    -   [四、查找算法](#_90)
    -   [五、递归](#_111)
    -   [六、动态规划入门](#_133)
    -   [七、实战：实现 LRU 缓存](#_LRU__149)
    -   [总结](#_182)

> 本文是 **Python 入门教程系列** 的第 18 篇（扩展篇）。算法与数据结构是编程的**内功**，本篇介绍最核心的几种，用 Python 实现。

### 一、时间复杂度

衡量算法效率用 **大 O 表示法**，描述执行时间随数据规模增长的速度：

| 复杂度 | 含义 | 示例 |
| --- | --- | --- |
| O(1) | 常数时间 | 数组按下标访问 |
| O(log n) | 对数时间 | 二分查找 |
| O(n) | 线性时间 | 遍历列表 |
| O(n log n) | 线性对数 | 快速排序 |
| O(n²) | 平方时间 | 冒泡排序 |

### 二、常用数据结构

#### 2.1 列表与字典

```python
# 列表：有序、可重复
fruits = ["苹果", "香蕉", "橙子"]
fruits.append("葡萄")
print(fruits[0], len(fruits))

# 字典：键值对、查找 O(1)
scores = {"张三": 90, "李四": 85}
print(scores["张三"])
print(scores.get("王五", "不存在"))
```

#### 2.2 栈（Stack）

```python
# 栈：后进先出（LIFO），用列表实现
stack = []
stack.append(1)   # 入栈
stack.append(2)
stack.append(3)
print(stack.pop())  # 3 出栈
print(stack[-1])    # 2 查看栈顶
print(len(stack) == 0)  # 判断是否为空
```

#### 2.3 队列（Queue）

```python
from collections import deque

# 队列：先进先出（FIFO）
queue = deque(["a", "b", "c"])
queue.append("d")      # 入队
print(queue.popleft()) # a 出队
print(queue)           # deque(["b", "c", "d"])
```

### 三、排序算法

#### 3.1 冒泡排序（O(n²)）

```python
def bubble_sort(arr):
    n = len(arr)
    for i in range(n - 1):
        for j in range(n - 1 - i):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

print(bubble_sort([5, 2, 8, 1, 9]))  # [1, 2, 5, 8, 9]
```

#### 3.2 快速排序（O(n log n)）

```python
def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    mid = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + mid + quick_sort(right)

print(quick_sort([5, 2, 8, 1, 9]))  # [1, 2, 5, 8, 9]
```

### 四、查找算法

```python
# 二分查找（要求有序，O(log n)）
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1

nums = [1, 3, 5, 7, 9, 11]
print(binary_search(nums, 7))  # 3
print(binary_search(nums, 8))  # -1
```

### 五、递归

```python
# 递归：函数调用自身
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print(factorial(5))  # 120

# 斐波那契（带缓存避免重复计算）
from functools import lru_cache
@lru_cache(maxsize=None)
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

print(fib(50))  # 12586269025
```

### 六、动态规划入门

```python
# 经典问题：爬楼梯（每次 1 或 2 阶）
def climb_stairs(n):
    if n <= 2:
        return n
    dp = [0] * (n + 1)
    dp[1], dp[2] = 1, 2
    for i in range(3, n + 1):
        dp[i] = dp[i - 1] + dp[i - 2]
    return dp[n]

print(climb_stairs(10))  # 89
```

### 七、实战：实现 LRU 缓存

```python
from collections import OrderedDict

class LRUCache:
    """最近最少使用缓存"""
    def __init__(self, capacity):
        self.cache = OrderedDict()
        self.capacity = capacity

    def get(self, key):
        if key not in self.cache:
            return -1
        self.cache.move_to_end(key)  # 标记为最近使用
        return self.cache[key]

    def put(self, key, value):
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value
        if len(self.cache) > self.capacity:
            self.cache.popitem(last=False)  # 淘汰最久未用

cache = LRUCache(2)
cache.put(1, "A")
cache.put(2, "B")
print(cache.get(1))   # A
cache.put(3, "C")    # 淘汰 key=2
print(cache.get(2))   # -1
print(cache.get(3))   # C
```

### 总结

本篇介绍了时间复杂度、常用数据结构（栈、队列）、排序与查找算法、递归和动态规划入门，并用 LRU 缓存串联实战。刷题建议：从 LeetCode 简单题开始，每天 1-2 题，坚持就是胜利。
