---
title: "ROS2系列教程：Gazebo仿真基础与世界搭建"
abbrlink: ros2-xi-lie-jiao-cheng-gazebo-fang-zhen-ji-chu-yu-shi-jie
date: "2026-09-06 10:18:51"
categories:
    - "ROS2"
tags: []
desc: "内容是关于ROS2第18篇，Gazebo仿真基础与世界搭建。摘要需简洁概括核心内容。注意字数限制。</think>本文是ROS2系列第18篇，讲解Gazebo仿真基础与世界搭建…"
---
## 本文是 ROS2 系列教程的第 18 篇

> 本文是 ROS2 系列教程的第 18 篇：Gazebo 仿真基础与世界搭建。前两篇我们用 URDF/Xacro 描述了机器人的"骨骼"，但骨骼自己不会动、不会掉下来、也不会感知。Gazebo 就是那个给机器人注入物理规律的"虚拟世界"：重力、摩擦、碰撞、传感器噪声全部真实可感。本篇从零搭建 Gazebo 环境：理解 world 文件结构、掌握 `gazebo_ros` 桥接包、把小车 spawn 进世界、用 ROS2 命令控制它动起来。学完你就有了一套可复用的"仿真闭环"，后续 SLAM 建图、Nav2 导航、MoveIt2 全部在此之上进行。

### 一、Gazebo 是什么

#### 1.1 定位

Gazebo 是一个**高保真 3D 机器人仿真器**，提供：

-   **物理引擎**（ODE/Bullet 等）：重力、摩擦、碰撞、关节约束。
-   **传感器仿真**：激光雷达（gpu_laser）、相机、IMU、接触传感器。
-   **世界构建**：静态物体、地形、光源、GUI 交互。
-   **ROS2 桥接**：`gazebo_ros` 包把仿真世界和 ROS2 话题无缝对接。

在 ROS2 Humble 中，经典 Gazebo（Gazebo Classic 11）仍是教学主流，`ros_gz`（新 Gazebo 与 ROS2 的桥接）正在兴起。本篇以 **Gazebo Classic + gazebo_ros** 为例，概念对新版同样适用。

#### 1.2 安装

```bash
# Ubuntu 22.04 + ROS2 Humble
sudo apt install ros-humble-gazebo-ros-pkgs

# 验证
ros2 pkg list | grep gazebo
# 输出：gazebo_dev、gazebo_msgs、gazebo_plugins、gazebo_ros、gazebo_ros_pkgs
```

启动测试：

```bash
gazebo --verbose
```

如果打开一个带地板和天空的默认世界，说明安装成功。

#### 1.3 与 RViz 的分工

| 工具 | 作用 | 谁在"算" |
| --- | --- | --- |
| RViz | 可视化显示 | 只是"看"，不产生物理 |
| Gazebo | 物理仿真 | 真实计算重力/碰撞/传感器 |
| 两者关系 | Gazebo 是"真实世界"，RViz 是"仪表盘" | 常同时运行 |

理解：**Gazebo 里掉下来的东西真的会摔，RViz 里不会**。仿真流程中通常 Gazebo 跑物理，ROS2 节点发控制指令，RViz 显示 TF/地图/点云。

### 二、world 文件：虚拟世界的"地图"

#### 2.1 world 文件是什么

world 文件是 Gazebo 的 SDF（Simulation Description Format）文件，描述世界的物理属性、静态物体、光照等。它是 Gazebo 世界的"上帝视角配置"。

最小 world 文件：

```xml
<?xml version="1.0"?>
<sdf version="1.6">
  <world name="default">
    <!-- 物理参数 -->
    <physics type="ode">
      <max_step_size>0.001</max_step_size>
      <real_time_factor>1</real_time_factor>
    </physics>
    <!-- 光照 -->
    <include>
      <uri>model://sun</uri>
    </include>
    <!-- 地面 -->
    <include>
      <uri>model://ground_plane</uri>
    </include>
  </world>
</sdf>
```

#### 2.2 常用元素

