---
title: "ROS2系列教程：TF树与多坐标系管理（C++/Python）"
abbrlink: ros2-xi-lie-jiao-cheng-tf-shu-yu-duo-zuo-biao-xi-guan-li-c
date: "2026-09-06 10:17:26"
categories:
    - "ROS2"
tags: []
desc: "上一篇文章里，每条变换是\"父 → 子\"单向的。当你把所有变换按父子关系连起来，就得到一棵TF 树（TF Tree）map│odom│base_link/…"
---
## 本文是 ROS2 系列教程的第 15 篇

> 本文是 ROS2 系列教程的第 15 篇：TF 树与多坐标系管理。上一篇我们学会了广播与查询单条变换，但真实机器人从不只有一对坐标系：地图、里程计、底盘、雷达、相机、两个轮子、机械臂每个关节……它们共同组成一棵 **TF 树**。本篇系统讲解多坐标系管理：TF 树的结构与规则（不允许环）、经典 `map/odom/base_link` 三件套架构、如何用 `tf2_ros::MessageFilter` 做时间同步、坐标系命名与多机器人隔离，以及批量查询的工程实践。学完你将能设计出规范、可排障的多坐标系系统。

### 一、TF 树：从一对到一片

#### 1.1 为什么是"树"而不是"网"

上一篇文章里，每条变换是"父 → 子"单向的。当你把**所有**变换按父子关系连起来，就得到一棵 **TF 树（TF Tree）**：

```
                map
                 │
               odom
                 │
             base_link
              /     \
           laser   camera
                      │
                    lens
```

**树的规则（必须遵守）**：

1.  **每个坐标系只有一个父坐标系**（`base_link` 只能有一个父）。
2.  **整棵树的父子关系不能成环**（A→B→C→A 是禁止的）。
3.  **树可以有多棵独立子树**，但子树之间无法互查变换（会报 “Could not find transform”）。

> 为什么是树不是网？因为 tf2 要靠"沿树做矩阵链乘法"来推导任意两点间的变换。如果有环或一个点有多个父，推导结果就不唯一，系统无法工作。

#### 1.2 查看 TF 树的方法

```bash
# 文本树
ros2 run tf2_ros view_frames

# 实时可视化
rqt_tf_tree

# RViz 3D 显示
rviz2    # 添加 TF 显示
```

`view_frames` 输出会在当前目录生成 `frames.pdf`，顶部还有统计：广播频率、平均延迟、最大延迟。**调试 TF 第一步永远是看树**。

#### 1.3 树与查询的关系

查询 `lookupTransform(target, source)` 时，tf2 做的是：

1.  在树中找到 `target` 和 `source` 的**最近公共祖先**。
2.  从 `source` 沿树向上到祖先（取逆变换），再向下到 `target`。
3.  链式相乘得到最终矩阵（第 13 篇的矩阵乘法）。

所以**树连得通，查询就成功；树断了，查询就报错**。这是所有 TF 排障的总纲。

### 二、经典三件套：map / odom / base_link

#### 2.1 为什么要三个坐标系

很多新手困惑：`map` 和 `odom` 都连到 `base_link`，为什么不直接 `map → base_link`？

**因为 `map`（世界地图）和 `odom`（里程计）是两种不同精度的坐标系**：

|  | odom（里程计坐标系） | map（地图坐标系） |
| --- | --- | --- |
| 来源 | 轮速积分/IMU 推算 | 定位模块（AMCL 等） |
| 精度 | 短时准、长时间漂移 | 全局准、可能有跳变 |
| 更新 | 高频连续（100 Hz） | 低频（1-10 Hz），可能跳变 |
| 用途 | 控制、局部规划 | 全局规划、导航 |

标准架构：

```
map ──(定位修正)──→ odom ──(里程计)──→ base_link ──→ sensor...
```

-   **odom → base_link**：里程计发布，高频平滑，控制依赖它。
-   **map → odom**：定位模块发布，低频修正，把"里程计世界"拉回"地图世界"。
-   **map → base_link**：下游（如导航）查询时由 tf2 自动链式推导，无需单独发布。

