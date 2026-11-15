---
title: "机器学习笔记：神经网络层与前向传播"
abbrlink: ji-qi-xue-xi-bi-ji-shen-jing-wang-luo-ceng-yu-qian-xiang-chuan-bo
date: "2026-11-15 14:10:00"
categories:
    - "机器学习"
tags: ["神经网络", "前向传播", "卷积", "深度学习"]
desc: "把神经网络拆成一层层来看：全连接、激活、卷积、池化、归一化、Dropout、残差、注意力各自在算什么，每个层的形状怎么推导、参数量和计算量怎么估、前向传播时数据怎么流动。"
---

> 机器学习笔记的第七篇。前面几篇都是线性模型，从这篇开始进入神经网络。神经网络看着复杂，但拆开来看，无非是**一串形状明确、运算固定的层**。这篇的目标是：给一个输入，你能在纸上推完整个前向传播，并且说清每个中间结果的形状和数值。

### 一、前向传播是什么

前向传播（forward propagation）就是**把输入逐层变换成输出**的过程。没有反向传播、没有梯度，只有值的计算。

$$
a^{(1)} = f_1(a^{(0)}), \quad a^{(2)} = f_2(a^{(1)}), \quad \dots, \quad \hat{y} = f_L(a^{(L-1)})
$$

其中 $a^{(0)} = x$ 是输入。整个网络可以看成一个复合函数：

$$
\hat{y} = f_L \circ f_{L-1} \circ \dots \circ f_1(x)
$$

每一层 $f_l$ 只有两个信息需要确定：

1.  **输入输出形状**（这就决定了张量怎么流动）；
2.  **具体的运算**（矩阵乘、卷积、逐元素函数……）。

训练时反向传播之所以能自动求导，正是因为前向计算图里每个算子都知道自己的局部导数。所以把前向理清楚，反向就只是沿链式法则回填。

### 二、全连接层（Linear / Dense）

最基础的一层，做的事就是仿射变换：

$$
y = xW^\top + b
$$

设输入 $x \in \mathbb{R}^{B \times d_{\text{in}}}$，则 $W \in \mathbb{R}^{d_{\text{out}} \times d_{\text{in}}}$，$b \in \mathbb{R}^{d_{\text{out}}}$，输出 $y \in \mathbb{R}^{B \times d_{\text{out}}}$。

**形状的关键点**：$B$（batch size）不参与权重参数，只是行数。所以同一个层可以处理任意批量大小，这也是形状推导时唯一「自由」的维度。

**参数量**：

$$
(d_{\text{in}} \times d_{\text{out}}) + d_{\text{out}}
$$

后一项是偏置。比如 `Linear(784, 256)` 有 $784 \times 256 + 256 = 200{,}960$ 个参数。

**计算量**（乘加各算一次）：

$$
2 \times B \times d_{\text{in}} \times d_{\text{out}} \ \text{FLOPs}
$$

**手算一个例子**。输入 $x = [1, 2]$，权重 $W = \begin{bmatrix}1 & 0\\ 0 & 1\\ 1 & 1\end{bmatrix}$，偏置 $b=[0,1,-1]$：

$$
y_1 = 1\cdot 1 + 2\cdot 0 + 0 = 1 \\
y_2 = 1\cdot 0 + 2\cdot 1 + 1 = 3 \\
y_3 = 1\cdot 1 + 2\cdot 1 - 1 = 2
$$

输出 $[1, 3, 2]$，形状从 $2$ 变成 $3$。

### 三、激活层

激活层是**逐元素**（element-wise）运算，**形状不变、没有参数**。它的唯一作用是引入非线性——如果没有它，任意多个全连接层叠起来仍然等价于一个线性变换：

$$
W_2(W_1 x) = (W_2 W_1)x
$$

常见的几种：

| 函数 | 公式 | 输出范围 | 特点 |
| --- | --- | --- | --- |
| Sigmoid | $\frac{1}{1+e^{-z}}$ | $(0,1)$ | 易饱和，深层网络梯度消失 |
| Tanh | $\frac{e^z-e^{-z}}{e^z+e^{-z}}$ | $(-1,1)$ | 零中心，但同样饱和 |
| ReLU | $\max(0, z)$ | $[0,\infty)$ | 计算便宜、不饱和，但负区梯度为 0 |
| LeakyReLU | $\max(\alpha z, z)$ | $(-\infty,\infty)$ | 修复 ReLU 的「死亡神经元」 |
| GELU | $z\cdot\Phi(z)$ | 约 $(-0.17,\infty)$ | 平滑版 ReLU，Transformer 常用 |
| SiLU / Swish | $z\cdot\sigma(z)$ | 约 $(-0.28,\infty)$ | 平滑、非单调 |

