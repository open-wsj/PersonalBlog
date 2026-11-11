---
title: "C++进阶教程：继承与多态"
abbrlink: c-jin-jie-jiao-cheng-ji-cheng-yu-duo-tai
date: "2026-08-28 18:12:38"
categories:
    - "C与C++"
tags: []
desc: "多态（Polymorphism）指同一个调用在不同对象上表现出不同行为。通过基类指针/引用调用虚函数，实际执行的是派生类的实现。多态三要素基类中定义虚函数。派生类重写虚函数。通过基类指针/引用调用…"
---
> 本文是 C++ 系列教程的第 8 篇。上一篇讲解了运算符重载，本篇讲解面向对象的核心：继承（三种方式、构造析构顺序、与多态（虚函数、动态绑定、纯虚函数与抽象类、虚析构、override/final、RTTI）。

### 一、继承基础

#### 1.1 为什么需要继承

继承让新类（**派生类**）复用已有类（**基类**）的成员，并可以扩展新功能，实现**代码复用**和**层次抽象**。例如：猫和狗都是动物，可以继承 Animal 的共性，再各自扩展。

#### 1.2 继承的基本语法

```cpp
#include <iostream>
#include <string>
using namespace std;

// 基类（父类）
class Animal {
protected:                       // 派生类可访问，外部不可访问
    string name;

public:
    Animal(string n) : name(n) {}

    void eat() const {
        cout << name << " 在吃东西" << endl;
    }

    string getName() const { return name; }
};

// 派生类（子类）：public 继承
class Dog : public Animal {
public:
    Dog(string n) : Animal(n) {}   // 调用基类构造

    void bark() const {
        cout << name << " 汪汪叫" << endl;
    }
};

class Cat : public Animal {
public:
    Cat(string n) : Animal(n) {}

    void meow() const {
        cout << name << " 喵喵叫" << endl;
    }
};

int main() {
    Dog dog("旺财");
    Cat cat("咪咪");

    dog.eat();     // 继承的方法
    dog.bark();    // 自己的方法

    cat.eat();
    cat.meow();
    return 0;
}
```

#### 1.3 三种继承方式

```cpp
class Base {
public:
    int pub;
protected:
    int prot;
private:
    int priv;
};

// public 继承：public→public，protected→protected
class PubChild : public Base { };

// protected 继承：public→protected，protected→protected
class ProtChild : protected Base { };

// private 继承：public→private，protected→private
class PrivChild : private Base { };
```

| 继��方式 | 基类 public 成员 | 基类 protected 成员 |
| --- | --- | --- |
| public 继承 | 仍为 public | 仍为 protected |
| protected 继承 | 降为 protected | 仍为 protected |
| private 继承 | 降为 private | 降为 private |

**实际开发中几乎只用 public 继承**，它表达「is-a」关系。

### 二、派生类的构造与析构

```cpp
#include <iostream>
using namespace std;

class Base {
private:
    int value;

public:
    Base(in
t v) : value(v) {
        cout << "Base 构造: " << value << endl;
    }
    ~Base() {
        cout << "Base 析构" << endl;
    }
};

class Derived : public Base {
private:
    int extra;

public:
    // 派生类构造：必须先初始化基类部分
    Derived(int v, int e) : Base(v), extra(e) {
        cout << "Derived 构造: extra=" << extra << endl;
    }
    ~Derived() {
        cout << "Derived 析构" << endl;
    }
};

int main() {
    cout << "创建派生对象:" << endl;
    Derived d(10, 20);
    cout << "销毁派生对象:" << endl;
    return 0;
}
```

输出顺序：

```
创建派生对象:
Base 构造: 10
Derived 构造: extra=20
销毁派生对象:
Derived 析构
Base 析构
```

**规则**：构造顺序 = 基类 → 成员 → 自身；析构顺序相反。派生类构造必须显式（或隐式）调用基类构造函数。

### 三、多态与虚函数

#### 3.1 什么是多态

多态（Polymorphism）指**同一个调用在不同对象上表现出不同行为**。通过基类指针/引用调用虚函数，实际执行的是派生类的实现。

**多态三要素**：

1.  基类中定义**虚函数**。
2.  派生类**重写**虚函数。
3.  通过**基类指针/引用**调用。

#### 3.2 虚函数与动态绑定