**好处**：定位跳变时只改 `map→odom` 一小段，`odom→base_link` 保持平滑，控制器不会因定位跳变而抖动。

#### 2.2 搭建三件套（可运行）

```bash
# 终端 1：map -> odom（静态，定位模块占位）
ros2 run tf2_ros static_transform_publisher 0 0 0 0 0 0 map odom

# 终端 2：odom -> base_link（动态，里程计占位）
ros2 run tf2_ros static_transform_publisher 0 0 0 0 0 0 odom base_link
```

查看树：

```bash
ros2 run tf2_ros view_frames
```

你会看到 `map → odom → base_link` 三段树。虽然目前都是静态的，但结构已经正确。

#### 2.3 用 C++ 搭建三件套

```cpp
// tf_tree_demo.cpp：同时发布 map->odom 静态 与 odom->base_link 动态
#include <rclcpp/rclcpp.hpp>
#include <tf2_ros/static_transform_broadcaster.h>
#include <tf2_ros/transform_broadcaster.h>
#include <geometry_msgs/msg/transform_stamped.hpp>
#include <tf2/LinearMath/Quaternion.h>
#include <chrono>

class TfTreeDemo : public rclcpp::Node
{
public:
  TfTreeDemo() : Node("tf_tree_demo"), x_(0.0), yaw_(0.0)
  {
    static_tf_ = std::make_shared<tf2_ros::StaticTransformBroadcaster>(this);
    dynamic_tf_ = std::make_shared<tf2_ros::TransformBroadcaster>(this);

    // map -> odom 静态（定位模块占位：无偏移）
    geometry_msgs::msg::TransformStamped map_odom;
    map_odom.header.stamp = this->now();
    map_odom.header.frame_id = "map";
    map_odom.child_frame_id = "odom";
    map_odom.transform.translation.x = 0.0;
    map_odom.transform.translation.y = 0.0;
    map_odom.transform.translation.z = 0.0;
    map_odom.transform.rotation.w = 1.0;
    static_tf_->sendTransform(map_odom);

    timer_ = this->create_wall_timer(
      std::chrono::milliseconds(100),
      std::bind(&TfTreeDemo::timer_cb, this));
  }

private:
  void timer_cb()
  {
    x_ += 0.01; yaw_ += 0.005;   // 模拟里程计运动

    geometry_msgs::msg::TransformStamped odom_base;
    odom_base.header.stamp = this->now();
    odom_base.header.frame_id = "odom";
    odom_base.child_frame_id = "base_link";
    odom_base.transform.translation.x = x_;
    odom_base.transform.translation.y = 0.0;
    odom_base.transform.translation.z = 0.0;
    tf2::Quaternion q;
    q.setRPY(0.0, 0.0, yaw_);
    odom_base.transform.rotation.x = q.x();
    odom_base.transform.rotation.y = q.y();
    odom_base.transform.rotation.z = q.z();
    odom_base.transform.rotation.w = q.w();
    dynamic_tf_->sendTransform(odom_base);
  }

  std::shared_ptr<tf2_ros::StaticTransformBroadcaster> static_tf_;
  std::shared_ptr<tf2_ros::TransformBroadcaster> dynamic_tf_;
  rclcpp::TimerBase::SharedPtr timer_;
  double x_, yaw_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<TfTreeDemo>());
  rclcpp::shutdown();
  return 0;
}
```

#### 2.4 用 Python 搭建三件套

