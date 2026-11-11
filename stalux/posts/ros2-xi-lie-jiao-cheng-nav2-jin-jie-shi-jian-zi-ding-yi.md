---
title: "ROS2系列教程：Nav2进阶实践（自定义算法、插件与行为树）"
abbrlink: ros2-xi-lie-jiao-cheng-nav2-jin-jie-shi-jian-zi-ding-yi
date: "2026-10-14 00:48:26"
categories:
    - "ROS2"
tags: []
desc: "/ 继承 nav2_core::Controller，实现 5 个纯虚接口public:// 1. 配置：从参数获取配置// 2. 清理与激活// 3. 核心：计算速度指令（每 control…"
---
## 本文是 ROS2 系列教程的第 25 篇

> 本文是 ROS2 系列教程的第 25 篇：Nav2 进阶实践（自定义算法、插件与行为树）。第 24 篇 Nav2 已经能带着小车跑起来了，但用的是默认插件（NavFn 全局规划 + DWB 局部规划 + 标准行为树）。真实项目几乎都要定制：换更懂场景的规划器、加自定义恢复行为、改导航流程。Nav2 的插件化架构就是为这个设计的。本篇拆解 Nav2 插件机制、手写一个自定义控制器插件的完整骨架、定制行为树 XML，以及如何把自定义插件注册进 Nav2——从此 Nav2 不再是"黑盒"，而是你的工具箱。

### 一、Nav2 的插件机制

#### 1.1 插件化思想

Nav2 的每个 Server 都通过 **pluginlib** 加载算法插件。你换算法 = 改配置 + 提供插件库，不用动 Nav2 本体：

```
planner_server:    GridBased → NavFn / SmacPlanner / 你的算法
controller_server: FollowPath → DWB / RegulatedPurePursuit / 你的算法
behavior_server:   spin/back_up/drive_on_heading/wait（可增删）
costmap:           obstacle/inflation/static（可增删）
```

#### 1.2 插件三要素

一个 Nav2 插件 = 继承基类 + 注册宏 + 插件描述文件（.xml）：

| 要素 | 说明 | 文件 |
| --- | --- | --- |
| 继承 | 继承对应算法基类并实现接口 | `controller.hpp` |
| 注册 | `PLUGINLIB_EXPORT_CLASS` 导出 | `controller.cpp` |
| 描述 | `nav2_my_controller.xml` 声明插件 | `plugin_description.xml` |

#### 1.3 pluginlib 原理

-   插件库是动态库（`.so`），运行时按名字加载。
-   `nav2_core::Controller` 等基类定义接口，实现者注册类名。
-   YAML 里 `plugin: "nav2_my_controller/MyController"` 让 Nav2 找到并实例化。

### 二、自定义局部控制器（完整骨架）

#### 2.1 头文件 controller.hpp

```cpp
// controller.hpp
#ifndef NAV2_MY_CONTROLLER__CONTROLLER_HPP_
#define NAV2_MY_CONTROLLER__CONTROLLER_HPP_

#include <string>
#include "nav2_core/controller.hpp"
#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/twist.hpp"

namespace nav2_my_controller
{

// 继承 nav2_core::Controller，实现 5 个纯虚接口
class MyController : public nav2_core::Controller
{
public:
  MyController() = default;
  ~MyController() override = default;

  // 1. 配置：从参数获取配置
  void configure(
    const rclcpp_lifecycle::LifecycleNode::WeakPtr & parent,
    std::string name,
    const std::shared_ptr<tf2_ros::Buffer> & tf,
    const std::shared_ptr<nav2_costmap_2d::Costmap2DROS> & costmap_ros) override;

  // 2. 清理与激活
  void cleanup() override;
  void activate() override;
  void deactivate() override;

  // 3. 核心：计算速度指令（每 control cycle 调用）
  geometry_msgs::msg::Twist computeVelocityCommands(
    const geometry_msgs::msg::PoseStamped & pose,
    const geometry_msgs::msg::Twist & velocity,
    nav2_core::GoalChecker * goal_checker) override;

  // 4. 设置/获取规划路径
  void setPlan(const nav_msgs::msg::Path & path) override;
  nav_msgs::msg::Path getPlan() override { return plan_; }

private:
  double max_vel_x_;
  double max_vel_theta_;
  double k_linear_;    // 比例系数
  double k_angular_;
  nav_msgs::msg::Path plan_;   // 保存全局路径
  rclcpp::Logger logger_{rclcpp::get_logger("my_controller")};
};

}  // namespace nav2_my_controller

#endif  // NAV2_MY_CONTROLLER__CONTROLLER_HPP_
```

#### 2.2 实现 controller.cpp

