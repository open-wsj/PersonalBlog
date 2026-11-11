---
title: "C++模板教程：变参模板、折叠表达式与SFINAE"
abbrlink: c-mu-ban-jiao-cheng-bian-can-mu-ban-zhe-die-biao-da-shi-yu
date: "2026-08-30 11:02:41"
categories:
    - "C与C++"
tags: []
desc: "变参模板（Variadic Templates）允许模板接受任意数量的参数// 参数包：typename... ArgsArgs...是类型参数包。args...是函数参数包。获取参数个数…"
---
> 本文是 C++ 系列教程的第 18 篇。上一篇讲解了特化与类型萃取，本篇深入模板高级技巧：变参模板（参数包、sizeof…、递归展开）、C++17 折叠表达式、SFINAE 与 enable_if、void_t 技巧、C++20 concepts 预告。

### 一、变参模板

#### 1.1 什么是变参模板

变参模板（Variadic Templates）允许模板接受**任意数量的参数**，C++11 引入：

```cpp
// 参数包：typename... Args
template <typename... Args>
void print(Args... args);
```

-   `Args...` 是**类型参数包**。
-   `args...` 是**函数参数包**。
-   `sizeof...(Args)` 获取参数个数。

#### 1.2 参数包展开与递归

```cpp
#include <iostream>
using namespace std;

// 递归终止条件：空参数版本
void printAll() {
    cout << endl;
}

// 递归展开：取出第一个参数，剩余继续递归
template <typename T, typename... Rest>
void printAll(T first, Rest... rest) {
    cout << first << " ";
    printAll(rest...);    // 递归调用剩余参数
}

int main() {
    printAll(1, 2.5, "hello", 'a');   // 1 2.5 hello a
    printAll(10);                     // 10
    return 0;
}
```

#### 1.3 sizeof… 获取参数个数

```cpp
#include <iostream>
using namespace std;

template <typename... Args>
void countArgs(Args... args) {
    cout << "参数个数: " << sizeof...(Args) << endl;
    cout << "参数个数: " << sizeof...(args) << endl;   // 等价
}

int main() {
    countArgs();                  // 0
    countArgs(1);                 // 1
    countArgs(1, 2.5, "three");   // 3
    return 0;
}
```

### 二、折叠表达式（C++17）

#### 2.1 折叠表达式语法

折叠表达式对**参数包中的全部元素**应用二元运算符，大大简化变参运算：

| 形式 | 含义 |
| --- | --- |
| `(pack op ...)` | 右折叠：`a op (b op (c op init))` |
| `(... op pack)` | 左折叠：`((init op a) op b) op c` |
| `(pack op ... op init)` | 带初始值的右折叠 |
| `(init op ... op pack)` | 带初始值的左折叠 |

#### 2.2 折叠求和

```cpp
#include <iostream>
using namespace std;

// C++17 折叠：一行实现任意个数求和
template <typename... Args>
auto sum(Args... args) {
    return (args + ... + 0);   // 右折叠，初始值 0
}

// 左折叠
template <typename... Args>
auto sumLeft(Args... args) {
    return (0 + ... + args);
}

int main() {
    cout << sum(1, 2, 3, 4, 5) << end
l;       // 15
    cout << sum(1.5, 2.5, 3.0) << endl;       // 7
    cout << sum() << endl;                    // 0
    cout << sumLeft(1, 2, 3) << endl;         // 6
    return 0;
}
```

#### 2.3 折叠打印（对比递归）

```cpp
#include <iostream>
using namespace std;

// 用逗号运算符折叠打印
template <typename... Args>
void printFold(Args... args) {
    // (cout << ... << args)：左折叠
    // 逐个输出
    ((cout << args << " "), ...);   // 逗号折叠
    cout << endl;
}

// 更实用的版本：带分隔符
template <typename... Args>
void printWithSep(const char *sep, Args... args) {
    // 第一个直接输出，其余带分隔符
    ((cout << args), ...);   // 简化版
    cout << endl;
}

int main() {
    printFold(1, 2.5, "hi", 'x');    // 1 2.5 hi x
    printWithSep(", ", 1, 2, 3);
    return 0;
}
```

#### 2.4 折叠判断（逻辑运算）

```cpp
#include <iostream>
using namespace std;

// 全部满足条件（&& 折叠）
template <typename... Args>
bool allPositive(Args... args) {
    return ((args > 0) && ...);
}

// 任一满足条件（|| 折叠）
template <typename... Args>
bool anyZero(Args... args) {
    return ((args == 0) || ...);
}

int main() {
    cout << allPositive(1, 2, 3) << endl;     // 1
    cout << allPositive(1, -2, 3) << endl;    // 0
    cout << anyZero(1, 2, 0, 4) << endl;      // 1
    cout << anyZero(1, 2, 3) << endl;         // 0
    return 0;
}
```

