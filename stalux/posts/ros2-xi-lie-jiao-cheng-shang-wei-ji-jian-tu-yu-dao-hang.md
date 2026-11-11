---
title: "ROS2系列教程：上位机建图与导航（原理综合）"
abbrlink: ros2-xi-lie-jiao-cheng-shang-wei-ji-jian-tu-yu-dao-hang
date: "2026-10-18 22:54:11"
categories:
    - "ROS2"
tags: []
desc: "本文是 ROS2 系列教程的第 33 篇：上位机建图与导航（原理综合）。第 32 篇我们把下位机的数据（里程计、IMU、传感器）接进了 ROS2，实现了\"软硬结合\"。但机器人拿到数据之后要干什么？…"
---
## 本文是 ROS2 系列教程的第 33 篇

> 本文是 ROS2 系列教程的第 33 篇：上位机建图与导航（原理综合）。第 32 篇我们把下位机的数据（里程计、IMU、传感器）接进了 ROS2，实现了"软硬结合"。但机器人拿到数据之后要干什么？答案就是本篇的主题：**建图与导航**。本篇把第 21~25 篇的仿真知识搬到真机场景，讲解仿真到实物的差异、激光雷达接入、slam_toolbox/Cartographer 建图、地图后处理、AMCL 定位、Nav2 导航栈的参数调优，以及用 Python 写任务级导航程序。学完本篇，你的实体机器人就真正"认得路、走得动"了。

### 一、从仿真到实物的关键差异

很多同学在 Gazebo 里跑建图导航一切正常，一上真机就各种翻车。先讲清楚差异，后面调试才有方向。

#### 1.1 传感器噪声不同

仿真里激光雷达的数据是"理想"的：测距准、无混叠、无跳变。真机激光雷达（如 RPLIDAR A1/A2）会有：

-   **测量噪声**：同一角度连续几帧距离有小幅抖动，约 ±1~2cm。
-   **混叠（aliasing）**：近距离物体被漏掉或测出"伪距离"。
-   **黑洞/鬼点**：阳光直射、玻璃、黑色哑光物体上偶尔丢点。

应对办法：建图前先看原始 scan 话题，确认点云干净；地图分辨率设 0.05m 而不是 0.025m，容忍小噪声。

#### 1.2 里程计误差放大

仿真的 /odom 精确到毫米级，真机轮式里程计受打滑、胎压、地面摩擦影响，误差会累积。第 32 篇讲过，**里程计误差直接决定建图质量**。真机建图前先做"直线校准"：

```bash
# 让车以 0.2m/s 直行 2 米，看 odom 的 x 是否等于 2.0
ros2 topic echo /odom --field pose.pose.position.x
```

若偏差大于 5%，优先检查：轮半径是否按实测值填、编码器 PPR 是否写对、轮距是否与 URDF 一致（三个参数，第 28 篇的 diff_drive_controller 配置里都有）。

#### 1.3 时间同步

仿真的 TF 时间戳永远正确，真机却有：传感器驱动时间戳、主控时钟漂移、USB 延迟。后果就是 TF 报错（`lookup would require extrapolation`），cartographer 直接罢工。

**统一时间源**是第一步：用一台主机同时跑激光雷达驱动和 Nav2，主机开 NTP 或 chrony 校时；串口桥发布 odom 时用 `self.get_clock().now().to_msg()` 而不是 `time.time()`（两者差一个 epoch，会导致 TF 时间错乱）。

### 二、建图前准备：激光雷达驱动与 TF 检查

#### 2.1 安装激光雷达驱动

以 RPLIDAR 为例（其他品牌同理，驱动包名不同）：

```bash
sudo apt install ros-humble-rplidar-ros
ros2 run rplidar_ros rplidar_composition --ros-args \
  -p serial_port:=/dev/ttyUSB0 -p serial_baudrate:=115200 \
  -p frame_id:=laser_link -p angle_compensate:=true
```

要点：`frame_id` 必须与 URDF 里的激光雷达坐标系名一致；`angle_compensate` 打开可缓解高速旋转时的角度偏差。启动后立刻检查：

```bash
ros2 topic hz /scan      # 期望 5~10Hz
ros2 topic echo /scan --once | head -30
```

