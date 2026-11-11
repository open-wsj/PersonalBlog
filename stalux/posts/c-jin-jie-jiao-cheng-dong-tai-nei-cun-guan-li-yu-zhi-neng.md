---
title: "C++进阶教程：动态内存管理与智能指针"
abbrlink: c-jin-jie-jiao-cheng-dong-tai-nei-cun-guan-li-yu-zhi-neng
date: "2026-08-28 18:13:02"
categories:
    - "C与C++"
tags: []
desc: "RAII（Resource Acquisition Is Initialization，资源获取即初始化）：把资源（内存、文件、锁）的获取放在构造函数中，释放放在析构函数中…"
---
> 本文是 C++ 系列教程的第 9 篇。上一篇讲解了继承与多态，本篇讲解动态内存管理的核心：new/delete 配对、内存泄漏与悬垂指针、RAII 思想、智能指针（unique_ptr/shared_ptr/weak_ptr）、make_unique/make_shared、循环引用。

### 一、动态内存基础

#### 1.1 new 与 delete

动态内存（堆内存）在**运行时**分配，生命周期由程序员控制：

```cpp
#include <iostream>
using namespace std;

int main() {
    // 单个对象
    int *p = new int(42);        // 分配并初始化
    cout << "*p = " << *p << endl;  // 42
    delete p;                    // 释放内存（必须！）
    p = nullptr;                 // 悬垂指针置空

    // 数组
    int *arr = new int[5];
    for (int i = 0; i < 5; i++) arr[i] = i * 10;
    cout << "arr[3] = " << arr[3] << endl;  // 30
    delete[] arr;                // 数组用 delete[]

    // 对象
    string *s = new string("Hello");
    cout << *s << endl;
    delete s;
    return 0;
}
```

**配对规则**：`new` 配 `delete`，`new[]` 配 `delete[]`。混用是未定义行为。

#### 1.2 内存泄漏

```cpp
#include <iostream>
using namespace std;

void leakExample() {
    int *p = new int(100);
    // 没有 delete p！函数结束指针技失，内存无法释放 → 内存泄漏
}

int main() {
    for (int i = 0; i < 1000; i++) {
        leakExample();   // 每次泄漏 4 字节
    }
    cout << "程序结束（已泄漏内存）" << endl;
    return 0;
}
```

**内存泄漏的危害**：程序长期运行内存持续增长，最终耗尽内存导致崩溃。服务器程序尤其严重。

#### 1.3 悬垂指针与双重释放

```cpp
#include <iostream>
using namespace std;

int main() {
    int *p1 = new int(10);

    int *p2 = p1;        // 两个指针指向同一块内存
    delete p1;           // 释放
    // delete p2;        // 错误！双重释放 → 崩溃

    // *p2 = 20;         // 错误！p2 现在是悬垂指针（指向已释放内存）
    cout << "避免双重释放和悬垂指针访问" << endl;
    return 0;
}
```

### 二、RAII 思想

#### 2.1 什么是 RAII

**RAII（Resource Acquisition Is Initialization，资源获取即初始化）**：把资源（内存、文件、锁）的获取放在构造函数中，释放放在析构函数中。对象生命周期结束（离开作用域）时，析构函数自动�
��放资源。

```cpp
#include <iostream>
using namespace std;

// 手动管理：容易出错
class BadResource {
public:
    int *data;
    BadResource() : data(new int[100]) {}
    ~BadResource() { delete[] data; }   // 忘记写就泄漏
};

// RAII 思想已体现在之前的 String 类中：构造分配、析构释放
class SmartResource {
private:
    int *data;
public:
    SmartResource() : data(new int[100]) {
        cout << "获取资源" << endl;
    }
    ~SmartResource() {
        delete[] data;
        cout << "自动释放资源" << endl;
    }
};

int main() {
    {
        S
martResource r;   // 构造：获取资源
        cout << "使用资源..." << endl;
    }                       // 析构：自动释放（即使有异常也会释放）
    cout << "RAII 保证资源安全释放" << endl;
    return 0;
}
```

#### 2.2 RAII 的优势

1.  **异常安全**：即使抛出异常，析构函数也会执行。
2.  **代码简洁**：无需手动清理。
3.  **防止泄漏**：资源一定被释放。

### 三、智能指针（C++11）

#### 3.1 unique_ptr（独占所有权）

