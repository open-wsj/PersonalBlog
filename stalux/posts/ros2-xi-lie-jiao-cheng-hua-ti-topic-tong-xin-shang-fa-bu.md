---
title: "ROS2系列教程：话题Topic通信（上）发布者与订阅者"
abbrlink: ros2-xi-lie-jiao-cheng-hua-ti-topic-tong-xin-shang-fa-bu
date: "2026-09-04 13:43:47"
categories:
    - "ROS2"
tags: []
desc: "本篇文章完成了话题通信的入门：理解了 Publish/Subscribe 模型的三大解耦优势、DDS 去中心化发现机制，用 Python 与 C++ 分别实现了发布者/订阅者并验证了跨语言通信…"
---
## 本文是 ROS2 系列教程的第 5 篇

> 本文是 ROS2 系列教程的第 5 篇：话题 Topic 通信（上）——发布者与订阅者。话题是 ROS2 最核心、最常用的通信机制，机器人里的传感器数据、控制指令、状态信息几乎都通过话题流转。本篇文章深入话题的 Publish/Subscribe 模型与去中心化发现机制，用 Python 与 C++ 各实现一套发布者/订阅者，掌握 `create_publisher`、`create_subscription` 与回调机制，最后精通 `ros2 topic` 全套调试命令。

### 一、话题通信的核心思想

#### 1.1 Publish / Subscribe 模型

话题（Topic）采用**发布/订阅（Publish-Subscribe）**模式，核心特点：

-   **发布者（Publisher）**：只负责往话题上发消息，不关心谁在收。
-   **订阅者（Subscriber）**：只负责订阅话题收消息，不关心谁在发。
-   **解耦**：双方互相不知道对方的存在，通过话题名"碰头"。

这种模式的三大优点：

| 优点 | 说明 |
| --- | --- |
| 空间解耦 | 发布者和订阅者不需要互相引用，甚至不在同一台机器 |
| 时间解耦 | 发布者发完消息即可离开，订阅者后加入也能收到后续消息（配合 QoS） |
| 一对多/多对多 | 一个话题可被多个发布者发、多个订阅者收 |

话题通信是**单向**的（数据流从发布者到订阅者）；如果需要请求-应答式的双向通信，用服务（第 7 篇）。需要长任务带反馈，用动作（第 10 篇）。

#### 1.2 话题名与消息类型

话题由**话题名 + 消息类型**双重标识：

```text
话题名（topic name）：/cmd_vel
消息类型（message type）：geometry_msgs/msg/Twist
```

-   **话题名**决定"谁和谁通信"——发布者和订阅者的话题名必须完全一致。
-   **消息类型**决定"传什么数据结构"——类型不一致时 ROS2 会拒绝匹配（严格类型安全）。

**命名规则**：话题名用小写字母、数字、下划线，以 `/` 开头（绝对话题名），如 `/cmd_vel`、`/scan`、`/odom`。带命名空间时如 `/robot1/cmd_vel`。

查看一个话题的信息：

```bash
ros2 topic info /cmd_vel
# Type: geometry_msgs/msg/Twist
# Publisher count: 1
# Subscriber count: 0
```

#### 1.3 从 ROS1 到 ROS2：去中心化

ROS1 的话题通信依赖 `roscore`（Master）做**话题匹配**：发布者向 Master 注册"我要发 /cmd_vel"，订阅者向 Master 注册"我要收 /cmd_vel"，Master 撮合后双方建立 TCP 连接。Master 挂了，整个系统瘫痪。

ROS2 改用 **DDS 自动发现（Discovery）**：

```text
节点启动 → 通过 DDS 组播协议广播自己的存在（含发布/订阅信息）
→ 其他节点收到后回应 → 双方协商 QoS → 建立 P2P 直连 → 开始传输
```

整个流程无需中心节点，新节点随时加入、随时退出，系统天然分布式。这也是 ROS2 支持多机、热插拔、大规模组网的根基。

### 二、Python 发布者与订阅者

#### 2.1 发布者（Publisher）

