---
title: "C++综合实战：网络编程入门与HTTP客户端"
abbrlink: c-zong-he-shi-zhan-wang-luo-bian-cheng-ru-men-yu-http-ke-hu
date: "2026-09-02 20:01:00"
categories:
    - "C与C++"
tags: []
desc: "Socket 基础（客户端/服务器模型与 TCP 通信四步）、HTTP 协议（请求/响应格式、方法、状态码）、迷你 HTTP 客户端（构造 GET 请求、解析响应头与…"
---
> 本文是 C++ 系列教程的第 29 篇。上一篇完成了面向对象图书管理系统，本篇实战网络编程：Socket 基础与 TCP 通信、HTTP 协议解析、迷你 HTTP 客户端实现与简易服务器，覆盖 9 个完整示例代码。

## 一、网络编程基础

### 1.1 客户端/服务器模型与 Socket

网络通信的核心模型：**服务器**监听端口等待连接，**客户端**主动发起连接。**Socket（套接字）**是操作系统提供的网络编程接口，屏蔽底层协议细节：

```
客户端                    服务器
  |                         |
  |----  connect() -------->|  监听 listen()
  |                         |  接受 accept()
  |<--  send/recv 数据 ---->|
  |                         |
  |----  close() ---------->|  close()
```

TCP 提供**可靠、有序、面向连接**的字节流传输，HTTP、FTP、SSH 等协议都建立在 TCP 之上。

### 1.2 TCP 客户端完整示例（Windows + Linux 通用思路）

```cpp
// tcp_client.cpp —— 简易 TCP 客户端
#include <iostream>
#include <cstring>
using namespace std;

// 说明：Windows 用 Winsock，Linux 用 POSIX socket，头文件不同。
// 为便于演示
，这里给出 Linux/POSIX 版本核心代码。

#include <sys/socket.h>
#include <arpa/inet.h>
#include <unistd.h>

int main() {
    int sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0) { cerr << "创建 socket 失败" << endl; return 1; }

    sockaddr_in server{};
    server.sin_family = AF_INET;
    server.sin_port = htons(8080);
    inet_pton(AF_INET, "127.0.0.1", &server.sin_addr);

    if (connect(sock, (sockaddr*)&server, sizeof(server)) < 0) {
        cerr << "连接失败" << endl;
        return 1;
    }
    cout << "已连接服务器!" << endl;

    const char* msg = "Hello Server!";
    send(sock, msg, strlen(msg), 0);

    char buffer[1024] = {};
    int n = recv(sock, buffer, sizeof(buffer), 0);
    if (n > 0) cout << "收到回复: " << buffer << endl;

    close(sock);
    return 0;
}
```

关键步骤：`socket()` 创建套接字 → `connect()` 连接服务器 → `send()`/`recv()` 收发数据 → `close()` 关闭。`htons` 把端口转为网络字节序。

## 二、HTTP 协议

### 2.1 HTTP 请求与响应格式

HTTP 是**请求-响应**模型：客户端发请求，服务器回响应。请求由「请求行 + 请求头 + 空行 + 请求体」组成
：

```http
GET /index.html HTTP/1.1          ← 请求行：方法 路径 协议版本
Host: www.example.com              ← 请求头（键: 值）
User-Agent: MyCppClient/1.0
Accept: */*
                                   ← 空行（必须）
（请求体，GET 通常为空）
```

响应由「状态行 + 响应头 + 空行 + 响应体」组成：

```http
HTTP/1.1 200 OK                   ← 状态行：版本 状态码 原因短语
Content-Type: text/html
Content-Length: 1256

<html><body>...</body></html>     ← 响应体
```

### 2.2 常用 HTTP 方法与状态码

| 方法 | 用途 | 状态码 | 含义 |
| --- | --- | --- | --- |
| GET | 获取资源 | 200 OK | 成功 |
| POST | 提交数据 | 201 Created | 已创建 |
| PUT | 更新资源 | 301 Moved | 永久重定向 |
| DELETE | 删除资源 | 404 Not Found | 资源不存在 |
| HEAD | 只取响应头 | 500 Internal Server Error | 服务器错误 |

## 三、迷你 HTTP 客户端

