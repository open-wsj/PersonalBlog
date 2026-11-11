---
title: "C++入门教程：函数与作用域详解"
abbrlink: c-ru-men-jiao-cheng-han-shu-yu-zuo-yong-yu-xiang-jie
date: "2026-08-26 01:17:28"
categories:
    - "C与C++"
tags: []
desc: "/ 函数定义：返回类型 函数名(参数列表) { 函数体 }// 无返回值函数// 调用无参函数// 调用带参函数，接收返回值return 0;当函数定义在使用之后时，需要先声明//…"
---
> 本文是 C++ 系列教程的第 3 篇。上一篇讲解了运算符、表达式与控制流程，本篇深入讲解函数：定义与调用、参数传递方式、函数重载、递归、内联函数，以及变量作用域与生命周期。

### 一、函数基础

#### 1.1 函数的作用

函数是**组织代码的基本单元**，它把一段完成特定功能衺起来，实现：

-   **复用**：同一段逻辑只写一次，多处调用。
-   **抽象**：调用者只需关心「做什么」，不必关心「怎么做」。
-   **维护**：修改只需改一处。

#### 1.2 函数定义与调用

```cpp
#include <iostream>
using namespace std;

// 函数定义：返回类型 函数名(参数列表) { 函数体 }
int add(int a, int b) {
    return a + b;
}

// 无返回值函数
void printLine() {
    cout << "==========" << endl;
}

int main() {
    printLine();                  // 调用无参函数
    int sum = add(3, 5);          // 调用带参函数，接收返回值
    cout << "3 + 5 = " << sum << endl;
    printLine();
    return 0;
}
```

#### 1.3 函数声明与定义分离

当函数定义在使用之后时，需要先**声明**：

```cpp
#include <iostream>
using namespace std;

// 函数声明（原型）：只写签名，不写函数体
int multiply(int a, int b);

int main() {
    cout << "4 x 7 = " << multiply(4, 7) << endl;
    return 0;
}

// 函数定义放在后面
int multiply(int a, int b) {
    return a * b;
}
```

### 二、参数传递

#### 2.1 值传递（传值）

```cpp
#include <iostream>
using namespace std;

void changeValue(int x) {
    x = 100;   // 修改的是副本
}

int main() {
    int num = 10;
    changeValue(num);
    cout << "num = " << num << endl;  // 10，原值不变
    return 0;
}
```

值传递时，参数是实参的**拷贝**，函数内修改不影响外部变量。

#### 2.2 引用传递（传引用）

```cpp
#include <iostream>
using namespace std;

void swap(int &a, int &b) {   // 引用参数，直接操作原变量
    int temp = a;
    a = b;
    b = temp;
}

int main() {
    int x = 3, y = 7;
    swap(x, y);
    cout << "x = " << x << ", y = " << y << endl;  // x = 7, y = 3
    return 0;
}
```

#### 2.3 const 引用

当函数不需要修改参数但又想避免拷贝开销时，用 `const 引用`：

```cpp
#include <iostream>
#include <string>
using namespace std;

// 传入大对象（如字符串）用 const 引用，避免拷贝且保证不修改
void printMessage(const string &msg) {
    cout << "消息: " << msg << endl;
    // msg = "xxx";  // 错误！const 引用不可修改
}

int main() {
    string s = "Hello C++";
    printMessage(s);
    return 0;
}
```

#### 2.4 三种传递方式对比

| 方式 | 语法 | 能否修改原值 | 性能 |
| --- | --- | --- | --- |
| 值传递 | `int x` | 否 | 拷贝开销 |
| 引用传递 | `int &x` | 是 | 无拷贝 |
| const 引用 | `const int &x` | 否 | 无拷贝 |

### 三、默认参数与函数重载

#### 3.1 默认参数

```cpp
#include <iostream>
using namespace std;

// 默认参数：调用时可省略
int power(int base, int exp = 2) {
    int result = 1;
    for (int i = 0; i < exp; i++) {
        result *= base;
    }
    return result;
}

int main() {
    cout << "3^2 = " << power(3) << endl;       // 9，exp 用默认值 2
    cout << "3^3 = " << power(3, 3) << endl;    // 27
    return 0;
}
```

**规则**：默认参数必须从右往左连续设置，如 `f(int a, int b = 1, int c = 2)` 合法，`f(int a = 1, int b)` 不合法。

#### 3.2 函数重载

同名函数，参数列表不同（类型、个数、顺序），编译器根据实参选择：

```cpp
#include <iostream>
using namespace std;

// 三个同名函数，参数不同
int max(int a, int b) {
    return a > b ? a : b;
}

double max(double a, double b) {
    return a > b ? a : b;
}

int max(int a, int b, int c) {
    return max(max(a, b), c);
}

int main() {
    cout << "max(3, 7) = " << max(3, 7) << endl;           // int 版本
    cout << "max(3.5, 2.8) = " << max(3.5, 2.8) << endl;   // double 版本
    cout << "max(1, 5, 3) = " << max(1, 5, 3) << endl;     // 三参版本
    return 0;
}
```

**注意**：重载仅凭返回类型不同无法区分（`int f()` 和 `double f()` 不能共存）。

### 四、递归

#### 4.1 递归原理

递归是函数**调用自身**的技巧，必须包含：

