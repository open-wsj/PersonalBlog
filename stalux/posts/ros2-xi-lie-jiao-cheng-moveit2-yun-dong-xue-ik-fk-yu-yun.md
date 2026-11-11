---
title: "ROS2系列教程：Moveit2运动学（IK/FK与运动学插件）"
abbrlink: ros2-xi-lie-jiao-cheng-moveit2-yun-dong-xue-ik-fk-yu-yun
date: "2026-10-28 16:03:46"
categories:
    - "ROS2"
tags: []
desc: "理解插件的机制，比背 API 更有价值。下面写一个\"最小可用\"的自定义 IK 求解器插件。"
---
## 本文是 ROS2 系列教程的第 37 篇

> 本文是 ROS2 系列教程的第 37 篇：MoveIt2 运动学（IK/FK 与运动学插件）。第 36 篇我们把机械臂跑了起来，用 `set_pose_target` 让 move_group 算出关节轨迹。但你有没有想过：move_group 是怎么把"末端要到的位姿"换算成"每个关节该转多少度"的？答案就是本篇的主角——运动学。我们深入 FK（正运动学）与 IK（逆运动学）的原理、KDL 与 TRAC-IK 等求解器的差别、求解器插件的机制，并给出 Python/C++ 调用 IK/FK 的完整示例，最后带你写一个自定义求解器插件。

### 一、运动学是什么：FK 与 IK

#### 1.1 正运动学 FK（Forward Kinematics）

正运动学是从"关节空间"到"笛卡尔空间"的映射：已知每个关节的角度，求末端在空间中的位姿（位置 xyz + 姿态 rpy）。

```text
FK：关节角 [θ1, θ2, θ3]  →  末端位姿 (x, y, z, rx, ry, rz)
```

以第 35 篇的两连杆机械臂为例，末端 tool0 相对 base_link 的位置可以写成显式公式：

```text
x = L1·cos(θ1) + L2·cos(θ1 + θ2)
y = L1·sin(θ1) + L2·sin(θ1 + θ2)
```

FK 是**唯一确定**的：一组关节角只对应一个末端位姿，而且计算量小（就是一堆三角函数的连乘）。在 MoveIt2 里，FK 由机器人模型（URDF + SRDF）里的 `robot_state` 直接计算，每一帧都在做。

#### 1.2 逆运动学 IK（Inverse Kinematics）

逆运动学正好反过来：已知末端目标位姿，求一组关节角让它到达。

```text
IK：末端位姿 (x, y, z, rx, ry, rz)  →  关节角 [θ1, θ2, θ3]
```

IK 是运动学里"难"的部分，难在三个地方：

1.  **可能无解**：目标位姿在机械臂工作空间之外（比如离底座 3 米），任何关节角都到不了。
2.  **可能多解**：同一个末端位姿，肘部在上或肘部在下（θ2 不同）都能到达，IK 要选一个。
3.  **数值迭代**：对 6 自由度机械臂，没有通用的解析公式（除了少数特殊构型），只能迭代逼近。

#### 1.3 用类比理解

把机械臂想象成你的手臂：

-   **FK**：你告诉我肩、肘、腕各弯了多少度，我能算出你的手在哪——确定、简单。
-   **IK**：你告诉我"手要摸到桌上那杯水"，我得反算肩肘腕各该动多少——可能有好几种姿势都够得着，也可能够不着，还得避开水杯。

MoveIt2 的规划流程里，IK 被用在两处：一是 `set_pose_target` 时把"末端位姿"变成"关节目标"；二是在规划过程中的随机采样阶段，把随机位姿映射回关节空间。

### 二、MoveIt2 里的运动学求解流程

#### 2.1 move_group 的运动学服务

move_group 暴露了一个服务 `compute_fk`（FK）和 `compute_ik`（IK），但日常开发几乎用不到原始服务——高级接口（MoveGroupCommander / MoveGroupInterface）已经封装好了。

