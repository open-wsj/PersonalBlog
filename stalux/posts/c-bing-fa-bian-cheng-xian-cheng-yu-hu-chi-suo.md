---
title: "C++并发编程：线程与互斥锁"
abbrlink: c-bing-fa-bian-cheng-xian-cheng-yu-hu-chi-suo
date: "2026-09-01 18:35:51"
categories:
    - "C与C++"
tags: []
desc: "的创建/join/detach 与参数传递、数据竞争的危害、std::mutex与 RAII 封装（lock_guard / unique_lock /…"
---
> 本文是 C++ 系列教程的第 23 篇。上一篇讲解了 C++20 新特性，本篇进入并发编程世界：std::thread 线程创建与管理、互斥锁与数据竞争防护、死锁避免与锁的最佳实践，覆盖 9 个完整示例代码。

## 一、线程基础（std::thread）

### 1.1 创建线程的三种方式

`std::thread` 在 `<thread>` 头文件提供。线程对象一旦构造完成立即开始执行，可传入函数指针、函数对象或 Lambda：

```cpp
#include <iostream>
#include <thread>
using namespace std;

void worker(int id) {
    cout << "线程 " << id << " 开始工作" << endl;
    this_thread::sleep_for(chrono::milliseconds(200));
    cout << "线程 " << id << " 工作结束" << endl;
}

int main() {
    // 方式一：函数指针
    thread t1(worker, 1);

    // 方式二：函数对象
    struct Task {
        void operator()(int n) const {
            cout << "函数对象任务 " << n << endl;
        }
    };
    thread t2(Task{}, 2);

    // 方式三：Lambda
    thread t3([](int n) {
        cout << "Lambda 任务 " << n << endl;
    }, 3);

    t1.join();
    t2.join();
    t3.join();
    cout << "主线程结束" << endl;
    return 0;
}
```

`join()` 阻塞主线程直到子线程完成。必须对每个可 join 的线程调用 `join()` 或 `detach()`，否则析构时程序会 `std::terminate`。

### 1.2 join、detach 与线程参数传递

```cpp
#include <iostream>
#include <thread>
#include <string>
using namespace std;

void printMsg(string msg, int times) {
    for (int i = 0; i < times; ++i)
        cout << msg << " " << i << endl;
}

int main() {
    // 参数按值传递；引用参数需用 std::ref
    thread t1(printMsg, "hello", 3);

    int counter = 0;
    thread t2([&counter] {
        for (int i = 0; i < 5; ++i) counter++;
    });

    t1.join();

    // detach：后台运行，不阻塞主线程
    thread t3([]{ cout << "后台线程运行" << endl; });
    t3.detach();

    t2.join();
    cout << "counter = " << counter << endl;
    return 0;
}
```

传引用给线程函数必须显式用 `std::ref` 包裹，否则会按值拷贝。`detach()` 后线程与主线程分离，访问已销毁的局部变量会引发未定义行为，需谨慎。

## 二、数据竞争与互斥锁

### 2.1 数据竞争演示

多个线程同时读写共享变量会产生**数据竞争（data race）**，结果
是未定义的：

```cpp
#include <iostream>
#include <thread>
#include <vector>
using namespace std;

int main() {
    int counter = 0;
    vector<thread> threads;

    for (int i = 0; i < 4; ++i) {
        threads.emplace_back([&counter] {
            for (int j = 0; j < 100000; ++j) counter++;
        });
    }
    for (auto& t : threads) t.join();

    // 期望 400000，实际可能远小于该值（数据竞争）
    cout << "counter = " << counter << endl;
    return 0;
}
```

`counter++` 不是原子操作（读-改-写三步），多线程交错执行导致计数丢失。运行多次会得到不同结果。

### 2.2 用 std::mutex 保护临界区

`std::mutex` 提供互斥访问，`lock()`/`unlock()` 成对使用。更推荐用 RAII 封装的 `std::lock_guard` 或 `std::unique_lock`，异常安全且不会忘记解锁：

```cpp
#include <iostream>
#include <thread>
#include <mutex>
#include <vector>
using namespace std;

mutex mtx;
int counter = 0;

void safeIncrement() {
    lock_guard<mutex> lock(mtx);   // 构造时加锁，析构时自动解锁
    counter++;
}

int main() {
    vector<thread> threads;
    for (int i = 0; i < 4; ++i) {
        threads.emplace_back([] {
            for (int j = 0; j < 100000; ++j) safeIncrement();
        });
    }
    for (auto& t : threads) t.join();
    cout << "counter = " << counter << endl;   // 稳定输出 400000
    return 0;
}
```

### 2.3 lock_guard 与 unique_lock 对比

| 特性 | lock_guard | unique_lock |
| --- | --- | --- |
| 加锁方式 | 构造即锁，不可手动解锁 | 可延迟加锁、手动解锁 |
| 移动语义 | 不支持 | 支持 |
| 配合条件变量 | 不适用（需 unlock） | 适用 |
| 开销 | 更小 | 略大（状态标志） |

