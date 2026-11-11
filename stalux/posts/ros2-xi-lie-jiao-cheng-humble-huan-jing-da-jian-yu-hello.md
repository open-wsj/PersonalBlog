---
title: "ROS2系列教程：Humble环境搭建与Hello World"
abbrlink: ros2-xi-lie-jiao-cheng-humble-huan-jing-da-jian-yu-hello
date: "2026-09-03 15:39:24"
categories:
    - "ROS2"
tags: []
desc: "本节我们完成了 ROS2 的入门：理解 ROS2 与 ROS1 的架构区别、DDS 与 QoS 的概念、搭建 Humble 开发环境的基本流程，并用 C++ 与 Python 两种语言写出了第一个…"
---
## 本文是 ROS2 系列教程的第 1 篇

> 本文是 ROS2 系列教程的第 1 篇：Humble 环境搭建与 Hello World。本系列参照「动手学 ROS2」Humble LTS 的知识体系，采用 C++（rclcpp）与 Python（rclpy）双语言并讲的方式，从零开始带你掌握 ROS2 的核心概念与实战技巧。每一篇都会给出可运行的完整示例，建议你在自己的机器上亲自动手实践。

### 一、ROS2 是什么

ROS（Robot Operating System，机器人操作系统）并不是一个真正的操作系统，而是一套面向机器人与自动化系统的**分布式中间件框架**。它建立在 Linux 等宿主操作系统之上，为机器人软件提供统一的通信、调度、工具链与生态。

ROS2 是 ROS1 的全新重写版本，解决了 ROS1 在实时性、多机通信、安全性、跨平台以及长期支持方面的诸多痛点。本节先建立整体认知，不必着急记细节，后续章节会逐个展开。

#### 1.1 ROS1 与 ROS2 的核心区别

ROS1 面向学术与原型验证，虽成熟但存在先天限制；ROS2 面向工业级与生产部署，做了架构性升级。理解它们的差别，有助于我们理解 ROS2 设计中那些看似「多此一举」的概念。

| 维度 | ROS1 | ROS2 |
| --- | --- | --- |
| 通信中间件 | 自研 TCPROS / UDPROS | DDS（数据分发服务） |
| 实时性 | 较弱，无 QoS 保障 | 强，支持 QoS 服务质量策略 |
| 多机/分布式 | 依赖一台 ROS Master | 无需中心节点，DDS 自动发现 |
| 跨平台 | 主要 Linux | Linux/Windows/macOS |
| 安全性 | 无加密与身份认证 | 支持 SROS2 加密与认证 |
| Python 消息分发 | 需要 rospy 全局状态 | 纯 Python + rclpy |
| 长期支持 | 无 LTS 概念 | 有 LTS 版（如 Humble） |

最大的架构差异在于**去中心化**。ROS1 必须有一个 `roscore`（ROS Master）来维护节点注册与话题匹配，Master 一旦挂掉整个系统瘫痪；ROS2 基于 DDS 的 P2P 发现机制，节点之间直接协商通信，无需单点故障中心。这也是 ROS2 适合多机、长时间部署机器人的根本原因。

#### 1.2 DDS 与 QoS

DDS（Data Distribution Service）是一个由 OMG 组织维护的**发布/订阅式实时通信标准**。DDS 本身蕴含了节点发现、可靠传输、权限控制、QoS 策略等能力，ROS2 选择 DDS 作为通信底座，使自己能直接复用这些工业级能力。

QoS（Quality of Service，服务质量）是 ROS2 通信的核心概念，它决定消息传输的可靠性与实时性。ROS2 常用的 QoS 策略包括：

-   **Reliability（可靠性）**：`RELIABLE` 尽力可靠送达（可能重传），`BEST_EFFORT` 尽力而为（不重传，适合高带宽传感器）。
-   **Durability（持久性）**：`TRANSIENT_LOCAL` 让晚加入的订阅者也能收到最近的「最后一条」消息（常用于参数、静态 TF），`VOLATILE` 只收发布之后的消息。
-   **History（历史）**：`KEEP_LAST(N)` 只保留最近 N 条，`KEEP_ALL` 保留全部。
-   **Deadline / Lifespan / Liveliness**：用于超时、有效期与活性检测。

同一话题上的发布者与订阅者 QoS **必须兼容**才能通信。例如发布者用 `RELIABLE`，订阅者用 `BEST_EFFORT` 可以兼容（可靠侧向下兼容），但反过来则不行。第 9 篇会专门深入 QoS，这里先记住：**QoS 是 ROS2 中「看似啰嗦、实则关键」的设计**。

#### 1.3 版本与 LTS

