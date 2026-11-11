---
title: "C++进阶教程：文件流与字符串流"
abbrlink: c-jin-jie-jiao-cheng-wen-jian-liu-yu-zi-fu-chuan-liu
date: "2026-08-29 00:33:31"
categories:
    - "C与C++"
tags: []
desc: "1.3 读取文件1.4 打开模式| 模式 | 含义 || — | — | — || | 读模式（ifstream 默认） || | 写模式（ofstream 默认，截断） || | 追加（不截断）…"
---
> 本文是 C++ 系列教程的第 10 篇。上一篇讲解了智能指针，本篇讲解文件与流操作：fstream 文本与二进制读写、流状态检查、getline、sstream 字符串流、C++17 filesystem 入门。

### 一、文件流基础

#### 1.1 三种文件流

| 流类型 | 头文件 | 用途 |
| --- | --- | --- |
| `ifstream` | `<fstream>` | 读文件（输入流） |
| `ofstream` | `<fstream>` | 写文件（输出流） |
| `fstream` | `<fstream>` | 读写文件 |

#### 1.2 写入文件

```cpp
#include <iostream>
#include <fstream>
using namespace std;

int main() {
    // 方式一：先定义再打开
    ofstream fout;
    fout.open("test.txt");          // 默认覆盖写
    fout << "Hello, File!" << endl;
    fout << 42 << " " << 3.14 << endl;
    fout.close();                   // 记得关闭

    // 方式二：构造时打开（推荐）
    ofstream fout2("data.txt", ios::app);   // 追加模式
    fout2 << "追加一行" << endl;
    fout2.close();

    cout << "文件写入完成" << endl;
    return 0;
}
```

#### 1.3 读取文件

```cpp
#include <iostream>
#include <fstream>
#include <string>
using namespace std;

int main() {
    ifstream fin("test.txt");
    if (!fin) {                     // 检查是否成功打开
        cout << "文件打开失败！" << endl;
        return 1;
    }

    string line;
    // 逐行读取
    while (getline(fin, line)) {
        cout << line << endl;
    }
    fin.close();
    return 0;
}
```

#### 1.4 打开模式

| 模式 | 含义 |
| — | — | — |
| `ios::in` | 读模式（ifstream 默认） |
| `ios::out` | 写模式（ofstream 默认，截断） |
| `ios::app` | 追加（不截断） |
| `ios::ate` | 打开后定位到文件尾 |
| `ios::trunc` | 截断文件 |
| `ios::binary` | 二进制模式 |

### 二、流状态检查

#### 2.1 流状态标志

```cpp
#include <iostream>
#include <fstream>
using namespace std;

int main() {
    ifstream fin("不存在的文件.txt");
    if (fin.fail()) {              // 打开失败
        cout << "打开失败 (failbit)" << endl;
    }

    fin.open("test.txt");
    if (fin.good()) {              // 状态正常
        cout << "文件状态良好" << endl;
    }

    // 读取到末尾
    string s;
    while (fin >> s) { }           // 读取直到失败
    if (fin.eof()) {               // 到达文件末尾
        cout << "已读到文件�
��尾 (eofbit)" << endl;
    }
    fin.close();
    return 0;
}
```

#### 2.2 打开文件判断的两种写法

```cpp
#include <iostream>
#include <fstream>
using namespace std;

int main() {
    // 写法一：!fin
    ifstream fin1("a.txt");
    if (!fin1) {
        cout << "方式一检测到打开失败" << endl;
    }

    // 写法二：!fin.is_open()
    ifstream fin2("b.txt");
    if (!fin2.is_open()) {
        cout << "方式二检测到打开失败" << endl;
    }
    return 0;
}
```

### 三、文本读写实战

#### 3.1 学生成绩文件读写

```cpp
#include <iostream>
#include <fstream>
#include <string>
#include <vector>
using namespace std;

struct Student {
    string name;
    int score;
};

// 写入学生数据
void saveStudents(const vector<Student> &students, const string &filename) {
    ofstream fout(filename);
    for (const auto &s : students) {
        fout << s.name << " " << s.score << endl;
    }
    fout.close();
    cout << "已保存 " << students.size() << " 条记录" << endl;
}

// 读取学生数据
vector<Student> loadStudents(const string &filename) {
    vector<Student> result;
    ifstream fin(filename);
    if (!fin) {
        cout << "读取失败" << endl;
        return result;
    }
    Student s;
    while (fin >> s.name >> s.score) {   // 格式化读取
        result.push_back(s);
    }
    fin.close();
    return result;
}

int main() {
    vector<Student> students = {
        {"张三", 88}, {"李四", 92}, {"王五", 76}
    };
    saveStudents(students, "students.txt");

    auto loaded = loadStudents("students.txt");
    for (const auto &s : loaded) {
        cout << s.name << " " << s.score << "分" << endl;
    }
    return 0;
}
```

