---
title: "ROS2系列教程：常用工具详解（ros2 CLI、rqt、RViz、ros2 bag、tf2基础）"
abbrlink: ros2-xi-lie-jiao-cheng-chang-yong-gong-ju-xiang-jie-ros2
date: "2026-09-05 15:49:12"
categories:
    - "ROS2"
tags: []
desc: "tf2是 ROS2 的坐标变换库：维护\"坐标系树\"，提供任意两个坐标系间的位姿变换。机器人上每个部件都有一个坐标系（base_link、laser、camera、map），tf2 让\"激光点坐标 →…"
---
## 本文是 ROS2 系列教程的第 12 篇

> 本文是 ROS2 系列教程的第 12 篇：常用工具详解。学到这里，你已经掌握了 ROS2 的核心机制，但"会用"和"会排障"之间还差一套趁手的工具。本篇文章系统梳理 ROS2 开发调试的"眼睛和双手"：`ros2` CLI 全家桶、可视化工具 rqt、RViz2 基础、ros2 bag 数据录制回放、tf2 工具基础。学完你将具备独立排障能力，能看懂任何 ROS2 系统的运行状态。

### 一、ros2 CLI 全家桶

#### 1.1 命令总览

`ros2` 是 ROS2 的统一命令行入口，所有子命令按功能分类：

```bash
ros2 node        # 节点管理
ros2 topic       # 话题管理
ros2 service     # 服务管理
ros2 action      # 动作管理
ros2 param       # 参数管理
ros2 interface   # 接口（消息/服务/动作类型）管理
ros2 pkg         # 包管理
ros2 launch      # launch 文件
ros2 bag         # 数据录制回放
ros2 daemon      # 后台守护进程管理
ros2 doctor      # 系统健康检查
ros2 run         # 运行节点
ros2 lifecycle   # 生命周期管理
```

查看帮助：

```bash
ros2 --help                  # 总帮助
ros2 topic --help            # 子命令帮助
ros2 topic hz --help         # 具体命令帮助
```

#### 1.2 node 与 pkg

```bash
# 节点
ros2 node list                    # 列出所有节点
ros2 node list --verbose          # 带详细类型信息
ros2 node info /talker            # 节点完整信息（话题/服务/参数/动作）

# 包
ros2 pkg list                     # 列出所有已安装包
ros2 pkg list | grep demo         # 过滤
ros2 pkg prefix demo_nodes_py     # 包安装位置
ros2 pkg executables demo_nodes_py  # 包内可执行命令
ros2 pkg xml demo_nodes_py        # 查看包元数据
```

**`ros2 node info` 是排障第一命令**：它能列出节点所有发布/订阅的话题、提供的服务、声明的参数、动作服务器——一眼看出"这个节点到底在干什么"。

#### 1.3 daemon 与缓存

`ros2` 命令依赖后台守护进程（daemon）维护节点信息缓存：

```bash
# 查看 daemon 状态
ros2 daemon status

# 停止 daemon（节点信息不准时用）
ros2 daemon stop

# 重新启动
ros2 daemon start
```

**常见坑**：节点明明关了，`ros2 node list` 还显示它——daemon 缓存过期。解决：`ros2 daemon stop && ros2 daemon start`。

#### 1.4 ros2 doctor：系统体检

```bash
ros2 doctor             # 检查系统健康
ros2 doctor --report    # 生成详细报告（贴到问题帖里很有效）
```

会检查：环境变量、发现协议、DDS 配置、网络等。**遇到诡异问题时先跑一次 doctor**。

### 二、rqt：可视化调试工具集

#### 2.1 rqt 总览

**rqt** 是 ROS2 的 GUI 工具集，提供大量可视化插件：

```bash
# 启动 rqt 主窗口（插件从菜单添加）
rqt

# 直接启动指定插件
rqt_graph              # ROS 图可视化（最常用）
rqt_console            # 日志控制台（过滤各级日志）
rqt_tf_tree            # TF 树可视化（坐标变换关系）
rqt_reconfigure        # 参数动态配置（滑块改参数）
rqt_plot               # 数据曲线绘制
rqt_image_view         # 图像话题可视化
```

