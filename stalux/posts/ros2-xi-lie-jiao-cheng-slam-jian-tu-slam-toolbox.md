---
title: "ROS2系列教程：SLAM建图（slam_toolbox）"
abbrlink: ros2-xi-lie-jiao-cheng-slam-jian-tu-slam-toolbox
date: "2026-09-08 18:07:03"
categories:
    - "ROS2"
tags: []
desc: "本文是 ROS2 系列教程的第 21 篇：SLAM 建图（slam_toolbox）。前 20 篇我们完成了建模仿真阶段——小车有模型、有物理、有传感器，但\"它不知道自己在哪里…"
---
## 本文是 ROS2 系列教程的第 21 篇

> 本文是 ROS2 系列教程的第 21 篇：SLAM 建图（slam_toolbox）。前 20 篇我们完成了建模仿真阶段——小车有模型、有物理、有传感器，但"它不知道自己在哪里，也不知道周围长什么样"。SLAM（Simultaneous Localization and Mapping，同时定位与建图）解决的就是这个问题：机器人一边运动，一边用激光雷达扫描周围，同时估计自身位姿并拼接出地图。本篇以 ROS2 最主流的 **slam_toolbox** 为例：讲透 SLAM 原理、laser_slam 参数、建图流程与地图保存，让你用手上的仿真小车跑出第一张环境地图。地图出炉之日，就是导航（第 23-25 篇）开工之时。

### 一、SLAM 是什么

#### 1.1 名字拆解

SLAM = Simultaneous Localization And Mapping：

-   **Localization（定位）**：机器人在哪？（估计位姿 x, y, θ）
-   **Mapping（建图）**：周围长什么样？（构建占据栅格地图）
-   **Simultaneous（同时）**：两者互相依赖——建图需要知道位姿，定位需要知道地图。经典"鸡生蛋"问题，SLAM 算法通过概率方法（粒子滤波、图优化）同时求解。

#### 1.2 输入与输出

```
输入：/scan（激光）+ /odom（里程计）+ /tf（odom→base_link）
输出：/map（栅格地图）+ /map_metadata + TF（map→odom）
```

| 话题 | 消息类型 | 作用 |
| --- | --- | --- |
| `/scan` | `sensor_msgs/msg/LaserScan` | 环境扫描 |
| `/odom` | `nav_msgs/msg/Odometry` | 里程计预测 |
| `/map` | `nav_msgs/msg/OccupancyGrid` | 输出地图（栅格图） |

#### 1.3 为什么用激光 SLAM

-   **精度高**：激光测距毫米级，室内效果极佳。
-   **成熟稳定**：slam_toolbox、Cartographer、Gmapping 都是久经考验的方案。
-   **计算可控**：单线激光在普通 CPU 上实时运行。

视觉 SLAM（ORB-SLAM 等）是另一条路线，对算力和光照要求高，机器人导航主流仍是激光。

### 二、slam_toolbox 快速上手

#### 2.1 安装

```bash
sudo apt install ros-humble-slam-toolbox
# 验证
ros2 pkg list | grep slam_toolbox
```

#### 2.2 最简启动

```bash
ros2 run slam_toolbox sync_slam_toolbox_node \
  --ros-args \
  -p use_sim_time:=true \
  -p scan_topic:=scan \
  -p odom_frame:=odom \
  -p map_frame:=map \
  -p base_frame:=base_link \
  -p mode:=mapping
```

启动后节点订阅 `/scan`，结合 TF 树开始建图，并发布 `/map`。

#### 2.3 在 RViz 中看地图

```bash
rviz2
```

RViz 添加：

1.  **Map**（topic `/map`）：栅格地图，黑色=占据、白色=空闲、灰色=未知。
2.  **TF**：注意多了 `map` 坐标系。
3.  **LaserScan**：激光数据与地图实时对齐。

**控制小车移动，地图逐渐"画"出来**——这就是 SLAM 建图的直观体验。

### 三、laser_slam 配置详解

工程中用 YAML 配置文件管理参数（`slam_params.yaml`）：

