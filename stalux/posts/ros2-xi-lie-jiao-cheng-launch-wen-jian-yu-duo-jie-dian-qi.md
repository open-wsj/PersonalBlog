---
title: "ROS2系列教程：launch文件与多节点启动（参数/条件/复用）"
abbrlink: ros2-xi-lie-jiao-cheng-launch-wen-jian-yu-duo-jie-dian-qi
date: "2026-09-05 15:48:51"
categories:
    - "ROS2"
tags: []
desc: "本篇文章系统掌握了 launch：最简多节点启动、参数传递（yaml/字典/launch 参数）、话题重映射、命名空间、条件控制、子 launch 包含、组与外部进程、事件处理器，以及调试技巧…"
---
## 本文是 ROS2 系列教程的第 11 篇

> 本文是 ROS2 系列教程的第 11 篇：launch 文件与多节点启动。一个真实的机器人系统有几十个节点，手动开几十个终端逐个 `ros2 run` 既不现实也不可维护。本篇文章系统讲解 launch——用 Python 编写 launch 文件实现**一键启动多节点**、传递参数、设置条件与复用、包含其他 launch 文件，掌握 `ros2 launch` 命令与调试技巧。学完你就能用一条命令启动整个机器人系统。

### 一、为什么需要 launch

#### 1.1 手动启动的痛点

```bash
# 手动启动一个导航系统：要开十几个终端
ros2 run nav2_amcl amcl &
ros2 run nav2_bt_navigator bt_navigator &
ros2 run nav2_controller controller_server &
...
```

痛点显而易见：

-   命令又多又长，容易出错。
-   节点间的启动顺序、参数传递无法管理。
-   无法"一键启停"、无法复用配置。

#### 1.2 launch 能做什么

**launch 文件**用 Python 编写（ROS2 用 Python 而非 ROS1 的 XML），描述"启动什么、怎么启动、按什么顺序"：

```text
启动多个节点          → Node(package=..., executable=...)
设置节点参数          → parameters=[...]
设置命名空间/重映射   → namespace=..., remappings=[...]
条件控制             → IfCondition/UnlessCondition
复用其他 launch      → IncludeLaunchDescription
启动外部进程         → ExecuteProcess
事件与回调           → RegisterEventHandler（复杂场景）
```

一句话：**launch 是 ROS2 的系统编排层**。

### 二、launch 文件基础

#### 2.1 最简 launch 文件

```python
# launch/demo.launch.py
from launch import LaunchDescription
from launch_ros.actions import Node

def generate_launch_description():
    return LaunchDescription([
        Node(
            package='py_demo',
            executable='py_talker',
            name='talker',           # 覆盖节点名
            output='screen',         # 输出到屏幕（替代终端日志）
        ),
        Node(
            package='py_demo',
            executable='py_subscriber',
            name='listener',
            output='screen',
        ),
    ])
```

运行：

```bash
ros2 launch py_demo demo.launch.py
```

**注意**：

1.  函数名固定为 `generate_launch_description()`。
2.  `package` + `executable` 定位节点（executable 是 entry_points/CMake 里定义的命令名）。
3.  `output='screen'` 把节点日志打到终端（不设置则静默）。
4.  launch 文件放在包的 `launch/` 目录，并在 `setup.py`/`CMakeLists.txt` 安装。

#### 2.2 launch 文件的安装

**Python 包**（setup.py 里已加过）：

```python
data_files=[
    ...
    (os.path.join('share', package_name, 'launch'),
        glob('launch/*.launch.py')),
]
```

**C++ 包**（CMakeLists.txt）：

```cmake
install(DIRECTORY launch
  DESTINATION share/${PROJECT_NAME})
```

### 三、参数与重映射

#### 3.1 传递参数

```python
# launch/params.launch.py —— 参数传递
from launch import LaunchDescription
from launch_ros.actions import Node

def generate_launch_description():
    return LaunchDescription([
        Node(
            package='py_demo',
            executable='configurable_sensor',
            name='sensor',
            output='screen',
            # 方式一：parameters 传 yaml 文件
            parameters=['config/params.yaml'],
        ),
        Node(
            package='py_demo',
            executable='param_node',
            name='param_node',
            output='screen',
            # 方式二：直接传参数对
            parameters=[{'robot_name': 'my_rover', 'max_speed': 3.0}],
        ),
    ])
```

#### 3.2 从命令行传参（launch 参数）

```python
# launch/args.launch.py —— 带命令行参数的 launch
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

def generate_launch_description():
    # 声明 launch 参数（默认值）
    speed_arg = DeclareLaunchArgument(
        'max_speed', default_value='2.5', description='最大速度')

    # 用 LaunchConfiguration 读取
    max_speed = LaunchConfiguration('max_speed')

    return LaunchDescription([
        speed_arg,
        Node(
            package='py_demo',
            executable='param_node',
            name='param_node',
            output='screen',
            parameters=[{'max_speed': max_speed}],   # 引用 launch 参数
        ),
    ])
```

