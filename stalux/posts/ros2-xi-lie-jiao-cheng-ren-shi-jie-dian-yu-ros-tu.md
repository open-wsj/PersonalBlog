---
title: "ROS2系列教程：认识节点与ROS图"
abbrlink: ros2-xi-lie-jiao-cheng-ren-shi-jie-dian-yu-ros-tu
date: "2026-09-03 15:39:52"
categories:
    - "ROS2"
tags: []
desc: "在 ROS2 中，节点（Node）是一个负责执行特定任务的独立进程或进程内模块。一个机器人系统通常由几十个节点组成：有的节点负责读取激光雷达数据，有的负责做定位，有的负责规划路径，有的负责驱动电机…"
---
## 本文是 ROS2 系列教程的第 2 篇

> 本文是 ROS2 系列教程的第 2 篇：认识节点与 ROS 图。上一篇文章我们搭建好了 Humble 环境并运行了第一个 Hello World 节点，本篇文章将深入理解 ROS2 的**最小单元——节点（Node）**，以及由节点连接而成的 **ROS 图（ROS Graph）**。我们依然采用 C++（rclcpp）与 Python（rclpy）双语言并讲，每一节都配有可运行的完整示例。

### 一、节点与 ROS 图：核心概念

#### 1.1 什么是节点

在 ROS2 中，**节点（Node）** 是一个负责执行特定任务的独立进程或进程内模块。一个机器人系统通常由几十个节点组成：有的节点负责读取激光雷达数据，有的负责做定位，有的负责规划路径，有的负责驱动电机。每个节点只干一件事，把复杂系统拆解成大量小而专的单元，这是 ROS 设计哲学的核心——**单一职责 + 松耦合**。

一个节点至少包含以下基本要素：

-   **节点名称**：在整个 ROS 图中全局唯一（配合命名空间使用），例如 `/sensor/lidar`、`/navigation/nav2_controller`。
-   **通信端点**：节点通过话题（Topic）、服务（Service）、动作（Action）、参数（Parameter）与其他节点交互，这些统称为通信端点。
-   **执行逻辑**：节点内部的回调函数、定时器、主循环，决定了节点"做什么"。

类比理解：把 ROS2 比作一家公司，节点就是公司里的**员工**。每个员工有明确的岗位（节点名），员工之间通过内部通讯系统（话题/服务）协作，没有人是总管一切的中心（ROS2 去中心化）。

#### 1.2 什么是 ROS 图

**ROS 图（ROS Graph）** 是运行中的节点及其通信关系的抽象描述。它由三部分组成：

| 要素 | 说明 | 例子 |
| --- | --- | --- |
| 节点（Node） | 图的顶点 | `/talker`、`/listener` |
| 通信关系 | 图的边 | talker 发布话题 `/chatter` 给 listener |
| 通信中间件 | DDS 层 | 负责实际传输、发现、QoS 协商 |

当你运行 `rqt_graph` 或在 RViz 中查看，就能看到一张可视化的 ROS 图：每个椭圆是一个节点，每条箭头是一条话题连接，箭头方向从发布者指向订阅者。这张图就是整个机器人系统的"组织架构图"。

ROS2 与 ROS1 最大的区别之一：ROS1 需要 `roscore`（ROS Master）作为中央注册表，所有节点必须向它注册；ROS2 **没有中心节点**，节点之间通过 DDS 的 P2P 发现协议（Discovery）自动互相发现、直接通信。因此 ROS2 天然支持多机分布式部署——不同机器上的节点只要在同一网络（或配置好 DDS 发现域），就能组成同一张 ROS 图。

#### 1.3 节点、进程与线程

初学者常混淆三个概念：

-   **进程（Process）**：操作系统层面的运行实例。ROS2 中一个进程可以包含一个节点，也可以包含多个节点（通过 Composable Node / 组件机制）。
-   **节点（Node）**：ROS 层面逻辑单元，负责通信。一个进程里可以有多个节点。
-   **线程（Thread）**：进程内的执行流。rclpy/rclcpp 的 `spin` 默认在单线程里轮流执行回调。

理解它们的层次：**进程包含节点，节点运行在线程上**。默认情况下每个节点在自己的进程里运行（一个进程 = 一个节点），这样崩溃隔离性最好；但当节点很多、通信频繁时，进程间通信开销大，就可以把多个节点组合进一个进程共享内存，这就是后面会讲的 **launch 与 Composable Node**。