ROS2 每年发布一个版本（奇数为 LTS，偶数为半年版）。当前主流长期支持版是 **Humble Hawksbill（Humble，H 系列）**，支持到约 2027 年，也是 fishros「动手学 ROS2」教程采用的版本。其余常见版本如 Foxy、Galactic、Iron、Jazzy、Kilted 等。我们统一使用 **Ubuntu 22.04 + Humble** 这套最经典的组合，社区资料最丰富、踩坑最少。

### 二、环境搭建

搭建 ROS2 Humble 环境的推荐方式是「在 Ubuntu 22.04 上安装」。如果你没有 Ubuntu 物理机，可考虑以下方案（按简单到复杂排列）：WSL2、虚拟机（VirtualBox / VMware）、Docker。本教程以 **Windows 上的 WSL2 + Ubuntu 22.04** 为例，因为它既能利用 Windows 硬件，又让开发体验接近原生 Linux。

#### 2.1 WSL2 安装步骤

在 Windows 上打开「管理员 PowerShell」，依次执行：

```bash
# 启用 WSL2 并安装 Ubuntu 22.04
wsl --install -d Ubuntu-22.04
```

重启计算机后，首次启动 Ubuntu-22.04 会让你设置 Linux 用户名与密码。安装完成后可更新系统软件包：

```bash
sudo apt update && sudo apt upgrade -y
```

如果你的 Windows 版本较老，`wsl --install` 可能不支持，需要手动启用 WSL 功能与虚拟机平台（控制面板 → 启用或关闭 Windows 功能 → 勾选「适用于 Linux 的 Windows 子系统」与「虚拟机平台」）。

#### 2.2 设置 locale 与软件源

ROS2 对 locale 有要求，必须先配置为 UTF-8 编码，否则中文与特殊字符会出问题：

```bash
sudo apt install -y locales
sudo locale-gen en_US en_US.UTF-8
sudo update-locale LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8
export LANG=en_US.UTF-8
```

然后设置 UTF-8 软源（如需）并安装基础依赖：

```bash
sudo apt install -y software-properties-common curl gnupg2 lsb-release
```

#### 2.3 添加 ROS2 apt 源

以 Humble 为例，添加官方软件源：

```bash
sudo curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key -o /usr/share/keyrings/ros-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(source /etc/os-release && echo $UBUNTU_CODENAME) main" | sudo tee /etc/apt/sources.list.d/ros2.list > /dev/null
```

国内网络较慢时，可以改用清华镜像源加速：

```bash
sudo sh -c 'echo "deb [arch=$(dpkg --print-architecture)] https://mirrors.tuna.tsinghua.edu.cn/ros2/ubuntu $(lsb_release -sc) main" > /etc/apt/sources.list.d/ros2.list'
```

更新索引后即可安装 ROS2 核心包。选择「ros-base」即可满足大部分教程需求，如需更多工具可安装完整版 `desktop`：

```bash
sudo apt update
sudo apt install -y ros-humble-desktop
```

`ros-humble-desktop` 包含核心库、Rviz、Gazebo、常用工具等，体积较大但开箱即用。仅学习入门可先装 `ros-humble-ros-base`。

#### 2.4 安装 colcon 与入门工具

构建工具 colcon 是 ROS2 的标配：

```bash
sudo apt install -y python3-colcon-common-extensions
```

常用工具链（视需要安装）：

```bash
sudo apt install -y ros-humble-ros2bag ros-humble-rviz2 python3-pip
```

#### 2.5 配置环境变量

每次打开新终端都要 `source` 环境脚本很麻烦，建议写进 `.bashrc`：

```bash
echo "source /opt/ros/humble/setup.bash" >> ~/.bashrc
source ~/.bashrc
```

如果你在 WSL2 中使用且需要图形界面（Rviz、Gazebo），可能需要启用 WSLg（Windows 11 默认支持）或配置 X11 转发。WSL2 通常已内置 WSLg，直接在终端运行 `rviz2` 即可看到窗口。

#### 2.6 验证安装

打开新终端，依次输入：

```bash
# 方法一：打印版本
printenv ROS_DISTRO

# 方法二：查看环境变量路径
echo $ROS_DISTRO

# 方法三：查看已安装的可用包
ls /opt/ros/humble/
```

如果 `printenv ROS_DISTRO` 输出 `humble`，说明环境配置成功。你也可以先跑一个最简单的节点测试（见下节）。

### 三、第一个 ROS2 程序：Hello World

ROS2 程序的最小单元是**节点（Node）**。一个节点就是一个独立运行的进程，它通过话题、服务、动作等方式与其他节点通信。本节我们写一个最基础的节点，它只负责在启动时打印一句话，以此理解节点的最小骨架。

#### 3.1 Python 版 Hello World（rclpy）

Python 版最直观，代码量最少。创建一个工作空间并新建一个包（包的创建细节见第 3、4 篇，这里先手动搭建最小结构）：

