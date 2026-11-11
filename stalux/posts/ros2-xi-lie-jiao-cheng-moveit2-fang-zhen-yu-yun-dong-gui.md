---
title: "ROS2系列教程：Moveit2仿真与运动规划（基础）"
abbrlink: ros2-xi-lie-jiao-cheng-moveit2-fang-zhen-yu-yun-dong-gui
date: "2026-10-28 16:03:24"
categories:
    - "ROS2"
tags: []
desc: "本文是 ROS2 系列教程的第 36 篇：MoveIt2 仿真与运动规划（基础）。第 35 篇我们装好了 MoveIt2、写了一个两连杆机械臂的 URDF，并用…"
---
## 本文是 ROS2 系列教程的第 36 篇

> 本文是 ROS2 系列教程的第 36 篇：MoveIt2 仿真与运动规划（基础）。第 35 篇我们装好了 MoveIt2、写了一个两连杆机械臂的 URDF，并用 moveit_setup_assistant 生成了配置包。今天我们把机械臂"跑起来"：从 demo 启动开始，理解规划场景（Planning Scene）、运动规划请求/响应的数据结构，再用 Python 和 C++ 两种方式调用 move_group 完成"规划 + 执行"的完整闭环。本篇是 MoveIt2 阶段承上启下的一篇，第 37 篇将深入运动学。

### 一、从 demo 开始：把机械臂"跑起来"

#### 1.1 demo.launch.py 里发生了什么

上一篇文章生成的配置包 `arm_moveit_config` 里有一个 `launch/demo.launch.py`，一行命令就能把整套 MoveIt2 环境拉起来：

```bash
ros2 launch arm_moveit_config demo.launch.py
```

启动后你会看到：RViz 打开了 MoveIt 的 MotionPlanning 面板、机械臂模型显示在中央、一个半透明的"目标位姿"轴（Goal State）出现在末端。这条命令背后其实依次启动了五个东西：

```text
demo.launch.py 启动链
├── robot_state_publisher   # 发布 TF：base_link → tool0
├── joint_state_publisher_gui  # 手动拖动关节滑杆（RViz 面板里）
├── move_group 节点         # MoveIt2 的大脑
├── RViz + MotionPlanning 插件
└── Planning Scene Monitor  # 维护/同步规划场景
```

用 `ros2 node list` 能看到这些节点都在运行：

```bash
ros2 node list
# /joint_state_publisher_gui
# /move_group
# /robot_state_publisher
# /rviz2
```

其中 `/move_group` 是核心。它不是"一个程序"，而是一个 ROS 节点加一堆服务的集合：规划（plan）、执行（execute）、运动学（kinematics）、碰撞检测（collision）等能力全部以服务/动作接口的形式暴露出来，谁都能调用——包括你自己写的节点。

#### 1.2 RViz 里能做什么

RViz 左侧的 MotionPlanning 面板是这个阶段最重要的调试工具，从上到下是：

-   **Context**：显示当前使用的规划组（如 `arm_group`）、运动学求解器（KDL）、规划器（OMPL）。
-   **Planning**：选择 `arm_group`，点击 `Update` 会按当前 Goal State 重新规划；`Plan` 只规划不执行，`Plan & Execute` 规划并执行。
-   **Goal State / Start State**：可以用鼠标拖拽绿色的 Goal 轴到任意位置，再点 Plan。
-   **Scene Objects**：往规划场景里加盒子/圆柱等障碍物，MoveIt2 规划时会自动避让。
-   **Trajectory**：规划完以后显示路径上的各关节角度随时间变化的曲线。

初次使用建议做三个小实验：

```text
实验 1：把 Goal 轴拖到正前方 → 点 Plan → 看绿色轨迹
实验 2：在 Scene Objects 加一个盒子挡在路径上 → 再 Plan → 轨迹绕开
实验 3：点 Plan & Execute → 看 RViz 里机械臂真实"动"起来
```

注意：demo 模式下机械臂是"假动"——move_group 直接把关节轨迹发布到 `joint_states`，让 RViz 里的模型跟着动，底盘真实电机并没有转。真机控制要等第 40 篇对接 ros2_control。

#### 1.3 手动拖拽与碰撞检测

在 RViz 里用鼠标左键按住末端（tool0）附近的轴可以拖拽机械臂。此时 MoveIt2 每帧都在做两件事：