### 二、用 Python 创建第一个节点

#### 2.1 最简 rclpy 节点

先看一个只创建节点、不做任何通信的最简 Python 节点：

```python
# minimal_node.py —— 最简 rclpy 节点
import rclpy
from rclpy.node import Node

class MyNode(Node):
    def __init__(self):
        # 第一个参数是节点名称，第二个参数是命名空间（可省略）
        super().__init__('my_python_node')
        self.get_logger().info('Python 节点已启动！')

def main(args=None):
    rclpy.init(args=args)          # 1. 初始化 rclpy
    node = MyNode()                # 2. 创建节点实例
    rclpy.spin(node)               # 3. 进入事件循环（等待回调）
    node.destroy_node()            # 4. 清理节点
    rclpy.shutdown()               # 5. 关闭 rclpy

if __name__ == '__main__':
    main()
```

运行方式：

```bash
# 直接运行（前提：已 source 环境变量，且当前目录能找到该文件）
python3 minimal_node.py
```

你会看到终端打印出类似这样的日志：

```
[INFO] [1690000000.123456789] [my_python_node]: Python 节点已启动！
```

由于 `rclpy.spin()` 会一直运行，程序不会退出（除非按 Ctrl+C）。这个节点现在没有任何话题和服务，但你可以在另一个终端用 `ros2 node list` 看到它。

#### 2.2 节点名称与命名空间

节点名称在 ROS 图中必须唯一。命名空间（Namespace）用于给节点分组，类似文件系统的目录结构。创建带命名空间的节点：

```python
# namespace_node.py —— 演示命名空间
import rclpy
from rclpy.node import Node

def main():
    rclpy.init()
    # 节点全名 = 命名空间 + 节点名，即 /robot_arm/controller
    node = Node('controller', namespace='/robot_arm')
    node.get_logger().info(f'节点全名: {node.get_name()}')
    node.get_logger().info(f'命名空间: {node.get_namespace()}')
    node.get_logger().info(f'带命名空间的全名: {node.get_fully_qualified_name()}')
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

运行后 `ros2 node list` 中会显示 `/robot_arm/controller`。注意：**节点全名（fully qualified name）＝ 命名空间 + 节点名**，命名空间以 `/` 开头，各级之间也用 `/` 分隔。

命名空间的典型用途：一台机器人上可能有左右两个机械臂，用 `/left_arm` 和 `/right_arm` 两个命名空间隔离，这样每侧内部的节点名可以相同而不冲突。

#### 2.3 定时器：让节点"活"起来

一个只会打印一次日志的节点太单调了。加入**定时器（Timer）**，让节点周期性地执行任务：

```python
# timer_node.py —— 定时器节点
import rclpy
from rclpy.node import Node

class TimerNode(Node):
    def __init__(self):
        super().__init__('timer_node')
        self.count = 0
        # 每 1.0 秒触发一次回调（注意单位是秒，浮点数）
        self.timer = self.create_timer(1.0, self.timer_callback)

    def timer_callback(self):
        self.count += 1
        self.get_logger().info(f'第 {self.count} 次心跳')

def main():
    rclpy.init()
    node = TimerNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

运行后每秒钟打印一次心跳。定时器是 ROS2 节点最常用的"节拍器"，后面所有周期发布（如传感器数据、控制指令）都建立在定时器之上。

### 三、用 C++ 创建节点

#### 3.1 最简 rclcpp 节点

C++ 版本的节点结构更偏向显式生命周期管理：

```cpp
// minimal_node.cpp —— 最简 rclcpp 节点
#include "rclcpp/rclcpp.hpp"

class MyNode : public rclcpp::Node
{
public:
  MyNode() : Node("my_cpp_node")
  {
    RCLCPP_INFO(this->get_logger(), "C++ 节点已启动！");
  }
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);              // 1. 初始化
  auto node = std::make_shared<MyNode>(); // 2. 创建节点（智能指针）
  rclcpp::spin(node);                    // 3. 事件循环
  rclcpp::shutdown();                    // 4. 关闭
  return 0;
}
```

编译与运行（在 package 环境中，参考第 4 篇的 package 结构）：

```bash
colcon build --packages-select demo_node_cpp
source install/setup.bash
ros2 run demo_node_cpp minimal_node
```

#### 3.2 C++ 定时器节点

