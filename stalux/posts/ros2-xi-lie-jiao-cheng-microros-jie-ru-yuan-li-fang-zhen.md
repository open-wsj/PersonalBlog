---
title: "ROS2系列教程：MicroROS接入（原理+仿真）"
abbrlink: ros2-xi-lie-jiao-cheng-microros-jie-ru-yuan-li-fang-zhen
date: "2026-10-14 00:49:47"
categories:
    - "ROS2"
tags: []
desc: "本文详解ROS2 MicroROS接入原理与仿真实践，解决嵌入式设备与上位机通信的通用性难题。通过MicroROS架构（Client+Agent+传输层），实现MCU作为ROS2节点无缝接入系统…"
---
## 本文是 ROS2 系列教程的第 27 篇

> 本文是 ROS2 系列教程的第 27 篇：MicroROS 接入（原理+仿真）。第 26 篇我们建立了嵌入式开发的基础认知：GPIO、点灯、串口调试。但嵌入式程序是"孤岛"——它怎么和 ROS2 上位机对话？传统做法是自己定义串口协议，麻烦且不通用。ROS2 官方给出的标准答案是 **MicroROS（micro-ROS）**：让单片机直接作为 ROS2 节点接入系统。本篇讲解 MicroROS 的原理、Agent/Client 架构，并用仿真环境完整跑通"单片机节点"与上位机通信的流程，为第 28 篇 ROS2-Control 打基础。

### 一、为什么需要 MicroROS

#### 1.1 传统串口协议的痛点

在第 26 篇我们提到，上位机与下位机最常见的通信方式是**自定义串口协议**：上位机发 `"CMD:FORWARD:SPEED=0.5"`，下位机解析执行。这种方式在简单项目里够用，但有明显问题：

| 痛点 | 说明 |
| --- | --- |
| 协议不通用 | 每家机器人厂商的协议都不同，换硬件就得重写通信层 |
| 语义丢失 | 数据帧里没有"话题名、类型、时间戳"等 ROS2 概念 |
| 工具链断裂 | 无法用 `ros2 topic`、`rviz2`、`ros2 bag` 直接查看下位机数据 |
| 双向开发成本高 | 上位机和下位机各写一套解析代码，容易不一致 |
| 无 QoS 支持 | 无法表达"可靠性、易失性"等传输需求 |

#### 1.2 MicroROS 的答案：让 MCU 成为 ROS2 节点

MicroROS 是 ROS2 官方的嵌入式方案，核心思想：**在资源极其有限的 MCU 上运行 ROS2 的客户端库（rcl），并通过串口/USB 与上位机上的 micro-ROS Agent 桥接**。对上层 ROS2 系统来说，MCU 就是一个普通节点：能发布话题、订阅话题、调服务、用参数，完全透明。

架构图：

```text
┌─────────────────── 上位机（Linux） ───────────────────┐
│  ROS2 图：/micro_ros_node 发布 /cmd_vel 订阅 /odom     │
│              │                                        │
│      micro-ROS Agent（代理，把串口数据转成 ROS2 DDS）    │
└──────────────│────────────────────────────────────────┘
               │ 串口 / USB / Wi-Fi（UART/Serial/UDP）
┌──────────────│────────────────────────────────────────┐
│               │                                        │
│      micro-ROS Client（运行在 MCU 上的 rcl 实现）        │
│   MCU：STM32 / ESP32 / Arduino ...                    │
└───────────────────────────────────────────────────────┘
```

关键组件：

-   **micro-ROS Client**：运行在 MCU 上，是 ROS2 客户端库（rcl）的精简实现（rclc），提供 `rclc_init`、`rclc_node_init`、`rclc_publisher_init` 等 API。代码在 MCU 上编译。
-   **micro-ROS Agent**：运行在上位机（或局域网主机），是一个 ROS2 节点，负责与 Client 建立传输通道（串口、USB、Wi-Fi），并把 Client 的请求代理到 ROS2 图。Agent 本质上是"网桥"。
-   **传输层**：Client 与 Agent 之间的通信链路，常用 UART（串口）、UDP（Wi-Fi/以太网）。

#### 1.3 MicroROS 与 ROS2 原生节点的关系