1.  **基线条件**：终止递归的判断。
2.  **递归条件**：向基线条件逼近的调用。

```cpp
#include <iostream>
using namespace std;

// 阶乘：n! = n * (n-1)!
int factorial(int n) {
    if (n <= 1) return 1;      // 基线条件
    return n * factorial(n - 1);  // 递归调用
}

// 斐波那契：f(n) = f(n-1) + f(n-2)
int fibonacci(int n) {
    if (n <= 1) return n;      // 基线条件
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    cout << "5! = " << factorial(5) << endl;       // 120
    cout << "斐波那契第10项 = " << fibonacci(10) << endl;  // 55
    return 0;
}
```

#### 4.2 递归执行过程（以 factorial(4) 为例）

```
factorial(4)
  = 4 * factorial(3)
  = 4 * (3 * factorial(2))
  = 4 * (3 * (2 * factorial(1)))
  = 4 * (3 * (2 * 1))
  = 24
```

#### 4.3 递归 vs 迭代

| 维度 | 递归 | 迭代（循环） |
| --- | --- | --- |
| 代码 | 简洁，符合数学定义 | 略复杂 |
| 性能 | 有函数调用开销，深递归可能栈溢出 | 高效 |
| 适用 | 树、图、分治等天然递归结构 | 简单重复计算 |

### 五、内联函数

```cpp
#include <iostream>
using namespace std;

// inline 建议编译器将函数体展开到调用处（消除调用开销）
inline int square(int x) {
    return x * x;
}

int main() {
    // 编译后等价于直接写 x*x
    cout << "7^2 = " << square(7) << endl;  // 49
    return 0;
}
```

**适用**：函数体很小（几行）、被频繁调用。**注意**：`inline` 只是建议，大型函数编译器会忽略。

### 六、变量作用域与生命周期

#### 6.1 局部变量与全局变量

```cpp
#include <iostream>
using namespace std;

int globalCount = 0;   // 全局变量：整个文件可见，生命周期为程序运行期

void increment() {
    int local = 1;     // 局部变量：函数内可见，函数结束即销毁
    globalCount += local;
}

int main() {
    increment();
    increment();
    cout << "globalCount = " << globalCount << endl;  // 2

    // cout << local;  // 错误！local 在 main 中不可见
    return 0;
}
```

#### 6.2 局部变量的遮蔽

```cpp
#include <iostream>
using namespace std;

int x = 100;  // 全局 x

int main() {
    int x = 5;              // 局部 x 遮蔽全局 x
    cout << "局部 x = " << x << endl;           // 5
    cout << "全局 x = " << ::x << endl;         // 100（用 :: 访问全局）
    {
        int x = 50;         // 内层块又遮蔽外层局部
        cout << "块内 x = " << x << endl;       // 50
    }
    cout << "外层局部 x = " << x << endl;       // 5
    return 0;
}
```

#### 6.3 static 局部变量

```cpp
#include <iostream>
using namespace std;

void counter() {
    static int count = 0;   // static 局部：只初始化一次，函数结束后保留值
    count++;
    cout << "第 " << count << " 次调用" << endl;
}

int main() {
    counter();  // 第 1 次调用
    counter();  // 第 2 次调用
    counter();  // 第 3 次调用
    return 0;
}
```

### 七、函数指针（了解）

```cpp
#include <iostream>
using namespace std;

int add(int a, int b) { return a + b; }
int subtract(int a, int b) { return a - b; }

int main() {
    // 函数指针：指向函数的指针
    int (*operation)(int, int);
    operation = add;
    cout << "add(10, 3) = " << operation(10, 3) << endl;   // 13

    operation = subtract;
    cout << "subtract(10, 3) = " << operation(10, 3) << endl;  // 7
    return 0;
}
```

### 八、实战：简易计算器函数库

综合本篇知识，编写一个可复用的计算器函数库：

```cpp
#include <iostream>
using namespace std;

// 函数库：加减乘除
double add(double a, double b) { return a + b; }
double subtract(double a, double b) { return a - b; }
double multiply(double a, double b) { return a * b; }

double divide(double a, double b) {
    if (b == 0) {
        cout << "错误：除数不能为 0" << endl;
        return 0;
    }
    return a / b;
}

// 函数指针数组：把运算函数装进数组，根据索引调用
double (*operations[4])(double, double) = {add, subtract, multiply, divide};
const char *names[4] = {"加法", "减法", "乘法", "除法"};

int main() {
    double a = 20, b = 4;
    for (int i = 0; i < 4; i++) {
        cout << names[i] << ": " << a << " 与 " << b << " 的运算结果 = "
             << operations[i](a, b) << endl;
    }
    return 0;
}
```

运行示例：

```
加法: 20 与 4 的运算结果 = 24
减法: 20 与 4 的运算结果 = 16
乘法: 20 与 4 的运算结果 = 80
除法: 20 与 4 的运算结果 = 5
```

### 总结

本篇讲解了函数的定义与调用、三种参数传递方式（值/引用/const 引用）、默认参数、函数重载、递归、内联函数、变量作用域与生命周期、函数指针，并用计算器函数库串联实战。重点掌握：值传递与引用传递的区别、重载规则、递归的基线条件、static 局部变量。

下一篇将讲解**数组、字符串与指针入门**，敬请期待！
