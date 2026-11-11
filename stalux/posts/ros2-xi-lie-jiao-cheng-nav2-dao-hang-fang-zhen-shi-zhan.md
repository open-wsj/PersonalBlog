---
title: "ROS2系列教程：Nav2导航仿真实战（全局+局部规划）"
abbrlink: ros2-xi-lie-jiao-cheng-nav2-dao-hang-fang-zhen-shi-zhan
date: "2026-09-08 18:08:19"
categories:
    - "ROS2"
tags: []
desc: "本文是 ROS2 系列教程的第 24 篇：Nav2 导航仿真实战（全局+局部规划）。至此我们已有地图（第 21/22 篇）、有定位（第 23 篇），就差\"自己走路\"…"
---
## 本文是 ROS2 系列教程的第 24 篇

> 本文是 ROS2 系列教程的第 24 篇：Nav2 导航仿真实战（全局+局部规划）。至此我们已有地图（第 21/22 篇）、有定位（第 23 篇），就差"自己走路"。Nav2（Navigation2）是 ROS2 的官方导航框架：给它一个目标点，它负责全局路径规划（A* 在整张地图找路）、局部避障（DWA 实时躲障碍）、输出速度指令，全程自主。本篇先把 Nav2 的架构与行为树讲清楚，再给出一套能直接跑的仿真配置，最后用 RViz 2D Goal Pose 和命令行两种方式下发目标，亲眼看着小车避开障碍、抵达终点。这是整个导航系列从"会建图"到"会走路"的临门一脚。

### 一、Nav2 是什么

#### 1.1 定位

Nav2 是 ROS2 官方导航栈（Nav1 的继任者），一个"插件化、可配置"的导航框架。它把导航拆成多个可替换的服务器（server），每个都能换插件：

-   **Planner Server**（规划）：全局路径规划。
-   **Controller Server**（控制）：局部避障与速度输出。
-   **Behavior Server**（行为）：旋转恢复、回退、等待。
-   **Costmap 2D**（代价地图）：把地图 + 障碍物转成可规划的代价图。
-   **BT Navigator**（行为树）：用行为树编排上述流程。

安装：

```bash
sudo apt install ros-humble-nav2-bringup
# 验证
ros2 pkg list | grep nav2
```

#### 1.2 导航流程

```
用户目标点 (goal_pose)
  → BT Navigator（行为树编排）
     → Planner Server：A* 全局路径（map 上找路）
     → Costmap：局部代价图（实时障碍）
     → Controller Server：DWA 局部规划（避开动态障碍）
  → /cmd_vel（速度指令）
  → 机器人移动 → odom/scan 反馈 → 循环
```

#### 1.3 两个规划器的分工

| 规划器 | 名字 | 输入 | 输出 | 频率 |
| --- | --- | --- | --- | --- |
| 全局规划 | NavFn（A*） | `/map` + 目标点 | 全局路径 `/plan` | 低频（路径变化时） |
| 局部规划 | DWB/DWA | 全局路径片段 + 局部代价图 + 激光 | 速度 `cmd_vel` | 高频（10-20Hz） |

**比喻**：全局规划是"导航地图选路线"，局部规划是"司机看路避坑"。

### 二、Nav2 配置文件

#### 2.1 nav2_params.yaml 核心结构

