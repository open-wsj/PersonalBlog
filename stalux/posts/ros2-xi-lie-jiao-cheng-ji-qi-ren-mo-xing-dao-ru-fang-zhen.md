---
title: "ROS2系列教程：机器人模型导入仿真实战"
abbrlink: ros2-xi-lie-jiao-cheng-ji-qi-ren-mo-xing-dao-ru-fang-zhen
date: "2026-09-08 18:06:24"
categories:
    - "ROS2"
tags: []
desc: "大型 ROS2 工程通常拆成两个功能包：分工原则：description 只管\"机器人长什么样\"，bringup 管\"系统怎么跑\"。导航、SLAM 等后续阶段都在 bringup 里加 launch…"
---
## 本文是 ROS2 系列教程的第 20 篇

> 本文是 ROS2 系列教程的第 20 篇：机器人模型导入仿真实战。前四篇我们分别学会了 URDF 建模、Xacro 参数化、Gazebo 世界搭建、传感器插件配置，但都是"点状"知识。本篇把它们串成一条完整生产线：从零构建一个规范的仿真工程（description + bringup 双包结构），把 Xacro 小车 + 激光雷达 + IMU + 差速插件整合，一键 launch 进 Gazebo，并用 RViz 做全链路验收。这是建模仿真阶段的收官之战，做完你将拥有一个"开箱即用"的仿真小车，直接喂给第 21 篇的 SLAM 建图。

### 一、仿真工程的规范结构

#### 1.1 为什么拆两个包

大型 ROS2 工程通常拆成两个功能包：

| 包 | 职责 | 内容 |
| --- | --- | --- |
| `xxx_description` | 描述机器人 | URDF/Xacro、网格、launch（显示用） |
| `xxx_bringup` | 启动系统 | world 文件、launch（仿真/导航/完整系统） |

分工原则：**description 只管"机器人长什么样"，bringup 管"系统怎么跑"**。导航、SLAM 等后续阶段都在 bringup 里加 launch，description 不变。

#### 1.2 目录结构

```text
my_robot_ws/src/
├── my_robot_description/
│   ├── CMakeLists.txt
│   ├── package.xml
│   ├── urdf/
│   │   └── demo_car.xacro
│   ├── meshes/                # 自定义网格（可选）
│   └── launch/
│       └── display.launch.py  # RViz 显示
└── my_robot_bringup/
    ├── CMakeLists.txt
    ├── package.xml
    ├── worlds/
    │   └── my_world.world
    └── launch/
        └── gazebo.launch.py   # 仿真启动
        └── sim.launch.py      # 仿真 + 显示
```

#### 1.3 建包命令

```bash
cd ~/my_robot_ws/src
ros2 pkg create my_robot_description --build-type ament_cmake --license Apache-2.0
ros2 pkg create my_robot_bringup --build-type ament_cmake --license Apache-2.0
mkdir -p my_robot_description/urdf my_robot_description/launch
mkdir -p my_robot_bringup/worlds my_robot_bringup/launch
```

CMakeLists.txt 安装目录（关键，否则 launch/urdf 找不到）：

```cmake
install(DIRECTORY urdf launch
  DESTINATION share/${PROJECT_NAME})

# bringup 包同样
install(DIRECTORY worlds launch
  DESTINATION share/${PROJECT_NAME})
```

### 二、整合版 Xacro：小车全家桶

#### 2.1 完整 demo_car.xacro

把前几篇的组件合成一个文件（属性 + 底盘 + 轮子宏 + 激光 + IMU + 差速插件）：