### 3.1 构造请求并解析响应

写一个简化版 HTTP 客户端：连接服务器、发送 GET 请求、读取并解析响应头与响应体：

```cpp
// mini_http_client.cpp —— 迷你 HTTP 客户端（Linux 版核心逻辑）
#
include <iostream>
#include <string>
#include <cstring>
using namespace std;

#include <sys/socket.h>
#include <arpa/inet.h>
#include <unistd.h>

// 解析响应头中的 Content-Length
int extractContentLength(const string& header) {
    size_t pos = header.find("Content-Length:");
    if (pos == string::npos) return -1;
    pos += 15;   // 跳过 "Content-Length: "
    size_t end = header.find("\r\n", pos);
    return stoi(header.substr(pos, end - pos));
}

int main() {
    int sock = socket(AF_INET, SOCK_STREAM, 0);
    sockaddr_in server{};
    server.sin_family = AF_INET;
    server.sin_port = htons(80);                    // HTTP 默认端口
    inet_pton(AF_INET, "93.184.216.34", &server.sin_addr);  // example.com

    if (connect(sock, (sockaddr*)&server, sizeof(server)) < 0) {
        cerr << "连接失败" << endl;
        return 1;
    }

    // 构造 GET 请求
    string request =
        "GET / HTTP/1.1\r\n"
        "Host: example.com\r\n"
        "User-Agent: MiniCppClient/1.0\r\n"
        "Connection: close\r\n"      // 响应后关闭连接
        "\r\n";
    send(sock, request.c_str(), request.size(), 0);

    // 读取响应
    string response;
    char buffe
r[4096];
    int n;
    while ((n = recv(sock, buffer, sizeof(buffer), 0)) > 0) {
        response.append(buffer, n);
    }
    close(sock);

    // 分离响应头与响应体
    size_t headerEnd = response.find("\r\n\r\n");
    string header = response.substr(0, headerEnd);
    string body = response.substr(headerEnd + 4);

    cout << "===== 状态行 =====" << endl;
    cout << header.substr(0, header.find("\r\n")) << endl;
    cout << "===== 响应体前 200 字符 =====" << endl;
    cout << body.substr(0, 200) << endl;

    int contentLen = extractContentLength(header);
    cout << "Content-Length: " << contentLen
         << "（实际收到 " << body.size() << " 字节）" << endl;
    return 0;
}
```

`Connection: close` 告诉服务器响应后关闭连接，客户端循环 `recv` 直到收到 0 字节即响应结束。

### 3.2 用系统命令快速验证

```bash
# 命令行验证 HTTP（Linux/macOS）
curl -v http://example.com/
curl -I http://example.com/          # 只取响应头

# Windows PowerShell
Invoke-WebRequest -Uri http://example.com/ | Select-Object -ExpandProperty Content
```

用 `curl` 对照自己实现的客户端输出，能直观确认请求格式是否正确。

## 四、简易 TCP 服务器

### 4.1 单线程服务器

```cpp
// tcp_server.cpp —— 简易 TCP 服务器（Linux 版）
#include <iostream>
#include <cstring>
using namespace std;

#include <sys/socket.h>
#include <arpa/inet.h>
#include <unistd.h>

int main() {
    int server = socket(AF_INET, SOCK_STREAM, 0);

    // 允许端口复用（避免 TIME_WAIT 导致 bind 失败）
    int opt = 1;
    setsockopt(server, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;      // 监听所有网卡
    addr.sin_port = htons(8080);

    bind(server, (sockaddr*)&addr, sizeof(addr));
    listen(server, 5);                       // 最大等待队列 5
    cout << "服务器监听 8080 端口..." << endl;

    sockaddr_in client{};
    socklen_t len = sizeof(client);
    int conn = accept(server, (sockaddr*)&client, &len);
    cout << "客户端已连接!" << endl;

    char buffer[1024] = {};
    int n = recv(conn, buffer, sizeof(buffer), 0);
    if (n > 0) {
        cout << "收到: " << buffer << endl;
        const char* reply = "Hello from server!";
        send(conn, reply, st
rlen(reply), 0);
    }

    close(conn);
    close(server);
    return 0;
}
```