### 三、SFINAE 基础

#### 3.1 什么是 SFINAE

SFINAE（Substitution Failure Is Not An Error，替换失败不是错误）：模板实例化时，如果某个候选**替换失败**（如类型不支持某操作），编译器**不会报错**，而是继续尝试其他候选。

#### 3.2 利用 SFINAE 做类型判断

```cpp
#include <iostream>
#include <type_traits>
using namespace std;

// 通用版本：不支持 operator<< 的类型走这里
template <typename T>
void printValue(const T &value, ...) {
    cout << "不支持输出: (未知类型)" << endl;
}

// 精确版本：支持 operator<< 的类型走这里
template <typename T, typename = decltype(cout << declval<const T &>())>
void printValue(const T &value, int) {
    cout << "值: " << value << endl;
}

int main() {
    printValue(42, 0);            // 值: 42
    printValue(3.14, 0);          // 值: 3.14
    printValue("hello", 0);       // 值: hello
    return 0;
}
```

#### 3.

3 enable_if 条件启用

```cpp
#include <iostream>
#include <type_traits>
using namespace std;

// 仅当 T 是整数时启用
template <typename T>
typename enable_if<is_integral<T>::value>::type
process(T value) {
    cout << "整数处理: " << value << endl;
}

// 仅当 T 是浮点时启用
template <typename T>
typename enable_if<is_floating_point<T>::value>::type
process(T value) {
    cout << "浮点处理: " << value << endl;
}

int main() {
    process(42);         // 整数处理: 42
    process(3.14);       // 浮点处理: 3.14
    // process("hi");    // 错误！string 不满足任何版本
    return 0;
}
```

#### 3.4 enable_if 的两种写法

```cpp
#include <iostream>
#include <type_traits>
using namespace std;

// 写法一：返回类型中启用
template <typename T>
typename enable_if<is_integral<T>::value, T>::type
square(T x) {
    return x * x;
}

// 写法二：模板参数中启用（C++11 更通用）
template <typename T,
          typename = typename enable_if<is_floating_point<T>::value>::type>
double squareDouble(T x) {
    return x * x;
}

int main() {
    cout << square(5) << endl;         // 25（int 版本）
    cout << squareDouble(2.5) << endl; // 6.25（double 版本）
    return 0;
}
```

### 四、void_t 技巧

#### 4.1 void_t 检测特性

```cpp
#include <iostream>
#include <type_traits>
using namespace std;

// void_t：任何类型都映射为 void（C++17 标准库提供）
template <typename...>
using void_t = void;

// 检测 T 是否有成员函数 size()
template <typename T, typename = void>
struct HasSize : false_type {};

template <typename T>
struct HasSize<T, void_t<decltype(declval<T>().size())>> : true_type {};

// 检测 T 是否有成员 type
template <typename T, typename = void>
struct HasType : false_type {};

template <typename T>
struct HasType<T, void_t<typename T::type>> : true_type {};

int main() {
    cout << "string 有 size(): " << HasSize<string>::value << endl;  // 1
    cout << "int 有 size(): " << HasSize<int>::value << endl;        // 0

    struct WithType { using type = int; };
    cout << "WithType 有 type: " << HasType<WithType>::value << endl;  // 1
    cout << "int 有 type: " << HasType<int>::value << endl;            // 0
    return 0;
}
```

#### 4.2 void_t 检测可调用性

```cpp
#include <iostream>
#include <type_traits>
using namespace std;

template <typename...>

using void_t = void;

// 检测 T 是否支持 operator<<
template <typename T, typename = void>
struct IsPrintable : false_type {};

template <typename T>
struct IsPrintable<T,
    void_t<decltype(cout << declval<const T &>())>> : true_type {};

struct MyStruct {};    // 不支持输出

int main() {
    cout << "int 可打印: " << IsPrintable<int>::value << endl;       // 1
    cout << "string 可打印: " << IsPrintable<string>::value << endl; // 1
    cout << "MyStruct 可打印: " << IsPrintable<MyStruct>::value << endl;  // 0
    return 0;
}
```

### 五、变参模板实战

#### 5.1 类型安全的 printf

