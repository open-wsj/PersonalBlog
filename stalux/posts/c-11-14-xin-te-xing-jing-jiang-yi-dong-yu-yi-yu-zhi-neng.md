---
title: "C++11/14新特性精讲：移动语义与智能指针实战"
abbrlink: c-11-14-xin-te-xing-jing-jiang-yi-dong-yu-yi-yu-zhi-neng
date: "2026-09-01 18:34:48"
categories:
    - "C与C++"
tags: []
desc: "内容是关于C++现代特性：左值右值、移动语义、=default/=delete等。需概括核心。确保字数。</think>本文介绍C++现代特性：五类值分类与右值引用生命周期延长…"
---
> 本文是 C++ 系列教程的第 20 篇。模板阶段（16-19 篇）已完成，本篇进入现代 C++ 特性精讲：左值右值分类与移动语义实战、=default/=delete、noexcept、移动与 STL 容器性能、智能指针深化、auto/decltype 回顾。

### 一、值分类体系

#### 1.1 五类值

C++11 将表达式分为五类值：

| 类别 | 说明 | 示例 |
| --- | --- | --- |
| 左值 lvalue | 有名字，可取地址 | 变量、数组元素 |
| 纯右值 prvalue | 临时量，无名字 | 42、a+b、函数返回值 |
| 将亡值 xvalue | 即将销毁，可移动 | std::move(x) 的结果 |
| 广义左值 glvalue | lvalue + xvalue |  |
| 右值 rvalue | prvalue + xvalue |  |

#### 1.2 判断左右值

```cpp
#include <iostream>
#include <type_traits>
using namespace std;

// 判断表达式的值类别
template <typename T>
void checkValue(T &&value) {
    if constexpr (is_lvalue_reference_v<T>) {
        cout << "左值" << endl;
    } else {
        cout << "右值" << endl;
    }
}

int globalValue = 10;

int getRValue() { return 5; }

int main() {
    int x = 42;          // x 是左值
    int *p = &x;         // &x 是右值（地址临时量）

    cout << "x: ";
    checkValue(x);            // 左值
    cout << "42: ";
    checkValue(42);           // 右值
    cout << "getRValue(): ";
    checkValue(getRValue());  // 右值（返回值是临时量）
    cout << "move(x): ";
    checkValue(move(x));      // 右值（将亡值）
    return 0;
}
```

#### 1.3 右值引用的生命周期延长

```cpp
#include <iostream>
using namespace std;

class Temp {
public:
    Temp() { cout << "构造" << endl; }
    ~Temp() { cout << "析构" << endl; }
    void work() const { cout << "工作中" << endl; }
};

int main() {
    // 右值引用延长临时对象生命周期
    Temp &&ref = Temp();
    ref.work();   // 工作中

    // const 左值引用也能延长
    const Temp &cref = Temp();
    cref.work();
    cout << "main 结束" << endl;
    // 输出顺序：构造 工作中 构造 工作中 main 结束 析构 析构
    return 0;
}
```

### 二、移动语义深化

#### 2.1 深拷贝 vs 移动性能对比

```cpp
#include <iostream>
#include <chrono>
#include <vector>
#include <string>
using namespace std;
using namespace chrono;

int main() {
    const int N = 100000;

    // 拷贝版本
    vector<string> v1;
    auto start1 =
high_resolution_clock::now();
    for (int i = 0; i < N; i++) {
        string s(100, 'a');
        v1.push_back(s);        // 拷贝
    }
    auto end1 = high_resolution_clock::now();
    auto copyTime = duration_cast<milliseconds>(end1 - start1).count();

    // 移动版本
    vector<string> v2;
    auto start2 = high_resolution_clock::now();
    for (int i = 0; i < N; i++) {
        string s(100, 'a');
        v2.push_back(move(s));  // 移动
    }
    auto end2 = high_resolution_clock::now();
    auto moveTime = duration_cast<milliseconds>(end2 - start2).count();

    cout << "拷贝耗时: " << copyTime << " ms" << endl;
    cout << "移动耗时: " << moveTime << " ms" << endl;
    cout << "性能提升: " << (copyTime * 100.0 / max(1, moveTime) - 100) << "%" << endl;
    return 0;
}
```

