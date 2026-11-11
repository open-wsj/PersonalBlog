---
title: "C++进阶教程：运算符重载与类型转换"
abbrlink: c-jin-jie-jiao-cheng-yun-suan-fu-zhong-zai-yu-lei-xing
date: "2026-08-28 18:12:04"
categories:
    - "C与C++"
tags: []
desc: "运算符重载是让==<<等运算符可以作用于自定义类型，使代码更自然、更直观。例如c1 + c2让复数相加，直接打印对象…"
---
> 本文是 C++ 系列教程的第 7 篇。上一篇深入了类与对象（深拷贝、static、this、友元），本篇讲解运算符重载与类型转换：可重载运算符清单、常用重载（==、<、<<、[]、()、++、–）、explicit 关键字、类型转换运算符。

### 一、运算符重载基础

#### 1.1 什么是运算符重载

运算符重载是让 `+`、`==`、`<<` 等运算符可以作用于**自定义类型**，使代码更自然、更直观。例如 `c1 + c2` 让复数相加，`cout << obj` 直接打印对象。

#### 1.2 可重载与不可重载运算符

| 可重载 | 不可重载 |
| --- | --- |
| `+ - * / %` `== != < >` `<< >>` `[] () ++ --` `= += -=` `&& |  |

**规则**：不能发明新运算符；至少一个操作数是自定义类型；不能改变优先级与结合性。

#### 1.3 两种形式：成员函数 vs 友元函数

```cpp
#include <iostream>
using namespace std;

class Point {
private:
    int x, y;

public:
    Point(int a, int b) : x(a), y(b) {}

    // 成员函数形式：左操作数是 this，只接受一个参数
    Point operator+(const Point &other) const {
        return Point(x + other.x, y + other.y);
    }

    // 友元函数形式：需要两个参数，能处理对称操作
    friend bool operator==(const Point &a, const Point &b);
    friend ostream &operator<<(ostream &os, const Point &p);
};

bool operator==(const Point &a, const Point &b) {
    return a.x == b.x && a.y == b.y;
}

ostream &operator<<(ostream &os, const Point &p) {
    os << "(" << p.x << ", " << p.y << ")";
    return os;
}

int main() {
    Point p1(1, 2), p2(3, 4);
    Point p3 = p1 + p2;          // 成员函数重载
    cout << "p3 = " << p3 << endl;  // (4, 6)

    cout << (p1 == Point(1, 2)) << endl;  // 1
    cout << (p1 == p2) << endl;           // 0
    return 0;
}
```

### 二、常用运算符重载

#### 2.1 关系运算符 == 和 <

```cpp
#include <iostream>
using namespace std;

class Student {
private:
    string name;
    int score;

public:
    Student(string n, int s) : name(n), score(s) {}

    // == 判断分数相同
    bool operator==(const Student &other) const {
        return score == other.score;
    }

    // < 按分数比较（用于排序）
    bool operator<(const Student &other) const {
        return score < other.score;

  }

    // > 可以用 < 实现
    bool operator>(const Student &other) const {
        return other < *this;
    }

    int getScore() const { return score; }
};

int main() {
    Student s1("张三", 88), s2("李四", 88), s3("王五", 92);
    cout << "s1 == s2: " << (s1 == s2) << endl;   // 1
    cout << "s1 < s3: " << (s1 < s3) << endl;     // 1
    cout << "s3 > s1: " << (s3 > s1) << endl;     // 1
    return 0;
}
```

#### 2.2 输出运算符 <<

```cpp
#include <iostream>
using namespace std;

class Complex {
private:
    double real;
    double imag;

public:
    Complex(double r = 0, double i = 0) : real(r), imag(i) {}

    // 重载 << 打印复数
    friend ostream &operator<<(ostream &os, const Complex &c) {
        os << c.real;
        if (c.imag >= 0) os << "+" << c.imag << "i";
        else os << c.imag << "i";
        return os;
    }
};

int main() {
    Complex c1(3, 4);
    Complex c2(2, -5);
    cout << "c1 = " << c1 << endl;   // 3+4i
    cout << "c2 = " << c2 << endl;   // 2-5i
    return 0;
}
```

#### 2.3 下标运算符 []

```cpp
#include <iostream>
#include <stdexcept>
using namespace std;

