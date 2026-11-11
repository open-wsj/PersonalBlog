---
title: "ROS2系列教程：Moveit2进阶（抓取/OMPL/自定义规划）"
abbrlink: ros2-xi-lie-jiao-cheng-moveit2-jin-jie-zhua-qu-ompl-zi-ding
date: "2026-11-08 23:21:51"
categories:
    - "ROS2"
tags: []
desc: "理解规划器插件机制，能让你在特殊需求（狭窄通道、非标准成本函数）时不至于束手无策。"
---
## 本文是 ROS2 系列教程的第 39 篇

> 本文是 ROS2 系列教程的第 39 篇：MoveIt2 进阶（抓取 / OMPL / 自定义规划）。第 38 篇我们搞定了碰撞检测与避障。现在把前面学的串成真本事：用 Pick & Place 流程实现"感知 → 抓取 → 搬运 → 放置"，深入 OMPL 各规划器（RRT / RRTConnect / BIT*）的选型与调参，手写一个自定义规划器插件，最后给出多目标点连续规划的工程模板。这是 MoveIt2 阶段的"毕业设计"，第 40 篇将把机械臂接到真机。

### 一、Pick & Place：抓取-搬运-放置流程

#### 1.1 任务拆解

抓取任务看起来简单——“把杯子拿过来”——拆开却是五个明确的子步骤：

```text
Pick & Place 五步走
1. 感知：确认物体位置（相机/仿真中直接指定）
2. 预抓取：末端移到物体上方安全距离，姿态对准
3. 抓取：末端下探 → 闭合夹爪 → 微抬
4. 搬运：把物体从 A 点移到 B 点（注意始终与物体保持相对关系）
5. 放置：下降到目标高度 → 张开夹爪 → 撤离
```

每一步都是一次"规划 + 执行"，且状态之间要传递数据（比如抓取位姿、抬升高度）。写成一个线性脚本只能跑通 demo；工程上要包一层状态机。

#### 1.2 MoveIt2 的 Pick/Place 能力

MoveIt2 本身提供了 `pick` / `place` 动作（moveit_msgs 的 PickupAction / PlaceAction），但它假设你有完整的抓取方案（grasp 集合：预抓取位姿、抓取位姿、夹爪开合角度）。很多项目选择**不用它**，而是自己编排——原因：

```text
1. pick/place 动作对夹爪模型和 grasp 数据格式要求严格
2. 自定义逻辑（夹爪传感器反馈、物体识别结果）更难插入
3. 自编排用 set_pose_target + execute 就能覆盖 90% 场景
```

所以本篇采用"自编排"路线：用前面学过的原语拼出完整流程，这也是工业项目最常见的做法。

#### 1.3 简化示例：单个抓取点（Python）

```bash
# 启动 demo
ros2 launch arm_moveit_config demo.launch.py
```

```python
#!/usr/bin/env python3
# ~/dev_ws/src/arm_demo/arm_demo/pick_simple.py
import rclpy
from moveit_commander import MoveGroupCommander

def main():
    rclpy.init()
    node = rclpy.create_node('pick_simple')
    group = MoveGroupCommander('arm_group', node)

    # 1. 回到 home
    group.set_named_target('home')
    group.go(wait=True)

    # 2. 预抓取：物体在 (0.35, 0.0, 0.15)，先到上方 0.08m
    group.set_pose_target([0.35, 0.0, 0.23, 0, 0, 0], 'tool0')  # xyz + rpy(度)
    group.go(wait=True)

    # 3. 下探到抓取高度
    group.set_pose_target([0.35, 0.0, 0.15, 0, 0, 0], 'tool0')
    group.go(wait=True)
    print('到达抓取位置——在这里闭合夹爪（真机）/ 模拟中跳过')

    # 4. 抬升
    group.set_pose_target([0.35, 0.0, 0.23, 0, 0, 0], 'tool0')
    group.go(wait=True)

    # 5. 回到 home
    group.set_named_target('home')
    group.go(wait=True)
    print('完成一次简化抓取')

    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

注意 `set_pose_target` 支持 `[x, y, z, roll, pitch, yaw]` 列表形式（rpy 用度），比手拼 Pose 对象更紧凑。夹爪在仿真里没有真实夹持，我们用"位移模拟"代替。

### 二、OMPL 规划器详解

#### 2.1 OMPL 是什么

OMPL（Open Motion Planning Library）是 MoveIt2 默认的**采样式运动规划库**，提供几十种规划算法。MoveIt2 与 OMPL 的关系：

```text
move_group → OMPL（采样规划器：RRT/RRTConnect/BIT*...）
                 │
                 ├── 状态空间（关节空间/SE3/SE2）
                 ├── 碰撞检测回调（连接 FCL）
                 └── 目标判定（到达 goal 约束即成功）