```cpp
#include <iostream>
#include <mutex>
#include <thread>
using namespace std;

mutex mtx;
int shared = 0;

void doWork(bool critical) {
    unique_lock<mutex> lock(mtx, defer_lock);   // 延迟匠锁
    // ... 偹一些非临界区准备工作 ...
    lock.lock();                                // 需要时前办宜标锁
    shared++;
    lock.unlock();                              // 提前解锁
    // ... 临界区之外y�: %y��y.#yc��e yllyd�H����B��[�XZ[�
Hˆ�XYJ��ܚ��YJNˆ�XY���ܚ��[�JNˆK���[�
Nˆ����[�
Nˆ��]��\�YH��\�Y[�ˆ�]\��ŸB����9."x� y�f�e y.#�`o�acy
��略

## 3.1 死锁的产生

两个线程各持有一把锁，又互相等待对方释放，形成循环等待即死锁：

```cpp
#include <iostream>
#include <mutex>
#include <thread>
using namespace std;

mutex mtxA, mtxB;

void thread1() {
    lock_guard<mutex> a(mtxA);
    this_thread::sleep_for(chrono::milliseconds(10));
    lock_guard<mutex> b(mtxB);   // 等待 mtxB（被线程2持有）
    cout << "线程1完成" << endl;
}

void thread2() {
    lock_guard<mutex> b(mtxB);
    this_thread::sleep_for(chrono::milliseconds(10));
    lock_guard<mutex> a(mtxA);   // 等待 mtxA（被线程1持有）→ 死锁
    cout << "线程2完成" << endl;
}

int main() {
    thread t1(thread1);
    thread t2(thread2);
    t1.join();
    t2.join();
    return 0;
}
```

程序将永远卡住。**死锁四要素**：互斥、持有并等待、不可剥夺、循环等待，破坏任一即可避免。

### 3.2 用 std::lock 一次性锁定多把锁

`std::lock` 可原子性地同时锁定多个互斥体，避免死锁；再配合 `std::scoped_lock`（C++17）更简洁：

```cpp
#include <iostream>
#include <mutex>
#include <thread>
using namespace std;

mutex mtxA, mtxB;

void safeWork(int id) {
    // scoped_lock 同时锁定两把锁（内部用 std::lock 算法，无死锁）
    scoped_lock lock(mtxA, mtxB);
    cout << "线程 " << id << " 同时持有两把锁执行" << endl;
    this_thread::sleep_for(chrono::milliseconds(20));
}

int main() {
    thread t1(safeWork, 1);
    thread t2(safeWork, 2);
    t1.join();
    t2.join();
    cout << "无死锁，正常结束" << endl;
    return 0;
}
```

实践原则：**全局统一加锁顺序**（如总是先 A 后 B），或使用 `std::lock`/`scoped_lock` 同时锁定多个锁，避免循环等待。

## 四、实战：多线程任务累加器

综合运用线程、互斥锁、锁保护与计时的小工具，把一个大任务拆成多个线程并行计算：

```cpp
#include <iostream>
#include <thread>
#include <mutex>
#include <vector>
#include <chrono>
using namespace std;

mutex mtx;
long long total = 0;

// 每个线程计算一段 [start, end] 的累加
void partialSum(long long start, long long end) {
    long long local = 0;
    for (long long i = start; i <= end; ++i) local += i;

    lock_guard<mutex> lock(mtx);   // 只保护最后合并结果
    total += local;
}

int main() {
    const long long N =
 10000000;   // 1 加到 1千万
    const int numThreads = 4;

    vector<thread> threads;
    long long chunk = N / numThreads;

    auto begin = chrono::high_resolution_clock::now();

    for (int t = 0; t < numThreads; ++t) {
        long long start = t * chunk + 1;
        long long end = (t == numThreads - 1) ? N : (t + 1) * chunk;
        threads.emplace_back(partialSum, start, end);
    }
    for (auto& th : threads) th.join();

    auto end = chrono::high_resolution_clock::now();
    double ms = chrono::duration<double, milli>(end - begin).count();

    // 理论值 N*(N+1)/2
    cout << "结果: " << total << "（期望 50000005000000）" << endl;
    cout << "耗时: " << ms << " ms，线程数: " << numThreads << endl;
    return 0;
}
```

关键技巧：每个线程先算**局部结果**，只在合并时动销，把锁竞争降到最低，比每个元素都动销快几个数量级。

## 总结

本篇讲解了 C++ 并发编程基础：**std::thread** 的创建/join/detach 与参数传递、**数据竞争**的危害、**std::mutex** 与 RAII 封装（lock_guard / unique_lock / scoped_lock）保护共享数据、**死锁**的产生与避免（统一加锁顺序 / std::lock 同时锁定），最后用一个多线程累加器演示「局部计算 + 短临界区合并」的性能最佳实践。

下一篇将讲解 **C++ 并发编程：条件变量与原子操作**（生产消费者模型、condition_variable、atomic 与内存序），敬请期待！