如果 /scan 不出数据：先 `ls -l /dev/ttyUSB0` 看权限，`sudo usermod -aG dialout $USER` 加组；再 `dmesg | grep -i usb` 看是否被识别。

#### 2.2 TF 树完整性检查

建图前必须确认 TF 树完整：`map → odom → base_link → laser_link`。一条命令查：

```bash
ros2 run tf2_ros tf2_echo base_link laser_link
ros2 run tf2_ros tf2_echo odom base_link
```

真机最常见的坑：**odom 和 base_link 之间没有 TF**。仿真里 robot_state_publisher 会帮你算，真机 odom 必须由里程计节点发布（第 32 篇的 odom_bridge.py 里 `transform_broadcaster` 那段）。用 RViz 的 TF 面板可视化检查最直观：

```bash
ros2 launch rviz2 rviz2.launch.py
# 添加 TF display，展开看有没有红色/黄色断链
```

#### 2.3 建图前的"热身"流程

正式建图前先做三件事，能省大量返工：

1.  **手动遥控一圈**：确认能前进/后退/左右转，最小转弯半径在合理范围（差速车理论上可原地转）。
2.  **检查 /odom 与 /scan 同步**：`ros2 run tf2_ros tf2_monitor` 看 odom→laser_link 的延迟，应在几十毫秒内。
3.  **设定建图区域**：真机建图速度远慢于仿真（走路速度 vs 贴地飞），选 20~50㎡ 的房间，先规划好行走路线：绕墙一圈 → 中部"8"字 → 重点区域补扫。

### 三、示例 1：slam_toolbox 在线建图（真机协议对接）

#### 3.1 为什么选 slam_toolbox

第 21 篇讲过 slam_toolbox 是 2D 激光 SLAM 的"默认选择"：配置少、上手快、有回环检测。真机场景它依然是首选，尤其是小户型。启动参数与仿真略有差别（真机里程计噪声大，要降低对里程计的信任）：

```yaml
# slam_toolbox_online.yaml（真机调参版）
slam_toolbox:
  ros__parameters:
    odom_frame: odom
    map_frame: map
    base_frame: base_link
    scan_topic: /scan
    use_scan_matching: true
    use_scan_barycenter: true
    minimum_travel_distance: 0.1      # 移动超过 0.1m 才做匹配
    minimum_travel_heading: 0.05      # 转角超过 0.05rad 才做匹配
    loop_match_minimum_chain_size: 10
    loop_search_maximum_distance: 3.0
    loop_match_maximum_variance_coarse: 3.0
    loop_match_maximum_variance_fine: 0.5
    transform_publish_period: 0.02
    map_update_interval: 2.0          # 地图更新间隔（秒），真机可放宽
    max_laser_range: 12.0
    minimum_time_interval: 0.25
    resolution: 0.05                  # 真机用 0.05m 分辨率
```

#### 3.2 一键建图 launch 文件

把驱动、里程计桥、slam_toolbox、RViz 打包进一个 launch，避免手动开一堆终端：

```python
# mapping.launch.py：真机一键建图
from launch import LaunchDescription
from launch_ros.actions import Node
from launch.actions import ExecuteProcess

def generate_launch_description():
    return LaunchDescription([
        # 1. 激光雷达驱动（以 rplidar 为例）
        Node(package='rplidar_ros', executable='rplidar_composition',
             parameters=[{'serial_port': '/dev/ttyUSB0',
                          'serial_baudrate': 115200,
                          'frame_id': 'laser_link'}],
             output='screen'),
        # 2. 串口桥：odom + IMU + 传感器（第 32 篇的节点）
        Node(package='robot_bringup', executable='serial_bridge',
             parameters=[{'port': '/dev/ttyUSB1', 'baudrate': 115200}],
             output='screen'),
        # 3. slam_toolbox 在线建图
        Node(package='slam_toolbox', executable='async_slam_toolbox_node',
             name='slam_toolbox',
             parameters=['slam_toolbox_online.yaml'],
             output='screen'),
        # 4. RViz 可视化
        Node(package='rviz2', executable='rviz2',
             arguments=['-d', 'src/robot_bringup/rviz/mapping.rviz'],
             output='screen'),
    ])
```

启动：

```bash
ros2 launch robot_bringup mapping.launch.py
```

#### 3.3 遥控建图与保存

