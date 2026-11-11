---
title: "C++入门教程：运算符、表达式与控制流程"
abbrlink: c-ru-men-jiao-cheng-yun-suan-fu-biao-da-shi-yu-kong-zhi-liu
date: "2026-08-26 01:17:01"
categories:
    - "C与C++"
tags: []
desc: "本文是C++系列教程第二篇，重点讲解运算符、表达式和程序控制结构。主要内容包括： 运算符详解：分类介绍算术/关系/逻辑/位运算等8类运算符，特别说明整数除法截断、自增自减顺序、短路求值特性…"
---
> 本文是 C++ 系列教程的第 2 篇。上一篇介绍了 C++ 的环境搭建、第一个程序和基本数据类型，本篇深入讲解运算符、表达式与三种控制流程（顺序、选择、循环），并掌握 break/continue 等跳转语句。

### 一、运算符详解

#### 1.1 运算符分类总览

| 类别 | 运算符 | 示例 |
| --- | --- | --- |
| 算术 | `+ - * / %` | `a + b` |
| 关系 | `> < >= <= == !=` | `a > b` |
| 逻辑 | `&& || !` | `a && b` |
| 位运算 | `& | ^ ~ << >>` | `a & b` |
| 赋值 | `= += -= *= /= %=` | `a += 3` |
| 自增自减 | `++ --` | `a++` |
| 条件 | `? :` | `a > b ? a : b` |
| 逗号 | `,` | `a, b` |

#### 1.2 算术运算符与细节

```cpp
#include <iostream>
using namespace std;

int main() {
    int a = 17, b = 5;
    cout << "17 / 5 = " << a / b << endl;      // 3，整数除法截断
    cout << "17 % 5 = " << a % b << endl;      // 2，取余
    cout << "-17 % 5 = " << (-a) % b << endl;  // -2，符号跟随被除数

    // 自增自减
    int x = 10;
    cout << "x++ 先取值后自增: " << x++ << endl;   // 10
    cout << "此时 x = " << x << endl;               // 11
    cout << "++x 先自增后取值: " << ++x << endl;   // 12
    return 0;
}
```

#### 1.3 关系与逻辑运算符

```cpp
#include <iostream>
using namespace std;

int main() {
    int age = 25;
    bool hasTicket = true;

    // 关系运算
    cout << "age > 18: " << (age > 18) << endl;       // 1
    cout << "age == 25: " << (age == 25) << endl;     // 1

    // 逻辑运算：&&（与）、||（或）、!（非）
    bool canEnter = (age >= 18) && hasTicket;
    cout << "可以入场: " << canEnter << endl;          // 1

    bool student = false;
    cout << "是学生或已成年: " << (student || age >= 18) << endl;  // 1
    cout << "不是学生: " << !student << endl;           // 1
    return 0;
}
```

#### 1.4 短路求值

`&&` 和 `||` 具有**短路特性**：左侧结果已能确定最终值时，右侧不再计算。

```cpp
#include <iostream>
using namespace std;

int main() {
    int divisor = 0;
    // 利用短路防止除零：divisor != 0 为假时，右侧 10/divisor 不会执行
    if (divisor != 0 && 10 / divisor > 2) {
        cout << "条件成立" << endl;
    } else {
        cout << "短路保护生效，未发生除零" << endl;
    }
    return 0;
}
```

#### 1.5 位运算符

```cpp
#include <iostream>
using namespace std;

int main() {
    int a = 5;   // 0101
    int b = 3;   // 0011

    cout << "a & b  = " << (a & b) << endl;   // 1（0001）
    cout << "a | b  = " << (a | b) << endl;   // 7（0111）
    cout << "a ^ b  = " << (a ^ b) << endl;   // 6（0110）
    cout << "~a     = " << (~a) << endl;      // -6
    cout << "a << 1 = " << (a << 1) << endl;   // 10（左秽一位 = 乘2）
    cout << "a >> 1 = " << (a >> 1) << endl;  // 2（��终位 = 隌）
    return 0;
}
```

### 二、运算符优先级

#### 2.1 常见优先级速查（从高到低）

| 优先级 | 运算符 |
| --- | --- |
| 1 | `()` `[]` `->` `.` |
| 2 | `!` `~` `++` `--` `-`（一元） |
| 3 | `* / %` |
| 4 | `+ -` |
| 5 | `<< >>` |
| 6 | `< <= > >=` |
| 7 | `== !=` |
| 8 | `&` |
| 9 | `^` |
| 10 | `|` |
| 11 | `&&` |
| 12 | `||` |
| 13 | `?:` |
| 14 | `=` `+=` `-=` 等 |

#### 2.2 优先级示例

```cpp
#include <iostream>
using namespace std;

int main() {
    int a = 2 + 3 * 4;      // 14（* 优先于 +）
    int b = (2 + 3) * 4;    // 20（括号改变优先级）
    bool c = 3 > 2 && 4 < 5; // true（关系运算优先于逻辑）

    cout << a << endl;
    cout << b << endl;
    cout << c << endl;
    // 建议：复杂表达式加括号，提高可读性
    int score = 85;
    char grade = score >= 90 ? 'A' : (score >= 80 ? 'B' : 'C');
    cout << "等级: " << grade << endl;  // B
    return 0;
}
```

