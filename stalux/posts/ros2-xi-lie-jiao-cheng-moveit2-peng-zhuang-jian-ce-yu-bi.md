---
title: "ROS2系列教程：Moveit2碰撞检测与避障"
abbrlink: ros2-xi-lie-jiao-cheng-moveit2-peng-zhuang-jian-ce-yu-bi
date: "2026-11-08 23:21:18"
categories:
    - "ROS2"
tags: []
desc: "把前面学的串成真本事——用 Pick & Place 流程实现\"感知 → 抓取 → 搬运 → 放置\"，深入 OMPL 各规划器（RRT/RRTConnect/BIT*）的选型与调参…"
---
## 本文是 ROS2 系列教程的第 38 篇

> 本文是 ROS2 系列教程的第 38 篇：MoveIt2 碰撞检测与避障。第 37 篇我们搞懂了运动学（IK/FK 与求解器插件）。但规划出一条"能到"的轨迹还不够——它还必须"不撞上"：不能自碰撞，也不能撞上桌子、墙面、障碍物。这就是本篇的主角：碰撞检测。我们深入 FCL 库的原理、允许碰撞矩阵 ACM、规划场景里障碍物的增删与动态更新，用 Python/C++ 操作碰撞检测 API，最后讲清楚"碰撞检测如何驱动避障规划"以及性能优化。

### 一、碰撞检测基础

#### 1.1 为什么要碰撞检测

机械臂规划出的轨迹如果不做碰撞检测，后果是灾难性的：

```text
1. 自碰撞：手臂甩起来打到自己的底座或另一节手臂
2. 环境碰撞：末端扫过桌子边缘、撞进机柜
3. 动态风险：人靠近工作区时轨迹没有反应
```

MoveIt2 把碰撞检测织进了三个环节：

```text
1. 规划前：检查目标状态是否合法（会不会撞）
2. 规划中：OMPL 随机采样的每一步都做碰撞检查，撞了就丢弃该样本
3. 规划后：执行监控，检测到异常立即停车
```

所以说，MoveIt2 的"避障"本质上是**碰撞检测驱动的采样过滤**——规划器只管生成候选轨迹，碰撞检测负责淘汰非法轨迹。

#### 1.2 FCL 库（Flexible Collision Library）

MoveIt2 默认的碰撞检测引擎是 FCL（柔性碰撞库），一个专门做几何体碰撞检测的开源库。它解决的核心问题是：**给定两个形状，判断它们是否重叠，重叠了多少**。

FCL 支持的基本形状：

```text
1. 凸多面体（box 盒子、cylinder 圆柱、sphere 球、cone 锥）
2. 凹多面体（mesh 网格，用凸分解处理）
3. 点云（point cloud）
4. 平面（plane）
```

对两个凸形状，FCL 用 **GJK 算法**（Gilbert-Johnson-Keerthi）判断是否相交，再用 **EPA 算法**（Expanding Polytope Algorithm）求最小穿透深度。这两个算法是碰撞检测领域的经典。

#### 1.3 碰撞检测的类型

MoveIt2 里区分两类碰撞：

```text
1. 自碰撞（self-collision）：机器人的 link 与 link 之间
   —— 比如 forearm_link 撞上 base_link
2. 环境碰撞（environment collision）：机器人与规划场景里的物体之间
   —— 比如 tool0 撞上桌子（桌子是一个 CollisionObject）
```

两类碰撞共用同一套 FCL 引擎，区别只在于"参与检测的几何体集合"不同：自碰撞用机器人自身的 link 形状；环境碰撞在自碰撞基础上叠加场景物体形状。

### 二、Planning Scene 的碰撞检测机制

#### 2.1 允许碰撞矩阵 ACM（Allowed Collision Matrix）

不是所有 link 对都需要检测碰撞。相邻 link（通过 joint 直接相连）在正常范围内永远不碰撞，检测它们是纯浪费。MoveIt2 用 **ACM** 管理"哪些对允许碰撞"：

