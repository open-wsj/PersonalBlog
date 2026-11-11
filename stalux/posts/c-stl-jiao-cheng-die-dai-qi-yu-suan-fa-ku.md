---
title: "C++STL教程：迭代器与算法库"
abbrlink: c-stl-jiao-cheng-die-dai-qi-yu-suan-fa-ku
date: "2026-08-29 00:34:50"
categories:
    - "C与C++"
tags: []
desc: "迭代器是统一访问容器元素的接口，让算法不关心容器类型。可以把迭代器理解为「智能指针」，支持->++--等操作。int score;// 默认升序// 降序int());//…"
---
> 本文是 C++ 系列教程的第 13 篇。上一篇讲解了关联容器与无序容器，本篇讲解迭代器与算法库：迭代器五类与分类、常用算法（sort/find/find_if/count/copy/transform/accumulate/reverse/unique）、删除-擦除惯用法。

### 一、迭代器基础

#### 1.1 什么是迭代器

迭代器是**统一访问容器元素**的接口，让算法不关心容器类型。可以把迭代器理解为「智能指针」，支持 `*`、`->`、`++`、`--` 等操作。

#### 1.2 迭代器分类

| 类别 | 支持操作 | 可用容器 |
| --- | --- | --- |
| 输入迭代器 | 只读、++ | istream |
| 输出迭代器 | 只写、++ | ostream |
| 前向迭代器 | 读写、++ | forward_list |
| 双向迭代器 | 读写、++/– | list, set, map |
| 随机访问迭代器 | 读写、±/[] | vector, deque, array |

#### 1.3 常用迭代器操作

```cpp
#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> v = {10, 20, 30, 40, 50};

    // begin/end
    cout << "正向遍历: ";
    for (auto it = v.begin(); it != v.end(); it++) {
        cout << *it << " ";
    }
    cout << endl;

    // rbegin/rend（反向）
    cout << "反向遍历: ";
    for (auto it = v.rbegin(); it != v.rend(); it++) {
        cout << *it << " ";
    }
    cout << endl;

    // cbegin/cend（const 迭代器）
    auto cit = v.cbegin();
    cout << "首个元素: " << *cit << endl;
    // *cit = 99;   // 错误！const 迭代器不可修改

    // 随机访问
    auto it = v.begin();
    cout << "*(it+2) = " << *(it + 2) << endl;  // 30
    cout << "it[3] = " << it[3] << endl;        // 40
    it += 4;
    cout << "it[0] = " << it[0] << endl;        // 50
    return 0;
}
```

#### 1.4 迭代器失效规则

| 操作 | vector/deque | list/set/map |
| --- | --- | --- |
| 插入 | 可能全部失效（扩容） | 其他迭代器不受彲响 |
| 删除 | 被删元素之后的失效 | 只影响被删元素 |
| 注意 | 删除后迭代器悬垂 | 相对安全 |

### 二、查找与统计算法

#### 2.1 find 与 find_if

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> v = {5, 2, 8, 1, 9, 3};

    // find：查找指定值，返回迭代器
    auto it = find(v.begin(), v.end(), 8);
    if (it != v.end()) {
        cout << "找到 8，位置: " << (it - v.begin()) << end
l;
    } else {
        cout << "未找到" << endl;
    }

    // find_if：按条件查找
    auto it2 = find_if(v.begin(), v.end(),
        [](int x) { return x > 5; });   // 第一个 >5 的元素
    if (it2 != v.end()) {
        cout << "第一个 >5 的元素: " << *it2 << endl;  // 8
    }
    return 0;
}
```

#### 2.2 count 与 count_if

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> v = {1, 2, 3, 1, 4, 1, 5};

    // count：统计指定值出现次数
    cout << "1 出现: " << count(v.begin(), v.end(), 1) << " 次" << endl;  // 3

    // count_if：按条件统计
    cout << "偶数个数: " << count_if(v.begin(), v.end(),
        [](int x) { return x % 2 == 0; }) << endl;   // 2

    // 判断是否全部满足
    bool allPositive = all_of(v.begin(), v.end(),
        [](int x) { return x > 0; });
    cout << "全部为正数: " << allPositive << endl;   // 1

    // 判断是否存在满足条件
    bool anyBig = any_of(v.begin(), v.end(),
        [](int x) { return x > 4; });
    cout << "存在大于 4: " << anyBig << endl;         // 1
    return 0;
}
```