```python
#!/usr/bin/env python3
"""tf_tree_demo_py.py：map->odom 静态 + odom->base_link 动态"""
import rclpy
from rclpy.node import Node
from tf2_ros import StaticTransformBroadcaster, TransformBroadcaster
from geometry_msgs.msg import TransformStamped
from tf_transformations import quaternion_from_euler

class TfTreeDemo(Node):
    def __init__(self):
        super().__init__('tf_tree_demo_py')
        self.static_tf = StaticTransformBroadcaster(self)
        self.dynamic_tf = TransformBroadcaster(self)

        # map -> odom 静态
        map_odom = TransformStamped()
        map_odom.header.stamp = self.get_clock().now().to_msg()
        map_odom.header.frame_id = 'map'
        map_odom.child_frame_id = 'odom'
        map_odom.transform.translation.x = 0.0
        map_odom.transform.translation.y = 0.0
        map_odom.transform.translation.z = 0.0
        map_odom.transform.rotation.w = 1.0
        self.static_tf.sendTransform(map_odom)

        self.x = 0.0
        self.yaw = 0.0
        self.timer = self.create_timer(0.1, self.timer_cb)

    def timer_cb(self):
        self.x += 0.01
        self.yaw += 0.005

        odom_base = TransformStamped()
        odom_base.header.stamp = self.get_clock().now().to_msg()
        odom_base.header.frame_id = 'odom'
        odom_base.child_frame_id = 'base_link'
        odom_base.transform.translation.x = self.x
        odom_base.transform.translation.y = 0.0
        odom_base.transform.translation.z = 0.0
        q = quaternion_from_euler(0.0, 0.0, self.yaw)
        odom_base.transform.rotation.x = q[0]
        odom_base.transform.rotation.y = q[1]
        odom_base.transform.rotation.z = q[2]
        odom_base.transform.rotation.w = q[3]
        self.dynamic_tf.sendTransform(odom_base)

def main(args=None):
    rclpy.init(args=args)
    node = TfTreeDemo()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**关键观察**：把静态广播和动态广播放在**同一个节点**没问题——tf2 不关心谁发布，只关心树结构。但同一对父子**只允许一个发布者**（否则数据互相覆盖，数值跳变）。

### 三、传感器树的搭建

#### 3.1 挂传感器：静态变换

传感器（激光/相机/IMU）相对底盘固定，用静态变换挂到 `base_link` 下：

```bash
# laser 在 base_link 前方 0.15m、高 0.1m，俯仰 0
ros2 run tf2_ros static_transform_publisher 0.15 0 0.1 0 0 0 base_link laser

# camera 在 base_link 前方 0.1m、高 0.2m，绕 x 转 90°（朝下看）
ros2 run tf2_ros static_transform_publisher 0.1 0 0.2 1.5708 0 0 base_link camera
```

树变为：

```
map → odom → base_link → laser
                      └→ camera
```

**注意相机俯仰用弧度**：`1.5708 ≈ π/2`。搞错单位是静态变换最常见错误。

#### 3.2 挂关节：动态变换

机械臂/舵机关节运动，用动态变换。每个关节是一对父子：

```
base_link → joint1 → joint2 → joint3 → ... → gripper
```

每个关节的变换 = 上一个关节的位姿 × 当前关节角度产生的旋转。这是第 35-40 篇机械臂篇章的主线，本篇先建立概念。

#### 3.3 C++ 批量广播多对静态变换

```cpp
// multi_static.cpp：一次性广播 3 对静态变换
#include <rclcpp/rclcpp.hpp>
#include <tf2_ros/static_transform_broadcaster.h>
#include <geometry_msgs/msg/transform_stamped.hpp>

class MultiStatic : public rclcpp::Node
{
public:
  MultiStatic() : Node("multi_static")
  {
    tf_ = std::make_shared<tf2_ros::StaticTransformBroadcaster>(this);
    std::vector<geometry_msgs::msg::TransformStamped> transforms;

    // base_link -> laser
    transforms.push_back(make_tf("base_link", "laser", 0.15, 0.0, 0.1, 0, 0, 0));
    // base_link -> camera
    transforms.push_back(make_tf("base_link", "camera", 0.1, 0.0, 0.2, 1.5708, 0, 0));
    // base_link -> imu
    transforms.push_back(make_tf("base_link", "imu", 0.0, 0.0, 0.05, 0, 0, 0));

    tf_->sendTransform(transforms);   // 批量发送
    RCLCPP_INFO(this->get_logger(), "已广播 3 对静态变换");
  }

private:
  geometry_msgs::msg::TransformStamped make_tf(
    const std::string& parent, const std::string& child,
    double x, double y, double z, double roll, double pitch, double yaw)
  {
    geometry_msgs::msg::TransformStamped t;
    t.header.stamp = this->now();
    t.header.frame_id = parent;
    t.child_frame_id = child;
    t.transform.translation.x = x;
    t.transform.translation.y = y;
    t.transform.translation.z = z;
    tf2::Quaternion q;
    q.setRPY(roll, pitch, yaw);
    t.transform.rotation.x = q.x();
    t.transform.rotation.y = q.y();
    t.transform.rotation.z = q.z();
    t.transform.rotation.w = q.w();
    return t;
  }

