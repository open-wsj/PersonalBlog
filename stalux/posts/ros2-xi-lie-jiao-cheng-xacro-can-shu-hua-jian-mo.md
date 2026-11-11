---
title: "ROS2系列教程：Xacro参数化建模"
abbrlink: ros2-xi-lie-jiao-cheng-xacro-can-shu-hua-jian-mo
date: "2026-09-06 10:18:11"
categories:
    - "ROS2"
tags: []
desc: "回顾上一篇的差速小车，你实际感受到了：Xacro 是 URDF 的超集：一个合法的 Xacro 文件经过 命令展开后，得到的是标准 URDF。它新增的能力：ROS2 中 由同名包提供，启动时用…"
---
## 本文是 ROS2 系列教程的第 17 篇

> 本文是 ROS2 系列教程的第 17 篇：Xacro 参数化建模。上一篇我们用 URDF 写了一个差速小车，但你一定已经发现痛点：两个驱动轮的 link/joint 代码几乎一模一样，改一个轮径要改五处；机械臂 6 个关节更是噩梦。Xacro（XML Macros，XML 宏）就是为了消灭这种重复而生的。它在 URDF 之上增加宏、属性、数学表达式与条件分支，先"展开"成标准 URDF 再被下游工具消费。本篇讲透 Xacro 的三大法宝（属性/宏/表达式），把小车和六关节机械臂的建模效率提升一个数量级。学完你就能用十几行代码生成几百行 URDF。

### 一、为什么需要 Xacro

#### 1.1 URDF 的三大痛点

回顾上一篇的差速小车，你实际感受到了：

1.  **重复**：两个驱动轮各 40 行代码，几乎一样，只差 `name` 和 `origin` 的 y 值。
2.  **不可计算**：轮子轴心高度 `-0.06`、雷达高度 `0.12` 是手算的，一旦改底盘厚度，所有位置要重新心算。
3.  **不可参数化**：想生成"同一型号不同轮距"的多个变体，只能复制整个文件再手改。

#### 1.2 Xacro 是什么

Xacro 是 URDF 的**超集**：一个合法的 Xacro 文件经过 `xacro` 命令展开后，得到的是标准 URDF。它新增的能力：

| 能力 | 关键字 | 作用 |
| --- | --- | --- |
| 属性 | `<xacro:property>` | 定义常量，一处修改全局生效 |
| 宏 | `<xacro:macro>` | 定义可复用代码块，带参数 |
| 数学表达式 | `${...}` | 在属性值里做四则运算 |
| 条件分支 | `<xacro:if>` / `<xacro:unless>` | 按属性值决定是否输出某段 |

ROS2 中 `xacro` 由同名包提供，启动时用 `Command(['xacro ', xacro_file])` 展开（见 5.1 节）。

#### 1.3 展开命令

```bash
# 把 xacro 展开成 urdf
xacro demo_car.xacro > demo_car.urdf

# 传参展开（后面讲宏参数）
xacro robot.xacro wheel_radius:=0.10

# 直接打印到终端检查
xacro demo_car.xacro
```

`xacro` 展开不依赖 ROS 运行时，纯命令行即可调试。

### 二、属性（property）：消灭魔法数字

#### 2.1 基础用法

```xml
<?xml version="1.0"?>
<robot name="demo_car" xmlns:xacro="http://www.ros.org/wiki/xacro">

  <!-- 定义属性（写在 robot 标签内任意位置） -->
  <xacro:property name="chassis_length" value="0.45"/>
  <xacro:property name="chassis_width"  value="0.30"/>
  <xacro:property name="chassis_height" value="0.12"/>
  <xacro:property name="wheel_radius"   value="0.08"/>
  <xacro:property name="wheel_width"    value="0.03"/>
  <xacro:property name="wheel_base"     value="0.19"/>  <!-- 半轮距 -->
  <xacro:property name="chassis_mass"   value="3.0"/>

  <link name="base_link">
    <inertial>
      <mass value="${chassis_mass}"/>
      <inertia ixx="0.02" ixy="0" ixz="0" iyy="0.03" iyz="0" izz="0.02"/>
    </inertial>
    <visual>
      <geometry>
        <box size="${chassis_length} ${chassis_width} ${chassis_height}"/>
      </geometry>
    </visual>
  </link>
</robot>
```

`${...}` 里可以直接写表达式：

```xml
<!-- 轮子轴心 z = -底盘高/2（底面），车体在 z=0 -->
<xacro:property name="wheel_axis_z" value="${-chassis_height/2}"/>
```

#### 2.2 属性值类型

Xacro 属性自动按上下文解释，常用类型：

