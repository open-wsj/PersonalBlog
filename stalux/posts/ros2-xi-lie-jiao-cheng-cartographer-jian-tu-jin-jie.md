---
title: "ROS2系列教程：Cartographer建图进阶"
abbrlink: ros2-xi-lie-jiao-cheng-cartographer-jian-tu-jin-jie
date: "2026-09-08 18:07:27"
categories:
    - "ROS2"
tags: []
desc: "本文是 ROS2 系列教程的第 22 篇：Cartographer 建图进阶。上一篇用 slam_toolbox 建出了第一张地图，但它的回环能力在长廊、大场地、复杂环境里会吃力——累积误差难以消除…"
---
## 本文是 ROS2 系列教程的第 22 篇

> 本文是 ROS2 系列教程的第 22 篇：Cartographer 建图进阶。上一篇用 slam_toolbox 建出了第一张地图，但它的回环能力在长廊、大场地、复杂环境里会吃力——累积误差难以消除，地图容易"飘"。Cartographer 是 Google 开源的 SLAM 库，以**子图（submap）+ 回环闭环**闻名：先把局部帧拼成子图，再全局优化消除漂移，2D/3D 通吃。本篇讲透 Cartographer 的核心概念、ROS2 接口、2D 建图配置与调试，并给你一套能直接跑的建图 launch。想让你导航小车在大场景里"不迷路"，Cartographer 是关键一环。

### 一、Cartographer 是什么

#### 1.1 出身与定位

Cartographer 由 Google 在 2016 年开源，最初用于自家仓库机器人和室内地图测绘。它支持：

-   **2D 激光 SLAM**（最常用）。
-   **3D SLAM**（多线雷达，支持 `cartographer_ros` 的 3D 模式）。
-   **子图回环**：局部建图快、全局一致性高。

在 ROS2 Humble 中安装：

```bash
sudo apt install ros-humble-cartographer ros-humble-cartographer-ros
# 验证
ros2 pkg list | grep cartographer
```

#### 1.2 与 slam_toolbox 的核心差异

| 维度 | slam_toolbox | Cartographer |
| --- | --- | --- |
| 数学方法 | 图优化（位姿图） | 子图 + 全局优化 |
| 回环能力 | 中（依赖配置） | 强（主动闭环检测） |
| 计算开销 | 低 | 中高（多线程） |
| 大场景 | 一般 | 好 |
| 配置复杂度 | 低 | 高（参数多） |
| 3D 支持 | 无 | 有 |

一句话：**入门用 slam_toolbox，上强度用 Cartographer**。本篇把 Cartographer 调通，你的建图工具箱就齐了。

### 二、核心概念：子图与回环

#### 2.1 子图（Submap）

Cartographer 建图不是一帧一帧拼整个地图，而是：

1.  每收到一帧激光，先跟**当前子图**匹配，确定位姿。
2.  累积到一定长度（`num_range_data` 参数控制），把这段局部地图"定稿"成一个子图。
3.  继续开新子图。

**子图是 Cartographer 高效的关键**：局部匹配快，且定稿的子图成为后续回环的锚点。

#### 2.2 回环闭环（Loop Closure）

-   **局部优化**：每帧激光与当前子图匹配（快，但会累积漂移）。
-   **全局优化**：当新子图与**老子图**有重叠时，检测到回环，把整条轨迹的位姿重优化，漂移被"拉回来"。

这就是 Cartographer 在长廊、绕圈场景里依然精准的原因：**它会主动寻找"我去过这里"的证据**。

#### 2.3 数据流

```
/scan + /tf(odom→base_link) + /odom(可选)
   → 前端（帧→子图匹配，local SLAM）
   → 后端（回环检测 + 全局优化，global SLAM）
   → /map + map→odom TF
```

Cartographer 内部分前端（实时建图）与后端（全局优化）两个线程，这就是它配置参数多的原因。

### 三、ROS2 接口与配置

#### 3.1 启动命令

```bash
ros2 run cartographer_ros cartographer_node \
  --ros-args \
  -p use_sim_time:=true \
  -p configuration_directory:=$(pwd) \
  -p configuration_basename:=cartographer.lua
```

`configuration_directory` 与 `configuration_basename` 指向 Lua 配置文件（Cartographer 用 Lua 而非 YAML 写参数）。

#### 3.2 cartographer.lua 核心配置（2D 激光）

