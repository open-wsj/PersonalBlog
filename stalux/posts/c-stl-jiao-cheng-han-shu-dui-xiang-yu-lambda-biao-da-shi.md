---
title: "C++STL教程：函数对象与Lambda表达式"
abbrlink: c-stl-jiao-cheng-han-shu-dui-xiang-yu-lambda-biao-da-shi
date: "2026-08-29 00:35:12"
categories:
    - "C与C++"
tags: []
desc: "函数对象（Functor）是重载了operator()的类对象，可以像函数一样调用。与普通函数相比，它可以保存状态。// 函数对象：重载 operator()private:int base;//…"
---
> 本文是 C++ 系列教程的第 14 篇。上一篇讲解了迭代器与算法库，本篇讲解函数对象与 Lambda 表达式：仿函数、lambda 语法（捕获列表/参数/返回类型）、值捕获与引用捕获、mutable、std::function、std::bind、与算法配合。

### 一、函数对象（仿函数）

#### 1.1 什么是函数对象

函数对象（Functor）是**重载了 `operator()` 的类对象**，可以像函数一样调用。与普通函数相比，它可以**保存状态**。

```cpp
#include <iostream>
using namespace std;

// 函数对象：重载 operator()
class Adder {
private:
    int base;   // 保存状态

public:
    Adder(int b) : base(b) {}

    int operator()(int value) const {
        return value + base;
    }
};

int main() {
    Adder add5(5);
    Adder add10(10);

    cout << add5(3) << endl;    // 8（像函数一样调用）
    cout << add10(3) << endl;   // 13
    return 0;
}
```

#### 1.2 带状态的函数对象

函数对象的优势是**保存状态**，这是普通函数做不到的：

```cpp
#include <iostream>
using namespace std;

class Counter {
private:
    int count = 0;

public:
    int operator()() {
        return ++count;    // 每次调用状态递增
    }
};

int main() {
    Counter counter;
    cout << counter() << endl;   // 1
    cout << counter() << endl;   // 2
    cout << counter() << endl;   // 3
    return 0;
}
```

#### 1.3 函数对象与算法的配合

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

// 阈值过滤器
class GreaterThan {
private:
    int threshold;
public:
    GreaterThan(int t) : threshold(t) {}
    bool operator()(int value) const {
        return value > threshold;
    }
};

int main() {
    vector<int> nums = {3, 8, 1, 6, 9, 2, 7};

    // 统计 >5 的元素个数
    int count = count_if(nums.begin(), nums.end(), GreaterThan(5));
    cout << "大于 5 的个数: " << count << endl;  // 4

    // 找出第一个 >6 的元素
    auto it = find_if(nums.begin(), nums.end(), GreaterThan(6));
    if (it != nums.end()) {
        cout << "第一个 >6: " << *it << endl;  // 8
    }
    return 0;
}
```

### 二、Lambda 表达式

#### 2.1 Lambda 基础语法

C++11 引入的 lambda 是**匿名函数对象**，语法简洁：

```cpp
[capture](parameters) -> return_type { body };
```

```cpp
#include <iostream>
using namespace std
;

int main() {
    // 最简单的 lambda：无参数无返回值
    auto hello = []() { cout << "Hello Lambda" << endl; };
    hello();

    // 带参数和返回值
    auto add = [](int a, int b) { return a + b; };
    cout << add(3, 4) << endl;   // 7

    // 显式返回类型
    auto divide = [](double a, double b) -> double {
        if (b == 0) return 0;
        return a / b;
    };
    cout << divide(10, 4) << endl;  // 2.5
    return 0;
}
```

#### 2.2 捕获列表详解

lambda 可以通过捕获列表访问**外部变量**：

```cpp
#include <iostream>
using namespace std;

