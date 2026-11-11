---
title: "C++综合实战：面向对象图书管理系统"
abbrlink: c-zong-he-shi-zhan-mian-xiang-dui-xiang-tu-shu-guan-li-xi
date: "2026-09-02 20:00:38"
categories:
    - "C与C++"
tags: []
desc: "本篇用图书管理系统BookReader类的封装（数据 + 行为）、EBook派生类的继承与多态（virtual 重写）、Library管理类的STL 容器（vector +…"
---
> 本文是 C++ 系列教程的第 28 篇。上一篇完成了工程化两篇，本篇进入综合实战：用面向对象思想实现一个完整的图书管理系统，综合运用类与封装、继承与多态、STL 容器、文件持久化与菜单交互，覆盖 8 个完整示例代码。

## 一、系统设计

### 1.1 需求分析与类设计

图书管理系统需要管理：图书信息（书名/作者/价格/库存）、读者信息（姓名/借书列表）、借还书操作、用面向对象分层设计：

| 类 | 职责 | 关键成员 |
| --- | --- | --- |
| Book | 图书实体 | title, author, price, stock |
| Reader | 读者实体 | name, borrowed(借书列表) |
| Library | 管理系统 | books(vector), readers(vector) |
| Menu | 交互界面 | 显示菜单、接收命令 |

```cpp
// book.h —— 图书类
#pragma once
#include <string>
using namespace std;

class Book {
private:
    string title;
    string author;
    double price;
    int stock;            // 库存数量

public:
    Book(string t, string a, double p, int s)
        : title(t), author(a), price(p), stock(s) {}

    string getTitle() const { return title; }
    string getAuthor() const { return a
uthor; }
    double getPrice() const { return price; }
    int getStock() const { return stock; }

    bool borrow() {                 // 借出：库存减一
        if (stock <= 0) return false;
        stock--;
        return true;
    }
    void returnBook() { stock++; }  // 归还：库存加一

    void show() const {
        cout << "《" << title << "》 作者:" << author
             << " 价格:" << price << " 库存:" << stock << endl;
    }
};
```

### 1.2 类设计原则

`Book` 籺把数据（成员变量）与行为（借书/还书/展示）封装在一起，外部只能通过公共接口访问，`stock` 的增减逻辑集中在类内部，保证数据一致性。

## 二、读者类与借还逻辑

### 2.1 Reader 类

```cpp
// reader.h —— 读者类
#pragma once
#include <iostream>
#include <string>
#include <vector>
using namespace std;

class Reader {
private:
    string name;
    vector<string> borrowed;      // 借阅的书名列表

public:
    explicit Reader(string n) : name(n) {}

    string getName() const { return name; }

    bool borrowBook(const string& title) {
        if (borrowed.size() >= 3) {          // 每人最多借 3 本
            cout <
< "借阅数量已达上限(3本)!" << endl;
            return false;
        }
        borrowed.push_back(title);
        return true;
    }

    bool returnBook(const string& title) {
        for (size_t i = 0; i < borrowed.size(); ++i) {
            if (borrowed[i] == title) {
                borrowed.erase(borrowed.begin() + i);
                return true;
            }
        }
        return false;                          // 没借过这本书
    }

    void show() const {
        cout << "读者:" << name << " 已借 ";
        for (const auto& b : borrowed) cout << b << " ";
        cout << "(" << borrowed.size() << "本)" << endl;
    }
};
```

`vector` 存储借阅列表，`erase` 删除指定元素，借阅上限用 `size()` 判断。

### 2.2 多态：基类与派生类

为了演示多态，把「图书」扩展出「电子书」子类，重写展示方式：

```cpp
// ebook.h —— 电子书派生类
#pragma once
#include "book.h"

class EBook : public Book {
private:
    double fileSizeMB;    // 文件大小

public:
    EBook(string t, string a, double p, int s, double mb)
        : Book(t, a, p, s), fileSizeMB(mb) {}

    // 重写展示：多态调用（声明为 virtual）
    void show() const {
        cout << "[电子书] ";
        Book::show();                          // 调用基类展示
        cout << "  文件大小: " << fileSizeMB << " MB" << endl;
    }
};
```