```lua
-- cartographer.lua
include "map_builder.lua"
include "trajectory_builder.lua"

options = {
  map_builder = MAP_BUILDER,
  trajectory_builder = TRAJECTORY_BUILDER,
  map_frame = "map",
  tracking_frame = "base_link",        -- 机器人本体坐标系
  published_frame = "odom",            -- 里程计坐标系
  odom_frame = "odom",
  provide_odom_frame = true,
  publish_frame_projected_to_2d = false,
  use_odometry = true,                 -- 使用 /odom
  use_nav_sat = false,
  use_landmarks = false,
  num_laser_scans = 1,                 -- 1 个 2D 激光
  num_multi_echo_laser_scans = 0,
  num_subdivisions_per_laser_scan = 1,
  num_point_clouds = 0,
  lookup_transform_timeout_sec = 0.2,
  submap_publish_period_sec = 0.3,
  pose_publish_period_sec = 5e-3,
  trajectory_builder_2d = TRAJECTORY_BUILDER_2D,
}

MAP_BUILDER.use_trajectory_builder_2d = true

-- 2D 轨迹构建器参数
TRAJECTORY_BUILDER_2D.min_range = 0.1
TRAJECTORY_BUILDER_2D.max_range = 10.0
TRAJECTORY_BUILDER_2D.missing_data_ray_length = 5.0
TRAJECTORY_BUILDER_2D.use_imu_data = false      -- 纯 2D 激光可不依赖 IMU
TRAJECTORY_BUILDER_2D.use_online_correlative_scan_matching = true
TRAJECTORY_BUILDER_2D.motion_filter.max_distance_meters = 0.2
TRAJECTORY_BUILDER_2D.motion_filter.max_angle_radians = 0.1

-- 子图参数
TRAJECTORY_BUILDER_2D.submaps.num_range_data = 90
TRAJECTORY_BUILDER_2D.submaps.grid_options_2d.resolution = 0.05
TRAJECTORY_BUILDER_2D.submaps.range_data_inserter.probability_grid_range_data_inserter.hit_probability = 0.55
TRAJECTORY_BUILDER_2D.submaps.range_data_inserter.probability_grid_range_data_inserter.miss_probability = 0.49

-- 前端扫描匹配
TRAJECTORY_BUILDER_2D.ceres_scan_matcher.translation_weight = 1.0
TRAJECTORY_BUILDER_2D.ceres_scan_matcher.rotation_weight = 1.0

-- 回环参数
POSE_GRAPH.optimize_every_n_nodes = 90
POSE_GRAPH.constraint_builder.min_score = 0.55
POSE_GRAPH.constraint_builder.global_localization_min_score = 0.6
POSE_GRAPH.global_constraint_search_after_n_seconds = 30.0
```

#### 3.3 关键参数速查

| 参数 | 作用 | 建议 |
| --- | --- | --- |
| `num_range_data` | 多少帧激光构成一个子图 | 90（约 9 秒@10Hz） |
| `optimize_every_n_nodes` | 每 N 个节点做一次全局优化 | 90 |
| `min_score` | 回环匹配最低分（低于则拒绝） | 0.55-0.6 |
| `motion_filter.max_distance_meters` | 移动多少米才处理新帧 | 0.2 |
| `hit_probability`/`miss_probability` | 栅格更新概率 | 0.55/0.49（默认即可） |
| `resolution` | 栅格分辨率 | 0.05（米/格） |

**调参口诀**：地图模糊 → 调大 `max_range` 或降速；回环不闭合 → 调低 `min_score` 或调大 `global_constraint_search_after_n_seconds`；卡顿 → 调大 `motion_filter` 阈值减少处理帧数。

### 四、建图 launch（可直接复用）

#### 4.1 cartographer.lua + launch

把上面的 lua 保存到 `config/cartographer.lua`，配套 launch：

```python
# cartographer_mapping.launch.py
from launch import LaunchDescription
from launch_ros.actions import Node
import os
from ament_index_python.packages import get_package_share_directory

def generate_launch_description():
    pkg_bringup = get_package_share_directory('my_robot_bringup')
    config_dir = os.path.join(pkg_bringup, 'config')

    cartographer_node = Node(
        package='cartographer_ros',
        executable='cartographer_node',
        name='cartographer_node',
        output='screen',
        parameters=[{'use_sim_time': True}],
        arguments=[
            '-configuration_directory', config_dir,
            '-configuration_basename', 'cartographer.lua'])

    occupancy_grid = Node(
        package='cartographer_ros',
        executable='cartographer_occupancy_grid_node',
        name='cartographer_occupancy_grid_node',
        output='screen',
        parameters=[{'use_sim_time': True, 'resolution': 0.05}])

    rviz = Node(
        package='rviz2',
        executable='rviz2',
        arguments=['-d', os.path.join(pkg_bringup, 'config', 'slam.rviz')],
        output='screen')

    return LaunchDescription([cartographer_node, occupancy_grid, rviz])
```