#### 2.2 rqt_graph：看清系统结构

`rqt_graph` 是最重要的调试工具——把运行中的 ROS 图画出来：

```bash
rqt_graph
```

画面要素：

-   **椭圆** = 节点
-   **箭头** = 话题连接（发布者 → 订阅者）
-   **话题名**显示在连线上
-   隐藏 `/rosout` 等系统话题（勾选 “Hide debug”）

**用途**：

1.  一眼看出"谁在发、谁在收"。
2.  发现"应连未连"的断线（节点没收到数据时先看图）。
3.  确认重映射/命名空间是否生效。

#### 2.3 rqt_console：日志过滤

```bash
rqt_console
```

按**级别**（Debug/Info/Warn/Error/Fatal）和**节点**过滤日志，是排查运行问题的利器：所有节点的 Warn/Error 集中在一个界面，不用翻几十个终端。

#### 2.4 rqt_reconfigure：在线调参

```bash
rqt_reconfigure
```

左侧选节点，右侧出现该节点所有参数，**拖动滑块/勾选框实时修改**——比命令行 `ros2 param set` 直观得多。调 PID、调速度的利器。

#### 2.5 rqt_plot：数据可视化

```bash
rqt_plot /odom/pose/pose/position/x /odom/pose/pose/position/y
```

订阅数值型话题字段画曲线，适合观察里程计轨迹、传感器波形。

### 三、RViz2：3D 可视化

#### 3.1 RViz2 是什么

**RViz2** 是 ROS2 的 3D 可视化工具，展示机器人的位姿、传感器数据、地图、路径：

```bash
rviz2
```

#### 3.2 核心概念：Display 与 Fixed Frame

-   **Display（显示项）**：左侧面板的每一项，如 RobotModel、LaserScan、Map、Path。
-   **Fixed Frame（固定坐标系）**：3D 视图的参考系，默认 `map`；如果 TF 树里没有这个坐标系，视图会空。

**添加显示**：左下角 “Add” → 选择类型 → 在 Display 面板配置 Topic。

常用 Display：

| Display | 显示内容 | 配置要点 |
| --- | --- | --- |
| RobotModel | 机器人 3D 模型 | 加载 URDF，选 robot_description 话题 |
| LaserScan | 激光雷达点 | 选 /scan 话题 |
| PointCloud2 | 点云 | 选对应话题 |
| Map | 地图 | 选 /map |
| Path | 路径 | 选 /plan 等 |
| TF | 坐标系 | 显示所有 TF 坐标系与连线 |
| Grid | 网格 | 默认有，不用加 |

#### 3.3 RViz2 常用操作

```bash
# 启动并加载配置
rviz2 -d config.rviz          # 复用保存的配置

# 用 launch 启动（第 11 篇讲过）
```

**保存配置**：调好显示项后 `File → Save Config As`，下次 `-d` 加载——团队共享显示配置的标准做法。

#### 3.4 RViz2 排障经验

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 画面空白 | Fixed Frame 没有 TF | 确认 TF 树；改为存在的坐标系（如 base_link） |
| 没有 RobotModel | 没发布 robot_description | 启动 robot_state_publisher |
| 模型乱飘 | 缺少 joint_states | 启动 joint_state_publisher 或仿真 |
| 雷达点不显示 | QoS 不匹配 | RViz 里选 Sensor Data 档（best_effort） |

### 四、ros2 bag 实战

#### 4.1 录制

```bash
# 录制所有话题
ros2 bag record -a

# 录制指定话题
ros2 bag record /odom /scan /cmd_vel

# 指定目录与覆盖 QoS
ros2 bag record /scan -o scan_data \
  --qos-profile-overrides "{'sensor_msgs::msg::LaserScan': {reliability: 'best_effort'}}"
```

