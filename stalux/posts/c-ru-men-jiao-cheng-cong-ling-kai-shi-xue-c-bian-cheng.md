---
title: "C++入门教程：从零开始学C++编程"
abbrlink: c-ru-men-jiao-cheng-cong-ling-kai-shi-xue-c-bian-cheng
date: "2026-08-26 01:11:30"
categories:
    - "C与C++"
tags: []
desc: "本文是C++入门教程的第一篇，主要介绍了C++的基本概念、开发环境搭建、基础语法和实战练习…"
---
> 本文是 C++ 系列教程的第 1 篇。本系列共 30 篇，从零基础一路讲到现代 C++（C++11/14/17/20）、STL、并发编程与工程实战。本篇目标：认识 C++、搭建开发环境、写出并理解第一个程序，掌握变量与基本数据类型。

### 一、C++ 是什么

C++ 是一门**编译型、静态类型**的通用编程语言，由 Bjarne Stroustrup 于 1983 年在贝尔实验室基于 C 语言扩展而来。它既保留 C 语言的高性能与底层控制能力，又引入了**面向对象**、**泛型编程**和**现代抽象**机制。

#### 1.1 为什么学 C++

| 优势 | 说明 |
| --- | --- |
| 性能极高 | 可直接操作内存、无运行时开销的抽象 |
| 应用广泛 | 游戏引擎（Unreal）、操作系统、浏览器（Chrome）、数据库、金融高频交易 |
| 就业需求大 | 后端、嵌入式、音视频、图形学、自动驾驶等领域核心语言 |
| 现代演进 | C++11/14/17/20 大幅改善易用性与安全性 |

#### 1.2 C++ 版本演进

-   **C++98/03**：经典 C++，面向对象与模板基础。
-   **C++11**：里程碑版本，引入 auto、智能指针、lambda、移动语义。
-   **C++14**：泛型 lambda、返回类型推导增强。
-   **C++17**：结构化绑定、if constexpr、std::optional、filesystem。
-   **C++20**：概念（concepts）、范围（ranges）、协程、三路比较。

#### 1.3 编译型语言的工作流程

```
源代码(.cpp) --编译器--> 目标代码(.obj) --链接器--> 可执行程序(.exe) --运行--> 输出结果
```

与 Python 等解释型语言不同，C++ 代码需要**先编译再运行**，这也带来了更高的执行效率。

### 二、环境搭建

#### 2.1 Windows 方案

推荐使用 **Visual Studio**（社区版免费）或 **Visual Studio Code + MinGW-w64**：

1.  安装 VS Code，安装 C/C++ 扩展。
2.  安装 MinGW-w64（含 g++ 编译器），并加入 PATH。
3.  命令行验证：`g++ --version`。

#### 2.2 第一个程序的编写与编译

新建 `hello.cpp`：

```cpp
#include <iostream>   // 引入输入输出库
using namespace std;  // 使用标准命名空间

int main() {
    cout << "Hello, World!" << endl;  // 输出一行文本
    return 0;                         // 返回 0 表示程序正常结束
}
```

在终端编译并运行：

```bash
g++ hello.cpp -o hello.exe
./hello.exe
```

输出：

```
Hello, World!
```

#### 2.3 逐行拆解第一个程序

| 代码 | 作用 |
| --- | --- |
| `#include <iostream>` | 预处理指令，引入标准输入输出头文件 |
| `using namespace std;` | 声明使用 std 命名空间，之后可直接写 cout |
| `int main()` | 主函数，程序入口，每个程序必须有且仅有一个 |
| `cout << "..."` | 输出流操作符，将内容送到标准输出 |
| `endl` | 换行并刷新缓冲区 |
| `return 0;` | 返回值给操作系统，0 表示成功 |

### 三、变量与基本数据类型

#### 3.1 基本数据类型

| 类型 | 大小（常见） | 取值范围（典型） | 说明 |
| --- | --- | --- | --- |
| `bool` | 1 字节 | true / false | 布尔型 |
| `char` | 1 字节 | -128 ~ 127 | 字符型 |
| `int` | 4 字节 | 约 ±21 亿 | 整型 |
| `float` | 4 字节 | 约 7 位有效数字 | 单精度浮点 |
| `double` | 8 字节 | 约 15 位有效数字 | 双精度浮点 |

#### 3.2 变量定义与初始化