MicroROS 节点和原生 ROS2 节点在**图层面完全等价**：`ros2 node list` 能看到它，`ros2 topic echo` 能收它的数据，RViz 能订阅它的消息。区别只在内部实现：

| 对比项 | ROS2 原生节点 | MicroROS 节点 |
| --- | --- | --- |
| 运行环境 | Linux + 完整 DDS 栈 | MCU + 精简 DDS（Micro XRCE-DDS） |
| 内存需求 | 数百 MB | 几十 KB |
| 实时性 | 一般 | 强 |
| 支持的消息类型 | 全部 | 常用类型（可自定义生成） |
| 传输 | DDS 网络 | 串口/USB/Wi-Fi 代理 |

理解 MicroROS 的关键一句话：**MicroROS 是"把 ROS2 的接口跑在单片机上的方案"，MCU 依然是节点，只是数据通路经过了 Agent 代理**。

### 二、MicroROS 核心机制（原理）

#### 2.1 三层架构

MicroROS 的技术栈从上到下分三层：

1.  **应用层**：我们的业务代码，用 rclc API 写，比如 `rclc_publisher_init` 创建一个发布者。
2.  **中间层**：rcl（ROS2 客户端库的精简版）→ rmw（ROS2 中间件接口）→ Micro XRCE-DDS（精简 DDS 协议）。
3.  **传输层**：XRCE 协议通过 UART/UDP 传输到 Agent。

其中 **Micro XRCE-DDS** 是核心协议：它在 MCU 端维护一个 DDS 客户端的"影子"，由 Agent 代为完成 DDS 网络的真正通信。MCU 只管本地逻辑，网络细节全部交给 Agent。

#### 2.2 Agent 的两种模式

Agent 可以运行在：

-   **本机模式**：Agent 和 ROS2 上位机在同一台机器（如树莓派、Jetson），MCU 通过串口连上位机。最常见。
-   **远程模式**：Agent 运行在局域网某台 PC 上，MCU 通过 Wi-Fi（UDP）连到该 PC。适合 MCU 离上位机较远的情况。

无论是哪种模式，对 MCU 代码来说几乎无差别（只是传输参数不同），这正是 MicroROS 设计的巧妙之处。

#### 2.3 生命周期

MicroROS 节点和原生节点一样有生命周期：创建上下文 → 创建节点 → 创建发布者/订阅者 → 进入执行循环（`rclc_executor_spin`）→ 关闭。

```text
rclc_support_init      初始化运行时上下文
    ↓
rclc_node_init_default 创建节点
    ↓
rclc_publisher_init_*  创建发布者（或订阅者/服务）
    ↓
rclc_executor_init     创建执行器（绑定节点）
    ↓
rclc_executor_add_*    注册订阅者回调等
    ↓
rclc_executor_spin     循环执行（主循环）
```

### 三、仿真环境准备

#### 3.1 本教程的仿真思路

在没有真实 MCU 的情况下，怎么学 MicroROS？答案是：**MicroROS 官方提供了"Host 模式"**——在 Linux 上位机上，把 PC 模拟成 MicroROS Client（用 PC 的处理器跑 Client 代码）。这样我们不需要任何硬件，就能：

1.  体验完整的 MicroROS 开发流程（写 Client 代码、编译、运行）。
2.  看到 MCU 节点如何被 Agent 桥接到 ROS2 图。
3.  为后续真机（ESP32/STM32）移植做好代码层面的准备。

#### 3.2 环境要求与安装

仿真需要 Docker（最省事）或手动源码编译。推荐 Docker：

```bash
# 1. 拉取 MicroROS Docker 镜像（官方提供 ROS2 Humble 版本）
docker pull microros/micro-ros-agent:humble

# 2. 安装 micro-ros-agent 到本机（也可在 Docker 内运行）
# 方式 A：Docker 运行（推荐，隔离环境）
docker run -it --rm -v /dev:/dev --privileged --net=host \
  microros/micro-ros-agent:humble serial --dev /dev/ttyUSB0 -b 115200

# 方式 B：本机源码安装
# 建工作空间，clone micro-ros-agent 源码后 colcon build
mkdir -p ~/micro_ros_agent_ws/src && cd ~/micro_ros_agent_ws
git clone https://github.com/micro-ROS/micro-ROS-Agent.git src/micro-ROS-Agent
colcon build
source install/setup.bash
```