#### 3.2 读取整行与单词

```cpp
#include <iostream>
#include nclude <sstream>
#include <string>
using namespace std;

int main() {
    ofstream fout("mixed.txt");
    fout << "Alice 25 88.5" << endl;
    fout << "Bob 30 95.0" << endl;
    fout.close();

    ifstream fin("mixed.txt");
    string line;
    while (getline(fin, line)) {          // 读整行
        stringstream ss(line);            // 字符串流解析
        string name;
        int age;
        double score;
        ss >> name >> age >> score;       // 从行中提取字段
        cout << name << " " << age << "岁 " << score << "分" << endl;
    }
    return 0;
}
```

### 四、二�

�制文件读写

#### 4.1 二进制写入

```cpp
#include <iostream>
#include <fstream>
using namespace std;

struct Record {
    int id;
    char name[20];
    double salary;
};

int main() {
    Record records[] = {
        {1, "张三", 8000.5},
        {2, "李四", 9500.0},
        {3, "王五", 7500.75}
    };

    // 二进制写入
    ofstream fout("records.dat", ios::binary);
    fout.write(reinterpret_cast<char *>(records), sizeof(records));
    fout.close();
    cout << "二进制写入完成" << endl;
    return 0;
}
```

#### 4.2 二进制读取

```cpp
#include <iostream>
#include <fstream>
using namespace std;

struct Record {
    int id;
    char name[20];
    double salary;
};

int main() {
    ifstream fin("records.dat", ios::binary);
    if (!fin) {
        cout << "打开失败" << endl;
        return 1;
    }

    Record r;
    while (fin.read(reinterpret_cast<char *>(&r), sizeof(Record))) {
        cout << r.id << " " << r.name << " " << r.salary << endl;
    }
    fin.close();
    return 0;
}
```

#### 4.3 文本 vs 二进制对比

| 维度 | 文本模式 | 二进制模式 |
| --- | --- | --- |
| 可读性 | 人类可读 | 不可读 |
| 大小 | 较大 | 紧凑 |
| 精度 | 可能损失（浮点） | 精确保留 |
| 跨平台 | 换行符转换 | 按原样 |
| 适用 | 配置、日志 | 程序数据、图像 |

### 五、字符串流 sstream

#### 5.1 字符串拼接与格式化

```cpp
#include <iostream>
#include <sstream>
#include <string>
using namespace std;

int main() {
    // 字符串拼接
    stringstream ss;
    ss << "姓名: " << "张三" << ", 年龄: " << 25 << ", 分数: " << 88.5;
    string result = ss.str();      // 转为 string
    cout << result << endl;

    // 清理复用
    ss.str("");                    // 清空内容
    ss.clear();                    // 重置状态
    ss << "重新写入";
    cout << ss.str() << endl;
    return 0;
}
```

#### 5.2 字符串解析

```cpp
#include <iostream>
#include <sstream>
#include <string>
using namespace std;

int main() {
    // 解析 CSV 格式
    string csv = "Alice,25,88.5";
    stringstream ss(csv);
    string name;
    int age;
    double score;
    char comma1, comma2;

    ss >> name >> comma1 >> age >> comma2 >> score;
    cout << "解析结果: " << name << " " << age << " " << score << endl;

    // 字符串转数字
    string numStr = "3.14159";

  double pi;
    stringstream(numStr) >> pi;
    cout << "π = " << pi << endl;

    // 数字转字符串
    int value = 42;
    string valueStr;
    stringstream().swap(ss);
    ss << value;
    valueStr = ss.str();
    cout << "字符串: " << valueStr << endl;
    return 0;
}
```

#### 5.3 实用的格式化工具函数

```cpp
#include <iostream>
#include <sstream>
#include <iomanip>
using namespace std;

// 通用转换函数
template <typename T>
string toString(const T &value) {
    stringstream ss;
    ss << value;
    return ss.str();
}

template <typename T>
bool fromString(const string &str, T &value) {
    stringstream ss(str);
    return !!(ss >> value);   // 转换成功返回 true
}

int main() {
    // 格式化数字
    stringstream ss;
    ss << fixed << setprecision(2) << 3.14159;
    cout << "保留两位: " << ss.str() << endl;   // 3.14

    // 通用转换
    cout << "toString: " << toString(123) << endl;
    cout << "toString: " << toString(3.14) << endl;

    double d;
    if (fromString("99.5", d)) {
        cout << "fromString: " << d << endl;   // 99.5
    }
    return 0;
}
```