```yaml
# nav2_params.yaml
bt_navigator:
  ros__parameters:
    use_sim_time: True
    plugin_lib_names:
      - nav2_compute_path_to_pose_action_bt_node
      - nav2_compute_path_through_poses_action_bt_node
      - nav2_follow_path_action_bt_node
      - nav2_back_up_action_bt_node
      - nav2_drive_on_heading_bt_node
      - nav2_wait_action_bt_node
      - nav2_spin_action_bt_node
      - nav2_clear_costmap_service_bt_node
    default_nav_through_poses_bt_xml: /opt/ros/humble/share/nav2_bt_navigator/behavior_trees/navigate_through_poses_w_replanning_and_recovery.xml
    default_nav_to_pose_bt_xml: /opt/ros/humble/share/nav2_bt_navigator/behavior_trees/navigate_to_pose_w_replanning_and_recovery.xml

controller_server:
  ros__parameters:
    use_sim_time: True
    controller_frequency: 15.0
    min_x_velocity_threshold: 0.001
    min_y_velocity_threshold: 0.001
    min_theta_velocity_threshold: 0.001
    progress_checker_plugin: "progress_checker"
    goal_checker_plugin: "general_goal_checker"
    controller_plugins: ["FollowPath"]

    progress_checker:
      plugin: "nav2_controller::SimpleProgressChecker"
      required_movement_radius: 0.5
      movement_time_allowance: 10.0
    general_goal_checker:
      stateful: True
      xy_goal_tolerance: 0.25
      yaw_goal_tolerance: 0.25
    FollowPath:
      plugin: "dwb_core::DWBLocalPlanner"
      debug_trajectory_details: True
      min_vel_x: 0.0
      max_vel_x: 0.5
      min_vel_y: 0.0
      max_vel_y: 0.0
      max_vel_theta: 1.0
      min_speed_xy: 0.0
      max_speed_xy: 0.5
      min_speed_theta: 0.0
      acc_lim_x: 2.5
      acc_lim_y: 2.5
      acc_lim_theta: 3.2
      decel_lim_x: -2.5
      decel_lim_y: -2.5
      decel_lim_theta: -3.2
      vx_samples: 20
      vy_samples: 5
      vtheta_samples: 20
      sim_time: 1.7
      linear_granularity: 0.05
      angular_granularity: 0.025
      transform_tolerance: 0.2
      xy_goal_tolerance: 0.25
      trans_stopped_velocity: 0.25
      short_circuit_trajectory_evaluation: True
      stateful: True
      critics: ["RotateToGoal", "Oscillation", "BaseObstacle", "GoalAlign", "PathAlign", "PathDist", "GoalDist"]
      BaseObstacle.scale: 0.02
      PathAlign.scale: 32.0
      PathDist.scale: 32.0
      GoalDist.scale: 24.0
      RotateToGoal.scale: 32.0

planner_server:
  ros__parameters:
    use_sim_time: True
    planner_plugins: ["GridBased"]
    GridBased:
      plugin: "nav2_navfn_planner/NavfnPlanner"
      tolerance: 0.5
      use_astar: true
      allow_unknown: true

behavior_server:
  ros__parameters:
    use_sim_time: True
    local_costmap_topic: local_costmap/costmap_raw
    global_costmap_topic: global_costmap/costmap_raw
    robot_base_frame: base_link
    behavior_plugins: ["spin", "back_up", "drive_on_heading", "wait"]
    spin:
      plugin: "nav2_behaviors::Spin"
      simulate_ahead_time: 2.0
      max_rotational_vel: 1.0
      min_rotational_vel: 0.4
    back_up:
      plugin: "nav2_behaviors::BackUp"
      simulate_ahead_time: 2.0
      max_rotational_vel: 1.0
      min_rotational_vel: 0.4
```

#### 2.2 代价地图（costmap）配置

代价地图把地图 + 传感器障碍融合成"可通行性"图，分全局和局部两张：

```yaml
# 全局代价地图
global_costmap:
  global_costmap:
    ros__parameters:
      use_sim_time: True
      robot_radius: 0.20
      obstacle_layer:
        plugin: "nav2_costmap_2d::ObstacleLayer"
        enabled: True
        observation_sources: scan
        scan:
          topic: /scan
          max_obstacle_height: 2.0
          clearing: True
          marking: True
          data_type: "LaserScan"
      inflation_layer:
        plugin: "nav2_costmap_2d::InflationLayer"
        cost_scaling_factor: 3.0
        inflation_radius: 0.55
      static_layer:
        plugin: "nav2_costmap_2d::StaticLayer"
        map_subscribe_transient_local: True
      always_send_full_costmap: True
      robot_radius: 0.20
      update_frequency: 1.0
      publish_frequency: 1.0

# 局部代价地图
local_costmap:
  local_costmap:
    ros__parameters:
      use_sim_time: True
      robot_radius: 0.20
      obstacle_layer:
        plugin: "nav2_costmap_2d::ObstacleLayer"
        enabled: True
        observation_sources: scan
        scan:
          topic: /scan
          max_obstacle_height: 2.0
          clearing: True
          marking: True
          data_type: "LaserScan"
      inflation_layer:
        plugin: "nav2_costmap_2d::InflationLayer"
        cost_scaling_factor: 3.0
        inflation_radius: 0.55
      static_layer:
        plugin: "nav2_costmap_2d::StaticLayer"
      always_send_full_costmap: True
      width: 3
      height: 3
      resolution: 0.05
      update_frequency: 5.0
      publish_frequency: 2.0
      rolling_window: true
```

**关键参数**：

| 参数 | 含义 | 调参 |
| --- | --- | --- |
| `robot_radius` | 机器人半径（膨胀用） | 与小车尺寸匹配（0.2） |
| `inflation_radius` | 障碍膨胀半径 | 太大路径保守、太小贴墙走（0.55） |
| `cost_scaling_factor` | 代价衰减速度 | 3.0 适中 |
| `rolling_window` | 局部图是否跟随机器人滚动 | 局部必须 true |
| `width/height` | 局部图大小 | 3×3m 够用 |

**robot_radius 与 inflation 是导航好不好走的关键**：半径设太小会贴墙蹭，设太大窄缝过不去。