1.  **正运动学**：由当前关节角算出末端位姿（FK）。
2.  **碰撞检测**：用 FCL 库检查连杆之间、连杆与障碍物之间是否重叠。

拖到奇异点或自碰撞位置时，模型会"卡住"或变红提示。这个交互能力来自 MotionPlanning 插件的 **interactive marker**，它是 MoveIt2 入门阶段体验"规划"最直观的方式——你拖目标、它算路径。

### 二、运动规划的基础概念

#### 2.1 Planning Scene（规划场景）

规划场景是 MoveIt2 对"机器人周围世界"的完整描述，包含：

```text
PlanningScene 组成
├── 机器人模型（RobotModel：URDF + SRDF）
├── 当前关节状态（JointState）
├── 允许碰撞矩阵 ACM（哪些对允许碰撞）
├── 规划场景对象（障碍物：盒子/圆柱/网格/点云）
└── 变换树（世界坐标系 → 各 link）
```

move_group 内部维护一份"权威"规划场景，所有规划请求都基于它。如果你想让机械臂避开某个障碍物，就要先把障碍物"塞进"规划场景——后面 5.2 和 6.2 会给出代码。

#### 2.2 MotionPlanRequest 与 MotionPlanResponse

规划的本质是"给一个请求，返回一条轨迹"。MoveIt2 用两个消息描述这个过程：

```text
moveit_msgs/msg/MotionPlanRequest
├── group_name          # 规划组：arm_group
├── start_state         # 起始状态（默认=当前状态）
├── goal_constraints    # 目标约束（位姿约束/关节约束/位置约束）
├── trajectory_constraints  # 轨迹级约束（可空）
├── planner_id          # 指定规划器（默认 OMPL）
├── max_velocity_scaling_factor  # 速度缩放
└── max_acceleration_scaling_factor # 加速度缩放

moveit_msgs/msg/MotionPlanResponse
├── trajectory          # 关节空间轨迹（robot_trajectory）
├── planning_time       # 实际耗时
├── error_code          # 0=成功，其余为失败码
└── group_name
```

你可以直接调用 move_group 的 `/plan_kinematic_path` 服务拿到 `MotionPlanResponse`，也可以更简单地用 move_group 的高级接口（`MoveGroupInterface` / `MoveGroupCommander`），它们内部帮你填好了这些字段。

#### 2.3 Start State 与 Goal State

规划有两个端点：

-   **Start State**：默认取机器人当前关节角。也可以指定任意状态——比如"从某个预先录好的姿态开始规划"。
-   **Goal State**：描述"想到哪"，常见三种写法：

```text
1. 位姿约束（PoseConstraint）：末端 tool0 的 xyz + rpy 目标
2. 关节约束（JointConstraint）：每个关节的目标角度
3. 位置约束（PositionConstraint）：只约束位置、不管姿态
```

高级接口里对应的三个方法：`set_pose_target()`、`set_joint_value_target()`、`set_position_target()`。目标约束给得越"松"，规划越容易成功（约束太多容易无解）。

### 三、用 move_group 规划并执行（Python）

Python 侧用的是 `MoveGroupCommander`，封装在 `moveit_py`（Humble 是 `moveit_commander`）里。下面四个示例由浅入深，全部可直接运行。

#### 3.1 示例 1：连接到规划组并打印当前状态

```bash
# 先启动 demo（另开终端）
ros2 launch arm_moveit_config demo.launch.py
```

```python
#!/usr/bin/env python3
# ~/dev_ws/src/arm_demo/arm_demo/check_group.py
import rclpy
from moveit_commander import MoveGroupCommander, PlanningSceneInterface

def main():
    rclpy.init()
    node = rclpy.create_node('check_group')
    # 1. 连接规划组
    group = MoveGroupCommander('arm_group', node)
    # 2. 打印当前状态
    print('当前关节角度：', group.get_current_joint_values())
    print('当前末端位姿：\n', group.get_current_pose().pose)
    print('规划组关节列表：', group.get_active_joints())
    print('支持的运动学求解器：', group.get_interface_description())
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

```bash
# 运行（需要在 moveit_commander 包内或已安装）
ros2 run arm_demo check_group
```

运行后你会看到类似输出：当前关节角度是 `[0, 0, 0]`，末端位姿是 URDF 里定义的 `0.35` 米处的坐标。`get_active_joints()` 打印出规划组里真正能动的关节（不含 fixed joint）。

#### 3.2 示例 2：设置位姿目标并规划

```python
#!/usr/bin/env python3
# ~/dev_ws/src/arm_demo/arm_demo/plan_pose.py
import rclpy
from moveit_commander import MoveGroupCommander
from geometry_msgs.msg import Pose