启动后用键盘遥控（teleop_twist_keyboard 或手柄）绕场一周。建图质量看 RViz：**地图边界是否闭合、走廊是否笔直、拐角是否成 90°**。出现"地图重影"说明回环没闭环，回到重影起点原地转一圈强制回环。

建图完成保存地图：

```bash
ros2 run nav2_map_server map_saver_cli -f ~/maps/room1
# 生成 room1.pgm（图像）和 room1.yaml（元数据）
```

保存前看一眼地图文件：PGM 是黑白图，黑=障碍物，白=自由空间，灰=未知。如果整体偏灰，说明激光没扫到太多东西（地图覆盖率低），补扫再存。

### 四、示例 2：Cartographer 建图对比与选择

#### 4.1 Cartographer 的优势与代价

第 22 篇讲过 Cartographer 用子图（submap）+ 回环优化，精度上限更高，尤其适合**大场景、回环多的环境**。但代价是：CPU 占用高（真机主控弱的话会卡）、参数多（lua 配置文件）、失败时难排查。

真机选型建议：

| 场景 | 推荐 | 理由 |
| --- | --- | --- |
| 小房间（<50㎡） | slam_toolbox | 快、稳、配置少 |
| 大场景/回环多 | Cartographer | 全局一致性更好 |
| 主控是树莓派 4B 及以下 | slam_toolbox | CPU 占用低 |
| 室内外混合 | Cartographer | 对里程计误差容忍度高 |

#### 4.2 Cartographer 真机配置要点

Cartographer 的 ROS2 版（cartographer_ros）配置在 lua 文件里。真机相比仿真重点改三处：

```lua
-- cartographer_robot.lua
include "map_builder.lua"
include "trajectory_builder.lua"

options = {
  map_builder = MAP_BUILDER,
  trajectory_builder = TRAJECTORY_BUILDER,
  map_frame = "map",
  tracking_frame = "base_link",
  published_frame = "odom",
  odom_frame = "odom",
  provide_odom_frame = true,      -- 真机必须 true：由 odom 话题提供
  use_odometry = true,            -- 真机必须 true：融合里程计
  num_laser_scans = 1,
  num_subdivisions_per_laser_scan = 1,
  -- 真机里程计噪声大，降低 odometry 权重
  TRAJECTORY_BUILDER_2D.odometry_traslation_weight = 1e1,   -- 仿真常用 1e2
  TRAJECTORY_BUILDER_2D.odometry_rotation_weight = 1e1,     -- 仿真常用 1e2
}
return options
```

关键点：`use_odometry = true` 且 `provide_odom_frame = true`，Cartographer 才会融合第 32 篇发布的 /odom。真机里程计不可靠时把 odometry 权重从 1e2 降到 1e1，让激光匹配主导。

#### 4.3 保存与对比

Cartographer 建图完成后同样用 map_saver 保存：

```bash
ros2 run nav2_map_server map_saver_cli -f ~/maps/room1_carto
```

对比 slam_toolbox 的结果：哪个地图的**墙更直、房间比例更接近真实尺寸**就用哪个。不要迷信"越高级越好"——地图能用于后续导航定位才是唯一标准。

### 五、地图后处理：从"能看"到"能用"

刚存的地图往往有噪点、孤立障碍物、未闭合区域，直接给 AMCL 用会导致定位跳变。后处理三步：

#### 5.1 用图像工具修剪（GIMP/画图）

PGM 可以直接用 GIMP 打开编辑（注意 GIMP 打开时选"原始数据"格式，灰度值 0-255）：

-   橡皮擦掉地图边缘的"雪花点"（未建图区域的噪声）。
-   把房间外的杂点涂成黑色（障碍）或灰色（未知）。
-   保持**障碍物边界 1~2 像素**的过渡带，不要用纯黑白硬切。

#### 5.2 用 map_editor 或脚本清理

也可以用 Python + OpenCV 批量清理孤立点：

```python
# clean_map.py：清理 PGM 中的孤立噪点
import cv2
import numpy as np

img = cv2.imread('room1.pgm', cv2.IMREAD_GRAYSCALE)
# 二值化：<205 视为障碍（黑色）
mask = img < 205
# 形态学开运算：先腐蚀后膨胀，去掉孤立小点
kernel = np.ones((3, 3), np.uint8)
cleaned = cv2.morphologyEx(img, cv2.MORPH_OPEN, kernel, iterations=1)
cv2.imwrite('room1_clean.pgm', cleaned)
print('清洗完成：', img.shape)
```

