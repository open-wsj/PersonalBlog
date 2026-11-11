---
title: "ROS2系列教程：完整实体机器人项目实战（软硬协同）"
abbrlink: ros2-xi-lie-jiao-cheng-wan-zheng-shi-ti-ji-qi-ren-xiang-mu
date: "2026-10-18 22:53:40"
categories:
    - "ROS2"
tags: []
desc: "本文是 ROS2 系列教程的第 34 篇：完整实体机器人项目实战（软硬协同）。第 31~33 篇分别完成了硬件搭建、软硬通信、建图导航三件大事…"
---
## 本文是 ROS2 系列教程的第 34 篇

> 本文是 ROS2 系列教程的第 34 篇：完整实体机器人项目实战（软硬协同）。第 31~33 篇分别完成了硬件搭建、软硬通信、建图导航三件大事。本篇把底盘驱动、串口协议、传感器、里程计、建图、导航、行为任务**全部整合成一个可复用的项目模板**，并给出从零到一的分步集成顺序、launch 组织方式、完整的测试与验收清单。学完本篇，你拥有一个"开箱即用"的实体机器人工程，也可以直接作为毕业设计或竞赛项目的底座。

### 一、项目总览：一个能跑的完整工程长什么样

#### 1.1 项目结构

规范的项目结构是"软硬协同"的地基。推荐用标准 ROS2 工作空间组织：

```text
robot_ws/
├── src/
│   ├── robot_bringup/          # 总启动包：launch + 参数 + RViz 配置
│   │   ├── launch/
│   │   │   ├── robot.launch.py     # 一键启动全部
│   │   │   ├── mapping.launch.py   # 建图模式
│   │   │   └── navigation.launch.py# 导航模式
│   │   ├── config/
│   │   │   ├── robot.yaml          # 机器人描述参数（轮距/轮径/编码器）
│   │   │   └── nav2_params.yaml    # Nav2 全套参数
│   │   ├── urdf/
│   │   │   └── robot.urdf.xacro    # 统一机器人模型
│   │   ├── rviz/
│   │   │   ├── mapping.rviz
│   │   │   └── navigation.rviz
│   │   ├── package.xml
│   │   └── CMakeLists.txt
│   ├── robot_description/       # 模型描述（URDF/Xacro/meshes）
│   ├── robot_driver/            # 下位机驱动（串口桥 + 传感器聚合）
│   │   └── robot_driver/
│   │       ├── serial_bridge.py      # 串口收发（第 32 篇）
│   │       ├── sensor_aggregator.py  # 传感器汇聚（第 32 篇）
│   │       ├── imu_node.py           # IMU 发布（第 32 篇）
│   │       └── battery_monitor.py    # 电量监控
│   └── robot_tasks/             # 任务层（导航任务链等）
│       └── robot_tasks/
│           ├── task_navigation.py    # 多点导航（第 33 篇）
│           └── task_mission.py       # 综合任务调度
```

核心思想：**driver 负责"感知与执行"，bringup 负责"组装"，tasks 负责"行为"**，三层解耦，任何一层可单独替换。

#### 1.2 数据流总览（软硬协同的"电路图"）

```text
┌─────────────────────────────────────────────────────────┐
│                       上位机 (ROS2)                      │
│                                                         │
│  /cmd_vel ──► serial_bridge ──► 串口(115200) ──► STM32   │
│                ▲   │                                   │
│                │   ▼                                   │
│  /odom ◄───────┘   └──► /imu/data ──► robot_localization│
│  /scan (激光雷达)  ──► slam_toolbox / AMCL              │
│  /battery_voltage ──► battery_monitor ──► 急停话题       │
│                                                         │
│  Nav2: map_server + AMCL + planner + controller + BT    │
│  tasks: 多点导航 / 充电任务 / 巡航任务                   │
└─────────────────────────────────────────────────────────┘
```

三条主线：**指令下行**（Nav2 → /cmd_vel → 串口 → 电机）、**状态上行**（编码器 → 里程计 → 定位/建图）、**传感旁路**（激光雷达/IMU/电量独立接入）。任何一条断了，机器人都会"看起来活着但走不动"。

### 二、集成顺序：从"能开机"到"能跑任务"

软硬协同最忌讳"一次全上"——出问题根本没法定位。推荐按下面 6 步渐进集成，每步都有明确的验收标准。

#### 2.1 第一步：硬件自检（不启动 ROS）

目标：确认下位机、电机、编码器、传感器硬件本身没问题。