| 类型 | 写法 | 示例 |
| --- | --- | --- |
| 数字 | `value="0.45"` | 直接写 |
| 字符串 | `value="red"` | 直接写 |
| 布尔 | `value="true"` | true/false |
| 数学 | `${a+b}` | 加/减/乘/除/取模，支持括号嵌套 |

**注意**：`${}` 里的表达式用 Python 语法求值（Xacro 由 Python 实现），所以可以调用 `pi`、`cos` 等：

```xml
<xacro:property name="wheel_spacing" value="${2 * wheel_base}"/>
<xacro:property name="angle_90deg" value="${3.14159265 / 2}"/>
```

### 三、宏（macro）：一次定义，处处复用

宏是 Xacro 的核心。它把一段"模板"封装成带参数的可复用单元。

#### 3.1 宏的基本结构

```xml
<xacro:macro name="wheel" params="prefix side">
  <!-- 宏体内可直接用参数 -->
  <link name="${prefix}_wheel">
    <inertial>
      <mass value="0.5"/>
      <inertia ixx="0.001" ixy="0" ixz="0" iyy="0.001" iyz="0" izz="0.001"/>
    </inertial>
    <visual>
      <geometry>
        <cylinder radius="${wheel_radius}" length="${wheel_width}"/>
      </geometry>
    </visual>
    <collision>
      <geometry>
        <cylinder radius="${wheel_radius}" length="${wheel_width}"/>
      </geometry>
    </collision>
  </link>

  <joint name="base_to_${prefix}_wheel" type="revolute">
    <parent link="base_link"/>
    <child link="${prefix}_wheel"/>
    <origin xyz="0.15 ${side} ${wheel_axis_z}" rpy="0 0 0"/>
    <axis xyz="0 1 0"/>
    <limit effort="10" velocity="10" lower="-3.14" upper="3.14"/>
  </joint>
</xacro:macro>
```

#### 3.2 调用宏

```xml
<!-- 调用：传参后宏体会被展开成两个 wheel + 两个 joint -->
<xacro:wheel prefix="left"  side="${wheel_base}"/>
<xacro:wheel prefix="right" side="${-wheel_base}"/>
```

展开后等价于上一篇手写的两套 link/joint，但代码量从 80 行降到 20 行，且改 `wheel_radius` 一处全局生效。

#### 3.3 宏参数的高级用法

参数可以带默认值、可以是布尔：

```xml
<!-- 带默认值：不传 wheel_mass 时用 0.5 -->
<xacro:macro name="wheel" params="prefix side wheel_mass:=0.5">
  <link name="${prefix}_wheel">
    <inertial>
      <mass value="${wheel_mass}"/>
      ...
```

调用时按需覆盖：

```xml
<xacro:wheel prefix="left" side="${wheel_base}"/>
<xacro:wheel prefix="right" side="${-wheel_base}" wheel_mass:=1.2/>
```

#### 3.4 块参数（block）

宏还可以接受一段 XML 作为参数（类似函数回调），用于注入不同内容：

```xml
<xacro:macro name="sensor_mount" params="sensor_name block">
  <link name="${sensor_name}_mount">
    <visual>
      <geometry><box size="0.01 0.01 0.01"/></geometry>
    </visual>
  </link>
  <joint name="base_to_${sensor_name}_mount" type="fixed">
    <parent link="base_link"/>
    <child link="${sensor_name}_mount"/>
    <origin xyz="0.1 0 0.12" rpy="0 0 0"/>
  </joint>
  <!-- block 占位符：调用时传入的内容会插到这里 -->
  ${block}
</xacro:macro>

<!-- 调用：传入激光雷达 -->
<xacro:sensor_mount sensor_name="lidar">
  <link name="lidar">
    <visual>
      <geometry><cylinder radius="0.05" length="0.06"/></geometry>
    </visual>
  </link>
</xacro:sensor_mount>
```

### 四、条件与循环：让模型"长出来"

#### 4.1 xacro:if 条件包含

```xml
<xacro:property name="include_lidar" value="true"/>

<xacro:if value="${include_lidar}">
  <link name="lidar">
    <visual>
      <geometry><cylinder radius="0.05" length="0.06"/></geometry>
    </visual>
  </link>
</xacro:if>
```

`include_lidar=false` 时整段不输出。这在"同一个模型文件，仿真/真机/仅显示"切换时极其有用。

#### 4.2 用宏模拟循环

Xacro 没有原生 for 循环，但可以用"宏 + 参数"递归或直接调用多次。机械臂 6 个关节最实用的写法是**复用同一个关节宏**：