```text
MoveIt2 运动学调用链
你的节点 → MoveGroupCommander.set_pose_target()
        → move_group 内部 IK 求解
             → pluginlib 加载 kinematics.yaml 里指定的求解器
             → 求解器算出关节目标
        → 运动规划（OMPL）→ 轨迹
```

关键点：**求解器是插件**。MoveIt2 不内置唯一的 IK 算法，而是通过 pluginlib 机制加载，你可以在 `kinematics.yaml` 里随时换求解器，代码一行都不用改。

#### 2.2 kinematics.yaml 的作用

`arm_moveit_config/config/kinematics.yaml` 长这样：

```yaml
# kinematics.yaml：指定每个规划组用什么 IK 求解器
arm_group:
  kinematics_solver: kdl_kinematics_plugin/KDLKinematicsPlugin
  kinematics_solver_search_resolution: 0.005
  kinematics_solver_timeout: 0.005
  kinematics_solver_attempts: 3
```

四个字段：

```text
kinematics_solver                  # 求解器插件（pluginlib 名称）
kinematics_solver_search_resolution # 随机重启搜索步长（弧度）
kinematics_solver_timeout          # 单次求解超时（秒）
kinematics_solver_attempts         # 最多尝试次数
```

把 `kdl_kinematics_plugin` 换成 `trac_ik_kinematics_plugin/TRAC_IKKinematicsPlugin` 就切到了 TRAC-IK。这也是 MoveIt2"接口与实现分离"设计思想的体现。

#### 2.3 求解器插件机制（pluginlib）

pluginlib 是 ROS2 的插件加载库：运行时按名字查找并加载动态库。一个 IK 求解器插件需要：

```text
1. 实现 moveit::core::KinematicsBase 接口
2. 在 package.xml 里 export 插件描述
3. 提供插件描述 XML（声明类名/库名）
4. 编译成共享库
```

MoveIt2 自带 KDL、SRL、IKFast（需自行生成）等插件，社区常用 TRAC-IK。第 6 节我们手写一个最小插件来理解全流程。

### 三、KDL 求解器详解

#### 3.1 KDL 原理：雅可比迭代

KDL（Kinematics and Dynamics Library）是 Orocos 的运动学库，MoveIt2 默认用它的插件。KDL 的 IK 是**数值迭代法**，核心是雅可比矩阵 J：

```text
J = ∂f(θ)/∂θ      # 末端速度与关节速度的线性关系
Δx = J · Δθ       # 末端小位移 ≈ 雅可比 × 关节小位移

迭代过程：
1. 从初始关节角 θ0 开始（默认当前状态）
2. 算当前末端位姿 f(θ)，求误差 Δx = 目标 - 当前
3. 解线性方程 Δθ = J⁻¹·Δx（或伪逆）
4. θ ← θ + Δθ，重复直到误差小于阈值或超时
```

KDL 默认用阻尼最小二乘（DLS）变体，在奇异点附近通过阻尼因子保持数值稳定，代价是精度略降。

#### 3.2 KDL 的局限

KDL 在工程上有几个已知痛点：

```text
1. 容易陷入局部最优：初始值离解太远时迭代不收敛
2. 对奇异构型敏感：接近奇异时雅可比病态，解抖动
3. 6 自由度机械臂偶尔无解：某些位形下迭代震荡
4. 求解慢：单次求解可能 1~10ms，复杂机械臂更久
```

这就是为什么 MoveIt2 默认参数给了 `attempts: 3` 和 `search_resolution: 0.005`——失败后会在附近随机重试，提高成功率。

#### 3.3 求解精度与超时

```text
kinematics_solver_timeout: 0.005   # 5ms 内必须收敛
kinematics_solver_attempts: 3      # 最多 3 次尝试
kinematics_solver_search_resolution: 0.005  # 每次重试偏移量
```