| 元素 | 作用 | 关键属性 |
| --- | --- | --- |
| `<physics>` | 物理引擎参数 | `max_step_size`（仿真步长，越小越稳）、`real_time_factor`（实时因子） |
| `<include><uri>model://sun</uri>` | 太阳光照 | 默认就有 |
| `<include><uri>model://ground_plane</uri>` | 地面（带摩擦） | 默认就有 |
| `<model>` | 静态物体（墙/障碍） | 自己定义 |
| `<scene>` | 环境背景色/雾 | 可选 |
| `<gravity>` | 重力向量 | 默认 `0 0 -9.8` |

#### 2.3 添加障碍物（墙）

```xml
<model name="wall">
  <static>true</static>
  <link name="wall_link">
    <collision name="collision">
      <geometry>
        <box>
          <size>2.0 0.2 0.5</size>
        </box>
      </geometry>
    </collision>
    <visual name="visual">
      <geometry>
        <box>
          <size>2.0 0.2 0.5</size>
        </box>
      </geometry>
      <material>
        <ambient>0.8 0.2 0.2 1</ambient>
      </material>
    </visual>
  </link>
  <pose>0 0 0.25 0 0 0</pose>
</model>
```

`<static>true</static>` 表示不可移动。把墙摆成迷宫，就有了 SLAM 建图的世界。

### 三、把机器人放进世界：spawn_entity

#### 3.1 gazebo_ros 的核心节点

`gazebo_ros` 提供两个关键可执行文件：

-   `gazebo`：启动仿真服务器与 GUI。
-   `spawn_entity.py`：把 URDF/SDF 模型生成到世界中。

spawn 的本质：把 `robot_description` 参数里的 URDF 转成 SDF，插入 Gazebo 世界，并在 world 坐标系的指定位姿处放置。

#### 3.2 命令行手动 spawn

```bash
# 1. 启动世界（先手动放好机器人）
ros2 run gazebo_ros gazebo --verbose -s libgazebo_ros_factory.so

# 2. 另一个终端：spawn 机器人到 (0,0,0.1)
ros2 run gazebo_ros spawn_entity.py \
  -topic robot_description \
  -entity demo_car \
  -x 0 -y 0 -z 0.1
```

-   `-topic robot_description`：从话题读 URDF（需要有人发布）。
-   `-entity`：模型在 Gazebo 中的名字。
-   `-x -y -z`：spawn 位置；`-R -P -Y`：姿态（欧拉角）。

#### 3.3 一步到位：launch 文件

工程实践中从 launch 启动，模板如下：

```python
# gazebo.launch.py
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription, SetEnvironmentVariable
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch_ros.actions import Node
from launch.substitutions import Command
import os
from ament_index_python.packages import get_package_share_directory

def generate_launch_description():
    # 1. 找到世界文件
    world_path = os.path.join(
        get_package_share_directory('my_robot_bringup'),
        'worlds', 'my_world.world')

    # 2. 启动 Gazebo（加载世界）
    gazebo = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(get_package_share_directory('gazebo_ros'),
                         'launch', 'gazebo.launch.py')),
        launch_arguments={'world': world_path}.items(),
    )

    # 3. 发布 robot_description（xacro 展开）
    robot_state_publisher = Node(
        package='robot_state_publisher',
        executable='robot_state_publisher',
        parameters=[{'robot_description': Command(
            ['xacro ', os.path.join(
                get_package_share_directory('my_robot_description'),
                'urdf', 'demo_car.xacro')])}],
        output='screen',
    )

    # 4. spawn 机器人
    spawn_entity = Node(
        package='gazebo_ros',
        executable='spawn_entity.py',
        arguments=['-topic', 'robot_description',
                   '-entity', 'demo_car',
                   '-x', '0', '-y', '0', '-z', '0.1'],
        output='screen',
    )

    return LaunchDescription([
        SetEnvironmentVariable('GZ_SIM_RESOURCE_PATH', os.path.join(
            get_package_share_directory('my_robot_description'), 'meshes')),
        gazebo,
        robot_state_publisher,
        spawn_entity,
    ])
```

运行：

```bash
ros2 launch my_robot_bringup gazebo.launch.py
```

