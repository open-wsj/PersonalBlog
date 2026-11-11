---
title: "C++综合实战：数据结构与算法实现及系列总结"
abbrlink: c-zong-he-shi-zhan-shu-ju-jie-gou-yu-suan-fa-shi-xian-ji-xi
date: "2026-09-03 15:36:40"
categories:
    - "C与C++"
tags: []
desc: "阶段篇目核心内容入门1-5语法基础、控制流、函数、数组/指针、类初探进阶6-10类与对象、运算符重载、继承多态、内存管理、文件流STL11-15容器、迭代器、算法库、函数对象/Lambda、适配器模板…"
---
> 本文是 C++ 系列教程的第 30 篇，也是系列终章。本篇实战数据结构与算法：手写动态数组与链表、排序与查找算法、递归与分治，最后回顾全部 30 篇学习路径，覆盖 9 个完整示例代码。

## 一、手写动态数组

### 1.1 为什么手写容器

理解容器内部机制是 C++ 进阶的必经之路。手写一个简化版 `vector，体会内存管理、扩容与拷贝语义：

```cpp
// my_vector.h —— 简化版动态数组
#pragma once
#include <iostream>
using namespace std;

template <typename T>
class MyVector {
private:
    T* data;            // 指向堆内存
    size_t sz;          // 当前元素个数
    size_t cap;         // 容量

    void grow() {       // 扩容：翻倍
        cap = cap == 0 ? 4 : cap * 2;
        T* newData = new T[cap];
        for (size_t i = 0; i < sz; ++i) newData[i] = data[i];
        delete[] data;
        data = newData;
    }

public:
    MyVector() : data(nullptr), sz(0), cap(0) {}
    ~MyVector() { delete[] data; }

    void push_back(const T& value) {
        if (sz == cap) grow();
        data[sz++] = value;
    }

    void pop_back() { if (sz > 0) sz--; }

    T& oper
ator[](size_t i) { return data[i]; }
    size_t size() const { return sz; }
    bool empty() const { return sz == 0; }
};

int main() {
    MyVector<int> v;
    for (int i = 1; i <= 10; ++i) v.push_back(i * i);

    cout << "size = " << v.size() << endl;
    for (size_t i = 0; i < v.size(); ++i)
        cout << v[i] << " ";        // 1 4 9 16 25 36 49 64 81 100
    cout << endl;
    return 0;
}
```

`grow()` 在容量不足时翻倍扩容，均摊时间复杂度为 O(1)。注意实现析构函数释放堆内存避免泄漏。

### 1.2 迭代器与范围 for 支持

给容器加上简单的迭代器支持：

```cpp
// 在 MyVector 中补充迭代器
public:
    T* begin() { return data; }
    T* end() { return data + sz; }
    const T* begin() const { return data; }
    const T* end() const { return data + sz; }
```

有了 `begin()`/`end()`，容器就能配合**范围 for 循环**：

```cpp
MyVector<int> nums;
for (int i = 0; i < 5; ++i) nums.push_back(i * 3);

for (int x : nums) {          // 范围 for：自动使用 begin/end
    cout << x << " ";         // 0 3 6 9 12
}
cout << endl;
```

## 二、链表实现

### 2.1 单链表

```cpp
// linked_list.cpp —— 单链表
#incl
ude <iostream>
using namespace std;

struct Node {
    int data;
    Node* next;
    Node(int d) : data(d), next(nullptr) {}
};

class LinkedList {
private:
    Node* head;
public:
    LinkedList() : head(nullptr) {}
    ~LinkedList() {
        Node* cur = head;
        while (cur) {
            Node* tmp = cur;
            cur = cur->next;
            delete tmp;          // 逐个释放，避免泄漏
        }
    }

    // 头插法
    void insertHead(int value) {
        Node* n = new Node(value);
        n->next = head;
        head = n;
    }

    // 尾插法
    void insertTail(int value) {
        Node* n = new Node(value);
        if (!head) { head = n; return; }
        Node* cur = head;
        while (cur->next) cur = cur->next;
        cur->next = n;
    }