```xml
<?xml version="1.0"?>
<robot name="demo_car" xmlns:xacro="http://www.ros.org/wiki/xacro">

  <!-- ===== 全局属性 ===== -->
  <xacro:property name="chassis_length" value="0.45"/>
  <xacro:property name="chassis_width"  value="0.30"/>
  <xacro:property name="chassis_height" value="0.12"/>
  <xacro:property name="wheel_radius"   value="0.08"/>
  <xacro:property name="wheel_width"    value="0.03"/>
  <xacro:property name="wheel_base"     value="0.19"/>
  <xacro:property name="wheel_axis_z"   value="${-chassis_height/2}"/>
  <xacro:property name="laser_z"        value="${chassis_height/2}"/>
  <xacro:property name="imu_z"          value="${chassis_height/2}"/>

  <!-- ===== 底盘 ===== -->
  <link name="base_link">
    <inertial>
      <mass value="3.0"/>
      <inertia ixx="0.02" ixy="0" ixz="0" iyy="0.03" iyz="0" izz="0.02"/>
    </inertial>
    <visual>
      <geometry>
        <box size="${chassis_length} ${chassis_width} ${chassis_height}"/>
      </geometry>
      <material name="blue"><color rgba="0.2 0.4 0.8 1"/></material>
    </visual>
    <collision>
      <geometry>
        <box size="${chassis_length} ${chassis_width} ${chassis_height}"/>
      </geometry>
    </collision>
  </link>

  <!-- ===== 轮子宏 ===== -->
  <xacro:macro name="wheel" params="side">
    <link name="wheel_${side}">
      <inertial>
        <mass value="0.5"/>
        <inertia ixx="0.001" ixy="0" ixz="0" iyy="0.001" iyz="0" izz="0.001"/>
      </inertial>
      <visual>
        <geometry>
          <cylinder radius="${wheel_radius}" length="${wheel_width}"/>
        </geometry>
        <material name="dark"><color rgba="0.1 0.1 0.1 1"/></material>
      </visual>
      <collision>
        <geometry>
          <cylinder radius="${wheel_radius}" length="${wheel_width}"/>
        </geometry>
      </collision>
    </link>
    <joint name="base_to_wheel_${side}" type="revolute">
      <parent link="base_link"/>
      <child link="wheel_${side}"/>
      <origin xyz="0.15 ${side * wheel_base} ${wheel_axis_z}" rpy="0 0 0"/>
      <axis xyz="0 1 0"/>
      <limit effort="10" velocity="10" lower="-3.14" upper="3.14"/>
    </joint>
  </xacro:macro>

  <xacro:wheel side="1"/>
  <xacro:wheel side="-1"/>

  <!-- ===== 激光雷达 ===== -->
  <link name="lidar_link">
    <inertial>
      <mass value="0.2"/>
      <inertia ixx="0.0001" ixy="0" ixz="0" iyy="0.0001" iyz="0" izz="0.0001"/>
    </inertial>
    <visual>
      <geometry>
        <cylinder radius="0.05" length="0.06"/>
      </geometry>
      <material name="red"><color rgba="0.9 0.2 0.2 1"/></material>
    </visual>
    <collision>
      <geometry>
        <cylinder radius="0.05" length="0.06"/>
      </geometry>
    </collision>
  </link>
  <joint name="base_to_lidar" type="fixed">
    <parent link="base_link"/>
    <child link="lidar_link"/>
    <origin xyz="0.1 0 ${laser_z}" rpy="0 0 0"/>
  </joint>

  <!-- ===== IMU ===== -->
  <link name="imu_link">
    <inertial>
      <mass value="0.05"/>
      <inertia ixx="0.0001" ixy="0" ixz="0" iyy="0.0001" iyz="0" izz="0.0001"/>
    </inertial>
  </link>
  <joint name="base_to_imu" type="fixed">
    <parent link="base_link"/>
    <child link="imu_link"/>
    <origin xyz="0 0 ${imu_z}" rpy="0 0 0"/>
  </joint>

  <!-- ===== Gazebo 插件 ===== -->
  <!-- 差速驱动 -->
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

  <!-- 关节状态上报 -->
  <gazebo>
    <plugin name="joint_state_pub" filename="libgazebo_ros_joint_state_publisher.so">
      <ros>
        <remapping>joint_states:=joint_states</remapping>
      </ros>
      <update_rate>30</update_rate>
      <joint_name>base_to_wheel_1</joint_name>
      <joint_name>base_to_wheel_-1</joint_name>
    </plugin>
  </gazebo>

  <!-- 激光传感器 -->
  <gazebo reference="lidar_link">
    <sensor type="gpu_ray" name="lidar_sensor">
      <always_on>true</always_on>
      <update_rate>10</update_rate>
      <visualize>true</visualize>
      <plugin filename="libgazebo_ros_gpu_laser.so" name="lidar_plugin">
        <ros>
          <remapping>scan:=scan</remapping>
        </ros>
        <frame_name>lidar_link</frame_name>
        <min_range>0.12</min_range>
        <max_range>10.0</max_range>
        <update_rate>10</update_rate>
      </plugin>
      <ray>
        <scan>
          <horizontal>
            <samples>360</samples>
            <resolution>1</resolution>
            <min_angle>-3.14159265</min_angle>
            <max_angle>3.14159265</max_angle>
          </horizontal>
        </scan>
        <range>
          <min>0.12</min>
          <max>10.0</max>
          <resolution>0.01</resolution>
        </range>
      </ray>
    </sensor>
  </gazebo>

  <!-- IMU 传感器 -->
  <gazebo reference="imu_link">
    <sensor type="imu" name="imu_sensor">
      <always_on>true</always_on>
      <update_rate>100</update_rate>
      <visualize>false</visualize>
      <plugin filename="libgazebo_ros_imu.so" name="imu_plugin">
        <ros>
          <remapping>imu/data:=imu/data</remapping>
        </ros>
        <initial_orientation_as_reference>false</initial_orientation_as_reference>
        <update_rate>100</update_rate>
      </plugin>
    </sensor>
  </gazebo>

</robot>
```

