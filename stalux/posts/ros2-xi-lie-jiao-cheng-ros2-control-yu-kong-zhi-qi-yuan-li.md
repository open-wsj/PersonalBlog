---
title: "ROS2系列教程：ROS2-Control与控制器（原理）"
abbrlink: ros2-xi-lie-jiao-cheng-ros2-control-yu-kong-zhi-qi-yuan-li
date: "2026-10-14 00:50:11"
categories:
    - "ROS2"
tags: []
desc: "官方控制器不够用时，可以写自定义控制器。"
---
## 本文是 ROS2 系列教程的第 28 篇

> 本文是 ROS2 系列教程的第 28 篇：ROS2-Control 与控制器（原理）。第 27 篇我们通过 MicroROS 让单片机变成了 ROS2 节点，实现了"能通信"。但机器人关节怎么被统一管理？电机怎么按标准接口转动？这就是 **ros2_control** 框架的职责。本篇讲解 ros2_control 的架构（Controller Manager / Hardware Interface / Controller）、核心概念（Command Interface / State Interface / Transmission），并用仿真环境跑通一个完整的关节控制流程。这是硬件控制阶段最核心的一篇。

### 一、为什么需要 ros2_control

#### 1.1 没有标准的混乱局面

在 ros2_control 出现之前，每个机器人都有自己的控制代码：有人直接订阅 `/cmd_vel` 驱动电机，有人写自己的 PID 控制器，有人为每种电机写一套驱动。结果就是：**换硬件要重写控制逻辑，换控制器要重写驱动**，代码无法复用。

#### 1.2 ros2_control 的定位

ros2_control 是 ROS2 官方的机器人硬件控制框架，它解决的问题：

1.  **硬件抽象**：把"电机驱动"和"控制算法"解耦。上层控制器只面对统一的接口（关节位置/速度/力矩），不关心底层是直流电机还是舵机。
2.  **控制器标准化**：官方提供开箱即用的控制器（关节轨迹控制器、差速驱动控制器等），也可自定义。
3.  **状态反馈统一**：所有传感器状态（编码器、IMU）通过标准接口上报。

一句话：**ros2_control 是"机器人关节的中间件"，上接控制器，下接硬件，中间全是标准接口**。

#### 1.3 与 MicroROS 的分工

第 27 篇的 MicroROS 负责"MCU 如何成为 ROS2 节点"，而 ros2_control 负责"关节/电机如何被统一管理"。两者可以结合：ros2_control 的硬件接口（hardware_interface）可以基于串口/MicroROS 与下位机通信。典型链路：

```text
/controller_manager（总管家）
    ├── 控制器：diff_drive_controller（订阅 /cmd_vel → 计算轮速）
    ├── 控制器：joint_trajectory_controller（执行轨迹）
    └── 硬件接口：RobotHW（把目标轮速写到电机，读回编码器）
            ↓ 串口 / MicroROS / CAN
         真实电机 + 编码器
```

### 二、ros2_control 核心架构（原理）

#### 2.1 三大组件

ros2_control 由三个核心组件组成：

| 组件 | 角色 | 类比 |
| --- | --- | --- |
| Controller Manager | 总管所有控制器的生命周期：加载、配置、激活、切换 | 操作系统 |
| Controller（控制器） | 订阅目标（如 /cmd_vel），计算关节命令，发布状态 | 应用程序 |
| Hardware Interface（硬件接口） | 真正读写电机/传感器，把"关节命令"变成"电流/电压" | 设备驱动 |

#### 2.2 硬件接口的两类接口

硬件接口与控制器之间通过**资源接口**交互，分两类：

-   **Command Interface（命令接口）**：控制器→硬件，比如"关节速度命令"（`wheel_left/velocity`）。
-   **State Interface（状态接口）**：硬件→控制器，比如"关节位置反馈"（`wheel_left/position`）。

每个接口用 `资源名/接口名` 标识，例如 `joint_1/position`、`wheel_left/velocity`。控制器通过接口名读写硬件，硬件通过接口名暴露能力。

#### 2.3 控制循环（Control Loop）

ros2_control 的核心是一个**周期控制循环**：

```text
读取状态（State Interface：读编码器）
    ↓
控制器计算（diff_drive：把 /cmd_vel 换算成轮速）
    ↓
写入命令（Command Interface：写目标轮速）
    ↓
等待下一个周期（默认 100Hz / 10ms）
```

这个循环由 Controller Manager 的 `update()` 驱动，周期在 YAML 中配置。

### 三、环境准备

#### 3.1 安装 ros2_control（Humble）