### 三、排序与排列算法

#### 3.1 sort 与自定义排序

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

struct Student {
    string name;
    int score;
};

int main() {
    vector<int> v = {3, 1, 4, 1, 5, 9};

    // 默认升序
    sort(v.begin(), v.end());
    for (int x : v) cout << x << " ";
    cout << endl;   // 1 1 3 4 5 9

    // 降序
    sort(v.begin(), v.end(), greater<int>());
    for (int x : v) cout << x << " ";
    cout << endl;   // 9 5 4 3 1 1

    // 结构体自定义排序
    vector<Student> students = {
        {"张三", 88}, {"李四", 92}, {"王五", 76}
    };
    // 按分数降序
    sort(students.begin(), students.end(),
        [](const Student &a, const Student &b) {
            return a.score > b.score;
        });
    for (const auto &s : students) {
        cout << s.name << " " << s.score << endl;
    }
    return 0;
}
```

#### 3.2 stable_sort 与 partial_sort

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    // stable_sort：相等元素保持原顺序
    vector<pair<int, int>> v = {{1, 5}, {2, 3}, {1, 7}, {2, 1}};
    stable_sort(v.begin(), v.end(),
        [](const auto &a
, const auto &b) { return a.first < b.first; });
    // 相同 first 的元素保持相对顺序：(1,5) 在 (1,7) 前
    for (const auto &p : v) {
        cout << "(" << p.first << "," << p.second << ") ";
    }
    cout << endl;

    // partial_sort：只保证前 n 个是最小的
    vector<int> nums = {5, 2, 8, 1, 9, 3, 7};
    partial_sort(nums.begin(), nums.begin() + 3, nums.end());
    cout << "前 3 个最小: ";
    for (int i = 0; i < 3; i++) cout << nums[i] << " ";
    cout << endl;   // 1 2 3
    return 0;
}
```

#### 3.3 nth_element 与 reverse

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    // nth_element：第 n 个位置是正确排序值，左侧都小右侧都大
    vector<int> v = {7, 2, 9, 1, 5, 3, 8};
    nth_element(v.begin(), v.begin() + 3, v.end());
    cout << "第 4 小的元素: " << v[3] << endl;  // 5

    // reverse：反转
    vector<int> r = {1, 2, 3, 4, 5};
    reverse(r.begin(), r.end());
    for (int x : r) cout << x << " ";
    cout << endl;   // 5 4 3 2 1

    // rotate：旋转
    vector<int> rot = {1, 2, 3, 4, 5};
    rotate(rot.begin(), rot.begin() + 2, rot.end());
    for (int x : rot) cout << x << " ";
    cout << endl;   // 3 4 5 1 2
    return 0;
}
```

### 四、复制与变换算法

#### 4.1 copy 与 copy_if

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> src = {1, 2, 3, 4, 5};

    // copy：整段复制
    vector<int> dest(src.size());
    copy(src.begin(), src.end(), dest.begin());
    for (int x : dest) cout << x << " ";
    cout << endl;   // 1 2 3 4 5

    // copy_if：按条件复制
    vector<int> evens;
    copy_if(src.begin(), src.end(), back_inserter(evens),
        [](int x) { return x % 2 == 0; });
    for (int x : evens) cout << x << " ";
    cout << endl;   // 2 4

    // back_inserter：自动扩容追加
    vector<int> more;
    copy(src.begin(), src.end(), back_inserter(more));
    cout << "more size = " << more.size() << endl;  // 5
    return 0;
}
```

