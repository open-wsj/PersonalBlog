---
title: "C++并发编程：条件变量与原子操作"
abbrlink: c-bing-fa-bian-cheng-tiao-jian-bian-liang-yu-yuan-zi-cao-zuo
date: "2026-09-01 18:36:16"
categories:
    - "C与C++"
tags: []
desc: "实现阻塞等待与通知（含谓词重载防虚假唤醒）、生产者消费者模型的完整实现、atomic 原子类型（fetch_add/CAS…"
---
> 本文是 C++ 系列教程的第 24 篇。上一篇讲解了线程与互斥锁，本篇深入同步机制进阶：条件变量与生产者消费者模型、原子类型与内存序、无锁编程入门与读写锁，覆盖 9 个完整示例代码。

## 一、条件变量（std::condition_variable）

### 1.1 为什么需要条件变量

互斥锁只能保证「同时只有一个人进房间」，但无法解决「等待某个条件成立」的问题。条件变量允许线程**阻塞等待**某个条件，直到另一线程**通知**它醒来，避免忙等待浪费 CPU：

```cpp
#include <iostream>
#include <thread>
#include <mutex>
#include <condition_variable>
using namespace std;

mutex mtx;
condition_variable cv;
bool ready = false;

void waiter() {
    unique_lock<mutex> lock(mtx);
    cv.wait(lock, []{ return ready; });   // 阻塞直到 ready == true
    cout << "等待者被唤醒，开始工作" << endl;
}

void notifier() {
    this_thread::sleep_for(chrono::milliseconds(500));
    {
        lock_guard<mutex> lock(mtx);
        ready = true;                     // 修改条件必须在锁内
    }
    cv.notify_one();                      // 唤醒一个等待线程
}

int main() {
    thread t1(waiter);
    thread t2(notifier);
    t1.join();
    t2.join();
    return 0;
}
```

`wait(lock, predicate)` 的谓词重载等价于 `while (!pred()) wait(lock)`，能自动处理**虚假唤醒（spurious wakeup）**。

### 1.2 生产消费者模型

条件变量最经典的应用场景。生产者往队列放数据并通知，消费者阻塞等待并从队列取数据：

```cpp
#include <iostream>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <queue>
using namespace std;

mutex mtx;
condition_variable cv;
queue<int> tasks;
bool done =
false;

void producer() {
    for (int i = 1; i <= 5; ++i) {
        {
            lock_guard<mutex> lock(mtx);
            tasks.push(i);
            cout << "生产: " << i << endl;
        }
        cv.notify_one();                  // 通知消费者
        this_thread::sleep_for(chrono::milliseconds(100));
    }
    {
        lock_guard<mutex> lock(mtx);
        done = true;
    }
    cv.notify_all();                      // 唤醒所有消费者（处理结束）
}

void consumer(int id) {
    while (true) {
        unique_lock<mutex> lock(mtx);
        cv.wait(lock, []{ return !tasks.empty() || done; });
        if (!tasks.empty()) {
            int task = tasks.front();
            tasks.pop();
            cout << "  消费者 " << id << " 消费: " << task << endl;
        } else if (done) {
            break;                        // 生产结束且队列为空
        }
    }
}

int main() {
    thread p(producer);
    thread c1(consumer, 1);
    thread c2(consumer, 2);
    p.join();
    c1.join();
    c2.join();
    cout << "生产消费完成" << endl;
    return 0;
}
```

**关键点**：`notify_one` 唤醒单个线程，`notify_all` 唤醒全部；等待条件必须用 `while`/谓词重载以防虚假唤醒；`done` 标志防止消费者永久阻塞。

## 二、原子操作（std::atomic）

### 2.1 原子类型基础

`std::atomic<T>` 提供无锁（或锁内部实现的）原子操作，`fetch_add`、`exchange`、`compare_exchange` 等保证读-改-写完整性，无需互斥锁：

```cpp
#include <iostream>
#include <thread>
#include <atomic>
#include <vector>
using namespace std;

atomic<int> counter{0};

void increment() {
    for (int i = 0; i < 100000; ++i) counter.fetch_add(1);
}

int main() {
    vector<thread> threads;
    for (int i = 0; i <
4; ++i) threads.emplace_back(increment);
    for (auto& t : threads) t.join();

    cout << "counter = " << counter.load() << endl;   // 400000，无需加锁
    return 0;
}
```

`fetch_add` 原子完成「读-加-写」。`load()` 原子读取，`store()` 原子写入。

### 2.2 compare_exchange 与自旋锁

`compare_exchange_strong` 是 CAS 指令的封装：当前值等于期望值时写入新值，否则更新期望值为实际值。可用它实现自旋锁：

```cpp
#include <iostream>
#include <thread>
#include <atomic>
#include <vector>
using namespace std;

class SpinLock {
    atomic<bool> flag{false};
public:
    void lock() {
        // 期望 false，尝试写入 true；失败则自旋重试
        while (flag.exchange(true)) {
            // 空转等待（可加 this_thread::yield() 让出 CPU）
        }
    }
    void unlock() {
        flag.store(false);
    }
};

SpinLock spin;
int counter = 0;

void work() {
    for (int i = 0; i < 50000; ++i) {
        lock_guard<SpinLock> lock(spin);
        counter++;
    }
}

int main() {
    vector<thread> threads;
    for (int i = 0; i < 4; ++i) threads.emplace_back(work);
    for (auto& t : threads) t.join();
    cout << "counter = " << counter << endl;   // 200000
    return 0;
}
```