#### 3.3 准备 micro_ros_agent 工作空间

在 Docker 之外，我们还需要在**本机 ROS2 环境**里安装 micro-ros-agent 的包，这样 `ros2 run micro_ros_agent micro_ros_agent` 命令才可用。完整流程（Humble）：

```bash
# 安装依赖
sudo apt update
sudo apt install -y python3-pip python3-rosdep

# 创建工作空间并克隆
mkdir -p ~/micro_ros_agent_ws/src && cd ~/micro_ros_agent_ws
git clone -b humble https://github.com/micro-ROS/micro-ROS-Agent.git src/micro-ROS-Agent

# 安装依赖并编译（注意 source 环境）
source /opt/ros/humble/setup.bash
rosdep install --from-paths src --ignore-src -y
colcon build
source install/setup.bash

# 验证
ros2 run micro_ros_agent micro_ros_agent serial --help
```

### 四、示例 1：启动 micro-ROS Agent

Agent 是 MicroROS 通信的"桥梁"，必须最先启动。它本质是一个 ROS2 节点，所以可以和其他节点一样用 `ros2 run` 启动。

```bash
# 终端 1：启动 ROS2 环境
source /opt/ros/humble/setup.bash

# 启动 Agent（本机模式，串口连接，波特率 115200）
ros2 run micro_ros_agent micro_ros_agent serial --dev /dev/ttyUSB0 -b 115200

# 如果使用 UDP 模式（Wi-Fi 连接），用：
# ros2 run micro_ros_agent micro_ros_agent udp4 --port 8888
```

启动后终端会显示等待 Client 连接的信息。验证 Agent 节点是否出现在 ROS2 图：

```bash
# 终端 2：查看节点列表，应能看到 /micro_ros_agent
ros2 node list
# 预期输出包含：
# /micro_ros_agent
```

小技巧：Agent 支持同时连接多个 Client，每个 Client 有自己的命名空间，方便区分多个下位机。

### 五、示例 2：Host 模式运行 Client（PC 模拟 MCU）

这是本篇的**核心仿真实验**：在没有硬件的 PC 上，运行一个 MicroROS Client 节点，让它与 Agent 建立连接，成为 ROS2 图里的一员。

#### 5.1 准备 Client 编译环境

MicroROS Client 代码用 C 编写，使用 micro-ROS 提供的构建工具链编译。官方提供 `micro_ros_setup` 或 Docker 镜像：

```bash
# 拉取 Client 编译镜像（Humble 版本）
docker pull microros/micro-ros-agent:humble

# 或者用 micro-ros-setup 脚本（推荐在 Docker 里）
docker run -it --rm -v $(pwd):/work --net=host \
  microros/micro-ros-agent:humble bash
```

#### 5.2 编写 Client 代码：发布者（心跳节点）

在容器内创建源码文件 `heartbeat_pub.c`，这是一个"心跳发布者"：定时向话题 `/heartbeat` 发布一条消息，模拟 MCU 上报状态。

