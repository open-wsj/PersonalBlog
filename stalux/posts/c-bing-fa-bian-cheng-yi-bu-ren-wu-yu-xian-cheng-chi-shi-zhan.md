---
title: "C++并发编程：异步任务与线程池实战"
abbrlink: c-bing-fa-bian-cheng-yi-bu-ren-wu-yu-xian-cheng-chi-shi-zhan
date: "2026-09-02 19:58:59"
categories:
    - "C与C++"
tags: []
desc: "一行启动异步任务并获取结果（含异常传递与 wait_for 超时）、手动生产-消费单次结果、把任务与 future 打包、线程池的核心实现（条件变量任务队列 + packaged_task 封装 +…"
---
> 本文是 C++ 系列教程的第 25 篇。上一篇讲解了条件变量与原子操作，本篇实战并发收尾：std::async 与 future、packaged_task 与 promise、线程池实现与任务调度，覆盖 9 个完整示例代码。

## 一、异步任务（std::async 与 std::future）

### 1.1 std::async 启动异步任务

`std::async` 在 `<future>` 头文件提供，把「启动线程 + 获取结果」封装成一行。返回 `std::future` 对象，调用 `get()` 阻塞等待结果：

```cpp
#include <iostream>
#include <future>
#include <thread>
using namespace std;

int computeSum(int n) {
    int sum = 0;
    for (int i = 1; i <= n; ++i) sum += i;
    return sum;
}

int main() {
    // 异步启动（默认策略可能开新线程或复用当前线程）
    future<int> f1 = async(launch::async, computeSum, 10000);
    future<int> f2 = async(launch::async, computeSum, 5000);

    // 主线程继续做别的事
    cout << "主线程工作中..." << endl;
    this_thread::sleep_for(chrono::milliseconds(100));

    // get() 阻塞直到结果就绪
    cout << "sum(1..10000) = " << f1.get() << endl;
    cout << "sum(1..5000) = " << f2.get() << endl;
    return 0;
}
```

`launch::async` 强制新线程执行；`launch::deferred` 惰性执行（get 时才在调用线程运行）；不传则实现自行选择。

### 1.2 异常传递与 wait_for 超时

`future::get()` 会把异步任务中的异常重新抛出；`wait_for` 可非阻塞查询任务状态：

```cpp
#include <iostream>
#include <future>
#include <chrono>
#include <stdexcept>
using namespace std;

int riskyTask(int x) {
    if (x < 0) throw runtime_error("参数不能为负");
    this_thread::sleep_for(chrono::milliseconds(300));
    return x * 2;
}

int main() {
    future<int> f = async(launch::async, riskyTask, -5);

    // 等待最多 100ms，看是否完成
    auto status = f.wait_for(chrono::milliseconds(100));
    if (status == future_status::timeout)
        cout << "任务未完成，继续等待..." << endl;

    try {
        int result = f.get();          // 异常在此抛出
        cout << "结果: " << result << endl;
    } catch (const exception& e) {
        cout << "捕获异常: " << e.what() << endl;
    }
    return 0;
}
```

`future_status` 有三种：`ready`（已完成）、`timeout`（超时未完成）、`deferred`（惰性未启动）。

## 二、promise 与 packaged_task

### 2.1 std::promise 手动设置结果

`std::promise` 与 `std::future` 配对：promise 负责「生产结果」，future 负责「消费结果」。适合线程间传递单次计算结果：

```cpp
#include <iostream>
#include <thread>
#include <future>
#include <string>
using namespace std;

void worker(promise<string> p, string name) {
    this_thread::sleep_for(chrono::milliseconds(200));
    p.set_value("你好, " + name + "!");   // 生产结果
}

int main() {
    promise<string> prom;
    future<string> fut = prom.get_future();

    thread t(worker, move(prom), "张三");
    cout << "等待结果..." << endl;
    string result = fut.get();            // 阻塞直到 set_value
    cout << result << endl;
    t.join();
    return 0;
}
```

注意：`promise` 必须 `move` 进线程（不可拷贝）。`set_value` 只能调用一次，重复调用会抛 `std::future_error`。

### 2.2 std::packaged_task 包装可调用对象

`packaged_task` 把「可调用对象 + future」打包，适合把任务交给线程池或队列调度：

```cpp
#include <iostream>
#include <future>
#include <thread>
using namespace std;

int multiply(int a, int b) {
    return a
 * b;
}

int main() {
    packaged_task<int(int, int)> task(multiply);
    future<int> fut = task.get_future();

    thread t(move(task), 6, 7);   // 在线程中执行任务
    cout << "6 * 7 = " << fut.get() << endl;
    t.join();
    return 0;
}
```

`packaged_task` 与 `std::function` 用法类似，区别是它自带 future 用于接收任务结果。

## 三、线程池实现

### 3.1 为什么要线程池

频繁创建/销毁线程开销大。线程池**预创建固定数量线程**，持续从任务队列取任务执行，大幅降低线程管理开销，也避免线程数无限增长。

### 3.2 完整线程池实现

综合运用互斥锁、条件变量、函数对象与任务队列：

