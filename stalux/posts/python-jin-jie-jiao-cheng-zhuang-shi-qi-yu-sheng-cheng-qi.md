---
title: "Python进阶教程：装饰器与生成器深入"
abbrlink: python-jin-jie-jiao-cheng-zhuang-shi-qi-yu-sheng-cheng-qi
date: "2026-08-22 00:00:53"
categories:
    - "Python"
tags: []
desc: "本篇深入讲解了装饰器（基础、带参数、内置装饰器）和生成器（基础、表达式、无限序列），并用手写缓存装饰器串联实战。理解这两个特性，能写出更简洁、更 Pythonic 的代码。"
---
#### 目录

-   [Python进阶教程：装饰器与生成器深入](#Python_2)
-   -   [一、函数是一等公民](#_6)
    -   [二、装饰器基础](#_25)
    -   [三、带参数的装饰器](#_51)
    -   [四、常用内置装饰器](#_74)
    -   [五、生成器基础](#_113)
    -   [六、生成器表达式](#_130)
    -   [七、生成器实战：无限序列](#_146)
    -   [八、实战：缓存装饰器](#_162)
    -   [总结](#_191)

> 本文是 **Python 入门教程系列** 的第 13 篇（扩展篇）。装饰器和生成器是 Python 中非常优雅的两个特性，本篇深入讲解。

### 一、函数是一等公民

在 Python 中，函数可以像变量一样传递和返回，这是装饰器的基础：

```python
def greet(name):
    return f"你好，{name}"

# 函数可以赋值给变量
say = greet
print(say("张三"))  # 你好，张三

# 函数可以作为参数传递
def call_twice(func, arg):
    return func(func(arg))

print(call_twice(greet, "张三"))  # 你好，你好，张三
```

### 二、装饰器基础

装饰器可以在不修改原函数的情况下**增强函数功能**：

```python
import time

def timer(func):
    """统计函数执行时间的装饰器"""
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} 耗时 {elapsed:.4f}s")
        return result
    return wrapper

@timer
def slow_add(a, b):
    time.sleep(0.1)
    return a + b

print(slow_add(1, 2))  # slow_add 耗时 0.1xxx s
 3
```

### 三、带参数的装饰器

```python
import functools

def repeat(times):
    """让函数重复执行的装饰器（带参数）"""
    def decorator(func):
        @functools.wraps(func)  # 保留原函数信息
        def wrapper(*args, **kwargs):
            for _ in range(times):
                result = func(*args, **kwargs)
            return result
        return wrapper
    return decorator

@repeat(times=3)
def say_hello():
    print("Hello!")

say_hello()  # 打印 3 次 Hello!
```

### 四、常用内置装饰器

```python
class MyClass:
    class_var = 0

    def __init__(self, value):
        self._value = value

    @property
    def value(self):
        """只读属性"""
        return self._value

    @value.setter
    def value(self, new_val):
        """属性赋值检查"""
        if new_val < 0:
            raise ValueError("不能为负")
        self._value = new_val

    @classmethod
    def create(cls):
        """类方法"""
        return cls(0)

    @staticmethod
    def helper():
        """静态方法"""
        return "工具函数"

obj = MyClass(10)
print(obj.value)       # 10
obj.value = 20         # 调用 setter
print(obj.value)       # 20
print(MyClass.create().value)  # 0
print(MyClass.helper())        # 工具函数
```

### 五、生成器基础

生成器用 `yield` 逐次产出值，**不一次性占用内存**：

```python
def count_up_to(n):
    i = 1
    while i <= n:
        yield i  # 暂停并返回
        i += 1

gen = count_up_to(5)
print(next(gen))  # 1
print(next(gen))  # 2
print(list(gen))  # [3, 4, 5] 继续消费剩余
```

### 六、生成器表达式

```python
# 列表推导式 vs 生成器表达式
squares_list = [x*x for x in range(1000000)]   # 立即占用内存
squares_gen = (x*x for x in range(1000000))    # 惰性求值

# 生成器可以传给 sum 等函数
print(sum(x*x for x in range(10)))  # 285

# 内存对比
import sys
print(sys.getsizeof([x for x in range(100000)]))  # 约 800KB
print(sys.getsizeof((x for x in range(100000))))  # 约 112B
```

### 七、生成器实战：无限序列

```python
def fibonacci():
    """无限斐波那契序列生成器"""
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

fib = fibonacci()
# 取前 10 个
print([next(fib) for _ in range(10)])
# [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
```

### 八、实战：缓存装饰器

```python
import functools
import time

def memoize(func):
    """手写缓存装饰器"""
    cache = {}

    @functools.wraps(func)
    def wrapper(*args):
        if args not in cache:
            cache[args] = func(*args)
        return cache[args]
    return wrapper

@memoize
def expensive(n):
    print(f"计算 {n}...")
    time.sleep(1)
    return n * n

start = time.perf_counter()
print(expensive(5))  # 计算 5... 25
print(expensive(5))  # 直接命中缓存 25（不打印计算）
print(f"耗时：{time.perf_counter()-start:.1f}s")  # 约 1s
```

### 总结

本篇深入讲解了装饰器（基础、带参数、内置装饰器）和生成器（基础、表达式、无限序列），并用手写缓存装饰器串联实战。理解这两个特性，能写出更简洁、更 Pythonic 的代码。