### 三、一键启动导航

#### 3.1 nav2.launch.py

```python
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch_ros.actions import Node
from launch.substitutions import LaunchConfiguration
import os
from ament_index_python.packages import get_package_share_directory

def generate_launch_description():
    pkg_bringup = get_package_share_directory('my_robot_bringup')

    map_yaml = os.path.join(pkg_bringup, 'maps', 'my_map.yaml')
    nav2_params = os.path.join(pkg_bringup, 'config', 'nav2_params.yaml')

    nav2_bringup = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(get_package_share_directory('nav2_bringup'),
                         'launch', 'bringup_launch.py')),
        launch_arguments={
            'map': map_yaml,
            'params_file': nav2_params,
            'use_sim_time': 'true'}.items())

    rviz = Node(
        package='rviz2', executable='rviz2',
        arguments=['-d', os.path.join(pkg_bringup, 'config', 'nav2.rviz')],
        output='screen')

    return LaunchDescription([nav2_bringup, rviz])
```

#### 3.2 完整导航运行

```bash
# 终端 1：仿真小车
ros2 launch my_robot_bringup gazebo.launch.py

# 终端 2：Nav2 导航（地图 + AMCL + 规划器 + 行为树）
ros2 launch my_robot_bringup nav2.launch.py
```

启动后 `nav2_bringup` 会拉起：map_server、amcl、planner_server、controller_server、behavior_server、bt_navigator、costmap 全部节点。

#### 3.3 检查所有节点就绪

```bash
ros2 node list
# 应看到 map_server、amcl、planner_server、controller_server、
# behavior_server、bt_navigator、costmap 相关节点

# 检查生命周期状态（全部应为 active）
ros2 lifecycle get /bt_navigator
ros2 lifecycle get /controller_server
```

### 四、下发导航目标

#### 4.1 RViz 方式（最直观）

1.  先用 **2D Pose Estimate** 给机器人一个初始位姿（点地图上小车位置并拖动方向）。
2.  用 **2D Goal Pose** 点击目标位置（拖动设定朝向）。
3.  观察：全局路径画出（绿色线），小车沿路径前进，遇到障碍时局部路径避让。

#### 4.2 命令行方式

```bash
# 通过 NavigateToPose 动作下发目标（x=1.5, y=0, θ=0）
ros2 action send_goal /navigate_to_pose nav2_msgs/action/NavigateToPose \
  "{pose: {header: {frame_id: 'map'},
           pose: {position: {x: 1.5, y: 0.0, z: 0.0},
                  orientation: {w: 1.0}}}}"

# 通过话题（更简单，适合脚本）
ros2 topic pub /goal_pose geometry_msgs/msg/PoseStamped \
  "{header: {frame_id: 'map'},
    pose: {position: {x: 1.5, y: 0.0, z: 0.0},
           orientation: {w: 1.0}}}" --once
```

#### 4.3 C++ 下发目标（程序化导航）

```cpp
// send_goal.cpp：向 /navigate_to_pose 发送目标
#include <rclcpp/rclcpp.hpp>
#include <nav2_msgs/action/navigate_to_pose.hpp>
#include <rclcpp_action/rclcpp_action.hpp>

class NavClient : public rclcpp::Node
{
public:
  using NavigateToPose = nav2_msgs::action::NavigateToPose;
  using GoalHandle = rclcpp_action::ClientGoalHandle<NavigateToPose>;

  NavClient() : Node("nav_client")
  {
    client_ = rclcpp_action::create_client<NavigateToPose>(this, "/navigate_to_pose");
  }

  void send_goal(double x, double y, double yaw)
  {
    if (!client_->wait_for_action_server(std::chrono::seconds(5))) {
      RCLCPP_ERROR(this->get_logger(), "Nav2 action server 不可用");
      return;
    }
    auto goal = NavigateToPose::Goal();
    goal.pose.header.frame_id = "map";
    goal.pose.header.stamp = now();
    goal.pose.pose.position.x = x;
    goal.pose.pose.position.y = y;
    // yaw -> 四元数（绕 z 轴旋转）
    goal.pose.pose.orientation.z = std::sin(yaw / 2.0);
    goal.pose.pose.orientation.w = std::cos(yaw / 2.0);

    auto send_goal_options = rclcpp_action::Client<NavigateToPose>::SendGoalOptions();
    send_goal_options.goal_response_callback =
      [this](GoalHandle::SharedPtr gh) {
        if (gh) RCLCPP_INFO(this->get_logger(), "目标被接受");
        else    RCLCPP_ERROR(this->get_logger(), "目标被拒绝");
      };
    send_goal_options.result_callback =
      [this](const GoalHandle::WrappedResult& result) {
        if (result.code == rclcpp_action::ResultCode::SUCCEEDED)
          RCLCPP_INFO(this->get_logger(), "导航成功！");
        else
          RCLCPP_ERROR(this->get_logger(), "导航失败，状态码=%d",
                       static_cast<int>(result.code));
      };
    client_->async_send_goal(goal, send_goal_options);
  }

private:
  rclcpp_action::Client<NavigateToPose>::SharedPtr client_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  auto node = std::make_shared<NavClient>();
  double x = argc > 1 ? std::atof(argv[1]) : 1.5;
  double y = argc > 2 ? std::atof(argv[2]) : 0.0;
  node->send_goal(x, y, 0.0);
  rclcpp::spin(node);
  rclcpp::shutdown();
  return 0;
}
```

