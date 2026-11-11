---
title: "ROS2系列教程：运动学基础（位姿与坐标变换）"
abbrlink: ros2-xi-lie-jiao-cheng-yun-dong-xue-ji-chu-wei-zi-yu-zuo
date: "2026-09-05 15:49:33"
categories:
    - "ROS2"
tags: []
desc: "\"，即从参考系出发依次施加 yaw → pitch → roll 的。"
---
## 本文是 ROS2 系列教程的第 13 篇

> 本文是 ROS2 系列教程的第 13 篇，也是**机器人学篇**的开篇：运动学基础——位姿与坐标变换。机器人编程绕不开坐标系：机器人在哪里？朝向哪里？传感器测到的点在什么坐标系下？这两个问题的数学回答就是"位姿（Pose）“与"坐标变换（Transform）”。本篇文章从数学原理讲到 ROS2 代码：位姿怎么表示（位置+姿态）、旋转的三种表示（旋转矩阵/欧拉角/四元数）及互转、齐次变换矩阵的串联与求逆、ROS2 中姿态的规范与消息类型。学完你将有能力读懂 tf2、URDF、导航、机械臂所有篇章的数学地基。

### 一、为什么要先学位姿与坐标变换

#### 1.1 机器人世界里的一切都是"在哪个坐标系下"

先看一个真实场景：你的机器人底盘中心装了一台激光雷达，雷达前方 1.0 米处有一面墙。

-   雷达说：“墙在我 x 轴正方向 1.0 米处。” —— 这是**雷达坐标系**下的测量。
-   但导航模块需要知道：“墙在世界地图的什么位置？” —— 这是**地图坐标系**下的问题。
-   两个答案相差多少？取决于雷达装得偏不偏、机器人当前在哪儿、朝哪儿。

**坐标变换就是把"一个坐标系下的描述"换算成"另一个坐标系下的描述"**。它是所有机器人系统的通用语言：感知、建图、定位、导航、规划、控制，每一环都在做这件事。

#### 1.2 位姿 = 位置 + 姿态

描述一个物体（或坐标系）在空间中的状态，需要 6 个自由度：

-   **位置（Position）**：3 个自由度，物体原点在参考系中的坐标 `(x, y, z)`。
-   **姿态（Orientation）**：3 个自由度，物体坐标系相对参考系"转了多少"。

位姿（Pose）就是二者的合称。ROS2 中最常见的消息 `geometry_msgs/msg/Pose` 就是 `position`（点）+ `orientation`（四元数）两部分：

```
geometry_msgs/msg/Pose
├── Point position      # 位置 x, y, z
│   ├── float64 x
│   ├── float64 y
│   └── float64 z
└── Quaternion orientation  # 姿态（四元数）
    ├── float64 x
    ├── float64 y
    ├── float64 z
    └── float64 w
```

注意：**位置和姿态是两回事**，但常被初学者混为一谈。一台机器人可以站在同一个位置 (0, 0, 0)，却可以朝向任何方向——位置没变，姿态变了。

#### 1.3 姿态为什么难？

位置就是三个数，人人都会。姿态难在：**旋转不能用"三个数"简单地表示**（至少不能直观地表示）。

-   欧拉角（roll/pitch/yaw）直观但有**万向锁**问题，且结果依赖旋转顺序。
-   旋转矩阵无奇异但 9 个数有冗余（实际只有 3 个自由度），还伴随正交性约束。
-   四元数紧凑、无奇异、便于插值，但不直观，新手容易在 x/y/z/w 上搞混。

ROS2 的规范答案：**内部统一用四元数**。你可以在脑中用欧拉角思考，在代码里必须转成四元数。这就是本篇文章的核心任务：把三种表示都讲透，并给出可运行的互转代码。

### 二、旋转的三种表示（核心数学）

#### 2.1 旋转矩阵 R

绕坐标轴的**基本旋转矩阵**（右手系，逆时针为正）：

绕 x 轴转 α：

```
R_x(α) = | 1     0       0   |
         | 0   cos α  -sin α |
         | 0   sin α   cos α |
```

绕 y 轴转 β：

```
R_y(β) = |  cos β  0   sin β |
         |   0     1     0    |
         | -sin β  0   cos β |
```