  std::shared_ptr<tf2_ros::StaticTransformBroadcaster> tf_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<MultiStatic>());
  rclcpp::shutdown();
  return 0;
}
```

**批量 vs 逐个**：`sendTransform(vector)` 一次发多条，比循环逐个发更高效（一次网络消息）。静态变换也可以这样批量。

#### 3.4 Python 批量广播

```python
#!/usr/bin/env python3
"""multi_static_py.py：批量广播多对静态变换"""
import rclpy
from rclpy.node import Node
from tf2_ros import StaticTransformBroadcaster
from geometry_msgs.msg import TransformStamped
from tf_transformations import quaternion_from_euler

class MultiStatic(Node):
    def __init__(self):
        super().__init__('multi_static_py')
        self.tf = StaticTransformBroadcaster(self)
        transforms = [
            self.make_tf('base_link', 'laser',  0.15, 0.0, 0.1, 0, 0, 0),
            self.make_tf('base_link', 'camera', 0.1,  0.0, 0.2, 1.5708, 0, 0),
            self.make_tf('base_link', 'imu',    0.0,  0.0, 0.05, 0, 0, 0),
        ]
        self.tf.sendTransform(transforms)
        self.get_logger().info('已广播 3 对静态变换')

    def make_tf(self, parent, child, x, y, z, roll, pitch, yaw):
        t = TransformStamped()
        t.header.stamp = self.get_clock().now().to_msg()
        t.header.frame_id = parent
        t.child_frame_id = child
        t.transform.translation.x = x
        t.transform.translation.y = y
        t.transform.translation.z = z
        q = quaternion_from_euler(roll, pitch, yaw)
        t.transform.rotation.x = q[0]
        t.transform.rotation.y = q[1]
        t.transform.rotation.z = q[2]
        t.transform.rotation.w = q[3]
        return t

def main(args=None):
    rclpy.init(args=args)
    node = MultiStatic()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
```

### 四、MessageFilter：带时间戳的同步查询

#### 4.1 问题：数据到达时 TF 可能还没就绪

传感器数据（如激光点云）带 `header.stamp` 时间戳，但处理它的时刻，Buffer 里可能还没有"那个时刻"的 TF（数据先到、TF 后到，或反之）。直接 `lookupTransform` 会抛 extrapolation/timeout 异常。

**解决方案**：`tf2_ros::MessageFilter`——它把"数据消息"和"TF 可用性"绑在一起：**只有当数据时间戳对应的 TF 可用时，才触发回调**。

#### 4.2 C++ 使用 MessageFilter

```cpp
// message_filter_demo.cpp：TF 就绪后才处理 LaserScan
#include <rclcpp/rclcpp.hpp>
#include <tf2_ros/transform_listener.h>
#include <tf2_ros/buffer.h>
#include <tf2_ros/message_filter.h>
#include <message_filters/subscriber.h>
#include <sensor_msgs/msg/laser_scan.hpp>