```c
// heartbeat_pub.c：MicroROS 心跳发布者（模拟 MCU 节点）
#include <rcl/rcl.h>
#include <rclc/rclc.h>
#include <rclc/executor.h>
#include <std_msgs/msg/int32.h>

#define RCCHECK(fn) { rcl_ret_t temp_rc = fn; \
  if ((temp_rc != RCL_RET_OK)) { for (;;) {} } }
#define RCSOFTCHECK(fn) { rcl_ret_t temp_rc = fn; \
  if ((temp_rc != RCL_RET_OK)) {} }

rcl_publisher_t publisher;
std_msgs__msg__Int32 msg;

// 定时回调：心跳值加 1
void timer_callback(rcl_timer_t *timer, int64_t last_call_time) {
  (void) last_call_time;
  if (timer != NULL) {
    msg.data++;
    rcl_publish(&publisher, &msg, NULL);
    printf("heartbeat: %d\n", msg.data);
  }
}

int main() {
  rcl_allocator_t allocator = rcl_get_default_allocator();
  rclc_support_t support;
  rcl_init_options_t init_options = rcl_get_zero_initialized_init_options();
  RCCHECK(rcl_init_options_init(&init_options, rcl_get_default_allocator()));
  RCCHECK(rclc_support_init_with_options(&support, 0, NULL, &init_options, &allocator));

  // 创建节点
  rcl_node_t node;
  RCCHECK(rclc_node_init_default(&node, "heartbeat_node", "", &support));

  // 创建发布者
  RCCHECK(rclc_publisher_init_default(
    &publisher, &node, ROSIDL_GET_MSG_TYPE_SUPPORT(std_msgs, msg, Int32), "/heartbeat"));

  // 创建定时器（500ms 触发一次）
  rcl_timer_t timer;
  RCCHECK(rclc_timer_init_default(
    &timer, &support, RCL_MS_TO_NS(500), timer_callback));

  // 创建执行器并注册定时器
  rclc_executor_t executor;
  RCCHECK(rclc_executor_init(&executor, &support.context, 1, &allocator));
  RCCHECK(rclc_executor_add_timer(&executor, &timer));

  printf("heartbeat_node started, publishing to /heartbeat\n");

  // 主循环
  for (;;) {
    rclc_executor_spin_some(&executor, RCL_MS_TO_NS(100));
  }

  RCCHECK(rcl_publisher_fini(&publisher, &node));
  RCCHECK(rcl_node_fini(&node));
  return 0;
}
```

#### 5.3 编译并运行

在 Docker 容器内编译（Host 模式编译成 PC 可执行文件）：

```bash
# 在容器内，micro_ros_agent 镜像自带构建脚本
# 以 Host 模式构建
source /uros_ws/install/setup.bash
colcon build --packages-select micro_ros_agent  # 构建 Agent（可选）

# 编译上面的 C 文件（需要链接 micro_ros_client 库）
# 更简单的方式：使用官方 micro_ros_static_library 构建脚本
# 假设已在 /uros_ws 下创建了 microros 静态库
gcc heartbeat_pub.c -o heartbeat_pub \
  -I/uros_ws/install/include \
  -L/uros_ws/lib -lmicroros
```

对于没有 Docker 环境的朋友，官方还提供了 **micro_ros_utilities** 静态库生成脚本，这里不展开，重点是理解流程。

#### 5.4 在 ROS2 侧验证

Host 模式的 Client 运行时，会在本机直接连接 Agent（或通过 UDP 连接远程 Agent）：

```bash
# 终端 1：启动 Agent（UDP 模式，因为 Host 模式走 UDP）
ros2 run micro_ros_agent micro_ros_agent udp4 --port 8888

# 终端 2：运行 Client（在编译出 heartbeat_pub 的容器/目录下）
./heartbeat_pub

# 终端 3：验证 ROS2 侧
ros2 node list
# 应看到：/micro_ros_agent 和 /heartbeat_node

ros2 topic list
# 应看到：/heartbeat

ros2 topic echo /heartbeat std_msgs/msg/Int32
# 应不断打印：data: 1, data: 2, data: 3 ...
```

**这一刻的意义**：一个"单片机"（其实是 PC 模拟的）通过 Agent 成功接入 ROS2 图，其他节点可以直接订阅它的数据。这就是 MicroROS 的核心价值——换到真实 MCU 上，代码逻辑完全一样，只是编译目标不同。

### 六、示例 3：订阅者（接收上位机指令）

有发布就要有订阅。MCU 上最常见的场景：订阅上位机发来的控制指令。这里模拟"MCU 收到速度指令后打印执行"。

