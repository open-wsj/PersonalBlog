---
title: "机器学习笔记：集成方法（随机森林与 XGBoost）"
abbrlink: ji-qi-xue-xi-bi-ji-shu-ji-cheng-fang-fa
date: "2026-11-17 20:40:00"
categories:
    - "机器学习"
tags: ["随机森林", "XGBoost", "集成学习", "机器学习"]
desc: "单棵决策树方差大、一改数据就面目全非。集成方法用「多棵树投票」解决这个问题：Bagging 和随机森林靠并行平均降方差，Boosting 和 XGBoost 靠串行纠错降偏差。这篇讲清两者的机制、参数和适用场景。"
---

> 机器学习笔记的第十一篇。上一篇的结论是：单棵树最大的问题是**方差大**——删掉一个样本，整棵树的结构可能完全变了。集成方法就是围绕这个问题展开的，但两条路线方向相反：一条并行、一条串行；一条降方差、一条降偏差。

### 一、为什么要用多棵树

一棵树的问题可以量化为：在略有不同的训练集上训练出的两棵树，预测可能差很多。假设有 $M$ 棵树，每棵的预测误差方差为 $\sigma^2$，两两相关系数为 $\rho$，那么**平均预测**的方差是：

$$
\text{Var}\left(\frac{1}{M}\sum_{i=1}^{M} f_i\right)
= \rho\sigma^2 + \frac{1-\rho}{M}\sigma^2
$$

这个式子说明了全部要点：

-   $M$ 增大时，第二项趋于 0——**树越多，平均越稳**；
-   但第一项 $\rho\sigma^2$ 消不掉，它来自树之间的**相关性**；
-   所以光增加树的数量不够，还要**降低树之间的相关性**。

随机森林的两个随机性，正是分别对应这两项：Bootstrap 抽样让每棵树看到不同数据（降 $\rho$），特征随机子集进一步打散相关性（继续降 $\rho$）。

### 二、有放回抽样（Bootstrap）

从 $N$ 个样本中有放回地随机抽 $N$ 次，得到一个大小相同但内容不同的训练集。这个操作叫 bootstrap 抽样。

几个有意思的性质：

**1. 大约 63.2% 的样本会被抽到**

某个样本一次都没被抽中的概率是 $(1 - 1/N)^N$，当 $N$ 很大时趋近于

$$
\lim_{N\to\infty}\left(1-\frac{1}{N}\right)^N = e^{-1} \approx 0.368
$$

所以每个 bootstrap 样本里约含 **63.2% 的原始样本**，剩下的 36.8% 没出现。

**2. 这个性质被用来做袋外评估（OOB）**

对每棵树而言，没被它抽到的样本就是它「没见过」的。用这些样本评估该树，再把所有树的 OOB 结果汇总，就得到了一个**几乎免费**的验证集——不需要额外划分数据。这在数据少的时候很有用。

**3. 为什么有放回**

必须允许重复，否则每棵树看到的都是同一批数据的不同排列，树的结构会高度相似。有放回才能让不同树看到真正不同的子集。

### 三、随机森林

随机森林 = Bagging + 决策树 + **特征随机子集**。

每次节点分裂时，不是从全部 $d$ 个特征里选最优，而是先随机抽 $m$ 个候选（通常 $m = \sqrt{d}$，分类问题默认），再从中选最好的。这也是「随机」二字的来源。

#### 两个随机性

| 随机性 | 作用 |
| --- | --- |
| 样本 bootstrap | 每棵树用不同训练子集 |
| 特征子集（每次分裂） | 防止强特征主导所有树，进一步降低相关性 |

第二点很重要。假如有一个极强的特征，不加特征随机的话，每棵树的根节点都会用它，树们就长得差不多，$\rho$ 接近 1，平均也没用。

#### 关键参数

