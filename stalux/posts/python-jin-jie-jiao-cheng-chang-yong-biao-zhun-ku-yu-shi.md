---
title: "Python进阶教程：常用标准库与实用技巧"
abbrlink: python-jin-jie-jiao-cheng-chang-yong-biao-zhun-ku-yu-shi
date: "2026-08-15 10:57:35"
categories:
    - "Python"
tags: []
desc: "摘要： 本文是Python入门系列第4篇，重点讲解常用标准库与实用技巧。涵盖os/sys（系统操作）、datetime（日期处理）、json（数据交换）、re（正则表达式）、random/collec…"
---
#### 目录

-   [Python进阶教程：常用标准库与实用技巧](#Python_2)
-   -   [一、标准库概览](#_6)
    -   [二、os 与 sys：系统操作](#os__sys_23)
    -   [三、datetime：日期时间](#datetime_47)
    -   [四、json：数据交换](#json_65)
    -   [五、re：正则表达式](#re_89)
    -   [六、random 与 collections](#random__collections_111)
    -   [七、itertools 与 functools](#itertools__functools_132)
    -   [八、实战：数据统计小工具](#_161)
    -   [总结](#_191)

> 本文是 **Python 入门教程系列** 的第 4 篇。前三篇分别介绍了基础语法、面向对象编程、文件操作与异常处理。本篇介绍日常开发中最常用的**标准库**和实用技巧。

### 一、标准库概览

Python 自带的**标准库**非常丰富，安装 Python 即可使用，无需额外安装。以下是常用标准库速查：

| 库 | 用途 |
| --- | --- |
| os | 操作系统接口（文件、目录、路径） |
| sys | 系统相关参数与函数 |
| datetime | 日期时间处理 |
| json | JSON 数据解析与生成 |
| re | 正则表达式 |
| random | 随机数 |
| collections | 高级容器（Counter、defaultdict） |
| itertools | 迭代器工具 |
| functools | 函数式编程工具 |
| urllib / requests | 网络请求 |

### 二、os 与 sys：系统操作

```python
import os
import sys

# 当前工作目录
print(os.getcwd())

# 拼接路径（跨平台）
path = os.path.join("data", "config.json")
print(path)

# 遍历目录
for root, dirs, files in os.walk("."):
    for f in files:
        print(os.path.join(root, f))

# 系统信息
print(sys.version)          # Python 版本
print(sys.platform)         # 操作系统
print(sys.argv)             # 命令行参数
```

### 三、datetime：日期时间

```python
from datetime import datetime, timedelta

now = datetime.now()
print(now)                     # 2026-08-14 10:30:00.123456
print(now.strftime("%Y-%m-%d %H:%M:%S"))  # 格式化输出

# 日期运算
tomorrow = now + timedelta(days=1)
print(tomorrow.strftime("%Y-%m-%d"))

# 解析字符串为日期
d = datetime.strptime("2026-08-14", "%Y-%m-%d")
print(d.weekday())  # 星期几（0=周一）
```

### 四、json：数据交换

JSON 是前后端数据交换的标准格式，Python 处理起来非常方便：

```python
import json

# Python 对象 -> JSON 字符串
data = {"name": "Alice", "age": 20, "hobbies": ["reading", "coding"]}
json_str = json.dumps(data, ensure_ascii=False, indent=2)
print(json_str)

# JSON 字符串 -> Python 对象
parsed = json.loads(json_str)
print(parsed["name"])  # Alice

# 读写 JSON 文件
with open("data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

with open("data.json", "r", encoding="utf-8") as f:
    loaded = json.load(f)
```

### 五、re：正则表达式

正则表达式用于字符串模式匹配，是文本处理利器：

```python
import re

text = "我的邮箱是 alice@example.com，备用邮箱 bob@test.org"

# 查找所有邮箱
emails = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text)
print(emails)  # ['alice@example.com', 'bob@test.org']

# 匹配并替换
new_text = re.sub(r"\d+", "#", "订单号 12345 金额 99")
print(new_text)  # 订单号 # 金额 #

# 判断是否匹配
if re.match(r"^\d{6}$", "123456"):
    print("是6位数字")
```

### 六、random 与 collections

```python
import random
from collections import Counter, defaultdict

# 随机数
print(random.randint(1, 100))   # 1~100 随机整数
print(random.choice(["a", "b", "c"]))  # 随机选择

# 统计元素出现次数
words = ["apple", "banana", "apple", "orange", "apple"]
counter = Counter(words)
print(counter.most_common(2))  # [("apple", 3), ("banana", 1)]

# 带默认值的字典
d = defaultdict(list)
d["key"].append(1)  # 不会报 KeyError
print(d)  # defaultdict(<class 'list'>, {'key': [1]})
```

### 七、itertools 与 functools

```python
from itertools import chain, product, groupby
from functools import lru_cache, partial

# 链式拼接
print(list(chain([1, 2], [3, 4])))  # [1, 2, 3, 4]

# 笛卡尔积
print(list(product([1, 2], ["a", "b"])))  # [(1,'a'), (1,'b'), (2,'a'), (2,'b')]

# 缓存函数结果（性能优化）
@lru_cache(maxsize=128)
def fib(n):
    if n < 2:
        return n
    return fib(n-1) + fib(n-2)

print(fib(50))  # 瞬间返回 12586269025

# 偏函数（固定部分参数）
def power(base, exp):
    return base ** exp

square = partial(power, exp=2)
print(square(5))  # 25
```

### 八、实战：数据统计小工具

综合运用标准库，写一个文本词频统计工具：

```python
import re
import os
from collections import Counter

def word_frequency(filepath, top_n=10):
    """统计文本文件中出现最多的前 N 个单词"""
    if not os.path.exists(filepath):
        print(f"文件不存在：{filepath}")
        return

    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read().lower()

    # 用正则提取英文单词
    words = re.findall(r"\b[a-z]+\b", text)
    counter = Counter(words)

    print(f"共 {len(words)} 个单词，前 {top_n} 个高频词：")
    for word, count in counter.most_common(top_n):
        print(f"{word}: {count} 次")

# 使用示例
word_frequency("article.txt", top_n=5)
```

### 总结

本篇介绍了 os、sys、datetime、json、re、random、collections、itertools、functools 等常用标准库，并通过词频统计工具串联实战。掌握标准库能显著提升开发效率。系列已更新 4 篇：基础语法 → 面向对象 → 文件与异常 → 标准库，后续可根据需要继续扩展（如网络编程、多线程、数据库操作等）。
