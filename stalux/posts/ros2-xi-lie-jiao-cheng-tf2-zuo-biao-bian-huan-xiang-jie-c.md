---
title: "ROS2系列教程：tf2坐标变换详解（C++/Python）"
abbrlink: ros2-xi-lie-jiao-cheng-tf2-zuo-biao-bian-huan-xiang-jie-c
date: "2026-09-05 15:49:53"
categories:
    - "ROS2"
tags: []
desc: "查询” = 给定两个坐标系，返回它们之间的变换。例如：激光雷达检测到前方 1 米的墙（在laser坐标系），要换算到map坐标系，就需要的变换。"
---
## 本文是 ROS2 系列教程的第 14 篇

> 本文是 ROS2 系列教程的第 14 篇：tf2 坐标变换详解。上一篇我们打完了位姿与坐标变换的数学地基（旋转矩阵/欧拉角/四元数/齐次变换矩阵），本篇把这些数学变成 ROS2 里可用的管道：`tf2_ros` 的**广播（broadcast）**与**监听（lookup）**。学完你将能发布静态/动态坐标变换、查询任意两个坐标系之间的变换、看懂 `tf2_echo` 与 `tf2_views_frames` 的输出，并解决 “Unknown frame”、“Could not find transform” 等经典报错。

### 一、tf2 是什么

#### 1.1 从数学到框架

第 13 篇我们学会用 4×4 齐次变换矩阵描述"一个坐标系相对另一个坐标系"。但真实机器人上有几十个坐标系：`base_link`（底盘）、`laser`（激光雷达）、`camera`（相机）、`map`（地图）、`odom`（里程计）……如果每个模块都自己管理"坐标系之间的变换矩阵"，系统会迅速乱成一团。

**tf2 就是 ROS2 的"坐标变换中央管理库"**：

-   每个"谁和谁是父子关系、相对位置姿态是多少"的变换，由持有者**广播**出去。
-   所有广播的变换汇聚成一棵 **TF 树**（TF Tree）。
-   任何节点都可以**查询**树上任意两个坐标系之间的变换，不用关心它由谁发布。

一句话：**tf2 = 广播 + 树 + 查询**。

#### 1.2 核心概念

| 概念 | 说明 | 对应 API |
| --- | --- | --- |
| TransformBroadcaster | 广播变换的节点组件 | `tf2_ros::TransformBroadcaster` / `TransformBroadcaster` |
| StaticTransformBroadcaster | 广播**静态**（不变）变换 | `tf2_ros::StaticTransformBroadcaster` |
| Buffer | 缓存所有收到的变换（时间戳索引） | `tf2_ros::Buffer` |
| TransformListener | 订阅 TF 话题并把数据写入 Buffer | `tf2_ros::TransformListener` |
| lookupTransform | 查询两坐标系间的变换 | `buffer_.lookupTransform(...)` |
| 帧 / frame | 坐标系的名字，如 `base_link` | `frame_id` / `child_frame_id` |

#### 1.3 消息类型：TransformStamped

tf2 广播/监听的消息是 `tf2_msgs/msg/TFMessage`，其中包含一个或多个 `geometry_msgs/msg/TransformStamped`：

```
geometry_msgs/msg/TransformStamped
├── Header header
│   ├── uint32 seq
│   ├── time stamp       # 变换生效的时间
│   └── string frame_id  # 父坐标系
├── string child_frame_id  # 子坐标系
└── Transform transform
    ├── Vector3 translation  # 平移 x, y, z
    └── Quaternion rotation  # 旋转（四元数）
```

**读法**：“在 `frame_id`（父）坐标系下，`child_frame_id`（子）坐标系位于 translation 处、朝向 rotation”。

**必须理解的约定**：tf2 只存**父→子**方向的变换，即 `T_child ← parent`。查询时你指定"from 哪个、to 哪个"，tf2 沿树自动做矩阵链乘法（第 13 篇的 `T_C←A = T_C←B · T_B←A`）。