调参经验：机械臂构型越复杂、目标越接近工作空间边界，越需要加大 attempts；实时代价是规划变慢。通常先保持默认，遇到"偶发无解"再逐个加大。

### 四、TRAC-IK 与 IKFast

#### 4.1 TRAC-IK：多线程 + 随机重启

TRAC-IK 是 KDL 的"加强版"，由 NASA/TRA 实验室开发，核心改进：

```text
1. 同时跑 KDL 变体和 SQP（序列二次规划）两种求解器
2. 多线程并行，先收敛者胜出
3. 失败时自动随机重启，避开局部最优
4. 平均求解成功率显著高于 KDL
```

安装与启用：

```bash
sudo apt install ros-humble-trac-ik-kinematics-plugin
```

```yaml
# kinematics.yaml
arm_group:
  kinematics_solver: trac_ik_kinematics_plugin/TRAC_IKKinematicsPlugin
  kinematics_solver_timeout: 0.005
  kinematics_solver_attempts: 3
```

TRAC-IK 还有额外的求解模式（速度/距离最优化），在 `kinematics_solver_type` 字段配置。大多数项目直接换 TRAC-IK 就能明显提升 IK 稳定性。

#### 4.2 IKFast：解析解生成器

IKFast 是 OpenRAVE 的工具，对特定机械臂构型**离线生成解析解**代码——不迭代，直接按公式算，速度快且精确。

```bash
# 流程（Humble 上常见做法）
python3 openrave_ikfast_gen.py --iktype=transform6d \
    --robot=arm.robot.xml --ikframes=tool0 --baselink=base_link \
    -o ikfast_arm.cpp
```

优缺点：

```text
优点：求解快（微秒级）、无局部最优、精度高
缺点：每个构型（6R 球腕等）都要重新生成；代码量大；
     非 6 自由度或特殊构型可能无法生成；维护成本高
```

适合量产机械臂（构型固定）；学习与原型阶段通常先用 KDL/TRAC-IK。

#### 4.3 对比与选型

| 求解器 | 类型 | 速度 | 成功率 | 适用场景 |
| --- | --- | --- | --- | --- |
| KDL | 数值迭代（DLS） | 中（ms 级） | 中 | 默认入门、原型验证 |
| TRAC-IK | 数值+并行+随机重启 | 中（ms 级） | 高 | 大多数工程项目（首选） |
| IKFast | 解析解 | 快（μs 级） | 极高 | 量产固定构型机械臂 |
| SRL/自定义 | 可定制 | 视实现 | 视实现 | 特殊需求（如冗余自由度） |

### 五、调用 IK/FK（Python + C++）

#### 5.1 示例 1：用 move_group 求 IK（Python）

`set_pose_target` 内部就调用了 IK，但如果你想"只求 IK 不规划"，可以用 `compute_ik` 服务：

```bash
# 先启动 demo
ros2 launch arm_moveit_config demo.launch.py
```

