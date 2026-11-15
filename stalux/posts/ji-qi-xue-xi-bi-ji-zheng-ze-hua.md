---
title: "机器学习笔记：正则化"
abbrlink: ji-qi-xue-xi-bi-ji-zheng-ze-hua
date: "2026-11-15 10:20:00"
categories:
    - "机器学习"
tags: ["正则化", "L1", "L2", "机器学习"]
desc: "正则化不是「加一项防止过拟合」这么简单。这篇从几何和贝叶斯两个角度解释 L1/L2 的差别、为什么 L1 能产生稀疏解、C 与 λ 的方向为什么相反，以及标准化、偏置项、正则化路径这些实践细节。"
---

> 机器学习笔记的第六篇。上一篇讲逻辑回归时提过一句「加正则项」，但只是列了 L1/L2/ElasticNet 三个名字。这篇把正则化单独讲透——它几乎是所有线性模型里唯一需要调的复杂度旋钮，而关于它的很多说法（比如「L1 更稀疏」）背后都有具体的几何原因。

### 一、正则化在对抗什么

先明确问题。线性模型在训练集上很容易做到训练损失很低，尤其是：

-   **特征多、样本少**（$d \gg N$）。此时甚至有无数个 $w$ 能让训练误差为 0。
-   **特征之间有强共线性**。$X^\top X$ 接近奇异，最小二乘解的方差会爆炸：训练集稍微变一点，解就剧烈摆动。
-   **样本极少但特征维度高**（文本的 TF-IDF 动辄几万维）。

这些情况下模型不是「学得不够」，而是**学得太自由**。正则化的思路是给参数加一个约束，把「让损失最小」变成「在参数别太夸张的前提下让损失最小」：

$$
\min_w \; J(w) + \lambda\, \Omega(w)
$$

-   $J(w)$ 是原来的损失（MSE 或交叉熵）
-   $\Omega(w)$ 是惩罚项，衡量参数有多「大」
-   $\lambda \ge 0$ 控制两者的相对权重

这是一个**有偏估计**：牺牲一点训练集上的拟合，换取泛化能力的提升。$\lambda = 0$ 时退化为原问题，$\lambda \to \infty$ 时所有权重被压到 0（模型退化成只输出偏置）。

### 二、L2 正则：让权重整体变小

$$
\Omega(w) = \frac{1}{2}\lVert w \rVert_2^2 = \frac{1}{2}\sum_{j=1}^{d} w_j^2
$$

加上它之后，线性回归的最小二乘解从

$$
\hat{w} = (X^\top X)^{-1}X^\top y
$$

变成岭回归（Ridge）：

$$
\hat{w} = (X^\top X + \lambda I)^{-1}X^\top y
$$

这个改动看起来只是在对角线上加了个 $\lambda$，但效果很关键：**$X^\top X$ 可能奇异，加上 $\lambda I$ 后一定可逆**。所以 L2 正则同时解决了共线性导致的数值不稳定问题，这是它最被低估的作用。

从梯度角度看，L2 相当于每次更新时把权重按比例缩小一点：

$$
w \leftarrow w - \eta\bigl(\nabla J(w) + \lambda w\bigr) = (1 - \eta\lambda)w - \eta\nabla J(w)
$$

这就是 weight decay 这个名字的来源——每步都把权重「衰减」一点点。所以 L2 也叫权重衰减（严格说两者在自适应优化器里并不完全等价，后面会提）。

**L2 的特点**：

-   把权重压小、压均匀，但**很少压到恰好 0**；
-   对强相关的特征会**分摊权重**，让它们共享贡献，而不是随机挑一个；
-   损失函数保持严格凸、处处可导，优化简单。

### 三、L1 正则：把权重压成稀疏

$$
\Omega(w) = \lVert w \rVert_1 = \sum_{j=1}^{d} |w_j|
$$

L1 对应的是 Lasso 回归。它最显著的性质是**会把一部分权重压到恰好 0**，于是自动完成了特征选择——这对高维稀疏数据（文本、基因数据）非常有用。

为什么它能压到 0，而 L2 不能？两种解释都值得记住。

#### 解释一：几何直觉

把惩罚项看成约束，原问题等价于

$$
\min_w J(w) \quad \text{s.t.} \quad \lVert w \rVert_1 \le t
$$

