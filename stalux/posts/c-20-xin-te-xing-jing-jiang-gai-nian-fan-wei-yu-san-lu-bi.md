---
title: "C++20新特性精讲：概念、范围与三路比较"
abbrlink: c-20-xin-te-xing-jing-jiang-gai-nian-fan-wei-yu-san-lu-bi
date: "2026-09-01 18:35:33"
categories:
    - "C与C++"
tags: []
desc: "concepts让模板约束可读、可复用；ranges以惰性视图与管道风格重构数据流；三路比较一次操作自动生成全套比较运算符；协程与模块开启语言新范式；std::span与constexpr扩展让代码更…"
---
> 本文是 C++ 系列教程的第 22 篇。上一篇讲解了 C++17 新特性，本篇深入 C++20 新特性：概念（concepts）、范围（ranges）、三路比较（spaceship）、协程与模块等，覆盖 8 个完整示例代码。

## 一、概念（Concepts）

### 1.1 为什么需要概念

C++20 之前，模板参数的约束只能依赖文档和编译期报错。概念（Concept）把「类型必须满足的约束」变成一等公民，让编译器给出清晰错误，也让重载决议更精确：

```cpp
#include <iostream>
#include <concepts>
#include <string>
using namespace std;

// 定义概念：类型必须可相加，且结果可转换为目标类型
template <typename T, typename U>
concept Addable = requires(T a, U b) {
    { a + b } -> convertible_to<T>;
};

// 使用概念约束模板参数
template <Addable T>
T add(T a, T b) {
    return a + b;
}

int main() {
    cout << add(3, 4) << endl;          // 7（int 满足 Addable）
    cout << add(1.5, 2.5) << endl;      // 4（double 满足）
    // cout << add(string("a"), 1);     // 编译错误：string+int 不可相加
    return 0;
}
```

概念由 `concept` 儳央字声明，`requires` 表达式描述约束。约束失败时，编译器会指出「不满足哪个概念」而不是给出深奥的模板实例化错误。

### 1.2 标准概念库

`<concepts>` 头文件提供大量现成概念：`integral`、`floating_point`、`signed_integral`、`same_as`、`convertible_to`、`derived_from`、`assignable_from` 等：

```cpp
#include <iostream>
#include <concepts>
#include <type_traits>
using namespace std;

// 限定参数必须是整型
template <integral T>
T twice(T x) {
    return x * 2;
}

// 多个约束组合（合取）
template <integral T>
    requires (sizeof(T) >= 4)
void printWide(T x) {
    cout << x << " 至少4字节" << endl;
}

int main() {
    cout << twice(21) << endl;        // 42（int 是整型）
    // cout << twice(3.14) << endl;   // 错误：double 不是 integral
    printWide(100);                   // 满足 sizeof(int)>=4
    return 0;
}
```

约束可以写在 `template<...>` 后直接附加（如 `template <integral T>`），也可以用 `requires` 子句补充更复杂条件。

## 二、范围（Ranges）

### 2.1 管道运算符初体验

`<ranges>` 引入惰性求值的**视图（View）**，配合管道运算符 `|` 让数据处理像流水�
�一样清晰。视图不拷贝元素，按需计算：

```cpp
#include <iostream>
#include <ranges>
#include <vector>
#include <numeric>
using namespace std;

int main() {
    vector<int> v(10);
    iota(v.begin(), v.end(), 1);      // 1..10

    // 取偶数 -> 平方 -> 只取前3个，一气呵成
    auto result = v
        | views::filter([](int n) { return n % 2 == 0; })   // 2 4 6 8 10
        | views::transform([](int n) { return n * n; })     // 4 16 36 64 100
        | views::take(3);                                    // 4 16 36

    for (int x : result) cout << x << " ";   // 4 16 36
    cout << endl;
    return 0;
}
```

`views::filter` 与 `views::transform` 返回**惰性视图**：只有遍历时才真正计算，且不产生临时容器，性能优于手写中间容器。

### 2.2 ranges 算法与投影

`std::ranges` 命名空间重新实现了全部 STL 算法，支持直接传容器、支持投影（projection）和哨兵（sentinel）：