1.  上电后观察 STM32 指示灯：电源灯常亮、状态灯按 1Hz 闪烁。
2.  用串口调试助手（115200, 8N1）手动发指令：`AA 55 01 02 00 64 00`（前进 0.5m/s），听电机声、看轮子转。
3.  转动轮子，观察回传的编码器数据是否变化。

验收标准：能手动控制电机正反转、编码器读数随转动变化。

#### 2.2 第二步：串口链路打通（不启动 ROS）

目标：上位机与下位机的串口通信稳定。

```bash
# 先测裸串口（不经过 ROS）
python3 -c "
import serial, time
s = serial.Serial('/dev/ttyUSB1', 115200, timeout=0.1)
s.write(bytes.fromhex('AA 55 01 02 00 64 00'))
time.sleep(0.2)
print('recv:', s.read(32).hex())
"
```

验收标准：能收到下位机 50Hz 回传的状态帧，且 CRC8 校验通过（自己写个 Python 校验脚本验证）。

#### 2.3 第三步：驱动节点跑通（启动 serial_bridge）

目标：/odom、/imu、/battery 话题有数据。

```bash
ros2 run robot_driver serial_bridge --ros-args -p port:=/dev/ttyUSB1 -p baudrate:=115200
ros2 topic hz /odom      # 期望 50Hz
ros2 topic hz /imu/data  # 期望 50Hz
ros2 topic echo /odom --once
```

验收标准：三个话题频率稳定，/odom 的坐标随推车移动而变化。

#### 2.4 第四步：模型与 TF 对齐

目标：URDF 里的轮距/轮径与下位机里程计参数一致，TF 树完整。

```bash
ros2 launch robot_bringup robot.launch.py
ros2 run tf2_ros tf2_echo base_link laser_link
ros2 run tf2_ros tf2_echo odom base_link
rviz2   # 打开 TF 面板看有没有断链
```

**关键检查**：把车推 1 米，RViz 里车模也走约 1 米（误差 <5%）；原地转 360°，RViz 里 yaw 也转约 360°。不符就回第 28 篇核对 diff_drive_controller 参数。

#### 2.5 第五步：建图与导航（第 33 篇内容）

目标：能建出可用地图，AMCL 定位收敛，Nav2 能导航到目标点。

```bash
ros2 launch robot_bringup mapping.launch.py   # 建图
# 保存地图 → 后处理 → 修改 yaml
ros2 launch robot_bringup navigation.launch.py # 导航
```

验收标准：建图无重影、定位 3 秒收敛、导航路径合理不贴墙。

#### 2.6 第六步：任务链打通

目标：程序自动完成"巡航 → 回充 → 待机"任务。

```bash
ros2 run robot_tasks task_navigation.py
```

验收标准：连续 3 次任务循环无失败，断电重启后能恢复初始位姿继续执行。

### 三、示例 1：一键启动总 launch（软硬协同的"总开关"）

把驱动、传感器、生命周期管理全部编排进一个 launch，提供三种运行模式：

```python
# robot.launch.py：一键总启动（带模式参数）
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, ExecuteProcess
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
import os

def generate_launch_description():
    mode = LaunchConfiguration('mode', default='navigation')
    return LaunchDescription([
        DeclareLaunchArgument('mode', default_value='navigation',
                              description='navigation | mapping | manual'),
        # ===== 基础层：模型 + 驱动（所有模式都需要） =====
        Node(package='robot_state_publisher', executable='robot_state_publisher',
             parameters=[{'robot_description': open(
                 os.path.expanduser('~/robot_ws/src/robot_bringup/urdf/robot.urdf.xacro')).read()}],
             output='screen'),
        Node(package='robot_driver', executable='serial_bridge',
             parameters=[{'port': '/dev/ttyUSB1', 'baudrate': 115200}],
             output='screen'),
        Node(package='robot_driver', executable='sensor_aggregator',
             parameters=[{'low_battery_threshold': 10.8}],
             output='screen'),
        # ===== 模式分支 =====
        # 模式由 Exec 动态选择，这里以 navigation 为例：
        Node(package='nav2_map_server', executable='map_server',
             parameters=[{'yaml_filename': os.path.expanduser('~/maps/room1_clean.yaml')}],
             output='screen'),
        Node(package='nav2_amcl', executable='amcl',
             parameters=['~/robot_ws/src/robot_bringup/config/nav2_params.yaml'],
             output='screen'),
        Node(package='nav2_lifecycle_manager', executable='lifecycle_manager',
             name='lifecycle_manager_localization',
             parameters=[{'autostart': True,
                          'node_names': ['map_server', 'amcl']}],
             output='screen'),
        Node(package='nav2_planner', executable='planner_server',
             parameters=['~/robot_ws/src/robot_bringup/config/nav2_params.yaml'],
             output='screen'),
        Node(package='nav2_controller', executable='controller_server',
             parameters=['~/robot_ws/src/robot_bringup/config/nav2_params.yaml'],
             output='screen'),
        Node(package='nav2_bt_navigator', executable='bt_navigator',
             parameters=['~/robot_ws/src/robot_bringup/config/nav2_params.yaml'],
             output='screen'),
        Node(package='nav2_lifecycle_manager', executable='lifecycle_manager',
             name='lifecycle_manager_navigation',
             parameters=[{'autostart': True,
                          'node_names': ['planner_server', 'controller_server',
                                         'bt_navigator']}],
             output='screen'),
    ])
```

