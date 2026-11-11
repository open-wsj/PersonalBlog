---
title: "C++模板教程：函数模板与类模板入门"
abbrlink: c-mu-ban-jiao-cheng-han-shu-mu-ban-yu-lei-mu-ban-ru-men
date: "2026-08-30 11:01:37"
categories:
    - "C与C++"
tags: []
desc: "普通函数精确匹配优先于模板。模板可以匹配任何类型3. 用<>可以强制调用模板版本。public:// 类外定义：需要重复 template 前缀// 类外定义：需要重复 template…"
---
> 本文是 C++ 系列教程的第 16 篇。STL 阶段（11-15 篇）已完成，本篇进入模板与泛型编程：函数模板语法与类型推导、隐式/显式实例化、模板与多文件、类模板成员函数、默认模板参数、非类型模板参数。

### 一、泛型编程思想

#### 1.1 为什么需要模板

写一个求最大值的函数，若不用模板需要为每种类型写一遍：

```cpp
int maxInt(int a, int b) { return a > b ? a : b; }
double maxDouble(double a, double b) { return a > b ? a : b; }
string maxString(string a, string b) { return a > b ? a : b; }
// 每种类型都要写一遍，代码重复
```

**模板**让「类型」成为参数，一份代码支持所有类型。

#### 1.2 泛型编程

泛型编程（Generic Programming）是**用类型参数编写与类型无关的代码**，STL 就是泛型编程的典范。

### 二、函数模板

#### 2.1 基本语法

```cpp
#include <iostream>
using namespace std;

// 函数模板：template <typename T>
template <typename T>
T myMax(T a, T b) {
    return a > b ? a : b;
}

int main() {
    // 隐式实例化：编译器推导 T
    cout << myMax(3, 7) << endl;        // T = int → 7
    cout << myMax(3.5, 2.8) << endl;    // T = double → 3.5
    cout << myMax('a', 'b') << endl;    // T = char → b

    // 显式指定类型
    cout << myMax<double>(3, 2.5) << endl;  // 3

    string s1 = "apple", s2 = "banana";
    cout << myMax(s1, s2) << endl;      // banana（字符串按字典序）
    return 0;
}
```

#### 2.2 类型推导规则

```cpp
#include <iostream>
using namespace std;

// 返回类型由参数推导
template <typename T>
T square(T x) {
    return x * x;
}

// 模板参数之间会统一（同一 T 必须一致）
template <typename T>
T add(T a, T b) {
    return a + b;
}

int main() {
    cout << square(5) << endl;        // 25
    cout << square(2.5) << endl;      // 6.25

    // 两个参数类型必须一致
    // add(3, 3.5);   // 错误！int 和 double 冲突
    cout << add<double>(3, 3.5) << endl;  // 6.5（显式指定）

    // 自动类型转换在显式指定时生效
    cout << add(3, 4) << endl;        // 7
    return 0;
}
```

#### 2.3 多个类型参数

```cpp
#include <iostream>
using namespace std;

// 多个类型参数
template <typename T, typename U>
T convert(U value) {
    return static_cast<T>(value);
}

// 返回类型�
� auto + decltype（C++11）
template <typename T, typename U>
auto addFlexible(T a, U b) -> decltype(a + b) {
    return a + b;
}

// C++14 简化：auto 自动推导
template <typename T, typename U>
auto multiply(T a, U b) {
    return a * b;
}

int main() {
    cout << convert<int>(3.9) << endl;       // 3
    cout << addFlexible(3, 4.5) << endl;     // 7.5
    cout << multiply(2.5, 4) << endl;        // 10
    return 0;
}
```

### 三、模板与函数重载

#### 3.1 模板与普通函数共存

```cpp
#include <iostream>
using namespace std;

// 普通函数（精确匹配优先）
int myMax(int a, int b) {
    cout << "普通函数" << endl;
    return a > b ? a : b;
}

// 模板函数
template <typename T>
T myMax(T a, T b) {
    cout << "模板函数" << endl;
    return a > b ? a : b;
}

int main() {
    cout << myMax(3, 7) << endl;          // 普通函数（int 精确匹配）
    cout << myMax(3.5, 2.8) << endl;      // 模板函数（无普通函数匹配）
    cout << myMax<>(3, 7) << endl;        // 模板函数（<> 强制用模板）
    return 0;
}
```

#### 3.2 重载规则总结

1.  普通函数精确匹配优先于模板。
2.  模板可以匹配任何类型3. 用 `<>` 可以强制调用模板版本。

### 四、模板与多文件

#### 4.1 模板的编译模型

模板是**编译期展开**的，编译器需要看到完整定义才能实例化。因此**模板通常放在头文件中**（与普通函数不同）：

```cpp
// max_template.h
#ifndef MAX_TEMPLATE_H
#define MAX_TEMPLATE_H

// 模板定义放在头文件（避免链接错误）
template <typename T>
T myMax(T a, T b) {
    return a > b ? a : b;
}

#endif
```

```cpp
// main.cpp
#include <iostream>
#include "max_template.h"
using namespace std;

int main() {
    cout << myMax(3, 7) << endl;       // 7
    cout << myMax(2.5, 1.8) << endl;   // 2.5
    return 0;
}
```

#### 4.2 为什么模板不能只声明在 .cpp

普通函数：声明在 .h，定义在 .cpp，链接器找到定义。
模板：实例化发生在**调用点**，编译器必须看到完整定义，否则报「未定义引用」。

### 五、类模板

#### 5.1 类模板基础