自旋锁适合**临界区极短**的场景；临界区长时应使用会阻塞的 `std::mutex`，避免浪费 CPU。

## 三、内存序（Memory Order）

### 3.1 为什么要关心内存序

编译器与 CPU 可能重排指令（单线程不可见，多线程可导致意外行为）。内存序控制重排边界：

```cpp
#include <iostream>
#include <thread>
#include <atomic>
using namespace std;

atomic<bool> ready{false};
int data = 0;

void producer() {
    data = 42;                    // 写数据
    ready.store(tru
e, memory_order_release);   // 释放语义：之前的写操作全部可见
}

void consumer() {
    while (!ready.load(memory_order_acquire)) { }  // 获取语义：确保读到最新 data
    cout << "data = " << data << endl;             // 保证读到 42
}

int main() {
    thread t1(producer);
    thread t2(consumer);
    t1.join();
    t2.join();
    return 0;
}
```

`release`（写侧）与 `acquire`（读侧）配对使用，形成**同步关系（happens-before）**，保证生产者写入的数据对消费者可见。

### 3.2 常见内存序对比

| 内存序 | 语义 | 用途 |
| --- | --- | --- |
| memory_order_relaxed | 无同步，仅保证原子性 | 计数器、统计量 |
| memory_order_acquire | 其后读写不可越过本操作 | 读取标志位 |
| memory_order_release | 其前读写不可越过本操作 | 发布数据 |
| memory_order_acq_rel | acquire + release | RMW 操作 |
| memory_order_seq_cst | 全序一致（默认） | 复杂同步，易推理 |

```cpp
#include <iostream>
#include <thread>
#include <atomic>
using namespace std;

atomic<long long> hits{0};

void report() {
    for (int i = 0; i < 1000000; ++i) {
        hits.fetch_add(1, memory_order_relaxed);   // 只需原子性，无需同步

    }
}

int main() {
    thread t1(report);
    thread t2(report);
    t1.join();
    t2.join();
    cout << "hits = " << hits.load(memory_order_relaxed) << endl;  // 2000000
    return 0;
}
```

**经验**：默讙 seq_cst` 最容易正确，性能足够时优先使用；只有基准测试证明是瓶颈，才降级为 relaxed/acquire/release 并仔细论证正确性。

## 四、实战：线程安全的任务队列

综合运用互斥锁、条件变量与 RAII 封装一个可直接复用的线程安全队列：

```cpp
#include <iostream>
#inc
lude <thread>
#include <mutex>
#include <condition_variable>
#include <queue>
#include <optional>
using namespace std;

template <typename T>
class ThreadSafeQueue {
    mutable mutex mtx;
    condition_variable cv;
    queue<T> q;
public:
    void push(T value) {
        {
            lock_guard<mutex> lock(mtx);
            q.push(move(value));
        }
        cv.notify_one();
    }

    // 阻塞弹出
    T pop() {
        unique_lock<mutex> lock(mtx);
        cv.wait(lock, [this]{ return !q.empty(); });
        T value = move(q.front());
        q.pop();
        return value;
    }

    // 非阻塞尝试弹出
    optional<T> tryPop() {
        lock_guard<mutex> lock(mtx);
        if (q.empty()) return nullopt;
        T value = move(q.front());
        q.pop();
        return value;
    }

    size_t size() const {
        lock_guard<mutex> lock(mtx);
        return q.size();
    }
};

int main() {
    ThreadSafeQueue<int> tq;

    thread producer([&] {
        for (int i = 1; i <= 6; ++i) {
            tq.push(i);
            this_thread::sleep_for(chrono::milliseconds(50));
        }
    });

    thread consumer([&] {
        for (int i = 0; i < 6; ++i) {
            int v = tq.pop();      // 阻塞等待
            cout << "取出: " << v << "（队列剩余 " << tq.size() << "）" << endl;
        }
    });

    producer.join();
    consumer.join();
    cout << "线程安全队列测试完成" << endl;
    return 0;
}
```

该队列把锁与条件变量的复杂性封装在内部，对外提供 `push`/`pop`/`tryPop`/`size` 四个安全接口，是生产环境常用的基础组件。

## 总结

本篇讲解了并发同步进阶技术：**condition_variable** 实现阻塞等待与通知（含谓词重载防虚假唤醒）、**生产者消费者模型**的完
整实现、**atomic 原子类型**（fetch_add/CAS 自旋锁）避免数据竞争、**内存序**（relaxed/acquire/release/seq_cst）控制可见性与重排，最后封装了一个线程安全的任务队列组件。建议配合互斥锁按场景选用：临界区短用原子，等待条件用条件变量，常规保护用 mutex。

下一篇将讲解 **C++ 并发编程：异步任务与线程池实战**（std::async、future、packaged_task 与线程池实现），敬请期待！