```

OMPL 不关心你的机器人是什么，它只在一个抽象的状态空间里"找路"，碰撞检测和运动学由 MoveIt2 注入。

#### 2.2 常用规划器

```text
1. RRT（Rapidly-exploring Random Tree）
   经典随机树：快速探索空间，路径质量一般（曲折、随机）

2. RRTConnect（双向 RRT）
   从起点和终点同时生长两棵树，相向连接
   速度最快、最常用，MoveIt2 默认就是它

3. BIT*（Batch Informed Trees）
   结合图搜索与采样：先快速出解，再用信息集持续优化
   路径质量高、时间越长越优，适合离线/准实时

4. PRM / PRM*（概率路线图）
   预采样构建路线图，适合多次查询同一空间
```

#### 2.3 规划器选型与调参

`ompl_planning.yaml` 里为每个规划组配置一组规划器：

```yaml
# ompl_planning.yaml（片段）
arm_group:
  planner_configs:
    - RRTConnect
    - RRT
    - BITstar
  RRTConnect:
    type: geometric::RRTConnect
    range: 0.05          # 单步扩展最大距离
    goal_bias: 0.05      # 偏向目标的比例
  RRT:
    type: geometric::RRT
    range: 0.05
    goal_bias: 0.05
  BITstar:
    type: geometric::BITstar
```

选型建议：

```text
1. 实时在线（默认）：RRTConnect，range 0.05~0.1
2. 复杂狭窄通道：RRTConnect 调小 range（0.03）+ 增加迭代时间
3. 路径质量优先（搬运慢速场景）：BIT* 给足 2~5 秒
4. 同一空间多次规划：PRM 预采样
```

换规划器：`group.set_planner_id("RRT")`（Python）或改 demo launch 参数，一行即可切换。

### 三、自定义规划器插件

理解规划器插件机制，能让你在特殊需求（狭窄通道、非标准成本函数）时不至于束手无策。

#### 3.1 规划器接口

MoveIt2 的规划器插件实现 `planning_interface::PlannerManager`：

```cpp
class MyPlanner : public planning_interface::PlannerManager {
public:
  bool initialize(const rclcpp::Node::SharedPtr& node,
                  const planning_scene::PlanningScenePtr& scene,
                  const std::string& name) override;
  bool solve(const planning_interface::MotionPlanRequest& req,
             planning_interface::MotionPlanResponse& res) override;
  // 其余虚函数（getDescription/terminate 等）从略
};
```

核心就一个 `solve()`：读请求（起点/终点/约束），算出一条轨迹填进响应。

#### 3.2 实现一个"直线插补"规划器（教学用）

```cpp
// src/my_planner/src/my_planner.cpp（最小示意）
#include <moveit/planning_interface/planning_interface.h>
#include <pluginlib/class_list_macros.hpp>

namespace my_planner {
class MyPlanner : public planning_interface::PlannerManager {
public:
  bool solve(const planning_interface::MotionPlanRequest& req,
             planning_interface::MotionPlanResponse& res) override {
    // 1. 取起点与目标关节角
    const auto& start = req.start_state.joint_state.position;
    // （演示：直接用目标值作为终点，插 10 个点）
    auto& traj = res.trajectory.joint_trajectory;
    traj.joint_names = req.group_name == "arm_group"
        ? std::vector<std::string>{"link1_joint", "link2_joint", "link3_joint"}
        : std::vector<std::string>{};
    // 2. 线性插值：从 start 到 goal（goal 从 req.goal_constraints 解析，此处略）
    for (int i = 0; i <= 10; ++i) {
      trajectory_msgs::msg::JointTrajectoryPoint pt;
      pt.positions = start;   // 简化：这里应写入插值结果
      pt.time_from_start.sec = i * 2;
      traj.points.push_back(pt);
    }
    res.error_code.val = moveit_msgs::msg::MoveItErrorCodes::SUCCESS;
    return true;
  }
};
}  // namespace my_planner
PLUGINLIB_EXPORT_CLASS(my_planner::MyPlanner, planning_interface::PlannerManager)
```

真实规划器（如 OMPL）在这里完成采样、碰撞检查、时间参数化，但接口骨架完全一样。

#### 3.3 注册与配置

```xml
<!-- my_planner.xml -->
<library path="libmy_planner">
  <class name="my_planner/MyPlanner"
         type="my_planner::MyPlanner"
         base_class_type="planning_interface::PlannerManager">
    <description>自定义直线规划器示例</description>
  </class>