```python
from sklearn.datasets import load_breast_cancer
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

X, y = load_breast_cancer(return_X_y=True)
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

rf = RandomForestClassifier(
    n_estimators=300,          # 树的数量，越多越稳，但有边际递减
    max_depth=None,            # 单棵树可以长深一些，靠平均来控制方差
    max_features="sqrt",       # 每次分裂的候选特征数
    min_samples_leaf=1,
    oob_score=True,            # 用袋外样本估计泛化能力
    n_jobs=-1,
    random_state=0,
)
rf.fit(X_tr, y_tr)

print("OOB 分数:", round(rf.oob_score_, 4))
print("测试 AUC:", round(roc_auc_score(y_te, rf.predict_proba(X_te)[:, 1]), 4))
```

几个调参直觉：

-   `n_estimators` 越大越好但边际递减，300~500 通常够；再大只是变慢。
-   **随机森林里的单棵树可以长得很深**，方差由平均来解决，不需要像单树那样严格剪枝。当然 `min_samples_leaf` 稍大一点仍然有益。
-   `max_features` 是最重要的参数：越小，树越不相关（降方差），但单棵树越弱。分类常用 `sqrt`，回归常用 $d/3$。
-   不需要特征缩放，也不需要标准化。

#### 特征重要性

随机森林能给出特征重要性，但要注意它有**偏向**：倾向于给取值多的连续特征更高的分数。更可靠的做法是置换重要性（permutation importance）——打乱某列后看指标掉多少：

```python
from sklearn.inspection import permutation_importance

result = permutation_importance(rf, X_te, y_te, n_repeats=10, random_state=0)
for i in result.importances_mean.argsort()[::-1][:5]:
    print(f"{i:2d} {result.importances_mean[i]:.4f} ± {result.importances_std[i]:.4f}")
```

置换重要性在**测试集**上算，衡量的是「这个特征对泛化贡献多少」，比内置的 `feature_importances_` 更可信。

### 四、Boosting 与 XGBoost

随机森林是**并行**的：每棵树独立训练，互不依赖，最后投票。Boosting 完全相反——**串行**，每棵新树专门去修正前面所有树的错误。

#### 从残差拟合理解 Boosting

设当前模型是 $F_{t-1}(x)$，新加的树 $h_t$ 要让整体更好：

$$
F_t(x) = F_{t-1}(x) + \eta\, h_t(x)
$$

其中 $\eta$ 是学习率（shrinkage）。$h_t$ 训练的目标是当前模型的**残差** $y - F_{t-1}(x)$。每轮都在补上一轮的不足，所以 Boosting 主要降低**偏差**。

用一句话对比：

| | Bagging / 随机森林 | Boosting / XGBoost |
| --- | --- | --- |
| 训练方式 | 并行、互相独立 | 串行、依赖前一轮 |
| 每棵树 | 深树（低偏差、高方差） | 浅树（深度 3~8） |
| 主要降低 | **方差** | **偏差** |
| 学习率 | 无 | 有，控制每棵树的贡献 |
| 过拟合方式 | 树太多通常不会（有上限） | 树太多、学习率太大都会过拟合 |

#### XGBoost 做了什么改进

XGBoost 不是「第一个 Boosting」，它的价值在于工程和数学上的几处关键设计：

**1. 二阶泰勒展开**

传统 GBDT 只用一阶梯度（残差近似），XGBoost 同时用一阶和二阶导：

$$
\mathcal{L}^{(t)} \approx \sum_i \left[ g_i f_t(x_i) + \frac{1}{2}h_i f_t^2(x_i) \right] + \Omega(f_t)
$$

$g_i = \partial_{\hat y}\ell$，$h_i = \partial^2_{\hat y}\ell$。二阶信息让每步的步长更准，收敛更快。

**2. 显式正则化**

$$
\Omega(f) = \gamma T + \frac{1}{2}\lambda\sum_{j=1}^{T} w_j^2
$$

$T$ 是叶子数，$w_j$ 是叶子权重。这相当于把树的复杂度直接写进目标函数，比单纯的「限制深度」更精细。

**3. 分裂增益的解析形式**