```cpp
// controller.cpp
#include "nav2_my_controller/controller.hpp"
#include "pluginlib/class_list_macros.hpp"
#include <cmath>
#include <algorithm>

namespace nav2_my_controller
{

void MyController::configure(
  const rclcpp_lifecycle::LifecycleNode::WeakPtr & parent,
  std::string name,
  const std::shared_ptr<tf2_ros::Buffer> & tf,
  const std::shared_ptr<nav2_costmap_2d::Costmap2DROS> & costmap_ros)
{
  auto node = parent.lock();
  nav2_util::declare_parameter_if_not_declared(
    node, name + ".max_vel_x", rclcpp::ParameterValue(0.5));
  nav2_util::declare_parameter_if_not_declared(
    node, name + ".max_vel_theta", rclcpp::ParameterValue(1.0));
  nav2_util::declare_parameter_if_not_declared(
    node, name + ".k_linear", rclcpp::ParameterValue(0.6));
  nav2_util::declare_parameter_if_not_declared(
    node, name + ".k_angular", rclcpp::ParameterValue(1.5));

  max_vel_x_ = node->get_parameter(name + ".max_vel_x").as_double();
  max_vel_theta_ = node->get_parameter(name + ".max_vel_theta").as_double();
  k_linear_ = node->get_parameter(name + ".k_linear").as_double();
  k_angular_ = node->get_parameter(name + ".k_angular").as_double();

  logger_ = node->get_logger();
  RCLCPP_INFO(logger_, "MyController 已配置");
}

void MyController::cleanup() {}
void MyController::activate() {}
void MyController::deactivate() {}

void MyController::setPlan(const nav_msgs::msg::Path & path)
{
  plan_ = path;
}

geometry_msgs::msg::Twist MyController::computeVelocityCommands(
  const geometry_msgs::msg::PoseStamped & pose,
  const geometry_msgs::msg::Twist & velocity,
  nav2_core::GoalChecker * goal_checker)
{
  geometry_msgs::msg::Twist cmd;
  if (plan_.poses.empty()) {
    cmd.linear.x = 0.0; cmd.angular.z = 0.0;
    return cmd;
  }

  // 找到路径上离当前位置最近的点作为"前视目标"（simple pursuit）
  double min_dist = 1e9;
  size_t idx = 0;
  for (size_t i = 0; i < plan_.poses.size(); ++i) {
    double dx = plan_.poses[i].pose.position.x - pose.pose.position.x;
    double dy = plan_.poses[i].pose.position.y - pose.pose.position.y;
    double d = std::hypot(dx, dy);
    if (d < min_dist) { min_dist = d; idx = i; }
  }
  // 前视 3 个点
  size_t lookahead = std::min(idx + 3, plan_.poses.size() - 1);
  double gx = plan_.poses[lookahead].pose.position.x - pose.pose.position.x;
  double gy = plan_.poses[lookahead].pose.position.y - pose.pose.position.y;

  // 目标在机器人坐标系下的角度
  double goal_angle = std::atan2(gy, gx);
  // 机器人当前朝向（四元数转 yaw）
  double qz = pose.pose.orientation.z, qw = pose.pose.orientation.w;
  double yaw = 2.0 * std::atan2(qz, qw);

  double ang_diff = goal_angle - yaw;
  // 归一化到 [-π, π]
  while (ang_diff > M_PI) ang_diff -= 2 * M_PI;
  while (ang_diff < -M_PI) ang_diff += 2 * M_PI;

  // P 控制：直行速度按距离、转角速度按角度差
  cmd.linear.x = std::clamp(k_linear_ * std::hypot(gx, gy), 0.0, max_vel_x_);
  cmd.angular.z = std::clamp(k_angular_ * ang_diff, -max_vel_theta_, max_vel_theta_);

  return cmd;
}

}  // namespace nav2_my_controller

PLUGINLIB_EXPORT_CLASS(
  nav2_my_controller::MyController, nav2_core::Controller)
```

这是一个**简化版 Pure Pursuit**（纯追踪）：沿全局路径取前视点，用 P 控制输出线速度和角速度。作为理解插件接口的最小实现非常合适——真实 Regulated Pure Pursuit 还加了曲率限制、障碍避让等。

#### 2.3 插件描述文件 controller_plugin.xml

```xml
<!-- controller_plugin.xml -->
<library path="nav2_my_controller">
  <class name="nav2_my_controller/MyController"
         type="nav2_my_controller::MyController"
         base_class_type="nav2_core::Controller">
    <description>一个简单的 Pure Pursuit 局部控制器</description>
  </class>
</library>
```

#### 2.4 package.xml + CMakeLists.txt

package.xml 添加：

```xml
<export>
  <build_type>ament_cmake</build_type>
  <nav2_core plugin="${prefix}/controller_plugin.xml"/>
</export>
```

CMakeLists.txt：