注意：Cartographer 不像 slam_toolbox 那样直接发布 `/map`，而是由独立的 **cartographer_occupancy_grid_node** 把内部子图转成 `/map` 话题。

#### 4.2 完整运行流程

```bash
# 终端 1：仿真小车（复用第 20 篇）
ros2 launch my_robot_bringup gazebo.launch.py

# 终端 2：Cartographer 建图
ros2 launch my_robot_bringup cartographer_mapping.launch.py

# 终端 3：遥控
ros2 run teleop_twist_keyboard teleop_twist_keyboard
```

#### 4.3 建图技巧（针对 Cartographer）

1.  **起步原地转一圈**：让前端建立初始子图，之后匹配更稳。
2.  **匀速慢行**（0.2-0.3 m/s）：激光帧重叠充分。
3.  **主动回环**：地图走到一半，原路返回起点区域——Cartographer 检测到回环后全局优化，地图会"啪"地收紧。
4.  **观察子图边界**：RViz 里 `Submaps` 显示每个子图，定稿的子图不再变化。

### 五、保存与加载地图

#### 5.1 保存（与 slam_toolbox 相同）

```bash
ros2 run nav2_map_server map_saver_cli -f ~/maps/carto_map
```

#### 5.2 质量对比观察

把 slam_toolbox 与 Cartographer 各建一张同样场地的地图：

-   绕两圈后：slam_toolbox 地图墙角可能有轻微重影；Cartographer 通常更"干净"。
-   长廊场景差异最明显：Cartographer 全局优化会把长走廊拉直。

**不必神化 Cartographer**：小车室内小场景两者差距不大；选型看场地大小和精度需求。

### 六、常见问题与排障

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 启动报 `Failed to parse config` | lua 语法或路径错误 | 检查 `configuration_directory`；lua 用 `include` 的文件要存在 |
| 地图空白 | `/scan` 没输入 | `ros2 topic hz /scan`；`num_laser_scans=1` 与话题数匹配 |
| 地图旋转/镜像 | TF 方向错 | 核对 `tracking_frame`/`published_frame`/`odom_frame` |
| 回环不闭合 | `min_score` 太高或场地对称 | 降到 0.5；制造非对称特征 |
| 后端优化卡顿 | 节点太多 | 调大 `optimize_every_n_nodes`（如 180） |
| 内存暴涨 | 地图太大太久没回环 | 控制建图时长，及时保存地图 |
| `/map` 不发布 | 缺 occupancy_grid 节点 | 单独启动 `cartographer_occupancy_grid_node` |
| 与 slam_toolbox 同时跑冲突 | 两个 SLAM 抢 /map 和 TF | 一次只跑一个 SLAM |

#### 6.1 调试命令

```bash
# 看 Cartographer 是否在发布 TF
ros2 run tf2_ros tf2_echo map base_link

# 看子图话题（RViz Submaps 需要）
ros2 topic list | grep submap
# /submap_list、/tracked_pose、/scan_matched_points2 等
```

### 七、小结与下一篇预告

**本篇核心**：

1.  **Cartographer 定位**：Google 开源，子图+回环全局优化，2D/3D 通吃，大场景首选。
2.  **子图机制**：局部帧→子图→定稿，`num_range_data=90` 控制子图大小。
3.  **前后端分离**：前端实时建图、后端回环优化，`optimize_every_n_nodes=90` 控制优化频率。
4.  **Lua 配置**：参数用 lua 写，`map_frame`/`tracking_frame`/`published_frame` 三坐标系要对齐。
5.  **建图流程**：原地转圈初始化→慢速移动→主动回环→occupancy_grid 转 /map→保存。
6.  **选型**：小场景 slam_toolbox 够用，大/复杂场景上 Cartographer。

下一篇进入 **AMCL 定位与地图**（第 23 篇）：地图建好了，机器人重启后怎么"知道自己在哪"？AMCL（自适应蒙特卡洛定位）用粒子滤波在地图里估计位姿，把 SLAM 建好的地图变成可复用的"定位导航底图"。从此机器人拿到地图就能自我定位，Nav2 导航正式进入倒计时。地图在手，定位无忧。