class IntArray {
private:
    int data[10];
    int size;

public:
    IntArray() : size(0) {}

    void add(int v) {
        if (size < 10) data[size++] = v;
    }

    // 下标运算符：返回引用以便修改
    int &operator[](int index) {
        if (index < 0 || index >= size) {
            throw out_of_range("下标越界");
        }
        return data[index];
    }

    // const 版本（只读对象可用）
    const int &operator[](int index) const {
        if (index < 0 || index >= size) {
            throw out_of_range("下标越界");
        }
        return data[index];
    }

    int getSize() const { return size; }
};

int main() {
    IntArray arr;
    arr.add(10);
    arr.add(20);
    arr.add(30);

    cout << arr[0] << " " << arr[1] << " " << arr[2] << endl;  // 10 20 30
    arr[1] = 99;    // 通过引用修改
    cout << arr[1] << endl;  // 99
    return 0;
}
```

#### 2.4 自增自减 ++ 和 –

```cpp
#include <iostream>
using namespace std;

class Counter {
private:
    int value;

public:
    Counter(int v = 0) : value(v) {}

    // 前置 ++：返回引用（支持链式）
    Counter &operator++() {
        ++value;
        return *this;
    }

    // 后置 ++：参数 int 占位区分，返回旧值副�
��
    Counter operator++(int) {
        Counter temp = *this;
        ++value;
        return temp;
    }

    int get() const { return value; }
};

int main() {
    Counter c(5);
    cout << "c = " << c.get() << endl;      // 5
    cout << "++c = " << (++c).get() << endl; // 6（前置：先增后取）
    cout << "c++ = " << (c++).get() << endl; // 6（后置：先取后增）
    cout << "c = " << c.get() << endl;      // 7
    return 0;
}
```

#### 2.5 函数调用运算符 ()

```cpp
#include <iostream>
using namespace std;

// 仿函数：像函数一样调用对象
class AddBy {
private:
    int base;

public:
    AddBy(int b) : base(b) {}

    // operator() 让对象可像函数调用
    int operator()(int value) const {
        return value + base;
    }
};

int main() {
    AddBy add10(10);
    AddBy add100(100);

    cout << add10(5) << endl;    // 15（对象当函数用）
    cout << add100(5) << endl;   // 105
    return 0;
}
```

### 三、赋值运算符与自赋值

#### 3.1 完整的赋值运算符

```cpp
#include <iostream>
#include <cstring>
using namespace std;

class Buffer {
private:
    char *data;
    int length;

public:
    Buffer(const char *s = "") {
        length = strlen(s);
        data = new char[length + 1];
        strcpy(data, s);
    }

    Buffer(const Buffer &other) {
        length = other.length;
        data = new char[length + 1];
        strcpy(data, other.data);
    }

    // 赋值运算符必须处理：自赋值、资源释放、深拷贝
    Buffer &operator=(const Buffer &other) {
        if (this == &other) return *this;   // 自赋值检查（关键！）
        delete[] data;                       // 释放旧资源
        length = other.length;
        data = new char[length + 1];
        strcpy(data, other.data);
        return *this;                        // 返回引用支持链式
    }

    ~Buffer() { delete[] data; }

    const char *get() const { return data; }
};

int main() {
    Buffer b1("Hello");
    Buffer b2("World");
    b1 = b2;          // 赋值
    b1 = b1;          // 自赋值（安全）
    cout << b1.get() << endl;  // World
    return 0;
}
```

#### 3.2 =default 与 =delete（C++11）

```cpp
#include <iostream>
using namespace std;

class NoCopy {
public:
    NoCopy() = default;   // 使用编译器生成的默认构造

    // 禁用拷贝（=delete）
    NoCopy(const NoC
opy &) = delete;
    NoCopy &operator=(const NoCopy &) = delete;
};

class Dummy {
public:
    int value;
    Dummy() = default;              // 显式要求默认构造
    Dummy(int v) : value(v) {}
};

int main() {
    NoCopy n1;
    // NoCopy n2 = n1;  // 错误！拷贝已被删除

    Dummy d;
    d.value = 42;
    cout << d.value << endl;  // 42
    return 0;
}
```

### 四、类型转换

#### 4.1 explicit 关键字（防止隐式转换）

```cpp
#include <iostream>
using namespace std;

class Money {
private:
    double amount;

public:
    // 非 explicit：int 可隐式转 Money
 // Money(double a) : amount(a) {}

