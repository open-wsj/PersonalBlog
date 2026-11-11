---
title: "C++STL教程：关联容器与无序容器"
abbrlink: c-stl-jiao-cheng-guan-lian-rong-qi-yu-wu-xu-rong-qi
date: "2026-08-29 00:34:27"
categories:
    - "C与C++"
tags: []
desc: "int age;// 自定义比较器（按年龄排序）people.insert({\"张三\", 30});people.insert({\"李四\", 25});people.insert({\"王五\",…"
---
> 本文是 C++ 系列教程的第 12 篇。上一篇讲解了序列容器，本篇讲解关联容器与无序容器：set/multiset、map/multimap（红黑树实现）、unordered_set/unordered_map（哈希表实现）、自定义比较器与哈希函数。

### 一、关联容器概览

#### 1.1 两类关联容器

| 类别 | 实现 | 查找复杂度 | 顺序 |
| --- | --- | --- | --- |
| 关联容器（set/map） | 红黑树 | O(log n) | 有序 |
| 无序容器（unordered_*） | 哈希表 | O(1) 平均 | 无序 |

#### 1.2 六种关联容器

| 容器 | 键唯一 | 键值对 | 有序 |
| --- | --- | --- | --- |
| set | 是 | 否 | 是 |
| multiset | 否 | 否 | 是 |
| map | 是 | 是 | 是 |
| multimap | 否 | 是 | 是 |
| unordered_set | 是 | 否 | 否 |
| unordered_map | 是 | 是 | 否 |

### 二、set 集合

#### 2.1 set 基本操作

set 存储**唯一且有序**的元素，自动去重：

```cpp
#include <iostream>
#include <set>
using namespace std;

int main() {
    set<int> s;

    // 插入（自动排序去重）
    s.insert(5);
    s.insert(3);
    s.insert(8);
    s.insert(3);       // 重复，不插入
    s.insert(1);

    // 遍历（有序）
    for (int x : s) cout << x << " ";
    cout << endl;      // 1 3 5 8

    // 查找
    auto it = s.find(5);
    if (it != s.end()) cout << "找到 5" << endl;

    // 计数（set 里只能是 0 或 1）
    cout << "3 的数量: " << s.count(3) << endl;  // 1
    cout << "9 的数量: " << s.count(9) << endl;  // 0

    // 删除
    s.erase(5);
    cout << "size = " << s.size() << endl;       // 3

    // 下界上界
    auto lb = s.lower_bound(3);    // >= 3 的第一个
    auto ub = s.upper_bound(3);    // > 3 的第一个
    cout << "lower_bound(3) = " << *lb << endl;  // 3
    cout << "upper_bound(3) = " << *ub << endl;  // 8
    return 0;
}
```

#### 2.2 multiset 允许重复

```cpp
#include <iostream>
#include <set>
using namespace std;

int main() {
    multiset<int> ms;
    ms.insert(3);
    ms.insert(1);
    ms.insert(3);    // 允许重复
    ms.insert(2);
    ms.insert(3);

    cout << "3 的数量: " << ms.count(3) << endl;  // 3

    // 删除所有 3
    ms.erase(3);
    cout << "删除后 size = " << ms.size() << endl;  // 2

    // 只删除一个
    ms.insert(3);
    ms.insert(3);
    auto it = ms.find(3);
    if (it != ms.end()) ms.erase(it);   // 只删一个
    cout
<< "3 的数量: " << ms.count(3) << endl;  // 1
    return 0;
}
```

#### 2.3 set 实战：去重排序

```cpp
#include <iostream>
#include <set>
using namespace std;

int main() {
    int numbers[] = {5, 2, 8, 2, 9, 1, 5, 8};

    // set 自动去重 + 排序
    set<int> uniqueSorted(numbers, numbers + 8);

    cout << "去重排序后: ";
    for (int x : uniqueSorted) cout << x << " ";
    cout << endl;   // 1 2 5 8 9

    // 自定义排序（降序）
    set<int, greater<int>> desc(numbers, numbers + 8);
    cout << "降序: ";
    for (int x : desc) cout << x << " ";
    cout << endl;   // 9 8 5 2 1
    return 0;
}
```