```yaml
slam_toolbox:
  ros__parameters:
    # ---- 坐标系 ----
    map_frame: map
    odom_frame: odom
    base_frame: base_link
    scan_topic: /scan

    # ---- 建图模式 ----
    mode: mapping          # mapping | localization | localization+localization

    # ---- 激光 ----
    max_laser_range: 10.0
    min_laser_range: 0.1
    transform_tolerance: 0.3

    # ---- 图优化（核心） ----
    minimum_travel_distance: 0.5     # 移动 0.5m 才加入新帧
    minimum_travel_heading: 0.5      # 旋转 0.5rad 才加入新帧
    loop_match_minimum_chain_size: 10
    loop_search_maximum_distance: 3.0

    # ---- 性能 ----
    resolution: 0.05                 # 栅格分辨率（米/格）
    throttle_scans: 1                # 每 N 帧处理一帧
    update_min_distance: 0.3
```

#### 3.1 坐标系三件套（必须与你的 TF 树一致）

| 参数 | 含义 | 我们的仿真车 |
| --- | --- | --- |
| `map_frame` | 地图坐标系 | `map` |
| `odom_frame` | 里程计坐标系 | `odom` |
| `base_frame` | 机器人底盘 | `base_link` |

**一致性是 SLAM 能跑通的第一前提**：diff_drive 插件发布 `odom→base_link`，slam_toolbox 需要它。

#### 3.2 mode 的三种模式

| 模式 | 用途 | 说明 |
| --- | --- | --- |
| `mapping` | 建图 | 无初始地图，从零构建 |
| `localization` | 定位 | 加载已有地图，只定位 |
| `localization+localization` | 定位增强 | 边定位边小幅更新地图 |

第 23 篇 AMCL 定位前，可以先试 slam_toolbox 的 localization 模式。

#### 3.3 关键图优化参数

slam_toolbox 基于**图优化**：每个位姿是一个"节点"，帧间约束和回环约束是"边"。

| 参数 | 作用 | 调参建议 |
| --- | --- | --- |
| `minimum_travel_distance` | 移动多远才插入新节点 | 太小帧太多、太大地图稀疏；小车 0.3-0.5 |
| `minimum_travel_heading` | 旋转多少才插入新节点 | 0.3-0.5 |
| `loop_search_maximum_distance` | 回环搜索半径 | 场地大就调大 |
| `loop_match_minimum_chain_size` | 回环最小链长 | 默认即可 |

**回环（loop closure）** 是 SLAM 消除累积误差的关键：走回原点时把首尾接上，误差瞬间清零。

### 四、建图完整流程

#### 4.1 一键启动 launch（recommended）

`mapping.launch.py`：

```python
from launch import LaunchDescription
from launch_ros.actions import Node
from launch.substitutions import Command
import os
from ament_index_python.packages import get_package_share_directory

def generate_launch_description():
    pkg_bringup = get_package_share_directory('my_robot_bringup')

    slam_params = os.path.join(pkg_bringup, 'config', 'slam_params.yaml')

    slam_toolbox = Node(
        parameters=[slam_params],
        package='slam_toolbox',
        executable='sync_slam_toolbox_node',
        name='slam_toolbox',
        output='screen')

    rviz = Node(
        package='rviz2',
        executable='rviz2',
        arguments=['-d', os.path.join(pkg_bringup, 'config', 'slam.rviz')],
        output='screen')

    return LaunchDescription([slam_toolbox, rviz])
```

配合仿真：

```bash
# 终端 1：仿真小车
ros2 launch my_robot_bringup gazebo.launch.py

# 终端 2：SLAM 建图 + RViz
ros2 launch my_robot_bringup mapping.launch.py
```

#### 4.2 遥控小车建图

```bash
ros2 run teleop_twist_keyboard teleop_twist_keyboard
```

**建图口诀：慢速、全覆盖、走回环**。

1.  慢速移动（0.2-0.3 m/s），激光才有足够重叠。
2.  沿墙走，让所有区域被扫到。
3.  每走一段返回起点附近，制造回环，消除漂移。

#### 4.3 边建图边看质量

```bash
# 地图话题频率（应持续更新）
ros2 topic hz /map

# 当前位姿
ros2 topic echo /tf --once
```

RViz 中观察：地图边界是否清晰、墙是否笔直、是否出现重影（回环没闭合的典型症状）。

#### 4.4 保存地图

建图完成后，用 `map_saver_cli` 保存：

```bash
# 保存为 map.pgm（图像）+ map.yaml（元数据）
ros2 run nav2_map_server map_saver_cli -f ~/maps/my_map
```

生成两个文件：

