---
title: "C++入门教程：数组、字符串与指针入门"
abbrlink: c-ru-men-jiao-cheng-shu-zu-zi-fu-chuan-yu-zhi-zhen-ru-men
date: "2026-08-26 01:18:08"
categories:
    - "C与C++"
tags: []
desc: "本文是C++系列教程的第4篇，重点讲解数组、字符串和指针的核心概念。主要内容包括：1) 一维/多维数组的声明、初始化和遍历，强调数组越界的危险性；2)…"
---
> 本文是 C++ 系列教程的第 4 篇。上一篇讲解了函数与作用域，本篇深入讲解数组、字符串和指针：一维/多维数组、C 风格字符串与 std::string、指针基础、指针与数组的关系、引用与 const 限定。

### 一、数组

#### 1.1 一维数组

数组是**同类型元素的集合**，内存中连续存储：

```cpp
#include <iostream>
using namespace std;

int main() {
    // 声明与初始化
    int scores[5];                 // 未初始化（含垃圾值）
    int nums[5] = {1, 2, 3, 4, 5}; // 列表初始化
    int partial[5] = {1, 2};       // 其余补 0
    int autoSize[] = {10, 20, 30}; // 自动推导大小为 3

    // 访问与修改
    cout << "nums[0] = " << nums[0] << endl;      // 1
    nums[2] = 100;                                 // 修改第三个元素
    cout << "修改后 nums[2] = " << nums[2] << endl; // 100

    // 遍历
    for (int i = 0; i < 5; i++) {
        cout << nums[i] << " ";
    }
    cout << endl;
    return 0;
}
```

#### 1.2 数组越界（危险！）

```cpp
#include <iostream>
using namespace std;

int main() {
    int arr[3] = {1, 2, 3};
    // arr[3] 越界访问：编译不报错，但行为未定义
    // 可能读到垃圾值，甚至修改其他内存导致崩溃
    cout << "越界访问 arr[3] = " << arr[3] << "（未定义行为！）" << endl;
    return 0;
}
```

**数组下标从 0 开始**，合法范围是 0 ~ 大小-1。C++ 不检查越界，这是很多 bug 的根源。

#### 1.3 多维数组

```cpp
#include <iostream>
using namespace std;

int main() {
    // 3x4 二维数组（3 行 4 列）
    int matrix[3][4] = {
        {1, 2, 3, 4},
        {5, 6, 7, 8},
        {9, 10, 11, 12}
    };

    // 遍历
    for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 4; j++) {
            cout << matrix[i][j] << "\t";
        }
        cout << endl;
    }
    return 0;
}
```

#### 1.4 数组与范围 for

C++11 起可用范围 for 遍历数组：

```cpp
#include <iostream>
using namespace std;

int main() {
    int nums[] = {5, 10, 15, 20};

    // 范围 for：只读
    for (int n : nums) {
        cout << n << " ";
    }
    cout << endl;

    // 用引用修改元素
    for (int &n : nums) {
        n *= 2;
    }
    for (int n : nums) {
        cout << n << " ";
    }
    cout << endl;  // 10 20 30 40
    return 0;
}
```

### 二、字符串

#### 2.1 C 风格字符串

```cpp
#include <iostream>
#include <cstring>
using namespace std;

int main() {
    // C 风格字符串：以 '\0' 结尾的字符数组
    char str1[] = "Hello";          // 自动加 '\0'
    char str2[] = {'H', 'i', '\0'}; // 手动加 '\0'
    char str3[20];

    // 常用函数
    strcpy(str3, "World");          // 复制
    strcat(str3, " C++");           // 拼接
    cout << "str3 = " << str3 << endl;              // World C++
    cout << "strlen(str1) = " << strlen(str1) << endl;  // 5（不含'\0'）

    // 比较
    if (strcmp(str1, "Hello") == 0) {
        cout << "相等" << endl;
    }
    return 0;
}
```