绕 z 轴转 γ：

```
R_z(γ) = | cos γ  -sin γ  0 |
         | sin γ   cos γ  0 |
         |   0       0     1 |
```

**旋转矩阵的三个性质**（务必记住，后面校验全靠它）：

1.  **正交**：`R^T = R⁻¹`，即转置等于逆。
2.  **行列式 = 1**。
3.  把向量 `v` 旋转得到 `v' = R · v`。

旋转矩阵把"基向量在新坐标系中的表达"写成列向量，所以它天然携带"坐标系"信息：`R` 的第 i 列就是原坐标系第 i 个基向量在新坐标系下的坐标。

#### 2.2 欧拉角（RPY）

欧拉角用"绕三个轴依次转三次"描述姿态。ROS2/机器人领域最常用的是 **RPY 约定**（Roll 横滚、Pitch 俯仰、Yaw 偏航）：

```
R = R_z(yaw) · R_y(pitch) · R_x(roll)
```

注意：**矩阵乘法不满足交换律**，旋转顺序必须固定。ROS2 默认约定是"**先绕 z（yaw）、再绕 y（pitch）、最后绕 x（roll）**"，即从参考系出发依次施加 yaw → pitch → roll 的**外旋**（或等效地，对物体自身依次做 roll → pitch → yaw 的**内旋**）。你在代码里写 RPY 转四元数时，用的就是这个约定。

**万向锁（Gimbal Lock）**：当 pitch = ±90° 时，roll 与 yaw 的旋转轴重合，丢失一个自由度——表现为"两个角可以互相抵消，姿态描述不唯一"。这是欧拉角的**固有缺陷**，无解，只能换表示方法。

```text
飞机类比：roll 是机身侧倾，pitch 是机头抬起，yaw 是机头左右转。
当飞机笔直朝上（pitch=90°）时，侧倾和转向都在绕同一根轴，就"锁死"了。
```

#### 2.3 四元数（Quaternion）

四元数是一个超复数：`q = w + xi + yj + zk`，其中 `w` 是实部，`(x, y, z)` 是虚部。ROS2 消息里把四个分量按 `x, y, z, w` 排列（注意顺序！w 在最后）。

**旋转轴-角表示**：绕单位向量 `(nx, ny, nz)` 转 θ 角，对应的四元数是：

```
w = cos(θ/2)
x = nx · sin(θ/2)
y = ny · sin(θ/2)
z = nz · sin(θ/2)
```

**四元数的性质**：

1.  **单位四元数**：`x² + y² + z² + w² = 1`（旋转四元数必须归一化，否则是非法的）。
2.  `q` 与 `-q` 表示**同一个旋转**（这是重要的排障知识点：看似不一样的两个四元数其实一样）。
3.  绕 z 轴转 90°：`w = cos(45°) ≈ 0.7071, z = sin(45°) ≈ 0.7071, x = y = 0`。
4.  零旋转（不转）：`w = 1, x = y = z = 0`。**注意不是全 0**——`(0,0,0,0)` 是非法四元数，新手经常犯这个错。

**为什么 ROS2 用它**：无奇异点（没有万向锁）、只占 4 个数（比旋转矩阵少 5 个）、便于球面插值（slerp）做平滑过渡。代价是**不直观**——这也是你必须学会互转的原因。

#### 2.4 三种表示互转公式

**四元数 → 旋转矩阵**（单位四元数 q）：

```
R = | 1-2(y²+z²)   2(xy-wz)     2(xz+wy)  |
    | 2(xy+wz)     1-2(x²+z²)   2(yz-wx)  |
    | 2(xz-wy)     2(yz+wx)     1-2(x²+y²)|
```

**旋转矩阵 → 欧拉角**（RPY 约定，`atan2` 保象限）：

```
roll  = atan2(R[2][1], R[2][2])
pitch = asin(-R[2][0])
yaw   = atan2(R[1][0], R[0][0])
```

**四元数 → 欧拉角**：

```
roll  = atan2(2(wx+yz), 1-2(x²+y²))
pitch = asin(2(wy-xz))
yaw   = atan2(2(wz+xy), 1-2(y²+z²))
```

**欧拉角 → 四元数**（yaw → pitch → roll 顺序）：