```python
# py_pkg/py_publisher.py —— Python 发布者
import rclpy
from rclpy.node import Node
from std_msgs.msg import String

class PyPublisher(Node):
    def __init__(self):
        super().__init__('py_publisher')
        # 1. 创建发布者：话题名 + 消息类型 + QoS 队列长度
        self.pub = self.create_publisher(String, 'chatter', 10)
        # 2. 定时器驱动周期性发布
        self.timer = self.create_timer(1.0, self.timer_callback)
        self.count = 0

    def timer_callback(self):
        self.count += 1
        msg = String()
        msg.data = f'Hello from py_publisher #{self.count}'
        # 3. 发布消息
        self.pub.publish(msg)
        self.get_logger().info(f'发布: {msg.data}')

def main():
    rclpy.init()
    node = PyPublisher()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

三个关键步骤：

1.  `create_publisher(类型, 话题名, 队列长度)` —— 第三个参数是 **QoS 深度**（消息队列最多缓存几条，第 9 篇详讲）。
2.  定时器定期触发回调，模拟"传感器周期性发数据"。
3.  `publish(msg)` 真正把消息发出去。

#### 2.2 订阅者（Subscriber）

```python
# py_pkg/py_subscriber.py —— Python 订阅者
import rclpy
from rclpy.node import Node
from std_msgs.msg import String

class PySubscriber(Node):
    def __init__(self):
        super().__init__('py_subscriber')
        # 1. 创建订阅者：话题名 + 消息类型 + 回调函数 + QoS
        self.sub = self.create_subscription(
            String, 'chatter', self.listener_callback, 10)

    def listener_callback(self, msg):
        # 2. 收到消息时自动调用（spin 的循环里执行）
        self.get_logger().info(f'收到: {msg.data}')

def main():
    rclpy.init()
    node = PySubscriber()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**订阅者回调**是话题通信的核心机制：`spin()` 循环不断检查是否有新消息，一旦到达就调用 `listener_callback`。回调在单线程里串行执行，所以回调里不要做耗时操作（回顾第 2 篇）。

#### 2.3 运行一对发布/订阅

```bash
# 终端 1：运行发布者
ros2 run py_pkg py_publisher

# 终端 2：运行订阅者
ros2 run py_pkg py_subscriber
```

订阅者终端会持续打印 `收到: Hello from py_publisher #N`。

**重要现象**：先启动订阅者、后启动发布者，或反过来，**都能正常通信**——这就是 DDS 自动发现的威力：新节点加入的瞬间，双方自动建立连接。

### 三、C++ 发布者与订阅者

#### 3.1 C++ 发布者

```cpp
// cpp_pkg/src/publisher.cpp
#include "rclcpp/rclcpp.hpp"
#include "std_msgs/msg/string.hpp"
#include <chrono>
#include <memory>

using namespace std::chrono_literals;

class CppPublisher : public rclcpp::Node
{
public:
  CppPublisher() : Node("cpp_publisher"), count_(0)
  {
    // 创建发布者：类型 + 话题名 + QoS
    publisher_ = this->create_publisher<std_msgs::msg::String>("chatter", 10);
    timer_ = this->create_wall_timer(1s, std::bind(&CppPublisher::timer_callback, this));
  }

private:
  void timer_callback()
  {
    auto msg = std_msgs::msg::String();
    msg.data = "Hello from cpp_publisher #" + std::to_string(++count_);
    publisher_->publish(msg);   // 发布
    RCLCPP_INFO(this->get_logger(), "发布: %s", msg.data.c_str());
  }

  rclcpp::Publisher<std_msgs::msg::String>::SharedPtr publisher_;
  rclcpp::TimerBase::SharedPtr timer_;
  int count_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<CppPublisher>());
  rclcpp::shutdown();
  return 0;
}
```

#### 3.2 C++ 订阅者

```cpp
// cpp_pkg/src/subscriber.cpp
#include "rclcpp/rclcpp.hpp"
#include "std_msgs/msg/string.hpp"

class CppSubscriber : public rclcpp::Node
{
public:
  CppSubscriber() : Node("cpp_subscriber")
  {
    // 创建订阅者：类型 + 话题名 + 回调 + QoS
    subscription_ = this->create_subscription<std_msgs::msg::String>(
      "chatter", 10,
      std::bind(&CppSubscriber::topic_callback, this, std::placeholders::_1));
  }

private:
  void topic_callback(const std_msgs::msg::String::SharedPtr msg)
  {
    RCLCPP_INFO(this->get_logger(), "收到: %s", msg->data.c_str());
  }

  rclcpp::Subscription<std_msgs::msg::String>::SharedPtr subscription_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<CppSubscriber>());
  rclcpp::shutdown();
  return 0;
}
```

