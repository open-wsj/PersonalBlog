---
title: "Python进阶教程：正则表达式进阶与文本处理"
abbrlink: python-jin-jie-jiao-cheng-zheng-ze-biao-da-shi-jin-jie-yu
date: "2026-08-20 09:51:14"
categories:
    - "Python"
tags: []
desc: "本篇深入讲解了正则的分组捕获、贪婪匹配、前后断言、预编译等进阶技巧，并提供了日志解析和文本清理两个实战工具。正则表达式是文本处理的瑞士军刀，值得花时间熟练掌握。"
---
#### 目录

-   [Python进阶教程：正则表达式进阶与文本处理](#Python_2)
-   -   [一、正则基础回顾](#_6)
    -   [二、分组与捕获](#_20)
    -   [三、贪婪与非贪婪](#_42)
    -   [四、常用高级技巧](#_58)
    -   -   [4.1 前后查找](#41__60)
        -   [4.2 忽略大小写与多行](#42__76)
        -   [4.3 替换与回调](#43__91)
    -   [五、compile 预编译](#compile__108)
    -   [六、实战：日志解析器](#_123)
    -   [七、文本处理实用工具](#_151)
    -   -   [7.1 清理文本](#71__153)
        -   [7.2 提取中文与数字](#72__170)
    -   [总结](#_187)

> 本文是 **Python 入门教程系列** 的第 11 篇（扩展篇）。前面第 4 篇介绍了 re 模块的基础用法，本篇深入讲解**正则表达式进阶**技巧与文本处理实战。

### 一、正则基础回顾

```python
import re

# 常用元字符
# . 任意字符  \d 数字  \w 单词字符  \s 空白
# * 零次或多次  + 一次或多次  ? 零次或一次
# {n} 恰好n次  {n,m} n到m次  ^ 开头  $ 结尾

# 基础匹配
print(re.findall(r"\d+", "订单123号，金额456元"))  # ["123", "456"]
```

### 二、分组与捕获

用括号分组，可以提取匹配的子部分：

```python
import re

text = "张三的电话是138-1234-5678"

# 分组捕获
match = re.search(r"(\d{3})-(\d{4})-(\d{4})", text)
if match:
    print(match.group(0))  # 138-1234-5678 整体
    print(match.group(1))  # 138
    print(match.group(2))  # 1234
    print(match.group(3))  # 5678

# 命名分组
match = re.search(r"(?P<area>\d{3})-(?P<mid>\d{4})-(?P<last>\d{4})", text)
print(match.group("area"))  # 138
```

### 三、贪婪与非贪婪

```python
import re

html = "<div>内容1</div><div>内容2</div>"

# 贪婪模式：尽可能多匹配
greedy = re.findall(r"<div>.*</div>", html)
print(greedy)  # ["<div>内容1</div><div>内容2</div>"]

# 非贪婪模式：加 ?
lazy = re.findall(r"<div>.*?</div>", html)
print(lazy)  # ["<div>内容1</div>", "<div>内容2</div>"]
```

### 四、常用高级技巧

#### 4.1 前后查找

```python
import re

text = "价格：$100，折扣价：$80"

# 正向断言 (?=...) 匹配后面跟着的内容
prices = re.findall(r"\d+(?=元)", "苹果5元，香蕉3元")
print(prices)  # ["5", "3"]

# 反向断言 (?<=...)
prices2 = re.findall(r"(?<=\$)\d+", text)
print(prices2)  # ["100", "80"]
```

#### 4.2 忽略大小写与多行

```python
import re

# re.IGNORECASE 忽略大小写
print(re.findall(r"python", "Python PYTHON python", re.IGNORECASE))  # 3个

# re.MULTILINE ^ $ 匹配每行
text = "line1
line2
line3"
print(re.findall(r"^line", text, re.MULTILINE))  # ["line", "line", "line"]
```

#### 4.3 替换与回调

```python
import re

# 简单替换
print(re.sub(r"\d+", "#", "订单123金额456"))  # 订单#金额#

# 回调函数替换
def hide_phone(match):
    return match.group(0)[:3] + "****" + match.group(0)[-4:]

text = "联系：13812345678 或 13987654321"
print(re.sub(r"1\d{10}", hide_phone, text))
# 联系：138****5678 或 139****4321
```

### 五、compile 预编译

多次使用同一正则时，先编译成 Pattern 对象可提升性能：

```python
import re

# 预编译（推荐）
phone_pattern = re.compile(r"1[3-9]\d{9}")

text = "电话1：13812345678，电话2：15987654321"
print(phone_pattern.findall(text))  # 两个号码
print(phone_pattern.search(text).group())  # 第一个号码
```

### 六、实战：日志解析器

```python
import re
from collections import Counter

log_text = """
2026-08-14 10:00:01 ERROR 数据库连接失败
2026-08-14 10:00:05 INFO 用户登录成功
2026-08-14 10:00:10 ERROR 接口超时
2026-08-14 10:01:02 INFO 用户登出
2026-08-14 10:01:30 WARN 磁盘空间不足
"""

def parse_log(text):
    """解析日志，统计各级别数量"""
    pattern = re.compile(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} (ERROR|INFO|WARN) (.+)")
    levels = Counter()
    for line in text.strip().splitlines():
        match = pattern.match(line)
        if match:
            levels[match.group(1)] += 1
    return levels

result = parse_log(log_text)
print(dict(result))  # {"ERROR": 2, "INFO": 2, "WARN": 1}
```

### 七、文本处理实用工具

#### 7.1 清理文本

```python
import re

def clean_text(text):
    """清理文本：去HTML标签、多余空白、特殊符号"""
    text = re.sub(r"<[^>]+>", "", text)   # 去HTML标签
    text = re.sub(r"\s+", " ", text)     # 合并空白
    text = re.sub(r"[^\w\u4e00-\u9fa5，。！？、；：""'
 ]", "", text)  # 去特殊符号
    return text.strip()

raw = "<p>你好，  世界！</p> @#$%^&*"
print(clean_text(raw))  # 你好， 世界！
```

#### 7.2 提取中文与数字

```python
import re

text = "华为Mate60 Pro售价6999元，支持5G网络"

# 提取中文
print(re.findall(r"[\u4e00-\u9fa5]+", text))  # ["华为", "售价", "元", "支持", "网络"]

# 提取数字
print(re.findall(r"\d+", text))  # ["60", "6999", "5"]

# 提取英文单词
print(re.findall(r"[a-zA-Z]+", text))  # ["Mate", "Pro"]
```

### 总结

本篇深入讲解了正则的分组捕获、贪婪匹配、前后断言、预编译等进阶技巧，并提供了日志解析和文本清理两个实战工具。正则表达式是文本处理的瑞士军刀，值得花时间熟练掌握。