#### 4.2 查看与回放

```bash
# 查看 bag 信息
ros2 bag info scan_data
# Files: ...
# Topics: /scan (360 messages), ...

# 回放
ros2 bag play scan_data

# 指定话题、倍速、循环
ros2 bag play scan_data --topics /scan --rate 2.0 --loop
```

#### 4.3 bag 在调试中的价值

1.  **复现问题**：录下现场数据，离线反复回放分析。
2.  **算法对比**：同一份数据喂给不同算法版本，公平对比。
3.  **仿真回灌**：把真实传感器数据灌进仿真环境测试。
4.  **时间旅行**：`--start-offset`、`--duration` 控制播放区间。

### 五、tf2 工具基础

#### 5.1 什么是 tf2

**tf2** 是 ROS2 的坐标变换库：维护"坐标系树"，提供任意两个坐标系间的位姿变换。机器人上每个部件都有一个坐标系（base_link、laser、camera、map），tf2 让"激光点坐标 → 地图坐标"的换算自动完成。

#### 5.2 tf2 命令行工具

```bash
# 查看当前 TF 树（所有坐标系及父子关系）
ros2 run tf2_ros tf2_echo base_link laser
# At time ...: Translation: [0.1, 0.0, 0.2], Rotation: ...

# 查看 TF 树全貌（文本）
ros2 run tf2_ros tf2_monitor

# 可视化 TF 树（图形）
ros2 run tf2_tools view_frames    # 生成 frames.pdf

# rviz 里查看 TF 树
rqt_tf_tree
```

#### 5.3 静态坐标变换

固定关系的坐标系（如传感器在车体上的安装位置）用静态变换发布：

```bash
# 发布 base_link → laser 的静态变换（x=0.1, y=0, z=0.2, 无旋转）
ros2 run tf2_ros static_transform_publisher \
  0.1 0.0 0.2 0.0 0.0 0.0 base_link laser
```

### 六、综合实战：一个完整的排障流程

#### 6.1 场景

假设导航系统"地图显示但机器人不动"，按下面的流程排查：

#### 6.2 排障流程

```bash
# 第 1 步：系统体检
ros2 doctor

# 第 2 步：看节点是否都在
ros2 node list

# 第 3 步：看 ROS 图（谁连谁，有没有断线）
rqt_graph

# 第 4 步：看关键话题数据流
ros2 topic list
ros2 topic hz /cmd_vel          # 有没有指令输出？
ros2 topic hz /odom             # 里程计有没有数据？
ros2 topic echo /cmd_vel --once # 指令内容是什么？

# 第 5 步：看日志（错误集中地）
rqt_console

# 第 6 步：看 TF 树（坐标是否完整）
ros2 run tf2_tools view_frames

# 第 7 步：看参数
ros2 param list /nav2_controller
ros2 param get /nav2_controller controller_frequency

# 第 8 步：录数据离线分析
ros2 bag record -a
```

**排查顺序口诀**：先 doctor 体检 → 再 node list 看存活 → 再 rqt_graph 看连接 → 再 topic 看数据 → 再 console 看错误 → 再 tf 看坐标 → 最后 param 看配置。

#### 6.3 判断矩阵

| 症状 | 可能原因 | 验证命令 |
| --- | --- | --- |
| 话题无数据 | 发布者没跑 / QoS 不匹配 | `ros2 topic hz` + `--verbose` |
| 节点不在列表 | 没启动 / 崩了 | `ros2 node list` + rqt_console |
| 有数据但不动 | 控制链断 / 参数错 | rqt_graph + `ros2 param get` |
| 坐标错误 | TF 缺失 / 静态变换错 | view_frames + tf2_echo |
| 时灵时不灵 | 网络 / 时序 / 缓存 | doctor + daemon restart + 录 bag |

### 七、其他实用技巧

#### 7.1 日志级别控制