#### 1.4 TF 话题与时间戳

-   动态变换发布在话题 `/tf`。
-   静态变换发布在话题 `/tf_static`（且一般用**latching/transient_local QoS**，后订阅者也能收到）。
-   每个变换带时间戳 `header.stamp`。Buffer 会按时间缓存，查询时可指定"在某个时刻的变换"。

**常见困惑**：为什么查询报 “time out”？因为 Buffer 默认只保留约 10 秒的历史，且查询 `now()` 时刻的变换要求发布者此刻刚发过数据。机器人刚启动、数据还没到达时查询，就会超时。

### 二、发布静态变换（最简单起步）

静态变换 = 坐标关系固定不变。典型例子：**激光雷达装在底盘上的固定位置**（不会动）。

#### 2.1 用命令行发布静态变换

```bash
ros2 run tf2_ros static_transform_publisher 0.1 0.0 0.2 0 0 0 base_link laser
```

参数含义（前 3 个平移，后 3 个旋转欧拉角**弧度**，然后是父子坐标系）：

-   `0.1 0.0 0.2`：laser 相对 base_link 平移 (0.1, 0, 0.2) 米
-   `0 0 0`：roll/pitch/yaw 都是 0（朝向一致）
-   `base_link`：父坐标系
-   `laser`：子坐标系

查看是否发布成功：

```bash
ros2 topic echo /tf_static --once
ros2 run tf2_ros tf2_echo base_link laser
```

`tf2_echo` 输出示例：

```
At time 0.00
- Translation: [0.100, 0.000, 0.200]
- Rotation: in Quaternion [0.000, 0.000, 0.000, 1.000]
```

#### 2.2 用 C++ 发布静态变换

创建包 `tf2_demo`（CMake）：

```cpp
// static_broadcaster.cpp：发布 base_link -> laser 的静态变换
#include <rclcpp/rclcpp.hpp>
#include <tf2_ros/static_transform_broadcaster.h>
#include <geometry_msgs/msg/transform_stamped.hpp>
#include <tf2/LinearMath/Quaternion.h>

class StaticBroadcaster : public rclcpp::Node
{
public:
  StaticBroadcaster() : Node("static_broadcaster")
  {
    tf_broadcaster_ = std::make_shared<tf2_ros::StaticTransformBroadcaster>(this);

    geometry_msgs::msg::TransformStamped t;
    t.header.stamp = this->now();
    t.header.frame_id = "base_link";   // 父
    t.child_frame_id = "laser";        // 子
    t.transform.translation.x = 0.1;
    t.transform.translation.y = 0.0;
    t.transform.translation.z = 0.2;

    tf2::Quaternion q;
    q.setRPY(0.0, 0.0, 0.0);           // 弧度
    t.transform.rotation.x = q.x();
    t.transform.rotation.y = q.y();
    t.transform.rotation.z = q.z();
    t.transform.rotation.w = q.w();

    tf_broadcaster_->sendTransform(t);
    RCLCPP_INFO(this->get_logger(),
      "已发布静态变换 base_link -> laser (0.1, 0, 0.2)");
  }

private:
  std::shared_ptr<tf2_ros::StaticTransformBroadcaster> tf_broadcaster_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  auto node = std::make_shared<StaticBroadcaster>();
  rclcpp::spin(node);          // 静态广播也要保持节点活着
  rclcpp::shutdown();
  return 0;
}
```

`CMakeLists.txt` 要点：

```cmake
find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(tf2 REQUIRED)
find_package(tf2_ros REQUIRED)
find_package(geometry_msgs REQUIRED)

add_executable(static_broadcaster src/static_broadcaster.cpp)
ament_target_dependencies(static_broadcaster rclcpp tf2 tf2_ros geometry_msgs)
install(TARGETS static_broadcaster DESTINATION lib/${PROJECT_NAME})
```

运行：

```bash
colcon build --packages-select tf2_demo
source install/setup.bash
ros2 run tf2_demo static_broadcaster
```

