---
title: "Python进阶教程：面向对象编程（OOP）"
abbrlink: python-jin-jie-jiao-cheng-mian-xiang-dui-xiang-bian-cheng
date: "2026-08-14 16:41:52"
categories:
    - "Python"
tags: []
desc: "面向对象编程（Object-Oriented Programming，简称 OOP）是一种编程思想，它把数据和对数据的操作封装成对象…"
---
#### 目录

-   [Python进阶教程：面向对象编程（OOP）](#PythonOOP_2)
-   -   [一、什么是面向对象编程](#_6)
    -   [二、类与对象](#_16)
    -   -   [2.1 定义类](#21__18)
        -   [2.2 self 是什么](#22_self__39)
    -   [三、封装](#_43)
    -   [四、继承](#_73)
    -   [五、多态](#_98)
    -   [六、类属性与类方法](#_102)
    -   [七、魔法方法](#_125)
    -   [八、实战：图书管理系统](#_146)
    -   [总结](#_188)

> 本文是 **Python 入门教程系列** 的第 2 篇。上一篇介绍了 Python 的基础语法（变量、条件、循环、函数），本篇深入讲解**面向对象编程**。

### 一、什么是面向对象编程

面向对象编程（Object-Oriented Programming，简称 OOP）是一种编程思想，它把数据和对数据的操作封装成**对象**。与面向过程相比，OOP 更适合大型项目：

-   **可复用**：类可以多次实例化
-   **易维护**：代码结构清晰
-   **可扩展**：通过继承轻松扩展功能

OOP 三大特性：**封装、继承、多态**。

### 二、类与对象

#### 2.1 定义类

用 class 关键字定义类，用类创建对象：

```python
class Dog:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def bark(self):
        print(f"{self.name} 汪汪叫！")

    def info(self):
        print(f"{self.name}今年{self.age}岁")

dog1 = Dog("旺财", 3)
dog1.bark()
dog1.info()
```

#### 2.2 self 是什么

self 代表**当前实例**，所有实例方法第一个参数必须是 self，用于访问实例属性和其他方法。

### 三、封装

封装将内部细节隐藏，通过方法对外提供接口。Python 用命名约定实现私有：

```python
class BankAccount:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.__balance = balance

    def deposit(self, amount):
        if amount > 0:
            self.__balance += amount
            print(f"存入{amount}元，余额{self.__balance}元")

    def withdraw(self, amount):
        if 0 < amount <= self.__balance:
            self.__balance -= amount
            print(f"取出{amount}元，余额{self.__balance}元")
        else:
            print("余额不足！")

    def get_balance(self):
        return self.__balance

acc = BankAccount("小明", 1000)
acc.deposit(500)
acc.withdraw(200)
```

### 四、继承

子类继承父类的属性和方法，并可扩展或重写：

```python
class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        print("动物叫")

class Cat(Animal):
    def speak(self):
        print(f"{self.name} 喵喵叫！")

class Dog(Animal):
    def speak(self):
        print(f"{self.name} 汪汪叫！")

animals = [Cat("咪咪"), Dog("旺财")]
for a in animals:
    a.speak()
```

### 五、多态

多态指**同一操作作用于不同对象产生不同结果**。上面的例子中，speak() 对猫和狗有不同的表现，这就是多态。

### 六、类属性与类方法

```python
class Student:
    school = "第一中学"

    def __init__(self, name):
        self.name = name

    @classmethod
    def get_school(cls):
        return cls.school

    @staticmethod
    def hello():
        print("这是静态方法")

s1 = Student("张三")
s2 = Student("李四")
print(s1.school, s2.school)
print(Student.get_school())
```

### 七、魔法方法

Python 中以双下划线开头和结尾的方法是魔法方法，如 **init**、**str**、**len**：

```python
class Book:
    def __init__(self, title, pages):
        self.title = title
        self.pages = pages

    def __str__(self):
        return f"《{self.title}》共{self.pages}页"

    def __len__(self):
        return self.pages

b = Book("Python编程", 300)
print(b)
print(len(b))
```

### 八、实战：图书管理系统

综合运用所学知识，实现一个简单的图书管理：

```python
class Book:
    def __init__(self, title, author):
        self.title = title
        self.author = author
        self.borrowed = False

    def __str__(self):
        status = "已借出" if self.borrowed else "可借"
        return f"《{self.title}》- {self.author} [{status}]"

class Library:
    def __init__(self):
        self.books = []

    def add_book(self, book):
        self.books.append(book)
        print(f"添加成功：{book}")

    def borrow(self, title):
        for book in self.books:
            if book.title == title and not book.borrowed:
                book.borrowed = True
                print(f"借出成功：{book}")
                return
        print(f"《{title}》不可借")

    def show_all(self):
        for book in self.books:
            print(book)

lib = Library()
lib.add_book(Book("Python入门", "张三"))
lib.add_book(Book("算法导论", "李四"))
lib.borrow("Python入门")
lib.show_all()
```

### 总结

本篇讲解了 OOP 的三大特性（封装、继承、多态）以及类属性、魔法方法等进阶知识，并用图书管理系统串起全部知识点。下一篇将介绍**文件操作与异常处理**，敬请关注！