对应 Python 的定时器示例：

```cpp
// timer_node.cpp —— C++ 定时器节点
#include "rclcpp/rclcpp.hpp"
#include <chrono>

class TimerNode : public rclcpp::Node
{
public:
  TimerNode() : Node("timer_node_cpp"), count_(0)
  {
    // 1.0 秒周期，单位是 std::chrono::duration
    timer_ = this->create_wall_timer(
      std::chrono::seconds(1),
      std::bind(&TimerNode::timer_callback, this));
  }

private:
  void timer_callback()
  {
    count_++;
    RCLCPP_INFO(this->get_logger(), "第 %ld 次心跳", count_);
  }

  rclcpp::TimerBase::SharedPtr timer_;
  long count_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<TimerNode>());
  rclcpp::shutdown();
  return 0;
}
```

注意 C++ 的几个细节：

-   `create_wall_timer` 的时间参数是 `std::chrono::duration`，比 Python 的秒数更精确。
-   回调函数需要 `std::bind` 绑定到成员函数，或使用 lambda 捕获 `this`。
-   定时器和回调都要保存为成员变量（`timer_`），防止被垃圾回收/析构。

#### 3.3 Python 与 C++ 节点对比

| 维度 | Python (rclpy) | C++ (rclcpp) |
| --- | --- | --- |
| 初始化 | `rclpy.init()` | `rclcpp::init(argc, argv)` |
| 创建节点 | `Node('name')` | `std::make_shared<MyNode>()` 或 `Node("name")` |
| 事件循环 | `rclpy.spin(node)` | `rclcpp::spin(node)` |
| 日志 | `self.get_logger().info()` | `RCLCPP_INFO(this->get_logger(), ...)` |
| 定时器 | `create_timer(1.0, cb)` | `create_wall_timer(std::chrono::seconds(1), cb)` |
| 生命周期 | 自动引用计数 | 手动 `init/shutdown` + 智能指针 |
| 适用场景 | 原型验证、脚本、快速迭代 | 性能敏感、实时性要求高、生产部署 |

**经验法则**：学概念用 Python 快；上真机、做控制用 C++ 稳。两者在 API 设计上高度对称，掌握了其中一个，另一个几乎是"翻译"关系。

### 四、节点生命周期与执行模型

#### 4.1 生命周期五阶段

一个 ROS2 节点从出生到销毁，经历清晰的阶段（下图即执行流）：

```text
初始化(init) → 构造(创建Node实例) → 配置(声明参数/创建端点) → 运行(spin事件循环) → 销毁(destroy/shutdown)
```

-   **初始化**：`rclpy.init()` / `rclcpp::init()`，启动底层 DDS、解析命令行参数（如 `--ros-args`）。
-   **构造**：调用构造函数，此时创建定时器、话题、服务等一切端点。
-   **运行**：`spin()` 阻塞式
    地轮询回调队列，有事件就执行，没事件就挂起。注意**构造期间回调不会执行**，所以不要在构造函数里做依赖回调结果的逻辑。
-   **销毁**：`destroy_node()` + `shutdown()`，释放 DDS 资源、断开连接。程序退出前一定要走完这一步，否则可能出现"僵尸连接"或端口占用。

#### 4.2 spin 的本质：回调循环

理解 `spin` 是理解 ROS2 执行模型的关键。`spin` 做的事情可以简化成：

```text
while (节点存活) {
    从回调队列取出一个待执行的回调;   // 可能来自话题消息、服务请求、定时器触发
    执行该回调;                        // 默认单线程，一次只执行一个
}
```

这意味着**回调的执行是串行的**。如果某个回调里写了 `sleep(10)` 或死循环，其他回调（包括定时器）都会卡住。这是一切"节点不响应了"问题的根源。因此：

-   回调里**绝不能**做耗时操作（文件 IO、网络请求、复杂计算）；
-   耗时任务应放子线程，或用 `MultiThreadedExecutor`（多线程执行器）。

#### 4.3 多线程执行器

Python 示例（C++ 的 `rclcpp::executors::MultiThreadedExecutor` 思路相同）：