启动方式：

```bash
ros2 launch robot_bringup robot.launch.py mode:=mapping     # 建图模式
ros2 launch robot_bringup robot.launch.py mode:=navigation  # 导航模式
ros2 launch robot_bringup robot.launch.py mode:=manual      # 手动遥控
```

设计要点：**基础层常驻，模式层按需切换**——驱动和模型任何模式下都要跑，只有算法层（slam/amcl/nav2）随模式变化。这样切换模式不需要重启驱动，避免串口被反复占用。

### 四、示例 2：安全机制（软硬协同的"保命系统"）

实体机器人的安全比功能更重要。四个安全层缺一不可：

#### 4.1 看门狗（上位机侧）

串口桥里检测下位机断连，超时急停：

```python
# watchdog.py：上位机看门狗（在 serial_bridge 内集成）
import rclpy
from rclpy.node import Node
from std_msgs.msg import Float32

class Watchdog(Node):
    def __init__(self):
        super().__init__('watchdog')
        self.last_heartbeat = self.get_clock().now()
        self.timeout = 0.5  # 500ms 无心跳视为掉线
        self.timer = self.create_timer(0.1, self.check)
        self.pub_stop = self.create_publisher(Float32, 'robot_status/emergency_stop', 10)

    def heartbeat(self):  # 由 serial_bridge 在收到帧时调用
        self.last_heartbeat = self.get_clock().now()

    def check(self):
        if (self.get_clock().now() - self.last_heartbeat).nanoseconds > self.timeout * 1e9:
            self.get_logger().error('下位机掉线，发布急停！')
            msg = Float32(); msg.data = 1.0
            self.pub_stop.publish(msg)
```

#### 4.2 低电量保护（下位机 + 上位机双保险）

下位机检测到电压低于阈值（如 10.8V），**直接硬件断电电机**（不依赖上位机）；同时上位机 battery_monitor 收到低电量后发布急停话题并拒绝新导航任务。

#### 4.3 障碍物急停（激光雷达联动）

在 Nav2 的局部代价地图里把障碍物膨胀半径调大只是"软避障"；更硬核的是在 controller 前加一个**安全过滤器**：

```python
# safety_filter.py：订阅 /scan，距离过近直接覆盖 /cmd_vel 为 0
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import LaserScan
from geometry_msgs.msg import Twist

class SafetyFilter(Node):
    def __init__(self):
        super().__init__('safety_filter')
        self.min_distance = 0.25  # 25cm 内必须停车
        self.sub = self.create_subscription(LaserScan, '/scan', self.on_scan, 10)
        self.sub_cmd = self.create_subscription(Twist, '/cmd_vel_raw', self.on_cmd, 10)
        self.pub = self.create_publisher(Twist, '/cmd_vel', 10)  # 最终输出
        self.current_cmd = Twist()

    def on_cmd(self, msg):
        self.current_cmd = msg

    def on_scan(self, scan):
        # 只检查前方 ±60° 的障碍（避开侧面正常贴近）
        danger = False
        n = len(scan.ranges)
        for i in range(n):
            angle = scan.angle_min + i * scan.angle_increment
            if abs(angle) < 1.047:  # 60° 内
                if 0.05 < scan.ranges[i] < self.min_distance:
                    danger = True
                    break
        if danger:
            twist = Twist()  # 全零 = 急停
            self.pub.publish(twist)
        else:
            self.pub.publish(self.current_cmd)

def main():
    rclpy.init()
    node = SafetyFilter()
    rclpy.spin(node)
```

要点：安全过滤器发布到**真正的 /cmd_vel**，Nav2 控制器发布到 `/cmd_vel_raw`。这样即使 Nav2 或任务层出错，安全层也能兜底。

#### 4.4 机械限位

软件安全之外，电机控制板要保留硬件限位：电机驱动器使能脚接紧急停止开关，按下直接断使能（下位机 GPIO 或继电器），不依赖任何软件。**软硬结合才是完整的安全**。