#### 2.2 移动语义三原则

1.  **移动构造/赋值必须 noexcept**（否则 STL 容器扩容时退化为拷贝）。
2.  **移动后源对象必须处于有效但未指定状态**（通常置空）。
3.  **只对「大对象」有意义**（基本类型移动=拷贝）。

```cpp
#include <iostream>
#include <utility>
using namespace std;

class LargeObject {
private:
    int *data;
    size_t size;

public:
    LargeObject(size_t n) : data(new int[n]), size(n) {}

    // 拷贝构造
    LargeObject(const LargeObject &other)
        : data(new int[other.size]), size(other.size) {
        copy(other.data, other.data + size, data);
        cout << "深拷贝" << endl;
    }

    // 移动构造：必须 noexcept
    LargeObject(LargeObject &&other) noexcept
        : data(other.data), size(other.size) {
        other.data = nullptr;
        other.size = 0;
        cout << "移动构造" << endl;
    }

    // 移动赋值：必须 noexcept
    LargeObject &operator=(LargeObject &&other) noexcept {
        if (this != &other) {
            delete[] data;
            data = other.data;
            size = other.size;
            other.data = nullptr;
            other.size = 0;
            cout << "移动赋值" << endl;
        }
        return *this;
    }

    ~LargeObject() { delete[] data; }
};

int main() {
    LargeObject a(1000);
    LargeObject b = move(a);   // 移动构造
    LargeObject c(500);
    c = move(b);               // 移动赋值
    return 0;
}
```

### 三、=default 与 =delete

#### 3.1 =default 显式默认

```cpp
#include <iostream>
u
sing namespace std;

class DefaultDemo {
public:
    // 显式要求编译器生成默认版本
    DefaultDemo() = default;
    ~DefaultDemo() = default;
    DefaultDemo(const DefaultDemo &) = default;
    DefaultDemo &operator=(const DefaultDemo &) = default;

    int value = 0;
};

int main() {
    DefaultDemo d1;
    DefaultDemo d2 = d1;    // 使用默认拷贝
    d2.value = 42;
    cout << "d1.value = " << d1.value << endl;  // 0（浅拷贝）
    cout << "d2.value = " << d2.value << endl;  // 42
    return 0;
}
```

#### 3.2 =delete 禁用函数

```cpp
#include <iostream>
using namespace std;

class NoCopy {
public:
    NoCopy() = default;

    // 禁用拷贝（独占资源类常用）
    NoCopy(const NoCopy &) = delete;
    NoCopy &operator=(const NoCopy &) = delete;
};

class MathUtils {
public:
    // 禁用整型参数（防止隐式转换歧义）
    static int square(int x) { return x * x; }
    static double square(double x) = delete;  // 显式禁用 double
};

int main() {
    NoCopy n;
    // NoCopy n2 = n;   // 错误！拷贝已删除

    cout << MathUtils::square(5) << endl;   // 25
    // MathUtils::square(5.0);   // 错误！double 版本被删除
    return 0;
}
```

### 四、noexcept 异常说明

#### 4.1 noexcept 的作用

```cpp
#include <iostream>
#include <vector>
using namespace std;

// noexcept：承诺不抛异常
void safeFunction() noexcept {
    cout << "安全函数" << endl;
    // throw 1;   // 如果抛出，会直接 terminate
}

// 条件 noexcept
template <typename T>
void process(T &value) noexcept(noexcept(value.foo())) {
    value.foo();
}

int main() {
    safeFunction();
    cout << "noexcept 检查: " << noexcept(safeFunction()) << endl;  // 1
    cout << "普通函数: " << noexcept(process) << endl;              // 0
    return 0;
}
```