```cpp
#include <iostream>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <queue>
#include <functional>
#include <future>
#include <vector>
using namespace std;

class ThreadPool {
    vector<thread> workers;
    queue<function<void()>> tasks;
    mutex mtx;
    condition_variable cv;
    bool stop;

public:
    explicit ThreadPool(size_t threads) : stop(false) {
        for (size_t i = 0; i < threads; ++i) {
            workers.emplace_back([this] {

  while (true) {
                    function<void()> task;
                    {
                        unique_lock<mutex> lock(mtx);
                        cv.wait(lock, [this] {
                            return stop || !tasks.empty();
                        });
                        if (stop && tasks.empty()) return;
                        task = move(tasks.front());
                        tasks.pop();
                    }
                    task();   // 在锁外执行，避免阻塞其他线程取任务
                }
            });
        }
    }

    // 提交任务，返回 future 获取结果
    template <typename F, typename... Args>
    auto enqueue(F&& f, Args&&... args)
        -> future<invoke_result_t<F, Args...>> {
        using Ret = invoke_result_t<F, Args...>;
        auto task = make_shared<packaged_task<Ret()>>(
            bind(forward<F>(f), forward<Args>(args)...));
        future<Ret> res = task->get_future();
        {
            lock_guard<mutex> lock(mtx);
            if (stop) throw runtime_error("线程池已停止");
            tasks.emplace([task]() { (*task)(); });
        }
        cv.notify_one();
        return res;
    }

~ThreadPool() {
        {
            lock_guard<mutex> lock(mtx);
            stop = true;
        }
        cv.notify_all();
        for (auto& w : workers) w.join();
    }
};

int square(int x) {
    return x * x;
}

int main() {
    ThreadPool pool(4);

    vector<future<int>> results;
    for (int i = 1; i <= 8; ++i) {
        results.push_back(pool.enqueue(square, i));
    }

    for (auto& f : results) {
        cout << f.get() << " ";
    }
    cout << endl;
    return 0;
}
```

核心设计：工作线程循环 `cv.wait` 等待任务；`enqueue` 用 `packaged_task` 包装任务并返回 future；析构时置 `stop` 并 `notify_all`，所有线程优雅退出。锁外执行任务避免串行化。

## 四、实战：并行归并排序

用线程池加速归并排序，体会「任务拆分 + 并行执行 + 结果合并」的完整异步模式：

```cpp
#include <iostream>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <queue>
#include <functional>
#include <future>
#include <vector>
#include <algorithm>
using namespace std;

// 简化版线程池（复用 3.2 的思路，此处直接递归拆分线程）
mutex outMtx;

void merge(vector<int>& arr,
 int left, int mid, int right) {
    vector<int> tmp(right - left + 1);
    int i = left, j = mid + 1, k = 0;
    while (i <= mid && j <= right) {
        if (arr[i] <= arr[j]) tmp[k++] = arr[i++];
        else tmp[k++] = arr[j++];
    }
    while (i <= mid) tmp[k++] = arr[i++];
    while (j <= right) tmp[k++] = arr[j++];
    copy(tmp.begin(), tmp.end(), arr.begin() + left);
}

void parallelMergeSort(vector<int>& arr, int left, int right, int depth = 0) {
    if (left >= right) return;
    int mid = (left + right) / 2;

    if (depth < 3) {   // 深度限制，避免创建过多线程
        auto f1 = async(launch::async, [&] {
            parallelMergeSort(arr, left, mid, depth + 1);
        });
        auto f2 = async(launch::async, [&] {
            parallelMergeSort(arr, mid + 1, right, depth + 1);
        });
        f1.get();
        f2.get();
    } else {           // 深度足够时退化为串行
        parallelMergeSort(arr, left, mid, depth + 1);
        parallelMergeSort(arr, mid + 1, right, depth + 1);
    }
    merge(arr, left, mid, right);
}

int main() {
    vector<int> arr(100000);
    for (int i = 0; i < (int)arr.size(); ++i)
        arr[i] = rand() % 100000;

   auto begin = chrono::high_resolution_clock::now();
    parallelMergeSort(arr, 0, (int)arr.size() - 1);
    auto end = chrono::high_resolution_clock::now();
    double ms = chrono::duration<double, milli>(end - begin).count();

    bool sorted = is_sorted(arr.begin(), arr.end());
    cout << "排序完成: " << (sorted ? "是" : "否")
         << "，耗时 " << ms << " ms" << endl;
    return 0;
}
```

用深度限制控制并行度，避免 `async` 创建成百上千线程导致性能反降。深度 3 意味着最多 8 个并行段，配合归并保证正确合并。

## 总结

本篇系统讲解了 C++ 异步与线程池：**std::async + future** 一行启动异步任务并获取结果（含异常传递与 wait_for 超时）、**promise/future** 手动生产-消费单次结果、**packaged_task** 把任务与 future 打包、**线程池**的核心实现（条件变量任务队列 + packaged_task 封装 + 优雅关闭）、以及并行归并排序实战。至此 C++ 并发三篇（23-25）全部完成，涵盖锁、原子、条件变量、异步与线程池全链路。

下一篇进入 **C++ 工程化：CMake 构建与多文件项目管理**，敬请期待！