```bash
# 安装 ros2_control 全家桶（Humble 默认已含部分组件，补装控制器）
sudo apt update
sudo apt install -y ros-humble-ros2-control ros-humble-ros2-controllers

# 验证安装
ros2 pkg list | grep control
# 应看到：
# ros2_control
# ros2_controllers
# controller_manager
# ...（若干 hardware_interface 等）
```

#### 3.2 使用仿真硬件（Mock Hardware）

为了让没有真实电机的学习者能跑通流程，ros2_control 提供 **mock_components**（仿真硬件）：它在内存中模拟电机行为，编码器读数会响应命令变化。这样我们可以在纯软件环境里完整测试控制链路。

```bash
# 安装仿真硬件组件
sudo apt install -y ros-humble-ros2-controllers-test-fixtures
# 或包含在 ros-humble-ros2-control 中
```

### 四、示例 1：最小 ros2_control 系统（仿真单关节）

#### 4.1 URDF 中声明硬件接口

ros2_control 的硬件配置写在 URDF 的 `<ros2_control>` 标签里。创建一个单关节（joint1）的仿真系统：

```xml
<!-- robot.urdf.xacro：单关节机器人 + ros2_control 仿真硬件 -->
<?xml version="1.0"?>
<robot name="single_joint_robot" xmlns:xacro="http://www.ros.org/wiki/xacro">

  <link name="base_link"/>
  <link name="joint1_link"/>

  <joint name="joint1" type="revolute">
    <parent link="base_link"/>
    <child link="joint1_link"/>
    <origin xyz="0 0 0.1" rpy="0 0 0"/>
    <axis xyz="0 0 1"/>
    <limit lower="-3.14" upper="3.14" effort="10" velocity="1.0"/>
  </joint>

  <!-- ros2_control 硬件声明 -->
  <ros2_control name="SingleJointHW" type="system">
    <hardware>
      <plugin>mock_components/GenericSystem</plugin>
      <param name="example_param">1.0</param>
    </hardware>
    <joint name="joint1">
      <command_interface name="position"/>
      <command_interface name="velocity"/>
      <state_interface name="position"/>
      <state_interface name="velocity"/>
    </joint>
  </ros2_control>

  <!-- 连接 ros2_control 与 robot_state_publisher -->
  <gazebo>
    <plugin name="gazebo_ros2_control" filename="libgazebo_ros2_control.so">
      <parameters>$(find single_joint_robot)/config/ros2_control.yaml</parameters>
    </plugin>
  </gazebo>
</robot>
```

要点：

-   `<hardware><plugin>mock_components/GenericSystem</plugin>`：声明用**仿真硬件**，不碰真实电机。
-   `<joint>` 里声明该关节暴露哪些接口：命令接口（position/velocity）+ 状态接口（position/velocity）。
-   这就是"硬件抽象"：换成真实电机驱动，只需改 plugin 名和相关参数，上层完全不变。

#### 4.2 Controller Manager 配置

创建 `config/ros2_control.yaml`，配置 Controller Manager 和控制器：

```yaml
controller_manager:
  ros__parameters:
    update_rate: 100          # 控制循环 100Hz
    # 声明要加载的控制器
    joint_state_broadcaster:
      type: joint_state_broadcaster/JointStateBroadcaster
    joint_trajectory_controller:
      type: joint_trajectory_controller/JointTrajectoryController

joint_state_broadcaster:
  ros__parameters:
    interface_names:
      - joint1/position
      - joint1/velocity

joint_trajectory_controller:
  ros__parameters:
    joints:
      - joint1
    command_interfaces:
      - position
    state_interfaces:
      - position
      - velocity
    state_publish_rate: 50.0
    action_monitor_rate: 20.0
```

这里声明了两个控制器：

-   **joint_state_broadcaster**：负责把关节状态广播成 `/joint_states` 话题（RViz 可视化依赖它）。
-   **joint_trajectory_controller**：接收轨迹目标（FollowJointTrajectory Action），逐步执行关节位置命令。

#### 4.3 启动 launch 文件

```python
# launch/control.launch.py：启动整个 ros2_control 系统
from launch import LaunchDescription
from launch_ros.actions import Node
from launch.actions import ExecuteProcess
from launch.substitutions import Command, FindExecutable
import os

def generate_launch_description():
    # 解析 URDF（含 ros2_control 声明）
    robot_description = Command([
        FindExecutable(name='xacro'), ' ',
        os.path.join('src/single_joint_robot/urdf/robot.urdf.xacro')
    ])

    return LaunchDescription([
        # 1. 发布机器人模型
        Node(
            package='robot_state_publisher',
            executable='robot_state_publisher',
            parameters=[{'robot_description': robot_description}],
            output='screen',
        ),
        # 2. 启动 Controller Manager（读取 YAML 配置）
        Node(
            package='controller_manager',
            executable='ros2_control_node',
            parameters=['config/ros2_control.yaml'],
            output='screen',
        ),
        # 3. 启动 RViz（可选，可视化）
        ExecuteProcess(
            cmd=['rviz2', '-d', 'config/view.rviz'],
            output='screen',
        ),
    ])
```

