---
title: "机器学习笔记：逻辑回归与它的代价函数"
abbrlink: ji-qi-xue-xi-bi-ji-luo-ji-hui-gui
date: "2026-11-14 23:40:00"
categories:
    - "机器学习"
tags: ["逻辑回归", "交叉熵", "损失函数", "机器学习"]
desc: "逻辑回归是最像「神经网络的一个神经元」的模型。这篇从 sigmoid 讲到交叉熵的极大似然推导，解释为什么分类不能用平方误差、梯度为什么干净得惊人，以及正则化、多分类和实践里的几个坑。"
---

> 机器学习笔记的第五篇。逻辑回归（Logistic Regression）名字里带「回归」，实际做的是分类。它简单到可以用三行公式写完，但里面藏着两个值得想清楚的问题：**为什么输出要过 sigmoid**，以及**为什么损失函数必须是交叉熵而不是平方误差**。

### 一、从线性回归到分类

线性模型给出的是任意实数：

$$
z = w^\top x + b
$$

拿它直接做二分类，最朴素的想法是设一个阈值：$z > 0$ 判为正类。问题在于：

1.  **输出没有概率含义**。$z = 3.7$ 表示「有多像正类」？无法解释，也无法和阈值配合做代价敏感决策。
2.  **对离群点极敏感**。一个远离决策边界的样本会把 $w$ 拉得很偏，决策边界跟着转，即使它早已被正确分类。
3.  **无法直接套用概率框架**。没有概率，就没法做极大似然，也就推不出一个自然的损失函数。

逻辑回归的解决办法很直接：**把 $z$ 压到 $(0,1)$，当作正类的概率**。

### 二、sigmoid：把实数压成概率

$$
\sigma(z) = \frac{1}{1 + e^{-z}}
$$

它的形状是一条 S 形曲线，几个关键性质：

| $z$ | $\sigma(z)$ | 含义 |
| --- | --- | --- |
| $-6$ | $\approx 0.0025$ | 几乎确定是负类 |
| $-2$ | $\approx 0.12$ | 偏负 |
| $0$ | $0.5$ | 完全不确定 |
| $2$ | $\approx 0.88$ | 偏正 |
| $6$ | $\approx 0.9975$ | 几乎确定是正类 |

于是模型写成：

$$
P(y=1 \mid x) = \hat{y} = \sigma(w^\top x + b), \qquad
P(y=0 \mid x) = 1 - \hat{y}
$$

**为什么偏偏是 sigmoid**，而不是别的压缩函数？一个常被忽略的理由是它和「对数几率」的关系。定义几率（odds）为 $\frac{p}{1-p}$，取对数：

$$
\log\frac{p}{1-p} = w^\top x + b
$$

即**逻辑回归假设的是「对数几率是特征的线性函数」**。这是它对数据分布的唯一假设，比「$p$ 是线性的」合理得多——后者会把 $p$ 推出 $[0,1]$。sigmoid 正是这个式子的反解：

$$
p = \frac{1}{1 + e^{-(w^\top x + b)}}
$$

所以 sigmoid 不是拍脑袋选的，它是「线性 logit」的直接结果。

顺带记住它的导数，后面推导梯度要用：

$$
\sigma'(z) = \sigma(z)\bigl(1 - \sigma(z)\bigr)
$$

这个形式极其简洁，是 sigmoid 被长期使用的重要原因之一。

### 三、决策边界

因为 $\sigma$ 单调递增，$\hat{y} > 0.5 \iff z > 0$，所以默认阈值下的决策边界是

$$
w^\top x + b = 0
$$

一个超平面。二维时是一条直线，这就是「逻辑回归是线性分类器」的含义。

需要强调的是：**模型本身是非线性的（sigmoid 非线性），但决策边界是线性的**。想让边界弯曲，只能靠特征工程（多项式特征、交叉项）或换模型，不能指望加层 sigmoid。