$$
\text{Gain} = \frac{1}{2}\left[\frac{G_L^2}{H_L+\lambda} + \frac{G_R^2}{H_R+\lambda} - \frac{(G_L+G_R)^2}{H_L+H_R+\lambda}\right] - \gamma
$$

$G$、$H$ 分别是叶子内的一阶、二阶导之和。$\gamma$ 相当于一个「分裂门槛」：增益不够就不分裂，天然做预剪枝。

**4. 工程优化**

列块存储、近似分位点分裂、稀疏感知（缺失值自动学默认方向）、并行找分裂点、缓存优化。这些让它在实际数据上比传统 GBDT 快很多。

#### 关键参数

```python
from xgboost import XGBClassifier

model = XGBClassifier(
    n_estimators=1000,
    learning_rate=0.05,      # 常用 0.01~0.1，越小需要越多树
    max_depth=6,             # 3~8，越深越容易过拟合
    min_child_weight=1,      # 叶子内最小二阶导和，类似 min_samples_leaf
    subsample=0.8,           # 行采样，增加随机性
    colsample_bytree=0.8,    # 列采样
    reg_lambda=1.0,          # L2 正则（叶子权重）
    reg_alpha=0.0,           # L1 正则
    gamma=0.0,               # 分裂门槛
    objective="binary:logistic",
    eval_metric="auc",
    early_stopping_rounds=50,
    tree_method="hist",      # 大数据用直方图加速
    n_jobs=-1,
    random_state=0,
)
model.fit(X_tr, y_tr, eval_set=[(X_te, y_te)], verbose=False)
print("最佳迭代轮数:", model.best_iteration)
```

调参的优先顺序（按影响从大到小）：

1.  `learning_rate` 与 `n_estimators` 一起调（小学习率 + 多树几乎总是更好，只是慢）；
2.  `max_depth` / `min_child_weight` 控制单树复杂度；
3.  `subsample` / `colsample_bytree` 增加随机性、抗过拟合；
4.  `reg_lambda` / `reg_alpha` / `gamma` 做最后微调。

**LightGBM 与 CatBoost** 是同类工具的不同工程取舍：LightGBM 用 leaf-wise 生长和直方图，更快更省内存（小数据要限制 `num_leaves` 防止过拟合）；CatBoost 原生支持类别特征、用 ordered boosting 减少目标泄漏。算法内核仍是梯度提升。

### 五、随机森林 vs XGBoost：怎么选

| 维度 | 随机森林 | XGBoost |
| --- | --- | --- |
| 默认效果 | 好，几乎不用调 | 更好，但需要调 |
| 训练速度 | 并行，快 | 串行，慢一些（但工程优化好） |
| 过拟合风险 | 低（树多也不会明显过拟合） | 中（需早停和正则） |
| 小数据 | 稳 | 容易过拟合，要保守调参 |
| 大数据 | 可以，但不如 GBDT 高效 | 更好 |
| 可解释性 | 中等（特征重要性） | 中等（可用 SHAP） |
| 缺失值 | 需自己处理（新版本有限支持） | 原生支持 |
| 调参成本 | 低 | 高 |

一个实用的决策顺序：

1.  **先跑随机森林**：几乎不用调参就能给出一个不错的基线，用来判断「这批特征能到这个水平」。
2.  **再跑 XGBoost/LightGBM**：如果随机森林效果不够，用 boosting 通常能再提升几个点。
3.  **最后比一次线性模型**：如果逻辑回归/线性回归和它们差距很小，说明问题基本是线性的，用简单模型更划算。

### 六、何时使用决策树与树集成

树模型不是万能的。它的适用边界很清楚：

#### 适合的场景

-   **结构化表格数据**：这是树集成的主场。Kaggle 表格竞赛的获奖方案绝大多数是 GBDT 的变体。
-   **特征类型混杂**（数值 + 类别），且不需要复杂预处理。
-   **需要可解释性**：单树能打印规则，树集成的特征重要性/SHAP 也能给出归因。
-   **特征交互重要、但关系非线性且非平滑**：比如「年龄 > 30 且 收入 < 5000」这种阈值型规则。
-   **样本量中等（几千到几百万）**，特征维度中等。