def main():
    rclpy.init()
    node = rclpy.create_node('plan_pose')
    group = MoveGroupCommander('arm_group', node)

    # 1. 构造目标位姿：正前方 0.3m 处，tool0 竖直向下
    target = Pose()
    target.position.x = 0.30
    target.position.y = 0.0
    target.position.z = 0.25
    target.orientation.w = 1.0   # 单位四元数 = 无旋转

    # 2. 设置目标并规划
    group.set_pose_target(target, 'tool0')
    plan = group.plan()          # 返回计划对象（含轨迹）

    # 3. 检查结果
    if plan.joint_trajectory.points:
        print('规划成功！轨迹点数：', len(plan.joint_trajectory.points))
        first = plan.joint_trajectory.points[0]
        last = plan.joint_trajectory.points[-1]
        print('起点关节角：', first.positions)
        print('终点关节角：', last.positions)
    else:
        print('规划失败：目标不可达或无解')

    # 4. 显示在 RViz 里（只规划不执行）
    group.set_goal_tolerance(0.01)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

注意 `plan()` 在新版本 moveit_commander 里返回 `MoveItPyPlan` 对象（含 `joint_trajectory`），旧版本返回 `(success, trajectory_msg)` 元组。如果你跑的是旧版，改成：

```python
success, traj_msg = group.plan()
if success:
    print('规划成功')
```

#### 3.3 示例 3：规划并执行（完整闭环）

```python
#!/usr/bin/env python3
# ~/dev_ws/src/arm_demo/arm_demo/plan_execute.py
import rclpy
from moveit_commander import MoveGroupCommander

def main():
    rclpy.init()
    node = rclpy.create_node('plan_execute')
    group = MoveGroupCommander('arm_group', node)

    # 1. 回到 home 位形
    group.set_named_target('home')   # 来自 SRDF 里的 group_state
    group.go(wait=True)
    group.clear_pose_targets()

    # 2. 指定位姿并规划执行
    group.set_position_target([0.30, 0.0, 0.25])  # 只约束位置
    plan = group.plan()
    if getattr(plan, 'joint_trajectory', None) and plan.joint_trajectory.points:
        print('开始执行……')
        group.execute(plan, wait=True)
        print('执行完成！')
    else:
        print('规划失败')

    # 3. 回到 home
    group.set_named_target('home')
    group.go(wait=True)

    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

这里的 `group.go(wait=True)` 是"规划 + 执行"一步到位的快捷方式；`group.execute(plan)` 只执行已规划好的轨迹。`set_position_target` 只约束末端位置，姿态自由，规划成功率更高。

#### 3.4 示例 4：关节空间目标 + 速度缩放

```python
#!/usr/bin/env python3
# ~/dev_ws/src/arm_demo/arm_demo/plan_joints.py
import rclpy
from moveit_commander import MoveGroupCommander

def main():
    rclpy.init()
    node = rclpy.create_node('plan_joints')
    group = MoveGroupCommander('arm_group', node)

    # 1. 直接在关节空间设目标（3 个活动关节）
    group.set_joint_value_target([0.5, -0.8, 1.2])

    # 2. 慢速规划：速度/加速度都缩到 30%
    group.set_max_velocity_scaling_factor(0.3)
    group.set_max_acceleration_scaling_factor(0.3)

    # 3. 规划并执行
    success, traj = group.plan() if hasattr(group.plan(), '__len__') else (True, group.plan())
    group.go(wait=True)
    print('到达关节目标，当前关节角：', group.get_current_joint_values())

    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**速度缩放的作用**：规划出来的轨迹自带时间戳，缩放因子直接决定机械臂动得快慢。真机上先设 0.2~0.3 低速试跑，确认无碰撞再提速，是工程惯例。

### 四、C++ 方式：MoveGroupInterface

C++ 侧对应 `MoveGroupInterface` 类，接口名与 Python 高度对称。先建一个包：

