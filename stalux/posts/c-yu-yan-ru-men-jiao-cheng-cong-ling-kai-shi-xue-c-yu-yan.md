---
title: "C语言入门教程：从零开始学C语言编程"
abbrlink: c-yu-yan-ru-men-jiao-cheng-cong-ling-kai-shi-xue-c-yu-yan
date: "2026-08-26 01:12:45"
categories:
    - "C与C++"
tags: []
desc: "本篇介绍了 C 语言的环境搭建、基础语法、运算符、条件循环，并用猜数字游戏串联实战。下一篇将深入讲解 C 语言的精髓——指针与内存管理，敬请期待！"
---
#### 目录

-   [C语言入门教程：从零开始学C语言编程](#CC_2)
-   -   [一、为什么学C语言](#C_6)
    -   [二、开发环境搭建](#_15)
    -   -   [2.1 编译器选择](#21__17)
        -   [2.2 验证安装](#22__23)
    -   [三、第一个C程序](#C_30)
    -   [四、基本语法](#_50)
    -   -   [4.1 变量与数据类型](#41__52)
        -   [4.2 格式化输出](#42__72)
        -   [4.3 输入](#43__83)
    -   [五、运算符](#_97)
    -   [六、条件与循环](#_120)
    -   [七、实战：猜数字游戏](#_165)
    -   [总结](#_194)

> 本系列是 **C 语言教程系列** 的第 1 篇。C 语言是计算机世界的**基石语言**，操作系统、嵌入式、底层开发都离不开它。本篇从零开始，带你入门。

### 一、为什么学C语言

C 语言诞生于 1972 年，至今仍是使用最广泛的语言之一：

-   **底层控制**：可直接操作内存和硬件
-   **性能极高**：接近汇编的执行效率
-   **承上启下**：理解 C 有助于学习 Python、Java、C++
-   **应用广泛**：操作系统（Linux/Windows）、嵌入式、数据库（MySQL）

### 二、开发环境搭建

#### 2.1 编译器选择

-   **Windows**：MinGW-w64 或 Visual Studio
-   **macOS**：Xcode Command Line Tools（自带 gcc）
-   **Linux**：`sudo apt install gcc`

#### 2.2 验证安装

```bash
gcc --version
# 输出示例: gcc (MinGW-W64) 13.1.0
```

### 三、第一个C程序

```c
#include <stdio.h>  // 引入标准输入输出库

int main() {
    // 向屏幕输出文字
    printf("Hello, World!\n");
    return 0;  // 返回0表示程序正常结束
}
```

编译运行：

```bash
gcc hello.c -o hello
./hello    # Windows 下是 hello.exe
# 输出: Hello, World!
```

### 四、基本语法

#### 4.1 变量与数据类型

```c
#include <stdio.h>

int main() {
    int age = 20;            // 整型
    float score = 88.5f;     // 单精度浮点
    double pi = 3.14159;     // 双精度浮点
    char grade = 'A';       // 单个字符
    const int MAX = 100;     // 常量

    printf("年龄：%d\n", age);
    printf("成绩：%.1f\n", score);
    printf("圆周率：%.5f\n", pi);
    printf("等级：%c\n", grade);
    return 0;
}
```

#### 4.2 格式化输出

```c
printf("%d", 10);        // 整数
printf("%f", 3.14);      // 浮点
printf("%c", 'A');       // 字符
printf("%s", "hello");   // 字符串
printf("%x", 255);       // 十六进制 ff
printf("%.2f", 3.14159); // 保留2位小数 3.14
```

#### 4.3 输入

```c
#include <stdio.h>

int main() {
    int num;
    printf("请输入一个数字：");
    scanf("%d", &num);  // 注意 & 取地址
    printf("你输入的是：%d\n", num);
    return 0;
}
```

### 五、运算符

```c
// 算术：+ - * / %
int a = 10, b = 3;
printf("%d %d\n", a / b, a % b);  // 3 1（整数除法与取余）

// 关系：== != > < >= <=
printf("%d\n", a > b);  // 1（真）

// 逻辑：&& || !
int x = 5;
printf("%d\n", x > 0 && x < 10);  // 1

// 自增自减
int i = 1;
printf("%d %d\n", i++, ++i);  // 注意顺序点问题

// 位运算：& | ^ ~ << >>
printf("%d\n", 6 & 3);   // 2 (110 & 011 = 010)
printf("%d\n", 1 << 3);  // 8 (左移3位)
```

### 六、条件与循环

```c
#include <stdio.h>

int main() {
    // if / else if / else
    int score = 85;
    if (score >= 90) {
        printf("优秀\n");
    } else if (score >= 60) {
        printf("及格\n");
    } else {
        printf("不及格\n");
    }

    // switch
    int day = 3;
    switch (day) {
        case 1: printf("周一"); break;
        case 2: printf("周二"); break;
        default: printf("其他");
    }

    // for
    for (int i = 1; i <= 5; i++) {
        printf("%d ", i);  // 1 2 3 4 5
    }

    // while
    int n = 0;
    while (n < 3) {
        n++;
    }

    // do-while（至少执行一次）
    int m = 0;
    do {
        printf("执行");
    } while (m > 0);

    return 0;
}
```

### 七、实战：猜数字游戏

```c
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

int main() {
    srand(time(NULL));
    int answer = rand() % 100 + 1;  // 1~100
    int guess, count = 0;

    printf("猜数字游戏（1-100）\n");
    do {
        printf("请输入：");
        scanf("%d", &guess);
        count++;
        if (guess > answer) {
            printf("太大了！\n");
        } else if (guess < answer) {
            printf("太小了！\n");
        }
    } while (guess != answer);

    printf("恭喜！猜了%d次就对了\n", count);
    return 0;
}
```

### 总结

本篇介绍了 C 语言的环境搭建、基础语法、运算符、条件循环，并用猜数字游戏串联实战。下一篇将深入讲解 C 语言的精髓——**指针与内存管理**，敬请期待！
