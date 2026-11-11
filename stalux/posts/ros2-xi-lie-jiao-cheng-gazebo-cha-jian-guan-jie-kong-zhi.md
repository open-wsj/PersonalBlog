---
title: "ROS2系列教程：Gazebo插件（关节控制/IMU/激光雷达）"
abbrlink: ros2-xi-lie-jiao-cheng-gazebo-cha-jian-guan-jie-kong-zhi
date: "2026-09-06 10:19:29"
categories:
    - "ROS2"
tags: []
desc: "本文是 ROS2 系列教程的第 19 篇：Gazebo 插件（关节控制/IMU/激光雷达）。上一篇小车能在 Gazebo 里跑动了，但它还是个\"瞎子\"——没有传感器，不知道周围有什么…"
---
## 本文是 ROS2 系列教程的第 19 篇

> 本文是 ROS2 系列教程的第 19 篇：Gazebo 插件（关节控制/IMU/激光雷达）。上一篇小车能在 Gazebo 里跑动了，但它还是个"瞎子"——没有传感器，不知道周围有什么，也感受不到自身姿态。Gazebo 插件（plugin）就是给仿真模型装上"器官"：关节驱动插件让轮子转、IMU 插件报告姿态与角速度、激光雷达插件发出点云、相机插件输出图像。本篇逐个拆解 gazebo_ros 最常用的四类插件，教你正确配置参数、把传感器数据接入 ROS2 话题并在 RViz 中可视化。学完你的仿真小车就"眼明身正"，具备了进入 SLAM 建图（第 21 篇）的全部条件。

### 一、Gazebo 插件机制

#### 1.1 插件是什么

Gazebo 插件是**动态库**（.so），在仿真中被加载进指定实体（世界/模型/传感器），把 Gazebo 内部事件与 ROS2 话题/服务对接。`gazebo_ros` 包预编译了一批官方插件，都在 `libgazebo_ros_*.so`。

插件写在 URDF 的 `<gazebo>` 标签里（放在 `<robot>` 内、link/joint 之外）：

```xml
<gazebo>
  <plugin name="..." filename="libgazebo_ros_xxx.so">
    ...
  </plugin>
</gazebo>
```

也可以挂在**指定 link 的传感器**上：

```xml
<gazebo reference="laser_link">
  <sensor type="gpu_ray" name="laser_sensor">
    ...
  </sensor>
</gazebo>
```

**重要**：`<gazebo>` 标签只在 Gazebo 加载时解析，`check_urdf`、RViz、MoveIt2 都会忽略它——所以往 URDF 里加仿真配置不影响其他工具。

#### 1.2 插件分类总览

| 类别 | 插件 | 功能 | 输出话题 |
| --- | --- | --- | --- |
| 关节控制 | `libgazebo_ros_diff_drive.so` | 差速驱动 | `/odom`、`/tf` |
| 关节控制 | `libgazebo_ros_joint_state_publisher.so` | 发布关节状态 | `/joint_states` |
| 关节控制 | `libgazebo_ros_joint_pose_trajectory.so` | 关节轨迹控制 | 服务 |
| 传感器 | `libgazebo_ros_gpu_laser.so` | 激光雷达（GPU 加速） | `/scan` |
| 传感器 | `libgazebo_ros_camera.so` | 相机 | `/image_raw`、`/camera_info` |
| 传感器 | `libgazebo_ros_imu.so` | IMU | `/imu/data` |
| 传感器 | `libgazebo_ros_ray_sensor.so` | 非 GPU 激光/声纳 | `/scan` |
| 传感器 | `libgazebo_ros_depth_camera.so` | 深度相机 | `/depth`、`/points` |

#### 1.3 通用 `<ros>` 配置块

每个插件都支持 `<ros>` 块统一定义命名空间、重映射与参数：

```xml
<ros>
  <namespace>/robot</namespace>
  <remapping>scan:=/robot/scan</remapping>
  <argument name="frame_name">laser_link</argument>
</ros>
```