```text
AllowedCollisionMatrix
├── 相邻 link 对：allowed=true（跳过检测，加速）
├── 已知永远不碰的远距 link 对：allowed=true（如 base 与 tool0 间距固定）
├── 其余 link 对：allowed=false（必须检测）
└── 场景物体对：默认 allowed=false（都要检测）
```

SRDF 里的 `<disable_collisions>` 标签（第 35 篇生成配置时自动填入的）就是在初始化 ACM。手写 SRDF 时这段不能省，否则相邻 link 也做碰撞检测，规划慢一个量级。

#### 2.2 碰撞对象 CollisionObject

环境里的障碍物在 MoveIt2 中称为 **CollisionObject**，定义在 `moveit_msgs/msg/CollisionObject`：

```text
CollisionObject
├── id               # 唯一标识（如 "table"）
├── header.frame_id  # 所在坐标系（如 "base_link" 或 "world"）
├── primitives       # 基本形状列表（box/cylinder/sphere/cone）
├── primitive_poses  # 每个形状的位姿
├── meshes           # 网格形状列表（从 STL/DAE 加载）
├── mesh_poses       # 每个网格的位姿
└── operation        # ADD / REMOVE / MOVE / APPEND
```

同一个 CollisionObject 可以一次挂多个形状（比如一张桌子 = 桌面盒 + 4 条桌腿柱），一次性发布到规划场景。

#### 2.3 检测流程：broadphase + narrowphase

MoveIt2 每帧的碰撞检测分两个阶段：

```text
1. Broadphase（粗筛）：用包围盒（AABB/OBB）快速剔除明显不相交的物体对
   —— 大部分物体对在这一步就被排除，开销小
2. Narrowphase（精检）：对剩下的候选对调用 FCL 的 GJK/EPA 精确判断
   —— 只有少数对走到这一步
```

这个"先粗后细"的两阶段设计，让碰撞检测的性能与物体数量基本成线性关系（而不是平方），是它能实时跑的关键。

### 三、添加障碍物与动态障碍物

#### 3.1 示例 1：静态障碍物（Python）

```bash
# 启动 demo
ros2 launch arm_moveit_config demo.launch.py
```

```python
#!/usr/bin/env python3
# ~/dev_ws/src/arm_demo/arm_demo/add_table.py
import rclpy
from moveit_commander import PlanningSceneInterface
from geometry_msgs.msg import Pose

def main():
    rclpy.init()
    node = rclpy.create_node('add_table')
    scene = PlanningSceneInterface(node)

    # 1. 一张桌子：桌面（大扁盒）+ 四条腿（圆柱），都在 base_link 系下
    table_top = Pose()
    table_top.position.x = 0.45
    table_top.position.y = 0.0
    table_top.position.z = 0.10   # 桌面高度
    scene.add_box('table_top', (0.5, 0.5, 0.02), table_top)

    for i, (dx, dy) in enumerate([(-0.2, -0.2), (-0.2, 0.2),
                                  (0.2, -0.2), (0.2, 0.2)]):
        leg = Pose()
        leg.position.x = 0.45 + dx
        leg.position.y = dy
        leg.position.z = 0.05
        scene.add_cylinder(f'table_leg_{i}', height=0.10, radius=0.02, pose=leg)

    node.get_logger().info('已添加桌子和 4 条腿')
    rclpy.spin_once(node, timeout_sec=1.0)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

运行后去 RViz 勾选 MotionPlanning → Scene Objects，能看到桌子出现在规划场景里。此时拖 Goal 到桌面上方，规划的轨迹会自动绕过桌面。

#### 3.2 示例 2：动态障碍物（每帧更新位置）

避障的进阶用法是让障碍物"动起来"——比如产线上的料箱缓慢移动。做法：持续发布带 MOVE 操作的 CollisionObject。

```python
#!/usr/bin/env python3
# ~/dev_ws/src/arm_demo/arm_demo/moving_obstacle.py
import rclpy
from moveit_commander import PlanningSceneInterface
from geometry_msgs.msg import Pose