如果一切正常：Gazebo 窗口中出现小车，RViz（另开）能看到 TF 树。**此时小车会立刻被重力按在地面上**——因为惯性/碰撞体都配好了。

#### 3.4 常见失败：机器人掉穿地面

小车掉穿地面通常原因：

1.  **模型碰撞体缺失**：检查每个 link 都有 `<collision>`。
2.  **spawn 高度太低**：`-z` 应大于底盘一半高度（0.1 一般够）。
3.  **碰撞体与 visual 不一致**：visual 比 collision 大，看起来"悬空"。

排查命令：

```bash
# 看模型是否在 /tf 中（base_link 相对 world）
ros2 run tf2_ros tf2_echo world base_link
```

### 四、让小车动起来：差速驱动插件

#### 4.1 差速驱动原理回顾

差速小车通过左右轮速度差控制运动：

-   两轮同速同向 → 直行。
-   两轮同速反向 → 原地旋转。
-   速度差 → 转弯。

控制输入是 `cmd_vel`（`geometry_msgs/msg/Twist`：线速度+角速度），gazebo 差速插件把它转成左右轮角速度。

#### 4.2 在 URDF 中加差速插件（gazebo 标签）

在 URDF/Xacro 的 `<robot>` 内、link/joint 之外添加：

```xml
<!-- gazebo 标签专门给仿真用，URDF 解析器会忽略 -->
<gazebo>
  <plugin name="diff_drive" filename="libgazebo_ros_diff_drive.so">
    <ros>
      <namespace>/</namespace>
      <remapping>cmd_vel:=cmd_vel</remapping>
    </ros>
    <update_rate>30</update_rate>
    <left_joint>base_to_wheel_1</left_joint>
    <right_joint>base_to_wheel_-1</right_joint>
    <wheel_separation>0.38</wheel_separation>
    <wheel_diameter>0.16</wheel_diameter>
    <max_wheel_torque>20</max_wheel_torque>
    <max_wheel_acceleration>1.0</max_wheel_acceleration>
    <command_topic>cmd_vel</command_topic>
    <publish_odom>true</publish_odom>
    <publish_odom_tf>true</publish_odom_tf>
    <odometry_frame>odom</odometry_frame>
    <robot_base_frame>base_link</robot_base_frame>
  </plugin>
</gazebo>
```

关键参数：

| 参数 | 说明 |
| --- | --- |
| `left_joint` / `right_joint` | 左右轮关节名（必须与 URDF 一致） |
| `wheel_separation` | 轮距（两轮中心距离，米） |
| `wheel_diameter` | 轮径（米） |
| `command_topic` | 订阅的速度指令话题，默认 `cmd_vel` |
| `publish_odom` | 发布里程计（odom 话题） |
| `publish_odom_tf` | 发布 odom→base_link 的 TF |
| `odometry_frame` | 里程计坐标系名（`odom`） |
| `robot_base_frame` | 机器人底盘坐标系名（`base_link`） |

#### 4.3 发送速度指令

```bash
# 直行 0.5 m/s
ros2 topic pub -r 10 /cmd_vel geometry_msgs/msg/Twist \
  "{linear: {x: 0.5}, angular: {z: 0.0}}"

# 原地右转
ros2 topic pub -r 10 /cmd_vel geometry_msgs/msg/Twist \
  "{linear: {x: 0.0}, angular: {z: 0.5}}"

# 停止
ros2 topic pub -r 10 /cmd_vel geometry_msgs/msg/Twist \
  "{linear: {x: 0.0}, angular: {z: 0.0}}"
```

或者用 `teleop_twist_keyboard` 手动控制：

```bash
sudo apt install ros-humble-teleop-twist-keyboard
ros2 run teleop_twist_keyboard teleop_twist_keyboard
```

按 `i`/`j`/`k`/`l` 前后左右移动，小车会在 Gazebo 中真实运动，同时 `odom` 话题输出里程计、`/tf` 广播 `odom→base_link`。

#### 4.4 里程计验证

```bash
ros2 topic echo /odom --once
```