class MessageFilterDemo : public rclcpp::Node
{
public:
  MessageFilterDemo() : Node("message_filter_demo"),
    tf_buffer_(this->get_clock())
  {
    tf_listener_ = std::make_shared<tf2_ros::TransformListener>(tf_buffer_);
    scan_sub_.subscribe(this, "scan");
    tf_filter_ = std::make_shared<tf2_ros::MessageFilter<sensor_msgs::msg::LaserScan>>(
      scan_sub_, tf_buffer_, "map", 10, this->get_node_base_interface(),
      this->get_node_logging_interface(), this->get_node_clock_interface());
    tf_filter_->registerCallback(
      std::bind(&MessageFilterDemo::scan_cb, this, std::placeholders::_1));
  }

private:
  void scan_cb(const sensor_msgs::msg::LaserScan::SharedPtr scan)
  {
    RCLCPP_INFO(this->get_logger(),
      "收到 scan (stamp=%.3f)，TF 已就绪，可以安全查询",
      scan->header.stamp.sec + scan->header.stamp.nanosec * 1e-9);
  }

  tf2_ros::Buffer tf_buffer_;
  std::shared_ptr<tf2_ros::TransformListener> tf_listener_;
  message_filters::Subscriber<sensor_msgs::msg::LaserScan> scan_sub_;
  std::shared_ptr<tf2_ros::MessageFilter<sensor_msgs::msg::LaserScan>> tf_filter_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<MessageFilterDemo>());
  rclcpp::shutdown();
  return 0;
}
```

**MessageFilter 构造参数**：`(订阅器, buffer, target_frame, 队列长度, node 接口...)`。`target_frame` 是最终要变换到的坐标系（这里是 `map`）——filter 会等待"该消息时间戳下、map 方向的 TF 可用"。

#### 4.3 Python 使用 MessageFilter

```python
#!/usr/bin/env python3
"""message_filter_demo_py.py：TF 就绪后处理 LaserScan"""
import rclpy
from rclpy.node import Node
from tf2_ros import Buffer, TransformListener, MessageFilter
from message_filters import Subscriber
from sensor_msgs.msg import LaserScan

class MessageFilterDemo(Node):
    def __init__(self):
        super().__init__('message_filter_demo_py')
        self.tf_buffer = Buffer()
        self.tf_listener = TransformListener(self.tf_buffer, self)
        self.scan_sub = Subscriber(self, LaserScan, 'scan')
        self.tf_filter = MessageFilter(
            self.scan_sub, self.tf_buffer, 'map', 10)
        self.tf_filter.registerCallback(self.scan_cb)

    def scan_cb(self, scan):
        self.get_logger().info(
            f'收到 scan (stamp={scan.header.stamp.sec}.'
            f'{scan.header.stamp.nanosec:09d})，TF 已就绪')

def main(args=None):
    rclpy.init(args=args)
    node = MessageFilterDemo()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**对比直接查询**：无 filter 时你要在回调里 try-catch + 重试；有 filter 后回调触发即保证 TF 可用，代码干净很多。**处理带时间戳的传感器数据（激光/相机/点云）时，MessageFilter 是标准姿势**。

### 五、坐标系命名与多机器人隔离

#### 5.1 命名规范

-   **小写 + 下划线**：`base_link`、`laser`、`camera_link`（ROS 风格）。
-   **避免空格和特殊字符**：TF 名字是字符串，但空格会带来解析麻烦。
-   **语义清晰**：`camera_link`（安装支架）与 `camera_optical`（光学中心）分开命名是常见的做法。
-   **一个坐标系一个语义**：不要复用名字表示不同位置。

#### 5.2 多机器人命名空间

多机器人系统（如双车协作）中，两台机器人各有自己的 TF 树。**直接拼树会导致坐标系名字冲突**。标准方案：

1.  **坐标系名加前缀**：`robot1/base_link`、`robot2/base_link`。
2.  **各自独立 /tf 话题**：重映射 `tf := robot1/tf`，`tf_static := robot1/tf_static`。
3.  **地图合并时**：额外发布 `map → robot1/odom` 与 `map → robot2/odom`，把两棵子树接到同一棵树上。

示例（launch 重映射）：

