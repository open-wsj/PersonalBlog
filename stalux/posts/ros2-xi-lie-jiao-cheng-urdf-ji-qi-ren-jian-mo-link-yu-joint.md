---
title: "ROS2系列教程：URDF机器人建模（link与joint）"
abbrlink: ros2-xi-lie-jiao-cheng-urdf-ji-qi-ren-jian-mo-link-yu-joint
date: "2026-09-06 10:17:46"
categories:
    - "ROS2"
tags: []
desc: "URDF 是一种 XML 格式的机器人描述文件，用树状结构描述机器人的物理组成：刚体（link）和关节（joint）。它回答三个问题：URDF 是 ROS1 时代的产物，被 ROS2 完整继承…"
---
## 本文是 ROS2 系列教程的第 16 篇

> 本文是 ROS2 系列教程的第 16 篇：URDF 机器人建模（link 与 joint）。上一篇我们吃透了 TF 树与多坐标系管理，但 TF 树的变换从哪来？答案是 **URDF**（Unified Robot Description Format，统一机器人描述格式）。URDF 用 XML 描述机器人的"骨骼"：每个刚体是 `link`，每个关节是 `joint`，关节即坐标系之间的变换。本篇系统讲解 link 与 joint 的每一个属性、六种关节类型、惯性/碰撞/视觉三件套，最终写出一个能在 RViz 中动起来的差速小车模型。学完你就能用代码描述任何一台机器人，为 Gazebo 仿真和 MoveIt2 机械臂打基础。

### 一、URDF 是什么

#### 1.1 一句话定义

URDF 是一种 **XML 格式的机器人描述文件**，用树状结构描述机器人的物理组成：刚体（link）和关节（joint）。它回答三个问题：

1.  **长什么样**：每个刚体的 3D 网格、颜色、尺寸（视觉 visual）。
2.  **撞上去会怎样**：碰撞体（collision），用于 Gazebo 物理引擎和碰撞检测。
3.  **怎么动**：关节类型与运动范围（joint），机器人状态发布器据此广播 TF。