int main() {
    int base = 10;
    int factor = 2;

    // 值捕获 [base]：拷贝外部变量
    auto addBase = [base](int x) { return x + base; };
    cout << addBase(5) << endl;   // 15

    // 引用捕获 [&factor]：使用引用，可修改外部变量
    auto multiply = [&factor](int x) { return x * factor; };
    factor = 3;
    cout << multiply(5) << endl;   // 15（factor 已变）

    // 全部值捕获 [=]
    auto allByValue = [=](int x) { return x + base + factor; };

    // 全部引用捕获 [&]
    auto allByRef = [&](int x) { return x * factor; };

    // 混合捕获 [base, &factor]
    auto mixed = [base, &factor](int x) { return x + base * factor; };
    return 0;
}
```

#### 2.3 捕获方式对比

| 捕获方式 | 语法 | 说明 |
| --- | --- | --- |
| 值捕获 | `[base]` | 拷贝，lambda 内只读 |
| 引用捕获 | `[&base]` | 引用，可修改外部 |
| 全部值捕获 | `[=]` | 所有用到的按值 |
| 全部引用捕获 | `[&]` | 所有用到的按引用 |
| 混合 | `[base, &factor]` | 分别指定 |
| 全部+例外 | `[=, &factor]` | 除 factor 外按值 |
| 全部+例外 | `[&, base]` | 除 base 外按引用 |

#### 2.4 mutable：值捕获也可修改

```cpp
#include <iostream>
using namespace std;

int main() {
    int counter = 0;

    // 默认值捕获在 lambda 内只读
    auto increment = [counter]() mutable {
        counter++;        // mutable 允许修改副本
        return counter;
    };

    cout << increment() << endl;  // 1（副本）
    cout << increment() << endl;  // 2（副本继续）
    cout << "外部 counter: " << counter << endl;  // 0（外部不变）

    // 引用捕获可以直接修改外部
    auto incrementRef = [&counter]() {
        counter++;
        return counter;
    };
    cout << increm
entRef() << endl;  // 1（外部改变）
    cout << "外部 counter: " << counter << endl;  // 1
    return 0;
}
```

### 三、Lambda 与算法实战

#### 3.1 排序中的 Lambda

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

struct Student {
    string name;
    int score;
    int age;
};

int main() {
    vector<Student> students = {
        {"张三", 88, 20},
        {"李四", 92, 19},
        {"王五", 88, 22},
        {"赵六", 76, 21}
    };

    // 按分数降序
    sort(students.begin(), students.end(),
        [](const Student &a, const Student &b) {
            return a.score > b.score;
        });

    // 按分数降序，分数相同按年龄升序（多字段排序）
    sort(students.begin(), students.end(),
        [](const Student &a, const Student &b) {
            if (a.score != b.score) return a.score > b.score;
            return a.age < b.age;
        });

    for (const auto &s : students) {
        cout << s.name << " " << s.score << "分 " << s.age << "岁" << endl;
    }
    return 0;
}
```

#### 3.2 Lambda 实现复杂逻辑

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> nums = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};

    int lower = 3, upper = 8;

    // 组合条件：筛选 [lower, upper] 范围内的偶数
    auto count = count_if(nums.begin(), nums.end(),
        [lower, upper](int x) {
            return x >= lower && x <= upper && x % 2 == 0;
        });
    cout << "范围内偶数个数: " << count << endl;  // 3（4,6,8）

    // 变换：范围内的数乘以倍数
    int multiplier = 10;
    vector<int> result;
    transform(nums.begin(), nums.end(), back_inserter(result),
        [lower, upper, multiplier](int x) {
            if (x >= lower && x <= upper) return x * multiplier;
            return x;
        });

    cout << "变换结果: ";
    for (int x : result) cout << x << " ";
    cout << endl;
    return 0;
}
```

### 四、std::function 与 std::bind

#### 4.1 std::function 通用函数包装

`std::function` 可以存储**任何可调用对象**（函数指针、lambda、函数对象）：

```cpp
#include <iostream>
#include <functional>
using namespace std;

int add(int a, int b) { return a + b; }

class Multiplier {
public:
    int factor;
    Multiplier(int f) : factor(f) {}
    int operator
()(int x) const { return x * factor; }
};

int main() {
    // std::function 存储不同类型的可调用对象
    function<int(int, int)> op1 = add;                       // 函数指针
    function<int(int, int)> op2 = [](int a, int b) {         // lambda
        return a - b;
    };
    function<int(int)> op3 = Multiplier(5);                  // 函数对象

    cout << op1(3, 4) << endl;   // 7
    cout << op2(10, 3) << endl;  // 7
    cout << op3(6) << endl;      // 30

    // 可重新赋值
    op1 = [](int a, int b) { return a * b; };
    cout << op1(3, 4) << endl;   // 12
    return 0;
}
```

#### 4.2 std::function 作为参数

```cpp
#include <iostream>
#include <functional>
#include <vector>
using namespace std;