另开终端验证：

```bash
ros2 run tf2_ros tf2_echo base_link laser
```

#### 2.3 用 Python 发布静态变换

```python
#!/usr/bin/env python3
"""static_broadcaster_py.py：发布 base_link -> laser 静态变换"""
import rclpy
from rclpy.node import Node
from tf2_ros import StaticTransformBroadcaster
from geometry_msgs.msg import TransformStamped

class StaticBroadcaster(Node):
    def __init__(self):
        super().__init__('static_broadcaster_py')
        self.tf_broadcaster = StaticTransformBroadcaster(self)

        t = TransformStamped()
        t.header.stamp = self.get_clock().now().to_msg()
        t.header.frame_id = 'base_link'
        t.child_frame_id = 'laser'
        t.transform.translation.x = 0.1
        t.transform.translation.y = 0.0
        t.transform.translation.z = 0.2
        # 零旋转：w=1, x=y=z=0
        t.transform.rotation.x = 0.0
        t.transform.rotation.y = 0.0
        t.transform.rotation.z = 0.0
        t.transform.rotation.w = 1.0

        self.tf_broadcaster.sendTransform(t)
        self.get_logger().info('已发布静态变换 base_link -> laser')

def main(args=None):
    rclpy.init(args=args)
    node = StaticBroadcaster()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**两个语言的区别**：C++ 用 `tf2::Quaternion` 设姿态后取分量；Python 直接填 `rotation.x/y/z/w`。都遵守"w 在最后、弧度制、单位四元数"。

### 三、发布动态变换（机器人移动）

静态变换不够——机器人**边跑边变**。典型例子：里程计不断更新 `odom -> base_link` 的变换。

#### 3.1 C++ 动态广播（定时更新）

```cpp
// dynamic_broadcaster.cpp：模拟机器人移动，周期性广播 odom -> base_link
#include <rclcpp/rclcpp.hpp>
#include <tf2_ros/transform_broadcaster.h>
#include <geometry_msgs/msg/transform_stamped.hpp>
#include <tf2/LinearMath/Quaternion.h>
#include <chrono>

class DynamicBroadcaster : public rclcpp::Node
{
public:
  DynamicBroadcaster() : Node("dynamic_broadcaster"), x_(0.0), yaw_(0.0)
  {
    tf_broadcaster_ = std::make_shared<tf2_ros::TransformBroadcaster>(this);
    timer_ = this->create_wall_timer(
      std::chrono::milliseconds(100),   // 10 Hz
      std::bind(&DynamicBroadcaster::timer_cb, this));
  }

private:
  void timer_cb()
  {
    // 模拟：每 100ms 前进 0.01 m 并转 0.005 rad
    x_ += 0.01;
    yaw_ += 0.005;

    geometry_msgs::msg::TransformStamped t;
    t.header.stamp = this->now();       // 必须用当前时间！
    t.header.frame_id = "odom";
    t.child_frame_id = "base_link";
    t.transform.translation.x = x_;
    t.transform.translation.y = 0.0;
    t.transform.translation.z = 0.0;

    tf2::Quaternion q;
    q.setRPY(0.0, 0.0, yaw_);
    t.transform.rotation.x = q.x();
    t.transform.rotation.y = q.y();
    t.transform.rotation.z = q.z();
    t.transform.rotation.w = q.w();

    tf_broadcaster_->sendTransform(t);
  }

  std::shared_ptr<tf2_ros::TransformBroadcaster> tf_broadcaster_;
  rclcpp::TimerBase::SharedPtr timer_;
  double x_, yaw_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<DynamicBroadcaster>());
  rclcpp::shutdown();
  return 0;
}
```

验证（`tf2_echo` 会持续输出变化的变换）：

```bash
ros2 run tf2_demo dynamic_broadcaster
ros2 run tf2_ros tf2_echo odom base_link
```

#### 3.2 Python 动态广播

```python
#!/usr/bin/env python3
"""dynamic_broadcaster_py.py：周期性广播 odom -> base_link"""
import rclpy
from rclpy.node import Node
from tf2_ros import TransformBroadcaster
from geometry_msgs.msg import TransformStamped
from tf_transformations import quaternion_from_euler