#### 4.2 为什么移动操作必须 noexcept

```cpp
#include <iostream>
#include <vector>
using namespace std;

class MoveNoexcept {
public:
    MoveNoexcept() = default;

    // noexcept 移动构造
    MoveNoexcept(MoveNoexcept &&) noexcept {
        cout << "noexcept 移动" << endl;
    }
    MoveNoexcept(const MoveNoexcept &) {
        cout << "拷贝" << endl;
    }
};

class MoveThrow {
public:
    MoveThrow() = default;

    // 可能抛异常的移动构造
    MoveThrow(MoveThrow &&) {   // 没有 noexcept
        cout << "非 noexcept 移动" << endl;

}
    MoveThrow(const MoveThrow &) {
        cout << "拷贝" << endl;
    }
};

int main() {
    // vector 扩容时：
    vector<MoveNoexcept> v1;
    for (int i = 0; i < 5; i++) v1.emplace_back();
    cout << "---" << endl;

    // 非 noexcept 移动：扩容时用拷贝（保证强异常安全）
    vector<MoveThrow> v2;
    for (int i = 0; i < 5; i++) v2.emplace_back();
    cout << "（观察到拷贝多于移动）" << endl;
    return 0;
}
```

### 五、智能指针实战深化

#### 5.1 自定义 deleter

```cpp
#include <iostream>
#include <memory>
using namespace std;

class File {
public:
    File(const char *name) {
        cout << "打开文件: " << name << endl;
    }
    void read() const {
        cout << "读取文件内容" << endl;
    }
};

// 自定义删除器
struct FileDeleter {
    void operator()(File *f) const {
        cout << "关闭并释放文件" << endl;
        delete f;
    }
};

int main() {
    // 智能指针 + 自定义删除器
    unique_ptr<File, FileDeleter> file(new File("data.txt"), FileDeleter());
    file->read();

    // shared_ptr 也支持自定义删除器
    shared_ptr<File> file2(new File("log.txt"), FileDeleter());
    file2->read();
    // 离开作用域自动调用删除器
    return 0;
}
```

#### 5.2 enable_shared_from_this

```cpp
#include <iostream>
#include <memory>
using namespace std;

class Node : public enable_shared_from_this<Node> {
public:
    shared_ptr<Node> getShared() {
        return shared_from_this();   // 安全地获取自身 shared_ptr
    }

    void show() const {
        cout << "Node 对象" << endl;
    }
};

int main() {
    shared_ptr<Node> n1 = make_shared<Node>();

    // 错误做法：不能用裸指针创建两个 shared_ptr
    // Node *raw = n1.get();
    // shared_ptr<Node> n2(raw);   // 双重释放！

    // 正确做法：shared_from_this
    shared_ptr<Node> n2 = n1->getShared();
    cout << "引用计数: " << n1.use_count() << endl;  // 2

    n2->show();
    return 0;
}
```

#### 5.3 shared_ptr 循环引用实战

```cpp
#include <iostream>
#include <memory>
using namespace std;

// 循环引用导致内存泄漏的案例
struct BadNode {
    string name;
    shared_ptr<BadNode> next;
    ~BadNode() { cout << name << " 析构" << endl; }
};

// 用 weak_ptr 打破循环
struct GoodNode {
    string name;
    weak_ptr<GoodNode> next;   // 弱引用
    ~Go
odNode() { cout << name << " 析构" << endl; }
};

int main() {
    {
        cout << "=== 循环引用（泄漏） ===" << endl;
        auto a = make_shared<BadNode>();
        auto b = make_shared<BadNode>();
        a->name = "A";
        b->name = "B";
        a->next = b;
        b->next = a;   // 互相引用 → 都析构不了
        // 程序结束：A 和 B 都不析构（泄漏）
    }

    {
        cout << "=== weak_ptr 打破循环 ===" << endl;
        auto a = make_shared<GoodNode>();
        auto b = make_shared<GoodNode>();
        a->name = "A";
        b->name = "B";
        a->next = b;
        b->next = a;   // weak_ptr 不增加计数
        // 程序结束：A 和 B 正常析构
    }
    return 0;
}
```