### 三、map 映射

#### 3.1 map 基本操作

map 存储**键值对**，按键自动排序：

```cpp
#include <iostream>
#include <map>
#include <string>
using namespace std;

int main() {
    map<string, int> scores;

    // 插入
    scores["张三"] = 88;          // 方式一：下标
    scores["李四"] = 92;
    scores.insert({"王五", 76});  // 方式二：insert

    // 访问
    cout << "张三: " << scores["张三"] << endl;  // 88
    cout << "size = " << scores.size() << endl; // 3

    // 遍历（按键排序）
    for (const auto &kv : scores) {
        cout << kv.first << ": " << kv.second << endl;
    }

    // 查找
    auto it = scores.find("李四");
    if (it != scores.end()) {
        cout << "找到 " << it->first << " = " << it->second << endl;
    }

    // 判断键是否存在（注意下标会创建）
    if (scores.count("赵六") == 0) {
        cout << "赵六不存在" << endl;
    }
    // scores["赵六"];  // 危险！这会插入一个默认值

    // 删除
    scores.erase("王五");
    return 0;
}
```

#### 3.2 map 的 [] 陷阱

```cpp
#include <iostream>
#include <map>
#include <string>
using namespace std;

int main() {
    map<string, int> scores;

    // [] 不存在时自动插入默认值
    cout << "赵六: " << scores["赵六"] << endl;  // 0（且已插入！）
    cout << "size = " << scores.size() << endl;  // 1

    // 正确判断存在性：用 find 或 count
    map<string, int> m = {{"a", 1}};
    if (m.find("b") == m.end()) {
        cout << "b 不存在（用 find 判断）" << endl;
    }
    return 0;
}
```

#### 3.3 multimap 一对多

```cpp
#include <iostream>
#include <map>
#include <string>
using namespace std;

int main() {
    // 一个键对应多个值

   multimap<string, string> courses;
    courses.insert({"张三", "C++"});
    courses.insert({"张三", "Python"});
    courses.insert({"李四", "Java"});

    // 统计张三的课程数
    cout << "张三的课程数: " << courses.count("张三") << endl;  // 2

    // 遍历张三的所有课程
    auto range = courses.equal_range("张三");
    for (auto it = range.first; it != range.second; it++) {
        cout << it->second << " ";
    }
    cout << endl;   // C++ Python
    return 0;
}
```

### 四、unordered_set 与 unordered_map

#### 4.1 哈希表特性

unordered 容器用**哈希表**实现，查找 O(1)（平均），但**无序**：

```cpp
#include <iostream>
#include <unordered_map>
#include <string>
using namespace std;

int main() {
    unordered_map<string, int> umap;

    // 插入
    umap["apple"] = 3;
    umap["banana"] = 5;
    umap["cherry"] = 2;

    // 查找 O(1)
    auto it = umap.find("banana");
    if (it != umap.end()) {
        cout << "banana: " << it->second << endl;  // 5
    }

    // 遍历（无序！）
    for (const auto &kv : umap) {
        cout << kv.first << ": " << kv.second << endl;
    }
    return 0;
}
```

#### 4.2 map vs unordered_map

| 维度 | map | unordered_map |
| --- | --- | --- |
| 实现 | 红黑树 | 哈希表 |
| 查找 | O(log n) | O(1) 平均 |
| 顺序 | 有序 | 无序 |
| 内存 | 较小 | 较大 |
| 适用 | 需要有序遍历 | 追求查找速度 |

#### 4.3 词频统计实战

```cpp
#include <iostream>
#include <unordered_map>
#include <sstream>
#include <string>
using namespace std;

int main() {
    string text = "the quick brown fox jumps over the lazy dog the fox";

    unordered_map<string, int> freq;
    stringstream ss(text);
    string word;

    // 统计每个单词出现次数
    while (ss >> word) {
        freq[word]++;
    }

    // 输出词频
    for (const auto &kv : freq) {
        cout << kv.first << ": " << kv.second << endl;
    }

    // 查询
    cout << "\"the\" 出现次数: " << freq["the"] << endl;  // 3
    return 0;
}
```