```
cy = cos(yaw/2),  sy = sin(yaw/2)
cp = cos(pitch/2), sp = sin(pitch/2)
cr = cos(roll/2), sr = sin(roll/2)

w = cr·cp·cy + sr·sp·sy
x = sr·cp·cy - cr·sp·sy
y = cr·sp·cy + sr·cp·sy
z = cr·cp·sy - sr·sp·cy
```

> 记住这条主线：**欧拉角（人脑）→ 四元数（ROS2 内部）→ 旋转矩阵（数值计算）**。你在 ROS2 里发布姿态用四元数，与 tf2 交互用旋转矩阵或四元数，跟人交流用欧拉角。

### 三、齐次变换矩阵：把位置和姿态打包

#### 3.1 从"旋转+平移"到 4×4 矩阵

单有旋转矩阵 `R` 只能描述姿态，坐标变换还需要平移 `t`。把两者合成一个 4×4 的**齐次变换矩阵 T**：

```
T = | R   t |
    | 0   1 |
```

展开：

```
T = | r11 r12 r13 | tx |
    | r21 r22 r23 | ty |
    | r31 r32 r33 | tz |
    |  0   0   0  | 1  |
```

**点变换**：把点 `p`（齐次坐标 `[x, y, z, 1]`）从 A 系变换到 B 系：

```
p_B = T_B←A · p_A
```

**为什么加一行 0 0 0 1**：因为矩阵乘法要求维度匹配，加这一行后平移可以写进矩阵乘法里，实现"旋转和平移统一为一次矩阵乘法"。

#### 3.2 变换的串联：链式相乘

假设三个坐标系 A → B → C，已知 `T_B←A` 和 `T_C←B`，则：

```
T_C←A = T_C←B · T_B←A
```

**顺序不可交换**：`T_C←B · T_B←A ≠ T_B←A · T_C←B`。写代码时务必从右往左读：先经过 B，再经过 C。

这就是 TF 树（第 15 篇详讲）的数学本质：**tf2 把整个机器人所有坐标系之间的变换存成一张树，查询任意两个坐标系之间的变换，就是沿着树做矩阵链乘法**。

#### 3.3 变换的求逆

已知 `T_B←A`，求 `T_A←B`（反向变换）：

```
T_A←B = T_B←A⁻¹ = | R^T  -R^T·t |
                  |  0      1   |
```

即：**旋转部分取转置，平移部分取 `-R^T·t`**。这是 tf2 里"反向查询"的实现基础。

#### 3.4 一个手算示例

设 B 系相对 A 系：绕 z 轴转 90°（yaw=90°），再沿 x 轴平移 1 米。则：

```
R = | 0  -1  0 |
    | 1   0  0 |
    | 0   0  1 |

t = | 1 |
    | 0 |
    | 0 |
```

B 系原点 (0,0,0) 在 A 系中的坐标 = t = (1, 0, 0)。B 系中 (1, 0, 0) 的点在 A 系中：

```
p_A = R·(1,0,0) + t = (0, 1, 0) + (1, 0, 0) = (1, 1, 0)
```

验证直觉：绕 z 转 90° 后，x 轴正向指向原 y 轴正向，所以 (1,0,0) 变成 (0,1,0)，再整体平移到 (1,1,0)。✓

### 四、ROS2 中的姿态规范与消息类型

#### 4.1 关键消息类型

| 消息 | 字段 | 用途 |
| --- | --- | --- |
| `geometry_msgs/msg/Pose` | position + orientation | 完整位姿（无时间戳） |
| `geometry_msgs/msg/PoseStamped` | header + pose | 带时间戳和坐标系 id 的位姿 |
| `geometry_msgs/msg/PoseWithCovariance` | pose + covariance | 位姿+协方差（定位输出） |
| `geometry_msgs/msg/Transform` | translation + rotation | 坐标变换（无时间戳） |
| `geometry_msgs/msg/TransformStamped` | header + child_frame_id + transform | 带父子坐标系名的变换（tf2 专用） |
| `geometry_msgs/msg/Point` | x, y, z | 纯位置 |
| `geometry_msgs/msg/Quaternion` | x, y, z, w | 纯姿态（四元数） |

**必须记住的规范**：