```cmake
find_package(nav2_core REQUIRED)
find_package(pluginlib REQUIRED)

add_library(nav2_my_controller SHARED src/controller.cpp)
ament_target_dependencies(nav2_my_controller rclcpp nav2_core nav2_util geometry_msgs nav_msgs tf2_ros pluginlib)
pluginlib_export_plugin_description_file(nav2_core controller_plugin.xml)

ament_export_dependencies(nav2_core pluginlib)
```

#### 2.5 在 Nav2 配置中使用自定义控制器

```yaml
controller_server:
  ros__parameters:
    controller_plugins: ["FollowPath"]
    FollowPath:
      plugin: "nav2_my_controller/MyController"   # 替换默认 DWB
      max_vel_x: 0.5
      max_vel_theta: 1.0
      k_linear: 0.6
      k_angular: 1.5
```

编译后重启导航，你的控制器就生效了。**这就是 Nav2 插件化的全部秘密**：继承 → 实现 → 注册 → 配置引用。

### 三、自定义行为树

#### 3.1 行为树是什么

行为树（Behavior Tree, BT）用树状节点编排导航流程：控制节点（Sequence/Selector）+ 行为节点（动作/条件）。Nav2 用 BT 描述"导航到目标"的完整流程，XML 可编辑。

#### 3.2 默认行为树（精简版）

```xml
<!-- navigate_to_pose_w_replanning_and_recovery.xml（官方默认） -->
<root main_tree_to_execute="MainTree">
  <BehaviorTree ID="MainTree">
    <Sequence name="root">
      <RecoveryNode number_of_retries="6" name="NavigateRecovery">
        <Sequence name="Navigate">
          <!-- 计算全局路径 -->
          <ComputePathToPose goal="{goal}" path="{path}" planner_id="GridBased"/>
          <!-- 沿路径跟随 -->
          <FollowPath path="{path}" controller_id="FollowPath"/>
        </Sequence>
        <!-- 失败时恢复：清代价图 → 旋转 → 倒退 -->
        <Fallback name="RecoveryFallback">
          <ClearCostmap service_name="global_costmap/clear_around_service"/>
          <Spin name="Spin" spin_dist="1.57"/>
          <BackUp name="BackUp" backup_dist="0.15" backup_speed="0.05"/>
        </Fallback>
      </RecoveryNode>
    </Sequence>
  </BehaviorTree>
</root>
```

#### 3.3 定制自己的行为树

给导航加"到达前鸣笛/等待"的示例：

```xml
<root main_tree_to_execute="MainTree">
  <BehaviorTree ID="MainTree">
    <Sequence name="root">
      <RecoveryNode number_of_retries="6" name="NavigateRecovery">
        <Sequence name="Navigate">
          <ComputePathToPose goal="{goal}" path="{path}" planner_id="GridBased"/>
          <FollowPath path="{path}" controller_id="FollowPath"/>
        </Sequence>
        <Fallback name="RecoveryFallback">
          <ClearCostmap service_name="global_costmap/clear_around_service"/>
          <Spin spin_dist="1.57"/>
          <BackUp backup_dist="0.15" backup_speed="0.05"/>
        </Fallback>
      </RecoveryNode>
      <!-- 到达后原地等待 3 秒（自定义节点） -->
      <Wait wait_duration="3.0"/>
      <!-- 到达后旋转 90° 面朝目标（自定义） -->
      <Spin spin_dist="1.57"/>
    </Sequence>
  </BehaviorTree>
</root>
```

在配置中引用自定义树：

```yaml
bt_navigator:
  ros__parameters:
    default_nav_to_pose_bt_xml: <你的包路径>/behavior_trees/my_navigate.xml
```

#### 3.4 自定义 BT 节点（C++）

行为树节点继承 `nav2_behavior_tree::BtActionNode` 或 `BT::ActionNodeBase`：

```cpp
// custom_wait.cpp：一个简单的自定义节点
#include "behaviortree_cpp/action_node.h"
#include <thread>
#include <chrono>

class CustomWait : public BT::ActionNodeBase
{
public:
  CustomWait(const std::string & name, const BT::NodeConfig & config)
  : BT::ActionNodeBase(name, config) {}

  static BT::PortsList providedPorts()
  {
    return {BT::InputPort<double>("wait_duration", 1.0, "等待秒数")};
  }

  BT::NodeStatus tick() override
  {
    double secs;
    if (!getInput("wait_duration", secs)) {
      return BT::NodeStatus::FAILURE;
    }
    std::this_thread::sleep_for(std::chrono::duration<double>(secs));
    return BT::NodeStatus::SUCCESS;
  }

  void halt() override {}
};

#include "behaviortree_cpp/bt_factory.h"
BT_REGISTER_NODES(factory)
{
  factory.registerNodeType<CustomWait>("CustomWait");
}
```

### 四、自定义全局规划器（简介）

与控制器同理，全局规划器继承 `nav2_core::GlobalPlanner`：