### 五、示例 3：任务层架构（行为级软硬协同）

任务层把"点到点导航"升级为"完整行为"：

```python
# task_mission.py：综合任务调度（巡航 + 回充 + 待机）
import rclpy
from rclpy.node import Node
from nav2_simple_commander.robot_navigator import BasicNavigator, TaskResult
from geometry_msgs.msg import PoseStamped
import math

class Mission(Node):
    def __init__(self):
        super().__init__('mission')
        self.nav = BasicNavigator()
        # 巡逻点（真实地图坐标）
        self.patrol_points = [
            self._pose(1.0, 1.0, 0.0),
            self._pose(2.0, 2.5, 1.57),
            self._pose(1.5, 3.5, 3.14),
        ]
        self.charging_station = self._pose(0.0, 0.0, 0.0)
        self.battery = 100.0
        self.timer = self.create_timer(0.5, self.loop)

    def _pose(self, x, y, yaw):
        p = PoseStamped()
        p.header.frame_id = 'map'
        p.header.stamp = self.nav.get_clock().now().to_msg()
        p.pose.position.x = x; p.pose.position.y = y
        p.pose.orientation.z = math.sin(yaw/2); p.pose.orientation.w = math.cos(yaw/2)
        return p

    def loop(self):
        if self.battery < 20.0:
            self.get_logger().info('电量低，去充电')
            self._go(self.charging_station)
        else:
            for pt in self.patrol_points:
                self._go(pt)

    def _go(self, pose):
        self.nav.goToPose(pose)
        while not self.nav.isTaskComplete():
            rclpy.spin_once(self, timeout_sec=0.1)
        if self.nav.getResult() != TaskResult.SUCCEEDED:
            self.get_logger().warn('导航失败，重试一次')
            self.nav.goToPose(pose)
            while not self.nav.isTaskComplete():
                rclpy.spin_once(self, timeout_sec=0.1)

def main():
    rclpy.init()
    node = Mission()
    rclpy.spin(node)
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

任务层设计原则：

1.  **状态机驱动**而不是"一段到底"的顺序代码：待机 → 巡航 → 低电回充 → 充电完成 → 继续巡航。
2.  **失败重试**：单点失败重试 1 次，连续失败才报警（避免任务卡死）。
3.  **电量是最高优先级**：任何时候电量低于阈值，中断当前任务回充。

### 六、示例 4：系统监控与诊断（软硬协同的"体检报告"）

实体机器人要能"自报家门"——出问题能快速定位：

#### 6.1 监控脚本

```python
# robot_diagnose.py：一键体检
import subprocess

checks = [
    ('/odom 频率', 'ros2 topic hz /odom --window 10'),
    ('/scan 频率', 'ros2 topic hz /scan --window 10'),
    ('TF odom→base_link', 'ros2 run tf2_ros tf2_echo odom base_link'),
    ('TF base_link→laser', 'ros2 run tf2_ros tf2_echo base_link laser_link'),
    ('节点列表', 'ros2 node list'),
    ('串口设备', 'ls -l /dev/ttyUSB*'),
]

for name, cmd in checks:
    print(f'===== {name} =====')
    try:
        out = subprocess.run(cmd.split(), capture_output=True, text=True, timeout=15)
        print(out.stdout[-500:] or out.stderr[-500:])
    except Exception as e:
        print(f'[FAIL] {e}')
```

#### 6.2 日志与 bag 录制

```bash
# 录包：出问题能回放定位（录 /odom /scan /tf /cmd_vel 即可）
ros2 bag record /odom /scan /tf /tf_static /cmd_vel -o ~/bags/run_$(date +%m%d_%H%M)