阈值 0.5 也只是默认值。正类样本稀少、漏判代价高时，把阈值降到 0.2 甚至更低往往更合理——这属于决策问题，不是模型问题，后面会再提。

### 四、为什么不用平方误差

最自然的想法是照搬线性回归，用均方误差：

$$
J(w) = \frac{1}{N}\sum_{i=1}^{N}\bigl(\sigma(w^\top x_i) - y_i\bigr)^2
$$

它能用，但有两个硬伤。

**1. 损失函数非凸**

把 sigmoid 套进平方里，$J$ 关于 $w$ 不再凸，会出现多个局部极小值和平坦区。梯度下降可能停在坏解上，而且初始化的影响被放大。

**2. 梯度消失**

对单个样本求导，用链式法则：

$$
\frac{\partial}{\partial z}(\sigma(z) - y)^2 = 2(\sigma(z) - y)\,\sigma'(z)
$$

$\sigma'(z) = \sigma(z)(1-\sigma(z))$ 在 $|z|$ 较大时**趋近于 0**。也就是说，当模型「错得很离谱」时（比如真实标签是 1，但 $z = -8$，$\hat{y} \approx 0.0003$），梯度反而接近 0，参数几乎不动。

这非常反直觉：**错得越狠，学得越慢**。而平方误差在回归里恰恰是「错得越狠、梯度越大」，这个好性质在这里被 sigmoid 破坏了。

### 五、交叉熵：从极大似然推出来

正确的做法是从概率角度出发。对单个样本，模型给出的似然是

$$
P(y \mid x) = \hat{y}^{\,y}\,(1-\hat{y})^{1-y}
$$

这个写法很巧妙：$y=1$ 时它等于 $\hat{y}$，$y=0$ 时等于 $1-\hat{y}$。

假设 $N$ 个样本独立，取对数似然：

$$
\log L(w) = \sum_{i=1}^{N}\Bigl[y_i \log \hat{y}_i + (1-y_i)\log(1-\hat{y}_i)\Bigr]
$$

极大化似然等价于极小化负对数似然，除以 $N$ 得到**二元交叉熵（BCE）**：

$$
J(w) = -\frac{1}{N}\sum_{i=1}^{N}\Bigl[y_i \log \hat{y}_i + (1-y_i)\log(1-\hat{y}_i)\Bigr]
$$

这就是逻辑回归的代价函数。它不是「发明」出来的，而是**极大似然估计的直接产物**——这也是它比平方误差更「正确」的根本原因。

#### 逐项看它的行为

| 真实标签 $y$ | 预测 $\hat{y}$ | 损失 $-\log\hat{y}$ 或 $-\log(1-\hat{y})$ | 说明 |
| --- | --- | --- | --- |
| 1 | 0.99 | 0.01 | 预测对且自信，几乎不罚 |
| 1 | 0.5 | 0.69 | 犹豫，中等惩罚 |
| 1 | 0.01 | 4.6 | 预测错且自信，重罚 |
| 0 | 0.01 | 0.01 | 预测对且自信，几乎不罚 |
| 0 | 0.99 | 4.6 | 预测错且自信，重罚 |

关键在最后两行：**交叉熵重罚的是「自信地犯错」**，而平方误差对自信犯错和犹豫犯错给出的惩罚差别不大。这正是分类任务想要的偏好。

从信息论角度，交叉熵衡量的是真实分布 $y$ 和预测分布 $\hat{y}$ 之间的差异；当两者一致时损失为 0，偏离越远惩罚越大且**没有上界**。

### 六、梯度：干净得惊人

对 $J$ 求 $w$ 的梯度，利用 $\sigma' = \sigma(1-\sigma)$，两个 log 项的导数会互相抵消掉那个讨厌的 $\sigma'$，最终得到：

$$
\frac{\partial J}{\partial w} = \frac{1}{N}\sum_{i=1}^{N}\bigl(\hat{y}_i - y_i\bigr)x_i
$$