#### 4.4 Python 下发目标

```python
# send_goal.py
import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient
from nav2_msgs.action import NavigateToPose
from geometry_msgs.msg import PoseStamped

class NavClient(Node):
    def __init__(self):
        super().__init__('nav_client')
        self.client = ActionClient(self, NavigateToPose, '/navigate_to_pose')

    def send_goal(self, x, y, yaw=0.0):
        if not self.client.wait_for_server(timeout_sec=5.0):
            self.get_logger().error('Nav2 action server 不可用')
            return

        goal = NavigateToPose.Goal()
        goal.pose = PoseStamped()
        goal.pose.header.frame_id = 'map'
        goal.pose.header.stamp = self.get_clock().now().to_msg()
        goal.pose.pose.position.x = x
        goal.pose.pose.position.y = y
        goal.pose.pose.orientation.z = float(__import__('math').sin(yaw / 2))
        goal.pose.pose.orientation.w = float(__import__('math').cos(yaw / 2))

        self.client.send_goal_async(goal).add_done_callback(self.goal_cb)
        self.get_logger().info(f'目标已发送: ({x}, {y})')

    def goal_cb(self, future):
        goal_handle = future.result()
        if not goal_handle.accepted:
            self.get_logger().error('目标被拒绝')
            return
        self.get_logger().info('目标被接受')
        goal_handle.get_result_async().add_done_callback(self.result_cb)

    def result_cb(self, future):
        result = future.result().result
        self.get_logger().info(f'导航结果: {result}')

def main():
    rclpy.init()
    node = NavClient()
    node.send_goal(1.5, 0.0)
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

### 五、导航中的常见问题与排障

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 目标被拒绝 | Nav2 未就绪或目标无效 | `ros2 lifecycle get /bt_navigator` 应为 active |
| 小车原地打转 | 全局路径太长/局部规划无解 | 检查 robot_radius 与障碍距离 |
| 不走直线绕远路 | inflation 太大 | 调小 inflation_radius 或 cost_scaling_factor |
| 贴墙太近 | robot_radius 太小 | 调大 robot_radius |
| 卡在障碍前 | 局部规划器无可行速度 | 检查 acc_lim 是否过小；增加 recovery |
| 抖动/振荡 | 控制频率低或速度阈值小 | 调大 controller_frequency 到 15-20Hz |
| 到达后不停 | goal_tolerance 太小 | 调大 xy_goal_tolerance 到 0.25 |
| 地图与传感器错位 | costmap 的 TF 问题 | 检查 use_sim_time 与 TF 树 |

#### 5.1 行为树恢复机制

Nav2 默认行为树带恢复逻辑：检测到"卡住"（SimpleProgressChecker）→ 旋转（Spin）→ 倒退（BackUp）→ 重新规划。**看到小车原地转圈别慌，那可能是它在"自救"**。

### 六、小结与下一篇预告

**本篇核心**：

1.  **Nav2 架构**：BT Navigator 编排 + Planner（全局）+ Controller（局部）+ Costmap + Behavior。
2.  **全局 vs 局部**：A* 找路 vs DWA 避障，频率与范围不同。
3.  **代价地图**：robot_radius、inflation_radius、rolling_window 三大调参点。
4.  **下发目标**：RViz 2D Goal Pose、action 命令、C++/Python 客户端三种方式。
5.  **恢复机制**：行为树带旋转/倒退/重规划的自救流程。
6.  一条龙：地图 + AMCL + Nav2 → 小车自主导航到任意可达点。

下一篇进入 **Nav2 进阶实践**（第 25 篇）：自定义算法、插件与行为树。本篇用的是默认插件（NavFn/DWB），真实项目中要换自己的规划器、加自定义行为、改行为树。我们会拆解 Nav2 的插件机制、自定义 Controller 的骨架、以及用 behavior tree XML 定制导航行为——这是把 Nav2 从"能跑"推向"好用"的关键一步。导航已通，进阶开始。