```xml
<xacro:macro name="revolute_link" params="name parent x y z axis_r axis_p axis_y">
  <link name="${name}">
    <inertial>
      <mass value="1.0"/>
      <inertia ixx="0.01" ixy="0" ixz="0" iyy="0.01" iyz="0" izz="0.01"/>
    </inertial>
    <visual>
      <geometry><box size="0.05 0.05 0.2"/></geometry>
    </visual>
  </link>
  <joint name="${parent}_to_${name}" type="revolute">
    <parent link="${parent}"/>
    <child link="${name}"/>
    <origin xyz="${x} ${y} ${z}" rpy="${axis_r} ${axis_p} ${axis_y}"/>
    <axis xyz="0 0 1"/>
    <limit effort="100" velocity="1.5" lower="-2.0" upper="2.0"/>
  </joint>
</xacro:macro>

<!-- 依次创建 6 个连杆 -->
<xacro:revolute_link name="link1" parent="base_link" x="0" y="0" z="0.2" axis_r="0" axis_p="0" axis_y="0"/>
<xacro:revolute_link name="link2" parent="link1" x="0" y="0" z="0.2" axis_r="0" axis_p="0" axis_y="0"/>
<xacro:revolute_link name="link3" parent="link2" x="0" y="0" z="0.2" axis_r="0" axis_p="0" axis_y="0"/>
<xacro:revolute_link name="link4" parent="link3" x="0" y="0" z="0.2" axis_r="0" axis_p="0" axis_y="0"/>
<xacro:revolute_link name="link5" parent="link4" x="0" y="0" z="0.2" axis_r="0" axis_p="0" axis_y="0"/>
<xacro:revolute_link name="link6" parent="link5" x="0" y="0" z="0.2" axis_r="0" axis_p="0" axis_y="0"/>
```

要生成 10 个关节？复制 4 行即可。这就是宏的威力。

### 五、完整示例：Xacro 版差速小车

#### 5.1 完整文件（demo_car.xacro）

```xml
<?xml version="1.0"?>
<robot name="demo_car" xmlns:xacro="http://www.ros.org/wiki/xacro">

  <!-- ===== 全局属性 ===== -->
  <xacro:property name="chassis_length" value="0.45"/>
  <xacro:property name="chassis_width"  value="0.30"/>
  <xacro:property name="chassis_height" value="0.12"/>
  <xacro:property name="chassis_mass"   value="3.0"/>
  <xacro:property name="wheel_radius"   value="0.08"/>
  <xacro:property name="wheel_width"    value="0.03"/>
  <xacro:property name="wheel_mass"     value="0.5"/>
  <xacro:property name="wheel_base"     value="0.19"/>
  <xacro:property name="wheel_axis_z"   value="${-chassis_height/2}"/>
  <xacro:property name="laser_z"        value="${chassis_height/2}"/>
  <xacro:property name="include_lidar"  value="true"/>

  <!-- ===== 底盘 ===== -->
  <link name="base_link">
    <inertial>
      <mass value="${chassis_mass}"/>
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
        <mass value="${wheel_mass}"/>
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

  <!-- ===== 调用轮子宏 ===== -->
  <xacro:wheel side="1"/>
  <xacro:wheel side="-1"/>

  <!-- ===== 激光雷达（条件包含） ===== -->
  <xacro:if value="${include_lidar}">
    <link name="lidar">
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
    </link>
    <joint name="base_to_lidar" type="fixed">
      <parent link="base_link"/>
      <child link="lidar"/>
      <origin xyz="0.1 0 ${laser_z}" rpy="0 0 0"/>
    </joint>
  </xacro:if>

  <!-- ===== 万向轮（球） ===== -->
  <xacro:macro name="caster" params="side front">
    <link name="caster_${front}_${side}">
      <inertial>
        <mass value="0.1"/>
        <inertia ixx="0.0001" ixy="0" ixz="0" iyy="0.0001" iyz="0" izz="0.0001"/>
      </inertial>
      <visual>
        <geometry>
          <sphere radius="0.03"/>
        </geometry>
        <material name="gray"><color rgba="0.3 0.3 0.3 1"/></material>
      </visual>
    </link>
    <joint name="base_to_caster_${front}_${side}" type="fixed">
      <parent link="base_link"/>
      <child link="caster_${front}_${side}"/>
      <origin xyz="${front * 0.2} ${side * 0.1} ${wheel_axis_z}" rpy="0 0 0"/>
    </joint>
  </xacro:macro>

  <xacro:caster front="1" side="1"/>
  <xacro:caster front="1" side="-1"/>
  <xacro:caster front="-1" side="1"/>
  <xacro:caster front="-1" side="-1"/>

</robot>
```

#### 5.2 展开并验证

```bash
# 1. 展开成 URDF
xacro demo_car.xacro > demo_car.urdf

# 2. 用 check_urdf 验证结构
check_urdf demo_car.urdf
```

预期输出：

