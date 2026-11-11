---
title: "ROS2系列教程：话题Topic通信（下）自定义消息与周期"
abbrlink: ros2-xi-lie-jiao-cheng-hua-ti-topic-tong-xin-xia-zi-ding-yi
date: "2026-09-04 13:44:02"
categories:
    - "ROS2"
tags: []
desc: "定义 .msg/.srv 文件（接口包）→ colcon build 生成类型代码→ 发布者/订阅者 include/import 使用→ ros2 run 运行验证第 4 篇我们定义了（含…"
---
## 本文是 ROS2 系列教程的第 6 篇

> 本文是 ROS2 系列教程的第 6 篇：话题 Topic 通信（下）——自定义消息与周期。上一篇掌握了话题的基本收发，本篇文章解决两个工程化问题：**自定义消息类型的实战使用**（引用第 4 篇的接口包）与**发布周期的精细控制**（固定周期、动态周期、高频率话题）。同时介绍 `ros2 topic` 高级用法与 ros2 bag 数据录制回放。学完你就能构建完整的数据流系统。

### 一、自定义消息实战

#### 1.1 完整链路回顾

自定义消息从定义到使用的完整链路：

```text
定义 .msg/.srv 文件（接口包）
→ colcon build 生成类型代码
→ 发布者/订阅者 include/import 使用
→ ros2 run 运行验证
```

第 4 篇我们定义了 `my_interfaces/msg/RobotStatus.msg`（含 robot_name、battery_level、status_code、stamp）。本篇文章围绕它展开实战。

#### 1.2 Python 使用自定义消息

```python
# py_pkg/robot_publisher.py —— 发布自定义消息
import rclpy
from rclpy.node import Node
from my_interfaces.msg import RobotStatus
from builtin_interfaces.msg import Time

class RobotPublisher(Node):
    def __init__(self):
        super().__init__('robot_publisher')
        # 发布自定义消息类型
        self.pub = self.create_publisher(RobotStatus, 'robot_status', 10)
        self.timer = self.create_timer(1.0, self.publish_status)
        self.battery = 1.0

    def publish_status(self):
        msg = RobotStatus()
        msg.robot_name = 'turtle_01'
        self.battery -= 0.01
        msg.battery_level = self.battery
        msg.status_code = 1
        # 时间戳：取当前系统时间（秒+纳秒）
        msg.stamp = Time()
        now = self.get_clock().now()
        msg.stamp.sec = now.seconds_nanoseconds()[0]
        msg.stamp.nanosec = now.seconds_nanoseconds()[1]
        self.pub.publish(msg)
        self.get_logger().info(
            f'发布: {msg.robot_name} 电量={msg.battery_level:.2f}')

def main():
    rclpy.init()
    node = RobotPublisher()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**Python 嵌套消息赋值**：嵌套的 `stamp` 需要单独 `import Time` 并创建实例；也可以用 `from builtin_interfaces.msg import Time` 后直接 `msg.stamp = Time()`。

#### 1.3 C++ 使用自定义消息

```cpp
// cpp_pkg/src/robot_subscriber.cpp —— 订阅自定义消息
#include "rclcpp/rclcpp.hpp"
#include "my_interfaces/msg/robot_status.hpp"

class RobotSubscriber : public rclcpp::Node
{
public:
  RobotSubscriber() : Node("robot_subscriber")
  {
    sub_ = this->create_subscription<my_interfaces::msg::RobotStatus>(
      "robot_status", 10,
      std::bind(&RobotSubscriber::on_status, this, std::placeholders::_1));
  }

private:
  void on_status(const my_interfaces::msg::RobotStatus::SharedPtr msg)
  {
    // 访问嵌套的 stamp 字段
    auto sec = msg->stamp.sec;
    RCLCPP_INFO(this->get_logger(),
      "收到: %s 电量=%.2f 状态=%d sec=%ld",
      msg->robot_name.c_str(), msg->battery_level,
      msg->status_code, sec);
  }