```bash
# 全局提高日志级别
ros2 run py_demo sensor_node --ros-args --log-level DEBUG

# 只对特定 logger 提高（如只调试话题）
ros2 run py_demo sensor_node --ros-args \
  --log-level sensor_node:=DEBUG
```

#### 7.2 命令行补全

```bash
# 安装命令补全（输一半按 Tab 补全包名/话题名/类型）
# 在 ~/.bashrc 中已由 ROS2 安装脚本配置
ros2 topic pub /<TAB>    # 自动补全话题名
```

#### 7.3 一键查看所有话题频率

```bash
# 查看所有话题的发布频率概览
ros2 topic list -t
# 逐个 hz 不方便时，用 rqt 的 Topic Monitor 插件
```

### 八、ros2 bag 进阶与数据工程

#### 8.1 录制过滤与压缩

```bash
# 排除指定话题（如高频图像，避免 bag 巨大）
ros2 bag record -a -x "/camera/.*|/debug/.*"

# 压缩存储（SQLite3 格式支持压缩）
ros2 bag record -a --compression-mode file --compression-format zstd

# 多路录制到同一文件
ros2 bag record /odom /scan /cmd_vel -o session_$(date +%Y%m%d_%H%M%S)
```

**实践建议**：默认 `record -a` 会连 `/parameter_events`、`/rosout` 等系统话题一起录，bag 偏大；正式采集用 `-x` 排除无关话题。

#### 8.2 时间操作

```bash
# 只看某个时间窗口
ros2 bag play session_bag --start-offset 10 --duration 20

# 按真实时间播放（默认按录制节奏，也可倍速）
ros2 bag play session_bag --rate 0.5    # 慢放
ros2 bag play session_bag --rate 2.0    # 快放

# 播放时重映射话题（换个话题名回放）
ros2 bag play session_bag --remap /scan:=/scan_offline
```

#### 8.3 用 bag 做离线算法验证

```python
# offline_test.py —— 读取 bag 数据喂给算法（伪代码）
import rclpy
from rclpy.node import Node
from rclpy.serialization import deserialize_message
from rosbags.rosbag2 import Reader
from rosbags.typesys import get_types_from_msg, Stores

# 用 rosbags 库（pip install rosbags）解析 bag
with Reader('session_bag') as reader:
    for connection, timestamp, rawdata in reader.messages():
        if connection.topic == '/scan':
            msg = deserialize_message(rawdata, connection.msgtype)
            # 把 msg 喂给你的算法函数
            process_scan(msg)
```

这是"数据驱动开发"的标准姿势：**先录数据，再离线迭代算法，最后上真机**——比每次都在真机上调试安全高效得多。

### 九、ros2 lifecycle 与安全工具

#### 9.1 生命周期节点

有些节点（如 Nav2 的控制器）需要**受控启停**：先配置、再激活，出错可回退。这就是生命周期（Lifecycle）节点，状态机如下：

```text
Unconfigured → Inactive → Active
     ↑           ↓          ↓
  (configure)  (activate)  (deactivate)
     └── 任何状态都可 shutdown
```

```bash
# 查看生命周期节点状态
ros2 lifecycle get /nav2_controller
# 输出: [1] unconfigured

# 触发状态切换（configure → activate）
ros2 lifecycle set /nav2_controller configure
ros2 lifecycle set /nav2_controller activate

# 列出所有生命周期节点
ros2 lifecycle nodes
```

**工程价值**：导航系统启动时先让所有模块进入 Inactive，全部配置好、TF 就绪后再统一 activate——避免"数据没准备好就开跑"的竞态问题。

#### 9.2 SROS2 安全基础

```bash
# 检查安全相关配置
ros2 security list

# 生成密钥（启用加密通信的前置步骤）
ros2 security create_keystore keystore
ros2 security create_enclave keystore /namespace/node

# 以安全模式启动
export ROS_SECURITY_KEYSTORE=keystore
export ROS_SECURITY_ENABLE=true
export ROS_SECURITY_STRATEGY=Enforce
```