| 元素 | 作用 |
| --- | --- |
| `<namespace>` | 话题/服务前缀（多机器人隔离用） |
| `<remapping>` | 话题重映射（`旧:=新`） |
| `<argument>` | 传给插件的参数（如 frame_name） |
| `<param name="...">` | 数值参数 |

### 二、关节控制插件：让机器人动起来

#### 2.1 joint_state_publisher：关节状态上报

差速插件自己会驱动轮子，但**关节角度信息**需要单独上报给 `robot_state_publisher` 播 TF：

```xml
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
```

验证：

```bash
ros2 topic echo /joint_states --once
# 输出两个轮子的 position（弧度），会随运动变化
```

#### 2.2 差速驱动插件的完整回顾

上篇的 diff_drive 插件已经覆盖：订阅 `cmd_vel`、驱动左右轮、发布 odom 和 odom→base_link TF。本篇补充三点进阶：

```xml
<plugin name="diff_drive" filename="libgazebo_ros_diff_drive.so">
  <ros>
    <namespace>/</namespace>
    <remapping>cmd_vel:=cmd_vel</remapping>
    <remapping>odom:=odom</remapping>
  </ros>
  <update_rate>30</update_rate>
  <left_joint>base_to_wheel_1</left_joint>
  <right_joint>base_to_wheel_-1</right_joint>
  <wheel_separation>0.38</wheel_separation>
  <wheel_diameter>0.16</wheel_diameter>
  <max_wheel_torque>20</max_wheel_torque>
  <max_wheel_acceleration>1.0</max_wheel_acceleration>
  <publish_odom>true</publish_odom>
  <publish_odom_tf>true</publish_odom_tf>
  <odometry_frame>odom</odometry_frame>
  <robot_base_frame>base_link</robot_base_frame>
</plugin>
```

**轮距与轮径必须与 URDF 一致**（`wheel_separation = 2 × wheel_base`，`wheel_diameter = 2 × wheel_radius`），否则里程计算错、导航走偏。

#### 2.3 关节轨迹插件（机械臂场景）

机械臂用轨迹控制而不是速度控制：

```xml
<gazebo>
  <plugin name="arm_controller" filename="libgazebo_ros_joint_pose_trajectory.so">
    <ros>
      <namespace>/arm</namespace>
      <remapping>joint_trajectory:=joint_trajectory</remapping>
    </ros>
    <update_rate>30</update_rate>
    <joint_name>joint1</joint_name>
    <joint_name>joint2</joint_name>
    <joint_name>joint3</joint_name>
    <init_pose>0 0 0</init_pose>
  </plugin>
</gazebo>
```

它提供 `follow_joint_trajectory` 动作服务，MoveIt2 直接调用（第 36 篇详解）。

### 三、IMU 插件：给机器人"内耳"

#### 3.1 配置

```xml
<gazebo reference="base_link">
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
```

注意 `reference="base_link"`：传感器挂在 base_link 坐标系上。

#### 3.2 IMU 输出什么

```bash
ros2 topic echo /imu/data --once
```

`sensor_msgs/msg/Imu` 消息包含：

| 字段 | 含义 | 单位 |
| --- | --- | --- |
| `orientation` | 姿态四元数 | 无单位（归一化） |
| `angular_velocity` | 角速度 | rad/s |
| `linear_acceleration` | 线性加速度（含重力） | m/s² |
| `orientation_covariance` | 姿态协方差 | - |

**关键认知**：仿真 IMU 默认是"完美"的。想模拟真实噪声，需在 `<sensor>` 里加噪声模型：

```xml
<imu>
  <noise type="gaussian">
    <mean>0 0 0</mean>
    <stddev>0.001 0.001 0.001</stddev>
  </noise>
</imu>
```

### 四、激光雷达插件：机器人的"眼睛"