  rclcpp::Subscription<my_interfaces::msg::RobotStatus>::SharedPtr sub_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<RobotSubscriber>());
  rclcpp::shutdown();
  return 0;
}
```

#### 1.4 依赖接口包的声明

**关键**：使用自定义消息的包必须在 `package.xml` 声明依赖接口包：

```xml
<depend>my_interfaces</depend>
```

C++ 包还要在 `CMakeLists.txt` 里 `find_package`：

```cmake
find_package(my_interfaces REQUIRED)
ament_target_dependencies(robot_subscriber my_interfaces)
```

**构建顺序**：先构建接口包，再构建使用它的包：

```bash
colcon build --packages-select my_interfaces
colcon build --packages-select py_pkg cpp_pkg
```

#### 1.5 常用内置接口快速上手

除了自定义接口，掌握几个高频内置类型：

```text
sensor_msgs/msg/LaserScan      # 激光雷达：ranges 数组 + angle_min/max
sensor_msgs/msg/Image          # 图像：宽高 + 像素编码 + data
geometry_msgs/msg/Twist        # 速度指令：linear + angular
geometry_msgs/msg/PoseStamped  # 带时间戳位姿（导航目标）
nav_msgs/msg/Odometry          # 里程计：位姿 + 速度 + 协方差
std_msgs/msg/Header            # 通用头：时间戳 + frame_id
```

`Header` 是几乎所有消息的公共字段，包含 `stamp`（时间戳）和 `frame_id`（坐标系），用于数据的时间同步与坐标关联：

```python
# 给消息填 Header 的标准姿势
msg.header.stamp = self.get_clock().now().to_msg()
msg.header.frame_id = 'map'
```

### 二、发布周期控制

#### 2.1 固定周期发布

固定周期是传感器、控制循环的标配。两种实现方式：

**方式一：定时器（推荐）**：

```python
# 10Hz 发布（0.1 秒周期）
self.timer = self.create_timer(0.1, self.publish_cb)
```

**方式二：定时器周期 + 消息计数**（控制发布频率）：

```python
# 2Hz 发布：定时器 10Hz 跑，每 5 次发布一次
class ThrottledNode(Node):
    def __init__(self):
        super().__init__('throttled_node')
        self.pub = self.create_publisher(String, 'throttled', 10)
        self.timer = self.create_timer(0.1, self.tick)  # 10Hz
        self.counter = 0

    def tick(self):
        self.counter += 1
        if self.counter % 5 == 0:      # 每 5 拍 → 2Hz
            msg = String()
            msg.data = 'every 0.5s'
            self.pub.publish(msg)
```

#### 2.2 动态周期发布

有些场景需要动态调整频率（如依据处理负载、急停时提高频率）。用 `timer.change_interval` 或重建定时器：

```python
# dynamic_rate.py —— 动态调整发布周期
import rclpy
from rclpy.node import Node
from std_msgs.msg import Float64

class DynamicRateNode(Node):
    def __init__(self):
        super().__init__('dynamic_rate_node')
        self.pub = self.create_publisher(Float64, 'speed', 10)
        self.rate = 1.0                # 当前周期（秒）
        self.timer = self.create_timer(self.rate, self.tick)
        self.count = 0

    def tick(self):
        self.count += 1
        msg = Float64()
        msg.data = float(self.count)
        self.pub.publish(msg)
        # 每 5 拍把周期在 0.5~2.0 秒之间循环
        if self.count % 5 == 0:
            self.rate = 2.0 if self.rate < 1.5 else 0.5
            self.timer.cancel()
            self.timer = self.create_timer(self.rate, self.tick)
            self.get_logger().info(f'周期调整为 {self.rate}s')

def main():
    rclpy.init()
    node = DynamicRateNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**注意**：`create_timer` 创建的定时器对象在重建前要 `cancel()`，避免旧定时器继续触发。

#### 2.3 用 ros2 topic hz 验证实际频率

```bash
# 终端 1：运行动态周期节点
ros2 run py_pkg dynamic_rate_node

# 终端 2：观察实际发布频率（应随周期调整而变化）
ros2 topic hz /speed
# average rate: 2.000 → 变化为 0.500 → 1.000 ...
```

**实际频率 ≠ 设定频率**：受系统负载、回调阻塞影响，实际频率会波动。`ros2 topic hz` 显示的是实测值，是判断"发布是否正常"的金标准。

### 三、高频率话题实战

#### 3.1 100Hz 里程计仿真

控制/导航场景常需要高频数据。写一个 100Hz 的里程计发布器：