#### 2.2 语法检查

```bash
# 展开并检查
xacro demo_car.xacro | check_urdf
# 应输出 root Link: base_link 有 4 个 child：wheel_1、wheel_-1、lidar_link、imu_link
```

### 三、世界文件：建图专用迷宫

#### 3.1 my_world.world

为 SLAM 建图准备一个有墙的世界：

```xml
<?xml version="1.0"?>
<sdf version="1.6">
  <world name="my_world">
    <include>
      <uri>model://sun</uri>
    </include>
    <include>
      <uri>model://ground_plane</uri>
    </include>

    <!-- 四面墙 + 中央障碍 -->
    <model name="wall_north">
      <static>true</static>
      <link name="link">
        <collision name="col">
          <geometry><box><size>4.0 0.2 0.5</size></box></geometry>
        </collision>
        <visual name="vis">
          <geometry><box><size>4.0 0.2 0.5</size></box></geometry>
          <material><ambient>0.6 0.6 0.6 1</ambient></material>
        </visual>
      </link>
      <pose>0 2 0.25 0 0 0</pose>
    </model>

    <model name="wall_south">
      <static>true</static>
      <link name="link">
        <collision name="col">
          <geometry><box><size>4.0 0.2 0.5</size></box></geometry>
        </collision>
        <visual name="vis">
          <geometry><box><size>4.0 0.2 0.5</size></box></geometry>
          <material><ambient>0.6 0.6 0.6 1</ambient></material>
        </visual>
      </link>
      <pose>0 -2 0.25 0 0 0</pose>
    </model>

    <model name="wall_east">
      <static>true</static>
      <link name="link">
        <collision name="col">
          <geometry><box><size>0.2 4.0 0.5</size></box></geometry>
        </collision>
        <visual name="vis">
          <geometry><box><size>0.2 4.0 0.5</size></box></geometry>
          <material><ambient>0.6 0.6 0.6 1</ambient></material>
        </visual>
      </link>
      <pose>2 0 0.25 0 0 0</pose>
    </model>

    <model name="wall_west">
      <static>true</static>
      <link name="link">
        <collision name="col">
          <geometry><box><size>0.2 4.0 0.5</size></box></geometry>
        </collision>
        <visual name="vis">
          <geometry><box><size>0.2 4.0 0.5</size></box></geometry>
          <material><ambient>0.6 0.6 0.6 1</ambient></material>
        </visual>
      </link>
      <pose>-2 0 0.25 0 0 0</pose>
    </model>

    <model name="obstacle_1">
      <static>true</static>
      <link name="link">
        <collision name="col">
          <geometry><box><size>0.4 0.4 0.5</size></box></geometry>
        </collision>
        <visual name="vis">
          <geometry><box><size>0.4 0.4 0.5</size></box></geometry>
          <material><ambient>0.8 0.5 0.2 1</ambient></material>
        </visual>
      </link>
      <pose>0.8 0.8 0.25 0 0 0</pose>
    </model>

    <model name="obstacle_2">
      <static>true</static>
      <link name="link">
        <collision name="col">
          <geometry><box><size>0.4 0.4 0.5</size></box></geometry>
        </collision>
        <visual name="vis">
          <geometry><box><size>0.4 0.4 0.5</size></box></geometry>
          <material><ambient>0.8 0.5 0.2 1</ambient></material>
        </visual>
      </link>
      <pose>-0.8 -0.8 0.25 0 0 0</pose>
    </model>

  </world>
</sdf>
```