在二维平面上画出两个约束区域：

-   L2 的约束区域是**圆**，边界处处光滑，等值线（椭圆）从任意方向碰到圆的边界，切点几乎不会落在坐标轴上；
-   L1 的约束区域是**菱形**，四个**顶点在坐标轴上**。等值线扩张时更容易先碰到这些尖角，而尖角处的坐标分量恰好为 0。

维度越高，菱形（实际上是多胞体）的尖角越多，碰到尖角的概率越大。这就是 L1 稀疏性的几何来源。

#### 解释二：导数不连续

看一维情形。L2 的梯度是 $\lambda w$，当 $w \to 0$ 时惩罚也趋于 0，所以没有任何力量把 $w$ 稳定地按在 0 上。

L1 的次梯度是 $\lambda \cdot \text{sign}(w)$，**大小恒为 $\lambda$，与 $w$ 无关**。也就是说，只要原损失的梯度在 $(-\lambda, \lambda)$ 之间，最优解就老老实实停在 $w = 0$。

$$
\frac{\partial}{\partial w}\bigl(J(w) + \lambda|w|\bigr) = \nabla J(w) + \lambda\,\text{sign}(w) = 0
$$

这就解释了为什么 L1 的零是「硬零」：它是一个区间内的最优解，不是逼近出来的。L2 的零只是极限情况，实际优化时几乎不会精确取到。

#### 一个容易忽略的代价

L1 在 0 点不可导，所以不能用普通的梯度下降。实践中的做法：

-   坐标下降（coordinate descent），scikit-learn 的 `liblinear` 就是这类；
-   近端梯度法（ISTA/FISTA），每步做一次软阈值：$w \leftarrow \text{sign}(w)\max(|w| - \eta\lambda, 0)$；
-   直接改用平滑近似，或者干脆用 L2。

### 四、L1 与 L2 的对照

| 维度 | L1（Lasso） | L2（Ridge） |
| --- | --- | --- |
| 惩罚形式 | $\sum \lvert w_j \rvert$ | $\frac{1}{2}\sum w_j^2$ |
| 解的特征 | 稀疏，部分权重恰好为 0 | 稠密，权重整体偏小 |
| 特征选择 | 自动 | 不自动 |
| 共线性 | 随机保留一个，其余置 0 | 分摊到所有相关特征 |
| 优化 | 不可导，需要坐标下降/近端法 | 光滑凸，直接梯度即可 |
| 维度 $d > N$ | 最多选出 $N$ 个非零特征 | 可以全部保留 |
| 适用 | 高维稀疏、需要可解释性 | 特征多但都有用、共线性明显 |

注意 L2 在共线性下的「分摊」行为：如果两个特征完全相关，Lasso 会随机挑一个留下、另一个置零，重跑一次数据顺序变了结果就可能变，**系数解释不可靠**；Ridge 则是两者各分一半，虽然单看系数会偏小，但整体更稳定。所以**需要解释系数时，Ridge 往往比 Lasso 更可信**。

### 五、ElasticNet：两者混合

Lasso 有两个已知缺陷：

1.  特征数 $d$ 大于样本数 $N$ 时，最多只能选出 $N$ 个特征；
2.  一组强相关特征里它只留一个，信息利用不充分。

ElasticNet 用混合惩罚解决：

$$
\Omega(w) = \alpha \lVert w \rVert_1 + \frac{1-\alpha}{2}\lVert w \rVert_2^2
$$

$\alpha \in [0,1]$ 控制两者的比例（scikit-learn 里叫 `l1_ratio`）。它既有 L1 的稀疏性，又有 L2 的稳定性：相关特征会被**成组地保留或剔除**（grouping effect），这通常比 Lasso 的单打独斗更合理。

一般建议：特征高度相关、或 $d > N$ 时优先试 ElasticNet，而不是硬用 Lasso。

### 六、从贝叶斯角度看正则化

正则化还有一个更统一的解释：**它等价于给参数加先验**。

回顾最大后验估计（MAP）：

$$
\hat{w}_{\text{MAP}} = \arg\min_w \bigl[-\log P(y \mid X, w) - \log P(w)\bigr]
$$

