---
title: "Python进阶教程：网络编程与数据抓取"
abbrlink: python-jin-jie-jiao-cheng-wang-luo-bian-cheng-yu-shu-ju
date: "2026-08-16 02:24:18"
categories:
    - "Python"
tags: []
desc: "本文介绍了Python网络编程与数据抓取的基础知识，涵盖HTTP协议、urllib和requests库的使用、BeautifulSoup解析HTML以及爬虫规范…"
---
#### 目录

-   [Python进阶教程：网络编程与数据抓取](#Python_2)
-   -   [一、HTTP 基础](#HTTP__6)
    -   [二、urllib：标准库 HTTP 客户端](#urllib_HTTP__17)
    -   [三、requests：更优雅的 HTTP 库](#requests_HTTP__37)
    -   [四、HTML 解析：BeautifulSoup](#HTML_BeautifulSoup_64)
    -   [五、实战：抓取网页文章标题](#_97)
    -   [六、爬虫的注意事项](#_128)
    -   [七、进阶：接口调用（API）](#API_149)
    -   [总结](#_171)

> 本文是 **Python 入门教程系列** 的第 5 篇。前面四篇介绍了基础语法、OOP、文件操作、常用标准库，本篇介绍**网络编程**与**数据抓取**（爬虫基础）。

### 一、HTTP 基础

网络编程的核心是 HTTP 协议。HTTP 请求主要由四部分组成：

-   **方法**：GET（获取）、POST（提交）、PUT、DELETE 等
-   **URL**：资源地址
-   **请求头**：User-Agent、Cookie、Content-Type 等
-   **请求体**：POST 时携带的数据

响应同样包含状态码（200 成功、404 不存在、500 服务器错误）、响应头和响应体。

### 二、urllib：标准库 HTTP 客户端

```python
import urllib.request
import urllib.parse

# GET 请求
url = "https://httpbin.org/get"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req, timeout=10) as resp:
    print(resp.status)      # 200
    print(resp.read().decode("utf-8")[:200])

# POST 请求
data = urllib.parse.urlencode({"name": "Alice", "age": 20}).encode()
req = urllib.request.Request("https://httpbin.org/post", data=data)
with urllib.request.urlopen(req) as resp:
    print(resp.read().decode("utf-8")[:200])
```

### 三、requests：更优雅的 HTTP 库

requests 是第三方库（`pip install requests`），是实际开发中的首选：

```python
import requests

# GET 请求
resp = requests.get("https://httpbin.org/get", params={"q": "python"}, timeout=10)
print(resp.status_code)   # 200
print(resp.json())        # 自动解析 JSON

# POST 请求
resp = requests.post("https://httpbin.org/post", json={"name": "Alice"})
print(resp.json())

# 自定义请求头（模拟浏览器）
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
resp = requests.get("https://httpbin.org/headers", headers=headers)

# 下载文件
resp = requests.get("https://httpbin.org/image/png", stream=True)
with open("image.png", "wb") as f:
    for chunk in resp.iter_content(chunk_size=8192):
        f.write(chunk)
```

### 四、HTML 解析：BeautifulSoup

抓取网页后需要解析 HTML，BeautifulSoup 是最常用的工具（`pip install beautifulsoup4`）：

```python
from bs4 import BeautifulSoup
import requests

html = """
<html><body>
  <h1>Python 教程</h1>
  <div class="article">
    <a href="/p1">第一篇</a>
    <a href="/p2">第二篇</a>
  </div>
</body></html>
"""

soup = BeautifulSoup(html, "html.parser")

# 获取标题
print(soup.h1.text)                # Python 教程

# 按 class 查找
div = soup.find("div", class_="article")

# 查找所有链接
for a in div.find_all("a"):
    print(a.text, a["href"])
# 第一篇 /p1
# 第二篇 /p2
```

### 五、实战：抓取网页文章标题

综合运用以上知识，写一个抓取网页所有链接和标题的小工具：

```python
import requests
from bs4 import BeautifulSoup

def fetch_links(url):
    """抓取页面中所有链接及其文本"""
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()  # 非 200 会抛出异常

        soup = BeautifulSoup(resp.text, "html.parser")
        links = []
        for a in soup.find_all("a", href=True):
            text = a.text.strip() or "(无文本)"
            links.append((text[:30], a["href"]))
        return links
    except requests.RequestException as e:
        print(f"请求失败：{e}")
        return []

# 使用示例
url = "https://example.com"
for text, href in fetch_links(url)[:10]:
    print(f"{text} -> {href}")
```

### 六、爬虫的注意事项

合法、规范的爬虫需要注意：

1.  **遵守 robots.txt**：访问站点前检查 `https://站点/robots.txt` 了解允许爬取的内容。
2.  **控制请求频率**：用 time.sleep 间隔请求，避免给服务器造成压力。
3.  **设置合理 UA**：识别为真实浏览器，但不要伪装成他人。
4.  **尊重版权**：只抓取允许的数据，注意使用条款。
5.  **反爬处理**：遇到验证码、登录墙时不要强行绕过。

```python
import time
import requests

urls = ["https://httpbin.org/get"] * 5
for url in urls:
    resp = requests.get(url, timeout=10)
    print(resp.status_code)
    time.sleep(2)  # 每 2 秒请求一次，礼貌抓取
```

### 七、进阶：接口调用（API）

现代开发更多是调用 API 获取 JSON 数据，配合上篇的 json 库非常方便：

```python
import requests
import json

def call_api(url, params=None):
    resp = requests.get(url, params=params, timeout=10)
    if resp.status_code == 200:
        return resp.json()
    else:
        print(f"API 返回错误：{resp.status_code}")
        return None

# 调用公开 API 获取天气信息（示例）
data = call_api("https://httpbin.org/json")
if data:
    print(json.dumps(data, ensure_ascii=False, indent=2))
```

### 总结

本篇介绍了 HTTP 基础、urllib 与 requests 两种 HTTP 客户端、BeautifulSoup 网页解析、以及爬虫的规范与注意事项，并提供了两个实战工具。下一篇将介绍**多线程与多进程**，敬请期待！
