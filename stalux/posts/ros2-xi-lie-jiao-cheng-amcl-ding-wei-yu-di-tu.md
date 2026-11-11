---
title: "ROS2系列教程：AMCL定位与地图"
abbrlink: ros2-xi-lie-jiao-cheng-amcl-ding-wei-yu-di-tu
date: "2026-09-08 18:07:51"
categories:
    - "ROS2"
tags: []
desc: "本文是 ROS2 系列教程的第 23 篇：AMCL 定位与地图。前两篇我们学会了建图——slam_toolbox 和 Cartographer 都能产出地图…"
---
## 本文是 ROS2 系列教程的第 23 篇

> 本文是 ROS2 系列教程的第 23 篇：AMCL 定位与地图。前两篇我们学会了建图——slam_toolbox 和 Cartographer 都能产出地图。但建好的地图怎么"用"？机器人每次开机都面临同一个问题：**我在哪？** AMCL（Adaptive Monte Carlo Localization，自适应蒙特卡洛定位）用粒子滤波回答这个问题：在地图里撒几千个"猜测粒子"，用激光匹配不断淘汰错误猜测、收敛到真实位姿。本篇讲透 AMCL 原理、nav2_amcl 参数、地图加载（map_server）与完整定位流程，让你重启机器人后 5 秒内"知道自己在哪"，为下一篇 Nav2 自主导航完成最后一块拼图。

### 一、AMCL 是什么

#### 1.1 定位问题的本质

假设地图已经建好（一张栅格图），机器人重启后拿到激光数据，却不知道自己的位置。定位就是：**给定地图 + 激光 + 里程计，估计机器人的位姿（x, y, θ）**。

难点在于：

-   激光是"一帧一帧"的，单帧无法直接确定位置（环境可能有重复特征）。
-   里程计会漂移，不能只信它。
-   需要持续更新（机器人一直动，位姿一直变）。

#### 1.2 蒙特卡洛方法（粒子滤波）

核心思想：**用一堆"粒子"表示位姿的概率分布**。

1.  **初始化**：在地图上撒 N 个粒子（随机位姿）。
2.  **预测**：根据里程计，让所有粒子跟着移动。
3.  **更新**：每帧激光到达，给每个粒子打分——“如果我真在这里，激光应该长这样”，分数低的粒子淘汰。
4.  **重采样**：按分数重新抽样，粒子向高分区聚拢。

循环 2-4，粒子会从"满地都是"收敛到"一小撮"，收敛中心就是机器人位姿。

**自适应（Adaptive）**：粒子数会根据收敛程度动态调整——不确定时多撒、确定时少算，兼顾精度与速度。

#### 1.3 输入与输出

```
输入：/scan + /tf(odom→base_link) + 静态地图（/map）
输出：/amcl_pose（位姿估计）+ /particlecloud（粒子可视化）+ TF（map→odom）
```

| 话题 | 消息类型 | 作用 |
| --- | --- | --- |
| `/scan` | `LaserScan` | 激光匹配打分 |
| `/map` | `OccupancyGrid` | 已知地图（由 map_server 提供） |
| `/amcl_pose` | `PoseWithCovarianceStamped` | 定位结果 |
| `/particlecloud` | `PoseArray` | 粒子分布（可视化） |

### 二、地图加载：nav2_map_server

AMCL 不自己建图，它需要 map_server 把 `.pgm + .yaml` 地图发布为 `/map`。

#### 2.1 map_server 启动

```bash
# 加载地图并发布 /map
ros2 run nav2_map_server map_server --ros-args \
  -p yaml_filename:=~/maps/my_map.yaml \
  -p use_sim_time:=true
```

启动后还需**单独激活生命周期**（Nav2 节点的标准机制）：

```bash
ros2 lifecycle set /map_server configure
ros2 lifecycle set /map_server activate
```

#### 2.2 生命周期管理

Nav2 节点都遵循 ROS2 生命周期：`unconfigured → inactive → active`。launch 里用 `nav2_lifecycle_manager` 统一管理：

```python
from launch_ros.actions import Node
from launch_ros.actions import LifecycleNode

# 生命周期节点（map_server 必须是 LifecycleNode）
map_server = LifecycleNode(
    package='nav2_map_server',
    executable='map_server',
    name='map_server',
    output='screen',
    parameters=[{'yaml_filename': map_yaml, 'use_sim_time': True}])

# 生命周期管理器（自动 configure + activate）
lifecycle_manager = Node(
    package='nav2_lifecycle_manager',
    executable='lifecycle_manager',
    name='lifecycle_manager_map',
    output='screen',
    parameters=[{'autostart': True,
                 'node_names': ['map_server']}])
```

