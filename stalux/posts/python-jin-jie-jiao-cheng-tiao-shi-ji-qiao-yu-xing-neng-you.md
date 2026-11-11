---
title: "Python进阶教程：调试技巧与性能优化"
abbrlink: python-jin-jie-jiao-cheng-tiao-shi-ji-qiao-yu-xing-neng-you
date: "2026-08-19 13:22:30"
categories:
    - "Python"
tags: []
desc: "恭喜你完成Python 入门教程系列的全部 10 篇文章！篇目主题1Python 入门：基础语法2面向对象编程（OOP）3文件操作与异常处理4常用标准库与实用技巧5网络编程与数据抓取6多线程与多进程7…"
---
#### 目录

-   [Python进阶教程：调试技巧与性能优化](#Python_2)
-   -   [一、print 调试与日志](#print__6)
    -   [二、断言 assert](#_assert_27)
    -   [三、pdb：交互式调试器](#pdb_39)
    -   [四、性能分析](#_59)
    -   -   [4.1 时间测量](#41__61)
        -   [4.2 cProfile 性能分析](#42_cProfile__72)
    -   [五、常见性能优化技巧](#_87)
    -   -   [5.1 使用内置函数与库](#51__89)
        -   [5.2 列表推导式](#52__109)
        -   [5.3 缓存结果](#53__121)
        -   [5.4 生成器省内存](#54__135)
    -   [六、代码规范](#_146)
    -   -   [6.1 PEP 8 要点](#61_PEP_8__148)
        -   [6.2 类型注解](#62__158)
    -   [七、实战：优化一个慢函数](#_168)
    -   [系列总结](#_204)

> 本文是 **Python 入门教程系列** 的收官篇（第 10 篇）。前面九篇覆盖了从基础到 Web 开发的完整路径，本篇介绍**调试技巧**与**性能优化**，帮你写出更健壮、更快的代码。

### 一、print 调试与日志

最朴素的调试方式就是打印，但正式项目应该用 **logging** 模块：

```python
import logging

# 配置日志
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)s %(message)s",
    filename="app.log",  # 输出到文件（可选）
)

logging.debug("调试信息")
logging.info("普通信息")
logging.warning("警告信息")
logging.error("错误信息")
logging.critical("严重错误")
```

### 二、断言 assert

断言用于检查程序状态，条件为假时立即报错：

```python
def divide(a, b):
    assert b != 0, "除数不能为零"
    return a / b

divide(10, 0)  # AssertionError: 除数不能为零
```

### 三、pdb：交互式调试器

pdb 是 Python 内置调试器，可以在代码中设置断点：

```python
import pdb

def process(data):
    result = []
    for item in data:
        pdb.set_trace()  # 在此处暂停，进入调试模式
        result.append(item * 2)
    return result

# process([1, 2, 3])
# 调试器中常用命令：
# n 下一步 | s 进入函数 | c 继续执行
# p 变量名 打印变量 | q 退出
```

### 四、性能分析

#### 4.1 时间测量

```python
import time

start = time.perf_counter()
total = sum(range(10**7))
elapsed = time.perf_counter() - start
print(f"耗时：{elapsed:.3f}s")
```

#### 4.2 cProfile 性能分析

```python
import cProfile

def slow_function():
    total = 0
    for i in range(10**6):
        total += i ** 2
    return total

# 分析函数耗时
cProfile.run("slow_function()")
```

### 五、常见性能优化技巧

#### 5.1 使用内置函数与库

```python
import time

data = list(range(10**6))

# 慢：Python 循环
start = time.perf_counter()
total = 0
for x in data:
    total += x
print(f"循环：{time.perf_counter() - start:.4f}s")

# 快：内置 sum
start = time.perf_counter()
total = sum(data)
print(f"内置 sum：{time.perf_counter() - start:.4f}s")
```

#### 5.2 列表推导式

```python
# 慢
squares = []
for i in range(1000):
    squares.append(i * i)

# 快（且更简洁）
squares = [i * i for i in range(1000)]
```

#### 5.3 缓存结果

```python
from functools import lru_cache

@lru_cache(maxsize=128)
def fibonacci(n):
    if n < 2:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(100))  # 有缓存后瞬间返回
```

#### 5.4 生成器省内存

```python
# 列表：一次性全部加载到内存
nums_list = [i for i in range(10**7)]

# 生成器：按需生成，几乎不占内存
nums_gen = (i for i in range(10**7))
print(sum(nums_gen))  # 仍然可以求和
```

### 六、代码规范

#### 6.1 PEP 8 要点

-   缩进用 **4 个空格**，不用 Tab
-   变量名用小写 + 下划线（`my_var`）
-   常量用大写（`MAX_SIZE`）
-   类名用驼峰（`MyClass`）
-   函数名用小写 + 下划线（`my_function`）
-   每行不超过 79 个字符
-   代码前后留空行

#### 6.2 类型注解

```python
def add(a: int, b: int) -> int:
    """返回两个整数的和"""
    return a + b

# 类型注解提高可读性，配合 mypy 可静态检查
```

### 七、实战：优化一个慢函数

```python
import time
from functools import lru_cache

# 原始版本（慢）
def count_primes_below(n):
    primes = []
    for num in range(2, n):
        if all(num % p != 0 for p in primes):
            primes.append(num)
    return len(primes)

# 优化版本（快）
@lru_cache(maxsize=None)
def optimized_count(n):
    if n < 2:
        return 0
    sieve = [True] * n
    sieve[0] = sieve[1] = False
    for i in range(2, int(n ** 0.5) + 1):
        if sieve[i]:
            for j in range(i*i, n, i):
                sieve[j] = False
    return sum(sieve)

start = time.perf_counter()
print(f"慢版本：{count_primes_below(20000)} 个素数")
print(f"耗时：{time.perf_counter() - start:.2f}s")

start = time.perf_counter()
print(f"快版本：{optimized_count(20000)} 个素数")
print(f"耗时：{time.perf_counter() - start:.2f}s")
```

### 系列总结

恭喜你完成 **Python 入门教程系列** 的全部 10 篇文章！

| 篇目 | 主题 |
| --- | --- |
| 1 | Python 入门：基础语法 |
| 2 | 面向对象编程（OOP） |
| 3 | 文件操作与异常处理 |
| 4 | 常用标准库与实用技巧 |
| 5 | 网络编程与数据抓取 |
| 6 | 多线程与多进程 |
| 7 | 数据库操作入门 |
| 8 | 数据分析入门（NumPy 与 Pandas） |
| 9 | Web 开发入门（Flask） |
| 10 | 调试技巧与性能优化 |

学习建议：

1.  **多写代码**：每篇的示例都亲手敲一遍
2.  **多实践**：把实战项目扩展成自己的作品
3.  **善用文档**：遇到问题先查 [Python 官方文档](https://docs.python.org/zh-cn/3/)
4.  **坚持输出**：把学到的知识写成博客，教学相长

感谢阅读，祝你编程之路一帆风顺！