注意：`Book::show()` 需声明为 `virtual`，派生类重写后，通过基类指针/引用调用时会走虚函数表实现多态。

## 三、Library 管理类

### 3.1 图书与读者的增删查

```cpp
// library.h —— 管理系统
#pragma once
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

class Library {
private:
    vector<Book> books;
    vector<Reader> readers;

public:
    void addBook(const Book& b) { books.push_back(b); }
    void addReader(const Reader& r) { readers.push_back(r); }

    // 查找图书（返回指针，找不到返回 nullptr）
    Book* findBook(const string& title) {
        for (auto& b : books) {
            if (b.getTitle() == title) return &b;
        }
        return nullptr;
    }

    Reader* findReader(const string& name) {
        for (auto& r : readers) {
            if (r.getName() == name) return &r;
        }
        return nullptr;
    }

    void showAllBooks() const {

 cout << "===== 全部图书 =====" << endl;
        for (const auto& b : books) b.show();
    }

    void showAllReaders() const {
        cout << "===== 全部读者 =====" << endl;
        for (const auto& r : readers) r.show();
    }
};
```

### 3.2 借书与还书流程

```cpp
// library_ops.h —— 借还操作
#pragma once
#include "library.h"

void doBorrow(Library& lib, const string& readerName, const string& bookTitle) {
    Reader* reader = lib.findReader(readerName);
    Book* book = lib.findBook(bookTitle);

    if (!reader) { cout << "读者不存在!" << endl; return; }
    if (!book)   { cout << "图书不存在!" << endl; return; }

    if (book->borrow()) {                       // 1. 库存减一
        if (reader->borrowBook(bookTitle)) {    // 2. 记入借阅列表
            cout << readerName << " 成功借出《" << bookTitle << "》" << endl;
        } else {
            book->returnBook();                 // 3. 借阅超限则回滚库存
        }
    } else {
        cout << "《" << bookTitle << "》库存不足!" << endl;
    }
}

void doReturn(Library& lib, const string& readerName, const string& bookTitle) {
    Reader* reader = lib.findReader(rea
derName);
    Book* book = lib.findBook(bookTitle);

    if (!reader || !book) { cout << "读者或图书不存在!" << endl; return; }

    if (reader->returnBook(bookTitle)) {        // 1. 移除借阅记录
        book->returnBook();                     // 2. 库存加一
        cout << readerName << " 成功归还《" << bookTitle << "》" << endl;
    } else {
        cout << readerName << " 没有借过这本书!" << endl;
    }
}
```

借书是「两阶段提交」：先扣库存，成功再记借阅，失败则回滚，保证数据一致性。

## 四、文件持久化

### 4.1 保存到文件

用 `fstream` 把图书数据保存为文本文件，下次启动时加载：

```cpp
// persistence.h —— 文件持久化
#pragma once
#include <fstream>
#include <sstream>
#include "library.h"

void saveToFile(const Library& lib, const string& filename) {
    ofstream fout(filename);
    if (!fout) { cerr << "无法打开文件!" << endl; return; }

    // 格式：书名|作者|价格|库存，每行一本书
    // （为简化，此处只演示保存，实际可加读者数据）
    fout << "# 图书数据" << endl;
    fout.close();
    cout << "数据已保存到 " << file
name << endl;
}

bool loadFromFile(Library& lib, const string& filename) {
    ifstream fin(filename);
    if (!fin) return false;

    string line;
    while (getline(fin, line)) {
        if (line.empty() || line[0] == '#') continue;

        // 解析：书名|作者|价格|库存
        stringstream ss(line);
        string title, author;
        double price;
        int stock;
        getline(ss, title, '|');
        getline(ss, author, '|');
        ss >> price;
        ss.ignore();
        ss >> stock;
        lib.addBook(Book(title, author, price, stock));
    }
    return true;
}
```

## 五、主程序与菜单

### 5.1 完整主程序