```python
#!/usr/bin/env python3
# ~/dev_ws/src/arm_demo/arm_demo/compute_ik.py
import rclpy
from moveit_commander import MoveGroupCommander, RobotCommander
from geometry_msgs.msg import Pose

def main():
    rclpy.init()
    node = rclpy.create_node('compute_ik')
    robot = RobotCommander(node)
    group = MoveGroupCommander('arm_group', node)

    # 1. 目标位姿
    target = Pose()
    target.position.x = 0.30
    target.position.y = 0.10
    target.position.z = 0.25
    target.orientation.w = 1.0

    # 2. 调 compute_ik 服务
    from moveit_msgs.srv import GetPositionIK
    from moveit_msgs.msg import PositionIKRequest
    cli = node.create_client(GetPositionIK, '/compute_ik')
    req = GetPositionIK.Request()
    req.ik_request.group_name = 'arm_group'
    req.ik_request.pose_stamped.header.frame_id = 'base_link'
    req.ik_request.pose_stamped.pose = target
    req.ik_request.timeout.sec = 1

    if not cli.wait_for_service(timeout_sec=2.0):
        node.get_logger().error('compute_ik 服务不可用')
        return
    fut = cli.call_async(req)
    rclpy.spin_until_future_complete(node, fut)
    resp = fut.result()

    # 3. 打印结果
    if resp.error_code.val == resp.error_code.SUCCESS:
        print('IK 成功，关节角：', list(resp.solution.joint_state.position))
    else:
        print('IK 失败，error_code=', resp.error_code.val)

    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

`/compute_ik` 服务返回的 `solution.joint_state.position` 就是 IK 求得的关节角，可以直接喂给 `set_joint_value_target` 做规划。

#### 5.2 示例 2：验证 FK（Python）

有了关节角，再用 FK 验证一下末端位姿是否符合预期：

```python
#!/usr/bin/env python3
# ~/dev_ws/src/arm_demo/arm_demo/check_fk.py
import rclpy
from moveit_commander import MoveGroupCommander
from moveit_msgs.srv import GetPositionFK
from moveit_msgs.msg import RobotState

def main():
    rclpy.init()
    node = rclpy.create_node('check_fk')
    group = MoveGroupCommander('arm_group', node)

    # 1. 构造一个关节状态
    joint_angles = [0.5, -0.8, 1.2]   # 3 个活动关节

    # 2. 调 compute_fk 服务
    from geometry_msgs.msg import PoseStamped
    cli = node.create_client(GetPositionFK, '/compute_fk')
    req = GetPositionFK.Request()
    req.fk_link_names = ['tool0']
    req.robot_state.joint_state.name = group.get_active_joints()
    req.robot_state.joint_state.position = joint_angles
    req.header.frame_id = 'base_link'
    req.header.stamp = node.get_clock().now().to_msg()

    if not cli.wait_for_service(timeout_sec=2.0):
        node.get_logger().error('compute_fk 服务不可用')
        return
    fut = cli.call_async(req)
    rclpy.spin_until_future_complete(node, fut)
    resp = fut.result()

    if resp.error_code.val == resp.error_code.SUCCESS:
        p = resp.pose_stamped[0].pose
        print(f'FK 结果：x={p.position.x:.3f} y={p.position.y:.3f} z={p.position.z:.3f}')
    else:
        print('FK 失败')

    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

这个"IK 求角 → FK 验位"的闭环，是排查机械臂标定、URDF 参数错误的最常用手段。

#### 5.3 示例 3：C++ 方式（IK 求解）

```cpp
// src/check_ik.cpp（在 arm_planner_cpp 包内）
#include <rclcpp/rclcpp.hpp>
#include <moveit/move_group_interface/move_group_interface.h>
#include <moveit_msgs/srv/get_position_ik.hpp>

int main(int argc, char** argv) {
  rclcpp::init(argc, argv);
  auto node = std::make_shared<rclcpp::Node>("check_ik");
  auto executor = std::make_shared<rclcpp::executors::SingleThreadedExecutor>();
  executor->add_node(node);
  std::thread spin([&executor]() { executor->spin(); });

  auto cli = node->create_client<moveit_msgs::srv::GetPositionIK>("/compute_ik");
  if (!cli->wait_for_service(std::chrono::seconds(2))) {
    RCLCPP_ERROR(node->get_logger(), "compute_ik 服务不可用");
    return 1;
  }
  auto req = std::make_shared<moveit_msgs::srv::GetPositionIK::Request>();
  req->ik_request.group_name = "arm_group";
  req->ik_request.pose_stamped.header.frame_id = "base_link";
  req->ik_request.pose_stamped.pose.position.x = 0.30;
  req->ik_request.pose_stamped.pose.position.y = 0.10;
  req->ik_request.pose_stamped.pose.position.z = 0.25;
  req->ik_request.pose_stamped.pose.orientation.w = 1.0;
  req->ik_request.timeout.sec = 1;

  auto fut = cli->async_send_request(req);
  if (executor->spin_until_future_complete(fut) == rclcpp::FutureReturnCode::SUCCESS) {
    auto resp = fut.get();
    if (resp->error_code.val == moveit_msgs::msg::MoveItErrorCodes::SUCCESS) {
      RCLCPP_INFO(node->get_logger(), "IK 成功");
      for (size_t i = 0; i < resp->solution.joint_state.position.size(); ++i) {
        RCLCPP_INFO(node->get_logger(), "  joint[%zu] = %.3f",
                    i, resp->solution.joint_state.position[i]);
      }
    } else {
      RCLCPP_ERROR(node->get_logger(), "IK 失败 code=%d", resp->error_code.val);
    }
  }

  spin.join();
  rclcpp::shutdown();
  return 0;
}
```