```cpp
#include <iostream>
#include <ranges>
#include <vector>
#include <algorithm>
#include <string>
using namespace std;

struct Student {
    string name;
    int score;
};

int main() {
    vector<Student> students = {
        {"张三", 85}, {"李四", 92}, {"王五", 78}, {"赵六", 95}
    };

    // 直接传容器（旧版要 begin/end），投影到 score 排序
    ranges::sort(students, ranges::greater{}, &Student::score);

    for (auto& s : students) {
        cout << s.name << ": " << s.score << endl;
    }

    // 查找最高分
    auto it = ranges::max_element(students, {}, &Student::score);
    cout << "最高分: " << it->name << " " << it->score << endl;
    return 0;
}
```

投影 `&Student::score` 让算法在排序/比较时只看该成员，代码更简洁、意图更明确。

## 三、三路比较（Spaceship）

### 3.1 飞船操作符 <=>

三路比较操作符 `<=>` 一次比较即可得到「小于 / 等于 / 大于」三种结果，返回 `strong_ordering`（强序）或 `partial_ordering`（弱序，允许 NaN 等）：

```cpp
#include <iostream>
#include <compare>
using namespace std;

int main() {
    auto r = 3 <=> 5;
    if (r < 0)      cout << "3 < 5" << endl;
    else if (r == 0) cout << "3 == 5" << endl;
    else            cout << "3 > 5" << endl;

    // 返回类型
    cout << typeid(decltype(3 <=> 5)).name() << endl;       // strong_ordering
    cout << type
id(decltype(3.0 <=> 5.0)).name() << endl;   // partial_ordering
    return 0;
}
```

### 3.2 默认三路比较自动生成全套运算符

只要重载 `operator<=>`（并声明为 default），编译器自动生成 `<`、`<=`、`==`、`!=`、`>=`、`>` 全部 6 个运算符，省去大量样板代码：

```cpp
#include <iostream>
#include <compare>
#include <vector>
#include <algorithm>
using namespace std;

struct Point {
    int x, y;
    // 按 x 再按 y 自动比较
    auto operator<=>(const Point&) const = default;
};

int main() {
    vector<Point> pts = {{3, 1}, {1, 9}, {2, 5}};
    sort(pts.begin(), pts.end());       // 直接可用 < 排序

    for (auto& p : pts) cout << "(" << p.x << "," << p.y << ") ";
    cout << endl;

    Point a{1, 2}, b{1, 3};
    cout << (a < b) << endl;    // 1（x 相等，比 y）
    cout << (a != b) << endl;   // 1
    return 0;
}
```

成员按声明顺序逐项比较（字典序）。`= default` 的 `<=>` 要求所有成员都支持 `<=>` 或自带比较运算符。

## 四、协程与模块（C++20 重要特性）

### 4.1 协程：co_await 与生成器

C++20 协程让「可暂停/可恢复」的函数成为语言特性。虽然标准库生成器要等 C++23，但可以借助 `std::generator` 的替代品或自建极简协程。以下用 C++20 编译的最小协程示例（需要协程支持库）：

```cpp
#include <iostream>
#include <coroutine>
using namespace std;

// 极简 generator：每次 co_yield 产生一个整数
struct Generator {
    struct promise_type {
        int current;
        Generator get_return_object() { return Generator{this}; }
        suspend_always initial_suspend() { return {}; }
        suspend_always final_suspend() noexcept { return {}; }
        suspend_always yield_value(int v) { current = v; return {}; }
        void return_void() {}
        void unhandled_exception() {}
    };
    using handle = coroutine_handle<promise_type>;
    handle h;
    explicit Generator(promise_type* p) : h(handle::from_promise(*p)) {}
    ~Generator() { if (h) h.destroy(); }
    bool next() { h.resume(); return !h.done(); }
    int value() { return h.promise().current; }
};

Generator counter(int n) {
    for (int i = 1; i <= n; ++i)
        co_yield i;          // 挂起点
}

int main() {
    auto gen = counter(5);
    while (gen.next()) cout << gen.value() << " ";   // 1 2 3 4 5
    cout << end
l;
    return 0;
}
```

协程调用时并不立即执行，首次 `resume()` 才运行到第一个挂起点。`co_yield` 把值交给调用方后挂起，下次 `resume()` 继续。

