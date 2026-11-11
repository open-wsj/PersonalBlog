---
title: "C++进阶教程：类与对象深入"
abbrlink: c-jin-jie-jiao-cheng-lei-yu-dui-xiang-shen-ru
date: "2026-08-28 18:11:20"
categories:
    - "C与C++"
tags: []
desc: "本篇深入讲解了构造函数的种类与初始化列表、构造析构顺序、深拷贝与浅拷贝的区别及三法则、static 成员、const 成员函数、this 指针和友元，并用完整 String 类串联实战…"
---
> 本文是 C++ 系列教程的第 6 篇。上一篇初探了类的基本语法，本篇深入类与对象：构造函数与析构顺序、初始化列表、拷贝构造与拷贝赋值、深拷贝与浅拷贝、static 成员、const 成员函数、this 指针与友元。

### 一、构造函数深入

#### 1.1 构造函数的种类

```cpp
#include <iostream>
using namespace std;

class Person {
private:
    string name;
    int age;

public:
    // 1. 默认构造（无参）
    Person() : name("未命名"), age(0) {
        cout << "默认构造" << endl;
    }

    // 2. 带参构造
    Person(string n, int a) : name(n), age(a) {
        cout << "带参构造: " << name << endl;
    }

    // 3. 拷贝构造（重要！）
    Person(const Person &other) : name(other.name), age(other.age) {
        cout << "拷贝构造: 复制 " << other.name << endl;
    }

    void show() const {
        cout << name << " " << age << "岁" << endl;
    }
};

int main() {
    Person p1;                    // 默认构造
    Person p2("张三", 25);         // 带参构造
    Person p3 = p2;               // 拷贝构造
    Person p4(p2);                // 拷贝构造（等价写法）

    p1.show();
    p2.show();
    p3.show();
    return 0;
}
```

#### 1.2 初始化列表（推荐）

```cpp
#include <iostream>
using namespace std;

class Student {
private:
    const int id;        // const 成员必须在初始化列表初始化
    string name;

public:
    // 初始化列表语法：在 : 后按声明顺序初始化
    Student(int i, string n) : id(i), name(n) {
        // 函数体（可为空）
    }

    void show() const {
        cout << "学号 " << id << " " << name << endl;
    }
};

int main() {
    Student s(1001, "李四");
    s.show();   // 学号 1001 李四
    return 0;
}
```

**初始化列表 vs 赋值**：const 成员和引用成员只能在初始化列表初始化；初始化列表更高效（直接构造而非先默认构造再赋值）。

#### 1.3 构造与析枔的顺序

```cpp
#include <iostream>
using namespace std;

class A {
public:
    A() { cout << "A 构造" << endl; }
    ~A() { cout << "A 析构" << endl; }
};

class B : public A {   // 继承 A（第 8 篇详解）
public:
    B() { cout << "B 构造" << endl; }
    ~B() { cout << "B 析构" << endl; }
};

int main() {
    cout << "创建 B 对象:" << endl;
    B b;    // ��基类构造，再派生类构造
    cout << "销毁 B 对象:" << endl;
    // 先派生类析构，再基类析构
    return 0;
}
```

输出顺序：

```
创建 B 对象:
A 构造
B 构造
销毁 B 对象:
B 析构
A 析构
```

**规则**：构造顺序 = 基类 → 成员 → 自身；析构顺序完全相反。

### 二、深拷贝与浅拷贝

#### 2.1 浅拷贝的灾难（悬垂指针）

```cpp
#include <iostream>
#include <cstring>
using namespace std;

class StringBad {
private:
    char *str;      // 动态分配的内存
public:
    StringBad(const char *s) {
        str = new char[strlen(s) + 1];
        strcpy(str, s);
    }

    // 默认拷贝构造：逐字节复制（浅拷贝）！
    // 两个对象共享同一块内存

    ~StringBad() {
        delete[] str;   // 两个对象都 delete 同一内存 → 双重释放崩溃
    }

    void show() const { cout << str << endl; }
};

int main() {
    StringBad s1("Hello");
    StringBad s2 = s1;   // 浅拷贝：s1.str 和 s2.str 指向同一内存
    // 程序结束：s2 先析构 delete[]，s1 再析构 delete[] 同一地址 → 崩溃！
    cout << "程序将在此后崩溃（浅拷贝问题）" << endl;
    return 0;
}
```