```bash
# CMakeLists.txt 增加
find_package(moveit_msgs REQUIRED)
ament_target_dependencies(check_ik rclcpp moveit_ros_planning_interface moveit_msgs)
install(TARGETS check_ik DESTINATION lib/${PROJECT_NAME})
```

### 六、自定义运动学求解器插件

理解插件的机制，比背 API 更有价值。下面写一个"最小可用"的自定义 IK 求解器插件。

#### 6.1 实现 KinematicsBase 接口

```cpp
// src/my_ik_plugin/src/my_ik.cpp（简化示意）
#include <moveit/kinematics_base/kinematics_base.h>
#include <pluginlib/class_list_macros.hpp>

namespace my_ik {
class MyIK : public moveit::core::KinematicsBase {
public:
  bool initialize(const rclcpp::Node::SharedPtr& node,
                  const moveit::core::RobotModel& model,
                  const std::string& group,
                  const std::string& base_frame,
                  const std::vector<std::string>& tip_frames,
                  double search_discretization) override {
    // 保存模型、规划组、base/tip 帧
    // 从 URDF 读关节名、关节限位
    return true;
  }

  bool getPositionIK(const geometry_msgs::msg::Pose& ik_pose,
                     const std::vector<double>& ik_seed_state,
                     std::vector<double>& solution,
                     moveit_msgs::msg::MoveItErrorCodes& error_code,
                     const kinematics::KinematicsQueryOptions& options = {}) const override {
    // 这里实现你的 IK 算法（如雅可比迭代）
    // 成功：error_code.val = MoveItErrorCodes::SUCCESS
    return true;
  }

  bool getPositionFK(const std::vector<std::string>& link_names,
                     const std::vector<double>& joint_angles,
                     std::vector<geometry_msgs::msg::Pose>& poses,
                     moveit_msgs::msg::MoveItErrorCodes& error_code) const override {
    // 这里实现 FK：按 URDF 链乘算出各 link 位姿
    return true;
  }
  // 其余纯虚函数（getJointNames/getLinkNames 等）从略
};
}  // namespace my_ik
PLUGINLIB_EXPORT_CLASS(my_ik::MyIK, moveit::core::KinematicsBase)
```

`KinematicsBase` 的核心就是 `getPositionIK` 和 `getPositionFK` 两个虚函数，其余是一堆 getter。

#### 6.2 注册插件与配置

```xml
<!-- my_ik_plugin.xml（插件描述） -->
<library path="libmy_ik_plugin">
  <class name="my_ik_plugin/MyIK"
         type="my_ik::MyIK"
         base_class_type="moveit::core::KinematicsBase">
    <description>自定义 IK 求解器示例</description>
  </class>
</library>
```

```xml
<!-- package.xml 里 export -->
<export>
  <moveit_core plugin="${prefix}/my_ik_plugin.xml"/>
</export>
```

```yaml
# kinematics.yaml 指向自定义插件
arm_group:
  kinematics_solver: my_ik_plugin/MyIK
  kinematics_solver_timeout: 0.005
  kinematics_solver_attempts: 3
```

