---
title: "C++入门教程：结构体、枚举与类初探"
abbrlink: c-ru-men-jiao-cheng-jie-gou-ti-mei-ju-yu-lei-chu-tan
date: "2026-08-28 18:10:46"
categories:
    - "C与C++"
tags: []
desc: "结构体是不同类型数据的集合// 定义学生结构体int age;// 定义并初始化Student s1;// 默认构造s1.name = \"张三\";// 列表初始化（C++11）Student s2…"
---
> 本文是 C++ 系列教程的第 5 篇。上一篇讲解了数组、字符串与指针，本篇正式进入面向对象世界：结构体 struct、枚举 enum/enum class、类 class 的基本语法，理解 public/private 访问控制和构造函数初步。

### 一、结构体 struct

#### 1.1 结构体的定义与使用

结构体是**不同类型数据的集合**，用于描述一个复合对象：

```cpp
#include <iostream>
#include <string>
using namespace std;

// 定义学生结构体
struct Student {
    string name;
    int age;
    double score;
};

int main() {
    // 定义并初始化
    Student s1;                       // 默认构造
    s1.name = "张三";
    s1.age = 20;
    s1.score = 88.5;

    // 列表初始化（C++11）
    Student s2 = {"李四", 21, 92.0};

    // 访问成员
    cout << s1.name << " " << s1.age << "岁 " << s1.score << "分" << endl;
    cout << s2.name << " " << s2.age << "岁 " << s2.score << "分" << endl;
    return 0;
}
```

#### 1.2 结构体数组

```cpp
#include <iostream>
#include <string>
using namespace std;

struct Student {
    string name;
    int age;
    double score;
};

int main() {
    // 结构体数组
    Student students[3] = {
        {"张三", 20, 88.5},
        {"李四", 21, 92.0},
        {"王五", 19, 76.5}
    };

    // 遍历并统计平均分
    double sum = 0;
    for (const Student &s : students) {
        cout << s.name << ": " << s.score << "分" << endl;
        sum += s.score;
    }
    cout << "平均分: " << sum / 3 << endl;
    return 0;
}
```

#### 1.3 结构体指针与传参

```cpp
#include <iostream>
#include <string>
using namespace std;

struct Student {
    string name;
    int age;
};

// 用 const 引用避免拷贝
void printStudent(const Student &s) {
    cout << s.name << " " << s.age << "岁" << endl;
}

// 用指针修改结构体
void birthday(Student *s) {
    s->age++;   // -> 通过指针访问成员
}

int main() {
    Student stu = {"赵六", 22};

    printStudent(stu);        // 赵六 22岁
    birthday(&stu);           // 传地址
    printStudent(stu);        // 赵六 23岁

    // 结构体指针
    Student *p = &stu;
    cout << "(*p).age = " << (*p).age << endl;  // 23
    cout << "p->age = " << p->age << endl;      // 23
    return 0;
}
```

### 二、枚举 enum

#### 2.1 C 风格枚举

```cpp
#include <iostream>
using namespace std;

// 定义枚举类型
enum Color { RED, GREEN, BLUE };        // 默认 0, 1, 2
enum Weekday { MON = 1, TUE, WED };     // 指定起始 1, 2, 3

int main() {
    Color c = GREEN;
    cout << "GREEN = " << GREEN << endl;       // 1
    cout << "BLUE = " << BLUE << endl;         // 2
    cout << "TUE = " << TUE << endl;           // 2

    // 枚举参与运算（隐式转 int）
    int value = c + 1;
    cout << "value = " << value << endl;       // 2
    return 0;
}
```

#### 2.2 enum class（C++11，推荐）

```cpp
#include <iostream>
using namespace std;

// 强类型枚举：必须用 类型::值 访问，不能隐式转 int
enum class Color { RED, GREEN, BLUE };
enum class Light { RED, YELLOW, GREEN };

int main() {
    Color c = Color::GREEN;
    Light l = Light::RED;

    // 类型安全：不同枚举类型可同名
    // int x = c;              // 错误！不能隐式转 int
    int x = static_cast<int>(c);   // 显式转换
    cout << "GREEN = " << x << endl;  // 1

    // 可比较（同类型）
    if (c == Color::GREEN) {
        cout << "是绿色" << endl;
    }
    return 0;
}
```

#### 2.3 两种枚举对比

| 维度 | enum | enum class |
| --- | --- | --- |
| 作用域 | 值注入外层命名空间 | 值限定在类型内 |
| 类型安全 | 可隐式转 int | 禁止隐式转换 |
| 同名冲突 | 易冲突 | 可同名 |
| 推荐程度 | 不推荐 | **推荐** |

### 三、类 class 初探

#### 3.1 类与结构体的关系

```cpp
#include <iostream>
#include <string>
using namespace std;

// struct 默认成员是 public
struct Point {
    int x;
    int y;
};

// class 默认成员是 private
class Circle {
public:                       // 显式声明 public
    double radius;
    double area() {           // 成员函数
        return 3.14159 * radius * radius;
    }
};

int main() {
    Point p;      // struct：直接访问
    p.x = 10;

    Circle c;
    c.radius = 5;
    cout << "面积 = " << c.area() << endl;  // 78.5398
    return 0;
}
```

#### 3.2 完整的类定义