# 看日志
ros2 launch robot_bringup robot.launch.py 2>&1 | tee ~/logs/robot_$(date +%m%d).log
```

#### 6.3 常见故障快速定位表

| 现象 | 第一步检查 | 常见根因 |
| --- | --- | --- |
| 电机不动 | 看 /cmd_vel 有没有输出 | 导航没发指令 / 安全过滤器急停 |
| 电机抖动 | 听声音+看 /odom | 编码器接反 / PID 参数不对 |
| 建图漂移 | 看 /odom 与真值差 | 轮径/轮距不准 / 打滑 |
| 定位跳变 | 看 AMCL 粒子分布 | 地图脏 / 初始位姿错 |
| 掉线急停 | 看串口日志 | 线松 / 电磁干扰 / 波特率错 |
| 导航绕路 | 看全局路径 | 膨胀半径太大 / 地图未更新 |

### 七、完整验收清单（软硬协同的"结业考试"）

按顺序逐项打勾，全部通过才算"项目完成"：

**基础项**

-   [ ]  一键启动（robot.launch.py）不报错，节点全部 ACTIVE
-   [ ]  /odom、/imu、/scan 频率达标（50/50/10 Hz）
-   [ ]  TF 树完整无断链（RViz 检查）
-   [ ]  推车 1m，里程计误差 <5%；原地转 360°，yaw 误差 <5°
-   [ ]  遥控模式能前进/后退/原地转向

**建图项**

-   [ ]  20~50㎡ 房间 10 分钟内建完，无重影
-   [ ]  地图后处理完成（去噪 + 元数据正确）
-   [ ]  保存/加载地图成功

**导航项**

-   [ ]  AMCL 初始定位 3 秒内收敛（粒子聚焦）
-   [ ]  任意目标点导航成功率 ≥ 90%（试 10 次）
-   [ ]  中途放障碍物能绕行或停车，不碰撞
-   [ ]  到达目标后停稳，无原地抽搐

**安全项**

-   [ ]  下位机掉线 0.5s 内触发急停
-   [ ]  电量低于阈值自动回充
-   [ ]  25cm 内障碍物硬停车（拔掉 Nav2 也生效）
-   [ ]  物理急停开关按下立即断电

**任务项**

-   [ ]  巡航任务连续 3 轮无失败
-   [ ]  低电回充 → 充电 → 继续巡航完整闭环
-   [ ]  断电重启后能恢复任务（初始位姿重设后继续）

### 八、项目维护与演进

#### 8.1 代码版本管理

```bash
cd ~/robot_ws/src
git init && git add -A && git commit -m "v1.0 实体机器人软硬协同初版"
git tag v1.0
# 每次改动：小步提交 + 写 changelog，真机调试最容易"改回去"
```

#### 8.2 参数集中管理

把轮径、轮距、编码器 PPR、IMU 安装朝向、电池阈值等**所有可调参数**集中到一个 `robot.yaml`，不要在代码里散落魔法数字。换一台车（不同轮径），只改这一个文件。

#### 8.3 从"能跑"到"跑得好"

后续优化方向（按性价比排序）：

1.  **里程计标定**（robot_ocalib 等工具自动标定轮径/轮距，精度提升最明显）。
2.  **IMU 融合调参**（EKF 协方差权重，第 32 篇已铺垫）。
3.  **建图路径规划**（自动巡航建图替代手动遥控）。
4.  **多传感器融合**（加 TOF 超声波补盲区，第 30 篇的传感器聚合器已预留接口）。

### 九、常见问题与排障

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 一键启动报端口占用 | 上次没关干净 / udev 绑定错 | ps 查 serial_bridge 残留；用固定 udev 规则绑定 /dev/robot |
| 节点启动但 topic 无数据 | 生命周期没激活 / 参数路径错 | 检查 lifecycle_manager autostart；用绝对路径给参数 |
| 建图好导航差 | 定位与建图地图不一致 | 检查地图 resolution/origin；重新建图 |
| 偶尔抽风一下 | 电磁干扰 / 电压波动 | 串口隔离模块 + 电机线远离 + 电容滤波 |
| 电池没电关机 | 没有低电量保护 | 补 battery_monitor + 下位机硬件断电 |
| 重启后 ROS 时间错乱 | 没有 NTP/chrony | 装 chrony 或手动 date -s 校时 |

### 十、小结与系列预告

**本篇核心**：

1.  三层架构：driver（感知执行）/ bringup（组装）/ tasks（行为），层层解耦、逐层可测。
2.  六步渐进集成：硬件自检 → 串口 → 驱动 → TF → 建图导航 → 任务链，每步有验收标准。
3.  四层安全：看门狗 + 低电量 + 障碍物急停 + 物理限位，软硬结合缺一不可。
4.  完整验收清单：基础/建图/导航/安全/任务五类逐项打分，是项目"完成"的客观标准。

至此，**实体机器人阶段（31~34）全部收官**！你从零搭出了一台能建图、能定位、能自主导航、能执行任务、有完整安全机制的真实机器人——这正是 ROS2 学习的"大满贯"。

下一篇（第 35 篇）开启系列最后一个大阶段：**MoveIt2 机械臂篇**。第 35 篇「MoveIt2 环境与机械臂建模准备」将带你从零配置 MoveIt2 环境、用 URDF 描述机械臂、生成 MoveIt2 配置包，为后续运动规划、运动学、碰撞避障与真机控制打基础。机械臂和移动底盘不同：移动机器人关心"轮子转多少"，机械臂关心"关节动多少"，坐标系与运动学思维将焕然一新。