重新编译、重启 demo 后，move_group 就会用你的求解器。可以在 `getPositionIK` 里打印日志，验证确实被调用。

#### 6.3 测试与调试

```bash
colcon build --packages-select my_ik_plugin
ros2 launch arm_moveit_config demo.launch.py
# 拖拽 Goal 或调用 compute_ik，观察日志
```

常见坑：

```text
1. 插件未注册：日志报 "Failed to create instance of my_ik_plugin/MyIK"
   → 检查 package.xml export 与 XML 描述里的 class name 是否一致
2. 链接错误：编译过但加载失败 → 检查库路径与 PLUGINLIB_EXPORT_CLASS
3. 求解永远失败：先实现 getJointNames/getLinkNames 返回正确顺序
```

### 七、奇异点与多解处理

#### 7.1 奇异位形

奇异点（singularity）是机械臂某些关节角组合下"丢失自由度"的位形，典型例子：

```text
1. 手臂完全伸直：肘关节角度 0，无法改变末端径向速度
2. 手腕中心对齐肩轴：末端只能沿一个方向移动
3. 某关节角到达限位：该方向运动被锁死
```

奇异点附近雅可比矩阵病态，IK 迭代缓慢、解抖动，轨迹执行时可能突然出现"甩腕"动作。工程上避开方式：规划时给奇异点留安全距离，或用阻尼最小二乘平滑。

#### 7.2 多解选择策略

同一个末端位姿常有多个 IK 解（肘上/肘下、腕翻转）。MoveIt2 默认策略是**就近原则**：从当前关节角出发迭代，收敛到离当前姿态最近的解——这是数值迭代法的天然行为。

```text
从当前姿态出发 → IK 收敛到最近解
优点：轨迹平滑、不跳变
缺点：可能收敛到局部最优（非全局最近）
```

需要全局最优时：加大 `kinematics_solver_attempts` + `search_resolution`，用随机重启撒网。

#### 7.3 工程实践建议

```text
1. 首选 TRAC-IK：把 kinematics.yaml 换成 TRAC-IK 插件，成功率立涨
2. 设置合理超时：0.005s × 3 次起步，不够再加
3. 预校验可达性：规划前先求一次 IK，失败直接提示"目标不可达"
4. 奇异点附近降速：速度缩放调到 0.3 以下，避免执行抖动
5. 记录 IK 失败日志：把失败时的位姿/关节角存下来，便于复现调参
```

### 八、小结与第 38 篇预告

本篇把运动学讲透了：FK 是唯一确定的链乘，IK 是可能无解/多解的迭代问题；MoveIt2 用插件机制隔离算法与调用方，`kinematics.yaml` 一行就能换求解器；KDL 够用但易卡局部最优，TRAC-IK 是工程首选，IKFast 是量产利器；我们还写了自定义求解器插件的最小骨架。

核心要点：

1.  FK 由 URDF 链乘直接算出，唯一且快；IK 需要迭代，可能无解、多解、奇异。
2.  `kinematics.yaml` 的 `kinematics_solver` 指定求解器插件，改一行即可切换 KDL/TRAC-IK/自定义。
3.  `/compute_ik` 与 `/compute_fk` 服务可单独调用，IK 求角 → FK 验位是排查标配。
4.  自定义求解器：继承 `KinematicsBase`、实现 `getPositionIK/getPositionFK`、注册 pluginlib、改 kinematics.yaml。
5.  奇异点靠阻尼与降速规避；多解默认就近；工程首选 TRAC-IK。

下一章（第 38 篇）**「MoveIt2 碰撞检测与避障」**：深入 Planning Scene 的碰撞检测机制——FCL 库怎么算两个形状是否重叠、允许碰撞矩阵 ACM 的用法、在规划场景里加动态障碍物、碰撞检测的性能优化，以及"先碰撞检测、后避障规划"的完整工程流程。