#### 不太适合的场景

| 场景 | 原因 | 替代方案 |
| --- | --- | --- |
| 图像、音频、原始文本 | 树无法利用局部性和平移不变性 | CNN / Transformer |
| 高维稀疏（TF-IDF 几万维） | 每次分裂只用一个特征，效率低 | 线性模型 + 正则 |
| 强线性关系 | 只能用阶梯逼近，需要很多分裂 | 线性/逻辑回归 |
| 需要平滑外推 | 树不能预测训练范围外的值（回归输出是叶子均值） | 线性模型、时间序列模型 |
| 极小样本（<100） | 方差大，容易过拟合 | 简单模型 + 强正则 |
| 需要极低延迟 | 树集成推理慢于单个线性模型 | 蒸馏、线性模型 |

一句话总结：**表格数据优先树集成，感知类数据（图像/语音/文本）优先神经网络**。这个分工在过去几年相当稳定。

### 七、几个实践中的坑

**1. 随机森林不需要深度剪枝，但也不是完全不用调**

单棵树要严格剪枝，随机森林里单树可以长深。但 `max_features` 和 `min_samples_leaf` 仍然显著影响效果，尤其在信噪比低的数据上。

**2. Boosting 不用早停**

`n_estimators` 设成 1000 又不开早停，等于让模型在验证集上一直过拟合。早停是这个家族最重要的正则化手段，必须用。

**3. 学习率和树数量没有一起考虑**

`learning_rate=0.1` 配 `n_estimators=50` 和配 `500` 是完全不同的模型。调参时应该固定一个较小的学习率（0.05 左右），让早停决定树的数量。

**4. 用默认的 `feature_importances_` 下结论**

基于不纯度的内置重要性偏向高基数特征，且是在训练集上算的。要解释模型，用置换重要性或 SHAP，并且在验证/测试集上算。

**5. 树模型做外推**

回归树输出的是训练样本目标值的均值，**永远落在训练集的标签范围内**。要预测趋势（比如未来销量会涨到历史最高值以上），树模型无能为力。

**6. 以为树模型不需要处理类别特征**

sklearn 的树要求输入是数值，类别必须独热或有序编码。LightGBM/CatBoost 有原生支持，但编码方式仍然影响效果。

**7. 忽略数据泄漏**

树模型对泄漏特别敏感：一个泄漏特征会出现在每棵树的根节点，效果看起来极好，上线立刻失效。看到 GBDT 的 CV 分数高得离谱，先查特征。

**8. 用单棵树的思维解释集成**

「第 3 棵树为什么会这样分」没有意义。集成的解释要看整体（SHAP 值、部分依赖图），而不是逐棵树。

### 总结

-   单树方差大；集成通过平均或串行纠错来改善，$M$ 棵树平均后方差降为 $\rho\sigma^2 + \frac{1-\rho}{M}\sigma^2$。
-   Bootstrap 有放回抽样，约 63.2% 样本被抽中，剩余样本构成免费的 OOB 验证集。
-   随机森林 = Bagging + 树 + 特征随机子集，两个随机性共同降低树间相关性，主要**降方差**，几乎不用调参。
-   Boosting 串行拟合残差，主要**降偏差**；XGBoost 用二阶泰勒展开、显式正则化和工程优化把它做得又快又准。
-   关键参数：随机森林看 `n_estimators` 和 `max_features`；XGBoost 看 `learning_rate` + 早停 + `max_depth`。
-   表格数据优先树集成（随机森林做基线、XGBoost 冲效果），感知类数据优先神经网络。
-   树集成不能外推、对高维稀疏不友好、无法利用空间结构，这是它的边界。

下一篇准备写无监督学习里的聚类（K-Means 与层次聚类）。
