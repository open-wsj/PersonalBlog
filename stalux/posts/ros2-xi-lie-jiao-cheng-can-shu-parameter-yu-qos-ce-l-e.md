---
title: "ROS2系列教程：参数Parameter与QoS策略"
abbrlink: ros2-xi-lie-jiao-cheng-can-shu-parameter-yu-qos-ce-l-e
date: "2026-09-04 13:45:33"
categories:
    - "ROS2"
tags: []
desc: "参数（Parameter）是节点的配置项：一个带类型的键值对，运行时可查询、可修改。参数让\"代码与配置分离\"——同样的节点，通过不同参数启动，就能适配不同机器人、不同环境。参数名（parameter…"
---
## 本文是 ROS2 系列教程的第 9 篇

> 本文是 ROS2 系列教程的第 9 篇：参数 Parameter 与 QoS 策略。参数与 QoS 是 ROS2 工程化配置的两大基石：参数让"同一份代码适配不同场景"，QoS 让"通信的可靠性、实时性、历史策略可控"。前半篇系统讲透参数（声明/读取/修改/回调/命令行/yaml 加载），后半篇深入 QoS（可靠性/历史/深度/期限/兼容性）。学完你就能写出可配置、可调优的 ROS2 应用。

### 第一部分：参数 Parameter

### 一、参数系统总览

#### 1.1 什么是参数

**参数（Parameter）** 是节点的配置项：一个带类型的键值对，运行时可查询、可修改。参数让"代码与配置分离"——同样的节点，通过不同参数启动，就能适配不同机器人、不同环境。

参数四要素：

```text
参数名（parameter name）：max_speed
参数值（value）：2.5
参数类型（type）：DOUBLE
所属节点（node）：/robot_controller
```

**参数 vs 变量**：变量是代码内部的，参数是节点对外暴露的、可被命令行/其他节点访问的配置接口。

#### 1.2 参数类型

ROS2 支持六种参数类型：

| 类型 | Python 对应 | C++ 对应 | 示例值 |
| --- | --- | --- | --- |
| BOOL | bool | bool | `true` |
| INTEGER | int | int64_t | `42` |
| DOUBLE | float | double | `3.14` |
| STRING | str | std::string | `"hello"` |
| BYTE_ARRAY | bytes | std::vector<uint8_t> | `[1,2,3]` |
| BOOL/INT/DOUBLE/STRING 数组 | list | std::vector | `[1,2,3]` |

### 二、参数的基本使用

#### 2.1 声明参数（Python）

```python
# param_declare.py —— 声明参数
import rclpy
from rclpy.node import Node

class ParamNode(Node):
    def __init__(self):
        super().__init__('param_node')
        # 声明参数：名称 + 默认值 + 描述（描述需 Humble+）
        self.declare_parameter('robot_name', 'turtle_01', '机器人名称')
        self.declare_parameter('max_speed', 2.5, '最大线速度')
        self.declare_parameter('enable_safety', True, '是否启用安全功能')
        self.declare_parameter('sensor_ids', [1, 2, 3], '传感器ID列表')

        # 读取参数（返回 Parameter 对象，用 .value 取原始值）
        self.robot_name = self.get_parameter('robot_name').value
        self.max_speed = self.get_parameter('max_speed').value
        self.enable_safety = self.get_parameter('enable_safety').value
        self.sensor_ids = self.get_parameter('sensor_ids').value

        self.get_logger().info(
            f'机器人={self.robot_name} 速度={self.max_speed} '
            f'安全={self.enable_safety} 传感器={self.sensor_ids}')

def main():
    rclpy.init()
    node = ParamNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**注意**：**未声明就读取会抛异常**（`ParameterNotDeclaredException`）。ROS2 要求先 `declare_parameter` 再 `get_parameter`。

#### 2.2 声明参数（C++）

```cpp
// cpp_pkg/src/param_node.cpp
#include "rclcpp/rclcpp.hpp"