```cpp
class MyPlanner : public nav2_core::GlobalPlanner
{
public:
  // 核心：computePotentialField + createPlan 返回全局路径
  nav_msgs::msg::Path createPlan(
    const geometry_msgs::msg::PoseStamped & start,
    const geometry_msgs::msg::PoseStamped & goal) override;
  // ...
};
PLUGINLIB_EXPORT_CLASS(nav2_custom_planner::MyPlanner, nav2_core::GlobalPlanner)
```

配置：

```yaml
planner_server:
  ros__parameters:
    planner_plugins: ["GridBased"]
    GridBased:
      plugin: "nav2_custom_planner/MyPlanner"
```

### 五、进阶调参实战

#### 5.1 平滑路径（Smac Planner）

Nav2 内置更先进的 Smac Planner（混合 A*），路径更平滑：

```yaml
planner_server:
  ros__parameters:
    planner_plugins: ["GridBased"]
    GridBased:
      plugin: "nav2_smac_planner/SmacPlanner2D"
      tolerance: 0.25
      use_astar: true
      downsample_costmap: false
      motion_model_for_search: 0   # 0=Dubins 1=Reeds-Shepp
```

#### 5.2 更好的局部规划（Regulated Pure Pursuit）

```yaml
controller_server:
  ros__parameters:
    FollowPath:
      plugin: "nav2_regulated_pure_pursuit_controller/RegulatedPurePursuitController"
      desired_linear_vel: 0.5
      lookahead_dist: 0.6
      min_lookahead_dist: 0.3
      max_lookahead_dist: 0.9
      transform_tolerance: 0.2
      use_velocity_scaled_lookahead_dist: true
      use_collision_detection: true
      max_allowed_time_to_collision_up_to_carrot: 1.0
```

Regulated Pure Pursuit 是社区公认好用的局部规划器，建议优先于 DWB 使用。

#### 5.3 常用组合推荐

| 场景 | 全局规划 | 局部规划 |
| --- | --- | --- |
| 入门教学 | NavFn | DWB |
| 通用小车 | NavFn | Regulated Pure Pursuit |
| 大场景/长距离 | SmacPlanner2D | Regulated Pure Pursuit |
| 全向底盘 | NavFn | DWB（支持全向） |

### 六、常见问题与排障

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `Failed to load plugin` | 插件描述文件未导出 | `pluginlib_export_plugin_description_file`；重新 colcon build |
| 控制器没生效 | 配置里 plugin 名没改对 | 检查 `controller_plugins` 与插件名 |
| BT 加载失败 | XML 路径错或节点未注册 | 检查 `default_nav_to_pose_bt_xml`；BT 节点要注册进工厂 |
| 自定义节点不执行 | 插件库没链接进 bt_navigator | `bt_navigator` 的 `plugin_lib_names` 加你的库 |
| 参数不生效 | 参数名带前缀 | `name + ".k_linear"` 前缀与 YAML 结构对应 |
| 编译报 nav2_core 找不到 | 缺依赖 | `find_package(nav2_core REQUIRED)` 前先 `sudo apt install ros-humble-nav2-core` |

#### 6.1 验证插件是否被加载

```bash
# 查看插件是否注册成功
ros2 pkg prefix nav2_my_controller
ls $(ros2 pkg prefix nav2_my_controller)/share/nav2_my_controller/
# 应有 controller_plugin.xml

# 启动导航时 --verbose 看日志
ros2 launch my_robot_bringup nav2.launch.py --verbose
# 日志出现 MyController 已配置 = 插件加载成功
```

### 七、小结与下一篇预告

**本篇核心**：

1.  **插件机制**：继承基类 + PLUGINLIB_EXPORT_CLASS + 描述 XML，配置引用即生效。
2.  **自定义控制器**：完整 Pure Pursuit 骨架（configure/computeVelocityCommands/setPlan）。
3.  **自定义行为树**：XML 编排流程，RecoveryNode 失败恢复，可加自定义节点。
4.  **内置进阶插件**：SmacPlanner（平滑全局）、Regulated Pure Pursuit（好用局部）。
5.  **工程验证**：插件描述文件导出、`--verbose` 日志确认加载。
6.  Nav2 从"黑盒"变成可自由定制的工具箱。

至此 **Nav2 导航阶段（21-25）全部收官**。下一篇进入 **硬件控制阶段**（第 26 篇）：嵌入式开发从点灯开始。前面全部是仿真，真正的机器人要跑在硬件上：单片机（STM32/ESP32）、电机驱动、传感器接线、串口通信。第 26 篇我们从最基础的"点灯"讲起，建立嵌入式开发的完整认知，为 MicroROS（第 27 篇）和 ROS2-Control（第 28 篇）打地基。从虚拟世界走向真实硬件，新的篇章开始。