几个容易忽略的点：

-   **ReLU 的负半轴为什么是 0 而不是别的**：导数简单（0 或 1），计算只涉及一次比较，是深度网络能训起来的关键工程选择之一。
-   **GELU 里的 $\Phi$ 是标准正态的累积分布函数**，实际实现用 $\tanh$ 近似：$\text{GELU}(z) \approx 0.5z\left(1+\tanh\left(\sqrt{2/\pi}(z+0.044715z^3)\right)\right)$。
-   **最后一层通常不用激活，或者用与任务匹配的激活**：回归直接线性输出，二分类用 sigmoid，多分类用 softmax。这一层经常被框架合进损失函数里（`CrossEntropyLoss` 内含 softmax），不要重复加。

### 四、卷积层

全连接层在图像上的问题很直接：一张 $224\times224\times3$ 的图展平是 150,528 维，接一个 1000 维的全连接层就有 1.5 亿参数。卷积层用两个假设把这个数量降下来：

-   **局部性**：相邻像素相关，一个输出只需看一小块输入；
-   **平移不变性**：同一个卷积核在整张图上滑动，权重共享。

#### 运算过程

设输入 $X \in \mathbb{R}^{C_{\text{in}} \times H \times W}$，卷积核 $K \in \mathbb{R}^{C_{\text{out}} \times C_{\text{in}} \times k \times k}$，步长 $s$，填充 $p$。输出第 $o$ 个通道在位置 $(i,j)$ 的值是：

$$
Y[o,i,j] = \sum_{c=1}^{C_{\text{in}}}\sum_{u=0}^{k-1}\sum_{v=0}^{k-1} K[o,c,u,v]\cdot X[c,\ i\cdot s+u-p,\ j\cdot s+v-p] + b[o]
$$

读法：**对输入的所有通道、核窗口内的所有位置做加权求和，每个输出通道有自己的一套权重**。

#### 输出尺寸

$$
H_{\text{out}} = \left\lfloor \frac{H + 2p - k}{s} \right\rfloor + 1
$$

这个公式几乎每次改结构都要用，值得记牢。几个常见配置：

| 配置 | 效果 |
| --- | --- |
| $k=3, s=1, p=1$ | 尺寸不变（same padding），最常用 |
| $k=3, s=2, p=1$ | 尺寸减半，下采样 |
| $k=1, s=1, p=0$ | 尺寸不变，只做通道混合 |
| $k=2, s=2, p=0$ | 尺寸精确减半 |

#### 参数量与计算量

$$
\text{参数} = k \times k \times C_{\text{in}} \times C_{\text{out}} + C_{\text{out}}
$$

注意参数量**与输入尺寸 $H,W$ 无关**——这是卷积相比全连接最大的优势。

计算量（一次乘加算 2 FLOPs）：

$$
2 \times B \times H_{\text{out}} \times W_{\text{out}} \times C_{\text{out}} \times C_{\text{in}} \times k^2
$$

#### 两个重要的变体

**1×1 卷积**：$k=1$，等价于在通道维度上做一次全连接，用来**升降维**和跨通道融合。ResNet 的 bottleneck、MobileNet 的 expansion 都靠它。它的参数量是 $C_{\text{in}}C_{\text{out}}$，非常便宜。

**深度可分离卷积**：把标准卷积拆成两步——每个通道独立做 $k\times k$ 卷积（depthwise），再用 $1\times1$ 卷积混合通道（pointwise）。参数量从 $k^2C_{\text{in}}C_{\text{out}}$ 降到

$$
k^2C_{\text{in}} + C_{\text{in}}C_{\text{out}}
$$

以 $k=3$ 为例，大约是原来的 $1/8 \sim 1/9$。MobileNet 系列就是建立在这个之上。

#### 感受野

一个输出位置在原图上「看到」的区域大小。单层是 $k$，多层累积为：