```cpp
#include <iostream>
using namespace std;

// 类模板：存储任意类型
template <typename T>
class Box {
private:
    T value;

public:
    Box(T v) : value(v) {}

    void set(T v) { value = v; }
    T get() const { return
 value; }

    void show() const {
        cout << "值: " << value << endl;
    }
};

int main() {
    Box<int> intBox(42);
    Box<string> strBox("Hello");
    Box<double> dblBox(3.14);

    intBox.show();     // 值: 42
    strBox.show();     // 值: Hello
    dblBox.show();     // 值: 3.14

    intBox.set(100);
    cout << intBox.get() << endl;   // 100
    return 0;
}
```

#### 5.2 类模板成员函数在类外定义

```cpp
#include <iostream>
using namespace std;

template <typename T>
class Calculator {
private:
    T a, b;

public:
    Calculator(T x, T y);
    T add() const;
    T subtract() const;
};

// 类外定义：需要重复 template 前缀
btract() const;
};

// 类外定义：需要重复 template 前缀
template <typename T>
Calculator<T>::Calculator(T x, T y) : a(x), b(y) {}

template <typename T>
T Calculator<T>::add() const {
    return a + b;
}

template <typename T>
T Calculator<T>::subtract() const {
    return a - b;
}

int main() {
    Calculator<int> ci(10, 3);
    cout << "int 加法: " << ci.add() << endl;       // 13

    Calculator<double> cd(5.5, 2.2);
    cout << "double 减法: " << cd.subtract() << endl;  // 3.3
    return 0;
}
```

#### 5.3 类模板实战：泛型 Stack

```cpp
#include <iostream>
using namespace std;

template <typename T, int MAX_SIZE = 100>
class Stack {
private:
    T data[MAX_SIZE];
    int top;

public:
    Stack() : top(-1) {}

    bool push(const T &value) {
        if (top >= MAX_SIZE - 1) return false;
        data[++top] = value;
        return true;
    }

    bool pop(T &value) {
        if (top < 0) return false;
        value = data[top--];
        return true;
    }

    bool isEmpty() const { return top < 0; }
    int size() const { return top + 1; }
};

int main() {
    // 非类型模板参数：指定大小
    Stack<string, 10> stringStack;
    stringStack.push("C++");
    stringStack.push("Python");
    stringStack.push("Java");

    while (!stringStack.isEmpty()) {
        string item;
        stringStack.pop(item);
        cout << item << " ";
    }
    cout << endl;   // Java Python C++
    return 0;
}
```

### 六、默认模板参数与非类型参数

#### 6.1 默认模板参数

```cpp
#include <iostream>
#include <vector>
using namespace std;

// 默认模板参数：T2 默认 int
template <typename T, typename T2 = int>
class Pair {
private:
    T first;
    T2 second;

public:
    Pair(T f, T2 s) : first(f), second(s) {}

    void show() const {
        cout << first << ", " << second << endl;
    }
};

int main() {
    Pair<string> p1("张三", 25);        // 第二参数默认 int
    Pair<string, double> p2("分数", 88.5);   // 显式指定

    p1.show();   // 张三, 25
    p2.show();   // 分数, 88.5
    return 0;
}
```

#### 6.2 非类型模板参数

```cpp
#include <iostream>
using namespace std;

// 非类型模板参数：秬速编译期常量（int、枨举、指针等）
template <int N>
int arraySum(int (&arr)[N]) {
    int sum = 0;
    for (int i = 0; i < N; i++) sum += arr[i];
    return sum;
}

template <int W, int H
>
class Rectangle {
public:
    static const int area = W * H;   // 编译期计算
};

int main() {
    int scores[] = {85, 90, 78};
    cout << "数组大小: " << arraySum(scores) << endl;  // 253（N 自动推导为 3）

    cout << "矩形面积: " << Rectangle<4, 5>::area << endl;  // 20
    return 0;
}
```

### 七、模板实战：泛型容器管理

综合本篇知识，实现泛型数据管理器：

```cpp
#include <iostream>
#include <string>
using namespace std;

template <typename T>
class DataManager {
private:
    T *items;
    int capacity;
    int count;

    void resize() {
        capacity *= 2;
        T *newItems = new T[capacity];
        for (int i = 0; i < count; i++) newItems[i] = items[i];
        delete[] items;
        items = newItems;
    }

public:
    DataManager(int cap = 4) : capacity(cap), count(0) {
        items = new T[capacity];
    }

    ~DataManager() { delete[] items; }

    void add(const T &item) {
        if (count >= capacity) resize();
        items[count++] = item;
    }

    T get(int index) const {
        return items[index];
    }

    int size() const { return count; }

    T max() const {
        T result = items[0];
        for (int i = 1; i < count; i++) {
            if (items[i] > result) result = items[i];
        }
        return result;
    }

    void showAll() const {
        for (int i = 0; i < count; i++) {
            cout << items[i] << " ";
        }
        cout << endl;
    }
};

int main() {
    // 整数管理器
    DataManager<int> intManager;
    intManager.add(85);
    intManager.add(92);
    intManager.add(78);
    intManager.add(95);
    intManager.add(88);    // 触发扩容
    cout << "整数列表: ";
    intManager.showAll();
    cout << "最大值: " << intManager.max() << endl;
    cout << "个数: " << intManager.size() << endl;

    // 字符串管理器
    DataManager<string> strManager;
    strManager.add("C++");
    strManager.add("Python");
    strManager.add("Java");
    cout << "字符串列表: ";
    strManager.showAll();
    cout << "最大值: " << strManager.max() << endl;
    return 0;
}
```

### 总结

本篇讲解了泛型编程思想、函数模板的语法与类型推导、模板与函数重载的规则、模板与多文件的编译模型、类模板的成员函数定义、默认模板参数、非类型模板参数，并用泛型数据管理器串联实战。重点掌握：模板必须放在头文件、隐式/显式实例化、类模板类外定义的语法、非类型参数的使用。

下一篇将讲解**特化、偏特化与类型萃取**，敬请期待！