</library>
```

```yaml
# ompl_planning.yaml 换成自定义规划器
arm_group:
  planner_configs:
    - my_planner/MyPlanner    # 或通过 move_group 参数指定
```

编译后重启 demo，`group.set_planner_id("my_planner/MyPlanner")` 即可调用。日志里打点确认 `solve()` 被命中。

### 四、多目标点连续规划

#### 4.1 路径点序列

工业任务（上下料、焊接、喷涂）几乎都是多目标点连续作业。核心是"逐点规划 + 执行 + 校验"：

```python
#!/usr/bin/env python3
# ~/dev_ws/src/arm_demo/arm_demo/waypoints.py
import rclpy
from moveit_commander import MoveGroupCommander

def main():
    rclpy.init()
    node = rclpy.create_node('waypoints')
    group = MoveGroupCommander('arm_group', node)

    # 路径点（相对 base_link 的 xyz，姿态默认）
    points = [
        [0.30, 0.0, 0.25],
        [0.30, 0.20, 0.25],
        [0.20, 0.20, 0.30],
        [0.30, 0.0, 0.25],   # 回到起点
    ]

    group.set_named_target('home')
    group.go(wait=True)

    for i, p in enumerate(points):
        group.set_position_target(p)
        ok = group.go(wait=True)
        if not ok:
            print(f'第 {i} 个点规划/执行失败，中断')
            break
        print(f'已到达第 {i+1} 个点: {p}')

    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

#### 4.2 连续轨迹：compute_cartesian_path

如果希望末端**沿直线**走（而不是每个点独立规划导致路径弯曲），用笛卡尔路径：

```python
#!/usr/bin/env python3
# ~/dev_ws/src/arm_demo/arm_demo/cartesian.py
import rclpy
from moveit_commander import MoveGroupCommander
from geometry_msgs.msg import Pose

def main():
    rclpy.init()
    node = rclpy.create_node('cartesian')
    group = MoveGroupCommander('arm_group', node)

    # 从当前位姿出发，沿 x 正方向画直线
    waypoints = []
    for i in range(11):           # 11 个插值点
        p = group.get_current_pose().pose
        p.position.x += i * 0.02  # 每步 2cm
        waypoints.append(p)

    plan, fraction = group.compute_cartesian_path(
        waypoints, eef_step=0.01, jump_threshold=0.0)
    print(f'笛卡尔路径完成度: {fraction:.1%}')

    if fraction > 0.9:
        group.execute(plan, wait=True)
    else:
        print('路径被阻塞，未执行')

    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

`compute_cartesian_path` 返回 `(plan, fraction)`，fraction 表示完成度：1.0 表示整条直线都规划出来了，小于 1 说明某段 IK 失败（被障碍物或奇异点挡住）。

#### 4.3 工程注意事项

```text
1. 每个点执行前校验：go() 返回 False 就中断，别硬撑
2. 多目标点建议用状态机（见第五节），便于插入夹爪/传感器逻辑
3. 笛卡尔路径注意奇异点：直线经过奇异位形时 fraction 骤降
4. 速度缩放逐段可调：接近目标点放慢，中间提速
5. 记录每个点的实际到达位姿，便于回放与调试
```

### 五、抓取实战：完整流程（Python）

把上面所有能力拼成一个带状态机的完整抓取任务。

#### 5.1 示例：带状态机的 Pick & Place

```python
#!/usr/bin/env python3
# ~/dev_ws/src/arm_demo/arm_demo/pick_place_fsm.py
import rclpy
from moveit_commander import MoveGroupCommander, PlanningSceneInterface

