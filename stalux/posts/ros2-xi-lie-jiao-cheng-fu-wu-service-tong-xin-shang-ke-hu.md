---
title: "ROS2系列教程：服务Service通信（上）客户端与服务端"
abbrlink: ros2-xi-lie-jiao-cheng-fu-wu-service-tong-xin-shang-ke-hu
date: "2026-09-04 13:44:36"
categories:
    - "ROS2"
tags: []
desc: "沿用第 4 篇的包，添加验证接口可用本篇文章完成了服务通信的完整入门：理解了 Request/Response 模型与适用场景，用 Python 和 C++ 分别实现了服务端、同步客户端、异步客户端…"
---
## 本文是 ROS2 系列教程的第 7 篇

> 本文是 ROS2 系列教程的第 7 篇：服务 Service 通信（上）——客户端与服务端。话题解决"单向广播"，服务解决"请求-应答"：客户端发请求，服务端算好回响应。机器人里的"查询状态"“设置参数”"执行动作"这类一问一答的场景都用服务。本篇文章讲透 Request/Response 模型、同步与异步调用，用 Python 与 C++ 实现服务端与客户端，掌握 `ros2 service` 调试命令，并理清"话题 vs 服务"的选型。

### 一、服务通信模型

#### 1.1 Request / Response 模型

服务（Service）采用**请求-响应（Request/Response）**模型：

```text
客户端（Client）                服务端（Server）
    │   ── 发送请求(Request) ──▶    │
    │                              │  处理请求
    │   ◀── 返回响应(Response) ──  │
```

核心特点：

-   **双向**：一问一答，客户端必须等待（或异步等待）服务端响应。
-   **一对多**：一个服务可被多个客户端调用；一个服务端可提供多个服务。
-   **有状态交互**：适合"查询/设置/触发"类操作，不适合持续数据流。

典型场景：查询电池状态、设置机器人速度、触发一次建图、请求一次路径规划。持续高频的数据（雷达、里程计）请用话题。

#### 1.2 服务名与接口类型

服务由**服务名 + 服务类型**标识：

```text
服务名（service name）：/set_speed
服务类型（service type）：my_interfaces/srv/SetSpeed
```

服务类型定义**请求与响应的结构**，用 `.srv` 文件描述（第 4 篇讲过），`---` 分隔：

```text
# SetSpeed.srv
float64 target_speed      # 请求部分
bool   is_emergency_stop
---
bool     success          # 响应部分
string   message
```

#### 1.3 ROS1 vs ROS2 的服务

| 维度 | ROS1 | ROS2 |
| --- | --- | --- |
| 客户端查找服务端 | 通过 roscore 注册表 | DDS 自动发现 |
| 请求响应类型 | 原生类型为主 | 强类型 `.srv` 接口 |
| 客户端多服务端 | 同一服务名只认第一个 | 支持多服务端负载均衡（部分 DDS） |
| 加密安全 | 无 | SROS2 支持 |

ROS2 的服务与话题一样，都基于 DDS 传输，只是语义从"流"变成"问答"。**服务名与话题名可以相同**（不同命名空间），但为了清晰通常用不同名字。

### 二、Python 服务端与客户端

#### 2.1 服务端（Server）

用内置的 `std_srvs/srv/Trigger`（空请求，返回 success + message）演示最简服务端：

```python
# py_pkg/py_service_server.py —— Python 服务端
import rclpy
from rclpy.node import Node
from std_srvs.srv import Trigger

class PyServiceServer(Node):
    def __init__(self):
        super().__init__('py_service_server')
        # 创建服务：服务类型 + 服务名 + 回调函数
        self.srv = self.create_service(Trigger, 'ping_service', self.handle_request)
        self.get_logger().info('服务已就绪: /ping_service')

    def handle_request(self, request, response):
        # 处理请求，填充响应（request 为空请求，但可读取字段）
        response.success = True
        response.message = 'pong from py_server'
        self.get_logger().info('收到请求，返回 pong')
        return response

def main():
    rclpy.init()
    node = PyServiceServer()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**服务端回调关键点**：

1.  `create_service(类型, 服务名, 回调)` 注册服务。
2.  回调签名固定为 `(request, response) -> response`。
3.  回调由 `spin()` 驱动——**服务端必须 spin**，否则不响应任何请求。
4.  回调同样不能做耗时操作（阻塞期间其他请求排队）。

#### 2.2 客户端（Client）——同步调用

```python
# py_pkg/py_service_client.py —— Python 客户端（同步）
import rclpy
from rclpy.node import Node
from std_srvs.srv import Trigger