$$
R_l = R_{l-1} + (k_l - 1)\prod_{i=1}^{l-1} s_i
$$

含义是：堆叠小卷积核能获得大感受野，而且比单个大卷积核参数更少、非线性更多。两个 $3\times3$ 堆叠等效于一个 $5\times5$ 的感受野，但参数是 $2\times9=18$ 对 $25$。

### 五、池化层

池化在空间维度上做降采样，**没有参数**。

| 类型 | 运算 | 作用 |
| --- | --- | --- |
| Max Pooling | 窗口内取最大值 | 保留最强响应，常用 |
| Average Pooling | 窗口内取平均 | 平滑，全局平均常用 |
| Global Average | 整张特征图取平均 → 一个数 | 替代全连接分类头 |

`AdaptiveAvgPool2d(1)` 或 `x.mean(dim=(2,3))` 就是全局平均池化。它把 $B\times C\times H\times W$ 变成 $B\times C$，直接把任意分辨率的特征图压成分类向量，参数量为 0——这是现代 CNN（ResNet 之后）标配的收尾方式，替代了原来那种巨大的全连接层。

Max pooling 的形状计算和卷积一样用那个公式（$p$ 通常为 0）。注意池化**只降空间尺寸，不改通道数**。

### 六、归一化层

#### BatchNorm

对一个 mini-batch，在每个通道上独立地做标准化：

$$
\mu_c = \frac{1}{B H W}\sum_{b,h,w} x_{b,c,h,w},
\qquad
\sigma_c^2 = \frac{1}{B H W}\sum_{b,h,w}(x_{b,c,h,w} - \mu_c)^2
$$

$$
\text{BN}(x) = \gamma_c \cdot \frac{x - \mu_c}{\sqrt{\sigma_c^2 + \epsilon}} + \beta_c
$$

两个关键细节：

1.  **统计量来自 batch 维度**，所以 BN 的行为和 batch size 强相关。batch 太小时（比如 1 或 2），$\mu$ 和 $\sigma$ 的估计噪声极大，训练会变得不稳定。这是 BN 最大的限制。
2.  **训练和推理的计算不同**。训练时用当前 batch 的统计量，同时用滑动平均更新全局的 `running_mean` / `running_var`；推理时**用滑动平均的统计量**，不再看当前 batch。所以模型 `train()` 和 `eval()` 模式的输出会不一样，忘了 `model.eval()` 是最常见的 bug 之一。

$\gamma, \beta$ 是可学习参数，每个通道两个，让网络自己决定要不要恢复原来的分布。

#### LayerNorm

$$
\text{LN}(x) = \gamma \cdot \frac{x - \mu}{\sqrt{\sigma^2 + \epsilon}} + \beta
$$

区别在于统计量的范围：LN 在**单个样本的所有特征维度**上算均值和方差，和 batch 无关。所以：

-   batch size 为 1 也能正常工作；
-   训练和推理的行为一致，不需要切换模式；
-   序列长度可变时依然稳定（每个位置独立归一化）。

这就是 Transformer 一律用 LayerNorm 而不是 BatchNorm 的原因。

#### RMSNorm

LayerNorm 的简化版，只做缩放不做中心化：

$$
\text{RMSNorm}(x) = \frac{x}{\sqrt{\frac{1}{d}\sum x_i^2 + \epsilon}} \cdot \gamma
$$

省掉了均值计算，在 LLM 里很流行（LLaMA 系列）。归一化层本身是逐样本的，所以它也不改变形状（LN/BN 都保持输入形状）。

### 七、Dropout

训练时以概率 $p$ 随机把神经元置零：

$$
\text{Dropout}(x) = \frac{m \odot x}{1-p}, \qquad m_i \sim \text{Bernoulli}(1-p)
$$

除以 $1-p$ 叫 **inverted dropout**，目的是让训练和推理时的期望一致：这样推理阶段就不需要额外的缩放，直接原样前向。

所以：

-   **训练时**：随机置零 + 缩放，输出有随机性；
-   **推理时**：恒等映射，不做任何事。

同样依赖 `model.train()` / `model.eval()` 的切换。Dropout 的默认概率从早期的 0.5 降到现在的 0.1 甚至 0，因为 BN/LN 和更强的正则化手段已经分担了这部分工作。

