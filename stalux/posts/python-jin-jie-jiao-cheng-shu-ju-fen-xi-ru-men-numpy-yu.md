---
title: "Python进阶教程：数据分析入门（NumPy与Pandas）"
abbrlink: python-jin-jie-jiao-cheng-shu-ju-fen-xi-ru-men-numpy-yu
date: "2026-08-17 21:54:22"
categories:
    - "Python"
tags: []
desc: "本篇介绍了 NumPy 数组运算和 Pandas 的 Series、DataFrame、数据清洗、分组聚合，并用销售数据分析串联实战。下一篇将介绍Web 开发入门（Flask），敬请期待！"
---
#### 目录

-   [Python进阶教程：数据分析入门（NumPy与Pandas）](#PythonNumPyPandas_2)
-   -   [一、数据分析生态](#_6)
    -   [二、NumPy：数值计算](#NumPy_17)
    -   -   [2.1 创建数组](#21__19)
        -   [2.2 数组运算](#22__39)
    -   [三、Pandas：数据表处理](#Pandas_56)
    -   -   [3.1 Series 与 DataFrame](#31_Series__DataFrame_58)
        -   [3.2 读取与查看数据](#32__79)
        -   [3.3 数据清洗](#33__101)
        -   [3.4 分组聚合](#34__121)
    -   [四、实战：分析销售数据](#_142)
    -   [总结](#_168)

> 本文是 **Python 入门教程系列** 的第 8 篇。前面介绍了数据库操作，本篇介绍数据分析的两大核心库：**NumPy** 与 **Pandas**。

### 一、数据分析生态

Python 数据分析生态：

-   **NumPy**：科学计算基础库，提供多维数组
-   **Pandas**：数据分析利器，提供 DataFrame 数据结构
-   **Matplotlib**：数据可视化
-   **Scikit-learn**：机器学习

安装：`pip install numpy pandas matplotlib`

### 二、NumPy：数值计算

#### 2.1 创建数组

```python
import numpy as np

# 从列表创建
arr1 = np.array([1, 2, 3, 4, 5])
print(arr1, arr1.shape)  # [1 2 3 4 5] (5,)

# 二维数组
arr2 = np.array([[1, 2], [3, 4]])
print(arr2.shape)  # (2, 2)

# 常用创建方式
zeros = np.zeros((2, 3))     # 全 0
ones = np.ones((2, 2))       # 全 1
rand = np.random.rand(3)     # 随机数
range_arr = np.arange(0, 10, 2)  # [0 2 4 6 8]
```

#### 2.2 数组运算

```python
import numpy as np

a = np.array([1, 2, 3])
b = np.array([4, 5, 6])

print(a + b)          # [5 7 9] 向量化运算，无需循环
print(a * 2)          # [2 4 6]
print(a ** 2)         # [1 4 9]
print(a.mean())       # 2.0 均值
print(a.sum())        # 6 求和
print(a.max())        # 3 最大值
print(np.dot(a, b))   # 32 点积
```

### 三、Pandas：数据表处理

#### 3.1 Series 与 DataFrame

```python
import pandas as pd

# Series：一维数据（带索引）
s = pd.Series([10, 20, 30], index=["a", "b", "c"])
print(s["b"])  # 20

# DataFrame：二维表格
data = {
    "姓名": ["张三", "李四", "王五"],
    "年龄": [20, 22, 21],
    "成绩": [88.5, 92.0, 95.5],
}
df = pd.DataFrame(data)
print(df)
print(df.shape)   # (3, 3)
print(df.columns) # 列名
```

#### 3.2 读取与查看数据

```python
import pandas as pd

# 读取 CSV 文件
# df = pd.read_csv("data.csv")

# 模拟数据
df = pd.DataFrame({
    "name": ["Alice", "Bob", "Charlie", "David"],
    "age": [25, 30, 35, 40],
    "salary": [50000, 60000, 70000, 80000],
})

print(df.head())          # 前 5 行
print(df.info())          # 数据概览
print(df.describe())      # 统计描述
print(df["age"].mean())   # 某列均值 32.5
print(df[df["salary"] > 60000])  # 条件筛选
```

#### 3.3 数据清洗

```python
import pandas as pd
import numpy as np

df = pd.DataFrame({
    "name": ["Alice", None, "Charlie"],
    "age": [25, None, 35],
    "score": [88, 92, None],
})

print(df.isnull().sum())   # 查看缺失值
df = df.dropna()           # 删除含缺失值的行
df = df.fillna(0)          # 或用 0 填充缺失值

# 新增计算列
df["age_plus"] = df["age"] + 1
```

#### 3.4 分组聚合

```python
import pandas as pd

df = pd.DataFrame({
    "部门": ["技术", "技术", "市场", "市场", "市场"],
    "员工": ["A", "B", "C", "D", "E"],
    "工资": [10000, 12000, 8000, 9000, 9500],
})

# 按部门分组求平均工资
grouped = df.groupby("部门")["工资"].mean()
print(grouped)
# 市场 8833.33
# 技术 11000.00

# 多列聚合
print(df.groupby("部门").agg({"工资": ["mean", "max", "sum"]}))
```

### 四、实战：分析销售数据

```python
import pandas as pd

# 模拟一份销售数据
sales = pd.DataFrame({
    "日期": pd.date_range("2026-01-01", periods=30),
    "商品": [f"商品{i%3+1}" for i in range(30)],
    "销量": [20 + i % 7 * 5 for i in range(30)],
    "金额": [100 + i * 3 for i in range(30)],
})

print("=== 数据概览 ===")
print(sales.describe())

print("=== 各商品总销量 ===")
print(sales.groupby("商品")["销量"].sum())

print("=== 销量最高的 3 天 ===")
print(sales.nlargest(3, "销量")[["日期", "销量"]])

print("=== 总销售额 ===")
print(f"{sales["金额"].sum():.0f} 元")
```

### 总结

本篇介绍了 NumPy 数组运算和 Pandas 的 Series、DataFrame、数据清洗、分组聚合，并用销售数据分析串联实战。下一篇将介绍**Web 开发入门**（Flask），敬请期待！
