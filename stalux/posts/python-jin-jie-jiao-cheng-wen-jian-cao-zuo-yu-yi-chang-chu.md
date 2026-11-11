---
title: "Python进阶教程：文件操作与异常处理"
abbrlink: python-jin-jie-jiao-cheng-wen-jian-cao-zuo-yu-yi-chang-chu
date: "2026-08-15 10:56:30"
categories:
    - "Python"
tags: []
desc: "本文是Python入门教程系列的第三篇，主要讲解文件操作和异常处理。内容包括：文件打开与关闭（推荐使用with语句）、不同文件模式（r/w/a等）、读写文件方法（read/readline/for循环…"
---
#### 目录

-   [Python进阶教程：文件操作与异常处理](#Python_2)
-   -   [一、文件操作基础](#_6)
    -   -   [1.1 打开与关闭文件](#11__8)
        -   [1.2 文件打开模式](#12__23)
    -   [二、读取文件](#_33)
    -   [三、写入文件](#_48)
    -   [四、异常处理](#_64)
    -   -   [4.1 try / except](#41_try__except_66)
        -   [4.2 try / except / else / finally](#42_try__except__else__finally_82)
        -   [4.3 主动抛出异常 raise](#43__raise_97)
    -   [五、常用文件操作](#_113)
    -   [六、实战：日志记录器](#_134)
    -   [总结](#_166)

> 本文是 **Python 入门教程系列** 的第 3 篇。上一篇讲解了面向对象编程（OOP），本篇介绍开发中高频使用的**文件操作**与**异常处理**。

### 一、文件操作基础

#### 1.1 打开与关闭文件

用内置函数 open() 打开文件：

```python
# 方式一：手动关闭
f = open("data.txt", "r", encoding="utf-8")
content = f.read()
f.close()  # 一定要关闭文件

# 方式二：with 语句（推荐，自动关闭）
with open("data.txt", "r", encoding="utf-8") as f:
    content = f.read()
```

#### 1.2 文件打开模式

| 模式 | 说明 |
| --- | --- |
| r | 只读（默认） |
| w | 写入，会清空原内容 |
| a | 追加，在末尾添加 |
| r+ | 读写 |
| rb / wb | 二进制读写 |

### 二、读取文件

```python
with open("data.txt", "r", encoding="utf-8") as f:
    # 读取全部内容
    content = f.read()

    # 读取一行
    # line = f.readline()

    # 逐行读取（推荐大文件）
    # for line in f:
    #     print(line.strip())
```

### 三、写入文件

```python
# 覆盖写入
with open("output.txt", "w", encoding="utf-8") as f:
    f.write("第一行
")
    f.write("第二行
")

# 追加写入
with open("output.txt", "a", encoding="utf-8") as f:
    f.write("追加的内容
")
```

### 四、异常处理

#### 4.1 try / except

程序运行时可能出错，用 try/except 捕获异常，避免程序崩溃：

```python
try:
    num = int(input("请输入数字："))
    print(10 / num)
except ValueError:
    print("输入的不是数字！")
except ZeroDivisionError:
    print("不能除以零！")
except Exception as e:
    print(f"发生错误：{e}")
```

#### 4.2 try / except / else / finally

```python
try:
    f = open("config.txt", "r", encoding="utf-8")
    print(f.read())
except FileNotFoundError:
    print("文件不存在")
else:
    print("读取成功，没有异常")
finally:
    print("无论是否异常都会执行")
    f.close()
```

#### 4.3 主动抛出异常 raise

```python
def check_age(age):
    if age < 0:
        raise ValueError("年龄不能为负数")
    if age < 18:
        raise Exception("未成年人禁止访问")
    print("欢迎访问")

try:
    check_age(-5)
except ValueError as e:
    print(e)  # 年龄不能为负数
```

### 五、常用文件操作

```python
import os

# 判断文件是否存在
print(os.path.exists("data.txt"))  # True / False

# 重命名文件
os.rename("old.txt", "new.txt")

# 删除文件
os.remove("temp.txt")

# 创建目录
os.makedirs("mydir", exist_ok=True)

# 列出目录内容
print(os.listdir("."))
```

### 六、实战：日志记录器

综合运用文件操作与异常处理，实现一个简单的日志记录器：

```python
import os
import time

def log(message):
    """将消息追加写入日志文件"""
    with open("app.log", "a", encoding="utf-8") as f:
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        f.write(f"[{timestamp}] {message}
")

def divide(a, b):
    try:
        result = a / b
        log(f"计算 {a}/{b} = {result}")
        return result
    except ZeroDivisionError:
        log("错误：除数为零")
        print("除数为零，记录到日志")

# 测试
divide(10, 2)   # 正常记录
divide(10, 0)   # 记录错误
print("查看 app.log 内容：")
with open("app.log", "r", encoding="utf-8") as f:
    print(f.read())
```

### 总结

本篇讲解了文件读写、异常处理（try/except/else/finally/raise）和常用文件操作，并用日志记录器串联实战。下一篇将介绍**常用标准库与实用技巧**，敬请关注！