### 八、残差连接

严格说它不是一个「层」，而是一种连接方式：

$$
y = f(x) + x
$$

要求 $f(x)$ 和 $x$ 的形状完全一致；不一致时用 $1\times1$ 卷积或线性层做投影：$y = f(x) + W_s x$。

为什么有用？反向传播时：

$$
\frac{\partial y}{\partial x} = \frac{\partial f(x)}{\partial x} + I
$$

那个 $+I$ 保证了梯度里**至少有一条恒等通路**，不会因为 $f$ 的雅可比矩阵连乘而衰减到 0。这是 ResNet 能训练上百层的原因，也是后来所有深层网络（Transformer 的每个子层）都采用残差结构的原因。

它还有个好性质：**参数量为 0**（形状一致时），只是多了一个加法。

### 九、注意力层

Transformer 的核心，一个缩放点积注意力：

$$
\text{Attention}(Q,K,V) = \text{softmax}\left(\frac{QK^\top}{\sqrt{d_k}}\right)V
$$

拆开看每一步的形状（设 $B$ 个样本、$n$ 个 token、$d$ 维）：

| 步骤 | 运算 | 形状变化 |
| --- | --- | --- |
| 线性投影 | $Q=XW_Q,\ K=XW_K,\ V=XW_V$ | $(B,n,d)\to(B,n,d_k)$ |
| 打分 | $S = QK^\top$ | $(B,n,d_k)\times(B,d_k,n)\to(B,n,n)$ |
| 缩放 | $S/\sqrt{d_k}$ | 不变，防止点积随维度变大而爆炸 |
| 归一化 | $\text{softmax}(S)$ 按行 | 每行和为 1，得到注意力权重 |
| 加权求和 | $AV$ | $(B,n,n)\times(B,n,d_v)\to(B,n,d_v)$ |

**缩放为什么是 $\sqrt{d_k}$**：若 $q,k$ 各分量独立同分布、方差为 1，则点积的方差是 $d_k$，标准差是 $\sqrt{d_k}$。不除的话，$d_k$ 一大 softmax 就会饱和成 one-hot，梯度几乎为 0。

多头注意力就是把上面的过程并行做 $h$ 次（每个头用 $d_k = d/h$ 维），再把结果拼接后投影一次。参数量主要来自那四个线性层。

注意力的计算量是 $O(n^2 d)$——序列长度的平方，这也是长上下文昂贵的原因。

### 十、完整的前向传播：手算一个小网络

把上面的东西串起来。一个三层网络做二分类：

$$
x \in \mathbb{R}^{4} \to \text{Linear}(4,3) \to \text{ReLU} \to \text{Linear}(3,1) \to \text{sigmoid}
$$

```python
import numpy as np

rng = np.random.default_rng(0)

x = np.array([[0.5, -1.0, 2.0, 0.0]])          # 形状 (1, 4)

W1 = rng.normal(scale=0.5, size=(4, 3))        # (4, 3)，注意这里是 x @ W
b1 = np.zeros(3)
W2 = rng.normal(scale=0.5, size=(3, 1))
b2 = np.zeros(1)

z1 = x @ W1 + b1                                # (1, 3)
a1 = np.maximum(0, z1)                          # ReLU，形状不变
z2 = a1 @ W2 + b2                               # (1, 1)
y_hat = 1 / (1 + np.exp(-z2))                   # sigmoid

print("z1:", z1.round(3), z1.shape)
print("a1:", a1.round(3), a1.shape)
print("z2:", z2.round(3), z2.shape)
print("y_hat:", y_hat.round(3), y_hat.shape)
```

每一步的形状都是明确的：$(1,4)\to(1,3)\to(1,3)\to(1,1)\to(1,1)$。**如果你能在写代码之前把这条形状链写出来，网络结构基本就不会搭错。**

PyTorch 里对应的等价实现：

```python
import torch
from torch import nn

model = nn.Sequential(
    nn.Linear(4, 3),
    nn.ReLU(),
    nn.Linear(3, 1),
    nn.Sigmoid(),
)

x = torch.randn(8, 4)          # batch=8
print(model(x).shape)          # torch.Size([8, 1])

# 逐层看中间结果
h = x
for layer in model:
    h = layer(h)
    print(f"{layer.__class__.__name__:10s} -> {tuple(h.shape)}")
```