```cpp
#include <iostream>
#include <string>
using namespace std;

class BankAccount {
private:                        // 私有：外部不可直接访问
    string owner;
    double balance;

public:                         // 公有：对外接口
    // 构造函数：对象创建时自动调用
    BankAccount(string name, double initial) {
        owne
r = name;
        balance = initial;
        cout << "账户创建: " << owner << endl;
    }

    // 成员函数（方法）
    void deposit(double amount) {
        if (amount > 0) {
            balance += amount;
            cout << "存入 " << amount << " 元" << endl;
        }
    }

    bool withdraw(double amount) {
        if (amount > 0 && amount <= balance) {
            balance -= amount;
            cout << "取出 " << amount << " 元" << endl;
            return true;
        }
        cout << "余额不足！" << endl;
        return false;
    }

    void showBalance() const {    // const 成员函数：不修改对象
        cout << owner << " 的余额: " << balance << " 元" << endl;
    }
};

int main() {
    BankAccount acc("小明", 1000.0);
    acc.showBalance();        // 小明 的余额: 1000 元

    acc.deposit(500);
    acc.showBalance();        // 余额: 1500 元

    acc.withdraw(2000);       // 余额不足
    acc.withdraw(300);        // 取出 300 元
    acc.showBalance();        // 余额: 1200 元

    // acc.balance = 0;       // 错误！private 成员外部不可访问
    return 0;
}
```

#### 3.3 访问控制总结

| 访问级别 | 类内 | 派生类 | 外部 |
| --- | --- | --- | --- |
| public | 可 | 可 | 可 |
| protected | 可 | 可 | 否 |
| private | 可 | 否 | 否 |

**封装原则**：数据成员设为 private，通过 public 成员函数访问，保护数据安全。

### 四、构造函数与析构函数

#### 4.1 构造函数

```cpp
#include <iostream>
using namespace std;

class Rectangle {
private:
    double width;
    double height;

public:
    // 默认构造
    Rectangle() {
        width = 0;
        height = 0;
        cout << "默认构造" << endl;
    }

    // 带参构造
    Rectangle(double w, double h) {
        width = w;
        height = h;
        cout << "带参构造: " << w << "x" << h << endl;
    }

    // 初始化列表（推荐，更高效）
    Rectangle(double side) : width(side), height(side) {
        cout << "正方形构造" << endl;
    }

    double area() {
        return width * height;
    }
};

int main() {
    Rectangle r1;                 // 默认构造
    Rectangle r2(3, 4);           // 带参构造
    Rectangle r3(5);              // 正方形构造

    cout << "r1 面积: " << r1.area() << endl;  // 0
    cout << "r2 面积: " << r2.area() << en
dl;  // 12
    cout << "r3 面积: " << r3.area() << endl;  // 25
    return 0;
}
```

#### 4.2 析构函数

```cpp
#include <iostream>
using namespace std;

class Resource {
public:
    Resource() {
        cout << "资源创建" << endl;
    }

    // 析构函数：对象销毁时自动调用，用于释放资源
    ~Resource() {
        cout << "资源释放" << endl;
    }
};

int main() {
    cout << "main 开始" << endl;
    {
        Resource res;    // 构造
        cout << "使用资源..." << endl;
    }                     // 离开作用域，析构
    cout << "main 结束" << endl;
    return 0;
}
```

输出顺序：

```
main 开始
资源创建
使用资源...
资源释放
main 结束
```

### 五、实战：学生信息登记系统

综合本篇知识，用结构体 + 类实现学生登记：

```cpp
#include <iostream>
#include <string>
using namespace std;

// 结构体：基础数据
struct Student {
    string name;
    int age;
    double score;
};

// 类：管理学生集合
class StudentManager {
private:
    Student students[100];   // 最多 100 人
    int count;

public:
    StudentManager() : count(0) {}

    void addStudent(string name, int age, double score) {
        if (count >= 100) {
            cout << "人数已满！" << endl;
            return;
        }
        students[count] = {name, age, score};
        count++;
        cout << "已添加: " << name << endl;
    }

    void printAll() const {
        cout << "===== 学生名单 =====" << endl;
        for (int i = 0; i < count; i++) {
            cout << i + 1 << ". " << students[i].name
                 << " " << students[i].age << "岁 "
                 << students[i].score << "分" << endl;
        }
    }

    double averageScore() const {
        if (count == 0) return 0;
        double sum = 0;
        for (int i = 0; i < count; i++) {
            sum += students[i].score;
        }
        return sum / count;
    }
};

int main() {
    StudentManager manager;

    manager.addStudent("张三", 20, 88.5);
    manager.addStudent("李四", 21, 92.0);
    manager.addStudent("王五", 19, 76.5);

    manager.printAll();
    cout << "平均分: " << manager.averageScore() << endl;
    return 0;
}
```

运行示例：

```
已添加: 张三
已添加: 李四
已添加: 王五
===== 学生名单 =====
1. 张三 20岁 88.5分
2. 李四 21岁 92分
3. 王五 19岁 76.5分
平均分: 85.6667
```

### 总结

本篇讲解了结构体 struct（定义/数组/指针传参）、枚举 enum 与 enum class 的区别、类 class 的基本语法（成员/方法/访问控制）、构造函数与析构函数，并用学生信息登记系统串联实战。重点掌握：struct 与 class 的区别、enum class 的类型安全、public/private 封装思想、构造与析构时机。

下一篇将深入讲解**类与对象**（深拷贝/浅拷贝、static 成员、this 指针、友元），敬请期待！