### 4.2 模块（Modules）初探

模块取代头文件成为新的代码组织方式，编译更快、隔离更好。模块文件通常以 `.cppm` 结尾：

```cpp
// math.cppm —— 模块接口文件
export module math;

export int square(int x) {
    return x * x;
}

export double pi() {
    return 3.14159265358979;
}

// main.cpp —— 使用模块
import <iostream>;
import math;

int main() {
    std::cout << square(7) << std::endl;    // 49
    std::cout << pi() << std::endl;         // 3.14159
    return 0;
}
```

注意：模块编译需要较新的编译器（GCC 11+、Clang 16+、MSVC 2019 16.10+），且部分构建系统（如 CMake 3.28+）才完整支持。

## 五、其他实用新特性

### 5.1 std::span：零开销数组视图

`std::span` 是连续内存的「视图」，不拥有数据，可直接当数组使用，避免指针+长度参数：

```cpp
#include <iostream>
#include <span>
#include <vector>
using namespace std;

void printAll(span<const int> s) {
    for (int x : s) cout << x << " ";
    cout << endl;
}

int main() {
    int arr[] = {1, 2, 3, 4, 5};
    vector<int> vec = {10, 20, 30};

    printAll(arr);        // 数组自动转为 span
    printAll(vec);        // vector 自动转为 span
    printAll({arr + 1, 3}); // 指定子区间 2 3 4
    return 0;
}
```

`span` 不拷贝元素、不管理内存，是函数充参的最佳实践之一。

### 5.2 constexpr 扩展与立即函数

C++20 允许 `constexpr` 函数使用 `try`、`new/delete`、虚函数等，还引入 `consteval`（立即函数，只能在编译期调用）：

```cpp
#include <iostream>
#include <vector>
using namespace std;

consteval int square(int x) {   // 立即函数：只允许编译期求值
    return x * x;
}

constexpr int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

int main() {
    constexpr int a = square(9);       // 编译期计算 81
    constexpr int f = factorial(6);    // 720
    cout << a << " " << f << endl;
    return 0;
}
```

`consteval` 函数若在运行时上下文调用会直接编译错误，保证所有调用都发生在编译期。

## 六、实战：C++20 成绩分析器

综合运用概念、范围、三路
比较与 span 的完整案例：

```cpp
#include <iostream>
#include <ranges>
#include <vector>
#include <algorithm>
#include <concepts>
#include <compare>
#include <span>
#include <string>
using namespace std;

// 概念：成绩必须是算术类型
template <typename T>
concept Score = arithmetic<T>;

struct Student {
    string name;
    Score auto score;   // 概念简写：约束成员类型

    auto operator<=>(const Student&) const = default;  // 自动比较
};

// 用 span 接收成绩数组
template <Score T>
double average(span<const T> scores) {
    double sum = 0;
    for (auto s : scores) sum += s;
    return scores.empty() ? 0 : sum / scores.size();
}

int main() {
    vector<Student> students = {
        {"张三", 88}, {"李四", 92.5}, {"王五", 76}, {"赵六", 95}
    };

    // 范围算法 + 投影：按分数降序
    ranges::sort(students, ranges::greater{}, &Student::score);

    cout << "按分数排序:" << endl;
    for (auto& s : students)
        cout << s.name << " " << s.score << endl;

    // 取前两名（视图 + take）
    auto top2 = students | views::take(2);
    cout << "前两名: ";
    for (auto& s : top2) cout << s.name << " ";
    cout << endl;

    // 计算平均分（span 传入）
    vector<double> scores;
    for (auto& s : students) scores.push_back(s.score);
    cout << "平均分: " << average(span<const double>(scores)) << endl;
    return 0;
}
```

## 总结

本篇系统讲解了 C++20 核心新特性：**concepts** 让模板约束可读、可复用；**ranges** 以惰性视图与管道风格重构数据流；**三路比较**一次操作自动生成全套比较运算符；协程与模块开启语言新范式；`std::span` 与 `constexpr` 扩展让代码更安全高效。建议在 GCC 11+/Clang 16+/MSVC 2019 16.10+ 上开启 `-std=c++20` 实测。

下一篇将进入 **C++ 并发编程**（线程与互斥锁），敬请期待！