-   若先验是**高斯分布** $w_j \sim \mathcal{N}(0, \sigma^2)$，则 $-\log P(w) \propto \sum w_j^2$，正好得到 **L2**；
-   若先验是**拉普拉斯分布** $P(w_j) \propto e^{-|w_j|/b}$，则 $-\log P(w) \propto \sum |w_j|$，正好得到 **L1**。

拉普拉斯分布在 0 处有尖峰、尾部更重，所以它「相信」大部分权重本来就该接近 0——这正是稀疏性的贝叶斯版本。高斯分布的尾部平滑，倾向于让所有权重都很小但不为零。

这个视角的价值在于：正则化不是随手加的「技巧」，而是**把领域知识（权重应该有多大、有多少应该为零）写进模型**的一种方式。$\lambda$ 的大小，反映的就是你对这个先验有多确信。

### 七、$\lambda$ 与 $C$：方向相反的两个参数

不同的库用不同参数表示正则化强度，最容易搞混的是 scikit-learn：

| 库/接口 | 参数 | 正则化强度 |
| --- | --- | --- |
| 公式写法 | $\lambda$ | $\lambda$ 越大越强 |
| sklearn `LogisticRegression` | `C` | **`C` 越大越弱**，$C = 1/\lambda$ |
| sklearn `Ridge` / `Lasso` | `alpha` | $\alpha$ 越大越强 |
| PyTorch 优化器 | `weight_decay` | 越大越强 |
| XGBoost | `lambda` / `alpha` | 越大越强 |

所以 `LogisticRegression(C=0.01)` 是**强正则**，`C=100` 是**弱正则**，和很多人的直觉相反。调参时看到「C 调大反而过拟合」不要惊讶。

### 八、$\lambda$ 怎么选

标准做法是**交叉验证 + 正则化路径**。scikit-learn 提供了内置的带 CV 版本：

```python
import numpy as np
from sklearn.datasets import load_diabetes
from sklearn.linear_model import LassoCV, RidgeCV
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

X, y = load_diabetes(return_X_y=True)

ridge = make_pipeline(
    StandardScaler(),
    RidgeCV(alphas=np.logspace(-3, 3, 20), cv=5),
).fit(X, y)
print("Ridge 最优 alpha:", ridge[-1].alpha_)

lasso = make_pipeline(
    StandardScaler(),
    LassoCV(alphas=np.logspace(-4, 0, 30), cv=5, max_iter=10000),
).fit(X, y)
print("Lasso 最优 alpha:", lasso[-1].alpha_)
print("非零权重个数:", int(np.sum(lasso[-1].coef_ != 0)), "/", X.shape[1])
```

如果想直观看到「正则化如何逐步改变解」，可以画正则化路径：

```python
import matplotlib.pyplot as plt
from sklearn.linear_model import lasso_path

alphas, coefs, _ = lasso_path(X, y, alphas=np.logspace(-4, 0, 50))
plt.plot(np.log10(alphas), coefs.T)
plt.xlabel(r"$\log_{10}\alpha$")
plt.ylabel("coefficient")
plt.title("Lasso regularization path")
plt.show()
```

图上每条线是一个特征系数的变化轨迹。$\alpha$ 增大时系数依次被压到 0，**被压到 0 的先后顺序就是特征的重要性排序**——这是 Lasso 除了预测之外的一个实用副产品。

### 九、三个必须注意的实现细节

**1. 一定要先标准化特征**

这是最关键的实践点。L2 惩罚的是 $\lVert w \rVert^2$，而权重的量级取决于特征的量纲：同一个特征如果把单位从「米」换成「毫米」，数值放大 1000 倍，对应的权重就会缩小 1000 倍，受到的惩罚也跟着缩小。

结果就是**惩罚在不同特征之间严重失衡**——量纲大的特征几乎不受惩罚，量纲小的特征被过度压缩。解决办法只有一个：先标准化，让所有特征处在同一量纲上，惩罚才公平。

这也是为什么 `Pipeline` 里 `StandardScaler()` 必须放在正则化模型前面，并且只能在训练折上 `fit`。

**2. 偏置项不要正则化**

$b$ 不控制任何特征的权重，它只负责平移决策边界。惩罚它没有意义，而且会迫使模型在目标均值不为 0 时产生系统性偏差。

好消息是大多数实现已经帮你处理了（sklearn 的 `fit_intercept=True` 默认不惩罚截距，PyTorch 需要你在参数组里手动排除 `bias`）：