### 六、auto/decltype 现代用法

#### 6.1 auto 实战场景

```cpp
#include <iostream>
#include <vector>
#include <map>
#include <functional>
using namespace std;

int main() {
    // 复杂类型简化
    map<string, vector<pair<int, double>>> complexData;
    auto it = complexData.begin();    // 迭代器

    // 函数指针
    auto funcPtr = [](int x) { return x * 2; };  // lambda

    // std::function 包装
    function<int(int)> f1 = [](int x) { return x + 1; };
    auto f2 = f1;                     // 拷贝包装器

    // 结构化绑定（C++17）+ auto
    pair<string, int> person{"张三", 25};
    auto [name, age] = person;        // 自动解包
    cout << name << " " << age << endl;

    // 泛型 lambda（C++14）
    auto genericLambda = [](auto a, auto b) { return a + b; };
    cout << genericLambda(1, 2) << endl;       // 3
    cout << genericLambda(1.5, 2.5) << endl;   // 4
    return 0;
}
```

#### 6.2 decltype(auto) 精确转发

```cpp
#include <iostream>
using namespace std;

int globalValue = 100;

// 返回引用（decltype(auto) 保留引用）
decltype(auto) getGlobal() {
    return globalValue;   // decltype(globalValue) = int&
}

// auto 会丢失引用（拷贝）
auto getGlobalBad() {
    return globalValue;   // auto → int（拷贝）
}

int main() {
    decltype(auto) ref = getGlobal();
    ref = 999;
    cout << "globalValue = " << globalValue << endl;  // 999

    int x = 42;
    int &xref = x;
    auto a = xref;            // int（拷贝）
    decltype(auto) b = xref;  // int&（引用）
    a = 100;
    b = 200;
    cout << "x = " << x << endl;   // 200
    return 0;
}
```

### 七、实战：高性能内存池

综合本篇现代特性，实现简单的对象池：

```cpp
#include <iostream>
#include <memory>
#include <vector>
#include <utility>
using namespace std;

template <typename T>
class ObjectPool {
private:
    vector<unique_ptr<T>> objects;

public:
    // 完美转发创建对象
    template <typename... Args>
    T *acquire(Args &&... args) {
        auto obj = make_unique<T>(forward<Args>(args)...);
        T *raw = obj.get();
        objects.push_back(move(obj));
        return raw;
    }

    void releaseAll() {
        objects.clear();   // 统一释放
        cout << "全部释放" << endl;
    }

    size_t size() const { return objects.size(); }
};

class Task {
private:
    string id;
    int priority;
public:
    Task(string i, int p) : id(move(i)), priority(p) {}
    void run() const {
        cout << "任务 " << id << "（优先级 " << priority << "）执行" << endl;
    }
};

int main() {
    ObjectPool<Task> pool;

    // 完美转发多参数
    Task *t1 = pool.acquire("T1", 3);
    Task *t2 = pool.acquire("T2", 5);

    t1->run();
    t2->run();
    cout << "池中对象数: " << pool.size() << endl;   // 2

    // 移动语义让 pool 安全析构
    pool.releaseAll();
    return 0;
}
```

### 总结

本篇讲解了五类值体系与移动语义、深拷贝 vs 移动的性能对比、移动操作 noexcept 的重要性、=default/=delete、智能指针深化（自定义 deleter、shared_from_this、循环引用）、auto/decltype 现代用法，并用对象池串联实战。重点掌握：移动操作必须 noexcept、shared_ptr 循环引用用 weak_ptr 打破、decltype(auto) 保留引用、=delete 禁用不想要的函数。

下一篇将讲解 **C++17 新特性精讲**（结构化绑定、if constexpr、optional/variant/any、filesystem），敬请期待！