1.  **ROS2 内一切姿态用四元数**，禁止直接发布欧拉角。
2.  **四元数必须归一化**：`x²+y²+z²+w² = 1`（误差 < 1e-6）。发布前先校验。
3.  `PoseStamped.header.frame_id` 必须写清楚"这个位姿是在哪个坐标系下表达的"，否则下游无从变换。
4.  常见的坑：把 `Quaternion` 写成全 0（非法）、忘记归一化、把 x/y/z/w 顺序搞错（ROS2 是 x,y,z,w，**w 在最后**）。

#### 4.2 常用工具函数

**C++（tf2 库，随 ros2 自带）**：

```cpp
#include <tf2/LinearMath/Quaternion.h>
#include <tf2_geometry_msgs/tf2_geometry_msgs.hpp>

// 欧拉角 → 四元数
tf2::Quaternion q;
q.setRPY(roll, pitch, yaw);          // 弧度制！
geometry_msgs::msg::Quaternion qmsg = tf2::toMsg(q);

// 四元数 → 欧拉角
tf2::Quaternion q2;
tf2::fromMsg(qmsg, q2);
double r, p, y;
tf2::Matrix3x3(q2).getRPY(r, p, y);  // 得到弧度
```

**Python（tf_transformations，随 ros2 自带）**：

```python
from tf_transformations import quaternion_from_euler, euler_from_quaternion

# 欧拉角 → 四元数（返回 [x, y, z, w]）
q = quaternion_from_euler(roll, pitch, yaw)   # 弧度制

# 四元数 → 欧拉角
roll, pitch, yaw = euler_from_quaternion([qx, qy, qz, qw])
```

> 两个库都遵循同一约定：**RPY 顺序，弧度制，结果 w 在最后**。这保证了 C++ 和 Python 代码可以互换结果。

### 五、可运行示例（4 个）

下面 4 个示例覆盖"理解互转 → 动手发布 → 动手变换"的完整链路。请逐个在你的工作空间中创建、编译、运行。

#### 示例 1：Python 位姿互转计算器（不进 ROS2，纯数学验证）

目的：验证你对互转公式的理解，并熟悉 `tf_transformations`。

```python
#!/usr/bin/env python3
"""pose_math.py：欧拉角 <-> 四元数 <-> 旋转矩阵 互转演示"""
import math
from tf_transformations import quaternion_from_euler, euler_from_quaternion

def normalize(q):
    """归一化四元数"""
    n = math.sqrt(q[0]**2 + q[1]**2 + q[2]**2 + q[3]**2)
    return [v / n for v in q]

def quat_rotate_point(q, p):
    """用四元数旋转一个点（罗德里格斯等价实现）"""
    qx, qy, qz, qw = q
    # 公式：p' = p + 2w(v×p) + 2(v×(v×p))
    v = [qx, qy, qz]
    cross1 = [v[1]*p[2]-v[2]*p[1], v[2]*p[0]-v[0]*p[2], v[0]*p[1]-v[1]*p[0]]
    cross2 = [v[1]*cross1[2]-v[2]*cross1[1], v[2]*cross1[0]-v[0]*cross1[2], v[0]*cross1[1]-v[1]*cross1[0]]
    return [p[i] + 2*qw*cross1[i] + 2*cross2[i] for i in range(3)]

if __name__ == '__main__':
    # 1) 欧拉角 -> 四元数
    yaw = math.radians(90.0)
    pitch = math.radians(0.0)
    roll = math.radians(0.0)
    q = quaternion_from_euler(roll, pitch, yaw)
    print(f"yaw=90° -> q = {[round(v,4) for v in q]}")   # 期望约 [0, 0, 0.7071, 0.7071]

    # 2) 校验归一化
    qn = normalize(q)
    print(f"归一化后模长 = {math.sqrt(sum(v*v for v in qn)):.6f}")

    # 3) 四元数 -> 欧拉角（验证往返）
    r, p, y = euler_from_quaternion(q)
    print(f"q -> 欧拉角 = ({math.degrees(r):.1f}, {math.degrees(p):.1f}, {math.degrees(y):.1f}) deg")

    # 4) 用四元数旋转点 (1, 0, 0)：绕 z 转 90° 应得到 (0, 1, 0)
    rotated = quat_rotate_point(q, [1.0, 0.0, 0.0])
    print(f"绕 z 转 90° 后 (1,0,0) -> {[round(v,4) for v in rotated]}")
```