#### 2.3 验证地图加载

```bash
# 地图话题应持续发布
ros2 topic echo /map --once

# 地图元数据（分辨率、尺寸）
ros2 topic echo /map_metadata --once
```

### 三、nav2_amcl 参数详解

#### 3.1 核心参数（amcl_params.yaml）

```yaml
amcl:
  ros__parameters:
    use_sim_time: True
    alpha1: 0.2        # 旋转噪声
    alpha2: 0.2        # 平移噪声
    alpha3: 0.2        # 平移导致旋转的噪声
    alpha4: 0.2        # 旋转导致平移的噪声
    alpha5: 0.2        # 速度噪声
    base_frame_id: "base_link"
    global_frame_id: "map"
    odom_frame_id: "odom"
    max_particles: 2000      # 最大粒子数
    min_particles: 500       # 最小粒子数
    resample_interval: 1     # 每 N 帧重采样
    save_pose_rate: 0.5      # 保存位姿频率
    sigma_hit: 0.2           # 激光命中噪声
    laser_min_range: 0.1
    laser_max_range: 10.0
    laser_max_beams: 60      # 每帧激光使用的束数
    min_particles_for_kld: 500
    transform_tolerance: 1.0
    update_min_a: 0.2        # 最小旋转角才更新
    update_min_d: 0.25       # 最小平移距离才更新
    z_hit: 0.5               # 命中概率权重
    z_max: 0.05              # 超距概率权重
    z_rand: 0.5              # 随机概率权重
    z_short: 0.05            # 短距离概率权重
```

#### 3.2 参数分组速查

| 分组 | 参数 | 作用 | 调参 |
| --- | --- | --- | --- |
| 坐标系 | `global_frame_id`/`odom_frame_id`/`base_frame_id` | map/odom/base_link | 必须与 TF 一致 |
| 粒子 | `max_particles`/`min_particles` | 粒子上下限 | 精度低调大，性能紧调小 |
| 噪声模型 | `alpha1-5` | 运动模型噪声 | 里程计好就调小（0.05-0.2） |
| 激光模型 | `sigma_hit`/`z_hit`/`z_rand`/`z_max` | 激光打分权重 | 默认即可，传感器好调小 z_rand |
| 性能 | `laser_max_beams`/`update_min_d`/`update_min_a` | 计算量控制 | 卡顿就调小 beams、调大阈值 |

#### 3.3 坐标系三件套

AMCL 输出 `map→odom` TF：激光匹配结果与里程计的偏差，就是 map→odom 的变换。**AMCL 必须运行在 map/odom/base_link 三坐标系齐全的 TF 树上**，缺一不可。

### 四、完整定位流程

#### 4.1 localization.launch.py

```python
from launch import LaunchDescription
from launch_ros.actions import Node, LifecycleNode
from launch_ros.actions import SetParameter
import os
from ament_index_python.packages import get_package_share_directory

def generate_launch_description():
    pkg_bringup = get_package_share_directory('my_robot_bringup')
    map_yaml = os.path.join(pkg_bringup, 'maps', 'my_map.yaml')
    amcl_params = os.path.join(pkg_bringup, 'config', 'amcl_params.yaml')

    map_server = LifecycleNode(
        package='nav2_map_server', executable='map_server',
        name='map_server', output='screen',
        parameters=[{'yaml_filename': map_yaml, 'use_sim_time': True}])

    amcl = LifecycleNode(
        package='nav2_amcl', executable='amcl',
        name='amcl', output='screen',
        parameters=[amcl_params])

    lifecycle_manager = Node(
        package='nav2_lifecycle_manager', executable='lifecycle_manager',
        name='lifecycle_manager_localization', output='screen',
        parameters=[{'autostart': True,
                     'node_names': ['map_server', 'amcl']}])

    rviz = Node(package='rviz2', executable='rviz2',
                arguments=['-d', os.path.join(pkg_bringup, 'config', 'localization.rviz')],
                output='screen')

    return LaunchDescription([
        SetParameter(name='use_sim_time', value=True),
        map_server, amcl, lifecycle_manager, rviz,
    ])
```