$$
\frac{\partial J}{\partial b} = \frac{1}{N}\sum_{i=1}^{N}\bigl(\hat{y}_i - y_i\bigr)
$$

写成矩阵形式（$X$ 每行一个样本，$\hat{y} = \sigma(Xw+b)$）：

$$
\nabla_w J = \frac{1}{N}X^\top(\hat{y} - y)
$$

注意它和线性回归的梯度形式**完全一样**，区别只在 $\hat{y}$ 是 $\sigma(Xw+b)$ 而不是 $Xw+b$。这个「残差 × 特征」的结构是广义线性模型（GLM）的共性。

更重要的一点：这里的梯度里**没有 $\sigma'$**。所以当预测错得很离谱时，$\hat{y} - y$ 很大，梯度也很大，参数会快速修正——恰好修复了平方误差的梯度消失问题。

你可以自己验一遍这个抵消过程，这是理解交叉熵为什么好用的最短路径：

$$
\frac{\partial}{\partial z}\Bigl[-\bigl(y\log\sigma(z) + (1-y)\log(1-\sigma(z))\bigr)\Bigr]
= -\left(\frac{y}{\sigma} - \frac{1-y}{1-\sigma}\right)\sigma(1-\sigma)
= \sigma(z) - y
$$

### 七、正则化

逻辑回归很容易过拟合，尤其是特征多、样本少的时候（文本分类的 TF-IDF 动辄几万维）。加正则项：

$$
J(w) = \text{BCE}(w) + \frac{\lambda}{2}\lVert w \rVert_2^2
$$

-   **L2（Ridge）**：把权重整体压小，防止某个特征权重过大。scikit-learn 里是 `penalty="l2"`，默认就是这个。
-   **L1（Lasso）**：倾向于把不重要的权重压到恰好 0，产生稀疏解，可用于特征选择。
-   **ElasticNet**：两者混合，用 `l1_ratio` 控制比例。

实现上的两个细节：

1.  **偏置项 $b$ 通常不正则化**。它不控制任何特征的权重，惩罚它没有意义。
2.  **正则化前要标准化特征**。这是上一篇讲过的：$L_2$ 惩罚的是权重绝对值，特征量纲不同会让惩罚在不同特征上严重失衡。

### 八、多分类：softmax 回归

二分类的 sigmoid 推广到 $K$ 类就是 softmax：

$$
P(y=k \mid x) = \frac{e^{z_k}}{\sum_{j=1}^{K} e^{z_j}}, \qquad z_k = w_k^\top x + b_k
$$

损失变成**多类交叉熵**：

$$
J = -\frac{1}{N}\sum_{i=1}^{N}\log P(y_i \mid x_i)
$$

梯度形式仍然干净：$\frac{\partial J}{\partial z_k} = \hat{y}_k - \mathbb{1}[y=k]$。也就是「预测概率减去 one-hot 标签」。

实际实现里有两个稳定化技巧必须知道：

-   **softmax 输入先减去每行的最大值**，防止 $e^{z}$ 溢出。PyTorch 的 `CrossEntropyLoss` 内部已经做了，所以它接收的是 **logits 而不是概率**。
-   **不要手动先 softmax 再算交叉熵**。这是新手最常见的错误：数值上不稳定，梯度上还会多算一次。正确做法是把原始 logits 直接传给 `CrossEntropyLoss`。

二分类时，`BCEWithLogitsLoss` 是同理的存在——它把 sigmoid 和 BCE 合并，内部做了 log-sum-exp 稳定化处理，比手动 `sigmoid` + `BCELoss` 更稳。

### 九、一个完整的实现

用 scikit-learn 走一遍标准流程，重点在 Pipeline 和标准化：