class PickPlaceFSM:
    """简易状态机：HOME → PRE_GRASP → GRASP → LIFT → PLACE → BACK"""
    def __init__(self, node):
        self.group = MoveGroupCommander('arm_group', node)
        self.scene = PlanningSceneInterface(node)
        self.state = 'HOME'
        self.pick_pos = [0.35, 0.0, 0.15]
        self.place_pos = [0.35, 0.30, 0.15]
        self.lift_h = 0.08   # 抬升高度

    def move_to(self, target, wait=True):
        if len(target) == 3:
            self.group.set_position_target(target)
        else:
            self.group.set_pose_target(target, 'tool0')
        return self.group.go(wait=wait)

    def run(self):
        while rclpy.ok():
            if self.state == 'HOME':
                self.group.set_named_target('home')
                self.group.go(wait=True)
                self.state = 'PRE_GRASP'
            elif self.state == 'PRE_GRASP':
                if self.move_to([self.pick_pos[0], self.pick_pos[1],
                                 self.pick_pos[2] + self.lift_h]):
                    self.state = 'GRASP'
            elif self.state == 'GRASP':
                if self.move_to(self.pick_pos):
                    print('>>> 闭合夹爪（此处接真机/仿真夹爪指令）')
                    self.state = 'LIFT'
            elif self.state == 'LIFT':
                if self.move_to([self.pick_pos[0], self.pick_pos[1],
                                 self.pick_pos[2] + self.lift_h]):
                    self.state = 'PLACE'
            elif self.state == 'PLACE':
                if self.move_to([self.place_pos[0], self.place_pos[1],
                                 self.place_pos[2] + self.lift_h]):
                    self.state = 'PUT_DOWN'
            elif self.state == 'PUT_DOWN':
                if self.move_to(self.place_pos):
                    print('>>> 张开夹爪')
                    self.state = 'BACK'
            elif self.state == 'BACK':
                self.move_to([self.place_pos[0], self.place_pos[1],
                              self.place_pos[2] + self.lift_h])
                self.group.set_named_target('home')
                self.group.go(wait=True)
                print('任务完成！')
                break

def main():
    rclpy.init()
    node = rclpy.create_node('pick_place_fsm')
    fsm = PickPlaceFSM(node)
    fsm.run()
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

这个状态机把"每一拍规划成功才前进"体现得淋漓尽致：任何一步 `go()` 失败，状态就停在那里不前进，不会带病继续——这是机器人任务控制最重要的工程习惯。

#### 5.2 错误处理增强

```python
# 给状态机加"失败重试 + 回退"
MAX_RETRY = 3

def run(self):
    retry = 0
    # ... 原状态机逻辑中，每次 move_to 失败：
    #   retry += 1
    #   if retry >= MAX_RETRY:
    #       print('连续失败，回 home 并报警')
    #       self.group.set_named_target('home')
    #       self.group.go(wait=True)
    #       break
    #   else:
    #       continue   # 保持当前状态，重试
```

工程版本还要加：执行超时、急停输入、夹爪到位传感器反馈。这些都可以挂在状态机各状态的前后置条件上。

#### 5.3 仿真验证要点

```text
1. demo 里没有真实夹爪：用 RViz 目视确认 tool0 到达 pick 点
2. 加障碍物模拟桌面：验证 PLACE 阶段不会撞"桌面"
3. 故意把 pick 点放远：观察 GRASP 阶段 go() 失败、状态停住
4. 观察笛卡尔路径 fraction：直线段被打断时及时报告
```

### 六、小结与第 40 篇预告

本篇完成了 MoveIt2 进阶三连：Pick & Place 自编排流程、OMPL 规划器选型与调参、自定义规划器插件骨架，最后用状态机把"抓取-搬运-放置"串成完整的可运行工程。

核心要点：

1.  Pick & Place 五步走：感知 → 预抓取 → 抓取 → 搬运 → 放置；自编排比 move_group 内置 pick/place 更灵活。
2.  OMPL 是采样式规划库：RRTConnect 默认最快，BIT* 路径更优，PRM 适合重复查询。
3.  自定义规划器：继承 `PlannerManager`、实现 `solve()`、注册 pluginlib、改 yaml，一套流程与求解器插件完全对称。
4.  多目标点用状态机编排，每一拍"规划成功才前进"，失败重试、超限回退。
5.  `compute_cartesian_path` 让末端走直线，fraction 是完成度晴雨表。

下一章（第 40 篇，本系列最后一篇）**「MoveIt2 真机控制与系列总结（原理）」**：把机械臂从仿真搬到真机——ros2_control 与 MoveIt2 的完整对接、关节轨迹控制器配置、真机标定与安全限位、急停与异常处理，最后给出 40 篇 ROS2 系列的全景路线图与下一步学习建议。