输出会是：

```
Linear     -> (8, 3)
ReLU       -> (8, 3)
Linear     -> (8, 1)
Sigmoid    -> (8, 1)
```

这个「逐层打印形状」的小技巧在调试真实网络时极其有用，比盯着报错信息猜要快得多。

### 十一、参数量与计算量的估算

搭网络时，随手估一下参数量能避免很多惊讶。以 ResNet-18 的分类头为例：

| 层 | 参数量 |
| --- | --- |
| 7×7 conv, 3→64 | $7^2\times3\times64+64 = 9{,}472$ |
| 每个 3×3 conv, 64→64 | $3^2\times64\times64+64 = 36{,}928$ |
| 1×1 conv, 64→256 | $64\times256+256 = 16{,}640$ |
| 最后的 FC, 512→1000 | $512\times1000+1000 = 513{,}000$ |

注意最后那个全连接层占了很大一块——这也是为什么现代网络改用全局平均池化加一个更小的分类层。

估算时记住两条：

-   **全连接层的参数是 $d_{\text{in}}d_{\text{out}}$ 量级**，容易爆炸；
-   **卷积层的参数与空间尺寸无关**，只和通道数、核大小有关。

### 十二、实践中的几个坑

**1. 忘记 `model.eval()`

BN 和 Dropout 在训练/推理下行为不同。推理时忘了切换，结果会不稳定且偏差很大——尤其是 batch size 小于训练时的情况。

**2. 在 `no_grad()` 里才想起来要梯度**

推理阶段套 `torch.no_grad()` 省显存是对的，但如果在训练循环里误加了它，反向传播会直接报错或者拿到 `None`。

**3. BN 放在激活函数之前还是之后**

原论文是 conv → BN → ReLU。后来也有 Pre-activation 的变体（BN → ReLU → conv）。两种都能训，但**不要混着用**，更不能把 BN 放到最后输出层前面。

**4. 卷积的输出尺寸算错**

`k=3, s=1, p=1` 保持尺寸，`s=2, p=1` 减半。拼接（concat）两个分支前，先用公式核对 $H_{\text{out}}, W_{\text{out}}$ 是否一致，否则会报形状不匹配。

**5. softmax 和交叉熵重复计算**

模型输出 softmax，再用 `CrossEntropyLoss`（它内部自带 softmax），等于做了两次归一化，训练会变得很差但不会报错。正确做法是模型输出 logits，损失函数负责剩下的部分。

**6. 初始化全零**

全连接层如果权重全为 0，同一层的所有神经元梯度完全相同，永远无法分化。必须用随机初始化（Xavier / He），它们会按输入输出维度自动调整方差。

**7. 残差相加前形状不一致**

`x` 和 `f(x)` 的通道数不同时，必须加投影分支，不能直接相加。这个错误在改通道数时最容易出现。

**8. 把 BatchNorm 用在小 batch 上**

batch size 为 1 或 2 时 BN 基本失效。要么换 LayerNorm/GroupNorm，要么用梯度累积把有效 batch 撑大。

### 总结

-   前向传播就是逐层做形状明确的变换，搞定两层信息：**输入输出形状**和**每层的运算**。
-   全连接层做仿射变换，参数量 $(d_{\text{in}}+1)d_{\text{out}}$，batch 维度不参与权重。
-   激活层逐元素、无参数，唯一作用是引入非线性；没有它，多层线性等价于一层。
-   卷积层靠局部连接和权重共享把参数量从「与图像尺寸相关」变成「只看通道和核大小」；输出尺寸用 $\lfloor (H+2p-k)/s\rfloor+1$。
-   池化无参数、只降空间尺寸；全局平均池化替代了大型分类头。
-   BN 依赖 batch、训练与推理行为不同；LN 不依赖 batch，所以 Transformer 用它。
-   Dropout 训练时置零并缩放，推理时恒等。
-   残差的 $+I$ 是深层网络能训练的梯度通路，参数量为 0。
-   注意力的核心是 $\text{softmax}(QK^\top/\sqrt{d_k})V$，缩放是为了防止 softmax 饱和，计算量随序列长度平方增长。
-   调试网络的第一习惯：**逐层打印形状**。

下一篇准备写反向传播和自动微分，把这篇里每一层的局部导数补上。