### 五、自定义比较器与哈希

#### 5.1 set/map 自定义排序

```cpp
#include <iostream>
#include <set>
#include <string>
using namespace std;

struct Person {
    string name;
    int age;
};

// 自定义比较器（按年龄排序）
struct CompareByAge {
    bool operator()(const Person &a, const Person &b) const {

 return a.age < b.age;
    }
};

int main() {
    set<Person, CompareByAge> people;

    people.insert({"张三", 30});
    people.insert({"李四", 25});
    people.insert({"王五", 35});

    // 按年龄升序遍历
    for (const auto &p : people) {
        cout << p.name << " " << p.age << "岁" << endl;
    }
    return 0;
}
```

#### 5.2 unordered_map 自定义哈希

```cpp
#include <iostream>
#include <unordered_map>
#include <string>
using namespace std;

struct Point {
    int x, y;

    // 必须实现 == 运算符
    bool operator==(const Point &other) const {
        return x == other.x && y == other.y;
    }
};

// 自定义哈希函数
struct PointHash {
    size_t operator()(const Point &p) const {
        return hash<int>()(p.x) ^ (hash<int>()(p.y) << 1);
    }
};

int main() {
    unordered_map<Point, string, PointHash> points;

    points[{1, 2}] = "A";
    points[{3, 4}] = "B";
    points[{1, 2}] = "C";   // 覆盖

    cout << "({1,2}) = " << points[{1, 2}] << endl;  // C
    cout << "({3,4}) = " << points[{3, 4}] << endl;  // B
    return 0;
}
```

### 六、实战：成绩管理系统

综合本篇知识，实现基于 map 的成绩管理：

```cpp
#include <iostream>
#include <map>
#include <unordered_map>
#include <string>
using namespace std;

class ScoreSystem {
private:
    map<string, int> scores;              // 有序：用于排名展示
    unordered_map<string, string> classes; // 快速查找班级

public:
    void addStudent(const string &name, const string &cls, int score) {
        scores[name] = score;
        classes[name] = cls;
    }

    void showAll() const {
        cout << "===== 成绩表（按姓名排序） =====" << endl;
        for (const auto &kv : scores) {
            cout << kv.first << " " << classes.at(kv.first)
                 << "班 " << kv.second << "分" << endl;
        }
    }

    void showTop(int n = 3) const {
        cout << "===== 前 " << n << " 名 =====" << endl;
        // 用 multiset 按分数排序
        multimap<int, string, greater<int>> ranking;
        for (const auto &kv : scores) {
            ranking.insert({kv.second, kv.first});
        }
        int count = 0;
        for (const auto &kv : ranking) {
            if (count++ >= n) break;
            cout << kv.second << " " << kv.first << "分" << endl;
        }
    }

    void query(const string &name) const {

   auto it = scores.find(name);
        if (it != scores.end()) {
            cout << name << " " << classes.at(name)
                 << "班 " << it->second << "分" << endl;
        } else {
            cout << name << " 不存在" << endl;
        }
    }
};

int main() {
    ScoreSystem sys;
    sys.addStudent("张三", "三", 88);
    sys.addStudent("李四", "一", 95);
    sys.addStudent("王五", "二", 76);
    sys.addStudent("赵六", "三", 91);

    sys.showAll();
    sys.showTop(3);
    sys.query("李四");
    return 0;
}
```

### 总结

本篇讲解了关联容器（set/multiset、map/multimap）与无序容器（unordered_set/unordered_map）的差异、map 的 [] 陷阱、自定义比较器与哈希函数，并用成绩管理系统串联实战。重点掌握：set/map 的有序特性、unordered 容器的 O(1) 查找、count vs find 判断存在性、自定义哈希的写法。

下一篇将讲解**迭代器与算法库**（sort/find/transform/accumulate 等），敬请期待！