#### 2.2 std::string（推荐）

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    string s1 = "Hello";
    string s2 = " C++";

    // 拼接
    string s3 = s1 + s2;
    cout << "s3 = " << s3 << endl;          // Hello C++

    // 长度与访问
    cout << "长度: " << s3.length() << endl;  // 9
    cout << "首字符: " << s3[0] << endl;      // H

    // 查找
    size_t pos = s3.find("C++");
    if (pos != string::npos) {
        cout << "找到 C++ 在位置 " << pos << endl;  // 6
    }

    // 截取子串
    string sub = s3.substr(6, 3);
    cout << "子串: " << sub << endl;          // C++

    // 比较
    if (s1 < s2) {
        cout << "s1 字典序小于 s2" << endl;
    }
    return 0;
}
```

#### 2.3 string 与 C 字符串互转

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    // string -> const char*
    string s = "Hello";
    const char *cstr = s.c_str();
    cout << "C 字符串: " << cstr << endl;

    // const char* -> string
    const char *p = "World";
    string s2 = p;
    cout << "string: " << s2 << endl;
    return 0;
}
```

### 三、指针基础

#### 3.1 指针的概念

指针是**存储地址的变量**：

```cpp
#include <iostream>
using namespace std;

int main() {
    int num = 42;

    // 声明指针并取地址
    int *ptr = &num;   // & 取地址，* 声明指针

    cout << "num 的值: " << num << endl;         // 42
    cout << "num 的地址: " << &num << endl;      // 如 0x61ff08
    cout << "ptr 的值: " << ptr << endl;         // 同 num 地址
    cout << "ptr 解引用: " << *ptr << endl;      // 42

    // 通过指针修改值
    *ptr = 100;
    cout << "修改后 num = " << num << endl;      // 100
    return 0;
}
```

#### 3.2 空指针与野指针

```cpp
#include <iostream>
using namespace std;

int main() {
    int *p1 = nullptr;   // C++11 空指针（推荐）
    int *p2 = NULL;      // C 风格（不推荐）
    int *p3 = 0;         // 等价于空指针

    if (p1 == nullptr) {
        cout << "p1 是空指针" << endl;
    }

    // 野指针：未初始化的指针，指向未知地址
    int *wild;           // 未初始化
    // *wild = 10;       // 危险！解引用野指针是未定义行为

    // 正确做法：使用前必须指向有效内存
    int value = 5;
    int *safe = &value;
    cout << *safe << endl;  // 5
    return 0;
}
```

#### 3.3 指针的运算

```cpp
#include <iostream>
using namespace std;

int main() {
    int arr[] = {10, 20, 30, 40};

    int *p = arr;              // 数组名退化为首元素地址
    cout << "*p = " << *p << endl;            // 10
    cout << "*(p+1) = " << *(p + 1) << endl;  // 20（指针+1 跳过 1 个 int）
    cout << "*(p+2) = " << *(p + 2) << endl;  // 30

    // 指针算术与下标等价
    cout << "p[1] = " << p[1] << endl;        // 20
    cout << "*(arr+1) = " << *(arr + 1) << endl;  // 20

    // 遍历
    for (int *q = arr; q < arr + 4; q++) {
        cout << *q << " ";
    }
    cout << endl;  // 10 20 30 40
    return 0;
}
```

### 四、指针与数组的关系

#### 4.1 数组名与指针

```cpp
#include <iostream>
using namespace std;

int main() {
    int arr[3] = {1, 2, 3};

    // 数组名 arr 可视为指向首元素的常量指针
    cout << "arr = " << arr << endl;         // 首地址
    cout << "&arr[0] = " << &arr[0] << endl; // 同首地址
    cout << "a[i] == *(a+i): " << (arr[1] == *(arr + 1)) << endl;  // 1（相等）

    // 数组名不可被赋值（不是真正的变量指针）
    // arr = &arr[1];  // 错误！

    // 但可以用指针指向数组并移动
    int *p = arr;
    p++;   // 合法，指针可以移动
    cout << "*p = " << *p << endl;  // 2
    return 0;
}
```

#### 4.2 指针作为函数参数（传数组）

```cpp
#include <iostream>
using namespace std;

// 数组参数退化为指针，需要同时传大小
int sumArray(int arr[], int size) {
    int sum = 0;
    for (int i = 0; i < size; i++) {
        sum += arr[i];
    }
    return sum;
}

// 等价写法：int *arr
int sumArrayPtr(int *arr, int size) {
    int sum = 0;
    for (int i = 0; i < size; i++) {
        sum += *(arr + i);
    }
    return sum;
}

int main() {
    int scores[] = {85, 90, 78, 92};
    cout << "总分 = " << sumArray(scores, 4) << endl;      // 345
    cout << "总分 = " << sumArrayPtr(scores, 4) << endl;   // 345
    return 0;
}
```