```xml
<node pkg="tf2_ros" exec="static_transform_publisher"
      args="0 0 0 0 0 0 map robot1/odom"
      output="screen"/>
<node pkg="tf2_ros" exec="static_transform_publisher"
      args="0 0 0 0 0 0 map robot2/odom"
      output="screen"/>
```

#### 5.3 命名空间与 TF 的常见坑

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 帧名带 `robot1/` 但查询没带 | 坐标系名是**纯字符串**，不会自动加命名空间 | 广播和查询必须用完整名 `robot1/base_link` |
| 两车都用 `base_link` | 树冲突/查询错乱 | 加前缀或独立话题 |
| 重映射了 /tf 但没重映射 /tf_static | 静态树没进来 | 两个话题都要重映射 |

### 六、工程实践：完整的多坐标系节点

把本篇所有知识合成一个实用节点：订阅激光雷达 → 等 TF → 变换到 map → 发布障碍物坐标。

#### 6.1 C++ 完整示例

```cpp
// scan_to_map.cpp：LaserScan + MessageFilter -> 变换到 map -> 发布 PointStamped
#include <rclcpp/rclcpp.hpp>
#include <tf2_ros/transform_listener.h>
#include <tf2_ros/buffer.h>
#include <tf2_ros/message_filter.h>
#include <tf2_geometry_msgs/tf2_geometry_msgs.hpp>
#include <message_filters/subscriber.h>
#include <sensor_msgs/msg/laser_scan.hpp>
#include <geometry_msgs/msg/point_stamped.hpp>

class ScanToMap : public rclcpp::Node
{
public:
  ScanToMap() : Node("scan_to_map"), tf_buffer_(this->get_clock())
  {
    tf_listener_ = std::make_shared<tf2_ros::TransformListener>(tf_buffer_);
    scan_sub_.subscribe(this, "scan");
    tf_filter_ = std::make_shared<tf2_ros::MessageFilter<sensor_msgs::msg::LaserScan>>(
      scan_sub_, tf_buffer_, "map", 10, this->get_node_base_interface(),
      this->get_node_logging_interface(), this->get_node_clock_interface());
    tf_filter_->registerCallback(
      std::bind(&ScanToMap::scan_cb, this, std::placeholders::_1));
    marker_pub_ = this->create_publisher<geometry_msgs::msg::PointStamped>(
      "obstacle_in_map", 10);
  }

private:
  void scan_cb(const sensor_msgs::msg::LaserScan::SharedPtr scan)
  {
    // 找最近障碍（最简单：取第一束距离最小的点）
    size_t i = 0;
    float min_r = std::numeric_limits<float>::max();
    for (size_t j = 0; j < scan->ranges.size(); ++j) {
      if (scan->ranges[j] > scan->range_min && scan->ranges[j] < scan->range_max
          && scan->ranges[j] < min_r) {
        min_r = scan->ranges[j]; i = j;
      }
    }
    double angle = scan->angle_min + i * scan->angle_increment;

    // laser 坐标系下的障碍点
    geometry_msgs::msg::PointStamped laser_pt;
    laser_pt.header = scan->header;      // 沿用数据的时间戳和 frame
    laser_pt.point.x = min_r * std::cos(angle);
    laser_pt.point.y = min_r * std::sin(angle);
    laser_pt.point.z = 0.0;

    // 变换到 map（MessageFilter 保证此刻 TF 可用）
    try {
      auto transform = tf_buffer_.lookupTransform(
        "map", scan->header.frame_id, scan->header.stamp,
        std::chrono::seconds(1));
      auto map_pt = tf2::doTransform(laser_pt, transform);
      map_pt.header.frame_id = "map";
      map_pt.header.stamp = this->now();
      marker_pub_->publish(map_pt);
      RCLCPP_INFO(this->get_logger(), "最近障碍在 map: (%.2f, %.2f)",
        map_pt.point.x, map_pt.point.y);
    } catch (const tf2::TransformException& ex) {
      RCLCPP_WARN(this->get_logger(), "变换失败: %s", ex.what());
    }
  }

  tf2_ros::Buffer tf_buffer_;
  std::shared_ptr<tf2_ros::TransformListener> tf_listener_;
  message_filters::Subscriber<sensor_msgs::msg::LaserScan> scan_sub_;
  std::shared_ptr<tf2_ros::MessageFilter<sensor_msgs::msg::LaserScan>> tf_filter_;
  rclcpp::Publisher<geometry_msgs::msg::PointStamped>::SharedPtr marker_pub_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<ScanToMap>());
  rclcpp::shutdown();
  return 0;
}
```