#### 4.2 transform 变换

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> nums = {1, 2, 3, 4};

    // transform：一元变换（每个元素平方）
    vector<int> squares(nums.size());
    transform(nums.begin(), nums.end(), squares.begin(),

        [](int x) { return x * x; });
    for (int x : squares) cout << x << " ";
    cout << endl;   // 1 4 9 16

    // transform：二元变换（两序列对应相加）
    vector<int> a = {1, 2, 3};
    vector<int> b = {10, 20, 30};
    vector<int> sum(3);
    transform(a.begin(), a.end(), b.begin(), sum.begin(),
        [](int x, int y) { return x + y; });
    for (int x : sum) cout << x << " ";
    cout << endl;   // 11 22 33

    // 原地变换
    transform(nums.begin(), nums.end(), nums.begin(),
        [](int x) { return x * 10; });
    for (int x : nums) cout << x << " ";
    cout << endl;   // 10 20 30 40
    return 0;
}
```

### 五、数值与去重算法

#### 5.1 accumulate 与 iota

```cpp
#include <iostream>
#include <vector>
#include <numeric>
#include <algorithm>
using namespace std;

int main() {
    vector<int> v = {1, 2, 3, 4, 5};

    // accumulate：求和（初始值 0）
    int sum = accumulate(v.begin(), v.end(), 0);
    cout << "总和: " << sum << endl;   // 15

    // accumulate：自定义累加（求积）
    int product = accumulate(v.begin(), v.end(), 1,
        [](int a, int b) { return a * b; });
    cout << "乘积: " << product << endl;   // 120

    // iota：填充递增序列
    vector<int> seq(5);
    iota(seq.begin(), seq.end(), 10);   // 10 11 12 13 14
    for (int x : seq) cout << x << " ";
    cout << endl;

    // inner_product：内积
    vector<int> a = {1, 2, 3};
    vector<int> b = {4, 5, 6};
    int dot = inner_product(a.begin(), a.end(), b.begin(), 0);
    cout << "内积: " << dot << endl;    // 32
    return 0;
}
```

#### 5.2 unique 与 erase

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    // unique 只去重相邻重复，通常先排序
    vector<int> v = {1, 1, 2, 2, 3, 1, 2};

    sort(v.begin(), v.end());
    auto last = unique(v.begin(), v.end());
    // 此时 v 是 1 2 3 2 3（尾部是"垃圾"）

    // 删除-擦除惯用法：unique 返回新结尾，erase 删除尾部
    v.erase(last, v.end());
    for (int x : v) cout << x << " ";
    cout << endl;   // 1 2 3

    // 删除所有偶数（remove_if + erase 惯用法）
    vector<int> nums = {1, 2, 3, 4, 5, 6};
    nums.erase(
        remove_if(nums.begin(), nums.end(),
            [](int x) { return x % 2 == 0; }),
        nums.end());
    for (int x : nums) cout << x << " "
;
    cout << endl;   // 1 3 5
    return 0;
}
```

#### 5.3 删除-擦除惯用法详解

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> v = {1, 2, 3, 2, 4, 2, 5};

    // remove 不真正删除，只是把保留元素移到前面，返回新逻辑结尾
    auto newEnd = remove(v.begin(), v.end(), 2);
    cout << "remove 后 size 未变: " << v.size() << endl;  // 7

    // erase 真正删除尾部
    v.erase(newEnd, v.end());
    cout << "erase 后 size: " << v.size() << endl;        // 4
    for (int x : v) cout << x << " ";
    cout << endl;   // 1 3 4 5

    // 一行惯用法
    vector<int> w = {1, 2, 3, 4, 5, 6};
    w.erase(remove_if(w.begin(), w.end(),
        [](int x) { return x % 2 == 0; }), w.end());
    for (int x : w) cout << x << " ";
    cout << endl;   // 1 3 5
    return 0;
}
```

### 六、最小最大值与二分查找

#### 6.1 min/max 系列

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> v = {5, 2, 8, 1, 9};

    cout << "max: " << *max_element(v.begin(), v.end()) << endl;  // 9
    cout << "min: " << *min_element(v.begin(), v.end()) << endl;  // 1

    // minmax：同时获取
    auto result = minmax_element(v.begin(), v.end());
    cout << "min=" << *result.first << ", max=" << *result.second << endl;

    // 两个值比较
    cout << "max(3,7) = " << max(3, 7) << endl;     // 7
    cout << "min(3,7) = " << min(3, 7) << endl;     // 3

    // clamp：限制范围
    cout << "clamp(15, 0, 10) = " << clamp(15, 0, 10) << endl;  // 10
    cout << "clamp(-5, 0, 10) = " << clamp(-5, 0, 10) << endl;  // 0
    return 0;
}
```