### 五、引用

#### 5.1 引用基础

```cpp
#include <iostream>
using namespace std;

int main() {
    int num = 10;

    // 引用：变量的别名，必须初始化且不能改绑
    int &ref = num;
    ref = 20;   // 通过引用修改原变量

    cout << "num = " << num << endl;  // 20
    cout << "ref = " << ref << endl;  // 20

    // 引用不是独立变量，修改引用就是修改原变量
    int other = 50;
    ref = other;   // 这是把 other 的值赋给 num，不是让 ref 绑定 other
    cout << "num = " << num << endl;  // 50
    return 0;
}
```

#### 5.2 指针 vs 引用

| 维度 | 指针 | 引用 |
| --- | --- | --- |
| 定义 | 存储地址的变量 | 变量的别名 |
| 初始化 | 可以不初始化（野指针） | 必须初始化 |
| 重新绑定 | 可以指向其他对象 | 不可改变 |
| 空值 | 可以为 nullptr | 不能为空 |
| 语法 | 需要 * 解引用 | 直接使用 |
| 适用 | 动态分配、可选对象、数组遍历 | 函数参数、运算符重载 |

### 六、const 限定

#### 6.1 顶层 const 与底层 const

```cpp
#include <iostream>
using namespace std;

int main() {
    int num = 10;

    // 顶层 const：指针本身不可变
    int *const pTop = &num;   // pTop 不能指向别处
    *pTop = 20;               // 但可以修改指向的值
    cout << "num = " << num << endl;  // 20

    // 底层 const：指向的对象不可变
    const int *pLow = &num;   // 不能通过 pLow 修改值
    // *pLow = 30;            // 错误！
    pLow = nullptr;           // 但 pLow 可以指向别处

    // 同时 const
    const int *const pBoth = &num;
    // pBoth = nullptr;       // 错误！
    // *pBoth = 30;           // 错误！
    return 0;
}
```

#### 6.2 const 指针传参惯例

```cpp
#include <iostream>
using namespace std;

// const int* 表示只读访问，不修改数组
void printArray(const int arr[], int size) {
    for (int i = 0; i < size; i++) {
        cout << arr[i] << " ";
    }
    cout << endl;
    // arr[0] = 99;  // 错误！const 数组不可修改
}

int main() {
    int data[] = {1, 2, 3, 4};
    printArray(data, 4);  // 1 2 3 4
    return 0;
}
```

### 七、实战：字符串反转与回文判断

综合本篇知识，实现字符串处理和回文判断：

```cpp
#include <iostream>
#include <string>
using namespace std;

// 反转字符串（用指针实现）
void reverseStr(char *str) {
    int len = 0;
    while (str[len] != '\0') len++;   // 求长度

    char *left = str;
    char *right = str + len - 1;
    while (left < right) {
        char temp = *left;
        *left = *right;
        *right = temp;
        left++;
        right--;
    }
}

// 判断回文（用 std::string）
bool isPalindrome(const string &s) {
    int left = 0, right = s.length() - 1;
    while (left < right) {
        if (s[left] != s[right]) return false;
        left++;
        right--;
    }
    return true;
}

int main() {
    // 1. 字符数组反转
    char text[] = "HelloWorld";
    reverseStr(text);
    cout << "反转后: " << text << endl;  // dlroWolleH

    // 2. 回文判断
    string words[] = {"level", "hello", "上海自来水来自海上"};
    for (const string &w : words) {
        cout << "\"" << w << "\" " << (isPalindrome(w) ? "是回文" : "不是回文") << endl;
    }
    return 0;
}
```

运行示例：

```
反转后: dlroWolleH
"level" 是回文
"hello" 不是回文
"上海自来水来自海上" 是回文
```

### 总结

本篇讲解了数组（一维/多维/范围 for）、字符串（C 风格与 std::string）、指针基础（地址/解引用/运算/野指针）、指针与数组的关系、引用与指针的区别、const 限定（顶层/底层），并用字符串反转和回文判断串联实战。重点掌握：数组越界的危害、std::string 的常用操作、指针算术、引用与指针的选择。

下一篇将讲解**结构体、枚举与类初探**，正式进入面向对象世界，敬请期待！