#### 4.1 GPU 激光配置（推荐）

```xml
<gazebo reference="lidar_link">
  <sensor type="gpu_ray" name="lidar_sensor">
    <always_on>true</always_on>
    <update_rate>10</update_rate>
    <visualize>true</visualize>
    <pose>0 0 0 0 0 0</pose>
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
      <noise>
        <type>gaussian</type>
        <mean>0.0</mean>
        <stddev>0.01</stddev>
      </noise>
    </ray>
  </sensor>
</gazebo>
```

关键参数：

| 参数 | 含义 | 常用值 |
| --- | --- | --- |
| `samples` | 扫描点数（分辨率） | 360/720 |
| `min_angle`/`max_angle` | 扫描范围 | ±π（360°）或 ±1.57（180°） |
| `min`/`max`（range） | 测距范围 | 0.12~10 米 |
| `stddev`（noise） | 测距高斯噪声 | 0.01（厘米级） |
| `frame_name` | 输出帧名 | 必须与 URDF 的 lidar link 一致 |

`gpu_ray` 用 GPU 加速，10Hz/360 点无压力；老式 `ray`（非 GPU）CPU 密集，场景简单时才用。

#### 4.2 数据验证

```bash
ros2 topic hz /scan
# average rate: 10.0

ros2 topic echo /scan --once
# ranges: [3.12, 3.11, ...]  (单位米)

# RViz 中可视化
rviz2  # 添加 LaserScan，Fixed Frame 设为 lidar_link
```

**在 RViz 里看激光**：Add → By topic → /scan → LaserScan。周围有墙时能看到一圈点云轮廓；空地则是"外圈大圆"。

#### 4.3 激光数据与 TF 的关系

`/scan` 消息的 `header.frame_id` 是 `lidar_link`，表示"数据是在雷达坐标系测的"。SLAM 建图时，算法通过 TF 树（`odom→base_link→lidar_link`）把激光点变换到全局坐标系，所以 **TF 树不完整 → 激光数据无法使用**，这是建图最常见的报错（`Lookup would require extrapolation`）。

### 五、相机插件：让机器人"看见"

#### 5.1 普通相机

```xml
<gazebo reference="camera_link">
  <sensor type="camera" name="camera_sensor">
    <always_on>true</always_on>
    <update_rate>30</update_rate>
    <visualize>true</visualize>
    <plugin filename="libgazebo_ros_camera.so" name="camera_plugin">
      <ros>
        <remapping>image_raw:=image_raw</remapping>
        <remapping>camera_info:=camera_info</remapping>
      </ros>
      <frame_name>camera_link</frame_name>
      <image_size>640 480</image_size>
      <image_format>RGB8</image_format>
      <focal_length>320 320</focal_length>
      <horizontal_fov>1.396</horizontal_fov>
    </plugin>
    <camera>
      <horizontal_fov>1.396</horizontal_fov>
      <image>
        <width>640</width>
        <height>480</height>
        <format>R8G8B8</format>
      </image>
    </camera>
  </sensor>
</gazebo>
```

输出话题：

-   `/image_raw`（`sensor_msgs/msg/Image`）：原始图像。
-   `/camera_info`（`sensor_msgs/msg/CameraInfo`）：内参矩阵，视觉处理必需。

#### 5.2 查看相机图像

```bash
# 命令行查看（需要 rqt）
rqt_image_view /image_raw

# 或 RViz 添加 Image
rviz2  # Add → By topic → /image_raw → Image
```

#### 5.3 深度相机（RGB-D）

```xml
<gazebo reference="depth_camera_link">
  <sensor type="depth" name="depth_sensor">
    <always_on>true</always_on>
    <update_rate>30</update_rate>
    <plugin filename="libgazebo_ros_depth_camera.so" name="depth_plugin">
      <ros>
        <remapping>image_raw:=depth/image_raw</remapping>
        <remapping>camera_info:=depth/camera_info</remapping>
        <remapping>points:=depth/points</remapping>
      </ros>
      <frame_name>depth_camera_link</frame_name>
    </plugin>
  </sensor>
</gazebo>
```