`package.xml` 需声明：`rclcpp`、`tf2_ros`、`tf2_geometry_msgs`、`message_filters`、`sensor_msgs`、`geometry_msgs`。

#### 6.2 组合运行验证

```bash
# 终端 1：完整 TF 树（三件套 + 传感器）
ros2 run tf2_demo tf_tree_demo &
ros2 run tf2_demo multi_static &

# 终端 2：模拟激光数据（发布一个简单 scan）
ros2 topic pub /scan sensor_msgs/msg/LaserScan \
  "{angle_min: -1.57, angle_max: 1.57, angle_increment: 0.01, \
    range_min: 0.1, range_max: 10.0, \
    ranges: [1.0, 0.8, 0.6, 0.4, 0.2, 0.3, 0.5, 0.7, 0.9, 1.0]}" \
  --rate 5

# 终端 3：运行处理节点
ros2 run tf2_demo scan_to_map
```

你会看到 `scan_to_map` 每收到一帧 scan 就输出"最近障碍在 map"的坐标。**这就是建图、导航、避障系统中"感知数据上到全局坐标系"的雏形**。

#### 6.3 观察树

```bash
ros2 run tf2_ros view_frames
rqt_tf_tree
```

树应类似：

```
map → odom → base_link → laser
                    └→ camera
                    └→ imu
```

### 七、常见问题与排障清单

| 问题 | 原因 | 解决 |
| --- | --- | --- |
| 两个坐标系能各自查到，但互相查不到 | 它们不在同一棵子树 | 查看树，找出断点，补上缺失的变换 |
| 数值在某个时刻跳变 | 两个节点同时广播同一对父子 | 只保留一个发布者 |
| `map→base_link` 与 `odom→base_link` 都有人发 | 树结构错误（base_link 双父） | 正确做法是 map→odom→base_link 链式 |
| MessageFilter 回调永远不触发 | target_frame 方向 TF 一直不可用 | 检查树里是否有 `map`；确认发布频率 |
| 查询历史时刻报 extrapolation | 时间戳太旧（>10s 缓存） | 检查数据延迟；Buffer 缓存时间可配 |
| 静态变换改了但看不到 | `/tf_static` 用 transient_local，新订阅者能收到，但旧数据还在 | 重启节点或发新数据 |
| 多机器人帧名冲突 | 都用了裸名 `base_link` | 加命名空间前缀或独立话题 |

### 八、小结与下一篇预告

**本篇核心**：

1.  **TF 树规则**：单父、无环、子树独立；“树通查询通、树断查询断”。
2.  **三件套架构**：`map → odom → base_link`，定位与里程计分离，控制平滑。
3.  **传感器/关节挂载**：静态变换挂传感器、动态变换挂关节；`sendTransform(vector)` 批量发送。
4.  **MessageFilter**：带时间戳数据与 TF 就绪绑定的标准解法，处理激光/相机数据必备。
5.  **命名与隔离**：坐标系命名规范、多机器人前缀/话题隔离。
6.  完整实践：LaserScan → MessageFilter → 变换到 map → 发布障碍点。

下一篇进入 **建模仿真篇**：URDF 机器人建模（link 与 joint）。URDF 是机器人的"骨骼描述"，它把 TF 树和 3D 模型绑定：每个 link 是刚体、每个 joint 是坐标系之间的变换。学完你就能用代码描述一台完整机器人，为 Gazebo 仿真和 MoveIt2 机械臂打基础。tf2 是神经，URDF 是骨骼——两者结合，机器人"活"了起来。