-   `my_map.pgm`：栅格图像（黑白灰）。
-   `my_map.yaml`：元数据（分辨率、原点、占用阈值）。

```yaml
image: my_map.pgm
resolution: 0.050000
origin: [-8.000000, -8.000000, 0.000000]
negate: 0
occupied_thresh: 0.65
free_thresh: 0.196
```

`resolution` 必须与 slam_toolbox 的 `resolution` 一致，否则加载地图会失真。

### 五、地图坐标系与 TF 树

#### 5.1 建图时的 TF 树

```
map → odom → base_link → lidar_link
```

-   `map→odom`：由 **slam_toolbox 维护**（激光匹配修正后的位姿漂移）。
-   `odom→base_link`：由 diff_drive 插件发布（里程计）。
-   其他：robot_state_publisher 发布。

#### 5.2 map 与 odom 的区别

| 坐标系 | 由谁发布 | 特性 |
| --- | --- | --- |
| `odom` | 里程计（diff_drive） | 短期准、长期漂移 |
| `map` | SLAM/定位 | 全局一致、修正漂移 |

理解：**odom 是"猜测我走了多远"，map 是"我在世界哪里"**。SLAM 用激光匹配不断修正 map→odom 的偏差。

#### 5.3 常见 TF 错误

```bash
ros2 run tf2_ros tf2_echo map base_link
# 若报 extrapolation，多半是 use_sim_time 没开或 transform_tolerance 太小
```

### 六、常见问题与排障

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 地图空白 | 激光没数据或 TF 缺 | `ros2 topic hz /scan`；`tf2_echo map base_link` |
| 地图歪斜/重影 | 回环没闭合 | 控制小车回原点走一圈 |
| 地图漂移严重 | 里程计不准 | 检查轮距/轮径参数与 URDF 是否一致 |
| `slam_toolbox` 启动即崩 | 参数错误或依赖缺失 | `--verbose` 看日志；检查 YAML 格式 |
| 地图只有一条线 | 车没动或激光角度覆盖不足 | 移动小车；检查 `min_angle/max_angle` |
| `/map` 不发布 | 无 scan 输入 | 确认 scan_topic 名字 |
| TF 报 extrapolation | 时间戳不一致 | 所有节点 `use_sim_time:=true` |
| 地图模糊 | 移动太快 | 降速到 0.2-0.3 m/s 重新建图 |
| 保存的 pgm 打开是黑图 | 没有足够空闲区域被扫描 | 多扫几圈再保存 |

#### 6.1 排查命令三板斧

```bash
# 1. 激光有没有
ros2 topic hz /scan

# 2. TF 树通不通
ros2 run tf2_ros tf2_echo map base_link

# 3. 地图在不在变
ros2 topic hz /map
```

### 七、slam_toolbox 与其他 SLAM 对比

| 方案 | 类型 | 特点 | 适用 |
| --- | --- | --- | --- |
| slam_toolbox | 图优化 2D | 轻量、可回环、可重定位 | 室内小车（推荐入门） |
| Cartographer | 图优化 2D/3D | 精度高、回环强、资源消耗大 | 复杂场景、仓库（下一篇） |
| Gmapping | 粒子滤波 | 经典、直观、无回环 | 教学演示 |

入门选 slam_toolbox：参数少、效果好、资料多。进阶需要更高精度或 3D 时再上 Cartographer。

### 八、小结与下一篇预告

**本篇核心**：

1.  **SLAM 本质**：同时定位 + 建图，激光 + 里程计 + TF 三输入，地图一输出。
2.  **slam_toolbox**：`sync_slam_toolbox_node`，YAML 参数，mapping/localization 双模式。
3.  **坐标系**：map→odom→base_link→lidar_link，一致性是前提。
4.  **建图流程**：启动仿真 → 启动 SLAM → 慢速全覆盖移动 → 走回环 → 保存地图。
5.  **地图产物**：`map.pgm + map.yaml`，resolution 必须一致。
6.  回环闭合是消除累积误差的核心操作。

下一篇进入 **Cartographer 建图进阶**（第 22 篇）：Google 开源的 Cartographer 精度更高、回环更强，适合大场景和复杂环境。我们会对比它与 slam_toolbox 的差异、配置 2D 建图参数、处理子图（submap）概念。地图越建越好，定位与导航才有好底子。第一张地图已经出炉，接下来就是让精度"更上一层楼"。