```python
# multi_thread.py —— 多线程执行器
import rclpy
import threading
from rclpy.node import Node
from rclpy.executors import MultiThreadedExecutor

class BusyNode(Node):
    def __init__(self):
        super().__init__('busy_node')
        self.timer_a = self.create_timer(0.5, self.cb_a)
        self.timer_b = self.create_timer(0.5, self.cb_b)

    def cb_a(self):
        # 模拟耗时 3 秒的阻塞操作
        import time; time.sleep(3)
        self.get_logger().info('A 完成')

    def cb_b(self):
        self.get_logger().info('B 执行')

def main():
    rclpy.init()
    node = BusyNode()
    executor = MultiThreadedExecutor(num_threads=4)  # 4 线程
    executor.add_node(node)
    # 在子线程中运行执行器
    t = threading.Thread(target=executor.spin, daemon=True)
    t.start()
    try:
        import time
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        executor.shutdown()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

对比观察：用 `SingleThreadedExecutor` 时，B 会被 A 的 3 秒阻塞卡住；用 `MultiThreadedExecutor` 后，B 在另一个线程执行、正常响应。**多线程执行器是让"一个节点既能算又能响应"的标准解法**，但要注意线程安全问题（回调间共享数据要加锁）。

### 五、节点参数与日志

#### 5.1 声明与读取参数

节点参数（Parameter）是节点的"配置项"，运行时可动态修改。Python 声明参数：

```python
# param_node.py —— 参数演示（Python）
import rclpy
from rclpy.node import Node
from rclpy.parameter import Parameter

class ParamNode(Node):
    def __init__(self):
        super().__init__('param_node')
        # 声明参数：名称 + 默认值 + 描述
        self.declare_parameter('robot_name', 'turtle_01')
        self.declare_parameter('max_speed', 2.5)
        self.declare_parameter('verbose', True)
        # 读取参数（返回 Parameter 对象，用 .value 取值）
        self.robot_name = self.get_parameter('robot_name').value
        self.max_speed = self.get_parameter('max_speed').value
        self.get_logger().info(
            f'机器人: {self.robot_name}, 最大速度: {self.max_speed}')

def main():
    rclpy.init()
    node = ParamNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

命令行设置参数后运行：

```bash
ros2 run <pkg> param_node --ros-args -p robot_name:=my_rover -p max_speed:=3.0
```

#### 5.2 C++ 参数（对照）

```cpp
// param_node.cpp —— 参数演示（C++）
#include "rclcpp/rclcpp.hpp"

class ParamNode : public rclcpp::Node
{
public:
  ParamNode() : Node("param_node_cpp")
  {
    this->declare_parameter("robot_name", "turtle_01");
    this->declare_parameter("max_speed", 2.5);
    auto name = this->get_parameter("robot_name").as_string();
    auto speed = this->get_parameter("max_speed").as_double();
    RCLCPP_INFO(this->get_logger(), "机器人: %s, 最大速度: %.1f",
                name.c_str(), speed);
  }
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<ParamNode>());
  rclcpp::shutdown();
  return 0;
}
```

C++ 读取参数后要用 `as_string()`、`as_double()` 等方法转成具体类型。参数系统是"配置与代码分离"的基石：**同一份代码，通过不同参数启动，就能适配不同机器人**。

#### 5.3 日志级别与过滤

ROS2 日志分五个级别（从低到高）：`DEBUG < INFO < WARN < ERROR < FATAL`。默认只输出 INFO 及以上的日志。在终端设置日志级别：

```bash
ros2 run <pkg> timer_node --ros-args --log-level DEBUG
```

Python 中控制日志：

```python
# 在节点内输出各级日志
node.get_logger().debug('调试信息（默认不显示）')
node.get_logger().info('普通信息')
node.get_logger().warn('警告信息')
node.get_logger().error('错误信息')
node.get_logger().fatal('致命错误')
```

**实践建议**：开发期用 DEBUG 记录详细流程，发布前降回 INFO；不要用 `print` 代替 `get_logger`——日志带时间戳、节点名、级别，还能统一过滤和重定向到 ros2 bag，这是 print 做不到的。

### 六、实战：多节点协作小项目

#### 6.1 项目结构

下面组织一个"心跳-监视"双节点项目：`heartbeat_node` 每秒发布心跳次数，`monitor_node` 每 3 秒查询一次（用参数传递心跳值）。为演示方便，这里用两个 Python 文件 + 一个 launch 文件。

```text
multi_node_demo/
├── heartbeat.py      # 心跳节点（定时器 + 参数）
├── monitor.py        # 监视节点（定时器读取参数）
└── start.launch.py   # launch 文件同时启动两个节点
```

