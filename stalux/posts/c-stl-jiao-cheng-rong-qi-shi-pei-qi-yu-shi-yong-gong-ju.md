---
title: "C++STL教程：容器适配器与实用工具"
abbrlink: c-stl-jiao-cheng-rong-qi-shi-pei-qi-yu-shi-yong-gong-ju
date: "2026-08-30 11:00:46"
categories:
    - "C与C++"
tags: []
desc: "容器适配器是基于其他容器包装出的受限接口适配器底层容器（默认）特性stackdeque后进先出 LIFOqueuedeque先进先出 FIFOvector按优先级出队// 病情严重程度//…"
---
> 本文是 C++ 系列教程的第 15 篇。上一篇讲解了函数对象与 Lambda，本篇讲解容器适配器与实用工具：stack/queue/priority_queue（含自定义比较）、pair/tuple（结构化绑定）、bitset、chrono 时间库、random 随机数库。

### 一、容器适配器

#### 1.1 什么是容器适配器

容器适配器是**基于其他容器包装出的受限接口**容器，只暴露特定操作：

| 适配器 | 底层容器（默认） | 特性 |
| --- | --- | --- |
| stack | deque | 后进先出 LIFO |
| queue | deque | 先进先出 FIFO |
| priority_queue | vector | 按优先级出队 |

### 二、stack 栈

#### 2.1 stack 基本操作

```cpp
#include <iostream>
#include <stack>
using namespace std;

int main() {
    stack<int> s;

    // 入栈
    s.push(10);
    s.push(20);
    s.push(30);

    cout << "栈大小: " << s.size() << endl;   // 3
    cout << "栈顶: " << s.top() << endl;      // 30

    // 出栈
    s.pop();
    cout << "出栈后栈顶: " << s.top() << endl;  // 20

    // 遍历（弹出方式）
    while (!s.empty()) {
        cout << s.top() << " ";
        s.pop();
    }
    cout << endl;   // 20 10
    return 0;
}
```

#### 2.2 stack 实战：括号匹配

```cpp
#include <iostream>
#include <stack>
#include <string>
using namespace std;

bool isBalanced(const string &expr) {
    stack<char> s;
    for (char c : expr) {
        if (c == '(' || c == '[' || c == '{') {
            s.push(c);
        } else if (c == ')' || c == ']' || c == '}') {
            if (s.empty()) return false;
            char top = s.top();
            s.pop();
            // 检查是否匹配
            if ((c == ')' && top != '(') ||
                (c == ']' && top != '[') ||
                (c == '}' && top != '{')) {
                return false;
            }
        }
    }
    return s.empty();
}

int main() {
    cout << "(()): " << isBalanced("(())") << endl;       // 1
    cout << "([{}]): " << isBalanced("([{}])" << endl;   // 1
    cout << "(()]: " << isBalanced("(()]") << endl;       // 0
    cout << "([)]: " << isBalanced("([])") << endl;       // 0
    cout << "empty: " << isBalanced("") << endl;           // 1
    return 0;
}
```

### 三、queue 队列

#### 3.1 queue 基本操作

```cpp
#include <iostream>
#include <queue>
using namespace std;

int main() {
    queue<int> q;

    // 入队
    q.push(10);

q.push(20);
    q.push(30);

    cout << "队首: " << q.front() << endl;   // 10
    cout << "队尾: " << q.back() << endl;    // 30

    // 出队
    q.pop();
    cout << "出队后队首: " << q.front() << endl;  // 20

    // 遍历（弹出方式）
    while (!q.empty()) {
        cout << q.front() << " ";
        q.pop();
    }
    cout << endl;   // 20 30
    return 0;
}
```

#### 3.2 queue 实战：任务队列

```cpp
#include <iostream>
#include <queue>
#include <string>
using namespace std;

struct Task {
    string name;
    int priority;

    Task(string n, int p) : name(n), priority(p) {}
};

int main() {
    queue<Task> tasks;

    tasks.push(Task("备份数据", 1));
    tasks.push(Task("发送邮件", 2));
    tasks.push(Task("生成报表", 3));

    // 依次处理任务
    while (!tasks.empty()) {
        Task t = tasks.front();
        tasks.pop();
        cout << "处理: " << t.name << "（优先级 " << t.priority << "）" << endl;
    }
    return 0;
}
```

### 四、priority_queue 优先队列

#### 4.1 基本用法

```cpp
#include <iostream>
#include <queue>
using namespace std;

int main() {
    // 默认：大顶堆（最大元素在队首）
    priority_queue<int> pq;
    pq.push(30);
    pq.push(10);
    pq.push(50);
    pq.push(20);

    cout << "最大值: " << pq.top() << endl;  // 50
    pq.pop();
    cout << "弹出后: " << pq.top() << endl;  // 30

    // 小顶堆（最小元素在队首）
    priority_queue<int, vector<int>, greater<int>> minPQ;
    minPQ.push(30);
    minPQ.push(10);
    minPQ.push(50);
    cout << "最小值: " << minPQ.top() << endl;  // 10
    return 0;
}
```