```python
# py_pkg/high_freq_odom.py —— 100Hz 里程计仿真
import rclpy
from rclpy.node import Node
from nav_msgs.msg import Odometry
from geometry_msgs.msg import Point, Quaternion

class HighFreqOdom(Node):
    def __init__(self):
        super().__init__('high_freq_odom')
        # 100Hz：0.01 秒周期
        self.pub = self.create_publisher(Odometry, 'odom', 50)  # 队列深一点
        self.timer = self.create_timer(0.01, self.publish_odom)
        self.x = 0.0
        self.t = 0

    def publish_odom(self):
        self.t += 1
        self.x += 0.001   # 每拍前进 1mm
        msg = Odometry()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = 'odom'
        msg.child_frame_id = 'base_link'
        msg.pose.pose.position = Point(x=self.x, y=0.0, z=0.0)
        msg.pose.pose.orientation = Quaternion(x=0., y=0., z=0., w=1.)
        # 简单协方差（第 1 个元素为位置方差）
        msg.pose.covariance[0] = 0.0001
        self.pub.publish(msg)

def main():
    rclpy.init()
    node = HighFreqOdom()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

运行验证：

```bash
ros2 run py_pkg high_freq_odom
ros2 topic hz /odom        # 应显示 ~100.000 Hz
ros2 topic bw /odom        # 查看带宽占用
```

**高频话题的关键配置**：QoS 队列深度要加大（如 50），否则发布快于消费时消息被丢弃；如果消费者处理慢，还要考虑 QoS 的 `history` 策略（第 9 篇详讲）。

#### 3.2 高频下的性能注意点

| 频率 | 注意事项 |
| --- | --- |
| ≤ 10Hz | 常规，无需特殊处理 |
| 10-100Hz | 回调内避免耗时操作；队列深度 ≥ 10 |
| 100-1000Hz | 建议 C++；避免消息内大数组拷贝；考虑 `zero-copy`（QoS 类型适配） |
| > 1000Hz | 考虑共享内存传输（Iceoryx）或降低采样 |

**经验**：Python 在 100Hz 内完全可用；更高频率或大数据量（图像）建议 C++，且回调里只做必要处理，别在回调里写日志（高频日志本身会拖慢系统）。

### 四、ros2 topic 高级用法

#### 4.1 查看 QoS 兼容性

```bash
# 详细查看话题的 QoS 设置
ros2 topic info /odom --verbose
# 输出：Publisher QoS: Reliability: RELIABLE, History: KEEP_LAST, Depth: 50 ...
```

#### 4.2 手动发布复杂类型

```bash
# 发布 Twist 类型（注意嵌套结构写法）
ros2 topic pub /cmd_vel geometry_msgs/msg/Twist \
  "{linear: {x: 0.5, y: 0.0, z: 0.0}, angular: {x: 0.0, y: 0.0, z: 0.2}}" \
  --rate 10

# 发布 Odometry（含 header）
ros2 topic pub /odom nav_msgs/msg/Odometry \
  "{header: {frame_id: 'odom'}, child_frame_id: 'base_link', pose: {pose: {position: {x: 1.0}}}}" \
  --rate 5
```

#### 4.3 用 --qos-reliability 指定 QoS

```bash
# 以 BEST_EFFORT 可靠性订阅（图像/雷达常用）
ros2 topic echo /scan --qos-reliability best_effort

# 以 RELIABLE 发布
ros2 topic pub /chatter std_msgs/msg/String "{data: 'hi'}" --qos-reliability reliable
```

#### 4.4 过滤与采样

```bash
# 只看数据字段（省略 header 等）
ros2 topic echo /odom --field pose.pose.position

# 只显示最近 N 条
ros2 topic echo /odom --once
```

### 五、ros2 bag：数据录制与回放

#### 5.1 录制话题数据

ros2 bag 是 ROS2 的数据记录工具，把话题数据录到磁盘，之后可回放（调试、训练、复现 bug 的利器）：

```bash
# 录制所有话题到默认目录（bag 目录）
ros2 bag record -a

# 只录制指定话题
ros2 bag record /odom /scan /cmd_vel

# 指定输出目录与名称
ros2 bag record /odom -o odom_recording

# 录制时附带 QoS 配置（保证能回放）
ros2 bag record /scan --qos-profile-overrides \
  "{'sensor_msgs::msg::LaserScan': {reliability: 'best_effort'}}"
```

#### 5.2 查看与回放

```bash
# 查看 bag 信息（话题列表、消息数、时长）
ros2 bag info odom_recording

# 回放 bag（默认按原时间戳节奏）
ros2 bag play odom_recording

# 回放指定话题、倍速
ros2 bag play odom_recording --topics /odom --rate 2.0
```

#### 5.3 bag 的典型用途

1.  **离线调试**：录下现场数据，回家慢慢分析。
2.  **算法验证**：同一份数据回放，对比不同参数/算法效果。
3.  **复现 bug**：把异常场景录下来，反复回放定位问题。
4.  **训练数据**：收集传感器数据用于机器学习。

**注意**：bag 回放时会**重新发布**数据（时间戳可能保持原始值），订阅者用 `header.stamp` 时要注意时间可能是过去的。

### 六、实战：完整数据流系统

#### 6.1 系统设计

搭建一个完整数据流系统，串联本篇所有知识点：

```text
sensor_node(100Hz 发 /odom + 10Hz 发 /scan)
    ↓
logger_node(订阅两者，校验时间戳，周期打印)
    ↓
ros2 bag record（录制全程）
    ↓