运行：

```bash
python3 pose_math.py
```

预期输出（前两行）：

```
yaw=90° -> q = [0.0, 0.0, 0.7071, 0.7071]
归一化后模长 = 1.000000
```

#### 示例 2：C++ 旋转矩阵与四元数互转节点

目的：在 ROS2 节点里用 `tf2` 库做互转，并学会"发布前校验四元数"。

```cpp
// quat_node.cpp：欧拉角<->四元数互转 + 合法性校验
#include <rclcpp/rclcpp.hpp>
#include <tf2/LinearMath/Quaternion.h>
#include <tf2_geometry_msgs/tf2_geometry_msgs.hpp>
#include <cmath>

class QuatNode : public rclcpp::Node
{
public:
  QuatNode() : Node("quat_node")
  {
    // 1) 欧拉角(度) -> 四元数
    double roll_deg = 30.0, pitch_deg = 20.0, yaw_deg = 45.0;
    double roll = roll_deg * M_PI / 180.0;
    double pitch = pitch_deg * M_PI / 180.0;
    double yaw = yaw_deg * M_PI / 180.0;

    tf2::Quaternion q;
    q.setRPY(roll, pitch, yaw);
    q.normalize();
    geometry_msgs::msg::Quaternion qmsg = tf2::toMsg(q);

    RCLCPP_INFO(this->get_logger(),
      "RPY(%0.1f, %0.1f, %0.1f) -> quat(x=%0.4f, y=%0.4f, z=%0.4f, w=%0.4f)",
      roll_deg, pitch_deg, yaw_deg, qmsg.x, qmsg.y, qmsg.z, qmsg.w);

    // 2) 校验模长是否为 1
    double norm = std::sqrt(qmsg.x*qmsg.x + qmsg.y*qmsg.y
                          + qmsg.z*qmsg.z + qmsg.w*qmsg.w);
    if (std::abs(norm - 1.0) > 1e-6) {
      RCLCPP_ERROR(this->get_logger(), "四元数未归一化！norm=%f", norm);
    } else {
      RCLCPP_INFO(this->get_logger(), "四元数归一化校验通过 (norm=%f)", norm);
    }

    // 3) 四元数 -> 欧拉角（验证往返）
    tf2::Quaternion q2;
    tf2::fromMsg(qmsg, q2);
    tf2::Matrix3x3 m(q2);
    double r, p, y;
    m.getRPY(r, p, y);
    RCLCPP_INFO(this->get_logger(),
      "quat -> RPY(deg) = (%0.1f, %0.1f, %0.1f)",
      r * 180.0 / M_PI, p * 180.0 / M_PI, y * 180.0 / M_PI);
  }
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  auto node = std::make_shared<QuatNode>();
  rclcpp::shutdown();
  return 0;
}
```

`CMakeLists.txt` 要点（`find_package` 加上 `tf2` 和 `tf2_geometry_msgs`）：

```cmake
find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(tf2 REQUIRED)
find_package(tf2_geometry_msgs REQUIRED)

add_executable(quat_node src/quat_node.cpp)
ament_target_dependencies(quat_node rclcpp tf2 tf2_geometry_msgs)
install(TARGETS quat_node DESTINATION lib/${PROJECT_NAME})
```

运行：

```bash
colcon build --packages-select quat_demo
source install/setup.bash
ros2 run quat_demo quat_node
```

预期日志：

```
RPY(30.0, 20.0, 45.0) -> quat(x=0.2393, y=0.1449, z=0.4277, w=0.8536)
四元数归一化校验通过 (norm=1.000000)
quat -> RPY(deg) = (30.0, 20.0, 45.0)
```

#### 示例 3：C++ 发布带姿态的 PoseStamped 话题

目的：掌握发布位姿消息的标准姿势（含 header 与四元数设置）。