#### 2.2 深拷贝（正确做法）

```cpp
#include <iostream>
#include <cstring>
using namespace std;

class String {
private:
    char *str;

public:
    // 构造
    String(const char *s = "") {
        str = new char[strlen(s) + 1];
        strcpy(str, s);
    }

    // 拷贝构造（深拷贝：分配新内存，复制内容）
    String(const String &other) {
        str = new char[strlen(other.str) + 1];
        strcpy(str, other.str);
        cout << "深拷贝构造" << endl;
    }

    // 拷贝赋值运算符（深拷贝）
    String &operator=(const String &other) {
        if (this == &other) return *this;   // 自赋值检查
        delete[] str;                        // 释放旧内存
        str = new char[strlen(other.str) + 1];
        strcpy(str, other.str);
        cout << "深拷贝赋值" << endl;
        return *this;
    }

    // 析构
    ~String() {
        delete[] str;
    }

    void show() const { cout << str << endl; }
};

int main() {
    String s1("Hello");
    String s2 = s1;    // 深拷贝构造：各自独立内存
    String s3("World");
    s2 = s3;           // 深拷贝赋值

    s1.show();  // Hello
    s2.show();  // World
    s3.show();  // World
    // 各自独立析构，无崩溃
    cout << "深拷贝程序正常结束" << endl;
    return 0;
}
```

#### 2.3 三法则（Rule of Three）

如果类需要自定义**析构函数**，则几乎总需要自定义：

1.  **拷贝构造函数**
2.  **拷贝赋值运算符**

因为默认实现都是浅拷贝，与自定义析构（释放资源）矛盾。

### 三、static 成员

#### 3.1 静态成员变量

```cpp
#include <iostream>
using namespace std;

class Counter {
private:
    static int count;   // 静态成员：所有对象共享

public:
    Counter() { count++; }
    ~Counter() { count--; }

    static int getCount() { return count; }   // 静态成员函数
};

// 静态成员必须在类外定义（分配存储）
int Counter::count = 0;

int main() {
    cout << "初始: " << Counter::getCount() << endl;  // 0
    Counter c1;
    Counter c2;
    {
        Counter c3;
        cout << "现在: " << Counter::getCount() << endl;  // 3
    }   // c3 析构
    cout << "之后: " << Counter::getCount() << endl;      // 2
    return 0;
}
```

#### 3.2 静态成员函数特性

```cpp
#include <iostream>
using namespace std;

class MathUtils {
public:
    // 静态成员函数：不依赖对象，无 this 指针
    static int max(int a, int b) { return a > b ? a : b; }
    static int square(int x) { return x * x; }
};

int main() {
    // 通过类名直接调用
    cout << MathUtils::max(3, 7) << endl;     // 7
    cout << MathUtils::square(5) << endl;     // 25
    return 0;
}
```

**注意**：静态成员函数不能访问非静态成员（没有 this 指针）。

### 四、const 成员函数

```cpp
#include <iostream>
#include <string>
using namespace std;

class Account {
private:
    string owner;
    double balance;

public:
    Account(string n, double b) : owner(n), balance(b) {}

    // const 成员函数：承诺不修改对象状态
    void show() const {
        cout << owner << " 余额 " << balance << endl;
        // balance = 0;   // 错误！const 成员函数不能修改
    }

    // 非 const 成员函数：可修改
    void deposit(double amount) {
        balance += amount;
    }

    // 可以同时有 const 和非 const 版本（重载）
    void info() const {
        cout << "[只读] " << owner << endl;
    }
    void info() {
        cout << "[可写] " << owner << endl;

}
};

void printAccount(const Account &acc) {
    // 参数是 const 引用，只能调用 const 成员函数
    acc.show();
    // acc.deposit(100);  // 错误！
}

int main() {
    Account a("小明", 100);
    printAccount(a);   // const 引用调用
    a.deposit(50);     // 非 const 对象可调用非 const 方法
    a.show();
    return 0;
}
```

### 五、this 指针