    // explicit：禁止隐式转换，必须显式构造

    explicit Money(double a) : amount(a) {}

    double get() const { return amount; }
};

void pay(const Money &m) {
    cout << "支付 " << m.get() << " 元" << endl;
}

int main() {
    Money m1(100.0);        // 显式构造
    // Money m2 = 200.0;     // 错误！explicit 禁止隐式转换
    // pay(300.0);           // 错误！不能隐式转 Money
    pay(Money(300.0));       // 显式转换后调用
    return 0;
}
```

#### 4.2 类型转换运算符

```cpp
#include <iostream>
using namespX�H�‚��\����X�[ۈœ�]�]N��[��[Nˆ[�[�‚�X�X΂���X�[ۊ[��[�
H��[J�K[�
H�B����9�n�g��/k9�h�/�9���)��&���X�[ۈO��X�B��\�]܈�X�J
H�ۜ�ˆ�]\���]X���\��X�O��[JH�[�ˆB������X�[ۈO����;�"9b)9��y�+�d)�..��'�b!��l;�"B�^X�]�\�]܈���

H�ۜ�ˆ�]\���[HOHˆB����Y���
H�ۜ�ˆ��]�[H�Ȉ[��H��]X���\��X�O�
�\�H[�ˆB�N‚�[�XZ[�
Hˆ��X�[ۈ��
Nˆ�X�HH����:f�9o#�/k�X�B���]��X�H9`/��[������B�������
N�����H��B����Y�9�hy.��a�9a`z+����:/k9�h��"^X�]���9g*9�i9g.��k�d"9��{�"B�Y�
�Hˆ��]�b!�kd:gg�f툈[�ˆB��]\��ŸB�����9.�8� y��9d"9k��/���&�i#y�l9�n‚���9d"9�+9���aj:`�9��z+��#9k���9k�9�m9�9i#y�l9�n��&������[��YH[���X[O��\�[���[Y\�X�H�‚��\����\^œ�]�]N���X�H�X[ˆ�X�H[XY�‚�X�X΂���\^
�X�H�H�X�HHH
H��X[
�K[XY�JH�B����9���+�/�9���"9�$9df9a�y�l;�"B���\^�\�]܊��ۜ���\^	��H�ۜ�ˆ�
turn Complex(real + c.real, imag + c.imag);
    }
    Complex operator-(const Complex &c) const {
        return Complex(real - c.real, imag - c.imag);
    }
    Complex operator*(const Complex &c) const {
        // (a+bi)(c+di) = (ac-bd) + (ad+bc)i
        return Complex(real * c.real - imag * c.imag,
                       real * c.imag + imag * c.real);
    }

    // 比较（友元）
    friend bool operator==(const Complex &a, const Complex &b) {
        return a.real == b.real && a.imag == b.imag;
    }

    // 输出（友元）
    friend ostream &operator<<(ostream &os, const Complex &c) {
        os << c.real;
        if (c.imag >= 0) os << "+" << c.imag << "i";
        else os << c.imag << "i";
        return os;
    }

    // 输入（友元）
    friend istream &operator>>(istream &is, Complex &c) {
        cout << "输入实部: ";
        is >> c.real;
        cout << "输入虚部: ";
        is >> c.imag;
        return is;
    }
};

int main() {
    Complex a(3, 4);
    Complex b(1, -2);

    cout << "a = " << a << endl;           // 3+4i
    cout << "b = " << b << endl;           // 1-2i
    cout << "a + b = " << (a + b) << endl; // 4+2i
    cout << "a - b = " << (a - b) << endl; // 2+6i
    cout << "a * b = " << (a * b) << endl; // 11-2i
    cout << "a == b: " << (a == b) << endl; // 0
    return 0;
}
```

### 总结

本篇讲解了运算符重载的基础（可重载清单、成员/友元两种形式）、常用重载（==、<、<<、W]、()、++/–）、赋值运算符的完整实现（自赋值、深拷贝）、=default/=delete、explicit 关键字和类型转换运算符，并用复数类串联实战。重点掌握：成员 vs 友元的选择、自赋值检查、前置/后置 ++ 的区别、explicit 防止意外转换。

下一篇将讲解**继承与多态**（虚函数、抽象类、RTTI），敬请期待！