#### 4.2 自定义类型的优先队列

```cpp
#include <iostream>
#include <queue>
#include <string>
using namespace std;

struct Patient {
    string name;
    int severity;    // 病情严重程度

    Patient(string n, int s) : name(n), severity(s) {}
};

// 自定义比较：severity 大的优先
struct ComparePatient {
    bool operator()(const Patient &a, const Patient &b) const {
        return a.severity < b.severity;   // 与 sort 相反
    }
};

int main() {
    priority_queue<Patient, vector<Patient>, ComparePatient> er;

    er.push(Patient("张三", 3));
    er.push(Patient("李四", 5));
    er.push(Patient("王五", 2));
    er.push(Patient("赵六", 4));

    // 按病情紧急程度出队
    while (!er.empty()) {

    Patient p = er.top();
        er.pop();
        cout << "接诊: " << p.name << "（危重等级 " << p.severity << "）" << endl;
    }
    return 0;
}
```

### 五、pair 与 tuple

#### 5.1 pair 键值对

```cpp
#include <iostream>
#include <utility>
#include <string>
using namespace std;

int main() {
    // pair 存储两个值
    pair<string, int> p1("张三", 88);
    pair<string, int> p2 = {"李四", 92};
    auto p3 = make_pair("王五", 76);   // 类型推导

    cout << p1.first << ": " << p1.second << endl;
    cout << p2.first << ": " << p2.second << endl;

    // 修改
    p3.second = 80;
    cout << p3.first << ": " << p3.second << endl;

    // 比较（先比 first 再比 second）
    cout << (p1 < p2) << endl;   // "张三" < "李四"? 0

    // 结构化绑定（C++17）
    auto [name, score] = p1;
    cout << "绑定: " << name << " " << score << endl;
    return 0;
}
```

#### 5.2 tuple 多元组

```cpp
#include <iostream>
#include <tuple>
#include <string>
using namespace std;

int main() {
    // tuple 可存储任意多个不同类型值
    tuple<int, string, double> t1(1, "Alice", 88.5);
    auto t2 = make_tuple(2, "Bob", 95.0);

    // 访问
    cout << get<0>(t1) << " " << get<1>(t1) << " " << get<2>(t1) << endl;

    // 修改
    get<2>(t1) = 90.0;
    cout << "修改后: " << get<2>(t1) << endl;

    // 结构化绑定（C++17）
    auto [id, name, score] = t2;
    cout << id << " " << name << " " << score << endl;

    // tie：同时解包
    int i;
    string s;
    double d;
    tie(i, s, d) = t1;
    cout << i << " " << s << " " << d << endl;
    return 0;
}
```

### 六、bitset 位集

#### 6.1 bitset 基本操作

```cpp
#include <iostream>
#include <bitset>
using namespace std;

int main() {
    // 8 位位集
    bitset<8> b1;             // 00000000
    bitset<8> b2(42);         // 00101010（十进制转二进制）
    bitset<8> b3("10101111"); // 从字符串构造

    cout << "b1: " << b1 << endl;
    cout << "b2: " << b2 << endl;
    cout << "b3: " << b3 << endl;

    // 位操作
    b3.set(0);       // 设置第 0 位
    b3.reset(1);     // 清除第 1 位
    b3.flip(2);      // 翻转第 2 位
    cout << "操作后: " << c3 << endl;

    // 查询
    cout << "b3 中 1 的个数: " << b3.count() << endl;
    cout << "b3 大小: " << b3.size() << endl;
    cout << "b3 是否有 1: " << b3.any() <<
 endl;

    // 位运算
    bitset<8> result = b2 & b3;
    cout << "b2 & b3: " << result << endl;
    return 0;
}
```

#### 6.2 bitset 实战：素数筛选

```cpp
#include <iostream>
#include <bitset>
using namespace std;

// 用 bitset 实现埃拉托斯特尼筛法
void sieve(int n) {
    bitset<1000> isComposite;
    for (int i = 2; i * i <= n; i++) {
        if (!isComposite[i]) {
            for (int j = i * i; j <= n; j += i) {
                isComposite[j] = true;
            }
        }
    }

    cout << "素数: ";
    for (int i = 2; i <= n; i++) {
        if (!isComposite[i]) cout << i << " ";
    }
    cout << endl;
}

int main() {
    sieve(50);
    return 0;
}
```

### 七、chrono 时间库

#### 7.1 时间点与时长