```cpp
#include <iostream>
using namespace std;

int main() {
    // 多种初始化方式
    int age = 20;           // C 风格初始化
    int score(95);          // 构造函数风格
    int level{3};           // 列表初始化（C++11 推荐，防窄化）
    double pi = 3.14159;
    char grade = 'A';
    bool isPass = true;

    cout << "年龄：" << age << endl;
    cout << "分数：" << score << endl;
    cout << "等级：" << level << endl;
    cout << "圆周率：" << pi << endl;
    cout << "成绩等级：" << grade << endl;
    cout << "是否通过：" << (isPass ? "是" : "否") << endl;
    return 0;
}
```

**变量命名规则**：

-   只能由字母、数字、下划线组成，且不能以数字开头。
-   不能与关键字重名（如 int、if、class）。
-   建议使用有意义的名称，如 `studentCount` 而非 `s`。

#### 3.3 常量

```cpp
#include <iostream>
using namespace std;

#define PI 3.14             // 宏常量（预处理阶段替换）

int main() {
    const double E = 2.71828;  // const 常量（编译期检查）
    constexpr int MAX = 100;   // 编译期常量（C++11）

    cout << "PI = " << PI << endl;
    cout << "E = " << E << endl;
    cout << "MAX = " << MAX << endl;
    return 0;
}
```

### 四、输入输出

#### 4.1 基本输入输出

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    string name;
    int age;

    cout << "请输入你的姓名：";
    cin >> name;                 // 从键盘读取字符串（遇空白停止）

    cout << "请输入你的年龄：";
    cin >> age;

    cout << "你好，" << name << "！你今年 " << age << " 岁。" << endl;
    return 0;
}
```

#### 4.2 读取带空格的行

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    string fullName;
    cout << "请输入全名（可含空格）：";
    getline(cin, fullName);      // 读取一整行，包含空格
    cout << "你好，" << fullName << "！" << endl;
    return 0;
}
```

### 五、运算符初步

#### 5.1 算术运算符

```cpp
#include <iostream>
using namespace std;

int main() {
    int a = 10, b = 3;
    cout << "a + b = " << (a + b) << endl;   // 13
    cout << "a - b = " << (a - b) << endl;   // 7
    cout << "a * b = " << (a * b) << endl;   // 30
    cout << "a / b = " << (a / b) << endl;   // 3（整数除法，截断）
    cout << "a % b = " << (a % b) << endl;   // 1（取余）
    cout << "a / 3.0 = " << (a / 3.0) << endl; // 3.33333（浮点除法）
    return 0;
}
```

#### 5.2 类型转换

```cpp
#include <iostream>
using namespace std;

int main() {
    int total = 7, count = 2;
    double avg1 = total / count;             // 3（整数除法先执行）
    double avg2 = static_cast<double>(total) / count;  // 3.5（显式转换）
    double avg3 = total / 2.0;               // 3.5（隐式提升）

    cout << avg1 << endl;
    cout << avg2 << endl;
    cout << avg3 << endl;
    return 0;
}
```

### 六、实战：简易加法计算器

综合本篇知识，编写一个支持两个数的加减乘除计算器：

```cpp
#include <iostream>
using namespace std;

int main() {
    double num1, num2;
    char op;

    cout << "===== 简易计算器 =====" << endl;
    cout << "请输入第一个数：";
    cin >> num1;
    cout << "请输入运算符（+ - * /）：";
    cin >> op;
    cout << "请输入第二个数：";
    cin >> num2;

    double result;
    bool valid = true;

    switch (op) {
        case '+': result = num1 + num2; break;
        case '-': result = num1 - num2; break;
        case '*': result = num1 * num2; break;
        case '/':
            if (num2 == 0) {
                cout << "错误：除数不能为 0！" << endl;
                valid = false;
            } else {
                result = num1 / num2;
            }
            break;
        default:
            cout << "错误：不支持的运算符！" << endl;
            valid = false;
    }

    if (valid) {
        cout << num1 << " " << op << " " << num2 << " = " << result << endl;
    }
    cout << "感谢使用，再见！" << endl;
    return 0;
}
```

运行示例：

```
===== 简易计算器 =====
请输入第一个数：10
请输入运算符（+ - * /）：/
请输入第二个数：4
10 / 4 = 2.5
感谢使用，再见！
```

### 总结

本篇介绍了 C++ 的历史与版本演进、环境搭建、第一个程序的结构、变量与基本数据类型、常量、输入输出和运算符基础，并用简易计算器串联实战。重点要掌握：`main` 函数结构、变量声明与初始化、`cin`/`cout` 的使用、整数除法与类型转换的坑。

下一篇将深入讲解**运算符、表达式与控制流程**（if/switch/循环），敬请期待！