#### 3.2 检查世界

```bash
# 用 gazebo 直接打开验证（不跑 ROS）
gazebo my_world.world
# 应看到四面墙 + 两个橙色障碍物
```

### 四、一键启动 launch

#### 4.1 gazebo.launch.py（仿真核心）

```python
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription, SetEnvironmentVariable
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch_ros.actions import Node
from launch.substitutions import Command
import os
from ament_index_python.packages import get_package_share_directory

def generate_launch_description():
    pkg_bringup = get_package_share_directory('my_robot_bringup')
    pkg_desc = get_package_share_directory('my_robot_description')

    world = os.path.join(pkg_bringup, 'worlds', 'my_world.world')
    xacro_file = os.path.join(pkg_desc, 'urdf', 'demo_car.xacro')

    gazebo = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(get_package_share_directory('gazebo_ros'),
                         'launch', 'gazebo.launch.py')),
        launch_arguments={'world': world}.items())

    robot_state_publisher = Node(
        package='robot_state_publisher',
        executable='robot_state_publisher',
        parameters=[{'robot_description': Command(['xacro ', xacro_file])}],
        output='screen')

    spawn = Node(
        package='gazebo_ros',
        executable='spawn_entity.py',
        arguments=['-topic', 'robot_description',
                   '-entity', 'demo_car',
                   '-x', '0', '-y', '0', '-z', '0.1'],
        output='screen')

    return LaunchDescription([
        SetEnvironmentVariable('GZ_SIM_RESOURCE_PATH',
                               os.path.join(pkg_desc, 'meshes')),
        gazebo,
        robot_state_publisher,
        spawn,
    ])
```

#### 4.2 sim.launch.py（仿真 + RViz 一键启动）

```python
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch_ros.actions import Node
import os
from ament_index_python.packages import get_package_share_directory

def generate_launch_description():
    gazebo_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(get_package_share_directory('my_robot_bringup'),
                         'launch', 'gazebo.launch.py')))

    rviz = Node(
        package='rviz2',
        executable='rviz2',
        arguments=['-d', os.path.join(
            get_package_share_directory('my_robot_bringup'),
            'config', 'sim.rviz')],
        output='screen')

    return LaunchDescription([gazebo_launch, rviz])
```

#### 4.3 编译并运行

```bash
cd ~/my_robot_ws
colcon build --symlink-install
source install/setup.bash

# 一键启动仿真 + RViz
ros2 launch my_robot_bringup sim.launch.py
```