SROS2 提供加密（TLS/DTLS）与访问控制（权限文件），是 ROS2 上工业/安全场景的标配，也解释了"为什么 ROS2 比 ROS1 安全"。

#### 9.3 性能分析工具

```bash
# 话题收发延迟概览（内置）
ros2 topic delay /odom          # 发布-订阅时间差

# 回调耗时统计（rclpy/rclcpp 内置 tracer）
# 更细粒度分析用 ros2_tracing（系统级 tracing）

# 查看节点资源占用
ros2 topic hz --window 100 /odom   # 最近 100 条的消息间隔统计
```

### 十、综合实战：多机调试与日志分析

#### 10.1 多机场景的调试

ROS2 天然支持多机，但调试时先确认"是否真的连通"：

```bash
# 机器 A 上跑节点
ros2 run py_demo sensor_node

# 机器 B 上应能看到（同一网络/DDS 域）
ros2 node list

# 看不到时的排查
export ROS_DOMAIN_ID=42       # 两台机器必须一致
ros2 doctor                   # 检查网络与发现协议
```

#### 10.2 日志集中分析

```bash
# 把日志导到文件分析
ros2 run py_demo sensor_node 2>&1 | tee sensor.log

# 统计错误出现频率
grep -c "ERROR" sensor.log

# 按时间排序查看错误上下文
grep -B 2 -A 2 "ERROR" sensor.log | head -50
```

#### 10.3 完整工具链实战演练

```bash
# 场景：机器人偶发"丢里程计"，需要定位
# 1. 先录 10 分钟数据
ros2 bag record /odom /cmd_vel /scan -o diag_bag &

# 2. 同时监控频率抖动
ros2 topic hz /odom --window 100

# 3. 出问题后立即看 daemon 状态与 doctor
ros2 doctor --report > doctor.txt

# 4. 停止录制，离线分析
ros2 bag info diag_bag
ros2 bag play diag_bag --rate 0.5   # 慢放观察

# 5. 结合 rqt_graph 确认拓扑、rqt_console 看错误
```

这套流程覆盖"实时监控 → 现场记录 → 离线复现 → 定位根因"，是 ROS2 工程排障的标准闭环。

### 十一、总结

本篇文章建立了完整的工具链：`ros2` CLI 全家桶（含 daemon 与 doctor）、rqt 可视化工具集（graph/console/reconfigure/plot）、RViz2 3D 可视化、ros2 bag 录制回放与离线算法验证、tf2 工具、生命周期与安全工具，并通过综合排障流程演示了"工具组合拳"。

**关键要点回顾**：

1.  `ros2 node info` 是了解节点的第一命令；`ros2 daemon stop/start` 解决缓存问题。
2.  排障遇到诡异问题先 `ros2 doctor`。
3.  `rqt_graph` 看系统结构、`rqt_console` 集中看错误、`rqt_reconfigure` 在线调参。
4.  RViz2 画面空白先查 Fixed Frame 与 TF 树。
5.  ros2 bag 是"录现场、离线查"的利器，还能做离线算法验证。
6.  tf2 工具（tf2_echo/view_frames）是坐标排障的基础。
7.  生命周期节点用 `ros2 lifecycle set` 受控启停；SROS2 提供加密与访问控制。
8.  综合排障顺序：doctor → node → graph → topic → console → tf → param → bag。
9.  多机调试先确认 `ROS_DOMAIN_ID` 一致与网络连通；日志用 tee 落盘 + grep 分析。

### 下一篇预告

下一篇开启**机器人学篇**：**运动学基础——位姿与坐标变换**。机器人编程绕不开坐标系：机器人位姿怎么表示（位置+姿态）、旋转的三种表示（欧拉角/旋转矩阵/四元数）、坐标变换的数学本质、ROS2 中姿态的规范。这是后续 tf2、URDF、导航、机械臂所有篇章的数学地基。