// 把"操作"作为参数传入
void processVector(vector<int> &v, const function<void(int &)> &operation) {
    for (auto &x : v) {
        operation(x);
    }
}

int main() {
    vector<int> nums = {1, 2, 3, 4};

    // 传入不同的操作
    processVector(nums, [](int &x) { x *= 2; });
    cout << "翻倍: ";
    for (int x : nums) cout << x << " ";
    cout << endl;   // 2 4 6 8

    processVector(nums, [](int &x) { x += 1; });
    cout << "加一: ";
    for (int x : nums) cout << x << " ";
    cout << endl;   // 3 5 7 9
    return 0;
}
```

#### 4.3 std::bind 绑定参数

```cpp
#include <iostream>
#include <functional>
using namespace std;

int power(int base, int exp) {
    int result = 1;
    for (int i = 0; i < exp; i++) result *= base;
    return result;
}

int main() {
    using namespace std::placeholders;

    // 绑定第二个参数为 2（平方函数）
    auto square = bind(power, _1, 2);
    cout << "square(5) = " << square(5) << endl;  // 25

    // 绑定第一个参数为 2（2 的 n 次方）
    auto powerOf2 = bind(power, 2, _1);
    cout << "powerOf2(10) = " << powerOf2(10) << endl;  // 1024

    // 反转参数顺序
    auto rev = bind(power, _2, _1);
    cout << "rev(3, 2) = " << rev(3, 2) << endl;   // 8（2^3）
    return 0;
}
```

### 五、函数对象 vs Lambda 对比

| 维度 | 函数对象 | Lambda |
| --- | --- | --- |
| 语法 | 定义类，代码长 | 简洁 |
| 状态 | 成员变量保存 | 捕获列表 |
| 复用 | 可多次实例化 | 每次都是新类型 |
| 调试 | 有类型名 | 匿名类型 |
| 使用场景 | 需要复用的逻辑 | 一次性的局部逻辑 |

### 六、实战：�

��配置的统计工具

综合本篇知识，用 std::function 实现可配置统计：

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
#include <functional>
using namespace std;

class StatsAnalyzer {
private:
    vector<int> data;

public:
    void addData(const vector<int> &values) {
        data.insert(data.end(), values.begin(), values.end());
    }

    // 通用过滤统计：传入任意判断条件
    int countIf(const function<bool(int)> &predicate) const {
        return count_if(data.begin(), data.end(), predicate);
    }

    // 通用聚合：传入任意累积规则
    int aggregate(int init, const function<int(int, int)> &accumulator) const {
        int result = init;
        for (int x : data) {
            result = accumulator(result, x);
        }
        return result;
    }

    // 通用转换：返回新数据
    vector<int> transformData(const function<int(int)> &mapper) const {
        vector<int> result;
        transform(data.begin(), data.end(), back_inserter(result), mapper);
        return result;
    }
};

int main() {
    StatsAnalyzer analyzer;
    analyzer.addData({1, 2, 3, 4, 5, 6, 7, 8, 9, 10});

    // 不同条件统计
    cout << "偶数: " << analyzer.countIf([](int x) { return x % 2 == 0; }) << endl;
    cout << "大于 5: " << analyzer.countIf([](int x) { return x > 5; }) << endl;

    // 不同聚合方式
    cout << "求和: " << analyzer.aggregate(0, [](int a, int b) { return a + b; }) << endl;
    cout << "求积: " << analyzer.aggregate(1, [](int a, int b) { return a * b; }) << endl;

    // 不同转换
    auto squares = analyzer.transformData([](int x) { return x * x; });
    cout << "平方: ";
    for (int x : squares) cout << x << " ";
    cout << endl;
    return 0;
}
```

### 总结

本篇讲解了函数对象（带状态、与算法配合）、Lambda 表达式的完整语法（捕获列表、mutable）、值捕获与引用捕获的区别、std::function 通用包装、std::bind 参数绑定，并用可配置统计工具串联实战。重点掌握：捕获列表的七种写法、mutable 的作用、std::function 的灵活用法、多字段排序的 lambda 写法。

下一篇将讲解**容器适配器与实用工具**（stack/queue/priority_queue、pair/tuple、chrono、random），敬请期待！