```python
# talker.py —— 一个最简的 Python 节点
import rclpy
from rclpy.node import Node

class HelloNode(Node):
    def __init__(self):
        super().__init__('hello_node')
        self.get_logger().info('Hello, ROS2! 我是 Python 节点')

def main(args=None):
    rclpy.init(args=args)
    node = HelloNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
```

运行这个脚本前，需要先安装依赖。在已 source 环境的终端中：

```bash
python3 -c "import rclpy"   # 若报错需安装 python3 依赖
source /opt/ros/humble/setup.bash
python3 talker.py
```

你将看到日志输出 `Hello, ROS2! 我是 Python 节点`，同时进程会一直保持运行（因为 `rclpy.spin()` 让节点不断处理回调）。按 `Ctrl+C` 即可优雅退出。

#### 3.2 C++ 版 Hello World（rclcpp）

C++ 版结构更规范，但需要 `CMakeLists.txt` 与 `package.xml`。这里先给出核心源码，完整包结构在第 3、4 篇讲解：

```cpp
// hello_node.cpp —— 一个最简的 C++ 节点
#include "rclcpp/rclcpp.hpp"

class HelloNode : public rclcpp::Node
{
public:
    HelloNode() : Node("hello_node")
    {
        RCLCPP_INFO(this->get_logger(), "Hello, ROS2! 我是 C++ 节点");
    }
};

int main(int argc, char **argv)
{
    rclcpp::init(argc, argv);
    auto node = std::make_shared<HelloNode>();
    rclcpp::spin(node);
    rclcpp::shutdown();
    return 0;
}
```

编译与运行（假设已用 colcon 构建并 source）：

```bash
# 构建
colcon build --symlink-install --packages-select my_pkg
source install/setup.bash

# 运行
ros2 run my_pkg hello_node
```

同样，你会看到 `Hello, ROS2! 我是 C++ 节点` 的日志。

#### 3.3 两种语言的关键差异

对比上面两段代码，可以快速抓住 rclcpp 与 rclpy 的编写差异：

| 维度 | C++ (rclcpp) | Python (rclpy) |
| --- | --- | --- |
| 头文件/导入 | `#include "rclcpp/rclcpp.hpp"` | `import rclpy` |
| 初始化 | `rclcpp::init(argc, argv)` | `rclpy.init(args=args)` |
| 节点创建 | `std::make_shared<Node>()` 或继承 `Node` | 继承 `rclpy.node.Node` |
| 进入回调循环 | `rclcpp::spin(node)` | `rclpy.spin(node)` |
| 退出清理 | `rclcpp::shutdown()` | `rclpy.shutdown()` |
| 日志宏/方法 | `RCLCPP_INFO(...)` | `self.get_logger().info(...)` |
| 管理方式 | 智能指针，需显式 spin | 对象自动生命周期 |

C++ 更强调资源管理（智能指针 `shared_ptr`）与显式控制，性能更高、更适合实时与嵌入场景；Python 上手快、开发效率高、适合原型验证与快速迭代。本系列将始终同时给出两种语言的示例。

#### 3.4 认识 `spin`：回调循环的本质

无论是 `rclcpp::spin(node)` 还是 `rclpy.spin(node)`，其本质都是**进入一个不断处理回调的循环**。ROS2 节点是「事件驱动」的：它平时挂起，一旦有新的消息到达、定时器触发或服务请求进来，就执行对应的回调函数。`spin` 就是这个「等待并分发事件」的循环。

-   如果你不再调用 `spin`，节点的回调永远不会被触发（消息来了也处理不了）。
-   `spin` 会一直阻塞，直到收到 `Ctrl+C` 或 `shutdown` 信号。
-   异步场景下也可用 `spin_some()`（轮询一次）或单独管理一个 `SingleThreadedExecutor`，这在第 8 篇回调组章节会深入。

### 四、理解节点的生命周期与日志

#### 4.1 节点的生命周期

ROS2 节点有一个规范化的生命周期状态机（第 26 篇硬件控制会用到），但普通节点的大致流程是：**构造节点 → 注册功能（话题/服务/定时器）→ 进入 spin 回调 → 关闭清理**。理解「构造期执行一次、回调期反复执行、关闭期清理资源」这个节奏，是学好 ROS2 的关键。

