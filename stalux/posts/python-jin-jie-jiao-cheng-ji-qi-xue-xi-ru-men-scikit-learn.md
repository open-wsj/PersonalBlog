---
title: "Python进阶教程：机器学习入门（Scikit-learn）"
abbrlink: python-jin-jie-jiao-cheng-ji-qi-xue-xi-ru-men-scikit-learn
date: "2026-08-24 02:24:54"
categories:
    - "Python"
tags: []
desc: "本篇介绍了机器学习的基本流程、分类/回归/聚类三大经典任务、交叉验证和特征工程，并用鸢尾花数据集跑通了完整实战。机器学习重在实践，建议用 UCI 或 Kaggle 的数据集多做练习。"
---
#### 目录

-   [Python进阶教程：机器学习入门（Scikit-learn）](#PythonScikitlearn_2)
-   -   [一、机器学习是什么](#_6)
    -   [二、机器学习基本流程](#_16)
    -   [三、第一个分类模型](#_24)
    -   [四、线性回归](#_54)
    -   [五、模型评估与交叉验证](#_77)
    -   [六、K-Means 聚类](#KMeans__93)
    -   [七、特征工程要点](#_118)
    -   [八、实战：预测鲜花品种](#_139)
    -   [总结](#_166)

> 本文是 **Python 入门教程系列** 的第 17 篇（扩展篇）。前面第 8 篇介绍了数据分析，本篇进入**机器学习**入门，使用最流行的 Scikit-learn 库。

### 一、机器学习是什么

机器学习让计算机**从数据中自动学习规律**并做出预测，主要分三类：

-   **监督学习**：有标注数据（分类、回归）
-   **无监督学习**：无标注数据（聚类、降维）
-   **强化学习**：通过奖励学习策略

安装：`pip install scikit-learn matplotlib`

### 二、机器学习基本流程

1.  准备数据（特征 + 标签）
2.  划分训练集和测试集
3.  训练模型
4.  评估模型
5.  预测新数据

### 三、第一个分类模型

```python
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score

# 1. 加载鸢尾花数据集
iris = load_iris()
X, y = iris.data, iris.target

# 2. 划分训练集/测试集
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, random_state=42
)

# 3. 训练模型
model = DecisionTreeClassifier(max_depth=3)
model.fit(X_train, y_train)

# 4. 评估
y_pred = model.predict(X_test)
print(f"准确率：{accuracy_score(y_test, y_pred):.2f}")

# 5. 预测新样本
new_sample = [[5.1, 3.5, 1.4, 0.2]]
print(f"预测类别：{iris.target_names[model.predict(new_sample)[0]]}")
```

### 四、线性回归

```python
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error
import numpy as np

# 模拟数据：房价与面积
np.random.seed(42)
X = np.random.rand(200, 1) * 100  # 面积 0-100
y = 3 * X[:, 0] + 10 + np.random.randn(200) * 5  # 房价

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

model = LinearRegression()
model.fit(X_train, y_train)

print(f"斜率：{model.coef_[0]:.2f}，截距：{model.intercept_:.2f}")
y_pred = model.predict(X_test)
print(f"均方误差：{mean_squared_error(y_test, y_pred):.2f}")
```

### 五、模型评估与交叉验证

```python
from sklearn.datasets import load_iris
from sklearn.model_selection import cross_val_score
from sklearn.svm import SVC

iris = load_iris()
model = SVC(kernel='linear', C=1.0)

# 5 折交叉验证
scores = cross_val_score(model, iris.data, iris.target, cv=5)
print(f"每折准确率：{scores}")
print(f"平均准确率：{scores.mean():.3f}")
```

### 六、K-Means 聚类

```python
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs
import matplotlib.pyplot as plt

# 生成聚类数据
X, _ = make_blobs(n_samples=300, centers=4, random_state=42)

# K-Means 聚类
kmeans = KMeans(n_clusters=4, random_state=42)
kmeans.fit(X)

# 查看聚类中心
print(f"聚类中心：
{kmeans.cluster_centers_}")
print(f"样本所属簇：{kmeans.labels_[:10]}")

# 可视化（可选）
# plt.scatter(X[:, 0], X[:, 1], c=kmeans.labels_)
# plt.scatter(kmeans.cluster_centers_[:, 0], kmeans.cluster_centers_[:, 1], marker="*", s=200, c="red")
# plt.show()
```

### 七、特征工程要点

好的特征比复杂模型更重要：

```python
from sklearn.preprocessing import StandardScaler, OneHotEncoder
import numpy as np

# 特征缩放（对距离敏感的算法很重要）
X = np.array([[1, 1000], [2, 2000], [3, 3000]])
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
print(X_scaled)

# 类别特征独热编码
from sklearn.preprocessing import LabelEncoder
colors = ["红", "绿", "蓝", "绿", "红"]
encoder = LabelEncoder()
print(encoder.fit_transform(colors))  # [0 1 2 1 0]
```

### 八、实战：预测鲜花品种

```python
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report

# 数据准备
iris = load_iris()
X_train, X_test, y_train, y_test = train_test_split(
    iris.data, iris.target, test_size=0.3, random_state=42
)

# 随机森林（比单棵树更稳）
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

# 评估
y_pred = model.predict(X_test)
print(classification_report(y_test, y_pred, target_names=iris.target_names))

# 特征重要性
for name, imp in zip(iris.feature_names, model.feature_importances_):
    print(f"{name}: {imp:.3f}")
```

### 总结

本篇介绍了机器学习的基本流程、分类/回归/聚类三大经典任务、交叉验证和特征工程，并用鸢尾花数据集跑通了完整实战。机器学习重在实践，建议用 UCI 或 Kaggle 的数据集多做练习。