class DynamicBroadcaster(Node):
    def __init__(self):
        super().__init__('dynamic_broadcaster_py')
        self.tf_broadcaster = TransformBroadcaster(self)
        self.timer = self.create_timer(0.1, self.timer_cb)   # 10 Hz
        self.x = 0.0
        self.yaw = 0.0

    def timer_cb(self):
        self.x += 0.01
        self.yaw += 0.005

        t = TransformStamped()
        t.header.stamp = self.get_clock().now().to_msg()
        t.header.frame_id = 'odom'
        t.child_frame_id = 'base_link'
        t.transform.translation.x = self.x
        t.transform.translation.y = 0.0
        t.transform.translation.z = 0.0

        q = quaternion_from_euler(0.0, 0.0, self.yaw)   # [x,y,z,w]
        t.transform.rotation.x = q[0]
        t.transform.rotation.y = q[1]
        t.transform.rotation.z = q[2]
        t.transform.rotation.w = q[3]

        self.tf_broadcaster.sendTransform(t)

def main(args=None):
    rclpy.init(args=args)
    node = DynamicBroadcaster()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
```

#### 3.3 动态 vs 静态的区别

|  | 静态变换 | 动态变换 |
| --- | --- | --- |
| 话题 | `/tf_static` | `/tf` |
| 频率 | 一次（或低频） | 高频（10-100 Hz） |
| 典型例子 | 传感器安装位姿 | 里程计/关节运动 |
| API | `StaticTransformBroadcaster` | `TransformBroadcaster` |
| QoS | transient_local（后订阅者可收到） | volatile（默认） |

### 四、监听与查询变换（核心用法）

发布是为了查询。这一节是最常用、最核心的 API：**TransformListener + Buffer + lookupTransform**。

#### 4.1 什么是"查询"

“查询” = 给定两个坐标系，返回它们之间的变换。例如：激光雷达检测到前方 1 米的墙（在 `laser` 坐标系），要换算到 `map` 坐标系，就需要 `map <- laser` 的变换。

#### 4.2 C++ 监听并查询

```cpp
// tf_listener.cpp：监听 TF，周期性查询 map -> laser 变换
#include <rclcpp/rclcpp.hpp>
#include <tf2_ros/transform_listener.h>
#include <tf2_ros/buffer.h>
#include <geometry_msgs/msg/transform_stamped.hpp>
#include <chrono>

class TfListener : public rclcpp::Node
{
public:
  TfListener() : Node("tf_listener"), tf_buffer_(this->get_clock())
  {
    tf_listener_ = std::make_shared<tf2_ros::TransformListener>(tf_buffer_);
    timer_ = this->create_wall_timer(
      std::chrono::seconds(1),
      std::bind(&TfListener::timer_cb, this));
  }

private:
  void timer_cb()
  {
    try {
      // 查询"从 laser 到 map 的变换"（把 laser 下的点变换到 map）
      auto transform = tf_buffer_.lookupTransform(
        "map", "laser", tf2::TimePointZero, std::chrono::seconds(1));
      RCLCPP_INFO(this->get_logger(),
        "map <- laser: 平移(%.3f, %.3f, %.3f)",
        transform.transform.translation.x,
        transform.transform.translation.y,
        transform.transform.translation.z);
    } catch (const tf2::TransformException & ex) {
      RCLCPP_WARN(this->get_logger(), "查询失败: %s", ex.what());
    }
  }