```bash
ros2 pkg create arm_planner_cpp --build-type ament_cmake
```

#### 4.1 配置 CMakeLists.txt 与 package.xml

```cmake
# CMakeLists.txt（片段）
find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(moveit_ros_planning_interface REQUIRED)

add_executable(plan_pose src/plan_pose.cpp)
target_include_directories(plan_pose PRIVATE
  ${moveit_ros_planning_interface_INCLUDE_DIRS})
ament_target_dependencies(plan_pose rclcpp moveit_ros_planning_interface)

install(TARGETS plan_pose
  DESTINATION lib/${PROJECT_NAME})
ament_package()
```

```xml
<!-- package.xml（片段） -->
<depend>rclcpp</depend>
<depend>moveit_ros_planning_interface</depend>
<depend>moveit_msgs</depend>
```

#### 4.2 示例 5：C++ 规划并执行

```cpp
// src/plan_pose.cpp
#include <rclcpp/rclcpp.hpp>
#include <moveit/move_group_interface/move_group_interface.h>

int main(int argc, char** argv) {
  rclcpp::init(argc, argv);
  auto node = std::make_shared<rclcpp::Node>("arm_planner");
  auto executor = std::make_shared<rclcpp::executors::SingleThreadedExecutor>();
  executor->add_node(node);
  std::thread spin([&executor]() { executor->spin(); });

  using moveit::planning_interface::MoveGroupInterface;
  // 1. 连接规划组
  MoveGroupInterface group(node, "arm_group");

  // 2. 设置目标位姿
  geometry_msgs::msg::Pose target;
  target.position.x = 0.30;
  target.position.y = 0.0;
  target.position.z = 0.25;
  target.orientation.w = 1.0;
  group.setPoseTarget(target, "tool0");

  // 3. 规划
  moveit::planning_interface::MoveGroupInterface::Plan plan;
  bool ok = (group.plan(plan) == moveit::core::MoveItErrorCode::SUCCESS);
  if (!ok) {
    RCLCPP_ERROR(node->get_logger(), "规划失败");
  } else {
    RCLCPP_INFO(node->get_logger(), "规划成功，轨迹点数=%zu",
                plan.trajectory_.joint_trajectory.points.size());
    // 4. 执行
    group.execute(plan);
    RCLCPP_INFO(node->get_logger(), "执行完成");
  }

  // 5. 回到 home
  group.setNamedTarget("home");
  group.move();

  spin.join();
  rclcpp::shutdown();
  return 0;
}
```

注意：MoveGroupInterface 需要节点在 spin 状态才能收到规划结果，所以必须用 executor + 独立线程 spin。这是 C++ 写法最常见的坑。

#### 4.3 编译与运行

```bash
cd ~/dev_ws
colcon build --packages-select arm_planner_cpp
source install/setup.bash
ros2 run arm_planner_cpp plan_pose
```

运行前确保 demo 还在运行（move_group 在线）。输出类似：

```text
[INFO] 规划成功，轨迹点数=42
[INFO] 执行完成
```

### 五、轨迹与执行监控

#### 5.1 轨迹时间参数化

规划器（OMPL）输出的是"空间路径"——只有各关节角度序列，没有时间。move_group 在返回结果前会做 **Time Parameterization**，把路径加上速度/加速度约束，生成带 `time_from_start` 的轨迹：

```text
路径点（无时间） → 时间参数化 → 带时间轨迹
joint: [0, 0, 0]              t=0.0
joint: [0.1, -0.2, 0.3]       t=0.5
joint: [0.5, -0.8, 1.2]       t=2.1
```

时间参数化的参数来自 MoveIt2 配置：`ompl_planning.yaml` 里的 `max_velocity_scaling_factor`、`max_acceleration_scaling_factor`，以及机器人的速度限制（URDF 里 joint 的 `velocity` 属性）。真机上这两组数值直接决定电机的安全上限。

#### 5.2 执行监控：跟随与失败处理

`group.execute(plan, wait=True)` 背后是一个 Action 客户端，连到 move_group 的 `ExecuteTrajectory` action。执行过程中 move_group 会：

1.  把关节轨迹按时间轴逐段发布到 `/joint_trajectory_controller`（真机）或 `joint_states`（仿真）。
2.  用 `follow_joint_trajectory` 的反馈监控"实际到达位置 vs 期望位置"。
3.  偏差超过阈值时报错并中止（error_code 非 0）。