C++ 回调用 `std::bind` 绑定成员函数，消息以 **`SharedPtr`（共享指针）** 传入，避免拷贝。

#### 3.3 双语言混搭通信

ROS2 最重要的特性之一：**消息类型一致即可跨语言通信**。

```bash
# C++ 发布者 + Python 订阅者，或反过来，都能正常通信
ros2 run cpp_pkg publisher      # C++ 发
ros2 run py_pkg py_subscriber   # Python 收
```

因为话题数据在 DDS 层以二进制序列化（CDR 格式）传输，语言只是外衣。这个特性让团队可以自由选择语言：性能敏感模块用 C++，快速迭代模块用 Python。

### 四、常见标准消息类型

ROS2 预置了大量标准消息（`std_msgs`、`geometry_msgs`、`sensor_msgs`、`nav_msgs` 等）。先掌握最常用的几个：

```text
std_msgs/msg/Header           # 时间戳+坐标系id，几乎所有消息都嵌套它
std_msgs/msg/String           # 字符串（示例常用）
std_msgs/msg/Int32            # 32位整数
std_msgs/msg/Float64          # 64位浮点
geometry_msgs/msg/Twist       # 线速度+角速度（/cmd_vel 常用）
geometry_msgs/msg/PoseStamped # 带时间的位姿（导航目标点）
sensor_msgs/msg/LaserScan     # 激光雷达数据
sensor_msgs/msg/Image         # 图像
nav_msgs/msg/Odometry         # 里程计
```

查看消息字段：

```bash
ros2 interface show geometry_msgs/msg/Twist
# Vector3  linear   (x, y, z 线速度)
# Vector3  angular  (x, y, z 角速度)
```

### 五、ros2 topic 全套调试命令

`ros2 topic` 是话题排障的瑞士军刀，务必全部掌握：

```bash
# 1. 列出所有话题
ros2 topic list
ros2 topic list -t            # 带类型显示

# 2. 查看话题信息（类型、发布/订阅者数量）
ros2 topic info /chatter

# 3. 实时回显话题内容（最常用！）
ros2 topic echo /chatter

# 4. 查看话题发布频率
ros2 topic hz /chatter

# 5. 查看话题带宽
ros2 topic bw /chatter

# 6. 手动发布消息（调试神器，不用写代码）
ros2 topic pub /chatter std_msgs/msg/String "{data: 'hello'}" --rate 1
#    --rate 1   每秒发 1 条
#    --once     只发 1 条
#    --times N  发 N 条

# 7. 查看话题的 QoS 设置
ros2 topic info /chatter --verbose
```

**实战演练**：不开任何节点，用 `ros2 topic pub` 发消息 + 另一个终端 `ros2 topic echo` 收消息，验证话题链路；再 `ros2 topic hz` 看频率是否稳定在 1Hz。这套组合能快速判断"是发布端的问题还是订阅端的问题"。

### 六、实战：双话题传感器仿真

#### 6.1 场景设计

模拟一个机器人：`sensor_node` 同时发布**里程计**（`/odom`，整数计数）和**速度指令**（`/cmd_vel`，Twist 消息）；`display_node` 订阅两者并打印。

#### 6.2 传感器节点（双发布者）

```python
# py_pkg/sensor_node.py —— 一个节点两个发布者
import rclpy
from rclpy.node import Node
from std_msgs.msg import Int32
from geometry_msgs.msg import Twist

class SensorNode(Node):
    def __init__(self):
        super().__init__('sensor_node')
        # 两个发布者：不同话题、不同类型
        self.odom_pub = self.create_publisher(Int32, 'odom', 10)
        self.cmd_pub = self.create_publisher(Twist, 'cmd_vel', 10)
        self.timer = self.create_timer(0.5, self.tick)
        self.count = 0

    def tick(self):
        self.count += 1
        # 发里程计
        odom_msg = Int32()
        odom_msg.data = self.count
        self.odom_pub.publish(odom_msg)

        # 发速度指令（每 5 拍换一次方向）
        cmd = Twist()
        cmd.linear.x = 0.5 if (self.count % 10 < 5) else -0.5
        cmd.angular.z = 0.2
        self.cmd_pub.publish(cmd)
        self.get_logger().info(f'odom={self.count} cmd_vx={cmd.linear.x:.2f}')

def main():
    rclpy.init()
    node = SensorNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

#### 6.3 显示节点（双订阅者）

```python
# py_pkg/display_node.py —— 一个节点两个订阅者
import rclpy
from rclpy.node import Node
from std_msgs.msg import Int32
from geometry_msgs.msg import Twist

