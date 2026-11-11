---
title: "C++STL教程：容器总览与序列容器"
abbrlink: c-stl-jiao-cheng-rong-qi-zong-lan-yu-xu-lie-rong-qi
date: "2026-08-29 00:34:05"
categories:
    - "C与C++"
tags: []
desc: "STL（Standard Template Library，标准模板库）是 C++ 标准库的核心，由容器、迭代器、算法、函数对象、适配器五大部分组成。它把「数据存储」与「数据处理」解耦，实现高效复用…"
---
> 本文是 C++ 系列教程的第 11 篇。进阶阶段（6-10 篇）已完成，本篇进入 STL 阶段：先总览六大容器家族，再深入序列容器 vector（扩容机制）、deque、list、forward_list、array 的用法与选择。

### 一、STL 总览

#### 1.1 什么是 STL

STL（Standard Template Library，标准模板库）是 C++ 标准库的核心，由**容器、迭代器、算法、函数对象、适配器**五大部分组成。它把「数据存储」与「数据处理」解耦，实现高效复用。

#### 1.2 六大容器家族

| 类别 | 容器 | 特点 |
| --- | --- | --- |
| 序列容器 | vector, deque, list, forward_list, array | 线性存储，按位置访问 |
| 关联容器 | set, multiset, map, multimap | 红黑树，自动排序 |
| 无序容器 | unordered_set, unordered_map 等 | 哈希表，O(1) 查找 |
| 容器适配器 | stack, queue, priority_queue | 限制接口的包装 |
| 字符串 | string | 字符序列 |
| 其他 | bitset, valarray | 专用 |

#### 1.3 如何选择容器

| 需求 | 推荐容器 |
| --- | --- |
| 随机访问 + 尾部增删 | vector |
| 头尾都频繁增删 | deque |
| 任意位置频繁插入删除 | list |
| 需要有序且唯一 | set / map |
| 需要快速查找 | unordered_map / unordered_set |
| 先进后出 | stack |
| 先进先出 | queue |
| 取最大/最小元素 | priority_queue |

### 二、vector 详解

#### 2.1 vector 基本操作

```cpp
#include <iostream>
#include <vector>
using namespace std;

int main() {
    // 创建
    vector<int> v1;                    // 空
    vector<int> v2(5);                 // 5 个 0
    vector<int> v3(5, 10);             // 5 个 10
    vector<int> v4 = {1, 2, 3, 4};     // 列表初始化

    // 增删
    v1.push_back(10);                  // 尾部添加
    v1.push_back(20);
    v1.push_back(30);
    v1.pop_back();                     // 删除尾部（30）

    // 访问
    cout << "v1[0] = " << v1[0] << endl;         // 10
    cout << "v1.at(1) = " << v1.at(1) << endl;   // 20（带边界检查）
    cout << "front = " << v1.front() << endl;    // 10
    cout << "back = " << v1.back() << endl;      // 20

    // 大小
    cout << "size = " << v1.size() << endl;      // 2
    cout << "empty = " << v1.empty() << endl;    // 0
    cout << "capacity = " << v1.capacity() << endl;  // 2（可能）

    // 遍历
    for (int x : v1) cout <<
 x << " ";
    cout << endl;
    return 0;
}
```

#### 2.2 vector 扩容机制

vector 容量不足时按**倍增策略**扩容（通常 ×2），元素迁移到新内存：

```cpp
#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> v;
    int prevCap = 0;
    for (int i = 0; i < 16; i++) {
        v.push_back(i);
        if (v.capacity() != prevCap) {
            cout << "push_back(" << i << ") 后容量: " << v.capacity() << endl;
            prevCap = v.capacity();
        }
    }
    return 0;
}
```

典型输出（容量变化 1→2→4→8→16）：

```
push_back(0) 后容量: 1
push_back(1) 后容量: 2
push_back(2) 后容量: 4
push_back(4) 后容量: 8
push_back(8) 后容量: 16
```

**意义**：倍增策略让 push_back 的均摊复杂度为 O(1)，但扩容时旧迭代器全部失效。

#### 2.3 插入与删除

```cpp
#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> v = {1, 2, 3, 4, 5};

    // insert：在指定位置前插入
    v.insert(v.begin() + 2, 99);          // 1 2 99 3 4 5
    v.insert(v.end(), 100);               // 尾部插入 = push_back

    // erase：删除指定位置
    v.erase(v.begin());                   // 删除第一个
    v.erase(v.begin() + 1, v.begin() + 3); // 删除区间

    for (int x : v) cout << x << " ";
    cout << endl;

    // clear：清空
    v.clear();
    cout << "clear 后 size = " << v.size() << endl;
    return 0;
}
```