#### 4.4 运行与验证

```bash
# 终端 1：构建并启动
cd ~/single_joint_ws && colcon build && source install/setup.bash
ros2 launch single_joint_robot control.launch.py

# 终端 2：查看控制器状态
ros2 control list_controllers
# 输出示例：
# joint_state_broadcaster[joint_state_broadcaster/JointStateBroadcaster] active
# joint_trajectory_controller[joint_trajectory_controller/JointTrajectoryController] active

# 终端 3：查看关节状态话题
ros2 topic echo /joint_states
# 能看到 joint1 的 position/velocity 在不断刷新（仿真硬件在"运行"）
```

### 五、示例 2：控制关节运动（发送轨迹）

#### 5.1 用 Action 发送轨迹目标

joint_trajectory_controller 通过 **FollowJointTrajectory Action** 接收目标。用 `ros2 action send_goal` 让 joint1 转到 1.57 弧度（90 度）：

```bash
# 发送轨迹目标：joint1 在 2 秒内转到 1.57 rad
ros2 action send_goal /joint_trajectory_controller/follow_joint_trajectory \
  control_msgs/action/FollowJointTrajectory \
  "{trajectory: {joint_names: ['joint1'], points: [{positions: [1.57], time_from_start: {sec: 2}}]}}" \
  --feedback
```

运行后可以观察到：

-   joint1 的 position 从 0 平滑运动到 1.57（RViz 里能看到关节转动）。
-   反馈里有 `desired` 和 `actual`，体现"期望轨迹 vs 实际跟踪"。

#### 5.2 用 Python 控制（Action 客户端）

实际项目中用代码发送轨迹更常见：

```python
# send_trajectory.py：发送关节轨迹的 Action 客户端
import rclpy
from rclpy.action import ActionClient
from rclpy.node import Node
from control_msgs.action import FollowJointTrajectory
from trajectory_msgs.msg import JointTrajectoryPoint

class TrajectoryClient(Node):
    def __init__(self):
        super().__init__('trajectory_client')
        self.client = ActionClient(
            self,
            FollowJointTrajectory,
            '/joint_trajectory_controller/follow_joint_trajectory')
        self.client.wait_for_server()
        self.get_logger().info('trajectory server connected')

    def send(self, positions, seconds=2.0):
        goal = FollowJointTrajectory.Goal()
        point = JointTrajectoryPoint()
        point.positions = list(positions)
        point.time_from_start.sec = int(seconds)
        goal.trajectory.joint_names = ['joint1']
        goal.trajectory.points = [point]
        future = self.client.send_goal_async(goal)
        future.add_done_callback(self._goal_done)

    def _goal_done(self, future):
        goal_handle = future.result()
        if goal_handle.accepted:
            self.get_logger().info('goal accepted')
            goal_handle.get_result_async()
        else:
            self.get_logger().warn('goal rejected')

def main():
    rclpy.init()
    node = TrajectoryClient()
    node.send([1.57])      # 转到 90 度
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

运行：

```bash
python3 send_trajectory.py
# 日志：trajectory server connected → goal accepted
```

#### 5.3 C++ 版本（Action 客户端）

```cpp
// send_trajectory.cpp：C++ 发送关节轨迹
#include <rclcpp/rclcpp.hpp>
#include <rclcpp_action/rclcpp_action.hpp>
#include <control_msgs/action/follow_joint_trajectory.hpp>
#include <trajectory_msgs/msg/joint_trajectory_point.hpp>

using FollowJointTrajectory = control_msgs::action::FollowJointTrajectory;

class TrajectoryClient : public rclcpp::Node {
public:
  using Client = rclcpp_action::Client<FollowJointTrajectory>;

  TrajectoryClient() : Node("trajectory_client") {
    client_ = rclcpp_action::create_client<FollowJointTrajectory>(
        this, "/joint_trajectory_controller/follow_joint_trajectory");
    while (!client_->wait_for_action_server(std::chrono::seconds(1))) {
      RCLCPP_INFO(get_logger(), "waiting for action server...");
    }
    RCLCPP_INFO(get_logger(), "action server connected");
    send(1.57);
  }