class DisplayNode(Node):
    def __init__(self):
        super().__init__('display_node')
        self.odom_sub = self.create_subscription(
            Int32, 'odom', self.on_odom, 10)
        self.cmd_sub = self.create_subscription(
            Twist, 'cmd_vel', self.on_cmd, 10)

    def on_odom(self, msg):
        self.get_logger().info(f'里程计: {msg.data}')

    def on_cmd(self, msg):
        self.get_logger().info(f'速度指令: vx={msg.linear.x:.2f} wz={msg.angular.z:.2f}')

def main():
    rclpy.init()
    node = DisplayNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

#### 6.4 运行与验证

```bash
# 终端 1：传感器节点
ros2 run py_pkg sensor_node

# 终端 2：显示节点
ros2 run py_pkg display_node

# 终端 3：可视化整个话题图
ros2 topic list
rqt_graph        # 图形化显示节点-话题连接关系
```

`rqt_graph` 会画出 `sensor_node` 和 `display_node` 两个椭圆，中间两条带箭头的线分别指向 `/odom` 和 `/cmd_vel` 话题节点——这就是"ROS 图"的直观呈现。

#### 6.5 一个节点多个话题的意义

本例演示了 ROS2 的重要设计：**一个节点可以拥有任意多个发布者/订阅者**。真实机器人里，`sensor_node` 可能同时发布 `/scan`、`/odom`、`/imu` 多个话题；订阅端同理。话题与节点是多对多关系，而非一对一。

### 七、常见问题排查

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 订阅者收不到消息 | 话题名或类型不匹配 | `ros2 topic info` 对比双方话题名与类型 |
| 收不到但 `topic info` 正常 | QoS 不兼容 | 双方 QoS 策略要能匹配（第 9 篇） |
| `ros2 topic hz` 无输出 | 发布者没在发 | 检查定时器是否在跑、`publish` 是否被调用 |
| 回调不执行 | spin 没跑或回调阻塞 | 确认有 `spin`；回调内勿做耗时操作 |
| C++ 编译报类型错误 | include 路径或类型名错 | `#include "包名/msg/类型.hpp"`，类型用小写文件名 |
| 消息收发有延迟/抖动 | QoS 深度太小 | 增大队列深度，或调整 QoS（第 9 篇） |

### 八、总结

本篇文章完成了话题通信的入门：理解了 Publish/Subscribe 模型的三大解耦优势、DDS 去中心化发现机制，用 Python 与 C++ 分别实现了发布者/订阅者并验证了跨语言通信，掌握了 `ros2 topic` 全套调试命令，最后通过"传感器-显示"双话题实战巩固了多发布者/多订阅者的能力。

**关键要点回顾**：

1.  话题 = 话题名 + 消息类型，双重标识，类型必须匹配。
2.  发布者 `create_publisher(类型, 话题名, QoS深度)`，订阅者 `create_subscription(类型, 话题名, 回调, QoS深度)`。
3.  订阅者回调由 `spin()` 驱动，回调内勿做耗时操作。
4.  消息类型一致即可跨语言（C++ ↔ Python）通信。
5.  `ros2 topic echo/hz/pub/info` 是排障四件套。
6.  一个节点可有多个发布者/订阅者，话题与节点多对多。

### 下一篇预告

下一篇进阶**话题通信（下）——自定义消息与周期**：发布/订阅的自定义消息类型（引用第 4 篇定义的接口包）、固定周期与动态周期发布、高频率话题的吞吐与延迟、`ros2 topic` 的高级用法（`--qos-reliability`、`--no-arr` 等），以及话题数据的录制与回放（ros2 bag）。学完你将能构建完整的数据流系统。