回放验证
```

#### 6.2 传感器节点（双频双话题）

```python
# py_pkg/dataflow_sensor.py
import rclpy
from rclpy.node import Node
from nav_msgs.msg import Odometry
from sensor_msgs.msg import LaserScan

class DataflowSensor(Node):
    def __init__(self):
        super().__init__('dataflow_sensor')
        self.odom_pub = self.create_publisher(Odometry, 'odom', 50)
        self.scan_pub = self.create_publisher(LaserScan, 'scan', 10)
        # 100Hz 里程计 + 10Hz 雷达
        self.odom_timer = self.create_timer(0.01, self.pub_odom)
        self.scan_timer = self.create_timer(0.1, self.pub_scan)
        self.x = 0.0

    def pub_odom(self):
        self.x += 0.001
        msg = Odometry()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = 'odom'
        msg.child_frame_id = 'base_link'
        msg.pose.pose.position.x = self.x
        self.odom_pub.publish(msg)

    def pub_scan(self):
        msg = LaserScan()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = 'laser'
        msg.angle_min = -3.14159
        msg.angle_max = 3.14159
        msg.angle_increment = 0.01
        msg.range_min = 0.1
        msg.range_max = 10.0
        # 模拟 360 个点（全部 1.0m，模拟圆形房间）
        msg.ranges = [1.0] * 360
        self.scan_pub.publish(msg)

def main():
    rclpy.init()
    node = DataflowSensor()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

#### 6.3 记录节点（双订阅 + 时间戳校验）

```python
# py_pkg/dataflow_logger.py
import rclpy
from rclpy.node import Node
from nav_msgs.msg import Odometry
from sensor_msgs.msg import LaserScan

class DataflowLogger(Node):
    def __init__(self):
        super().__init__('dataflow_logger')
        self.odom_sub = self.create_subscription(
            Odometry, 'odom', self.on_odom, 50)
        self.scan_sub = self.create_subscription(
            LaserScan, 'scan', self.on_scan, 10)
        self.odom_count = 0
        self.scan_count = 0

    def on_odom(self, msg):
        self.odom_count += 1
        # 每 500 拍打印一次，避免刷屏
        if self.odom_count % 500 == 0:
            self.get_logger().info(
                f'odom #{self.odom_count} x={msg.pose.pose.position.x:.2f}')

    def on_scan(self, msg):
        self.scan_count += 1
        if self.scan_count % 10 == 0:
            self.get_logger().info(
                f'scan #{self.scan_count} points={len(msg.ranges)} '
                f'first={msg.ranges[0]:.1f}')

def main():
    rclpy.init()
    node = DataflowLogger()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

#### 6.4 完整运行流程

```bash
# 终端 1：传感器节点
ros2 run py_pkg dataflow_sensor

# 终端 2：记录节点
ros2 run py_pkg dataflow_logger

# 终端 3：验证频率
ros2 topic hz /odom     # ~100Hz
ros2 topic hz /scan     # ~10Hz

# 终端 4：录制 10 秒
ros2 bag record /odom /scan -o dataflow_bag
# 10 秒后 Ctrl+C 停止录制

# 查看录制信息
ros2 bag info dataflow_bag

# 回放
ros2 bag play dataflow_bag
```

**预期结果**：logger 每 5 秒打印一次 odom（500 拍 × 0.01s），每 1 秒打印一次 scan；bag 录制后回放，logger 重新收到数据——证明"数据流 + 录制回放"闭环打通。

### 七、总结

本篇文章把话题通信从"能用"推向"工程可用"：自定义消息的完整使用链路、发布周期的三种控制方式（固定/节流/动态）、高频话题的性能要点、`ros2 topic` 高级命令，以及 ros2 bag 的录制回放。实战部分构建了一个 100Hz+10Hz 双频数据流系统并验证闭环。

**关键要点回顾**：

1.  用自定义消息要在 `package.xml`（及 C++ 的 CMakeLists）声明接口包依赖，构建时先接口包后业务包。
2.  定时器驱动周期发布；动态调频要先 `cancel()` 旧定时器。
3.  `ros2 topic hz` 看实测频率，实际频率 ≠ 设定频率。
4.  高频话题加大 QoS 队列深度；Python 100Hz 内可用，更高用 C++。
5.  `ros2 bag record/play` 录制回放，是离线调试与复现 bug 的利器。
6.  `Header` 是消息的公共字段，承载时间戳与坐标系，跨话题数据同步靠它。

### 下一篇预告

下一篇进入**服务 Service 通信（上）——客户端与服务端**：话题是"单向广播"，服务则是"请求-应答"。我们将理解 Request/Response 模型、同步与异步调用方式，用 Python 与 C++ 实现服务端与客户端，掌握 `ros2 service` 调试命令，并对比"话题 vs 服务"的选型场景。