    bool remove(int value) {
        if (!head) return false;
        if (head->data == value) {
            Node* tmp = head;
            head = head->next;
            delete tmp;
            return true;
        }
        Node* cur = head;
        while (cur->next && cur->next->data != value)
            cur = cur->next;
        if (!cur->next) return false;
        Node* tmp = cur->next;
        cur->next = tm
p = head;
            head = head->next;
            delete tmp;
            return true;
        }
        Node* cur = head;
        while (cur->next && cur->next->data != value)
            cur = cur->next;
        if (!cur->next) return false;
        Node* tmp = cur->next;
        cur->next = tmp->next;
        delete tmp;
        return true;
    }

    void show() const {
        Node* cur = head;
        while (cur) {
            cout << cur->data << " -> ";
            cur = cur->next;
        }
        cout << "nullptr" << endl;
    }
};

int main() {
    LinkedList list;
    list.insertHead(3);
    list.insertHead(2);
    list.insertHead(1);        // 1 -> 2 -> 3
    list.insertTail(4);        // 1 -> 2 -> 3 -> 4

    list.show();
    list.remove(2);            // 1 -> 3 -> 4
    list.show();
    return 0;
}
```

链表插入删除只需修改指针（O(1)），但随机访问需遍历（O(n)）；与数组恰好互补。

### 2.2 链表 vs 动态数组

| 特性 | 动态数组 | 链表 |
| --- | --- | --- |
| 随机访问 | O(1) | O(n) |
| 头部插入 | O(n)（需移动） | O(1) |
| 尾部插入 | O(1)（均摊） | O(1) |
| 内存 | 连续，缓存友好 | 分散，缓 |
| 存不友好 |  |  |
| 额外开销 | 少量（扩容时翻倍） | 每节点一个指针 |

## 三、排序算法

### 3.1 快速排序

```cpp
// quick_sort.cpp —— 快速排序
#include <iostream>
#include <vector>
using namespace std;

int partition(vector<int>& arr, int low, int high) {
    int pivot = arr[high];            // 取最后一个元素为基准
    int i = low - 1;
    for (int j = low; j < high; ++j) {
        if (arr[j] < pivot) {
            i++;
            swap(arr[i], arr[j]);
        }
    }
    swap(arr[i + 1], arr[high]);
    return i + 1;
}

void quickSort(vector<int>& arr, int low, int high) {
    if (low < high) {
        int pi = partition(arr, low, high);
        quickSort(arr, low, pi - 1);   // 递归左半
        quickSort(arr, pi + 1, high);  // 递归右半
    }
}

int main() {
    vector<int> arr = {10, 7, 8, 9, 1, 5};
    quickSort(arr, 0, (int)arr.size() - 1);

    for (int x : arr) cout << x << " ";
    cout << endl;                     // 1 5 7 8 9 10
    return 0;
}
```

快速排序平均 O(n log n)，通过**分治**思想每次把基准放到最终位置，两边递归。

### 3.2 归并排序

```cpp
// merge_sort.cpp —— 归并排序
#
include <iostream>
#include <vector>
using namespace std;

void merge(vector<int>& arr, int left, int mid, int right) {
    vector<int> tmp(right - left + 1);
    int i = left, j = mid + 1, k = 0;

    while (i <= mid && j <= right)
        tmp[k++] = (arr[i] <= arr[j]) ? arr[i++] : arr[j++];
    while (i <= mid) tmp[k++] = arr[i++];
    while (j <= right) tmp[k++] = arr[j++];

    for (int t = 0; t < (int)tmp.size(); ++t)
        arr[left + t] = tmp[t];
}

void mergeSort(vector<int>& arr, int left, int right) {
    if (left >= right) return;
    int mid = (left + right) / 2;
    mergeSort(arr, left, mid);         // 分
    mergeSort(arr, mid + 1, right);
    merge(arr, left, mid, right);      // 治：合并两个有序段
}

int main() {
    vector<int> arr = {38, 27, 43, 3, 9, 82, 10};
    mergeSort(arr, 0, (int)arr.size() - 1);
    for (int x : arr) cout << x << " ";
    cout << endl;                      // 3 9 10 27 38 43 82
    return 0;
}
```

归并排序稳定、O(n log n)，需要额外 O(n) 空间。快速排序空间 O(log n) 但**不稳定**。

## 四、查找算法

### 4.1 二分查找

```cpp
// binary_search.cpp —— 二分查找（要求数组有序）
#include
 <iostream>