输出：

-   `/depth/image_raw`：深度图（16 位，毫米）。
-   `/depth/points`：点云（`sensor_msgs/msg/PointCloud2`），RViz 中 PointCloud2 可直接显示。

### 六、传感器参数对照速查表

| 传感器 | 插件 .so | 主要输出 | 关键配置 |
| --- | --- | --- | --- |
| 差速轮 | diff_drive | `/odom`、`/tf` | 左右关节名、轮距轮径 |
| 关节状态 | joint_state_publisher | `/joint_states` | 关节名列表 |
| 激光 | gpu_laser | `/scan` | samples、角度范围、max_range |
| IMU | imu | `/imu/data` | 挂载 link、噪声 |
| 相机 | camera | `/image_raw`、`/camera_info` | 分辨率、焦距、FOV |
| 深度相机 | depth_camera | `/depth/points` | frame_name |

### 七、常见问题与排障

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 插件话题不存在 | 插件未加载 | `gazebo --verbose` 看加载日志；确认 filename 拼写 |
| `/scan` 没数据但话题在 | 传感器没挂对 link 或 TF 缺 | 检查 `reference` 与 `frame_name`；TF 树是否含该 link |
| 激光全是一个大值 | 没障碍物或范围超限 | 检查 `max_range` 与世界中是否有墙 |
| `/imu/data` 全是 0 | 模型静止且无重力变化 | 属正常；运动后再看 |
| 相机黑屏 | 相机朝向地面/墙 | 检查 `pose` 朝向（rpy 通常 0 -1.57 0 朝前） |
| 轮子乱转不前进 | 左右轮 joint 配反 | diff_drive 的 left/right 与 URDF 一致 |
| RViz 显示 TF 报 extrapolation | use_sim_time 未开 | 所有节点 `use_sim_time:=true` |
| Gazebo 卡顿 | 激光 samples 太大或 GUI 重 | 降 samples（如 720→360）、关 visualize |
| 传感器延迟大 | update_rate 太低 | 激光 10Hz、IMU 100Hz、相机 30Hz 是常见基线 |

#### 7.1 插件加载失败的通用排查

```bash
# 启动时加 --verbose 看完整日志
ros2 launch my_robot_bringup gazebo.launch.py --verbose

# 关键日志特征
# [Msg] Loading plugin [libgazebo_ros_gpu_laser.so]  → 加载成功
# [Err] ... failed to load plugin ...                → 找文件名/路径问题
```

### 八、小结与下一篇预告

**本篇核心**：

1.  **插件机制**：`<gazebo>` 标签 + `libgazebo_ros_*.so` 动态库，只影响仿真不影响 URDF 解析。
2.  **关节控制三件套**：diff_drive（速度控制+odom）、joint_state_publisher（关节状态）、joint_pose_trajectory（机械臂轨迹）。
3.  **IMU**：挂 base_link，输出四元数/角速度/加速度，可加高斯噪声模拟真实传感器。
4.  **激光雷达**：`gpu_ray` 高效，配置 samples/范围/噪声，输出 `/scan`，SLAM 建图的直接输入。
5.  **相机**：RGB 图像 + CameraInfo 内参；深度相机额外输出点云。
6.  **TF 是传感器数据的命脉**：所有传感器数据都依赖 TF 树完整才能被下游使用。

下一篇进入 **机器人模型导入仿真实战**：把前几篇的 Xacro 小车、传感器、差速插件整合成完整工程，一键 launch 起仿真实战，并用 RViz 完整验证。这是建模仿真阶段的"大考"：从 URDF 建模到传感器数据全链路打通，为 Nav2 导航阶段（第 21-25 篇）铺路。模型、物理、感知三者齐备，机器人准备"出发"。