```cpp
#include <iostream>
#include <string>
using namespace std;

class Employee {
private:
    string name;

public:
    Employee(string name) {
        // this 指针：指向当前对象的指针
        this->name = name;    // 解决参数与成员同名
    }

    // 返回自身引用（链式调用）
    Employee &setName(string name) {
        this->name = name;
        return *this;         // 返回解引用的 this
    }

    void show() const {
        cout << this->name << endl;   // this-> 可省略
    }
};

int main() {
    Employee e("张三");
    e.show();

    // 链式调用
    e.setName("李四").setName("王五");
    e.show();   // 王五
    return 0;
}
```

### 六、友元

#### 6.1 友元函数

```cpp
#include <iostream>
using namespace std;

class Box {
private:
    double width;
    double height;

public:
    Box(double w, double h) : width(w), height(h) {}

    // 声明友元函数：可以访问私有成员
    friend double getArea(const Box &b);
    friend Box operator+(const Box &a, const Box &b);
};

// 友元函数实现（不是成员函数）
double getArea(const Box &b) {
    return b.width * b.height;   // 访问私有成员
}

Box operator+(const Box &a, const Box &b) {
    return Box(a.width + b.width, a.height + b.height);
}

int main() {
    Box b1(3, 4), b2(2, 5);
    cout << "b1 面积: " << getArea(b1) << endl;   // 12
    Box sum = b1 + b2;
    cout << "合并面积: " << getArea(sum) << endl;  // 45
    return 0;
}
```

#### 6.2 友元类

```cpp
#include <iostream>
using namespace std;

class Secret {
private:
    int code;

public:
    Secret(int c) : code(c) {}
    friend class Decoder;   // Decoder 可以访问 Secret 私有成员
};

class Decoder {
public:
    void reveal(const Secret &s) {
        cout << "解密密码: " << s.code << endl;   // 访问私有
    }
};

int main() {
    Secret s(9527);
    Decoder d;
    d.reveal(s);   // 解密密码: 9527
    return 0;
}
```

**使用原则**：友元破坏封装，应谨慎
使用（通常只在运算符重载等必要场景）。

### 七、实战：完整 String 类

综合本篇知识，实现完整的动态字符串类：

```cpp
#include <iostream>
#include <cstring>
using namespace std;

class MyString {
private:
    char *data;
    int length;
    static int count;   // 统计创建了多少个

public:
    // 构造
    MyString(const char *s = "") {
        length = strlen(s);
        data = new char[length + 1];
        strcpy(data, s);
        count++;
        cout << "构造: " << data << endl;
    }

    // 深拷贝构造
    MyString(const MyString &other) {
        length = other.length;
        data = new char[length + 1];
        strcpy(data, other.data);
        count++;
        cout << "拷贝: " << data << endl;
    }

    // 深拷贝赋值
    MyString &operator=(const MyString &other) {
        if (this == &other) return *this;
        delete[] data;
        length = other.length;
        data = new char[length + 1];
        strcpy(data, other.data);
        cout << "赋值: " << data << endl;
        return *this;
    }

    // 拼接运算符重载
    MyString operator+(const MyString &other) const {
        char *temp = new char[length + other.length + 1];
        strcpy(temp, data);
        strcat(temp, other.data);
        MyString result(temp);
        delete[] temp;
        return result;
    }

    // 比较运算符
    bool operator==(const MyString &other) const {
        return strcmp(data, other.data) == 0;
    }

    // 析构
    ~MyString() {
        cout << "析构: " << data << endl;
        delete[] data;
        count--;
    }

    void show() const { cout << data << endl; }
    static int getCount() { return count; }
};

int MyString::count = 0;

int main() {
    MyString s1("Hello");
    MyString s2(" C++");
    MyString s3 = s1;          // 拷贝构造
    MyString s4 = s1 + s2;     // 拼接
    s3 = s4;                   // 拷贝赋值

    s4.show();                 // Hello C++
    cout << (s1 == MyString("Hello")) << endl;   // 1
    cout << "存活对象数: " << MyString::getCount() << endl;
    return 0;
}
```

### 总结

本篇深入讲解了构造函数的种类与初始化列表、构造析构顺序、深拷贝与浅拷贝的区别及三法则、static 成员、const 成员函数、this 指针和友元，并用完整 String 类串联实战。重点掌握：深拷贝防止双重释放、初始化列表的用法、static 与 const 的语法、this 指针的作用。

下一篇将讲解**运算符重载与类型转换**，敬请期待！