```cpp
#include <iostream>
using namespace std;

// 基础版本：无参数
void myPrintf(const char *format) {
    cout << format << endl;
}

// 递归展开版本
template <typename T, typename... Args>
void myPrintf(const char *format, T value, Args... args) {
    while (*format) {
        if (*format == '%' && *(format + 1) == 'd') {
            cout << value;              // 输出参数
            format += 2;
            myPrintf(format, args...);  // 递归剩余
            return;
        }
        cout << *format++;
    }
}

int main() {
    myPrintf("数字: %d", 42);
    myPrintf("%d 加 %d 等于 %d", 1, 2, 3);
    return 0;
}
```

#### 5.2 变参构造函数（完美转发预览）

```cpp
#include <iostream>
#include <vector>
using namespace std;

// 自定义容器：支持任意参数构造
template <typename T>
class MyContainer {
private:
    vector<T> data;

public:
    // 变参构造函数
    template <typename... Args>
    MyContainer(Args... args) {
        data.reserve(sizeof...(Args));
        (data.push_back(args), ...);   // C++17 逗号折叠
    }

    void show() const {
        for (const auto &item : data) cout << item << " ";
        cout << endl;
    }

    size_t size() const { return data.size(); }
};

int main() {
    MyContainer<int> c1(1, 2, 3, 4, 5);
    cout << "大小: " << c1.size() << endl;   // 5
    c1.show();                               // 1 2 3 4 5

    MyContainer<string> c2("C++", "Python");
    c2.show();   // C++ Python
    return 0;
}
```

#### 5.3 变参模板应用场景

1.  **std::make_shared/make_unique**：参数转发给构造函数。
2.  **std::tuple**：存储任意类型任意个数。
3.  **printf 风格格式化**。
4.  **事件系统**：任意参数的通知。
5.  **工厂模式*
    *：参数转发。

### 六、C++20 concepts 预告

#### 6.1 concepts 简化约束

C++20 的 concepts 让模板约束更简洁直观：

```cpp
#include <iostream>
#include <concepts>
using namespace std;

// 定义概念：必须是整数类型
template <typename T>
concept Integral = is_integral_v<T>;

// 用概念约束模板参数
template <Integral T>
T add(T a, T b) {
    return a + b;
}

// 简化写法
template <typename T>
requires Integral<T>
T multiply(T a, T b) {
    return a * b;
}

int main() {
    cout << add(3, 4) << endl;       // 7
    cout << multiply(5, 6) << endl;  // 30
    // add(3.5, 4.5);   // 错误！double 不满足 Integral
    return 0;
}
```

#### 6.2 concepts vs enable_if

| 维度 | enable_if | concepts |
| --- | --- | --- |
| 可读性 | 冗长晦涩 | 直观清晰 |
| 报错信息 | 深奥难懂 | 友好明确 |
| 语法 | 模板技巧 | 标准语法 |
| 标准 | C++11 | C++20 |

### 七、实战：任意类型最大值

综合本篇知识，实现支持任意参数个数的 max：

```cpp
#include <iostream>
#include <type_traits>
using namespace std;

// 两个参数版本（递归终止）
template <typename T>
T myMax(T value) {
    return value;
}

// 变参版本：比较第一个和剩余的最大值
template <typename T, typename... Args>
auto myMax(T first, Args... rest) {
    auto restMax = myMax(rest...);   // 递归求剩余最大值
    return first > restMax ? first : restMax;
}

// 折叠表达式版本（C++17 更简洁）
template <typename... Args>
auto foldMax(Args... args) {
    return (args > ...);   // 不适用
}

// 正确折叠版
template <typename First, typename... Rest>
auto foldMax2(First first, Rest... rest) {
    auto result = first;
    ((result = (rest > result ? rest : result)), ...);
    return result;
}

int main() {
    cout << myMax(3, 7, 2) << endl;          // 7
    cout << myMax(1.5, 3.2, 2.8, 4.1) << endl;  // 4.1
    cout << foldMax2(10, 20, 5, 15) << endl; // 20
    cout << foldMax2(3.5, 2.5) << endl;      // 3.5
    return 0;
}
```

### 总结

本篇讲解了变参模板（参数包、sizeof…、递归展开）、C++17 折叠表达式（求和、打印、逻辑判断）、SFINAE 与 enable_if（条件启用）、void_t 技巧（特性检测）、C++20 concepts 预告，并用任意类型最大值串联实战。重点掌握：参数包递归展开模式、折叠表达式的四种形式、enable_if 的两种写法、void_t 检测原理。

下一篇将讲解**类型推导与完美转发**（auto/decltype/右值引用/完美转发），敬请期待！