```python
# PyTorch：只对权重做 weight decay，偏置和 norm 层参数排除
decay, no_decay = [], []
for name, param in model.named_parameters():
    if param.ndim < 2 or "bias" in name or "norm" in name:
        no_decay.append(param)
    else:
        decay.append(param)

optimizer = torch.optim.AdamW([
    {"params": decay, "weight_decay": 0.01},
    {"params": no_decay, "weight_decay": 0.0},
], lr=3e-4)
```

**3. L2 与 weight decay 在自适应优化器里不等价**

在 SGD 里，L2 正则和 weight decay 是同一件事。但在 Adam 这类自适应优化器里，L2 惩罚项会被和梯度一起做二阶矩归一化，导致**大梯度的参数反而受到更小的实际衰减**，正则效果被扭曲。

这正是 **AdamW** 出现的原因：它把 weight decay 从梯度里拆出来，直接作用于参数本身，而不是混进梯度。用 Adam 时看到 `weight_decay` 效果不明显，很可能就是这个原因——换成 `AdamW` 就对了。

### 十、正则化与其它复杂度控制手段的关系

正则化只是控制模型复杂度的一种方式，不是唯一的一种：

| 手段 | 作用方式 | 适用 |
| --- | --- | --- |
| L1 / L2 / ElasticNet | 直接约束参数大小 | 线性模型、神经网络 |
| 早停（early stopping） | 在验证损失回升前停止 | 神经网络、树模型 |
| 减少特征 | 人工或算法筛选 | 高维稀疏数据 |
| Dropout | 训练时随机失活神经元 | 神经网络 |
| 树的最大深度/叶子数 | 限制模型结构 | 树模型 |
| 增加数据 / 数据增强 | 从源头降低过拟合 | 所有模型 |

对线性模型来说，正则化基本是唯一需要调的结构参数；对神经网络，它通常和早停、Dropout 一起用。不要指望单靠调大 $\lambda$ 解决所有过拟合——先确认模型容量和训练数据是否本身就匹配。

### 十一、几个实践中的坑

**1. 用训练集上的损失调 $\lambda$**

$\lambda$ 增大时训练损失一定上升，所以拿训练损失选参数必然选出 $\lambda = 0$。必须用交叉验证或独立验证集。

**2. 在标准化之前切分数据**

`scaler.fit_transform(X)` 之后再 `train_test_split`，测试集的均值方差会泄漏进训练过程。正确顺序永远是先切分、再在 Pipeline 里 fit。

**3. 系数不能直接跨模型比较**

加了正则化后，系数会被整体压缩，所以「加了正则后某个特征系数变小了」不代表它不重要。要比较重要性，应该比较**标准化后的系数绝对值**或使用正则化路径。

**4. Lasso 的零不代表「无关」**

一组完全共线的特征里，Lasso 只会随机保留一个。被置零的特征很可能同样有信息，只是被另一个抢先了。这种情况下用 ElasticNet 或先做相关性分析。

**5. 正则化太强时表现为欠拟合**

$\lambda$ 过大会把权重压得接近 0，模型退化成常数预测。训练损失和验证损失**同时很高**就是典型信号——不要误判成数据有问题。

### 总结

-   正则化把「最小化损失」变成「在参数别太夸张的前提下最小化损失」，用一点偏差换方差。
-   L2 让权重整体变小、可逆化 $X^\top X$，但不会产生零；L1 因为次梯度恒定和菱形约束，能把权重压到恰好 0，从而做特征选择。
-   L1 的几何解释是菱形顶点落在坐标轴上；贝叶斯解释是拉普拉斯先验在 0 处有尖峰。
-   ElasticNet 结合两者，适合强相关特征和 $d > N$ 的情况。
-   注意参数方向：sklearn 逻辑回归的 `C` 是正则强度的**倒数**，`C` 越小正则越强。
-   **正则化前必须标准化特征，偏置项不要正则化**，自适应优化器要用 AdamW 分离 weight decay。
-   先用正则化路径看系数怎么被压缩，再用交叉验证定 $\lambda$，别用训练损失选。

到这里，线性模型这条线（梯度下降 → 特征缩放 → 学习率 → 逻辑回归 → 正则化）算是走完了。下一篇准备进入树模型。