### 三、选择结构

#### 3.1 if / else if / else

```cpp
#include <iostream>
using namespace std;

int main() {
    int score;
    cout << "请输入成绩: ";
    cin >> score;

    if (score >= 90) {
        cout << "优秀" << endl;
    } else if (score >= 80) {
        cout << "良好" << endl;
    } else if (score >= 60) {
        cout << "及格" << endl;
    } else {
        cout << "不及格" << endl;
    }
    return 0;
}
```

#### 3.2 switch 语句

```cpp
#include <iostream>
using namespace std;

int main() {
    int day;
    cout << "输入星期几（1-7）: ";
    cin >> day;

    switch (day) {
        case 1: cout << "周一" << endl; break;
        case 2: cout << "周二" << endl; break;
        case 3: cout << "周三" << endl; break;
        case 4: cout << "周四" << endl; break;
        case 5: cout << "周五" << endl; break;
        case 6:
        case 7: cout << "周末" << endl; break;   // 多个 case 共享
        default: cout << "无效输入" << endl;     // 缺省分支
    }
    return 0;
}
```

#### 3.3 switch 与 if 的选择

| 场景 | 推荐 |
| --- | --- |
| 判断整数/字符等于某几个值 | switch |
| 范围判断、浮点比较、复杂条件 | if/else |

### 四、循环结构

#### 4.1 while 循环

```cpp
#include <iostream>
using namespace std;

int main() {
    // 计算 1 到 100 的和
    int sum = 0, i = 1;
    while (i <= 100) {
        sum += i;
        i++;
    }
    cout << "1+2+...+100 = " << sum << endl;  // 5050
    return 0;
}
```

#### 4.2 do-while 循环

```cpp
#include <iostream>
using namespace std;

int main() {
    int n;
    // do-while 至少执行一次，适合「先输入后验证」
    do {
        cout << "请输入一个正数: ";
        cin >> n;
    } while (n <= 0);

    cout << "你输入了: " << n << endl;
    return 0;
}
```

#### 4.3 for 循环

```cpp
#include <iostream>
using namespace std;

int main() {
    // 打印 9x9 乘法表
    for (int i = 1; i <= 9; i++) {
        for (int j = 1; j <= i; j++) {
            cout << j << "x" << i << "=" << (i * j) << "\t";
        }
        cout << endl;
    }
    return 0;
}
```

#### 4.4 循环控制：break 与 continue

```cpp
#include <iostream>
using namespace std;

int main() {
    // break: 立即终止整个循环
    for (int i = 1; i <= 10; i++) {
        if (i == 5) break;
        cout << i << " ";
    }
    cout << endl;  // 输出: 1 2 3 4

    // continue: 跳过本次循环剩余语句，进入下一次
    for (int i = 1; i <= 10; i++) {
        if (i % 2 == 0) continue;   // 跳过偶数
        cout << i << " ";
    }
    cout << endl;  // 输出: 1 3 5 7 9
    return 0;
}
```

#### 4.5 嵌套循环与 goto（不推荐）

```cpp
#include <iostream>
using namespace std;

int main() {
    // 找出第一个满足 i*j == 24 的组合
    for (int i = 1; i <= 10; i++) {
        for (int j = 1; j <= 10; j++) {
            if (i * j == 24) {
                cout << "找到: " << i << " x " << j << " = 24" << endl;
                goto found;  // 跳出多重循环
            }
        }
    }
    cout << "未找到" << endl;
found:
    cout << "程序结束" << endl;
    return 0;
}
```

### 五、实战：猜数字游戏

综合本篇全部知识，实现猜数字游戏：

```cpp
#include <iostream>
#include <cstdlib>
#include <ctime>
using namespace std;

int main() {
    // 用当前时间做随机种子
    srand(time(nullptr));
    int secret = rand() % 100 + 1;  // 1~100 随机数

    int guess, attempts = 0;
    cout << "===== 猜数字游戏 =====" << endl;
    cout << "我已想好一个 1~100 之间的数字，你来猜！" << endl;

    while (true) {
        cout << "请输入你的猜测: ";
        cin >> guess;
        attempts++;

        if (guess > secret) {
            cout << "太大了！" << endl;
        } else if (guess < secret) {
            cout << "太小了！" << endl;
        } else {
            cout << "恭喜！你猜对了！" << endl;
            cout << "数字是 " << secret << "，你共猜了 " << attempts << " 次。" << endl;
            break;
        }

        if (attempts >= 10) {
            cout << "次数用尽，答案是 " << secret << "，下次加油！" << endl;
            break;
        }
    }
    return 0;
}
```

运行示例：

```
===== 猜数字游戏 =====
我已想好一个 1~100 之间的数字，你来猜！
请输入你的猜测: 50
太大了！
请输入你的猜测: 25
太小了！
请输入你的猜测: 37
恭喜！你猜对了！
数字是 37，你共猜了 3 次。
```

### 总结

本篇讲解了运算符的分类与优先级、短路求值、if/switch 选择结构、while/do-while/for 循环和 break/continue/goto 跳转语句，并用猜数字游戏串联实战。重点掌握：优先级与括号、短路求值、三种循环的适用场景、break 与 continue 的区别。

下一篇将讲解**函数与作用域详解**（参数传递、重载、递归），敬请期待！