```text
robot name is: demo_car
---------- Successfully Parsed XML ---------------
root Link: base_link has 7 child(ren)
    child(1):  wheel_1
    child(2):  wheel_-1
    child(3):  lidar
    child(4):  caster_1_1
    ...
```

**对比记忆**：手写 URDF 版约 150 行，Xacro 版约 90 行且更易维护；若再加一个相机，只需 10 行。

#### 5.3 在 RViz 中查看（复用 launch）

```python
# display.launch.py
from launch import LaunchDescription
from launch_ros.actions import Node
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration, Command
import os
from ament_index_python.packages import get_package_share_directory

def generate_launch_description():
    pkg_share = get_package_share_directory('my_robot_description')
    xacro_file = os.path.join(pkg_share, 'urdf', 'demo_car.xacro')

    return LaunchDescription([
        DeclareLaunchArgument('use_sim_time', default_value='false'),
        Node(
            package='robot_state_publisher',
            executable='robot_state_publisher',
            # 关键：用 xacro 命令展开
            parameters=[{'robot_description': Command(['xacro ', xacro_file])}],
            output='screen'),
        Node(
            package='joint_state_publisher_gui',
            executable='joint_state_publisher_gui',
            output='screen'),
    ])
```

```bash
ros2 launch my_robot_description display.launch.py
rviz2   # 添加 RobotModel + TF，Fixed Frame = base_link
```

#### 5.4 命令行传参切换配置

把 `include_lidar` 设为 launch 参数，实现"一个文件多种配置"：

```python
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration, Command

def generate_launch_description():
    include_lidar = LaunchConfiguration('include_lidar', default='true')

    return LaunchDescription([
        DeclareLaunchArgument('include_lidar', default_value='true'),
        Node(
            package='robot_state_publisher',
            executable='robot_state_publisher',
            parameters=[{'robot_description': Command(
                ['xacro ', os.path.join(pkg_share, 'urdf', 'demo_car.xacro'),
                 ' include_lidar:=', include_lidar])}],
            output='screen'),
    ])
```

启动：

```bash
# 带激光雷达
ros2 launch my_robot_description display.launch.py

# 不带（仿真场景切换）
ros2 launch my_robot_description display.launch.py include_lidar:=false
```

### 六、Xacro 常见坑与排障

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `xacro` 报 `NameError: name 'x' is not defined` | `${}` 里引用未定义属性 | 检查属性名拼写与定义顺序（先定义后使用） |
| `${}` 里写字符串比较出错 | 值被当成数字 | 数字/字符串要类型匹配，布尔用 `${true}` |
| 宏参数传不进去 | 调用时属性名写错或没加 `:=` | 默认值参数用 `param:=value` 覆盖 |
| 展开后 link 重复 | 宏内写死了 name | name 必须用 `${参数}` 拼接，保证唯一 |
| `check_urdf` 报 joint 缺 parent | 宏展开顺序问题 | 检查宏调用时 parent 名称是否已生成 |
| 模型显示但关节不动 | joint_state_publisher 未跑 | 启动 GUI 版或手动发 `/joint_states` |
| 中文注释在展开时报错 | 编码问题 | 文件用 UTF-8 保存，避免特殊字符 |

#### 6.1 调试技巧：局部展开

```bash
# 只展开不写文件，直接看某段 XML 是否正确
xacro demo_car.xacro | grep -A 10 'link name="lidar"'
```

#### 6.2 版本提醒

ROS2 Humble 自带 `xacro`（Python 实现）。若你手动安装过旧版，注意 `xacro --help` 确认命令存在；launch 里 `Command(['xacro ', file])` 前确保 `xacro` 在 PATH。

### 七、小结与下一篇预告

**本篇核心**：

1.  **Xacro 是 URDF 的超集**：先展开成 URDF 再消费，解决重复/不可计算/不可参数化三大痛点。
2.  **属性 property**：常量 + `${}` 数学表达式，一处修改全局生效。
3.  **宏 macro**：带参数复用代码块，`params` 支持默认值与块参数；机械臂 6 关节用宏写只需 6 行调用。
4.  **条件 if**：`include_lidar:=false` 实现同文件多配置。
5.  **工程闭环**：`xacro → check_urdf → robot_state_publisher → RViz`，launch 里用 `Command(['xacro ', file])` 展开。
6.  从 URDF 手写 150 行降到 Xacro 90 行，可维护性显著提升。

下一篇进入 **Gazebo 仿真基础与世界搭建**：URDF/Xacro 描述好了"骨骼"，Gazebo 提供"物理世界"——重力、摩擦、碰撞、传感器仿真都在这里。我们会把小车放进 Gazebo，搞定 world 文件、`spawn_entity` 与 gazebo_ros 插件，让小车在虚拟世界里跑起来。蓝图已成，物理引擎接管。