  tf2_ros::Buffer tf_buffer_;
  std::shared_ptr<tf2_ros::TransformListener> tf_listener_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<TfListener>());
  rclcpp::shutdown();
  return 0;
}
```

**关键 API 细节**：

1.  `tf2_ros::Buffer` 构造要传时钟：`Buffer(this->get_clock())`。
2.  `TransformListener` 必须**持有**（存成员），否则析构后收不到数据。
3.  `lookupTransform(target, source, time, timeout)`：
    -   `target` = 目标坐标系（变换结果在这个坐标系下表达）
    -   `source` = 源坐标系（要变换的点所在坐标系）
    -   结果含义：把 source 下的点变换到 target 下需要乘以的矩阵。
4.  `tf2::TimePointZero` = 查询"最新"变换；也可传具体时间戳。
5.  **必须 try-catch**：坐标系不存在/变换超时都会抛异常，不捕获会崩。

**顺序记忆**：`lookupTransform("目标", "源")`，结果是把"源"变换到"目标"。很多人搞反，记住"**从源到目标**"。

#### 4.3 Python 监听并查询

```python
#!/usr/bin/env python3
"""tf_listener_py.py：监听 TF，查询 map -> laser"""
import rclpy
from rclpy.node import Node
from tf2_ros import TransformListener, Buffer

class TfListener(Node):
    def __init__(self):
        super().__init__('tf_listener_py')
        self.tf_buffer = Buffer()
        self.tf_listener = TransformListener(self.tf_buffer, self)
        self.timer = self.create_timer(1.0, self.timer_cb)

    def timer_cb(self):
        try:
            # 从 laser 变换到 map
            transform = self.tf_buffer.lookup_transform(
                'map', 'laser', rclpy.time.Time())
            t = transform.transform.translation
            self.get_logger().info(
                'map <- laser: 平移(%.3f, %.3f, %.3f)',
                t.x, t.y, t.z)
        except Exception as e:
            self.get_logger().warn(f'查询失败: {e}')

def main(args=None):
    rclpy.init(args=args)
    node = TfListener()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**Python 注意事项**：

-   `lookup_transform(target, source, time)` 位置参数顺序同 C++。
-   `rclpy.time.Time()` = 最新时刻；也可传 `Time(seconds=...)`。
-   Python 的 Buffer 不需要传时钟（默认用节点时钟）。
-   异常基类是 `Exception`（内部是 `tf2_ros.TransformException`）。

#### 4.4 变换一个点：从激光坐标到地图坐标

查询到变换后，实际用途是变换点。假设激光检测到前方 1 米有墙：

```python
# 在 tf_listener_py.py 的 timer_cb 中继续：
from geometry_msgs.msg import PointStamped
from tf2_geometry_msgs import do_transform_point

# 构造 laser 坐标系下的点
point = PointStamped()
point.header.frame_id = 'laser'
point.header.stamp = self.get_clock().now().to_msg()
point.point.x = 1.0
point.point.y = 0.0
point.point.z = 0.0

# 变换到 map 坐标系
transformed = do_transform_point(point, transform)
self.get_logger().info(
    '墙在 map 中: (%.3f, %.3f, %.3f)',
    transformed.point.x, transformed.point.y, transformed.point.z)
```

C++ 对应：

```cpp
#include <tf2_geometry_msgs/tf2_geometry_msgs.hpp>
#include <geometry_msgs/msg/point_stamped.hpp>

geometry_msgs::msg::PointStamped point;
point.header.frame_id = "laser";
point.point.x = 1.0; point.point.y = 0.0; point.point.z = 0.0;

auto transformed = tf2::doTransform(point, transform);
// transformed.point 现在在 map 坐标系下
```

`tf2::doTransform` / `do_transform_point` 就是第 13 篇矩阵乘法 `p_map = T_map←laser · p_laser` 的封装。

### 五、TF 树的可视化与排障

#### 5.1 查看 TF 树

```bash
# 文本方式：打印所有坐标系关系
ros2 run tf2_ros tf2_echo base_link laser

# 生成树图（PDF 在 /tmp/frames.pdf）
ros2 run tf2_ros view_frames
```