```cpp
#include <iostream>
using namespace std;

class Shape {
public:
    // 虚函数：允许派生类重写，支持多态
    virtual double area() const {
        return 0;
    }
    virtual void whoAmI() const {
        cout << "我是图形" << endl;
    }
};

class Circle : public Shape {
private:
    double radius;

public:
    Circle(double r) : radius(r) {}

    // 重写虚函数（override 是 C++11 建议标注）
    double area() const override {
        return 3.14159 * radius * radius;
    }
    void whoAmI() const override {
        cout << "我是圆" << endl;
    }
};

class Rectangle : public Shape {
private:
    double w, h;

public:
    Rectangle(double a, double b) : w(a), h(b) {}

    double area() const override {
        return w * h;
    }
    void whoAmI() const override {
        cout << "我是矩形" << endl;
    }
};

int main() {
    // 基类指针指向派生类对象
    Shape *s1 = new Circle(3);
    Shape *s2 = new Rectangle(4, 5);

    // 同一个调用，不同行为（动态绑定）
    s1->whoAmI();   // 我是圆
    s2->whoAmI();   // 我是矩形
    cout << "面积: " <<
 s1->area() << endl;  // 28.27
    cout << "面积: " << s2->area() << endl;  // 20

    delete s1;
    delete s2;
    return 0;
}
```

#### 3.3 静态绑定 vs 动态绑定

| 维度 | 静态绑定 | 动态绑定 |
| --- | --- | --- |
| 时机 | 编译期决定 | 运行期决定 |
| 依据 | 指针/引用静态类型 | 对象实际类型 |
| 函数 | 非虚函数 | 虚函数 |
| 性能 | 更快 | 有虚函数表查找开销 |

#### 3.4 虚函数表（vtable）

含有虚函数的类会生成**虚函数表**（vtable），对象头部有**虚指针**（vptr）指向它。调用虚函数时通过 vptr → vtable → 实际函数地址，实现动态绑定。

```
Shape 对象: [vptr] -> [Shape::area, Shape::whoAmI]
Circle 对象: [vptr] -> [Circle::area, Circle::whoAmI]  （重写后）
```

### 四、纯虚函数与抽象类

#### 4.1 抽象类

含**纯虚函数**的类称为抽象类，**不能实例化**，只能作为基类被继承：

```cpp
#include <iostream>
using namespace std;

// 抽象类：含纯虚函数
class Shape {
public:
    virtual double area() const = 0;    // 纯虚函数：= 0
    virtual void draw() const = 0;

    // 抽象类也可以有普通成员函数
    void show() const {
        cout << "面积: " << area() << endl;
    }

    // 抽象类需要虚析构（见第五节）
    virtual ~Shape() {}
};

class Circle : public Shape {
private:
    double radius;

public:
    Circle(double r) : radius(r) {}

    // 必须实现所有纯虚函数才能实例化
    double area() const override { return 3.14159 * radius * radius; }
    void draw() const override { cout << "画一个圆" << endl; }
};

int main() {
    // Shape s;              // 错误！抽象类不能实例化
    Shape *shape = new Circle(3);
    shape->draw();           // 画一个圆
    shape->show();           // 面积: 28.2743
    delete shape;
    return 0;
}
```

#### 4.2 抽象类的用途

-   定义**接口规范**，强制派生类实现。
-   用于设计模式（工厂、策略等）。
-   表达「是一个」的抽象层次。

### 五、虚析构函数

```cpp
#include <iostream>
using namespace std;

class Base {
public:
    // 非虚析构（问题版本）
    // ~Base() { cout << "Base 析构" << endl; }

    // 虚析构（正确）：通过基类指针删除时正确调用派生类析构
    virtual ~Base() { cout << "Base 析构" << endl; }
};

cl
ass Derived : public Base {
private:
    int *data;

public:
    Derived() : data(new int[100]) {
        cout << "Derived 构造: 分配内存" << endl;
    }
    ~Derived() {
        delete[] data;   // 释放内存
        cout << "Derived 析构: 释放内存" << endl;
    }
};

int main() {
    Base *p = new Derived();
    delete p;    // 若 Base 析构非虚，这里不会调用 Derived 析构 → 内存泄漏
    return 0;
}
```

**关键**：凡是可能被继承且通过基类指针删除的类，**析构函数必须声明为 virtual**。

### 六、override 与 final

#### 6.1 override（显式重写）

```cpp
class Base {
public:
    virtual void func() {}
};

class Derived : public Base {
public:
    // override 标记：编译器检查确实重写了基类虚函数
    // 若拼写错误（如 funcc），编译器报错
    void func() override {}
};
```

#### 6.2 final（禁止继承/重写）