### 五、全链路验收清单

#### 5.1 话题检查

```bash
ros2 topic list
# 预期：
# /clock           仿真时钟
# /cmd_vel         速度指令
# /imu/data        IMU 数据
# /joint_states    关节状态
# /odom            里程计
# /robot_description
# /scan            激光
# /tf /tf_static
```

#### 5.2 数据检查

```bash
# 激光有数据（rate ≈ 10Hz）
ros2 topic hz /scan

# IMU 有数据（rate ≈ 100Hz）
ros2 topic hz /imu/data

# TF 树完整：world -> odom -> base_link -> lidar_link/imu_link/wheel_*
ros2 run tf2_ros tf2_echo base_link lidar_link
```

#### 5.3 RViz 可视化检查

RViz 添加：

1.  **RobotModel**：小车模型（蓝底盘、黑轮、红雷达）。
2.  **TF**：坐标系树（确认 odom 在，且随车移动）。
3.  **LaserScan**（topic `/scan`）：看到墙的轮廓。
4.  **PointCloud2 或 Image**（如配置了相机）。

#### 5.4 运动测试

```bash
# 键盘控制小车跑一圈
ros2 run teleop_twist_keyboard teleop_twist_keyboard
# 按 i 前进——RViz 里激光轮廓随车移动，odom 位置变化，TF 树更新
```

### 六、常见问题与排障

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `launch 找不到 urdf/world` | 未安装目录 | CMake `install(DIRECTORY urdf ...)`，重新 colcon build |
| `spawn_entity` 找不到模型 | robot_description 空 | 单独 `ros2 param get /robot_state_publisher robot_description` |
| 激光 /scan 无数据 | 插件没加载或 reference 错 | `gazebo --verbose` 看日志；核对 `reference="lidar_link"` |
| TF 缺 odom | diff_drive 插件没跑 | 检查插件是否在 xacro 里、joint 名是否匹配 |
| RViz 里车在抖动 | 物理步长或 odom 频率不匹配 | `max_step_size=0.001`；diff_drive `update_rate=30` |
| 车被弹飞 | 模型与地面穿插 | spawn `-z` 抬到 0.1 以上 |
| `use_sim_time` 警告 | 部分节点没开仿真时间 | 导航/感知节点统一 `use_sim_time:=true` |
| Gazebo 卡死/黑屏 | GPU 或显示问题 | `gazebo --verbose`；或 headless 模式 |

#### 6.1 常用调试三板斧

```bash
# 1. 看完整日志
ros2 launch my_robot_bringup sim.launch.py --verbose

# 2. 看 TF 树图
ros2 run tf2_tools view_frames  # 生成 frames.pdf

# 3. 单项验证（跳过 RViz）
ros2 launch my_robot_bringup gazebo.launch.py
```

### 七、小结与下一篇预告

**本篇核心**：

1.  **工程规范**：description（模型）+ bringup（系统）双包结构，CMake 安装目录。
2.  **整合 Xacro**：属性+宏+传感器+插件全家桶，一个文件搞定整台仿真车。
3.  **世界构建**：SDF 迷宫（四面墙+障碍物），为 SLAM 建图备好场景。
4.  **一键启动**：`sim.launch.py` = Gazebo + robot_state_publisher + spawn + RViz。
5.  **验收清单**：话题、数据频率、TF 树、RViz 显示、运动测试五步闭环。
6.  从此拥有可复用的仿真小车，后续阶段直接复用。

下一篇开启 **Nav2 导航阶段**（第 21 篇）：SLAM 建图（slam_toolbox）。现在小车有了模型、物理、传感器、里程计——是时候让它"认识"环境了。用 slam_toolbox 控制小车走一圈，激光+里程计融合生成地图，为 AMCL 定位和 Nav2 自主导航铺路。建模仿真阶段收官，自主移动阶段开启。