`view_frames` 会生成一张树状图：从根（如 `map`）向下展开所有父子关系。**断开的树枝**一眼可见——这就是"为什么查询不到变换"的第一排查点。

#### 5.2 可视化工具

-   `rqt_tf_tree`：实时显示 TF 树（推荐，动态更新）。
-   RViz2：添加 “TF” 显示，可看到坐标系坐标轴在空间中旋转移动——最直观。

```bash
rqt_tf_tree
rviz2    # 添加 TF 显示
```

#### 5.3 常见错误与解决

| 报错 | 原因 | 解决 |
| --- | --- | --- |
| `"laser" passed to lookupTransform argument target_frame does not exist` | 坐标系名不存在 | `ros2 run tf2_ros view_frames` 看实际名字，检查拼写（大小写敏感） |
| `Could not find transform from laser to map` | 两个坐标系不在同一棵 TF 树 | 检查是否有未连接的子树；静态变换是否发布到 `/tf_static` |
| `Lookup would require extrapolation into the past/future` | 查询的时间戳超出缓存范围 | 机器人刚启动等数据；或查最新用 `TimePointZero` |
| `Transform timed out` | 数据到达前就查询了 | 用 `lookupTransform(..., timeout)` 等待；或先 `tf_buffer_.canTransform(...)` 轮询 |
| 查询到了但数值全 0 | 忘了发布静态变换 | 检查 `/tf_static` 话题是否有数据 |
| 数值"跳变" | 多个节点同时广播同一对坐标系 | 只能有一个广播者；检查是否有重复的 static_transform_publisher |

#### 5.4 等待变换可用的标准姿势

很多应用启动时需要等 TF 就绪。正确姿势是**轮询 canTransform 或带超时查询**：

```cpp
// 等待 map -> laser 可用（最多 5 秒）
bool ok = tf_buffer_.canTransform(
  "map", "laser", tf2::TimePointZero, std::chrono::seconds(5));
```

```python
ok = self.tf_buffer.can_transform(
    'map', 'laser', rclpy.time.Time(),
    timeout=rclpy.duration.Duration(seconds=5))
```

**不要**用 `sleep(3)` 硬等——机器人状态不同，硬等既不优雅又不可靠。

### 六、实战案例：把激光点云变换到地图

把前面所有知识串起来：一个节点接收激光测距（模拟），利用 TF 把它变换到 `map` 坐标系并发布。

#### 6.1 C++ 完整示例

```cpp
// tf_to_map.cpp：查询变换并变换一个点
#include <rclcpp/rclcpp.hpp>
#include <tf2_ros/transform_listener.h>
#include <tf2_ros/buffer.h>
#include <tf2_geometry_msgs/tf2_geometry_msgs.hpp>
#include <geometry_msgs/msg/point_stamped.hpp>
#include <chrono>

class TfToMap : public rclcpp::Node
{
public:
  TfToMap() : Node("tf_to_map"), tf_buffer_(this->get_clock())
  {
    tf_listener_ = std::make_shared<tf2_ros::TransformListener>(tf_buffer_);
    timer_ = this->create_wall_timer(
      std::chrono::milliseconds(200),
      std::bind(&TfToMap::timer_cb, this));
  }

private:
  void timer_cb()
  {
    try {
      // 1) 查询 laser -> map
      auto transform = tf_buffer_.lookupTransform(
        "map", "laser", tf2::TimePointZero, std::chrono::seconds(1));

      // 2) 构造 laser 下的障碍点（前方 1 米）
      geometry_msgs::msg::PointStamped laser_point;
      laser_point.header.frame_id = "laser";
      laser_point.point.x = 1.0;
      laser_point.point.y = 0.0;
      laser_point.point.z = 0.0;

      // 3) 变换到 map
      auto map_point = tf2::doTransform(laser_point, transform);
      RCLCPP_INFO(this->get_logger(),
        "障碍在 map: (%.3f, %.3f, %.3f)",
        map_point.point.x, map_point.point.y, map_point.point.z);
    } catch (const tf2::TransformException & ex) {
      RCLCPP_WARN(this->get_logger(), "TF 不可用: %s", ex.what());
    }
  }

  tf2_ros::Buffer tf_buffer_;
  std::shared_ptr<tf2_ros::TransformListener> tf_listener_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<TfToMap>());
  rclcpp::shutdown();
  return 0;
}
```