```cpp
#include <iostream>
using namespace std;

class Base {
public:
    virtual void show() { cout << "Base" << endl; }
};

// final 类：禁止被继承
class FinalClass final : public Base {
public:
    // final 虚函数：禁止子类重写
    void show() override final { cout << "FinalClass" << endl; }
};

// class Child : public FinalClass {};  // 错误！FinalClass 是 final

int main() {
    FinalClass fc;
    fc.show();   // FinalClass
    return 0;
}
```

### 七、RTTI：dynamic_cast 与 typeid

#### 7.1 dynamic_cast（安全向下转型）

```cpp
#include <iostream>
#include <typeinfo>
using namespace std;

class Animal {
public:
    virtual ~Animal() {}   // 必须有虚函数才能 dynamic_cast
};

class Dog : public Animal {
public:
    void bark() { cout << "汪汪" << endl; }
};

class Cat : public Animal {
public:
    void meow() { cout << "喵喵" << endl; }
};

int main() {
    Animal *a1 = new Dog();
    Animal *a2 = new Cat();

    // dynamic_cast：安全的向下转型，失败返回 nullptr
    Dog *d = dynamic_cast<Dog *>(a1);
    if (d) {
        d->bark();   // 汪汪
    }

    Dog *d2 = dynamic_cast<Dog *>(a2);   // a2 实际是 Cat
    if (d2) {
        d2->bark();   // 不会执行
    } else {
        cout << "a2 不是 Dog 类型，转型失败" << endl;
    }

    delete a1;
    delete a2;
    return 0;
}
```

#### 7.2 typeid（获取类型信息）

```cpp
#include <iostream>
#include <typeinfo>
using namespace std;

class Animal {
public:
    virtual ~Animal() {}
};
class Dog : public Animal {};
class Cat : public Animal {};

int main() {
    Animal *a1 = new Dog();
    Animal *a2 = new Cat();

    cout << "a1 实际类型: " << typeid(*a1).name() << endl;  // class Dog
    cout << "a2 实际类型: " << typeid(*a2).name() << endl;  // class Cat

    if (typeid(*a1) == typeid(Dog)) {
        cout << "a1 是 Dog" << endl;
    }
    delete a1;
    delete a2;
    return 0;
}
```

### 八、实战：图形系统

综合本篇全部知识，实现完整图形系统：

```cpp
#include <iostream>
#include <vector>
using namespace std;

// 抽象基类
class Shape {
protected:
    string name;

public:
    Shape(string n) : name(n) {}

    virtual double area() const = 0;       // 纯虚函数
    virtual void info() const = 0;
    virtual ~Shape() {}                    // 虚析构
};

class Circle : public Shape {
private:
    double radius;

public:
    Circle(string n, double r) : Shape(n), radius(r) {}
    double area() const override { return 3.14159 * radius * radius; }
    void info() const override {
        cout << name << "（圆，半径 " << radius << "）面积: " << area() << endl;
    }
};

class Rectangle : public Shape {
private:
    double w, h;

public:
    Rectangle(string n, double a, double b) : Shape(n), w(a), h(b) {}
    double area() const override { return w * h; }
    void info() const override {
        cout << name << "（矩形 " << w << "x" << h << "）面积: " << area() << endl;
    }
};

class Triangle : public Shape {
private:
    double base, height;

public:
    Triangle(string n, double b, double hh) : Shape(n), base(b), height(hh) {}
    double area() const override { return 0.5 * base * height; }
    void info() const override {
        cout << name << "（三角形）面积: " << area() << endl;
    }
};

int main() {
    // 多态容器：基类指针数组管理多种派生对象
    vector<Shape *> shapes;
    shapes.push_back(new Circle("圆形", 3));
    shapes.push_back(new Rectangle("矩形", 4, 5));
    shapes.push_back(new Triangle("三角形", 6, 4));

    double total = 0;
    for (Shape *s : shapes) {
        s->info();
        total += s->area();
    }
    cout << "总面积: " << total << endl;

    // 释放内存（虚析构保证正确）
    for (Shape *s : shapes) {
        delete s;
    }
    return 0;
}
```

运行示例：

```
圆形（圆，半径 3）面积: 28.2743
矩形（矩形 4x5）面积: 20
三角形（三角形）面积: 12
总面积: 60.2743
```

### 总结

本篇讲解了继承的三种方式与构造析构顺序、多态三要素、虚函数与虚函数表、纯虚函数与抽象类、虚析构函数的重要性、override/final、RTTI（dynamic_cast/typeid），并用图形系统串联实战。重点掌握：public 继承的 is-a 语义、多态的实现条件、抽象类不能实例化、基类析构必须 virtual。

下一篇将讲解**动态内存管理与智能指针**（RAII、unique_ptr/shared_ptr/weak_ptr），敬请期待！