### 六、C++17 filesystem 入门

#### 6.1 路径与文件信息

```cpp
#include <iostream>
#include <filesystem>
using namespace std;
namespace fs = filesystem;    // 命名空间别名

int main() {
    // 当前路径
    cout << "当前目录: " << fs::current_path() << endl;

    // 路径拼接
    fs::path p = fs::current_path() / "test.txt";
    cout << "完整路径: " << p << endl;
    cout << "文件名: " << p.filename() << endl;
    cout << "扩展名: " << p.extension() << endl;
    cout << "父目录: " << p.parent_path() << endl;
    return 0;
}
```

#### 6.2 目录操作

```cpp
#include <iostream>
#include <filesystem>
using namespace std;
namespace fs = filesystem;

int main() {
    // 创建目录
    fs::create_directory("mydir");
    cout << "目录存在: " << fs::exists("mydir") << endl;

    // 递归创建
    fs::create_directories("a/b/c");
    cout << "递归目录存在: " << fs::exists("a/b/c") << endl;

    // 遍历目录
    cout << "mydir 内容:" << endl;
    for (const auto &entry : fs::directory_iterator("mydir")) {
        cout << "  " << entry.path().filename() << endl;
    }

    // 删除
    fs::remove("mydir");
    fs::remove_all("a");       // 递归删除
    cout << "清理完成" << endl;
    return 0;
}
``
`

### 6.3 文件大小与状态

```cpp
#include <iostream>
#include <fstream>
#include <filesystem>
using namespace std;
namespace fs = filesystem;

int main() {
    // 创建一个文件
    ofstream fout("temp.bin", ios::binary);
    fout.write("Hello Filesystem", 16);
    fout.close();

    // 查询文件状态
    fs::path p("temp.bin");
    if (fs::exists(p)) {
        cout << "文件存在" << endl;
        cout << "大小: " << fs::file_size(p) << " 字节" << endl;
        cout << "是否为文件: " << fs::is_regular_file(p) << endl;
        cout << "最后修改时间: " << fs::last_write_time(p).time_since_epoch().count() << endl;
    }
    fs::remove(p);
    return 0;
}
```

### 七、实战：配置读写器

综合本篇知识，实现配置文件读写器：

```cpp
#include <iostream>
#include <fstream>
#include <sstream>
#include <map>
#include <string>
using namespace std;

class Config {
private:
    map<string, string> data;

public:
    // 从配置文件加载
    bool load(const string &filename) {
        ifstream fin(filename);
        if (!fin) return false;
        string line;
        while (getline(fin, line)) {
            if (line.empty() || line[0] == '#') continue;   // 跳过空行和注释
            size_t pos = line.find('=');
            if (pos != string::npos) {
                string key = line.substr(0, pos);
                string value = line.substr(pos + 1);
                data[key] = value;
            }
        }
        return true;
    }

    // 保存到配置文件
    void save(const string &filename) {
        ofstream fout(filename);
        for (const auto &kv : data) {
            fout << kv.first << "=" << kv.second << endl;
        }
        cout << "配置已保存" << endl;
    }

    string get(const string &key, const string &def = "") const {
        auto it = data.find(key);
        return it != data.end() ? it->second : def;
    }

    void set(const string &key, const string &value) {
        data[key] = value;
    }
};

int main() {
    Config config;

    // 写入配置
    config.set("host", "localhost");
    config.set("port", "8080");
    config.set("timeout", "30");
    config.save("app.conf");

    // 重新读取
    Config loaded;
    if (loaded.load("app.conf")) {
        cout << "host = " << loaded.get("host") << endl;
        cout << "port = " << loaded.get("port") << endl;
        cout << "timeout = " << loaded.get("timeout") << endl;
        cout << "不存在项 = " << loaded.get("nokey", "默认值") << endl;
    }
    return 0;
}
```

### 总结

本篇讲解了文件流的三种类型与打开模式、流状态检查、文本与二进制读写、字符串流 sstream 的格式化与解析、C++17 filesystem 的路径目录操作，并用配置读写器串联实战。重点掌握：打开文件的失败检查、getline 与 >> 的区别、文本与二进制的选择、stringstream 的类型转换技巧。

至此 C++ 进阶阶段（6-10 篇）完成！下一篇将进入 **STL 阶段：容器总览与序列容器**，敬请期待！