注意：开运算会同时削掉细小的真实障碍（如桌腿），桌腿场景慎用，改用"连通域面积过滤"更精准。

#### 5.3 修改 yaml 元数据

```yaml
# room1_clean.yaml
image: room1_clean.pgm
resolution: 0.05
origin: [-10.0, -10.0, 0.0]
negate: 0
occupied_thresh: 0.65
free_thresh: 0.196
```

-   `resolution`：必须与建图时一致（0.05）。
-   `origin`：地图左下角在 map 系的坐标，改图后**位置别动**，否则定位全部错位。
-   `occupied_thresh/free_thresh`：调大 occupied 可把灰色区域当障碍，适合"宁可撞墙不可穿墙"的保守策略。

### 六、示例 3：AMCL 定位与 Nav2 导航启动

#### 6.1 定位为什么必须用 AMCL

建图给了"地图"，但机器人在地图哪里？AMCL（自适应蒙特卡洛定位）用粒子滤波回答这个问题：撒一大把粒子 → 用激光匹配打分 → 收敛到真实位姿。真机启动 AMCL 的完整 launch：

```python
# navigation.launch.py：AMCL + Nav2 完整导航栈
from launch import LaunchDescription
from launch_ros.actions import Node
from ament_index_python.packages import get_package_share_directory
import os

def generate_launch_description():
    nav2_dir = get_package_share_directory('nav2_bringup')
    return LaunchDescription([
        # 1. 地图服务：把保存的地图发布为 /map
        Node(package='nav2_map_server', executable='map_server',
             parameters=[{'yaml_filename': os.path.expanduser('~/maps/room1_clean.yaml')}],
             output='screen'),
        # 2. AMCL 定位
        Node(package='nav2_amcl', executable='amcl',
             parameters=[os.path.join(nav2_dir, 'params', 'nav2_params.yaml')],
             output='screen'),
        # 3. 生命周期管理（Map/AMCL 是生命周期节点，需要激活）
        Node(package='nav2_lifecycle_manager', executable='lifecycle_manager',
             name='lifecycle_manager_localization',
             parameters=[{'autostart': True,
                          'node_names': ['map_server', 'amcl']}],
             output='screen'),
        # 4. Nav2 核心：规划器 + 控制器 + 代价地图 + 行为树
        Node(package='nav2_planner', executable='planner_server',
             parameters=[os.path.join(nav2_dir, 'params', 'nav2_params.yaml')],
             output='screen'),
        Node(package='nav2_controller', executable='controller_server',
             parameters=[os.path.join(nav2_dir, 'params', 'nav2_params.yaml')],
             output='screen'),
        Node(package='nav2_costmap_2d', executable='nav2_costmap_2d',
             parameters=[os.path.join(nav2_dir, 'params', 'nav2_params.yaml')],
             output='screen'),
        Node(package='nav2_bt_navigator', executable='bt_navigator',
             parameters=[os.path.join(nav2_dir, 'params', 'nav2_params.yaml')],
             output='screen'),
        # 5. Nav2 生命周期管理
        Node(package='nav2_lifecycle_manager', executable='lifecycle_manager',
             name='lifecycle_manager_navigation',
             parameters=[{'autostart': True,
                          'node_names': ['planner_server', 'controller_server',
                                         'costmap_global', 'costmap_local',
                                         'bt_navigator']}],
             output='screen'),
    ])
```

启动：

```bash
ros2 launch robot_bringup navigation.launch.py
```

#### 6.2 初始位姿设置

AMCL 不知道车在哪，需要"喂"一个初始位姿。两种方式：

**方式一：RViz 手动设置**

点击 RViz 工具栏的 “2D Pose Estimate”，在地图上点一下车的大概位置，拖出朝向箭头。观察粒子云：若 3 秒内粒子收敛成一团 → 成功；若粒子散开不收敛 → 初始位姿给错了，重设。

**方式二：launch 里直接给（适合已知起始点）**