class PyServiceClient(Node):
    def __init__(self):
        super().__init__('py_service_client')
        # 创建客户端：服务类型 + 服务名
        self.client = self.create_client(Trigger, 'ping_service')

    def call_sync(self):
        # 1. 等待服务端上线
        while not self.client.wait_for_service(timeout_sec=1.0):
            self.get_logger().info('等待服务端...')
        # 2. 构造请求
        request = Trigger.Request()
        # 3. 同步调用（阻塞直到收到响应）
        future = self.client.call_async(request)
        # 4. 等待 future 完成
        rclpy.spin_until_future_complete(self, future)
        if future.result() is not None:
            response = future.result()
            self.get_logger().info(
                f'服务端响应: success={response.success} msg={response.message}')
        else:
            self.get_logger().error('调用失败')

def main():
    rclpy.init()
    node = PyServiceClient()
    node.call_sync()
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**Python 同步调用的本质**：rclpy 没有真正阻塞的 `call()`，而是用 `call_async()` 发起 + `spin_until_future_complete` 原地处理回调直到完成。这保证了调用期间事件循环仍在转。

#### 2.3 客户端——异步调用

不阻塞主流程的异步调用（适合周期检查、多服务并发）：

```python
# py_pkg/py_service_client_async.py —— 异步客户端
import rclpy
from rclpy.node import Node
from std_srvs.srv import Trigger

class AsyncClient(Node):
    def __init__(self):
        super().__init__('async_client')
        self.client = self.create_client(Trigger, 'ping_service')
        self.timer = self.create_timer(2.0, self.periodic_call)
        self.busy = False

    def periodic_call(self):
        if self.busy:
            return
        if not self.client.wait_for_service(timeout_sec=0.5):
            self.get_logger().info('服务端未就绪，跳过本轮')
            return
        request = Trigger.Request()
        future = self.client.call_async(request)
        # 注册回调：响应到达时自动执行（不阻塞主循环）
        future.add_done_callback(self.on_response)
        self.busy = True

    def on_response(self, future):
        self.busy = False
        if future.result() is not None:
            r = future.result()
            self.get_logger().info(f'响应: {r.message}')
        else:
            self.get_logger().error('请求超时或失败')

def main():
    rclpy.init()
    node = AsyncClient()
    rclpy.spin(node)          # 定时器驱动，循环发起异步请求
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**异步调用的优势**：主循环不阻塞，可以同时"边等响应边干别的"；多个并发请求互不干扰。代价是逻辑复杂度上升（回调处理响应）。

### 三、C++ 服务端与客户端

#### 3.1 C++ 服务端

```cpp
// cpp_pkg/src/service_server.cpp —— C++ 服务端
#include "rclcpp/rclcpp.hpp"
#include "std_srvs/srv/trigger.hpp"

class ServiceServer : public rclcpp::Node
{
public:
  ServiceServer() : Node("service_server")
  {
    // 创建服务，回调绑定成员函数
    server_ = this->create_service<std_srvs::srv::Trigger>(
      "ping_service",
      std::bind(&ServiceServer::handle_request, this,
                std::placeholders::_1, std::placeholders::_2));
    RCLCPP_INFO(this->get_logger(), "服务已就绪: /ping_service");
  }

private:
  // 回调签名：请求/响应都是 SharedPtr
  void handle_request(
    const std::shared_ptr<std_srvs::srv::Trigger::Request> request,
    std::shared_ptr<std_srvs::srv::Trigger::Response> response)
  {
    response->success = true;
    response->message = "pong from cpp_server";
    RCLCPP_INFO(this->get_logger(), "收到请求，返回 pong");
  }

  rclcpp::Service<std_srvs::srv::Trigger>::SharedPtr server_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<ServiceServer>());
  rclcpp::shutdown();
  return 0;
}
```

#### 3.2 C++ 客户端——同步调用

```cpp
// cpp_pkg/src/service_client.cpp —— C++ 客户端
#include "rclcpp/rclcpp.hpp"
#include "std_srvs/srv/trigger.hpp"
#include <chrono>