class ParamNode : public rclcpp::Node
{
public:
  ParamNode() : Node("param_node_cpp")
  {
    // 声明参数
    this->declare_parameter("robot_name", "turtle_01");
    this->declare_parameter("max_speed", 2.5);
    this->declare_parameter("enable_safety", true);
    this->declare_parameter("sensor_ids", std::vector<int64_t>{1, 2, 3});

    // 读取参数（按类型取）
    auto name = this->get_parameter("robot_name").as_string();
    auto speed = this->get_parameter("max_speed").as_double();
    auto safety = this->get_parameter("enable_safety").as_bool();
    auto ids = this->get_parameter("sensor_ids").as_integer_array();

    RCLCPP_INFO(this->get_logger(),
      "机器人=%s 速度=%.2f 安全=%d",
      name.c_str(), speed, safety);
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

C++ 读取后要用 `as_string()`、`as_double()`、`as_bool()`、`as_integer_array()` 等方法显式转类型；类型不匹配会抛异常。

### 三、参数的命令行操作

#### 3.1 启动时设置参数

```bash
# 用 -p 传参数（可多个）
ros2 run py_pkg param_node \
  --ros-args -p robot_name:=my_rover -p max_speed:=3.0

# 从 yaml 文件加载参数
ros2 run py_pkg param_node --ros-args --params-file config/params.yaml
```

#### 3.2 运行时查看与修改

```bash
# 列出节点的所有参数
ros2 param list /param_node

# 获取单个参数
ros2 param get /param_node max_speed

# 运行时修改参数（立即生效，如果节点注册了回调）
ros2 param set /param_node max_speed 4.0

# 查看参数描述（含类型）
ros2 param describe /param_node max_speed

# 删除参数（仅未声明为必须的）
ros2 param delete /param_node temp_param
```

**注意**：`ros2 param set` 修改的参数**不会**写回 yaml 文件，重启节点后恢复默认值。

#### 3.3 查看所有节点的参数

```bash
# 列出所有节点及其参数（全局视图）
ros2 param list
```

### 四、参数回调（参数变更监听）

#### 4.1 为什么需要参数回调

运行时 `ros2 param set` 修改参数后，如果节点不监听变化，新值不会生效。**参数回调**在参数被修改时触发，让节点动态响应配置变化（如在线调 PID 增益、切换模式）。

#### 4.2 Python 参数回调

```python
# param_callback.py —— 参数变更回调
import rclpy
from rclpy.node import Node

class ParamCallbackNode(Node):
    def __init__(self):
        super().__init__('param_callback_node')
        self.declare_parameter('max_speed', 2.5)
        # 注册参数回调：返回 SetParametersResult
        self.add_on_set_parameters_callback(self.on_param_change)
        self.current_speed = self.get_parameter('max_speed').value
        self.get_logger().info(f'初始速度: {self.current_speed}')

    def on_param_change(self, params):
        for param in params:
            if param.name == 'max_speed':
                if param.value > 10.0:
                    self.get_logger().warn(f'速度 {param.value} 过大，拒绝！')
                    return rclpy.parameter.SetParametersResult(successful=False)
                self.current_speed = param.value
                self.get_logger().info(f'速度已更新为: {self.current_speed}')
        return rclpy.parameter.SetParametersResult(successful=True)

def main():
    rclpy.init()
    node = ParamCallbackNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**回调返回值决定成败**：返回 `successful=False` 会**拒绝**该次参数修改（命令行会报错）。这是参数校验的官方机制——非法值在这里拦截。

#### 4.3 验证参数回调

```bash
# 运行节点
ros2 run py_pkg param_callback_node

# 合法修改 → 成功
ros2 param set /param_callback_node max_speed 5.0
# 非法修改 → 被拒绝
ros2 param set /param_callback_node max_speed 20.0
# Set parameter failed: ...  (回调返回 False)
```

#### 4.4 C++ 参数回调

```cpp
// cpp_pkg/src/param_callback.cpp
#include "rclcpp/rclcpp.hpp"

class ParamCallbackNode : public rclcpp::Node
{
public:
  ParamCallbackNode() : Node("param_callback_cpp")
  {
    this->declare_parameter("max_speed", 2.5);
    // 注册回调
    auto cb = [this](const std::vector<rclcpp::Parameter>& params) {
      for (const auto& p : params) {
        if (p.get_name() == "max_speed") {
          if (p.as_double() > 10.0) {
            RCLCPP_WARN(this->get_logger(), "速度过大，拒绝");
            return rcl_interfaces::msg::SetParametersResult{false, "too large"};
          }
          RCLCPP_INFO(this->get_logger(), "速度更新为: %.2f", p.as_double());
        }
      }
      return rcl_interfaces::msg::SetParametersResult{true, ""};
    };
    this->set_on_parameters_set_callback(cb);
  }
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<ParamCallbackNode>());
  rclcpp::shutdown();
  return 0;
}
```

### 五、YAML 参数文件

#### 5.1 参数文件格式

YAML 参数文件按节点组织：

```yaml
# config/params.yaml
robot_controller:            # 节点名（不带命名空间）
  ros__parameters:
    robot_name: "turtle_01"
    max_speed: 2.5
    enable_safety: true
    sensor_ids: [1, 2, 3]
    pid_gains:
      p: 1.0
      i: 0.1
      d: 0.01
```

**注意**：节点名要与 `create_node` 的名字**完全一致**（含命名空间时用 `/ns/node` 写法）。顶层是节点名，下一层是 `ros__parameters`。

#### 5.2 加载参数文件

```bash
# 启动时加载
ros2 run py_pkg param_node --ros-args --params-file config/params.yaml

# launch 文件里加载（第 11 篇详讲）
```

#### 5.3 导出当前参数为 yaml

```bash
# 把节点当前参数导出成 yaml 文件（备份/分享配置）
ros2 param dump /param_node > config/dump.yaml
```

#### 5.4 嵌套参数（字典）

嵌套参数用于组织复杂配置（如 PID 增益组）：

```python
# Python 读取嵌套参数
p_gain = self.get_parameter('pid_gains.p').value   # 点号访问
i_gain = self.get_parameter('pid_gains.i').value
```

### 第二部分：QoS 策略

### 六、QoS 是什么

#### 6.1 质量服务（Quality of Service）

**QoS（服务质量）** 决定 ROS2 通信的**可靠性、实时性与历史策略**。DDS 之所以强大，就是因为它把"传输策略"开放给应用层配置。

QoS 的核心策略（Humble 常用）：

| 策略 | 取值 | 含义 |
| --- | --- | --- |
| Reliability | RELIABLE / BEST_EFFORT | 可靠（重传保证送达）/ 尽力（快但可能丢） |
| History | KEEP_LAST / KEEP_ALL | 保留最近 N 条 / 保留全部 |
| Depth | 整数 | KEEP_LAST 的队列深度 |
| Durability | VOLATILE / TRANSIENT_LOCAL | 只收新消息 / 也收历史消息（晚加入的订阅者） |
| Deadline | 时长 | 最大允许消息间隔（超时告警） |
| Liveliness | AUTOMATIC / MANUAL | 节点存活检测 |

#### 6.2 三种预置 QoS 档位

```python
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from rclpy.qos import qos_profile_sensor_data, qos_profile_system_default

# 1. 传感器数据档（BEST_EFFORT + KEEP_LAST(5)）：图像/雷达常用
#    丢几帧没关系，要的是低延迟
qos_profile_sensor_data

# 2. 默认档（RELIABLE + KEEP_LAST(10)）：控制指令等关键数据
#    保证送达，延迟可接受

# 3. 系统默认档：节点默认行为
qos_profile_system_default
```

### 七、QoS 配置实战

#### 7.1 自定义 QoS（Python）

```python
# qos_demo.py —— 自定义 QoS
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy, DurabilityPolicy
from std_msgs.msg import String

class QosNode(Node):
    def __init__(self):
        super().__init__('qos_node')
        # 自定义 QoS：可靠 + 保留最近 20 条 + 瞬态本地
        qos = QoSProfile(
            reliability=ReliabilityPolicy.RELIABLE,
            history=HistoryPolicy.KEEP_LAST,
            depth=20,
            durability=DurabilityPolicy.TRANSIENT_LOCAL,
        )
        self.pub = self.create_publisher(String, 'qos_topic', qos)
        self.sub = self.create_subscription(String, 'qos_topic', self.on_msg, qos)
        self.timer = self.create_timer(1.0, self.tick)