```yaml
# nav2_params.yaml 中 amcl 部分
amcl:
  ros__parameters:
    initial_pose:
      x: 0.0
      y: 0.0
      yaw: 0.0
    initial_pose_known: true   # 告诉 AMCL 初始位姿可信
```

#### 6.3 用 Nav2 发目标点

定位收敛后，RViz 点 “2D Goal Pose” 给一个目标点，机器人应当规划路径并走过去。三个验收点：

1.  **路径合理**：绿色路径不走"斜穿障碍"的诡异路线。
2.  **速度平稳**：起步/拐弯/刹车不抽搐（看 /cmd_vel 输出频率稳定）。
3.  **到点停稳**：到达后 /cmd_vel 归零，状态话题报 `NavigationSuccess`。

### 七、Nav2 参数调优实战

真机跑 Nav2 最常见的三个问题：**路径贴墙太近、速度忽快忽慢、转弯原地打转**。逐一解决。

#### 7.1 代价地图参数（贴墙问题）

```yaml
# nav2_params.yaml 中 costmap 部分
global_costmap:
  global_costmap:
    robot_radius: 0.22          # 与 URDF 的 footprint 一致（车轮外沿）
    inflation_radius: 0.35      # 障碍膨胀半径，真机建议 ≥ 车宽/2
    cost_scaling_factor: 3.0    # 越大路径越贴墙，真机调小到 2.0~3.0
    static_layer:
      map_subscribe_transient_local: true

local_costmap:
  local_costmap:
    robot_radius: 0.22
    inflation_radius: 0.30
    cost_scaling_factor: 3.0
    observation_sources: scan
    scan:
      topic: /scan
      max_obstacle_height: 0.5
      min_obstacle_height: 0.0
```

真机路径"贴墙"是**膨胀半径太小**导致的：车宽 44cm，膨胀只有 20cm，路径规划出来离墙 20cm，实际车宽一半就 22cm，必蹭墙。把 inflation_radius 设到 0.35（车宽/2 + 余量）就安全了。

#### 7.2 控制器参数（速度抖动问题）

```yaml
# DWB 控制器（真机推荐用 DWB 而不是 MPPI，参数少、稳定）
controller_server:
  ros__parameters:
    controller_plugins: ["FollowPath"]
    FollowPath:
      plugin: "dwb_core::DWBLocalPlanner"
      min_vel_x: 0.0
      max_vel_x: 0.5           # 真机限速：室内 0.5m/s 足够
      min_vel_theta: 0.0
      max_vel_theta: 1.0       # 角速度上限（rad/s），别给 2.0 以上
      acc_lim_x: 0.5           # 加速度限制，越小越平稳
      acc_lim_theta: 0.8
      xy_goal_tolerance: 0.1   # 到点容差，真机 0.1~0.15 合理
      yaw_goal_tolerance: 0.2
```

速度忽快忽慢的根源是**加速度限制太小 + 目标容差太小**：车为了"精确到点"不停修正，看起来就抽搐。真机把 xy_goal_tolerance 放到 0.1m，yaw 容差 0.2rad，车到附近就"承认到位"，稳定很多。

#### 7.3 转弯打转问题

差速车转弯打转（原地绕圈）通常是两个原因：

1.  **最小转弯半径被规划器忽略**：真机在窄通道里，全局路径要求"原地转向"，DWB 频繁切换方向导致振荡。解法：降低 max_vel_theta 到 1.0 以下，并加大 acc_lim_theta。
2.  **里程计 yaw 漂移**：第 32 篇说过，融合 IMU 的 yaw 能根治。确认 ekf 配置里 `use_imu: true`，且 IMU 话题有数据（`ros2 topic hz /imu/data`）。

#### 7.4 行为树与重试策略

Nav2 默认行为树是"一条路走到黑"：规划失败就报错。真机环境动态变化多，改用带重试的树：

```yaml
# nav2_params.yaml
bt_navigator:
  ros__parameters:
    default_bt_xml_filename: "navigate_to_pose_w_replanning_and_recovery.xml"
```

这个树会在路径失效时**重新规划**，连续失败才进入恢复行为（旋转 360° 重新定位附近障碍），适合真机。

### 八、示例 4：任务级导航（Python 导航客户端）

导航栈跑起来后，写程序让机器人**自动完成"去 A 点 → 去 B 点 → 回充电桩"**的任务链。用 nav2_simple_commander 封装：