```cpp
#include <iostream>
#include <chrono>
#include <thread>
using namespace std;
using namespace chrono;

int main() {
    // 当前时间点
    auto now = system_clock::now();
    cout << "当前时间戳: " << duration_cast<milliseconds>(now.time_since_epoch()).count() << " ms" << endl;

    // 时长类型
    seconds s(10);
    milliseconds ms(1500);
    minutes m(2);

    // 时长运算
    auto total = s + duration_cast<seconds>(ms) + m;
    cout << "总时长: " << total.count() << " 秒" << endl;  // 131

    // 时长换算
    auto ms2 = duration_cast<milliseconds>(total);
    cout << "等于: " << ms2.count() << " 毫秒" << endl;    // 131000
    return 0;
}
```

#### 7.2 程序计时

```cpp
#include <iostream>
#include <chrono>
#include <vector>
#include <algorithm>
using namespace std;
using namespace chrono;

int main() {
    vector<int> data(100000);
    for (int i = 0; i < 100000; i++) data[i] = rand() % 100000;

    // 开始计时
    auto start = high_resolution_clock::now();

    sort(data.begin(), data.end());

    // 结束计时
    auto end = high_resolution_clock::now();
    auto duration = duration_cast<milliseconds>(end - start);

    cout << "排序耗时: " << duration.count() << " 毫秒" << endl;
    return 0;
}
```

### 八、random 随机数库

#### 8.1 现代随机数（优于 rand）

```cpp
#include <iostream>
#include <random>
using namespace std;

int main() {
    // 随机数引擎 + 种子
    random_device rd;              // 真随机种子
    mt19937 gen(rd());             // 梅森旋转引擎

    // 均匀分布 [1, 100]
    uniform_int_distribution<int> intDist(1, 100);

  for (int i = 0; i < 5; i++) {
        cout << intDist(gen) << " ";
    }
    cout << endl;

    // 均匀浮点 [0.0, 1.0)
    uniform_real_distribution<double> realDist(0.0, 1.0);
    for (int i = 0; i < 5; i++) {
        cout << realDist(gen) << " ";
    }
    cout << endl;

    // 正态分布（均值为 0，标准差 1）
    normal_distribution<double> normalDist(0.0, 1.0);
    for (int i = 0; i < 5; i++) {
        cout << normalDist(gen) << " ";
    }
    cout << endl;
    return 0;
}
```

#### 8.2 rand vs 现代随机数

| 维度 | rand() | 现代随机数库 |
| --- | --- | --- |
| 头文件 | cstdlib | random |
| 分布 | 只有均匀整数 | 多种分布 |
| 质量 | 较差 | 高质量（MT19937） |
| 种子 | 需手动 srand | random_device |
| 推荐 | 不推荐 | **推荐** |

### 九、实战：任务调度系统

综合本篇知识，实现优先任务调度：

```cpp
#include <iostream>
#include <queue>
#include <chrono>
#include <string>
using namespace std;
using namespace chrono;

struct Job {
    string id;
    int priority;       // 优先级（越大越优先）
    double duration;    // 预计耗时（秒）

    Job(string i, int p, double d) : id(i), priority(p), duration(d) {}
};

// 大顶堆：优先级高的先执行
struct CompareJob {
    bool operator()(const Job &a, const Job &b) const {
        return a.priority < b.priority;
    }
};

int main() {
    priority_queue<Job, vector<Job>, CompareJob> scheduler;

    scheduler.push(Job("J1", 3, 1.5));
    scheduler.push(Job("J2", 5, 0.8));
    scheduler.push(Job("J3", 1, 2.0));
    scheduler.push(Job("J4", 4, 1.2));

    cout << "===== 任务调度（按优先级） =====" << endl;
    auto start = steady_clock::now();
    double totalTime = 0;

    while (!scheduler.empty()) {
        Job job = scheduler.top();
        scheduler.pop();
        cout << "执行 " << job.id << "（优先级 " << job.priority
             << "，预计 " << job.duration << " 秒）" << endl;
        totalTime += job.duration;
    }

    auto end = steady_clock::now();
    auto elapsed = duration_cast<milliseconds>(end - start);
    cout << "总任务数: 4，预计总耗时: " << totalTime << " 秒" << endl;
    return 0;
}
```

### 总结

本篇讲解了容器适配器（stack 后进先出、queue 先进先出、priority_queue 按优先级）、pair/tuple 多元组与结构化绑定、bitset 位操作与素数筛选、chrono 时间库的计时、random 现代随机数库，并用任务调度系统串联实战。重点掌握：priority_queue 的自定义比较（注意与 sort 相反）、结构化绑定的使用、chrono 计时模式、mt19937 + 分布的搭配。

STL 阶段（11-15 篇）完成！下一篇进入**模板与泛型编程：函数模板与类模板入门**，敬请期待！