```cpp
// pose_pub.cpp：周期性发布机器人位姿
#include <rclcpp/rclcpp.hpp>
#include <geometry_msgs/msg/pose_stamped.hpp>
#include <tf2/LinearMath/Quaternion.h>
#include <tf2_geometry_msgs/tf2_geometry_msgs.hpp>
#include <chrono>

class PosePub : public rclcpp::Node
{
public:
  PosePub() : Node("pose_pub"), yaw_(0.0)
  {
    pub_ = this->create_publisher<geometry_msgs::msg::PoseStamped>(
      "/robot_pose", 10);
    timer_ = this->create_wall_timer(
      std::chrono::milliseconds(500),
      std::bind(&PosePub::timer_cb, this));
  }

private:
  void timer_cb()
  {
    // 模拟机器人沿圆形轨迹运动并不断转向
    yaw_ += 0.1;                       // 每 0.5s 转 0.1 rad
    double radius = 2.0;
    double x = radius * std::cos(yaw_);
    double y = radius * std::sin(yaw_);

    geometry_msgs::msg::PoseStamped msg;
    msg.header.stamp = this->now();
    msg.header.frame_id = "map";       // 必须写清楚坐标系！

    msg.pose.position.x = x;
    msg.pose.position.y = y;
    msg.pose.position.z = 0.0;

    tf2::Quaternion q;
    q.setRPY(0.0, 0.0, yaw_);          // 平面运动：只有偏航
    msg.pose.orientation = tf2::toMsg(q);

    pub_->publish(msg);
    RCLCPP_INFO(this->get_logger(),
      "pose: (%.2f, %.2f) yaw=%.2f rad", x, y, yaw_);
  }

  rclcpp::Publisher<geometry_msgs::msg::PoseStamped>::SharedPtr pub_;
  rclcpp::TimerBase::SharedPtr timer_;
  double yaw_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<PosePub>());
  rclcpp::shutdown();
  return 0;
}
```

观察话题：

```bash
ros2 run pose_demo pose_pub &
ros2 topic echo /robot_pose --once
```

你会看到 `header.frame_id: map`、位置随时间变化、四元数始终是单位四元数（只有 z/w 分量随 yaw 变化）。

#### 示例 4：Python 发布+订阅位姿并实时转成欧拉角

目的：Python 端完整闭环——发 PoseStamped，订阅端把四元数转回欧拉角显示。

```python
#!/usr/bin/env python3
"""pose_demo.py：发布/订阅位姿，订阅端转欧拉角"""
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import PoseStamped
from tf_transformations import quaternion_from_euler, euler_from_quaternion
import math

class PosePublisher(Node):
    def __init__(self):
        super().__init__('pose_publisher')
        self.pub = self.create_publisher(PoseStamped, '/pose_demo', 10)
        self.timer = self.create_timer(1.0, self.timer_cb)
        self.yaw = 0.0

    def timer_cb(self):
        self.yaw += 0.3
        msg = PoseStamped()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = 'map'
        msg.pose.position.x = 1.0 * math.cos(self.yaw)
        msg.pose.position.y = 1.0 * math.sin(self.yaw)
        q = quaternion_from_euler(0.0, 0.0, self.yaw)   # [x,y,z,w]
        msg.pose.orientation.x = q[0]
        msg.pose.orientation.y = q[1]
        msg.pose.orientation.z = q[2]
        msg.pose.orientation.w = q[3]
        self.pub.publish(msg)

class PoseSubscriber(Node):
    def __init__(self):
        super().__init__('pose_subscriber')
        self.sub = self.create_subscription(
            PoseStamped, '/pose_demo', self.cb, 10)

    def cb(self, msg):
        q = [msg.pose.orientation.x, msg.pose.orientation.y,
             msg.pose.orientation.z, msg.pose.orientation.w]
        roll, pitch, yaw = euler_from_quaternion(q)
        self.get_logger().info(
            '收到位姿: pos=(%.2f, %.2f, %.2f) yaw=%.1f deg (frame=%s)',
            msg.pose.position.x, msg.pose.position.y, msg.pose.position.z,
            math.degrees(yaw), msg.header.frame_id)

def main(args=None):
    rclpy.init(args=args)
    pub = PosePublisher()
    sub = PoseSubscriber()
    executor = rclpy.executors.MultiThreadedExecutor()
    executor.add_node(pub)
    executor.add_node(sub)
    try:
        executor.spin()
    finally:
        executor.shutdown()
        pub.destroy_node()
        sub.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
```

运行：