输出包含 `pose.pose.position`（位置）和 `twist.twist.linear.x`（速度）。**这就是导航系统的输入**：SLAM 建图和 Nav2 都用 odom 做预测。

### 五、Gazebo 与 RViz 联调

#### 5.1 同时启动

推荐结构（bringup 包统一管理）：

```bash
# 终端 1：Gazebo + 小车
ros2 launch my_robot_bringup gazebo.launch.py

# 终端 2：RViz 显示
rviz2
```

RViz 添加：

-   **RobotModel**：显示模型。
-   **TF**：查看 world→odom→base_link 树。
-   **LaserScan**（下篇配好雷达后）：显示激光数据。

#### 5.2 检查话题清单

```bash
ros2 topic list
# 应看到：
# /cmd_vel
# /clock
# /odom
# /robot_description
# /tf
# /tf_static
```

`/clock` 是仿真时间（`use_sim_time=true` 时节点使用它），仿真环境必查。

#### 5.3 use_sim_time 必须开

所有"感知时间"的节点（SLAM、导航、传感器处理）在仿真中都要：

```bash
ros2 run your_node your_node --ros-args -p use_sim_time:=true
```

或 launch 里统一设置：

```python
Node(..., parameters=[{'use_sim_time': True}])
```

不开 sim time 的典型症状：TF 时间戳错乱、传感器回调延迟、导航"觉得"时间不动。

### 六、常见问题与排障

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `spawn_entity` 报 `No entity found` | robot_description 话题无数据 | 先确认 `ros2 topic echo /robot_description --once` 有内容 |
| 小车掉穿地面 | 碰撞体缺失或 spawn 太低 | 补 collision、抬高 `-z` |
| 发 cmd_vel 车不动 | 插件未加载或关节名不匹配 | `ros2 topic list` 查插件话题；核对 joint 名 |
| 模型在 Gazebo 可见但 RViz 无 TF | robot_state_publisher 未跑 | 单独启动 rsp 节点 |
| 里程计不动 | 车轮未收到力矩 | 检查 `max_wheel_torque` 是否过小 |
| Gazebo 卡顿/掉帧 | 物理步长太大或模型网格复杂 | `max_step_size` 调小到 0.001，collision 用简单形状 |
| 时间跳跃 | `real_time_factor` 与机器性能不匹配 | 关 GUI（`headless`）或用 `-r 0.5` 降速 |
| `/clock` 不存在 | 没走 gazebo_ros 启动方式 | 用 `ros2 run gazebo_ros gazebo` 而非裸 `gazebo` |

#### 6.1 headless 模式（无 GUI 仿真）

服务器/CI 场景常用：

```bash
# 无 GUI 启动（省资源，适合批量测试）
ros2 run gazebo_ros gazebo --verbose -s libgazebo_ros_factory.so --headless
```

#### 6.2 仿真时间加速/减速

```bash
# 启动时指定实时因子（0.5 = 半速仿真）
gazebo -r 0.5
```

### 七、小结与下一篇预告

**本篇核心**：

1.  **Gazebo 是物理仿真器**：重力/摩擦/碰撞/传感器，与 RViz 分工明确（仿真 vs 显示）。
2.  **world 文件**：SDF 格式，`physics`/`ground_plane`/`sun`/静态模型，可搭墙做迷宫。
3.  **spawn 流程**：`gazebo_ros` 启动世界 + `spawn_entity.py` 插入模型 + `robot_state_publisher` 发布描述。
4.  **差速插件**：`libgazebo_ros_diff_drive.so` 订阅 `cmd_vel` → 驱动左右轮 → 发布 odom/TF。
5.  **闭环验证**：launch 一键启动 → `teleop_twist_keyboard` 控制 → 话题/TF 检查。
6.  `use_sim_time` 与 `/clock` 是仿真与真机最大的区别，必须理解。

下一篇进入 **Gazebo 插件**：给小车装上"眼睛"——激光雷达（gpu_laser）、相机、IMU 插件，让传感器数据真正进入 ROS2 话题。有了传感器，机器人才能"看见"世界，这是 SLAM 建图（第 21 篇）的前提。物理世界已就绪，感知即将开启。