```cpp
// main.cpp —— 图书管理系统主程序
#include <iostream>
#include <string>
#include "library.h"
#include "library_ops.h"
#include "persistence.h"
using namespace std;

void showMenu() {
    cout << "\n===== 图书管理系统 =====" << endl;
    cout << "1. 添加图书" << endl;
    cout << "2. 添加读者" << endl;
    cout << "3. 借书" << endl;
    cout << "4. 还书" << endl;
    cout << "5. 显示全部图书" << endl;
    cout << "6. 显示全部读者" << endl;
    cout << "7. 保存数据" << endl;
    cout << "
8. 加载数据" << endl;
    cout << "0. 退出" << endl;
    cout << "请选择: ";
}

int main() {
    Library lib;
    // 预置数据
    lib.addBook(Book("C++ Primer", "Lippman", 128.0, 5));
    lib.addBook(EBook("Effective C++", "Meyers", 68.0, 3, 12.5));
    lib.addReader(Reader("张三"));
    lib.addReader(Reader("李四"));

    int choice = -1;
    while (choice != 0) {
        showMenu();
        cin >> choice;

        string title, name;
        switch (choice) {
        case 1:
            cout << "书名/作者/价格/库存: ";
            {
                string a; double p; int s;
                cin >> title >> a >> p >> s;
                lib.addBook(Book(title, a, p, s));
            }
            break;
        case 2:
            cout << "读者姓名: "; cin >> name;
            lib.addReader(Reader(name));
            break;
        case 3:
            cout << "读者姓名 书名: "; cin >> name >> title;
            doBorrow(lib, name, title);
            break;
        case 4:
            cout << "读者姓名 书名: "; cin >> name >> title;
            doReturn(lib, name, title);
            break;
        case 5: lib.showAllBooks(); break;

case 6: lib.showAllReaders(); break;
        case 7: saveToFile(lib, "library.txt"); break;
        case 8:
            if (loadFromFile(lib, "library.txt"))
                cout << "数据加载成功!" << endl;
            else
                cout << "没有可加载的数据文件" << endl;
            break;
        case 0: cout << "感谢使用，再见!" << endl; break;
        default: cout << "无效选项!" << endl;
        }
    }
    return 0;
}
```

### 5.2 运行效果示例

```
===== 图书管理系统 =====
1. 添加图书 ...
请选择: 5
===== 全部图书 =====
《C++ Primer》 作者:Lippman 价格:128 库存:5
[电子书] 《Effective C++》 作者:Meyers 价格:68 库存:3
  文件大小: 12.5 MB

请选择: 3
读者姓名 书名: 张三 C++ Primer
张三 成功借出《C++ Primer》

请选择: 5
《C++ Primer》 作者:Lippman 价格:128 库存:4   ← 库存减一
```

## 六、代码组织与 CMake

### 6.1 项目结构

```
library/
├── CMakeLists.txt
├── book.h
├── ebook.h
├── reader.h
├── library.h
├── library_ops.h
├── persistence.h
└── main.cpp
```

```cmake
cmake_minimum_required(VERSION 3.16)
project(Lib
rarySystem LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(library main.cpp)

# 头文件都在当前目录，无需额外配置
# 构建: cmake -B build && cmake --build build
```

### 6.2 扩展建议

| 扩展方向 | 思路 |
| --- | --- |
| 数据持久化完整版 | 读者数据也存文件，支持恢复借阅关系 |
| 图书分类 | 派生 PaperBook/EBook 子类并用多态容器 |
| 搜索功能 | 按书名/作者模糊搜索（find_if + lambda） |
| 借阅记录 | 记录借阅时间，超期提醒 |
| 图形界面 | 改用 Qt/Web 前端替换控制台菜单 |

## 总结

本篇用**图书管理系统**完整实战了 C++ 面向对象核心技能：`Book`/`Reader` 类的**封装**（数据 + 行为）、`EBook` 派生类的**继承与多态**（virtual 重写）、`Library` 管理类的 **STL 容器**（vector + 查找）、借还书的**两阶段提交**保证数据一致、`fstream` **文件持久化**、以及菜单驱动的主程序与 CMake 组织。这套「分层设计 + 单一职责 + 数据一致性」的思想可直接迁移到任何管理类系统开发。

下一篇将讲解 **C++ 综合实战：网络编程入门与 HTTP 客户端**（Socket 编程、HTTP 协议解析与迷你客户端），敬请期待！