`unique_ptr` 独占管理指针，**不能拷贝**，只能转移（移动），离开作用
域自动释放：

```cpp
#include <iostream>
#include <memory>
using namespace std;

class Resource {
public:
    Resource() { cout << "资源创建" << endl; }
    ~Resource() { cout << "资源释放" << endl; }
    void work() { cout << "工作中..." << endl; }
};

int main() {
    // 方式一：直接构造
    unique_ptr<Resource> p1(new Resource());

    // 方式二：make_unique（推荐，C++14）
    auto p2 = make_unique<Resource>();

    // 不能拷贝
    // unique_ptr<Resource> p3 = p1;   // 错误！

    // 转移所有权
    unique_ptr<Resource> p3 = move(p1);
    // p1 �
��在是空指针

    p3->work();
    // 离开作用域自动释放
    return 0;
}
```

**使用场景**：独占资源的所有权，如工厂函数返回值、容器中的对象。

#### 3.2 shared_ptr（共享所有权）

`shared_ptr` 使用**引用计数**，多个指针共享同一对象，最后一个释放时销毁对象：

```cpp
#include <iostream>
#include <memory>
using namespace std;

class Resource {
public:
    int id;
    Resource(int i) : id(i) { cout << "创建资源 " << id << endl; }
    ~Resource() { cout << "释放资源 " << id << endl; }
};

int main() {
    // make_
shared：一次分配对象和计数块（推荐）
    shared_ptr<Resource> p1 = make_shared<Resource>(1);

    cout << "p1 引用计数: " << p1.use_count() << endl;  // 1

    {
        shared_ptr<Resource> p2 = p1;   // 拷贝：计数 +1
        shared_ptr<Resource> p3 = p1;   // 拷贝：计数 +1
        cout << "计数: " << p1.use_count() << endl;      // 3
        cout << "p2->id = " << p2->id << endl;          // 1
    }   // p2, p3 销毁，计数 -2

    cout << "计数: " << p1.use_count() << endl;  // 1
    // p1 销毁时计数归零，释放资源
    return 0;
}
```

#### 3.3

weak_ptr（弱引用，打破循环引用）

`weak_ptr` 不增加引用计数，用于**观察** shared_ptr 管理的对象，解决循环引用问题：

```cpp
#include <iostream>
#include <memory>
using namespace std;

class B;   // 前向声明

class A {
public:
    shared_ptr<B> b_ptr;
    ~A() { cout << "A 析构" << endl; }
};

class B {
public:
    // 若这里用 shared_ptr<A>，则 A 和 B 互相持有 → 循环引用，都不释放
    weak_ptr<A> a_ptr;   // 用 weak_ptr 打破循环
    ~B() { cout << "B 析构" << endl; }
};

int main() {
    shared_ptr<A> a = make_shared<A>()
;
    shared_ptr<B> b = make_shared<B>();
    a->b_ptr = b;
    b->a_ptr = a;    // weak_ptr 不增加计数

    cout << "a 计数: " << a.use_count() << endl;  // 1（b 持有的是 weak）
    cout << "b 计数: " << b.use_count() << endl;  // 2（a 持有 shared）

    // 用 weak_ptr 访问需要 lock()
    if (auto sp = b->a_ptr.lock()) {
        cout << "通过 weak_ptr 访问 A 成功" << endl;
    }
    // 程序结束：a 和 b 都能正常析构
    return 0;
}
```

#### 3.4 三种智能指针对比

| 维度 | unique_ptr | shared_ptr | weak_ptr |
| --- | --- | --- | --- |
| 所有� |  |  |  |
| �� | 独占 | 共享 | 无（观察） |
| 拷贝 | 禁止 | 允许（计数+1） | 允许 |
| 移动 | 允许 | 允许 | 允许 |
| 引用计数 | 无 | 有 | 有（不增加） |
| 开销 | 最小 | 较大 | 较小 |
| 适用 | 独占资源 | 多所有者 | 打破循环引用 |

### 四、智能指针实战

#### 4.1 用智能指针重构图形系统