#### 6.2 组合运行

```bash
# 终端 1：静态变换（laser 在 base_link 前方 0.1 m）
ros2 run tf2_demo static_broadcaster

# 终端 2：动态变换（odom -> base_link 移动）
ros2 run tf2_demo dynamic_broadcaster

# 终端 3：查询并变换
ros2 run tf2_demo tf_to_map
```

等等——这里 `map` 坐标系还没人发布！需要补一个 `map -> odom` 的静态变换（实际系统中由定位模块发布）：

```bash
ros2 run tf2_ros static_transform_publisher 0 0 0 0 0 0 map odom
```

现在 TF 树完整：`map -> odom -> base_link -> laser`。`tf_to_map` 会持续打印"障碍在 map"的坐标，且数值随 `dynamic_broadcaster` 的移动而变化——**这就是 TF 的魅力：每个模块只发布自己知道的那一段，任何两点都能算出来**。

#### 6.3 观察 TF 树

```bash
ros2 run tf2_ros view_frames
# 或
rqt_tf_tree
```

能看到树：`map`（根）→ `odom` → `base_link` → `laser`。

### 七、进阶话题

#### 7.1 时间旅行查询（Querying the Past）

tf2 支持查询"过去某个时刻"的变换（Buffer 保留历史）。适合：处理带延迟的数据（如相机图像在处理时已过去 50ms）：

```cpp
auto t = tf_buffer_.lookupTransform(
  "map", "laser", msg.header.stamp,  // 用数据自己的时间戳
  std::chrono::seconds(1));
```

注意：如果数据时间戳太旧（超出 10 秒缓存），会报 extrapolation 错误。

#### 7.2 变换消息头（frame_id）规范

无论发布还是查询，**frame_id 写对是基本功**：

-   发布时：`header.frame_id` = 父，`child_frame_id` = 子。
-   查询时：目标在前、源在后。
-   消息带坐标信息时（如 PointStamped），`header.frame_id` 必须写**它所在的坐标系**。

#### 7.3 多机器人/命名空间

多机器人时每个机器人有自己的 TF 树。常见做法：用命名空间区分坐标系名（如 `robot1/base_link`、`robot2/base_link`），或每机器人独立 `/tf` 话题（重映射）。多机 TF 合并是进阶话题，第 31-34 篇实体机器人章节会展开。

### 八、小结与下一篇预告

**本篇核心**：

1.  **tf2 三件套**：广播（broadcast）、TF 树、查询（lookup）。
2.  **两类广播**：`StaticTransformBroadcaster`（/tf_static，静态）与 `TransformBroadcaster`（/tf，动态）。
3.  **查询 API**：`Buffer.lookupTransform(target, source, time, timeout)`，“从源到目标”；必须 try-catch。
4.  **变换点**：`tf2::doTransform` / `do_transform_point` = 矩阵乘法的封装。
5.  **排障**：`tf2_echo`、`view_frames`、`rqt_tf_tree`；“Unknown frame” 查拼写，“not found” 查树是否连通，“timeout” 用 canTransform 等待。
6.  实战：静态+动态广播组合，把激光点变换到 map。

下一篇进入 **TF 树与多坐标系管理（C++/Python）**：多坐标系树怎么建、循环依赖（TF 不允许环）、`tf2_ros::MessageFilter` 时间同步、常见树形结构（map/odom/base_link 三件套）、以及如何在自己的包中优雅地组织 TF 广播与查询。tf2 是机器人的"神经系统"，本篇已让你掌握它的骨干。