```c
// cmd_sub.c：MicroROS 订阅者（接收 /cmd_vel 指令，模拟执行）
#include <rcl/rcl.h>
#include <rclc/rclc.h>
#include <rclc/executor.h>
#include <geometry_msgs/msg/twist.h>

#define RCCHECK(fn) { rcl_ret_t temp_rc = fn; \
  if ((temp_rc != RCL_RET_OK)) { for (;;) {} } }

rcl_subscription_t subscriber;
geometry_msgs__msg__Twist msg;

// 订阅回调：收到速度指令后"执行"（这里打印）
void subscription_callback(const void *msgin) {
  const geometry_msgs__msg__Twist *twist = msgin;
  printf("exec cmd_vel: linear=%.2f angular=%.2f\n",
         twist->linear.x, twist->angular.z);
}

int main() {
  rcl_allocator_t allocator = rcl_get_default_allocator();
  rclc_support_t support;
  RCCHECK(rclc_support_init(&support, 0, NULL, &allocator));

  rcl_node_t node;
  RCCHECK(rclc_node_init_default(&node, "cmd_sub_node", "", &support));

  RCCHECK(rclc_subscription_init_default(
    &subscriber, &node,
    ROSIDL_GET_MSG_TYPE_SUPPORT(geometry_msgs, msg, Twist),
    "/cmd_vel"));

  rclc_executor_t executor;
  RCCHECK(rclc_executor_init(&executor, &support.context, 1, &allocator));
  RCCHECK(rclc_executor_add_subscription(
    &executor, &subscriber, &msg, &subscription_callback, ON_NEW_DATA));

  printf("cmd_sub_node started, waiting for /cmd_vel...\n");

  for (;;) {
    rclc_executor_spin_some(&executor, RCL_MS_TO_NS(100));
  }

  RCCHECK(rcl_subscription_fini(&subscriber, &node));
  RCCHECK(rcl_node_fini(&node));
  return 0;
}
```

验证（注意：`ON_NEW_DATA` 是订阅者回调触发模式，表示有新消息才回调）：

```bash
# 终端 1：启动 Agent
ros2 run micro_ros_agent micro_ros_agent udp4 --port 8888

# 终端 2：运行订阅者 Client
./cmd_sub

# 终端 3：用 ros2 发送速度指令（模拟上位机控制）
ros2 topic pub /cmd_vel geometry_msgs/msg/Twist \
  "{linear: {x: 0.5, y: 0.0, z: 0.0}, angular: {x: 0.0, y: 0.0, z: 0.3}}" \
  --once

# Client 侧应打印：
# exec cmd_vel: linear=0.50 angular=0.30
```

这个实验展示了 MCU 最常见的角色：**执行上位机的指令**。后面 ROS2-Control（第 28 篇）的硬件接口，本质就是这个模式——只是把"打印"换成"给电机 PWM"。

### 七、示例 4：服务端（MCU 提供服务）

有些场景下 MCU 不只是执行者，还要**提供服务**：比如"获取电池电量"“设置 LED 状态”。MicroROS 也支持服务端。

```c
// led_srv.c：MicroROS 服务端（设置 LED 状态的服务）
#include <rcl/rcl.h>
#include <rclc/rclc.h>
#include <rclc/executor.h>
#include <example_interfaces/srv/set_bool.h>

#define RCCHECK(fn) { rcl_ret_t temp_rc = fn; \
  if ((temp_rc != RCL_RET_OK)) { for (;;) {} } }

rcl_service_t service;
example_interfaces__srv__SetBool_Request req;
example_interfaces__srv__SetBool_Response res;

// 服务回调：处理"设置 LED"请求
void service_callback(const void *request, void *response) {
  const example_interfaces__srv__SetBool_Request *r = request;
  example_interfaces__srv__SetBool_Response *s = response;
  s->success = true;
  if (r->data) {
    s->message = "led on";   // 真实 MCU 这里调用 HAL_GPIO_WritePin
  } else {
    s->message = "led off";
  }
  printf("set led: %s\n", s->message);
}

int main() {
  rcl_allocator_t allocator = rcl_get_default_allocator();
  rclc_support_t support;
  RCCHECK(rclc_support_init(&support, 0, NULL, &allocator));

  rcl_node_t node;
  RCCHECK(rclc_node_init_default(&node, "led_srv_node", "", &support));

  RCCHECK(rclc_service_init_default(
    &service, &node,
    ROSIDL_GET_SRV_TYPE_SUPPORT(example_interfaces, srv, SetBool),
    "/set_led"));

  rclc_executor_t executor;
  RCCHECK(rclc_executor_init(&executor, &support.context, 1, &allocator));
  RCCHECK(rclc_executor_add_service(
    &executor, &service, &req, &res, service_callback));

  printf("led_srv_node started, service /set_led ready\n");

  for (;;) {
    rclc_executor_spin_some(&executor, RCL_MS_TO_NS(100));
  }
  return 0;
}
```