    def tick(self):
        msg = String(); msg.data = 'qos test'
        self.pub.publish(msg)

    def on_msg(self, msg):
        self.get_logger().info(f'收到: {msg.data}')

def main():
    rclpy.init()
    node = QosNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

#### 7.2 传感器数据专用 QoS（C++）

```cpp
// cpp_pkg/src/qos_sensor.cpp —— 传感器 QoS 订阅
#include "rclcpp/rclcpp.hpp"
#include "sensor_msgs/msg/laser_scan.hpp"

class ScanSubscriber : public rclcpp::Node
{
public:
  ScanSubscriber() : Node("scan_subscriber")
  {
    // BEST_EFFORT：激光雷达丢帧可接受，要低延迟
    auto qos = rclcpp::QoS(rclcpp::KeepLast(5))
        .best_effort()
        .durability_volatile();
    sub_ = this->create_subscription<sensor_msgs::msg::LaserScan>(
      "scan", qos,
      std::bind(&ScanSubscriber::on_scan, this, std::placeholders::_1));
  }

private:
  void on_scan(const sensor_msgs::msg::LaserScan::SharedPtr msg)
  {
    RCLCPP_INFO(this->get_logger(), "收到 %zu 个扫描点", msg->ranges.size());
  }

  rclcpp::Subscription<sensor_msgs::msg::LaserScan>::SharedPtr sub_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<ScanSubscriber>());
  rclcpp::shutdown();
  return 0;
}
```

#### 7.3 QoS 兼容性规则（重要！）

**发布端与订阅端的 QoS 必须兼容才能通信**。核心规则：

| 发布端 \ 订阅端 | RELIABLE | BEST_EFFORT |
| --- | --- | --- |
| RELIABLE | ✅ 兼容 | ✅ 兼容（订阅端降级） |
| BEST_EFFORT | ❌ 不兼容 | ✅ 兼容 |

```text
规则 1：Reliability 要求发布端 >= 订阅端（RELIABLE 发，BEST_EFFORT 收 OK；反向不 OK）
规则 2：Depth 等其余策略取双方协商值（取更宽松）
规则 3：Durability TRANSIENT_LOCAL 的发布者，晚加入订阅者也能收到历史消息
```

**经典踩坑**：雷达发布端用 BEST_EFFORT，你的订阅端用默认 RELIABLE → **收不到数据**！这正是 `ros2 topic echo /scan` 能收、自己代码收不到的常见原因。

#### 7.4 查看与调试 QoS

```bash
# 查看话题的完整 QoS 信息（含发布/订阅端各自的设置）
ros2 topic info /scan --verbose

# 用命令行按指定 QoS 订阅测试
ros2 topic echo /scan --qos-reliability best_effort
```

### 八、实战：可配置传感器节点

#### 8.1 设计目标

综合参数 + QoS：一个可配置的传感器发布器，参数控制频率/名称/队列深度，QoS 策略可选。

```python
# py_pkg/configurable_sensor.py
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from sensor_msgs.msg import LaserScan

class ConfigurableSensor(Node):
    def __init__(self):
        super().__init__('configurable_sensor')
        # 参数：频率、名称、QoS 可靠性、队列深度
        self.declare_parameter('rate', 10.0)
        self.declare_parameter('frame_id', 'laser')
        self.declare_parameter('reliability', 'best_effort')  # or 'reliable'
        self.declare_parameter('queue_depth', 10)

        rate = self.get_parameter('rate').value
        frame = self.get_parameter('frame_id').value
        rel = self.get_parameter('reliability').value
        depth = self.get_parameter('queue_depth').value

        # 按参数构建 QoS
        qos = QoSProfile(
            reliability=ReliabilityPolicy.BEST_EFFORT if rel == 'best_effort'
                        else ReliabilityPolicy.RELIABLE,
            history=HistoryPolicy.KEEP_LAST,
            depth=depth,
        )
        self.pub = self.create_publisher(LaserScan, 'scan', qos)
        self.timer = self.create_timer(1.0 / rate, self.publish_scan)
        self.frame_id = frame
        self.get_logger().info(
            f'传感器启动: rate={rate}Hz frame={frame} qos={rel} depth={depth}')

    def publish_scan(self):
        msg = LaserScan()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = self.frame_id
        msg.angle_min = -3.14; msg.angle_max = 3.14
        msg.angle_increment = 0.01745
        msg.range_min = 0.1; msg.range_max = 10.0
        msg.ranges = [1.0] * 360
        self.pub.publish(msg)

def main():
    rclpy.init()
    node = ConfigurableSensor()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

#### 8.2 不同配置启动

```bash
# 默认（10Hz, best_effort）
ros2 run py_pkg configurable_sensor

# 自定义：20Hz + reliable + 队列 50
ros2 run py_pkg configurable_sensor \
  --ros-args \
  -p rate:=20.0 \
  -p reliability:=reliable \
  -p queue_depth:=50

# 查看实际 QoS
ros2 topic info /scan --verbose
```

#### 8.3 配置与代码分离的价值

同一个节点二进制，通过参数就能适配：低速低成本场景（5Hz）、高速场景（50Hz）、可靠性敏感场景（RELIABLE）。**发布部署时无需改代码，只需改配置**——这就是参数系统的工程价值。

### 九、常见问题排查

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `ParameterNotDeclaredException` | 未声明就读取 | 先 `declare_parameter` |
| `ros2 param set` 无效 | 没注册参数回调 | `add_on_set_parameters_callback` |
| 收不到话题数据 | QoS 不兼容（最常见！） | `ros2 topic info --verbose` 对比双方 QoS |
| BEST_EFFORT 发 RELIABLE 收 | 发布端尽力、订阅端可靠 | 订阅端改用 best_effort |
| 晚加入收不到历史消息 | Durability 为 VOLATILE | 发布端用 TRANSIENT_LOCAL |
| 队列丢消息 | Depth 太小 | 增大 KEEP_LAST 深度 |

### 十、总结

本篇文章系统覆盖了两大工程化主题：参数（声明/读取/回调/命令行/yaml/嵌套）与 QoS（四大策略/预置档位/兼容规则/调试）。实战中的可配置传感器节点展示了"配置与代码分离"的完整范式。

**关键要点回顾**：

1.  参数先声明后读取；`declare_parameter(名称, 默认值)` 是标准姿势。
2.  参数回调返回 `SetParametersResult(successful=False)` 可拒绝非法修改。
3.  `--ros-args -p 名:=值` 启动时传参；`--params-file` 加载 yaml；`ros2 param dump` 导出。
4.  QoS 四大策略：Reliability（可靠/尽力）、History（保留方式）、Depth（深度）、Durability（持久性）。
5.  兼容性核心规则：发布端 Reliability 必须 >= 订阅端；RELIABLE 发可配 BEST_EFFORT 收，反向不行。
6.  收不到数据第一排查项：`ros2 topic info /话题 --verbose` 看 QoS 是否匹配。

### 下一篇预告

下一篇进入 **Action 动作通信**：话题是单向流、服务是一问一答，而**动作（Action）**解决"长任务 + 进度反馈 + 可取消"——导航到目标点、机械臂抓取这类任务的标准范式。我们将理解 Goal/Feedback/Result 三通道模型，用 Python 与 C++ 实现动作服务端与客户端，掌握 `ros2 action` 命令，并对比三种通信方式的选型。