  void send(double position, double seconds = 2.0) {
    auto goal = FollowJointTrajectory::Goal();
    trajectory_msgs::msg::JointTrajectoryPoint point;
    point.positions.push_back(position);
    point.time_from_start = rclcpp::Duration::from_seconds(seconds);
    goal.trajectory.joint_names = {"joint1"};
    goal.trajectory.points.push_back(point);

    auto send_opt = rclcpp_action::Client<FollowJointTrajectory>::SendGoalOptions();
    send_opt.goal_response_callback = [this](auto future) {
      if (future.get()) RCLCPP_INFO(get_logger(), "goal accepted");
      else RCLCPP_WARN(get_logger(), "goal rejected");
    };
    client_->async_send_goal(goal, send_opt);
  }

private:
  std::shared_ptr<Client> client_;
};

int main(int argc, char **argv) {
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<TrajectoryClient>());
  rclcpp::shutdown();
  return 0;
}
```

CMakeLists.txt 关键配置：

```cmake
find_package(control_msgs REQUIRED)
find_package(trajectory_msgs REQUIRED)
find_package(rclcpp_action REQUIRED)
add_executable(send_trajectory src/send_trajectory.cpp)
ament_target_dependencies(send_trajectory rclcpp rclcpp_action control_msgs trajectory_msgs)
```

### 六、示例 3：差速驱动控制器（机器人底盘）

单关节太简单，机器人真正常用的是 **diff_drive_controller**：订阅 `/cmd_vel`（速度指令），自动换算成左右轮速度。这是两轮差速底盘的标配。

#### 6.1 URDF 声明差速底盘硬件

```xml
<ros2_control name="DiffDriveHW" type="system">
  <hardware>
    <plugin>mock_components/GenericSystem</plugin>
  </hardware>
  <joint name="wheel_left_joint">
    <command_interface name="velocity"/>
    <state_interface name="position"/>
    <state_interface name="velocity"/>
  </joint>
  <joint name="wheel_right_joint">
    <command_interface name="velocity"/>
    <state_interface name="position"/>
    <state_interface name="velocity"/>
  </joint>
</ros2_control>
```

#### 6.2 配置 diff_drive_controller

```yaml
controller_manager:
  ros__parameters:
    update_rate: 100
    diff_drive_controller:
      type: diff_drive_controller/DiffDriveController
    joint_state_broadcaster:
      type: joint_state_broadcaster/JointStateBroadcaster

diff_drive_controller:
  ros__parameters:
    left_wheel_names: ['wheel_left_joint']
    right_wheel_names: ['wheel_right_joint']
    wheel_separation: 0.4      # 轮距 0.4m
    wheels_per_side: 1
    wheel_radius: 0.1          # 轮半径 0.1m
    command_interfaces: ['velocity']
    state_interfaces: ['position', 'velocity']
    publish_rate: 50.0
    odom_frame_id: odom
    base_frame_id: base_link
    pose_covariance_diagonal: [0.001, 0.001, 0.0, 0.0, 0.0, 0.01]
    twist_covariance_diagonal: [0.001, 0.0, 0.0, 0.0, 0.0, 0.01]
```

关键参数：`wheel_separation`（轮距）、`wheel_radius`（轮半径）——这两项决定了 `/cmd_vel` 到轮速的换算。差速模型：

```text
左轮速度 = (v - ω × wheel_separation / 2) / wheel_radius
右轮速度 = (v + ω × wheel_separation / 2) / wheel_radius
其中 v=线速度，ω=角速度
```

#### 6.3 启动并控制小车

```bash
# 启动（launch 里加载 diff_drive_controller）
ros2 launch diff_drive_robot control.launch.py

# 查看控制器
ros2 control list_controllers
# diff_drive_controller[DiffDriveController] active

# 让小车向前走 1 秒
ros2 topic pub /cmd_vel geometry_msgs/msg/Twist \
  "{linear: {x: 0.5}, angular: {z: 0.0}}" --once

# 查看里程计
ros2 topic echo /odom
# position.x 不断增大，说明底盘在"动"（仿真里程计）

# 原地旋转
ros2 topic pub /cmd_vel geometry_msgs/msg/Twist \
  "{linear: {x: 0.0}, angular: {z: 0.5}}" --once