验证：

```bash
# 终端 2：运行 Client
./led_srv

# 终端 3：调用服务（模拟上位机请求）
ros2 service call /set_led example_interfaces/srv/SetBool "{data: true}"
# 响应：success: true, message: "led on"

# 也可以服务发现
ros2 service list
# 应包含：/set_led
```

注意 MicroROS 服务端与原生的一个差异：**请求/响应消息内存需要在代码里静态分配**（`req`、`res` 变量），因为 MCU 没有动态内存管理。这是嵌入式开发的核心思维——一切资源显式管理。

### 八、MicroROS 与真机的桥接思路

#### 8.1 从 Host 模式到真机

Host 模式跑通后，移植到真机（如 ESP32）只需两步：

1.  **换编译目标**：用 micro_ros_espidf 组件或 PlatformIO 的 micro-ROS 支持，把同样的 C 代码交叉编译成 ESP32 固件。
2.  **换传输层**：Host 模式用 UDP，真机用 UART（串口）或 Wi-Fi UDP，修改 Agent 启动参数和 Client 的传输配置即可。

```bash
# 真机场景（ESP32 + 串口连接）
ros2 run micro_ros_agent micro_ros_agent serial --dev /dev/ttyUSB0 -b 115200

# 真机场景（ESP32 + Wi-Fi UDP）
ros2 run micro_ros_agent micro_ros_agent udp4 --port 8888
```

#### 8.2 消息类型限制与自定义

MicroROS 默认支持常用消息类型（std_msgs、geometry_msgs、sensor_msgs 等）。自定义消息需要先在本机生成 micro-ROS 消息包，再交叉编译进固件。流程：

```bash
# 生成自定义消息的 micro-ROS 版本
docker run -it --rm -v $(pwd):/work microros/micro-ros-agent:humble bash
# 容器内：用 ros2 的 msg 生成 + micro_ros_msgs 工具链
# 然后 colcon build 生成静态库，链接进固件
```

#### 8.3 时序与实时性注意事项

MCU 上做 MicroROS 要特别留意：

-   **回调里禁止阻塞**：`rclc_executor_spin_some` 是单线程轮询，回调里若做耗时操作（如大延时），会阻塞其他订阅/定时器。
-   **内存预算**：每个发布者/订阅者的消息缓冲区都是静态分配的，注意栈空间。
-   **断线重连**：串口/USB 断开后 Client 需要重新建立会话，生产代码要处理重连逻辑。

### 九、常见问题与排障

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| Client 连不上 Agent | 传输参数不匹配（端口/波特率） | 两端统一端口（8888）或波特率（115200） |
| `ros2 node list` 看不到 Client | Agent 没启动 / 会话未建立 | 先启动 Agent，看 Agent 日志是否"create session" |
| 话题收到了但数据为 0 | 消息初始化未完成 | Client 端先 `msg.data = 0` 初始化再发布 |
| 服务调用超时 | 服务端未注册 / 类型不匹配 | 检查服务名、类型、命名空间 |
| 编译报 memory 不足 | 静态缓冲过大 | 减小消息队列长度、消息类型换小 |
| 断开后无法重连 | Client 未处理会话关闭 | 实现重连逻辑，重新 `rclc_support_init` |

### 十、小结与下一篇预告

**本篇核心**：

1.  MicroROS = 让 MCU 直接作为 ROS2 节点，通过 Agent 桥接进 ROS2 图，无需自定义协议。
2.  架构三件套：Client（MCU 端 rcl 精简实现）+ Agent（上位机代理）+ 传输层（串口/UDP）。
3.  Host 模式仿真：PC 模拟 MCU，完整跑通 发布/订阅/服务 三种通信，为真机移植铺路。
4.  真机移植 = 换编译目标 + 换传输层，业务代码几乎不变。

至此我们理解了"单片机如何接入 ROS2"。下一篇（第 28 篇）进入 **ROS2-Control 与控制器（原理）**：ROS2 官方如何统一管理机器人关节控制（diff_drive_controller、Joint Trajectory Controller），以及它和 MicroROS 的分工——上位机负责"想"，下位机负责"动"，中间用标准接口衔接。硬件控制阶段最硬核的部分即将展开。