class ServiceClient : public rclcpp::Node
{
public:
  ServiceClient() : Node("service_client")
  {
    client_ = this->create_client<std_srvs::srv::Trigger>("ping_service");
    timer_ = this->create_wall_timer(
      std::chrono::seconds(2),
      std::bind(&ServiceClient::call_service, this));
  }

private:
  void call_service()
  {
    // 1. 等服务端
    if (!client_->wait_for_service(std::chrono::seconds(1))) {
      RCLCPP_WARN(this->get_logger(), "服务端未就绪");
      return;
    }
    // 2. 构造请求
    auto request = std::make_shared<std_srvs::srv::Trigger::Request>();
    // 3. 异步发起，保存 future
    auto future = client_->async_send_request(request);
    // 4. 同步等待（spin_until_future_complete 内处理响应）
    if (rclcpp::spin_until_future_complete(this->get_node_base_interface(), future)
        == rclcpp::FutureReturnCode::SUCCESS) {
      auto response = future.get();
      RCLCPP_INFO(this->get_logger(), "响应: %s", response->message.c_str());
    } else {
      RCLCPP_ERROR(this->get_logger(), "调用失败");
    }
  }

  rclcpp::Client<std_srvs::srv::Trigger>::SharedPtr client_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<ServiceClient>());
  rclcpp::shutdown();
  return 0;
}
```

**C++ 同步调用要点**：`async_send_request` 返回 `SharedFuture`，配合 `spin_until_future_complete` 等待；不能真的 `future.get()` 死等（会卡死事件循环）。C++ 的"同步"本质与 Python 一致——都是在事件循环里处理响应。

#### 3.3 双语言混调

```bash
# Python 服务端 + C++ 客户端，或反过来，都能工作
ros2 run py_pkg py_service_server
ros2 run cpp_pkg service_client
```

与话题一样，服务也支持跨语言：只要服务名与类型一致，任何语言的客户端都能调任何语言的服务端。

### 四、自定义服务接口实战

#### 4.1 定义并构建服务接口

沿用第 4 篇的 `my_interfaces` 包，添加 `SetSpeed.srv`（见第 4 篇 4.4），构建：

```bash
colcon build --packages-select my_interfaces
source install/setup.bash
```

**验证接口可用**：

```bash
ros2 interface show my_interfaces/srv/SetSpeed
```

#### 4.2 服务端：速度设置服务

```python
# py_pkg/speed_service.py —— 速度设置服务端
import rclpy
from rclpy.node import Node
from my_interfaces.srv import SetSpeed

class SpeedService(Node):
    def __init__(self):
        super().__init__('speed_service')
        self.srv = self.create_service(SetSpeed, 'set_speed', self.handle)
        self.current_speed = 0.0

    def handle(self, request, response):
        if request.is_emergency_stop:
            self.current_speed = 0.0
            response.success = True
            response.message = '急停！速度归零'
        elif 0.0 <= request.target_speed <= 3.0:
            self.current_speed = request.target_speed
            response.success = True
            response.message = f'速度已设置为 {self.current_speed}'
        else:
            response.success = False
            response.message = f'速度 {request.target_speed} 超出范围 [0, 3]'
        self.get_logger().info(response.message)
        return response

def main():
    rclpy.init()
    node = SpeedService()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

#### 4.3 客户端：连续请求测试

```python
# py_pkg/speed_client.py —— 速度设置客户端
import rclpy
from rclpy.node import Node
from my_interfaces.srv import SetSpeed

class SpeedClient(Node):
    def __init__(self):
        super().__init__('speed_client')
        self.client = self.create_client(SetSpeed, 'set_speed')

    def set_speed(self, target, emergency=False):
        if not self.client.wait_for_service(timeout_sec=1.0):
            self.get_logger().error('服务不可用')
            return
        request = SetSpeed.Request()
        request.target_speed = target
        request.is_emergency_stop = emergency
        future = self.client.call_async(request)
        rclpy.spin_until_future_complete(self, future)
        if future.result():
            r = future.result()
            self.get_logger().info(f'success={r.success} msg={r.message}')
        return future.result()

def main():
    rclpy.init()
    node = SpeedClient()
    node.set_speed(1.5)       # 正常设置
    node.set_speed(5.0)       # 超范围，应被拒绝
    node.set_speed(2.0, emergency=True)  # 急停
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

#### 4.4 命令行调用服务

**不写任何代码**，用命令行直接测服务（开发调试利器）：

```bash
# 运行服务端
ros2 run py_pkg speed_service