URDF 是 **ROS1 时代的产物，被 ROS2 完整继承**。官方标准文档在 [urdf](http://wiki.ros.org/urdf)（ROS 官方 wiki），ROS2 中由 `urdf` 包提供解析能力。注意 URDF **只能描述树状结构**——一个 link 只能有一个父 link，不能有环；复杂并联机构（如四足、并联机械臂）需要 Xacro 或改用 SDF，这是下一篇的内容。

#### 1.2 为什么机器人学先学 URDF

因为 **URDF 是 TF 树的"图纸"**：

-   `robot_state_publisher` 读取 URDF 中的 joint 值 → 计算每个 link 的位姿 → 发布 TF 和 `/joint_states`。
-   导航、MoveIt2、Gazebo 全都消费 URDF。
-   上一篇学的 TF 树（`map → odom → base_link → laser`）中，`base_link → laser`、`base_link → camera` 这些变换就写在 URDF 里。

用一句话串起前后文：**URDF 是静态蓝图，TF 是运行时的动态结果**。

#### 1.3 最小 URDF 骨架

一个最小的 URDF 文件长这样：

```xml
<?xml version="1.0"?>
<robot name="minimal_robot">
  <!-- 一个 base_link 刚体 -->
  <link name="base_link"/>
  <!-- 一个 link 只能有一个父，joint 连接父子 -->
  <joint name="base_to_laser" type="fixed">
    <parent link="base_link"/>
    <child link="laser"/>
    <origin xyz="0 0 0.2" rpy="0 0 0"/>
  </joint>
  <link name="laser"/>
</robot>
```

要点：

-   根元素 `<robot name="...">`，name 必填。
-   link 用 `name` 属性区分，全局唯一。
-   joint 的 `parent`/`child` 定义了父子关系，**坐标系变换方向是 parent → child**。
-   `<origin>` 定义子 link 在父 link 坐标系中的位姿（xyz 平移 + rpy 欧拉角）。

把这段保存为 `minimal.urdf`，后面我们会用工具验证它。

### 二、link：机器人的刚体

link 是机器人的"骨头"，它本身不运动，通过 joint 连接成树。一个完整的 link 包含三大部分：惯性、视觉、碰撞。

#### 2.1 惯性（inertial）

物理引擎（Gazebo）计算动力学时必须知道每个 link 的质量与转动惯量：

```xml
<link name="base_link">
  <inertial>
    <origin xyz="0 0 0" rpy="0 0 0"/>
    <mass value="2.0"/>                        <!-- 质量：千克 -->
    <inertia ixx="0.01" ixy="0.0" ixz="0.0"
             iyy="0.01" iyz="0.0" izz="0.01"/> <!-- 惯量张量：kg·m² -->
  </inertial>
</link>
```

-   `mass` 单位千克。
-   `inertia` 是 3×3 对称矩阵，只需填对角线（ixx/iyy/izz）和上三角（ixy/ixz/iyz）。
-   **导航/仿真前必须给每个 link 配惯性**，否则 Gazebo 会报 `No inertia specified` 警告；MoveIt2 的 IK 计算也需要。
-   惯量估算：立方体绕中心 `I = m(a²+b²)/12`；球 `I = 2mr²/5`；圆盘 `I = mr²/2`。不想算就先用接近值，仿真精度要求高时再精算。

#### 2.2 视觉（visual）

视觉只影响"显示"，不影响物理：

```xml
<link name="base_link">
  <visual>
    <origin xyz="0 0 0" rpy="0 0 0"/>
    <geometry>
      <box size="0.4 0.3 0.1"/>   <!-- 长方体：长 宽 高 -->
    </geometry>
    <material name="blue">
      <color rgba="0 0 1 1"/>      <!-- 红绿蓝透明度 -->
    </material>
  </visual>
</link>
```

geometry 支持四种基本形状：

| 形状 | 标签 | 参数 | 说明 |
| --- | --- | --- | --- |
| 长方体 | `<box>` | `size="L W H"` | 长宽高（米） |
| 圆柱 | `<cylinder>` | `radius` + `length` | 半径、长度（沿 z 轴） |
| 球体 | `<sphere>` | `radius` | 半径 |
| 网格 | `<mesh>` | `filename` + `scale` | 加载 STL/DAE 文件，仿真中常用 |

材质可以引用预定义的或内联定义：

```xml
<material name="blue">
  <color rgba="0 0 1 1"/>
</material>
<material name="blue2">
  <texture filename="textures/blue.png"/>   <!-- 可贴纹理 -->
</material>
```

#### 2.3 碰撞（collision）

碰撞体决定物理引擎做碰撞检测时用哪个形状，**建议用简单形状代替复杂网格**（速度快、稳定）：

```xml
<link name="base_link">
  <visual>
    <geometry>
      <mesh filename="package://my_robot/meshes/chassis.stl"/>
    </geometry>
  </visual>
  <collision>
    <origin xyz="0 0 0" rpy="0 0 0"/>
    <geometry>
      <box size="0.4 0.3 0.1"/>   <!-- 用盒子近似底盘 -->
    </geometry>
  </collision>
</link>
```

工程铁律：**visual 可以精美，collision 必须简单**。Gazebo 里 mesh 碰撞会显著拖慢物理仿真并引发抖动。

#### 2.4 三种子标签的关系

| 子标签 | 用途 | 物理引擎是否使用 | 建议 |
| --- | --- | --- | --- |
| inertial | 质量与惯量 | 是（动力学） | 必填，宁略大勿漏 |
| visual | 显示外观 | 否 | 可精美 |
| collision | 碰撞检测 | 是（碰撞） | 用基本形状 |

一个 link 可以不写任何子标签（如纯坐标系 link），但**参与运动的 link 建议三件套齐全**。

### 三、joint：机器人的关节

joint 连接两个 link 并定义二者之间的变换与运动。URDF 共 **六种关节类型**。

#### 3.1 六种类型速查

| 类型 | 自由度 | 说明 | 典型用途 |
| --- | --- | --- | --- |
| `fixed` | 0 | 固定连接，坐标系不变 | 传感器挂载、底盘与雷达 |
| `revolute` | 1（旋转） | 绕 z 轴旋转，有角度限制 | 轮子（驱动）、机械臂关节 |
| `prismatic` | 1（平移） | 沿 z 轴平移，有距离限制 | 伸缩滑台、升降柱 |
| `continuous` | 1（旋转） | 绕 z 轴无限旋转，无限制 | 万向轮、雷达转台 |
| `floating` | 6 | 六自由度自由运动 | 少见，仿真调试用 |
| `planar` | 3 | 平面内平移+旋转 | 少见，轮式平面移动 |

实际工程中 90% 用的是 **fixed + revolute + continuous** 三种。

#### 3.2 关节的标准写法

```xml
<joint name="left_wheel_joint" type="revolute">
  <parent link="base_link"/>
  <child link="left_wheel"/>
  <origin xyz="0.2 0.25 -0.05" rpy="0 0 0"/>   <!-- 相对父 link 的位姿 -->
  <axis xyz="0 1 0"/>                           <!-- 旋转轴（revolute/continuous 必填） -->
  <limit effort="10" velocity="1.0" lower="-3.14" upper="3.14"/>
</joint>
```

各子标签含义：

-   `<parent>` / `<child>`：两个 link 名，**父 link 在前**。
-   `<origin>`：child 坐标系在 parent 坐标系中的位姿。**注意**：`origin` 是相对父的，不是相对世界。
-   `<axis>`：revolute/continuous/prismatic 的旋转/平移轴，默认 z 轴（`0 0 1`）。
-   `<limit>`：`effort` 最大力矩（N·m）、`velocity` 最大速度（rad/s）、`lower`/`upper` 运动范围（rad 或 m）。**revolute 必填 lower/upper，prismatic 必填，continuous 不需要 limit**。
-   `<dynamics>`（可选）：`damping` 阻尼、`friction` 摩擦力。

#### 3.3 常见的坐标系方向坑

-   轮子绕 **y 轴**转（`axis="0 1 0"`）：车的 y 轴是侧向，轮子自转轴与车身侧向平行，这是差速车最常见配置。
-   机械臂关节绕 **z 轴**转（默认轴）：串联机械臂每个关节转轴对齐 child 坐标系的 z 轴。
-   雷达转台用 `continuous`（可 360° 无限转）。

#### 3.4 关节值与 TF 的关系

`robot_state_publisher` 订阅 `/joint_states`（`sensor_msgs/msg/JointState`）中的 `position`，用 `<origin>` + 当前关节角计算每个 link 的世界位姿，广播 TF。所以：

-   **joint 值 = 关节角度/位移**（`/joint_states`）。
-   **TF 变换 = 计算出的坐标系关系**（`/tf`）。
-   没有 `/joint_states` 时，固定关节照常广播，运动关节停在默认位置。

### 四、完整示例：差速小车 URDF

把上面的知识拼起来，写一个完整的差速小车：底盘 + 2 驱动轮 + 2 万向轮 + 激光雷达。

#### 4.1 完整 URDF 文件（demo_car.urdf）

```xml
<?xml version="1.0"?>
<robot name="demo_car">

  <!-- ===== 底盘 base_link ===== -->
  <link name="base_link">
    <inertial>
      <mass value="3.0"/>
      <inertia ixx="0.02" ixy="0.0" ixz="0.0" iyy="0.03" iyz="0.0" izz="0.02"/>
    </inertial>
    <visual>
      <geometry>
        <box size="0.45 0.30 0.12"/>
      </geometry>
      <material name="chassis_color">
        <color rgba="0.2 0.4 0.8 1"/>
      </material>
    </visual>
    <collision>
      <geometry>
        <box size="0.45 0.30 0.12"/>
      </geometry>
    </collision>
  </link>

  <!-- ===== 左驱动轮 ===== -->
  <link name="left_wheel">
    <inertial>
      <mass value="0.5"/>
      <inertia ixx="0.001" ixy="0.0" ixz="0.0" iyy="0.001" iyz="0.0" izz="0.001"/>
    </inertial>
    <visual>
      <geometry>
        <cylinder radius="0.08" length="0.03"/>
      </geometry>
      <material name="wheel_color">
        <color rgba="0.1 0.1 0.1 1"/>
      </material>
    </visual>
    <collision>
      <geometry>
        <cylinder radius="0.08" length="0.03"/>
      </geometry>
    </collision>
  </link>

  <!-- ===== 右驱动轮 ===== -->
  <link name="right_wheel">
    <inertial>
      <mass value="0.5"/>
      <inertia ixx="0.001" ixy="0.0" ixz="0.0" iyy="0.001" iyz="0.0" izz="0.001"/>
    </inertial>
    <visual>
      <geometry>
        <cylinder radius="0.08" length="0.03"/>
      </geometry>
      <material name="wheel_color2">
        <color rgba="0.1 0.1 0.1 1"/>
      </material>
    </visual>
    <collision>
      <geometry>
        <cylinder radius="0.08" length="0.03"/>
      </geometry>
    </collision>
  </link>

  <!-- ===== 激光雷达 ===== -->
  <link name="laser">
    <inertial>
      <mass value="0.2"/>
      <inertia ixx="0.0001" ixy="0.0" ixz="0.0" iyy="0.0001" iyz="0.0" izz="0.0001"/>
    </inertial>
    <visual>
      <geometry>
        <cylinder radius="0.05" length="0.06"/>
      </geometry>
      <material name="laser_color">
        <color rgba="0.9 0.2 0.2 1"/>
      </material>
    </visual>
    <collision>
      <geometry>
        <cylinder radius="0.05" length="0.06"/>
      </geometry>
    </collision>
  </link>

  <!-- ===== 万向轮（用 sphere 简化） ===== -->
  <link name="caster_front">
    <inertial>
      <mass value="0.1"/>
      <inertia ixx="0.0001" ixy="0.0" ixz="0.0" iyy="0.0001" iyz="0.0" izz="0.0001"/>
    </inertial>
    <visual>
      <geometry>
        <sphere radius="0.03"/>
      </geometry>
      <material name="caster_color">
        <color rgba="0.3 0.3 0.3 1"/>
      </material>
    </visual>
  </link>
  <link name="caster_back">
    <inertial>
      <mass value="0.1"/>
      <inertia ixx="0.0001" ixy="0.0" ixz="0.0" iyy="0.0001" iyz="0.0" izz="0.0001"/>
    </inertial>
    <visual>
      <geometry>
        <sphere radius="0.03"/>
      </geometry>
      <material name="caster_color2">
        <color rgba="0.3 0.3 0.3 1"/>
      </material>
    </visual>
  </link>

  <!-- ===== 关节定义 ===== -->
  <joint name="base_to_left_wheel" type="revolute">
    <parent link="base_link"/>
    <child link="left_wheel"/>
    <origin xyz="0.15 0.19 -0.06" rpy="0 0 0"/>
    <axis xyz="0 1 0"/>
    <limit effort="10" velocity="10.0" lower="-3.14" upper="3.14"/>
  </joint>

  <joint name="base_to_right_wheel" type="revolute">
    <parent link="base_link"/>
    <child link="right_wheel"/>
    <origin xyz="0.15 -0.19 -0.06" rpy="0 0 0"/>
    <axis xyz="0 1 0"/>
    <limit effort="10" velocity="10.0" lower="-3.14" upper="3.14"/>
  </joint>

  <joint name="base_to_laser" type="fixed">
    <parent link="base_link"/>
    <child link="laser"/>
    <origin xyz="0.1 0 0.12" rpy="0 0 0"/>
  </joint>

  <joint name="base_to_caster_front" type="fixed">
    <parent link="base_link"/>
    <child link="caster_front"/>
    <origin xyz="0.2 0 -0.06" rpy="0 0 0"/>
  </joint>

  <joint name="base_to_caster_back" type="fixed">
    <parent link="base_link"/>
    <child link="caster_back"/>
    <origin xyz="-0.2 0 -0.06" rpy="0 0 0"/>
  </joint>

</robot>
```

**坐标推导逻辑**（务必理解）：底盘厚 0.12 m、中心在原点，所以上表面 z=0.06、下表面 z=-0.06；车轮半径 0.08 m、轴心在 z=-0.06 处恰好贴地；激光雷达装在车头 x=0.1、顶部 z=0.12。

#### 4.2 命令行验证 URDF

把文件保存后，在终端验证：

```bash
# 1. 检查语法与结构（会列出所有 link/joint 及警告）
check_urdf demo_car.urdf

# 2. 生成树状结构图（需要 graphviz）
urdf_to_graphiz demo_car.urdf
```

输出应类似：

```text
robot name is: demo_car
---------- Successfully Parsed XML ---------------
root Link: base_link has 5 child(ren)
    child(1):  left_wheel
    child(2):  right_wheel
    child(3):  laser
    child(4):  caster_front
    child(5):  caster_back
```

如果报错（如 missing inertia、joint 找不到 parent），`check_urdf` 会明确指出行号与原因——这是建模阶段最常用的排障工具。

#### 4.3 用 C++ 检查 URDF（可选进阶）

```cpp
// urdf_check.cpp：用 urdf 库解析并打印 link/joint
#include <urdf_parser/urdf_parser.h>
#include <iostream>
#include <fstream>
#include <sstream>

int main(int argc, char** argv)
{
  if (argc < 2) {
    std::cerr << "用法: ./urdf_check <model.urdf>" << std::endl;
    return 1;
  }
  std::ifstream f(argv[1]);
  std::stringstream buf;
  buf << f.rdbuf();
  auto model = urdf::parseURDF(buf.str());
  if (!model) {
    std::cerr << "URDF 解析失败!" << std::endl;
    return 1;
  }
  std::cout << "机器人: " << model->getName() << std::endl;
  for (const auto& j : model->joints_) {
    auto jt = j.second;
    std::cout << "关节 " << jt->name << " 类型=" << jt->type
              << " 父=" << jt->parent_link_name
              << " 子=" << jt->child_link_name << std::endl;
  }
  return 0;
}
```

编译（CMakeLists 添加 `urdf` 依赖）：

```cmake
find_package(urdf REQUIRED)
target_link_libraries(urdf_check urdf::urdf)
```

运行：

```bash
ros2 run your_pkg urdf_check demo_car.urdf
```

### 五、让模型动起来：robot_state_publisher

URDF 只是静态描述，要"看到"并驱动它，需要 `robot_state_publisher` 发布 TF 和 `/joint_states`。

#### 5.1 C++ launch 文件（demo_car_display.launch.py）

```python
from launch import LaunchDescription
from launch_ros.actions import Node
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration, Command
import os
from ament_index_python.packages import get_package_share_directory

def generate_launch_description():
    pkg_share = get_package_share_directory('my_robot_description')
    urdf_file = os.path.join(pkg_share, 'urdf', 'demo_car.urdf')

    return LaunchDescription([
        DeclareLaunchArgument('use_sim_time', default_value='false'),
        Node(
            package='robot_state_publisher',
            executable='robot_state_publisher',
            parameters=[{'robot_description': Command(['cat ', urdf_file])}],
            output='screen'),
        Node(
            package='joint_state_publisher_gui',
            executable='joint_state_publisher_gui',
            output='screen'),
    ])
```

说明：

-   `robot_description` 参数用 `Command(['cat ', urdf_file])` 把文件内容读成字符串传给发布器。
-   `joint_state_publisher_gui` 提供滑块手动控制关节（revolute/continuous），方便调模型。
-   也可用无 GUI 的 `joint_state_publisher`（读固定值发布）。

#### 5.2 命令行替代（不写 launch 也行）

```bash
# 直接把 URDF 内容塞进参数启动
ros2 run robot_state_publisher robot_state_publisher \
  --ros-args -p robot_description:="$(cat demo_car.urdf)"

# 发布关节值（例如让左轮转到 1.0 rad）
ros2 topic pub /joint_states sensor_msgs/msg/JointState \
  "{header: {frame_id: ''}, name: [base_to_left_wheel], position: [1.0]}" \
  --rate 10
```

#### 5.3 在 RViz 中查看

```bash
ros2 launch my_robot_description demo_car_display.launch.py
rviz2
```

RViz 中添加：

1.  **RobotModel**：加载 URDF 显示 3D 模型。
2.  **TF**：查看坐标系（`base_link`、`left_wheel`、`laser`…）。
3.  在左侧 Global Options 把 Fixed Frame 设为 `base_link`。

如果你在 joint_state_publisher_gui 里拖动滑块，RViz 中对应关节会实时转动，TF 树也会变化——这就是"URDF 蓝图 → TF 运行时结果"的完整链路。

### 六、常见错误与排障清单

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `check_urdf` 报 joint 找不到 link | 拼写不一致或父子写反 | 检查 name 精确匹配，parent 是父 link |
| RViz 看不到模型 | `robot_description` 参数没传对 | `ros2 param get /robot_state_publisher robot_description` 确认非空 |
| 轮子转但车不动 | 只有 joint 值变化，没有驱动 base_link 的变换 | 轮子与底盘的连接正确时，TF 树自动传递；检查树 |
| Gazebo 报 No inertia | link 缺 `<inertial>` | 给所有 link 补 inertia |
| 模型上下颠倒 | origin 的 rpy 用错 | 检查各 joint origin 的欧拉角与几何位置 |
| 关节反了 | axis 方向相反 | 改 `<axis xyz="0 -1 0"/>` 或翻转 limit |
| RViz Fixed Frame 找不到 base_link | TF 未发布 | 确认 robot_state_publisher 在跑，`ros2 run tf2_ros tf2_echo base_link laser` 验证 |
| 激光在模型内部 | laser 的 origin 高度低于底盘上表面 | 把 laser 的 z 抬高到底盘厚度一半以上 |

### 七、小结与下一篇预告

**本篇核心**：

1.  **URDF 是机器人的 XML 蓝图**：link 描述刚体（惯性/视觉/碰撞），joint 描述关节与坐标系变换。
2.  **link 三件套**：inertial 必填（质量+惯量）、visual 只管好看、collision 用简单形状。
3.  **六种关节**：fixed/revolute/prismatic/continuous/floating/planar，工程常用前三种。
4.  **关节坐标系推导**：origin 相对父 link；轮子绕 y 轴、机械臂绕 z 轴。
5.  **URDF → TF 链路**：robot_state_publisher 读 URDF + `/joint_states` → 广播 TF。
6.  完整差速小车：5 link + 5 joint，`check_urdf` 验证，RViz 可视化。

下一篇进入 **Xacro 参数化建模**：URDF 写死重复代码多（两个轮子要复制两遍），Xacro 用宏和属性把它们抽象出来，还能用数学表达式计算位置——建模大型机器人（机械臂、六轮底盘）必备。URDF 是蓝图，Xacro 是蓝图生成器，两者结合才能高效建模。