运行：

```bash
# 默认值 2.5
ros2 launch py_demo args.launch.py

# 自定义 5.0
ros2 launch py_demo args.launch.py max_speed:=5.0
```

#### 3.3 话题重映射

重映射解决"同一个包换个话题名用"的场景（如双机器人，一个用 `/robot1/cmd_vel`）：

```python
Node(
    package='py_demo',
    executable='py_talker',
    name='talker_1',
    output='screen',
    remappings=[
        ('chatter', 'robot1/chatter'),   # 原话题 → 新话题
    ],
)
```

重映射对话题、服务、动作名都生效，是"多实例复用"的关键技术。

### 四、命名空间

#### 4.1 设置命名空间

```python
# launch/namespace.launch.py —— 命名空间
from launch import LaunchDescription
from launch_ros.actions import Node

def generate_launch_description():
    return LaunchDescription([
        # 两个机器人，各自命名空间
        Node(
            package='py_demo', executable='py_talker',
            name='talker', namespace='robot1', output='screen',
        ),
        Node(
            package='py_demo', executable='py_talker',
            name='talker', namespace='robot2', output='screen',
        ),
    ])
```

启动后 `ros2 node list` 显示：

```text
/robot1/talker
/robot2/talker
```

**同名节点 + 不同命名空间**互不冲突——这就是命名空间的价值：一套代码，多机器人实例。

#### 4.2 相对与绝对话题

设置命名空间后，话题名会跟着"前缀"：

```text
代码里写 'chatter'（相对名）
→ 命名空间 robot1 下实际为 /robot1/chatter
代码里写 '/chatter'（绝对名，以 / 开头）
→ 仍是 /chatter，不受命名空间影响
```

**实践建议**：默认用相对话题名（随命名空间走），需要跨命名空间共享的数据用绝对名。

### 五、条件与组合

#### 5.1 条件启动

```python
# launch/conditional.launch.py —— 条件控制
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch.conditions import IfCondition, UnlessCondition
from launch_ros.actions import Node

def generate_launch_description():
    use_sim = LaunchConfiguration('use_sim')   # 'true' / 'false'

    return LaunchDescription([
        DeclareLaunchArgument('use_sim', default_value='false'),
        # use_sim=true 时启动仿真节点
        Node(
            package='gazebo_ros', executable='spawn_entity.py',
            condition=IfCondition(use_sim),
            arguments=['-entity', 'robot', '-file', 'robot.urdf'],
        ),
        # use_sim=false 时启动实体驱动
        Node(
            package='py_demo', executable='robot_driver',
            condition=UnlessCondition(use_sim),
            output='screen',
        ),
    ])
```

运行：

```bash
ros2 launch py_demo conditional.launch.py use_sim:=true    # 仿真
ros2 launch py_demo conditional.launch.py use_sim:=false   # 实体
```

#### 5.2 包含其他 launch 文件

大型系统拆分成多个 launch 子文件，用 `IncludeLaunchDescription` 组合：

```python
# launch/main.launch.py —— 包含子 launch
import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch_ros.actions import Node

def generate_launch_description():
    py_demo_dir = get_package_share_directory('py_demo')

    return LaunchDescription([
        # 包含同包内的 sensor.launch.py
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(
                os.path.join(py_demo_dir, 'launch', 'sensor.launch.py')),
            launch_arguments={'rate': '20.0'}.items(),   # 传参给子 launch
        ),
        # 包含其他包的 launch（如 Nav2 官方 launch）
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(
                os.path.join(
                    get_package_share_directory('nav2_bringup'),
                    'launch', 'bringup_launch.py')),
        ),
        Node(
            package='py_demo', executable='display_node',
            output='screen',
        ),
    ])
```

**分层设计模式**：底层每个模块一个 launch（sensor.launch.py、nav.launch.py、arm.launch.py），顶层 main.launch.py 组合全部——类似"模块化 + 总装配"。

#### 5.3 组（GroupAction）

用 `GroupAction` 给一组节点统一设置条件/命名空间：

```python
from launch.actions import GroupAction

def generate_launch_description():
    return LaunchDescription([
        GroupAction(
            # 组内所有节点共享命名空间
            scoped=True, namespace='robot1',
            actions=[
                Node(package='py_demo', executable='py_talker', name='talker'),
                Node(package='py_demo', executable='py_subscriber', name='listener'),
            ],
        ),
    ])
```

### 六、外部进程与事件

#### 6.1 启动外部进程

launch 也可以启动非 ROS 命令（如打开 rviz2、启动仿真器）：