# 调用服务（命令行客户端）
ros2 service call /set_speed my_interfaces/srv/SetSpeed \
  "{target_speed: 1.5, is_emergency_stop: false}"

# 查看服务信息
ros2 service list                       # 列出所有服务
ros2 service list -t                    # 带类型
ros2 service type /set_speed            # 查看服务类型
ros2 service find my_interfaces/srv/SetSpeed   # 按类型找服务
ros2 service info /set_speed            # 服务详情（客户端/服务端数量）
```

命令行调用是验证服务逻辑最快的方式：先跑服务端，再用 `ros2 service call` 模拟客户端，观察响应是否符合预期。

### 五、ros2 service 全套命令

```bash
# 列出所有服务
ros2 service list

# 列出服务及类型
ros2 service list -t

# 查看某服务的类型
ros2 service type /set_speed

# 按类型反查服务
ros2 service find std_srvs/srv/Trigger

# 查看服务详情（服务端/客户端数量）
ros2 service info /set_speed

# 手动调用服务
ros2 service call /set_speed my_interfaces/srv/SetSpeed "{target_speed: 2.0, is_emergency_stop: false}"

# 调用内置 Trigger 服务
ros2 service call /ping_service std_srvs/srv/Trigger "{}"
```

### 六、话题 vs 服务：如何选型

| 维度 | 话题 Topic | 服务 Service |
| --- | --- | --- |
| 通信模式 | 单向广播 | 请求-应答 |
| 是否阻塞 | 发布不阻塞 | 客户端等响应（可异步） |
| 数据流 | 持续流式 | 一次性问答 |
| 典型场景 | 传感器数据、控制指令 | 查询、设置、触发 |
| 多接收方 | 天然一对多 | 一对一（一个请求一个响应） |
| 反馈 | 无 | 有（响应即反馈） |
| 长任务 | 不适合 | 不适合（用 Action，第 10 篇） |
| 调试命令 | `ros2 topic *` | `ros2 service *` |

**选型口诀**：

-   持续流动的数据 → **话题**（雷达、里程计、图像、速度指令）
-   偶尔发生的问答 → **服务**（查状态、设参数、触发生成）
-   带进度反馈的长任务 → **动作 Action**（导航、机械臂运动，第 10 篇）

**反例警示**：别用服务做高频数据（每帧一个请求，服务端成瓶颈）；别用话题做"必须等到结果"的操作（收不到确认）。

### 七、总结

本篇文章完成了服务通信的完整入门：理解了 Request/Response 模型与适用场景，用 Python 和 C++ 分别实现了服务端、同步客户端、异步客户端，实战了自定义服务接口（速度设置），并掌握了 `ros2 service` 命令行调试工具，最后理清了话题与服务的选型边界。

**关键要点回顾**：

1.  服务 = 服务名 + 服务类型（.srv），请求与响应由 `---` 分隔。
2.  服务端必须 `spin()` 才会处理请求；回调签名固定为 `(request, response) -> response`。
3.  客户端先 `wait_for_service`，再 `call_async`；同步语义靠 `spin_until_future_complete` 实现。
4.  异步调用用 `future.add_done_callback`，主循环不阻塞。
5.  `ros2 service call/list/type/info` 是服务调试四件套。
6.  持续数据用话题，一问一答用服务，长任务带反馈用 Action。

### 下一篇预告

下一篇深入**服务 Service 通信（下）——同步异步与回调组**：对比同步/异步的底层机制与性能差异、多请求并发处理、`ReentrantCallbackGroup` 与 `MutuallyExclusiveCallbackGroup` 回调组、服务的超时与重试策略、服务与 QoS 的关系，以及服务端多线程执行器的最佳实践。学完你能设计稳健的服务架构。