#include <vector>
using namespace std;

int binarySearch(const vector<int>& arr, int target) {
    int left = 0, right = (int)arr.size() - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;   // 防止溢出
        if (arr[mid] == target) return mid;
        if (arr[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    return -1;    // 未找到
}

int main() {
    vector<int> arr = {1, 3, 5, 7, 9, 11, 13};
    cout << binarySearch(arr, 7) << endl;   // 3（下标）
    cout << binarySearch(arr, 8) << endl;   // -1（不存在）
    return 0;
}
```

二分查找每次排除一半区间，O(log n)。`mid = left + (right - left) / 2` 避免 `(left+right)` 溢出。

## 五、实战：学生成绩管理系统（综合）

综合运用容器、排序、查找、lambda 与统计的完整案例：

```cpp
// student_manager.cpp —— 学生成绩管理
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <numeric>
using namespace std;

struct Student {
    string name;
    int score;
};

void showAll(const vector<Student>& students) {
    for (const auto& s : students)
        cout << s.name << " "
<< s.score << endl;
}

int main() {
    vector<Student> students = {
        {"张三", 85}, {"李四", 92}, {"王五", 78}, {"赵六", 95}
    };

    // 1. 按分数降序排序（lambda 比较）
    sort(students.begin(), students.end(),
         [](const Student& a, const Student& b) {
             return a.score > b.score;
         });
    cout << "按分数降序:" << endl;
    showAll(students);

    // 2. 计算平均分（accumulate 求和）
    double avg = accumulate(students.begin(), students.end(), 0.0,
                            [](double sum, const Student& s) {
                                return sum + s.score;
                            }) / students.size();
    cout << "平均分: " << avg << endl;

    // 3. 查找最高分
    auto best = max_element(students.begin(), students.end(),
                            [](const Student& a, const Student& b) {
                                return a.score < b.score;
                            });
    cout << "最高分: " << best->name << " " << best->score << endl;

    // 4. 统计及格人数（count_if）
    int passed = count_if(students.begin(), students.end(),
                          [](const Student&
s) { return s.score >= 60; });
    cout << "及格人数: " << passed << endl;
    return 0;
}
```

## 六、30 篇系列总结

### 6.1 学习路径回顾

本系列从零到实战覆盖 C++ 全链路：

| 阶段 | 篇目 | 核心内容 |
| --- | --- | --- |
| 入门 | 1-5 | 语法基础、控制流、函数、数组/指针、类初探 |
| 进阶 | 6-10 | 类与对象、运算符重载、继承多态、内存管理、文件流 |
| STL | 11-15 | 容器、迭代器、算法库、函数对象/Lambda、适配器 |
| 模板 | 16-19 | 函数/类模板、特化与萃取、变参模板、完美转发 |
| 现代C++ | 20-22 | C++11/14/17/20 新特性（智能指针、concepts、ranges） |
| 并发 | 23-25 | 线程、互斥锁、条件变量、原子操作、线程池 |
| 工程化 | 26-27 | CMake 构建、编译链接、GDB 调试、性能优化 |
| 实战 | 28-30 | 图书管理系统、HTTP 客户端、数据结构与算法 |

### 6.2 学习建议

1.  **动手写代码**：每篇示例都亲手编译运行，改参数观察行为变化。
2.  **逐步进阶**：按阶段顺序学习，模板与并发依赖前面基础。
3.  **结合工程**：用 CMake 组织项目，用 GDB/ASan 排查问题。
4.  **阅读源码**：理解 `vector`/`string` 等标准库内部实现。
5.  **持续练习**：LeetCode 算法题、开源项目阅读，把知识用起来。

## 总结

作为系列终章，本篇实战了 **动态数组**（手写 vector 与扩容）、**链表**（插入/删除与内存管理）、**快速排序与归并排序**（分治思想）、**二分查找**，并用学生成绩管理系统综合运用 STL 算法，最后回顾了 30 篇完整学习路径。从 `Hello World` 到网络编程、从模板元编程到并发线程池，你已经系统掌握了 C++ 的核心知识体系。持续编码、持续学习，C++ 的世界还很大，加油！