# /odom 的 yaw 角不断变化
```

**为什么重要**：`/cmd_vel → /odom` 的闭环，正是建图（第 21 篇）和导航（第 24 篇）的基础。Nav2 发的 `/cmd_vel`，就是被这个 diff_drive_controller 消费的。

### 七、自定义控制器（原理）

官方控制器不够用时，可以写自定义控制器。核心是继承 `controller_interface::ControllerInterface`，实现四个方法：

```cpp
// my_controller.cpp 骨架：自定义控制器
#include <controller_interface/controller_interface.hpp>
#include <rclcpp_lifecycle/state.hpp>

namespace my_robot {

class MyController : public controller_interface::ControllerInterface {
public:
  // 1. 声明参数（如控制增益）
  controller_interface::CallbackReturn on_init() override {
    auto_declare<std::vector<std::string>>("joints", {});
    auto_declare<double>("gain", 1.0);
    return controller_interface::CallbackReturn::SUCCESS;
  }

  // 2. 配置：获取硬件接口引用（命令 + 状态）
  controller_interface::CallbackReturn on_configure(
      const rclcpp_lifecycle::State &) override {
    joint_ = get_node()->get_parameter("joints").as_string_array()[0];
    gain_ = get_node()->get_parameter("gain").as_double();
    command_itf_ = std::find_if(
        command_interfaces_.begin(), command_interfaces_.end(),
        [this](const auto &itf) {
          return itf.get_interface_name() == "position" &&
                 itf.get_prefix_name() == joint_;
        });
    return controller_interface::CallbackReturn::SUCCESS;
  }

  // 3. 激活
  controller_interface::CallbackReturn on_activate(
      const rclcpp_lifecycle::State &) override {
    return controller_interface::CallbackReturn::SUCCESS;
  }

  // 4. 控制循环：读取参考，写命令（核心逻辑）
  controller_interface::return_type update(
      const rclcpp::Time &, const rclcpp::Duration &) override {
    // 简化：命令 = 固定值 × 增益（实际应订阅目标并计算）
    command_itf_->get().set_value(gain_ * 0.5);
    return controller_interface::return_type::OK;
  }

private:
  std::string joint_;
  double gain_;
  std::vector<controller_interface::InterfaceReference>::iterator command_itf_;
};

}  // namespace my_robot

#include "pluginlib/class_list_macros.hpp"
PLUGINLIB_EXPORT_CLASS(my_robot::MyController, controller_interface::ControllerInterface)
```

配套插件描述文件：

```xml
<!-- my_controller_plugin.xml -->
<library path="my_controller">
  <class name="my_robot/MyController"
         type="my_robot::MyController"
         base_class_type="controller_interface::ControllerInterface">
    <description>My custom controller</description>
  </class>
</library>
```

然后在 YAML 中引用：

```yaml
controller_manager:
  ros__parameters:
    my_controller:
      type: my_robot/MyController
my_controller:
  ros__parameters:
    joints: ['joint1']
    gain: 2.0
```

### 八、常见问题与排障

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `controller_manager` 启动报找不到插件 | 插件描述文件未导出 | `pluginlib_export_plugin_description_file(controller_interface my_controller_plugin.xml)` 后重新编译 |
| 控制器状态 inactive | 未激活 | `ros2 control load_controller` + `ros2 control switch_controllers --activate` |
| 接口名不匹配报错 | URDF 接口与 YAML 接口不一致 | 检查命令/状态接口的名称和类型 |
| 关节不动但无报错 | 命令被限制（limit）或控制器未接管 | 检查 joint limit 配置、`ros2 control list_controllers` 状态 |
| /odom 无输出 | diff_drive 未激活或参数错误 | 检查 wheel_separation/radius 和命名空间 |
| 控制频率太低 | update_rate 太低 | 提高 update_rate（如 200Hz） |

### 九、小结与下一篇预告

**本篇核心**：

1.  ros2_control 三大组件：Controller Manager（管家）、Controller（算法）、Hardware Interface（驱动），标准接口解耦硬件与控制。
2.  两类接口：Command Interface（写命令）+ State Interface（读状态），资源接口名格式 `关节/接口`。
3.  控制循环：读状态 → 计算 → 写命令，100Hz 周期驱动。
4.  仿真硬件（mock_components）让无硬件也能跑通：单关节轨迹控制、差速底盘 `/cmd_vel → /odom` 闭环。

至此我们理解了"机器人关节如何被 ROS2 统一管理"。下一篇（第 29 篇）进入 **控制硬件实战（电机驱动，原理）**：从原理到代码，讲透直流电机驱动（H 桥、PWM）、编码器测速、PID 闭环控制，并把它们接到 ros2_control 的硬件接口上，让"纸面上的关节"变成"真正转动的电机"。硬件控制阶段最实战的一篇即将展开。