```python
# launch/process.launch.py
from launch import LaunchDescription
from launch.actions import ExecuteProcess
from launch_ros.actions import Node

def generate_launch_description():
    return LaunchDescription([
        Node(
            package='py_demo', executable='sensor_node',
            output='screen',
        ),
        # 启动 rviz2（非 ROS 节点进程）
        ExecuteProcess(
            cmd=['rviz2'],
            output='screen',
        ),
    ])
```

#### 6.2 事件处理器（高级）

用 `RegisterEventHandler` 实现"节点启动后执行动作"：

```python
from launch import LaunchDescription
from launch.actions import RegisterEventHandler, ExecuteProcess
from launch.event_handlers import OnProcessStart
from launch_ros.actions import Node

def generate_launch_description():
    sensor = Node(package='py_demo', executable='sensor_node', output='screen')

    # sensor 启动后，再启动显示节点（保证顺序）
    start_display_after_sensor = RegisterEventHandler(
        OnProcessStart(
            target_action=sensor,
            on_start=[
                Node(package='py_demo', executable='display_node', output='screen'),
            ],
        )
    )

    return LaunchDescription([
        sensor,
        start_display_after_sensor,
    ])
```

### 七、调试 launch

#### 7.1 常用命令

```bash
# 打印 launch 文件展开后的完整描述（不实际启动）
ros2 launch py_demo demo.launch.py --show-args
ros2 launch py_demo demo.launch.py --show-description

# 正常启动（Ctrl+C 可优雅关闭所有节点）
ros2 launch py_demo demo.launch.py

# 打印 launch 日志（debug 级别，排查"节点为什么没启动"）
ros2 launch py_demo demo.launch.py --log-level debug
```

#### 7.2 常见问题排查

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `Package 'xxx' not found` | launch 文件没安装 | 重新 `colcon build` 并 source |
| 节点启动但无输出 | 忘了 `output='screen'` | 加上 `output='screen'` |
| `LaunchConfiguration` 未定义 | 未先 DeclareLaunchArgument | 先声明再引用 |
| 参数没生效 | 参数名/节点名不匹配 | 检查 yaml 顶层节点名与 `name=` 一致 |
| launch 报语法错误 | Python 语法或 import 缺失 | 本地 `python3 xxx.launch.py` 先测语法 |
| Ctrl+C 后进程残留 | 未优雅退出 | launch 一般自动清理；残留用 `pkill -f 节点名` |

#### 7.3 launch 文件写法的工程建议

1.  **一个模块一个 launch**，顶层用 IncludeLaunchDescription 组合。
2.  **参数全部走 launch 参数**（DeclareLaunchArgument），不硬编码。
3.  **命名空间 + 重映射**支持多实例复用。
4.  用 `--show-description` 验证 launch 展开结果再实际启动。
5.  文件命名统一 `xxx.launch.py`，放 `launch/` 目录。

### 八、实战：一键启动机器人演示系统

#### 8.1 系统组成

模拟一个小型机器人演示系统：

```text
sensor_node       → 发布 /odom、/scan（模拟传感器）
robot_controller  → 订阅 /scan，发布 /cmd_vel（简单避障逻辑）
display_node      → 订阅 /odom、/cmd_vel，打印状态
rviz2             → 可视化（外部进程）
```

#### 8.2 传感器节点

```python
# py_demo/sensor_node.py
import rclpy, math
from rclpy.node import Node
from nav_msgs.msg import Odometry
from sensor_msgs.msg import LaserScan

class SensorNode(Node):
    def __init__(self):
        super().__init__('sensor_node')
        self.odom_pub = self.create_publisher(Odometry, 'odom', 50)
        self.scan_pub = self.create_publisher(LaserScan, 'scan', 10)
        self.create_timer(0.02, self.pub_odom)    # 50Hz
        self.create_timer(0.1, self.pub_scan)     # 10Hz
        self.t = 0.0

    def pub_odom(self):
        self.t += 0.02
        msg = Odometry()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = 'odom'
        msg.child_frame_id = 'base_link'
        msg.pose.pose.position.x = math.sin(self.t)
        msg.pose.pose.position.y = math.cos(self.t)
        self.odom_pub.publish(msg)

    def pub_scan(self):
        msg = LaserScan()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = 'laser'
        msg.angle_min = -3.14; msg.angle_max = 3.14
        msg.angle_increment = 0.01745
        msg.range_min = 0.1; msg.range_max = 10.0
        msg.ranges = [1.0 + 0.1*math.sin(i*0.3) for i in range(360)]
        self.scan_pub.publish(msg)

def main():
    rclpy.init()
    node = SensorNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

#### 8.3 控制器节点

```python
# py_demo/robot_controller.py —— 简单避障控制器
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import LaserScan
from geometry_msgs.msg import Twist