def main():
    rclpy.init()
    node = rclpy.create_node('moving_obstacle')
    scene = PlanningSceneInterface(node)
    rate = node.create_rate(10)   # 10Hz 更新

    t = 0.0
    while rclpy.ok():
        # 障碍物沿 x 方向来回移动（正弦摆动）
        pose = Pose()
        pose.position.x = 0.30 + 0.15 * __import__('math').sin(t)
        pose.position.y = 0.0
        pose.position.z = 0.25
        scene.add_box('moving_box', (0.05, 0.05, 0.05), pose)
        t += 0.1
        rclpy.spin_once(node, timeout_sec=0.05)
        rate.sleep()

    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

注意 `add_box` 对同一个 id 重复调用就是"移动"（内部转成 MOVE 操作）。10Hz 的更新频率对 MoveIt2 完全够用，规划时会自动避让最新位置的障碍物。

#### 3.3 从传感器数据添加（点云/网格）

真实场景的障碍物来自传感器。常见两条路：

```text
1. 点云：把 3D 相机点云降采样后，作为 octomap（八叉树地图）发布，
   MoveIt2 的 Octomap 插件自动把它变成碰撞几何体
2. 网格：把障碍物的 STL/DAE 网格直接挂到 CollisionObject.meshes
   （适合已知工件的精确碰撞）
```

点云路线的配置示例（在 `planning.yaml` 或 demo launch 里加）：

```yaml
# ompl_planning.yaml 附近，或 planning_scene_monitor 参数
planning_scene_monitor_options:
  octomap_monitor:
    octomap_topic: /octomap_full     # 点云聚合成的八叉树话题
    max_range: 2.0
    resolution: 0.02                 # 2cm 分辨率
```

分辨率调小则碰撞更精确但更慢；0.02m 对机械臂工作区是常用值。

### 四、碰撞检测 API（Python + C++）

#### 4.1 示例 3：查询当前状态是否碰撞（Python）

```python
#!/usr/bin/env python3
# ~/dev_ws/src/arm_demo/arm_demo/check_collision.py
import rclpy
from moveit_commander import PlanningSceneInterface, RobotCommander

def main():
    rclpy.init()
    node = rclpy.create_node('check_collision')
    robot = RobotCommander(node)
    scene = PlanningSceneInterface(node)

    # 1. 构造一个"可疑"的关节状态（比如让手臂完全收起）
    joint_values = robot.get_current_state().joint_state.position
    # 假设规划组关节是前 3 个
    joint_values[:3] = [0.0, 0.0, 0.0]

    # 2. 检查这个状态是否自碰撞/环境碰撞
    from moveit_msgs.srv import GetStateValidity
    cli = node.create_client(GetStateValidity, '/check_state_validity')
    req = GetStateValidity.Request()
    req.robot_state = robot.get_current_state()
    req.robot_state.joint_state.position = joint_values
    req.group_name = 'arm_group'

    if not cli.wait_for_service(timeout_sec=2.0):
        node.get_logger().error('check_state_validity 服务不可用')
        return
    fut = cli.call_async(req)
    rclpy.spin_until_future_complete(node, fut)
    resp = fut.result()

    if resp.valid:
        print('该状态有效（无碰撞）')
    else:
        print('该状态碰撞！')
        # 打印哪些 link 对发生了碰撞
        for c in resp.contacts:
            print(f'  碰撞: {c.contact_body_1} <-> {c.contact_body_2}')

    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

`/check_state_validity` 是调试利器：任何"这姿势能不能摆"的问题，调它就能得到权威答案。

#### 4.2 示例 4：主动查询两个物体的碰撞（Python）

```python
#!/usr/bin/env python3
# ~/dev_ws/src/arm_demo/arm_demo/check_pair.py
import rclpy
from moveit_commander import PlanningSceneInterface
from moveit_msgs.srv import GetPlanningScene

def main():
    rclpy.init()
    node = rclpy.create_node('check_pair')
    cli = node.create_client(GetPlanningScene, '/get_planning_scene')
    req = GetPlanningScene.Request()
    req.components.components = [req.components.WORLD_OBJECT_GEOMETRY]

    if not cli.wait_for_service(timeout_sec=2.0):
        node.get_logger().error('get_planning_scene 服务不可用')
        return
    fut = cli.call_async(req)
    rclpy.spin_until_future_complete(node, fut)
    scene = fut.result().scene

    # 打印当前规划场景里所有物体
    for obj in scene.world.collision_objects:
        print(f'物体 id={obj.id} 帧={obj.header.frame_id} '
              f'形状数={len(obj.primitives) + len(obj.meshes)}')

    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