Python 里可以捕获执行状态：

```python
result = group.execute(plan, wait=True)
# 某些版本返回 MoveItPyPlan 对象，可检查 .error_code
```

#### 5.3 中断、重规划与容错

实践中轨迹执行常被打断（碰触、电机堵转、任务变化）。推荐模式：

```text
while 未到达目标:
    1. 检查当前状态（关节角/位姿）
    2. 调用 set_pose_target 重新规划
    3. 执行；若执行失败/超时 → 记录错误 → 返回步骤 1
    4. 连续失败 N 次 → 报警并回 home
```

这个"感知 → 规划 → 执行 → 校验"循环就是机器人任务控制的基本骨架，第 39 篇会把它扩成完整的抓取流程。

### 六、可视化与调试

#### 6.1 RViz MotionPlanning 面板常见设置

```text
1. 显示碰撞检测结果：Displays → MotionPlanning → 勾选 Collision
2. 显示规划场景对象：勾选 Scene Objects
3. 显示轨迹：勾选 Planned Path
4. 显示目标状态：勾选 Goal State
```

#### 6.2 向规划场景加障碍物（Python）

```python
#!/usr/bin/env python3
# ~/dev_ws/src/arm_demo/arm_demo/add_obstacle.py
import rclpy
from moveit_commander import PlanningSceneInterface
from shape_msgs.msg import SolidPrimitive
from geometry_msgs.msg import Pose

def main():
    rclpy.init()
    node = rclpy.create_node('add_obstacle')
    scene = PlanningSceneInterface(node)
    # 在机械臂正前方 0.35m 放一个 0.1m 的立方体
    box = {'box': (0.08, 0.08, 0.08)}
    scene.add_box('obstacle', box, Pose(
        position=[0.30, 0.0, 0.15]))
    node.get_logger().info('已添加障碍物 obstacle')
    rclpy.spin_once(node, timeout_sec=0.5)
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

加完障碍物后再去 RViz 里拖 Goal 到障碍物另一侧，你会发现规划轨迹自动绕行——这就是规划场景在起作用。

#### 6.3 常见问题速查

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| plan() 返回空轨迹 | 目标不可达/约束过紧 | 放宽位姿约束、降低目标高度、检查碰撞 |
| 规划成功但执行不动 | 速度缩放=0 或控制器未启 | 检查 set_max_velocity_scaling_factor，demo 下看 joint_states |
| RViz 里机械臂消失 | TF 未发布 | 检查 robot_state_publisher 是否在跑，`ros2 run tf2_ros tf2_echo base_link tool0` |
| execute 一直 wait | move_group 未收到动作 | 确认 demo 正常运行，`ros2 action list` 应有 execute_trajectory |
| 拖拽 Goal 时机械臂穿透 | 碰撞检测未生效 | 勾选 Collision 显示，检查 Planning Scene 是否更新 |

### 七、小结与第 37 篇预告

本篇完成了 MoveIt2 的第一个"闭环"：从 demo 启动到规划、执行、加障碍物避障。核心要点：

1.  `demo.launch.py` 一次拉起 robot_state_publisher、move_group、RViz 全家桶，move_group 是所有能力的入口。
2.  规划 = MotionPlanRequest →（OMPL + 时间参数化）→ MotionPlanResponse，高级接口 `MoveGroupCommander` / `MoveGroupInterface` 帮你封装了这一切。
3.  Python 的 `set_pose_target/set_joint_value_target/set_position_target` 与 C++ 的 `setPoseTarget/setJointValueTarget/setPositionTarget` 一一对应，语法几乎相同。
4.  规划场景（Planning Scene）是"机器人 + 世界"的统一描述，往里加障碍物即可实现自动避障。
5.  真机调试惯例：速度缩放先 0.2~0.3，成功后再提速。

下一章（第 37 篇）**「MoveIt2 运动学（IK/FK 与运动学插件）」**：深入 move_group 是怎么把"末端位姿"换算成"关节角度"的——正运动学 FK、逆运动学 IK、KDL 与 TRAC-IK 求解器的差别、奇异点与多解选择，并给出求解器插件的自定义示例，让机械臂规划"知其所以然"。