class RobotController(Node):
    def __init__(self):
        super().__init__('robot_controller')
        self.cmd_pub = self.create_publisher(Twist, 'cmd_vel', 10)
        self.scan_sub = self.create_subscription(
            LaserScan, 'scan', self.on_scan, 10)
        self.declare_parameter('avoid_distance', 0.5)

    def on_scan(self, msg):
        # 计算前方最近障碍
        n = len(msg.ranges)
        front = msg.ranges[n//2] if n > 0 else 10.0
        avoid = self.get_parameter('avoid_distance').value
        cmd = Twist()
        if front < avoid:
            cmd.linear.x = 0.0
            cmd.angular.z = 0.5    # 前方有障碍：原地转弯
        else:
            cmd.linear.x = 0.3     # 安全：直行
        self.cmd_pub.publish(cmd)

def main():
    rclpy.init()
    node = RobotController()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

#### 8.4 显示节点

```python
# py_demo/display_node.py
import rclpy
from rclpy.node import Node
from nav_msgs.msg import Odometry
from geometry_msgs.msg import Twist

class DisplayNode(Node):
    def __init__(self):
        super().__init__('display_node')
        self.odom_sub = self.create_subscription(Odometry, 'odom', self.on_odom, 50)
        self.cmd_sub = self.create_subscription(Twist, 'cmd_vel', self.on_cmd, 10)

    def on_odom(self, msg):
        self.get_logger().info(
            f'位姿: x={msg.pose.pose.position.x:.2f} y={msg.pose.pose.position.y:.2f}',
            throttle_duration_sec=1.0)     # 每秒最多打一条，防刷屏

    def on_cmd(self, msg):
        self.get_logger().info(f'指令: vx={msg.linear.x:.2f} wz={msg.angular.z:.2f}',
            throttle_duration_sec=1.0)

def main():
    rclpy.init()
    node = DisplayNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

#### 8.5 主 launch 文件

```python
# launch/robot_demo.launch.py
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, ExecuteProcess
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

def generate_launch_description():
    avoid_distance = LaunchConfiguration('avoid_distance')

    return LaunchDescription([
        DeclareLaunchArgument('avoid_distance', default_value='0.5'),
        Node(
            package='py_demo', executable='sensor_node',
            name='sensor_node', output='screen',
        ),
        Node(
            package='py_demo', executable='robot_controller',
            name='robot_controller', output='screen',
            parameters=[{'avoid_distance': avoid_distance}],
        ),
        Node(
            package='py_demo', executable='display_node',
            name='display_node', output='screen',
        ),
        ExecuteProcess(cmd=['rviz2'], output='screen'),
    ])
```

#### 8.6 一键启动

```bash
# 一条命令启动整个系统
ros2 launch py_demo robot_demo.launch.py

# 调整参数
ros2 launch py_demo robot_demo.launch.py avoid_distance:=1.0

# 另一个终端观察
ros2 node list          # 应看到 3 个节点
ros2 topic hz /odom     # 50Hz
ros2 topic hz /scan     # 10Hz
```

**预期结果**：一条命令拉起 3 个 ROS 节点 + rviz2；`Ctrl+C` 一次全部优雅关闭。这就是 launch 的工程价值——系统编排、一键启停、参数化复用。

### 九、总结

本篇文章系统掌握了 launch：最简多节点启动、参数传递（yaml/字典/launch 参数）、话题重映射、命名空间、条件控制、子 launch 包含、组与外部进程、事件处理器，以及调试技巧。实战中一键启动了完整的"传感器-控制-显示"机器人演示系统。

**关键要点回顾**：

1.  launch 文件 = Python 函数 `generate_launch_description()` 返回 `LaunchDescription`。
2.  `Node(package, executable, name, output)` 是核心动作；别忘了 `output='screen'`。
3.  参数三方式：parameters=[yaml]、parameters=[dict]、launch 参数（DeclareLaunchArgument + LaunchConfiguration）。
4.  重映射改话题名、命名空间隔离多实例，两者是复用的关键。
5.  `IfCondition`/`UnlessCondition` 条件启动；`IncludeLaunchDescription` 组合子 launch。
6.  launch 文件要安装（setup.py/CMakeLists），并用 `--show-description` 调试。

### 下一篇预告

下一篇进入 **常用工具详解**：系统掌握 `ros2` CLI 全家桶（node/topic/service/action/param/interface/pkg/daemon）、可视化工具 rqt（rqt_graph/rqt_console/rqt_tf_tree/rqt_reconfigure）、RViz2 基础使用、ros2 bag 数据录制回放，以及 tf2 工具基础。这些工具是 ROS2 开发调试的"眼睛和双手"，学完你将具备独立排障能力。