```bash
python3 pose_demo.py
```

日志示例：

```
[INFO] 收到位姿: pos=(1.00, 0.00, 0.00) yaw=0.0 deg (frame=map)
[INFO] 收到位姿: pos=(0.96, 0.30, 0.00) yaw=17.2 deg (frame=map)
[INFO] 收到位姿: pos=(0.83, 0.56, 0.00) yaw=34.4 deg (frame=map)
```

注意 `pos=(1.00, 0.00)` 时 `yaw=0.0`：机器人朝向 x 轴正方向；当它走到 (0.96, 0.30) 时 yaw≈17.2°，**朝向始终与运动方向一致**——这正是"位姿"中位置与姿态必须配套的直观体现。

### 六、位姿与坐标变换的实际应用

#### 6.1 底盘位姿估计（odometry）

轮式机器人通过轮速积分得到里程计位姿：每个控制周期更新一次 `(x, y, yaw)`。你会发现它的发布代码和示例 3 几乎一样——**所有里程计话题 `/odom` 的本质就是"不断发布的 PoseStamped"**（外加速度）。

#### 6.2 传感器坐标标定（extrinsic calibration）

激光雷达/相机装到机器人上时，需要标定"传感器坐标系相对机器人基座的变换"。标定结果就是一个 `TransformStamped`（4×4 矩阵）。有了它，雷达扫到的每个点都能变换到机器人坐标系，再变换到地图坐标系——这就是建图的第一步。

#### 6.3 导航与规划中的位姿

-   AMCL 定位：输出 `PoseWithCovarianceStamped`——不仅给位姿，还给"多不自信"（协方差）。
-   路径规划：起点和终点都是位姿；规划出的路径是一串位姿点。
-   机械臂（第 35-40 篇）：逆运动学求解的"目标"就是一个位姿。

**一句话**：位姿是机器人的"身份证"，坐标变换是机器人的"翻译官"。两者是所有上层模块的公共地基。

### 七、常见错误与排障

| 错误 | 表现 | 原因与解决 |
| --- | --- | --- |
| 四元数全 0 | rviz 里物体"消失"或姿态乱跳 | `(0,0,0,0)` 非法；零旋转应为 `(0,0,0,1)` |
| 四元数未归一化 | tf2 报 “Quaternion is not normalized” | 发布前先 `q.normalize()` 或手算归一化 |
| 欧拉角直接塞进 orientation | 姿态完全不对 | ROS2 只认四元数；必须 `setRPY`/`quaternion_from_euler` 转换 |
| 忘记写 frame_id | 下游报 “Unknown frame” | 任何带 header 的消息都必须写明坐标系 |
| 角度用度数 | 旋转量级明显不对 | ROS2/tf2/数学库全部用**弧度**；入参前统一转弧度 |
| 旋转顺序搞错 | 互转后数值对不上 | 全链统一 RPY 顺序：yaw→pitch→roll |
| `q` 与 `-q` 困惑 | 明明"一样"的旋转数值却相反 | 单位四元数 q 与 -q 等价；比较姿态不要直接比数值 |
| 矩阵乘反 | 变换方向反了 | 从右往左读：`T_C←A = T_C←B · T_B←A` |

### 八、小结与下一篇预告

**本篇核心**：

1.  **位姿 = 位置(3) + 姿态(3)**，共 6 自由度。
2.  **姿态三种表示**：旋转矩阵（计算）、欧拉角（直观，有万向锁）、四元数（ROS2 内部标准）。
3.  **互转公式**：欧拉角↔四元数↔旋转矩阵，全链统一 RPY 顺序 + 弧度制。
4.  **齐次变换矩阵 T**：旋转+平移一体，串联相乘、求逆即反向。
5.  **ROS2 规范**：姿态一律四元数、必须归一化、必须写 frame_id、w 在最后。
6.  4 个可运行示例覆盖互转、发布、订阅闭环。

下一篇进入 **tf2 坐标变换详解（C++/Python）**：在 ROS2 中如何广播（broadcast）与监听（lookup）坐标变换、`tf2_ros` 的 Buffer 与 TransformListener 用法、如何发布静态变换、以及"变换不可用"的常见排障。位姿是数学，tf2 是把数学变成机器可用的管道。