`/get_planning_scene` 返回的 `world.collision_objects` 列出了场景里全部障碍物——用它核对"我加的障碍物到底进没进场景"。

#### 4.3 示例 5：C++ 方式

```cpp
// src/check_collision.cpp（在 arm_planner_cpp 包内）
#include <rclcpp/rclcpp.hpp>
#include <moveit/move_group_interface/move_group_interface.h>
#include <moveit/planning_scene/planning_scene.h>
#include <moveit/planning_scene_interface/planning_scene_interface.h>

int main(int argc, char** argv) {
  rclcpp::init(argc, argv);
  auto node = std::make_shared<rclcpp::Node>("check_collision");
  auto executor = std::make_shared<rclcpp::executors::SingleThreadedExecutor>();
  executor->add_node(node);
  std::thread spin([&executor]() { executor->spin(); });

  // 1. 加一个障碍物
  moveit::planning_interface::PlanningSceneInterface psi;
  moveit_msgs::msg::CollisionObject box;
  box.id = "obstacle";
  box.header.frame_id = "base_link";
  box.primitives.resize(1);
  box.primitives[0].type = shape_msgs::msg::SolidPrimitive::BOX;
  box.primitives[0].dimensions = {0.1, 0.1, 0.1};
  box.primitive_poses.resize(1);
  box.primitive_poses[0].position.x = 0.30;
  box.primitive_poses[0].position.z = 0.25;
  box.operation = moveit_msgs::msg::CollisionObject::ADD;
  std::vector<moveit_msgs::msg::CollisionObject> objs = {box};
  psi.applyCollisionObjects(objs);
  RCLCPP_INFO(node->get_logger(), "已添加障碍物");

  // 2. 构造一个 planning scene 并检查碰撞
  auto scene = std::make_shared<planning_scene::PlanningScene>(
      moveit::core::getSharedRobotModel("arm_moveit_config"));
  scene->getCurrentStateNonConst().setToDefaultValues();
  collision_detection::CollisionRequest req;
  collision_detection::CollisionResult res;
  req.group_name = "arm_group";
  scene->checkCollision(req, res, scene->getCurrentState());
  RCLCPP_INFO(node->get_logger(), "当前状态碰撞=%d", (int)res.collision);

  spin.join();
  rclcpp::shutdown();
  return 0;
}
```

```bash
# CMakeLists.txt 增加
find_package(moveit_ros_planning_interface REQUIRED)
find_package(moveit_core REQUIRED)
ament_target_dependencies(check_collision rclcpp
  moveit_ros_planning_interface moveit_core)
install(TARGETS check_collision DESTINATION lib/${PROJECT_NAME})
```

### 五、避障规划

#### 5.1 带障碍物规划：完整闭环

把第 36 篇的规划 + 本篇的障碍物合起来：

