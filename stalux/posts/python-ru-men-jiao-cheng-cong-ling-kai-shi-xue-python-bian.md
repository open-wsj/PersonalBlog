---
title: "Python入门教程：从零开始学Python编程"
abbrlink: python-ru-men-jiao-cheng-cong-ling-kai-shi-xue-python-bian
date: "2026-08-14 16:25:38"
categories:
    - "Python"
tags: []
desc: "本文介绍了 Python 的安装、基础语法和一个小实战项目。学习编程最重要的是多敲代码，建议每天坚持练习。后续我会继续更新 Python 进阶教程（面向对象、文件操作、数据处理等），欢迎关注！"
---
#### 目录

-   [Python入门教程：从零开始学Python编程](#PythonPython_2)
-   -   [一、Python是什么？](#Python_4)
    -   [二、环境搭建](#_15)
    -   -   [2.1 安装 Python](#21__Python_17)
        -   [2.2 安装 IDE](#22__IDE_26)
    -   [三、第一个程序：Hello World](#Hello_World_30)
    -   [四、基础语法](#_44)
    -   -   [4.1 变量与数据类型](#41__46)
        -   [4.2 条件判断](#42__58)
        -   [4.3 循环](#43__70)
        -   [4.4 函数](#44__83)
    -   [五、实战：猜数字小游戏](#_92)
    -   [六、学习资源推荐](#_112)
    -   [总结](#_120)

### 一、Python是什么？

Python 是一种**简单易学、功能强大**的解释型高级编程语言，由 Guido van Rossum 于 1991 年发布。它广泛应用于：

-   Web 开发（Django、Flask）
-   数据分析与人工智能（NumPy、Pandas、TensorFlow）
-   自动化脚本与爬虫
-   运维与测试

Python 的语法简洁优雅，非常适合作为**第一门编程语言**学习。

### 二、环境搭建

#### 2.1 安装 Python

访问 [python.org](https://www.python.org) 下载最新版本，安装时务必勾选 **Add Python to PATH**。安装完成后打开终端验证：

```bash
python --version
# 输出示例: Python 3.12.4
```

#### 2.2 安装 IDE

推荐使用 **VS Code** 或 **PyCharm**，并安装 Python 扩展以获得代码补全与调试能力。

### 三、第一个程序：Hello World

用任意文本编辑器创建 hello.py，输入以下代码：

```python
print("Hello, World!")
```

在终端运行：

```bash
python hello.py
```

### 四、基础语法

#### 4.1 变量与数据类型

Python 是动态类型语言，不需要声明变量类型：

```python
name = "Alice"        # 字符串
age = 20               # 整数
score = 88.5           # 浮点数
is_student = True      # 布尔值
print(f"{name}今年{age}岁，成绩{score}分")
```

#### 4.2 条件判断

```python
age = 18
if age >= 18:
    print("成年了")
elif age >= 12:
    print("青少年")
else:
    print("未成年")
```

#### 4.3 循环

```python
# for 循环
for i in range(5):
    print(i)
# while 循环
count = 0
while count < 3:
    print(count)
    count += 1
```

#### 4.4 函数

```python
def add(a, b):
    return a + b
result = add(3, 5)
print(result)  # 输出 8
```

### 五、实战：猜数字小游戏

综合运用所学知识，编写一个猜数字游戏：

```python
import random
answer = random.randint(1, 100)
guess = None
count = 0
print("欢迎来到猜数字游戏！范围 1-100")
while guess != answer:
    guess = int(input("请输入你的猜测："))
    count += 1
    if guess > answer:
        print("太大了！")
    elif guess < answer:
        print("太小了！")
print(f"恭喜你，猜了{count}次就猜对了！")
```

### 六、学习资源推荐

| 资源 | 说明 |
| --- | --- |
| [Python 官方文档](https://docs.python.org/zh-cn/3/) | 最权威的语法参考 |
| [菜鸟教程](https://www.runoob.com/python3/python3-tutorial.html) | 中文入门教程 |
| [LeetCode](https://leetcode.cn) | 算法刷题平台 |

### 总结

本文介绍了 Python 的安装、基础语法和一个小实战项目。学习编程最重要的是**多敲代码**，建议每天坚持练习。后续我会继续更新 Python 进阶教程（面向对象、文件操作、数据处理等），欢迎关注！