```cpp
#include <iostream>
#include <memory>
#include <vector>
using namespace std;

class Shape {
public:
    virtual double area() const = 0;
    virtual void info() const = 0;
    virtual ~Shape() {}
};

class Circle : public Shape {
    doubl
e r;
public:
    Circle(double radius) : r(radius) {}
    double area() const override { return 3.14159 * r * r; }
    void info() const override { cout << "圆面积: " << area() << endl; }
};

class Rectangle : public Shape {
    double w, h;
public:
    Rectangle(double a, double b) : w(a), h(b) {}
    double area() const override { return w * h; }
    void info() const override { cout << "矩形面积: " << area() << endl; }
};

int main() {
    // 容器存储智能指针：自动管理生命周期，无需手动 delete
    vector<unique_ptr<Shape>> shapes;
    shapes.push_back(make_uniqu
e<Circle>(3));
    shapes.push_back(make_unique<Rectangle>(4, 5));

    double total = 0;
    for (const auto &s : shapes) {
        s->info();
        total += s->area();
    }
    cout << "总面积: " << total << endl;
    // 离开作用域 vector 析构，unique_ptr 自动释放所有 Shape
    return 0;
}
```

#### 4.2 工厂函数返回智能指针

```cpp
#include <iostream>
#include <memory>
using namespace std;

class Logger {
public:
    virtual void log(const string &msg) const = 0;
    virtual ~Logger() {}
};

class ConsoleLogger : public Logger {
public:
    void log(const string
&msg) const override {
        cout << "[控制台] " << msg << endl;
    }
};

class FileLogger : public Logger {
public:
    void log(const string &msg) const override {
        cout << "[文件] " << msg << endl;
    }
};

// 工厂函数：返回 unique_ptr，所有权转移给调用者
unique_ptr<Logger> createLogger(const string &type) {
    if (type == "console") {
        return make_unique<ConsoleLogger>();
    } else {
        return make_unique<FileLogger>();
    }
}

int main() {
    auto logger = createLogger("console");
    logger->log("系统启动");

    logger = createLogger(
"file");   // 旧对象自动释放
    logger->log("切换到文件日志");
    return 0;
}
```

#### 4.3 正确使用规范

```cpp
#include <iostream>
#include <memory>
using namespace std;

class Widget {
public:
    void show() { cout << "Widget" << endl; }
};

void process(shared_ptr<Widget> p) {
    cout << "处理中，计数: " << p.use_count() << endl;
}

int main() {
    // 规范 1：用 make_shared 而非 new
    shared_ptr<Widget> w = make_shared<Widget>();

    // 规范 2：传参用值传递（拷贝）或用 const&
    process(w);

    // 规范 3：不要混用裸指针和�
�能指针
    // Widget *raw = w.get();  // get() 只读不拥有

    // 规范 4：不要用裸指针创建多个 shared_ptr
    // Widget *rw = new Widget();
    // shared_ptr<Widget> s1(rw);
    // shared_ptr<Widget> s2(rw);   // 错误！双重释放

    w->show();
    return 0;
}
```

### 五、实战：内存安全的链表

用智能指针实现链表，无需手动管理内存：

```cpp
#include <iostream>
#include <memory>
using namespace std;

struct Node {
    int data;
    unique_ptr<Node> next;   // 每个节点独占下一个节点

    Node(int v) : data(v) {}
};

class Linke
dList {
private:
    unique_ptr<Node> head;

public:
    // 头插法
    void pushFront(int value) {
        auto newNode = make_unique<Node>(value);
        newNode->next = move(head);    // 转移旧头节点
        head = move(newNode);
    }

    void print() const {
        Node *cur = head.get();
        while (cur) {
            cout << cur->data << " ";
            cur = cur->next.get();
        }
        cout << endl;
    }

    // 析构：head 释放时自动递归释放整个链表
};

int main() {
    LinkedList list;
    list.pushFront(30);
    list.pushFront(20);
    list.push
Front(10);

    list.print();   // 10 20 30
    // list 析构时整个链表自动释放，无内存泄漏
    cout << "链表已自动释放" << endl;
    return 0;
}
```

### 总结

本篇讲解了 new/delete 配对、内存泄漏与悬垂指针的危害、RAII 思想、三种智能指针（unique_ptr 独占、shared_ptr 共享、weak_ptr 观察）及其选择、循环引用的打破，并用智能指针链表串联实战。重点掌握：RAII 的核心思想、三种智能指针的适用场景、make_unique/make_shared 的使用、循环引用的解决方案。

下一篇将讲解**文件�
��与字符串流**（fstream、sstream、filesystem），敬请期待！