```python
# task_navigation.py：任务级导航（Python）
import rclpy
from geometry_msgs.msg import PoseStamped
from nav2_simple_commander.robot_navigator import BasicNavigator, TaskResult

def make_pose(navigator, x, y, yaw=0.0):
    """构造目标位姿"""
    pose = PoseStamped()
    pose.header.frame_id = 'map'
    pose.header.stamp = navigator.get_clock().now().to_msg()
    pose.pose.position.x = x
    pose.pose.position.y = y
    pose.pose.orientation.z = float(__import__('math').sin(yaw / 2.0))
    pose.pose.orientation.w = float(__import__('math').cos(yaw / 2.0))
    return pose

def main():
    rclpy.init()
    navigator = BasicNavigator()
    # 依次去三个点（坐标为地图坐标系下的实际位置）
    waypoints = [make_pose(navigator, 1.0, 1.0, 0.0),
                 make_pose(navigator, 2.0, 2.5, 1.57),
                 make_pose(navigator, 0.0, 0.0, 3.14)]
    for i, wp in enumerate(waypoints):
        print(f'=== 前往第 {i+1} 个目标点 ===')
        navigator.goToPose(wp)
        while not navigator.isTaskComplete():
            feedback = navigator.getFeedback()
            if feedback:
                print(f'剩余距离: {feedback.distance_remaining:.2f} m')
        result = navigator.getResult()
        if result == TaskResult.SUCCEEDED:
            print(f'第 {i+1} 点到达')
        elif result == TaskResult.CANCELED:
            print('任务被取消')
            break
        else:
            print(f'第 {i+1} 点导航失败，继续下一个')
    navigator.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

运行：

```bash
ros2 run robot_tasks task_navigation.py
```

注意点：

-   `frame_id` 必须是 `map`，且要在 AMCL 定位收敛后再跑（粒子未收敛就发目标，导航大概率失败）。
-   反馈轮询用 `isTaskComplete()` 而非固定 sleep，避免阻塞回调。
-   失败不中断（示例里"继续下一个"），真机任务链更稳健；重要点位可加"失败重试 2 次"逻辑。

### 九、常见问题与排障

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 建图时地图乱跳 | 里程计不准 / TF 时间不同步 | 校准轮径、轮距；统一时间源；查 tf2_monitor |
| /scan 无数据 | 串口权限 / 驱动没起来 | ls -l /dev/ttyUSB*；sudo usermod -aG dialout $USER |
| AMCL 粒子不收敛 | 初始位姿给错 / 地图分辨率不一致 | 重设初始位姿；检查 yaml 的 resolution |
| 导航路径贴墙 | 膨胀半径太小 | inflation_radius 加大到车宽/2 + 余量 |
| 到点后原地抽搐 | 目标容差太小 / 加速度太猛 | xy_goal_tolerance=0.1，acc_lim_x 调小 |
| 转弯打转 | 角速度限幅不足 / IMU 没接入 | max_vel_theta ≤ 1.0；确认 ekf use_imu=true |
| 导航报 TF extrapolation | 里程计时间戳用错 | 用 get_clock().now() 发 odom 时间戳 |
| 地图保存后定位全错 | 改图动了 origin | 后处理只动像素，别动 yaml 的 origin |

### 十、小结与下一篇预告

**本篇核心**：

1.  仿真到实物的三大差异：传感器噪声、里程计误差、时间同步，一切调参围绕这三点展开。
2.  建图选型：小房间用 slam_toolbox，大场景回环多用 Cartographer；地图要后处理（去噪、修边、验元数据）。
3.  导航三板斧：AMCL 定位收敛 → Nav2 规划导航 → 参数调优（膨胀半径、速度限制、行为树重试）。
4.  任务级导航用 nav2_simple_commander，把"点对点"升级为"多目标任务链"。

至此，实体机器人已经能**建图、定位、自主导航**。第 31~33 篇分别完成了硬件搭建、软硬通信、建图导航三件大事。下一篇（第 34 篇）是实体机器人阶段的收官篇：**完整实体机器人项目实战（软硬协同）**，把底盘、通信、建图、导航、传感器全部整合成一个可复用的项目模板，并给出完整的测试与验收流程。