#### 2.4 迭代器失效问题

```cpp
#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> v = {1, 2, 3, 4, 5};

    // 错误示范：erase 后迭代器失效
    // for (auto it = v.begin(); it != v.end(); it++) {
    //     if (*it % 2 == 0) v.erase(it);   // 危险！it 失效
    // }

    // 正确示范：erase 返回下一个有效迭代器
    for (auto it = v.begin(); it != v.end();) {
        if (*it % 2 == 0) {
            it = v.erase(it);    // 删除并获取下一个
        } else {
            it++;
        }
    }
    for (int x : v) cout << x << " ";
    cout << endl;   // 1 3 5
    return 0;
}
```

#### 2.5 实用操作

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> v = {3, 1, 4, 1, 5, 9, 2, 6};

    // 排序
    sort(v.begin(), v.end());            // 1 1 2 3 4 5 6 9

    //
 反转
    reverse(v.begin(), v.end());         // 9 6 5 4 3 2 1 1

    // 查找
    auto it = find(v.begin(), v.end(), 4);
    if (it != v.end()) {
        cout << "找到 4 在位置 " << (it - v.begin()) << endl;
    }

    // 统计
    cout << "1 出现次数: " << count(v.begin(), v.end(), 1) << endl;

    // 最大值最小值
    cout << "最大值: " << *max_element(v.begin(), v.end()) << endl;
    cout << "最小值: " << *min_element(v.begin(), v.end()) << endl;

    // 删除重复（先排序再 unique）
    sort(v.begin(), v.end());
    v.erase(unique(v.begin(), v.end()), v.end());
    for (int x : v) cout << x << " ";
    cout << endl;   // 1 2 3 4 5 6 9
    return 0;
}
```

### 三、deque 双端队列

#### 3.1 deque 特点

deque（double-ended queue）支持**头尾双端**高效增删，随机访问 O(1)：

```cpp
#include <iostream>
#include <deque>
using namespace std;

int main() {
    deque<int> d = {2, 3, 4};

    d.push_back(5);        // 尾部添加：2 3 4 5
    d.push_front(1);       // 头部添加：1 2 3 4 5
    d.pop_back();          // 删除尾部：1 2 3 4
    d.pop_front();         // 删除头部：2 3 4

    // 随机访问（O(1)）
    cout << "d[1] = " << d[1] << endl;  // 3

    for (int x : d) cout << x << " ";
    cout << endl;   // 2 3 4
    return 0;
}
```

#### 3.2 vector vs deque 对比

| 维度 | vector | deque |
| --- | --- | --- |
| 头部插入 | 慢（O(n)） | 快（O(1)） |
| 尾部插入 | 快（O(1)均摊） | 快（O(1)） |
| 随机访问 | O(1) | O(1) |
| 内存 | 连续 | 分段连续 |
| 扩容 | 迁移全部元素 | 不彲响已有元素 |
| 适用 | 尾部操作为主 | 头尾都要操作 |

### 四、list 双向链表

#### 4.1 list 基本操作

list 是双向链表，**任意位置插入删除 O(1)**，但不支持随机访问：

```cpp
#include <iostream>
#include <list>
using namespace std;

int main() {
    list<int> lst = {3, 1, 4};

    // 头尾插入
    lst.push_back(5);
    lst.push_front(0);      // 0 3 1 4 5

    // 任意位置插入（O(1)）
    auto it = lst.begin();
    advance(it, 2);         // 移到第 3 个元素
    lst.insert(it, 99);     // 0 3 99 1 4 5

    // 删除
    lst.remove(99);         // 按值删除

    // 排序与反转（list 有自己的成员函数）
    lst.sort();
    lst.reverse();

    for (int x : lst) cout << x << " ";
    cout << endl;   /
/ 5 4 3 1 0
    return 0;
}
```

#### 4.2 list 特有的高效操作

```cpp
#include <iostream>
#include <list>
using namespace std;