```python
#!/usr/bin/env python3
# ~/dev_ws/src/arm_demo/arm_demo/plan_avoid.py
import rclpy
from moveit_commander import MoveGroupCommander, PlanningSceneInterface
from geometry_msgs.msg import Pose

def main():
    rclpy.init()
    node = rclpy.create_node('plan_avoid')
    group = MoveGroupCommander('arm_group', node)
    scene = PlanningSceneInterface(node)

    # 1. 在路径中间放一个盒子
    pose = Pose()
    pose.position.x = 0.25
    pose.position.y = 0.0
    pose.position.z = 0.20
    scene.add_box('wall', (0.05, 0.30, 0.30), pose)

    # 2. 目标在盒子另一侧
    group.set_position_target([0.45, 0.0, 0.25])
    plan = group.plan()
    if getattr(plan, 'joint_trajectory', None) and plan.joint_trajectory.points:
        print(f'规划成功！轨迹点数={len(plan.joint_trajectory.points)}')
        group.execute(plan, wait=True)
        print('执行完成——轨迹绕过了盒子')
    else:
        print('规划失败：可能被盒子挡住了')

    # 3. 移除盒子
    scene.remove_world_object('wall')
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

这个例子把"障碍物 → 规划 → 避让 → 清除"串成了完整闭环，是抓取/上下料任务的最小骨架。

#### 5.2 碰撞检测与规划的关系

OMPL 的 RRT/RRTConnect 等算法在采样时维护一棵树：每个新采样的节点先做碰撞检查，合法才接入树。所以：

```text
碰撞检测越准确 → 树的节点越"干净" → 轨迹越安全
碰撞检测越慢 → 采样越慢 → 规划越慢
```

这就是为什么 ACM 优化、broadphase 粗筛、降低网格复杂度都那么重要——它们在不牺牲安全性的前提下让规划更快。

#### 5.3 性能优化

```text
1. 简化网格：STL 网格减面（如 10 万 → 1 万面），碰撞结果几乎不变
2. 收紧 ACM：把距离恒定的 link 对设为 allowed
3. 控制更新频率：点云 5~10Hz 足够，不必每帧全量重建
4. 增大 octomap 分辨率：0.02 → 0.05 速度快几倍（精度略降）
5. 缩小检测范围：max_range 限制远处障碍物不进场景
```

工程上建议先跑通、再逐步压性能，不要一上来就全开最高精度。

### 六、常见问题与调试

#### 6.1 常见问题速查

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 障碍物加了但轨迹不避让 | 规划场景未同步/障碍物在错误坐标系 | 勾选 Scene Objects 确认物体在，检查 frame_id |
| 相邻 link 也被判碰撞 | ACM 没生效 | 检查 SRDF 的 disable_collisions 是否齐全 |
| 规划明显变慢 | 碰撞几何体太多/网格太密 | 简化网格、增大 octomap 分辨率、收紧 ACM |
| 轨迹穿墙而过 | 碰撞检测没开/距离阈值过大 | 确认 PlanningSceneMonitor 运行，检查 collision 显示 |
| 动态障碍物跟不上 | 更新频率太低 | 提高发布频率到 10Hz+，检查网络负载 |
| check_state_validity 报错 | 请求的 group 名不存在 | 确认 group_name 与 SRDF 一致 |

#### 6.2 调试技巧

```text
1. RViz 勾选 MotionPlanning → Collision 显示，碰撞的 link 会高亮
2. /check_state_validity 单点验证：任何可疑姿势先问它
3. /get_planning_scene 核对场景内容：确认障碍物真的进去了
4. 打印 ACM：读 AllowedCollisionMatrix 内容，排查误配
5. 先加障碍物再规划：规划前确认 Scene Objects 已刷新
```

### 七、小结与第 39 篇预告

本篇把碰撞检测与避障讲透了：FCL 是底层引擎（GJK/EPA + 两阶段检测），ACM 是性能开关，CollisionObject 是环境建模的载体，`/check_state_validity` 是单点验证利器，避障本质是"采样 + 碰撞过滤"。

核心要点：

1.  碰撞分自碰撞与环境碰撞两类，共用一个 FCL 引擎，差别只在参与检测的几何体集合。
2.  ACM 标记"允许碰撞对"，相邻 link 必须跳过检测，否则性能崩。
3.  障碍物 = CollisionObject（id + frame_id + 形状 + 操作），重复发布同一 id 即移动。
4.  `/check_state_validity` 与 `/get_planning_scene` 是调试碰撞问题的两大服务。
5.  性能优化四板斧：简化网格、收紧 ACM、降更新频率、调 octomap 分辨率。

下一章（第 39 篇）**「MoveIt2 进阶（抓取/OMPL/自定义规划）」**：把前面学的串成真本事——用 Pick & Place 流程实现"感知 → 抓取 → 搬运 → 放置"，深入 OMPL 各规划器（RRT/RRTConnect/BIT*）的选型与调参，再写一个自定义规划算法插件，最后给出多目标点连续规划的工程模板。