```python
# lifecycle_demo.py —— 演示构造期与回调期的区别
import rclpy
from rclpy.node import Node

class LifecycleDemo(Node):
    def __init__(self):
        super().__init__('lifecycle_demo')
        # 构造期：只执行一次
        self.get_logger().info('构造期执行一次')
        self.count = 0
        # 创建一个定时器，每 1 秒触发一次回调
        self.create_timer(1.0, self.on_timer)

    def on_timer(self):
        # 回调期：每秒执行一次
        self.count += 1
        self.get_logger().info(f'回调期执行第 {self.count} 次')

def main(args=None):
    rclpy.init(args=args)
    node = LifecycleDemo()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

运行后，你会看到「构造期执行一次」只打一遍，而「回调期执行第 N 次」每秒递增。

#### 4.2 日志级别与过滤

ROS2 的日志系统支持分级过滤，常见的日志级别为 `DEBUG、INFO、WARN、ERROR、FATAL`。默认只显示 `INFO` 及以上。在 Python 中：

```python
self.get_logger().set_level(rclpy.logging.LoggingSeverity.DEBUG)
self.get_logger().debug('调试信息')
self.get_logger().info('普通信息')
self.get_logger().warn('警告')
self.get_logger().error('错误')
```

在 C++ 中：

```cpp
RCLCPP_DEBUG(this->get_logger(), "调试信息");
RCLCPP_INFO(this->get_logger(), "普通信息");
RCLCPP_WARN(this->get_logger(), "警告");
RCLCPP_ERROR(this->get_logger(), "错误");
```

你也可以在命令行设置全局日志级别，例如 `--ros-args --log-level DEBUG`。

#### 4.3 命令行运行节点

作为运行节点最常用的一条指令是：

```bash
# 运行某个包里的某个可执行节点
ros2 run <package_name> <executable_name>
```

例如运行我们上面创建的节点：`ros2 run my_pkg hello_node`。若只想看节点有哪些可执行文件，可用：

```bash
ros2 pkg executables <package_name>
```

### 五、实战：组织一个小型节点项目

为了让你把前面的零散概念串起来，我们做一个「带定时器 + 命令行动态参数」的完整小项目。它会在定时器里持续输出计数，并允许通过命令行参数覆盖节点名称。

#### 5.1 完整代码（Python）

```python
# timer_counter.py —— 定时计数器节点，支持命令行参数
import rclpy
from rclpy.node import Node

class TimerCounter(Node):
    def __init__(self):
        super().__init__('timer_counter')
        self.count = 0
        self.timer = self.create_timer(0.5, self.on_timer)

    def on_timer(self):
        self.count += 1
        self.get_logger().info(f'计数: {self.count}')

def main(args=None):
    rclpy.init(args=args)
    node = TimerCounter()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

用命令行参数覆盖节点名称：

```bash
python3 timer_counter.py --ros-args --remap __node:=my_counter
```

此时 `ros2 node list` 中该节点会显示为 `/my_counter`。`--remap __node:=xxx` 是 ROS2 中非常常用的重映射技巧。

#### 5.2 完整代码（C++）

```cpp
// timer_counter.cpp
#include "rclcpp/rclcpp.hpp"
#include <chrono>

class TimerCounter : public rclcpp::Node
{
public:
    TimerCounter() : Node("timer_counter"), count_(0)
    {
        timer_ = this->create_wall_timer(
            std::chrono::milliseconds(500),
            std::bind(&TimerCounter::onTimer, this));
    }
private:
    void onTimer()
    {
        count_++;
        RCLCPP_INFO(this->get_logger(), "计数: %d", count_);
    }
    int count_;
    rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char **argv)
{
    rclcpp::init(argc, argv);
    rclcpp::spin(std::make_shared<TimerCounter>());
    rclcpp::shutdown();
    return 0;
}
```

C++ 版同样可用 `--remap __node:=my_counter` 重命名节点，运行效果一致。

#### 5.3 节点管理常用指令

完成本节后，你应该能熟练使用以下命令来查看与操作节点：

```bash
# 查看当前所有活动的节点
ros2 node list

# 查看某个节点的详细信息（话题、服务、参数等）
ros2 node info /timer_counter

# 查看所有节点及其关联信息
ros2 node list -t
```

### 六、总结

本节我们完成了 ROS2 的入门：理解 ROS2 与 ROS1 的架构区别、DDS 与 QoS 的概念、搭建 Humble 开发环境的基本流程，并用 C++ 与 Python 两种语言写出了第一个 Hello World 节点。重点掌握：

-   **ROS2 = 分布式中间件**，去中心化，DDS 通信底座，QoS 是核心。
-   **环境搭建**：Ubuntu 22.04 + Humble，`source /opt/ros/humble/setup.bash`。
-   **节点是最小单元**，`rclpy` 与 `rclcpp` 两种写法，`spin` 是回调循环。
-   **日志与生命周期**：构造期一次、回调期反复、关闭期清理。
-   **常用指令**：`ros2 run`、`ros2 node list/info`、`--remap`。

### 下一篇预告

下一节我们将正式认识「节点与 ROS 图」，学习如何用 `ros2` 命令行、rqt 图形工具观察节点之间的连接关系，理解节点、话题、服务之间是如何通过 ROS 图组织起来的，并动手创建多个相互通信的节点。