#### 6.2 心跳节点

```python
# heartbeat.py —— 心跳节点
import rclpy
from rclpy.node import Node

class HeartbeatNode(Node):
    def __init__(self):
        super().__init__('heartbeat')
        self.declare_parameter('rate', 1.0)      # 心跳频率参数
        self.declare_parameter('heartbeat', 0)   # 心跳计数（共享用）
        self.count = 0
        rate = self.get_parameter('rate').value
        self.timer = self.create_timer(rate, self.beat)

    def beat(self):
        self.count += 1
        # 把计数写回参数（同进程内其他节点可读，简单演示用）
        self.set_parameters([rclpy.parameter.Parameter(
            'heartbeat', rclpy.parameter.Parameter.Type.INTEGER, self.count)])
        self.get_logger().info(f'心跳 #{self.count}')

def main():
    rclpy.init()
    node = HeartbeatNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

#### 6.3 监视节点

```python
# monitor.py —— 监视节点
import rclpy
from rclpy.node import Node

class MonitorNode(Node):
    def __init__(self):
        super().__init__('monitor')
        self.declare_parameter('heartbeat', 0)
        # 每 3 秒检查一次心跳值
        self.timer = self.create_timer(3.0, self.check)

    def check(self):
        hb = self.get_parameter('heartbeat').value
        self.get_logger().info(f'当前心跳计数: {hb}')

def main():
    rclpy.init()
    node = MonitorNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

> 说明：真实项目中节点间共享数据应该用**话题**（第 5 篇详讲），这里用参数只是演示"参数可在进程内共享"的机制。多进程间参数不共享，正式通信请用话题/服务。

#### 6.4 launch 文件同时启动

```python
# start.launch.py —— 同时启动心跳与监视节点
from launch import LaunchDescription
from launch_ros.actions import Node

def generate_launch_description():
    return LaunchDescription([
        Node(package='demo_nodes_py', executable='heartbeat',
             name='heartbeat'),
        Node(package='demo_nodes_py', executable='monitor',
             name='monitor'),
    ])
```

运行：

```bash
# 把 heartbeat.py / monitor.py 放入 demo_nodes_py 包并 colcon build 后：
ros2 launch multi_node_demo start.launch.py
# 另开终端查看节点：
ros2 node list
```

#### 6.5 ros2 node 指令全览

日常排障最常用的节点相关命令：

```bash
ros2 node list                    # 列出所有节点
ros2 node info /heartbeat         # 查看节点详细信息（话题/服务/参数/动作）
ros2 node list --verbose          # 带类型信息列出
ros2 param list /heartbeat        # 查看节点参数
ros2 param get /heartbeat rate    # 获取单个参数值
ros2 param set /heartbeat rate 2.0  # 运行时修改参数
```

其中 `ros2 node info <节点全名>` 是最重要的诊断命令，它会列出该节点发布/订阅的话题、提供的服务、声明的参数等，排障时第一件事就是看它。

### 七、总结

本篇文章建立了 ROS2 的"最小世界观"：**节点是功能单元，ROS 图是节点组成的协作网络，通信端点（话题/服务/参数/动作）是节点间的连接方式**。我们分别用 Python 与 C++ 创建了最简节点、定时器节点，理解了 `spin` 回调循环的本质与多线程执行器，最后用一个"心跳-监视"双节点项目串起了全部知识。

**关键要点回顾**：

1.  节点全名 = 命名空间 + 节点名，全局唯一。
2.  `spin()` 是单线程串行执行回调，耗时操作会阻塞其他回调。
3.  定时器让节点周期工作，是传感器发布、控制循环的"节拍器"。
4.  参数实现配置与代码分离，运行时可动态修改。
5.  用 `get_logger()` 而非 `print`，用 `ros2 node info` 诊断节点状态。
6.  ROS2 无中心节点，节点经 DDS 自动发现组成 ROS 图，天然支持多机分布式。

### 下一篇预告

下一篇我们搭建**工作空间（Workspace）与 colcon 构建体系**：理解 src/build/install/log 四目录结构，学会创建自定义 package、配置 CMakeLists.txt 与 package.xml，并掌握 `colcon build` 的常用选项（`--packages-select`、`--symlink-install`、`--cmake-args` 等）。届时你的每一个节点都能用 `ros2 run` 正式运行，为后续话题、服务等通信篇目打好工程基础。