服务器四步：`socket()` → `bind()` 绑定端口 → `listen()` 开始监听 → `accept()` 接受连接。之后与客户端收发数据。

### 4.2 简易 HTTP 服务器

把响应改为 HTTP 格式，就是一个迷你 Web 服务器：

```cpp
// mini_http_server.cpp —— 返回固定 HTML 页面的 HTTP 服务器
#include <iostream>
#include <cstring>
using namespace std;

#include <sys/socket.h>
#include <arpa/inet.h>
#include <unistd.h>

int main() {
    int server = socket(AF_INET, SOCK_STREAM, 0);
    int opt = 1;
    setsockopt(server, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons(8080);

    bind(server, (sockaddr*)&addr, sizeof(addr));
    listen(server, 5);
    cout << "HTTP 服务器: http://127.0.0.1:8080/" << endl;

    while (true) {                       // 循环接受多个客户端
        sockaddr_in client{};
        socklen_t len = sizeof(client);
        int conn = accept(server, (sockaddr*)&client, &len);

        char buffer[4096] = {};
        recv(c
onn, buffer, sizeof(buffer), 0);   // 读取请求（此处忽略内容）

        string body = "<html><body><h1>Hello C++!</h1>"
                      "<p>这是一个 C++ HTTP 服务器</p></body></html>";
        string response =
            "HTTP/1.1 200 OK\r\n"
            "Content-Type: text/html; charset=utf-8\r\n"
            "Content-Length: " + to_string(body.size()) + "\r\n"
            "Connection: close\r\n"
            "\r\n" + body;

        send(conn, response.c_str(), response.size(), 0);
        close(conn);
    }
    close(server);
    return 0;
}
```

浏览器访问 `http://127.0.0.1:8080/` 即可看到返回的页面。`Content-Length` 必须与实际 body 字节数一致，否则浏览器可能显示不完整。

## 五、实战：带参数的 HTTP 请求

### 5.1 GET 带查询参数

```cpp
// http_get_with_query.cpp —— 带查询参数的 GET（核心片段）
#include <iostream>
#include <string>
using namespace std;

#include <sys/socket.h>
#include <arpa/inet.h>
#include <unistd.h>

// URL 编码（简单版）：空格转 %20
string urlEncode(const string& s) {
    string result;
    for (char c : s) {
        if (c == ' ') result += "%20";

else result += c;
    }
    return result;
}

int main() {
    string keyword = "C++ 教程";
    string path = "/search?q=" + urlEncode(keyword);

    string request =
        "GET " + path + " HTTP/1.1\r\n"
        "Host: example.com\r\n"
        "Connection: close\r\n"
        "\r\n";

    cout << "发送请求:" << endl;
    cout << request << endl;
    cout << "（完整客户端逻辑同 3.1 节，此处演示请求构造）" << endl;
    return 0;
}
```

查询参数放在 `?` 之后、`&` 分隔多个键值对；特殊字符（空格、中文）需 URL 编码。

### 5.2 常见问题排查

| 问题 | 可能原因 | 排查方法 |
| --- | --- | --- |
| 连接失败 | 端口/地址错误、服务器未启动 | `netstat -an |
| 响应为空 | 请求格式错误、未发空行 | 用 curl 对照请求文本 |
| 中文乱码 | 编码未指定 | 响应头加 `charset=utf-8` |
| Content-Length 不匹配 | body 计算错误 | 用 `body.size()` 而不是手写数字 |
| 端口占用 | 前次连接未释放 | `SO_REUSEADDR` 或等 TIME_WAIT 结束 |

## 总结

本篇讲解了 C++ 网络编程入门：**Socket 基础**（客户端/服务器模型与 TCP 通信四步）、**HTTP 协议**（请求/响应格式、方法、状态码）、**迷你 HTTP 客户端**（构造 GET 请求、解析响应头与 Content-Length）、**简易 TCP/HTTP 服务器**（bind/listen/accept 循环）与带查询参数的请求构造及常见问题排查。建议用 `curl` 对照验证，并在本机 8080 端口跑通客户端-服务器闭环。

下一篇将是系列终章 **C++ 综合实战：数据结构与算法实现及系列总结**（手写容器、排序算法与 30 篇回顾），敬请期待！