int main() {
    list<int> l1 = {1, 2, 3, 4, 5};
    list<int> l2 = {10, 20, 30};

    // splice：把 l2 的元素移到 l1（O(1)，不拷贝）
    l1.splice(l1.end(), l2);
    // l1: 1 2 3 4 5 10 20 30, l2: 空

    // merge：合并两个已排序链表
    list<int> a = {1, 3, 5};
    list<int> b = {2, 4, 6};
    a.merge(b);             // a: 1 2 3 4 5 6

    // unique：去除相邻重复
    list<int> c = {1, 1, 2, 2, 2, 3};
    c.unique();             // c: 1 2 3

    for (int x : a) cout << x << " ";
    cout << endl;
    return 0;
}
```

### 五、forward_list 与 array

#### 5.1 forward_list 单向链表

```cpp
#include <iostream>
#include <forward_list>
using namespace std;

int main() {
    // 单向链表：只能向前遍历，内存更省
    forward_list<int> fl = {1, 2, 3};

    fl.push_front(0);           // 0 1 2 3（只能头插）
    fl.pop_front();             // 1 2 3

    // 在某个元素后插入（insert_after）
    auto it = fl.begin();
    fl.insert_after(it, 99);    // 1 99 2 3

    for (int x : fl) cout << x << " ";
    cout << endl;
    return 0;
}
```

#### 5.2 array 固定数组

```cpp
#include <iostream>
#include <array>
using namespace std;

int main() {
    // 固定大小，栈上分配，无动态开销
    array<int, 5> arr = {1, 2, 3, 4, 5};

    // 与 C 数组兼容
    cout << "size = " << arr.size() << endl;

    // 安全访问
    cout << "arr.at(0) = " << arr.at(0) << endl;

    // 迭代器支持
    for (auto it = arr.begin(); it != arr.end(); it++) {
        cout << *it << " ";
    }
    cout << endl;

    // 传给 C 风格函数
    int *cArr = arr.data();
    cout << "cArr[2] = " << cArr[2] << endl;  // 3
    return 0;
}
```

### 六、序列容器对比总结

| 容器 | 随机访问 | 头插入 | 尾插入 | 中间插入 | 内存 | 适用 |
| --- | --- | --- | --- | --- | --- | --- |
| vector | O(1) | O(n) | O(1)* | O(n) | 连续 | 默认首选 |
| deque | O(1) | O(1) | O(1) | O(n) | 分段 | 双端队列 |
| list | O(n) | O(1) | O(1) | O(1) | 分散 | 频繁中间操作 |
| forward_list | O(n) | O(1) | - | O(1) | 最省 | 极端内存敏感 |
| array | O(1) | - | - | - | 栈 | 固定大小 |

*均摊复杂度。

### 七、实战：成绩统计系统

综合本篇知�
�，用 vector 实现成绩统计：

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
#include <numeric>
using namespace std;

class ScoreManager {
private:
    vector<int> scores;

public:
    void add(int score) {
        scores.push_back(score);
    }

    double average() const {
        if (scores.empty()) return 0;
        return accumulate(scores.begin(), scores.end(), 0.0) / scores.size();
    }

    int max() const {
        return *max_element(scores.begin(), scores.end());
    }

    int min() const {
        return *min_element(scores.begin(), scores.end());
    }

    void sortAndShow() const {
        vector<int> temp = scores;   // 拷贝排序，不改变原数据
        sort(temp.begin(), temp.end());
        for (int s : temp) cout << s << " ";
        cout << endl;
    }

    // 统计及格人数
    int countPass(int threshold = 60) const {
        return count_if(scores.begin(), scores.end(),
            [threshold](int s) { return s >= threshold; });
    }
};

int main() {
    ScoreManager sm;
    sm.add(85);
    sm.add(92);
    sm.add(58);
    sm.add(76);
    sm.add(88);

    cout << "平均分: " << sm.average() << endl;       // 79.8
    cout << "最高分: " << sm.max() << endl;           // 92
    cout << "最低分: " << sm.min() << endl;           // 58
    cout << "及格人数: " << sm.countPass() << endl;   // 4
    cout << "排序后: ";
    sm.sortAndShow();   // 58 76 85 88 92
    return 0;
}
```

### 总结

本篇总览了 STL 六大容器家族与选择原则，深入讲解了 vector（扩容机制、迭代器失效）、deque、list、forward_list、array 的特性与适用场景，并用成绩统计系统串联实战。重点掌握：vector 的扩容与迭代器失效、list 的 splice/merge 高效操作、各容器的选择依据。

下一篇将讲解**关联容器与无序容器**（set/map、unordered_*），敬请期待！