```python
import numpy as np
from sklearn.datasets import load_breast_cancer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

X, y = load_breast_cancer(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

clf = make_pipeline(
    StandardScaler(),
    LogisticRegression(C=1.0, max_iter=1000, solver="lbfgs"),
)

scores = cross_val_score(clf, X_train, y_train, cv=5, scoring="roc_auc")
print("CV AUC:", np.round(scores, 4), "mean:", scores.mean().round(4))

clf.fit(X_train, y_train)

# 注意：predict 用的是 0.5 阈值，predict_proba 才是概率
proba = clf.predict_proba(X_test)[:, 1]
print("Test AUC:", round(roc_auc_score(y_test, proba), 4))
```

两个容易混淆的参数：

-   `C` 是**正则化强度的倒数**，$C = 1/\lambda$。所以 **`C` 越小，正则化越强**，和直觉相反。默认 $C=1$。
-   `penalty` 才有 L1/L2 之分，`C` 只控制强度。用 L1 通常还要把 `solver` 换成 `liblinear` 或 `saga`。

如果自己用 NumPy 手写一遍，能看清每一步在做什么：

```python
import numpy as np

def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-z))

def train_logreg(X, y, lr=0.1, epochs=500, l2=1e-3):
    n, d = X.shape
    w, b = np.zeros(d), 0.0
    for _ in range(epochs):
        p = sigmoid(X @ w + b)
        err = p - y                                # 残差
        grad_w = X.T @ err / n + l2 * w            # 偏置不正则化
        grad_b = err.mean()
        w -= lr * grad_w
        b -= lr * grad_b
    return w, b

def bce_loss(X, y, w, b):
    p = np.clip(sigmoid(X @ w + b), 1e-12, 1 - 1e-12)
    return -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))
```

`np.clip` 那一行很重要：当 $p$ 恰好等于 0 或 1 时 $\log(p)$ 是 $-\infty$，会让整个损失变成 `nan`。

### 十、实践里的几个坑

**1. 阈值不能默认 0.5**

0.5 只在正负样本均衡、两类错判代价相同时才合理。样本极不均衡（比如欺诈检测正类占 0.5%）时，模型会把所有样本判为负类也能拿到 99.5% 的准确率。这时应该：

-   看 AUC、PR 曲线而不是准确率；
-   按业务代价选阈值，而不是用 0.5；
-   考虑 `class_weight="balanced"` 或重采样。

**2. 特征共线性会让系数不可解释**

强相关的特征会让权重在正负之间剧烈摆动，量级很大但模型效果不变。想解释系数（比如看哪个特征影响大），要先检查相关性或改用 L2 正则。

**3. 完全分离（perfect separation）**

如果某个特征能把正负类完全分开，极大似然估计不存在，权重会趋于无穷大，训练不收敛并报「已收敛但系数很大」的警告。解决办法就是加正则化，不要用 `penalty=None`。

**4. 迭代不收敛**

`max_iter` 默认 100，特征多、未标准化时很容易撞上上限。看到 `ConvergenceWarning` 先标准化特征，再考虑提高 `max_iter` 或换 `solver`。

**5. 把逻辑回归当概率校准器**

sigmoid 只是形状像概率，不代表输出就是可信概率。逻辑回归在这一点上其实表现不错（这也是它的优点），但加了强正则或特征高度相关后，概率会偏。需要精确概率时，用独立验证集做 Platt scaling 或 isotonic 校准。

### 总结

-   逻辑回归 = 线性得分 + sigmoid，假设的是**对数几率线性**，决策边界是超平面。
-   分类不用平方误差：它非凸，而且 $\sigma'$ 会让「错得越狠、学得越慢」。
-   交叉熵由**极大似然**推出，重罚自信的错误，梯度是干净的残差形式 $X^\top(\hat{y}-y)$。
-   多分类用 softmax + 多类交叉熵；实现上把 logits 直接交给 `CrossEntropyLoss` / `BCEWithLogitsLoss`，不要手动过 sigmoid/softmax。
-   正则化前先标准化特征，`C` 越小正则越强，偏置项不正则化。
-   阈值 0.5 只是默认值，类别不均衡时它通常不是最优选择。

下一篇准备写正则化，把 L1/L2 的几何直觉和「为什么 L1 能产生稀疏解」讲透。