#### 6.2 binary_search 与 lower_bound

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> v = {1, 3, 5, 7, 9, 11};

    // binary_search：二分查找（要求已排序）
    cout << "查找 5: " << binary_search(v.begin(), v.end(), 5) << endl;   // 1
    cout << "查找 6: " << binary_search(v.begin(), v.end(), 6) << endl;   // 0

    // lower_bound：第一个 >= 值的位置
    auto lb = lower_bound(v.begin(), v.end(), 6);
    cout << "lower_bound(6) = " << *lb << endl;   // 7

    // upper_bound：第一个 > 值的位置
    auto ub = upper_bound(v.begin(), v.end(), 7);
    cout << "upper_bound(7) = " <<
 *ub << endl;   // 9

    // equal_range：等于值的一整段
    vector<int> dup = {1, 2, 2, 2, 3, 4};
    auto range = equal_range(dup.begin(), dup.end(), 2);
    cout << "2 的出现次数: " << (range.second - range.first) << endl;  // 3
    return 0;
}
```

### 七、实战：文本分析工具

综合本篇全部算法，实现文本统计工具：

```cpp
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <numeric>
#include <map>
using namespace std;

class TextAnalyzer {
private:
    vector<string> words;

public:
    void addWords(const vector<string> &newWords) {
        words.insert(words.end(), newWords.begin(), newWords.end());
    }

    size_t totalCount() const {
        return words.size();
    }

    // 去重后单词种类
    size_t uniqueCount() const {
        vector<string> temp = words;
        sort(temp.begin(), temp.end());
        temp.erase(unique(temp.begin(), temp.end()), temp.end());
        return temp.size();
    }

    // 平均单词长度
    double averageLength() const {
        if (words.empty()) return 0;
        int total = accumulate(words.begin(), words.end(), 0,
            [](int sum, const string &w) { return sum + w.length(); });
        return static_cast<double>(total) / words.size();
    }

    // 最长单词
    string longestWord() const {
        return *max_element(words.begin(), words.end(),
            [](const string &a, const string &b) {
                return a.length() < b.length();
            });
    }

    // 词频统计（Top N）
    void showTopFrequent(int n = 3) const {
        map<string, int> freq;
        for (const auto &w : words) freq[w]++;

        vector<pair<string, int>> items(freq.begin(), freq.end());
        sort(items.begin(), items.end(),
            [](const auto &a, const auto &b) { return a.second > b.second; });

        cout << "===== Top " << n << " 高频词 =====" << endl;
        for (int i = 0; i < min(n, (int)items.size()); i++) {
            cout << items[i].first << ": " << items[i].second << " 次" << endl;
        }
    }
};

int main() {
    TextAnalyzer analyzer;
    analyzer.addWords({"cpp", "python", "java", "cpp", "go",
                       "python", "cpp", "rust", "java"});

    cout << "总词数: " << analyzer.totalCount() << endl;        // 9
    cout << "去重词数: " << analyzer.uniqueCount() << endl;     // 5
    cout << "平均长度: " << analyzer.averageLength() << endl;
    cout << "最长单词: " << analyzer.longestWord() << endl;
    analyzer.showTopFrequent(3);
    return 0;
}
```

### 总结

本篇讲解了迭代器的五类与失效规则、查找统计算法（find/count）、排序排列算法（sort/stable_sort/nth_element）、复制变换算法（copy/transform）、数值去重算法（accumulate/unique）、最小最大值与二分查找，并用文本分析工具串联实战。重点掌握：删除-擦除惯用法、transform 的一元/二元变换、back_inserter、二分查找的前提（有序）。

下一篇将讲解**函数对象与 Lambda 表达式**，敬请期待！