#### 4.2 运行

```bash
# 终端 1：仿真小车（不开 SLAM，只开 Gazebo）
ros2 launch my_robot_bringup gazebo.launch.py

# 终端 2：定位（地图 + AMCL + RViz）
ros2 launch my_robot_bringup localization.launch.py
```

#### 4.3 观察定位收敛

RViz 添加：

1.  **Map**（topic `/map`）：加载的地图。
2.  **ParticleCloud**（topic `/particlecloud`）：粒子分布。
3.  **TF**：观察 `map→odom`。

启动瞬间粒子通常**散落一地**（初始化未知位姿），此时机器人不动、粒子不动——因为 AMCL 需要运动 + 激光更新才能收敛。**把机器人原地动一下（teleop 前后左右晃晃），粒子迅速聚拢成一小团**，这就是定位成功。

#### 4.4 初始位姿注入

仿真中机器人 spawn 在已知位置（如 0,0），可以手动告诉 AMCL，收敛更快：

```bash
# 用 RViz 2D Pose Estimate 按钮点击地图上的位置
# 或命令行发布初始位姿（x=0, y=0, θ=0）
ros2 topic pub /initialpose geometry_msgs/msg/PoseWithCovarianceStamped \
  "{header: {frame_id: 'map'}, pose: {pose: {position: {x: 0.0, y: 0.0, z: 0.0}, orientation: {w: 1.0}}}}" \
  --once
```

### 五、定位质量评估

#### 5.1 看粒子集中度

```bash
# 粒子话题
ros2 topic echo /particlecloud --once
# 收敛后粒子应集中在小范围内（几十厘米内）
```

#### 5.2 看 amcl_pose 协方差

```bash
ros2 topic echo /amcl_pose --once
# pose.covariance 对角线越小越确定
# [0]=x方差 [7]=y方差 [35]=θ方差
```

#### 5.3 与真实位置对比

```bash
# 真实位置：gazebo 的 /tf world→base_link
ros2 run tf2_ros tf2_echo world base_link
# AMCL 估计：map→base_link
ros2 run tf2_ros tf2_echo map base_link
# 两者应基本一致（误差 < 10cm）
```

### 六、常见问题与排障

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 粒子不收敛 | 没动起来 / 激光与地图不匹配 | teleop 晃动；检查 use_sim_time |
| 粒子全消失 | 地图与真实环境差异大 | 重新建图；或调大 `max_particles` |
| 定位跳变 | 激光噪声大 / z_rand 太小 | 调大 z_rand、sigma_hit |
| `/map` 空 | map_server 未激活 | `ros2 lifecycle set /map_server activate` |
| AMCL 无输出 | TF 树缺 map→odom | 确认 odom_frame/base_frame 参数 |
| 初始粒子太少 | 初始化区域小 | 多发几次 /initialpose 或在更大范围初始化 |
| 走一段就丢 | 里程计噪声参数太小 | 调大 alpha1-5 |
| 地图与激光错位 | TF 时间戳不同步 | 统一 use_sim_time=true |

#### 6.1 生命周期排查

```bash
# 查看节点生命周期状态
ros2 lifecycle get /amcl
# 应输出 active
ros2 lifecycle get /map_server
```

### 七、小结与下一篇预告

**本篇核心**：

1.  **AMCL 原理**：粒子滤波——撒粒子、预测、打分、重采样，收敛出位姿。
2.  **地图来源**：`nav2_map_server` 加载 pgm+yaml，发布 `/map`。
3.  **生命周期**：Nav2 节点 configure→activate，由 lifecycle_manager 自动管理。
4.  **参数**：坐标系三件套、粒子数、噪声模型、激光模型四大组。
5.  **收敛技巧**：初始位姿注入 + 原地晃动，粒子快速聚拢。
6.  **质量评估**：粒子集中度、amcl_pose 协方差、与真实位置对比。

下一篇开启 **Nav2 导航仿真实战（全局+局部规划）**（第 24 篇）：地图有了、定位有了，就差"自己走路"了。Nav2 会整合这一切：目标点下发 → 全局规划（A* 找路）→ 局部规划（DWA 避障）→ 速度输出（cmd_vel），让机器人真正实现"点到点自主导航"。导航三要素（地图、定位、规划）即将集齐。从"知道自己在哪"到"自己走到哪"，就差这一篇。
