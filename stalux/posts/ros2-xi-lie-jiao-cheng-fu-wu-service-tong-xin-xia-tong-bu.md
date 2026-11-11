---
title: "ROS2系列教程：服务Service通信（下）同步异步与回调组"
abbrlink: ros2-xi-lie-jiao-cheng-fu-wu-service-tong-xin-xia-tong-bu
date: "2026-09-04 13:44:49"
categories:
    - "ROS2"
tags: []
desc: "本篇文章把服务通信推向工程级：理解了同步/异步的底层机制（伪同步本质）、并发请求与多请求处理、回调组（互斥/可重入）与多线程执行器、超时与指数退避重试、服务与 QoS 的关系…"
---
## 本文是 ROS2 系列教程的第 8 篇

> 本文是 ROS2 系列教程的第 8 篇：服务 Service 通信（下）——同步异步与回调组。上一篇掌握了服务的基本收发，本篇文章深入工程的"深水区"：同步与异步的底层机制与性能差异、多请求并发处理、回调组（CallbackGroup）的两种类型、超时重试策略、服务端多线程执行器，以及服务与 QoS 的关系。学完你能设计出稳健可靠的服务架构。

### 一、同步与异步：底层机制对比

#### 1.1 概念回顾

-   **同步调用**：发起请求后，当前执行流**等待**响应返回才继续。
-   **异步调用**：发起请求后立即返回，响应到达时通过**回调**通知。

ROS2 里两种"同步"的实现都基于异步 API + 事件循环，理解这点很重要。

#### 1.2 Python 的 spin_until_future_complete 本质

Python 的"同步调用"其实是**伪同步**：

```python
future = self.client.call_async(request)        # 立即返回，不等待
rclpy.spin_until_future_complete(self, future)  # 原地驱动事件循环直到 future 完成
```

`spin_until_future_complete` 做的事情：在**当前线程**里不断处理事件循环（包括处理响应回调），直到 future 有结果或超时。所以：

-   它**不是**阻塞等待，而是"边等边处理事件"。
-   等待期间，该节点的其他回调（定时器、话题）**也会被处理**。
-   超时后返回 `Timeout`，需要自己判断结果。

#### 1.3 C++ 的 spin_until_future_complete

C++ 同理：

```cpp
auto future = client_->async_send_request(request);
auto status = rclcpp::spin_until_future_complete(
    this->get_node_base_interface(), future, std::chrono::seconds(5));
// FutureReturnCode: SUCCESS / TIMEOUT / INTERRUPTED
if (status == rclcpp::FutureReturnCode::SUCCESS) {
  auto response = future.get();
}
```

**注意**：`spin_until_future_complete` 要求传入的是 `get_node_base_interface()`（节点的接口指针），不是节点本身。第三个参数可设超时（默认无限等待）。

#### 1.4 真正的异步：回调模式

异步调用注册完成回调，响应到达时自动执行：

```python
# 异步调用（Python）
future = self.client.call_async(request)
future.add_done_callback(self.on_response)   # 响应到达时调用
```

```cpp
// 异步调用（C++）
auto future = client_->async_send_request(request);
// 用 std::bind 绑定回调，future 传入
std::thread([](rclcpp::Client<...>::SharedFuture f){
    auto resp = f.get();
    // 处理响应
}, future).detach();
```

**性能对比**：

| 方式 | 等待期间做其他事 | 并发请求 | 复杂度 | 适用场景 |
| --- | --- | --- | --- | --- |
| 同步 | 否（伪同步也在转事件） | 单 | 低 | 简单查询、初始化检查 |
| 异步 | 是 | 多 | 中 | 高频调用、多服务并发 |
| 回调组+多线程 | 是 | 多 | 高 | 复杂系统架构 |

### 二、并发处理：多请求与多服务端

#### 2.1 一个客户端多个并发请求

```python
# concurrent_client.py —— 并发请求演示
import rclpy
from rclpy.node import Node
from std_srvs.srv import Trigger
import time

class ConcurrentClient(Node):
    def __init__(self):
        super().__init__('concurrent_client')
        self.client = self.create_client(Trigger, 'ping_service')
        self.pending = 0

    def fire_all(self):
        if not self.client.wait_for_service(timeout_sec=1.0):
            self.get_logger().error('服务不可用')
            return
        # 同时发出 5 个请求（互不阻塞）
        for i in range(5):
            request = Trigger.Request()
            future = self.client.call_async(request)
            future.add_done_callback(self.on_done)
            self.pending += 1
        self.get_logger().info(f'已发出 {self.pending} 个并发请求')

    def on_done(self, future):
        self.pending -= 1
        r = future.result()
        self.get_logger().info(f'收到响应: {r.message}，剩余 {self.pending}')

def main():
    rclpy.init()
    node = ConcurrentClient()
    node.fire_all()
    # 事件循环驱动所有 future 完成
    while node.pending > 0:
        rclpy.spin_once(node, timeout_sec=0.1)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**要点**：`call_async` 可连续多次调用，每个请求独立 future；用 `add_done_callback` 逐个处理。**单线程执行器下回调仍串行**，但"等待"不阻塞。

#### 2.2 服务端并发：默认串行

默认情况下，服务端回调**一次只处理一个请求**（同一回调组内串行）。如果服务端处理很慢，后来的请求会排队。验证方式：

```python
# slow_server.py —— 慢服务端（模拟耗时 2 秒）
import rclpy, time
from rclpy.node import Node
from std_srvs.srv import Trigger

class SlowServer(Node):
    def __init__(self):
        super().__init__('slow_server')
        self.srv = self.create_service(Trigger, 'slow_service', self.handle)

    def handle(self, request, response):
        self.get_logger().info('开始处理（耗时 2s）...')
        time.sleep(2)          # 模拟耗时（实际不要用 sleep 阻塞回调！）
        response.success = True
        response.message = 'done'
        self.get_logger().info('处理完成')
        return response

def main():
    rclpy.init()
    node = SlowServer()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

客户端同时发 3 个请求：默认情况下它们**依次**被处理（总耗时 6 秒）。要让服务端并发处理，需要**回调组 + 多线程执行器**（见下一节）。

#### 2.3 回调组（CallbackGroup）

回调组决定回调的执行策略，是 ROS2 并发的关键机制：

-   **MutuallyExclusiveCallbackGroup（互斥，默认）**：组内回调**互斥串行**，同一时刻只执行一个。
-   **ReentrantCallbackGroup（可重入）**：组内回调**可以并发**执行（多线程执行器下）。

```python
# callback_group_demo.py —— 回调组演示
import rclpy, time
from rclpy.node import Node
from rclpy.callback_groups import ReentrantCallbackGroup, MutuallyExclusiveCallbackGroup
from rclpy.executors import MultiThreadedExecutor
from std_srvs.srv import Trigger

class CallbackGroupNode(Node):
    def __init__(self):
        super().__init__('callback_group_node')
        # 两个服务，一个用互斥组，一个用可重入组
        self.mutex_group = MutuallyExclusiveCallbackGroup()
        self.reentrant_group = ReentrantCallbackGroup()
        self.srv_a = self.create_service(
            Trigger, 'service_a', self.handle_a, callback_group=self.mutex_group)
        self.srv_b = self.create_service(
            Trigger, 'service_b', self.handle_b, callback_group=self.reentrant_group)

    def handle_a(self, request, response):
        self.get_logger().info('A 开始处理')
        time.sleep(2)
        response.success = True; response.message = 'a done'
        return response

    def handle_b(self, request, response):
        self.get_logger().info('B 开始处理')
        time.sleep(2)
        response.success = True; response.message = 'b done'
        return response

def main():
    rclpy.init()
    node = CallbackGroupNode()
    # 必须用多线程执行器，可重入组才能真正并发
    executor = MultiThreadedExecutor(num_threads=4)
    executor.add_node(node)
    executor.spin()

if __name__ == '__main__':
    main()
```

**实验结果**：

-   同时调 `service_a`（互斥）多次：串行（一次一个）。
-   同时调 `service_b`（可重入）多次：并发（多线程同时处理）。
-   **可重入组必须配多线程执行器**，否则行为与互斥组无异。

**工程建议**：

1.  默认用互斥组（安全，避免共享数据竞争）。
2.  只有明确"回调间无共享状态"时才用可重入组。
3.  多个**独立**服务用各自互斥组也行——不同组的回调本来就互不阻塞。

### 三、C++ 回调组与多线程执行器

#### 3.1 C++ 多线程执行器

```cpp
// cpp_pkg/src/multi_executor.cpp —— C++ 多线程执行器
#include "rclcpp/rclcpp.hpp"
#include "std_srvs/srv/trigger.hpp"

class ServiceServerNode : public rclcpp::Node
{
public:
  ServiceServerNode() : Node("service_server_node")
  {
    // 创建服务（默认互斥回调组）
    srv_ = this->create_service<std_srvs::srv::Trigger>(
      "ping_service",
      std::bind(&ServiceServerNode::handle, this,
                std::placeholders::_1, std::placeholders::_2));
  }

private:
  void handle(
    const std::shared_ptr<std_srvs::srv::Trigger::Request> request,
    std::shared_ptr<std_srvs::srv::Trigger::Response> response)
  {
    response->success = true;
    response->message = "ok";
  }

  rclcpp::Service<std_srvs::srv::Trigger>::SharedPtr srv_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  auto node = std::make_shared<ServiceServerNode>();
  // 多线程执行器：4 线程
  rclcpp::executors::MultiThreadedExecutor executor(
    rclcpp::ExecutorOptions(), 4);
  executor.add_node(node);
  executor.spin();
  rclcpp::shutdown();
  return 0;
}
```

#### 3.2 C++ 可重入回调组

```cpp
#include "rclcpp/callback_group.hpp"

// 创建可重入回调组
auto reentrant_group = this->create_callback_group(
    rclcpp::CallbackGroupType::Reentrant);

// 服务绑定到该组
srv_ = this->create_service<std_srvs::srv::Trigger>(
    "ping_service",
    std::bind(&ServiceServerNode::handle, this,
              std::placeholders::_1, std::placeholders::_2),
    rmw_qos_profile_services_default,  // QoS
    reentrant_group);                 // 回调组
```

**多线程 + 可重入组 = 真正并发**；否则即使多线程执行器，互斥组内回调依然串行。

### 四、超时与重试策略

#### 4.1 为什么需要超时

服务调用可能失败：服务端没启动、网络分区、服务端崩溃、请求超时。没有超时的调用可能**永远等待**，挂死整个节点。

#### 4.2 设置超时（Python）

```python
# timeout_client.py —— 带超时的客户端
import rclpy
from rclpy.node import Node
from std_srvs.srv import Trigger

class TimeoutClient(Node):
    def __init__(self):
        super().__init__('timeout_client')
        self.client = self.create_client(Trigger, 'ping_service')

    def call_with_timeout(self, timeout_sec=3.0):
        if not self.client.wait_for_service(timeout_sec=1.0):
            self.get_logger().error('服务端未启动')
            return None
        future = self.client.call_async(Trigger.Request())
        # 超时 3 秒
        rclpy.spin_until_future_complete(self, future, timeout_sec=timeout_sec)
        if future.done():
            return future.result()
        self.get_logger().error(f'请求超时（{timeout_sec}s）')
        # 取消请求（可选）
        future.cancel()
        return None

def main():
    rclpy.init()
    node = TimeoutClient()
    result = node.call_with_timeout(3.0)
    if result is None:
        node.get_logger().error('调用失败')
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

#### 4.3 重试模式

```python
# retry_client.py —— 指数退避重试
import rclpy, time
from rclpy.node import Node
from std_srvs.srv import Trigger

class RetryClient(Node):
    def __init__(self):
        super().__init__('retry_client')
        self.client = self.create_client(Trigger, 'ping_service')

    def call_with_retry(self, max_retries=3):
        for attempt in range(1, max_retries + 1):
            try:
                if not self.client.wait_for_service(timeout_sec=2.0):
                    raise TimeoutError('服务不可用')
                future = self.client.call_async(Trigger.Request())
                rclpy.spin_until_future_complete(self, future, timeout_sec=5.0)
                if future.done() and future.result() is not None:
                    return future.result()
                raise TimeoutError('请求超时')
            except Exception as e:
                self.get_logger().warn(f'第 {attempt} 次失败: {e}')
                if attempt < max_retries:
                    time.sleep(2 ** attempt)   # 指数退避：2s, 4s
        self.get_logger().error(f'重试 {max_retries} 次均失败')
        return None

def main():
    rclpy.init()
    node = RetryClient()
    result = node.call_with_retry()
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**重试最佳实践**：

1.  **指数退避**（1s → 2s → 4s）而不是固定间隔，避免风暴。
2.  只重试"可重试"错误（超时、服务未就绪）；“业务拒绝”（如参数非法）不重试。
3.  设置最大重试次数，避免无限循环。
4.  记录每次失败原因，便于排障。

### 五、服务与 QoS

#### 5.1 服务的 QoS 特性

服务通信有**默认 QoS**（`rmw_qos_profile_services_default`）：可靠传输（RELIABLE）+ 持久（volatile）。这意味着：

-   服务请求**保证送达**（可靠传输），不会丢。
-   服务端与客户端之间默认互相信任，QoS 兼容性一般不成问题。

#### 5.2 何时需要关注服务 QoS

-   高延迟网络（跨机器）：调整超时时间，而非 QoS。
-   大量并发请求：增大服务端执行器线程数，而非 QoS。
-   服务端需要"排队"策略：默认已有请求队列。

**经验**：服务场景基本用默认 QoS；真正需要精细控制 QoS 的是话题（第 9 篇详讲）。

### 六、实战：高并发服务系统

#### 6.1 系统设计

模拟"机器人管理器"系统：

```text
manager_server（多线程执行器 + 可重入组）
  ├── /query_status   查询状态（Trigger）
  ├── /set_mode       切换模式（SetMode，自定义）
  └── /execute_task   执行任务（耗时，模拟）
多个客户端并发调用
```

#### 6.2 服务端实现

```python
# py_pkg/manager_server.py
import rclpy, time
from rclpy.node import Node
from rclpy.callback_groups import ReentrantCallbackGroup
from rclpy.executors import MultiThreadedExecutor
from std_srvs.srv import Trigger
from std_msgs.msg import String
from rclpy.parameter import Parameter

class ManagerServer(Node):
    def __init__(self):
        super().__init__('manager_server')
        self.group = ReentrantCallbackGroup()   # 可重入组
        self.mode = 'idle'
        self.srv_status = self.create_service(
            Trigger, 'query_status', self.on_status, callback_group=self.group)
        self.srv_mode = self.create_service(
            Trigger, 'set_mode', self.on_mode, callback_group=self.group)
        self.srv_task = self.create_service(
            Trigger, 'execute_task', self.on_task, callback_group=self.group)
        self.get_logger().info('Manager 服务就绪')

    def on_status(self, request, response):
        response.success = True
        response.message = f'当前模式: {self.mode}'
        return response

    def on_mode(self, request, response):
        # 模拟 1 秒处理
        time.sleep(1)
        self.mode = 'running' if self.mode == 'idle' else 'idle'
        response.success = True
        response.message = f'模式切换为: {self.mode}'
        return response

    def on_task(self, request, response):
        time.sleep(3)     # 模拟 3 秒任务
        response.success = True
        response.message = '任务完成'
        return response

def main():
    rclpy.init()
    node = ManagerServer()
    executor = MultiThreadedExecutor(num_threads=8)
    executor.add_node(node)
    executor.spin()

if __name__ == '__main__':
    main()
```

#### 6.3 并发压测客户端

```python
# py_pkg/manager_stress.py —— 并发压测
import rclpy
from rclpy.node import Node
from rclpy.executors import MultiThreadedExecutor
from std_srvs.srv import Trigger
import time

class StressClient(Node):
    def __init__(self):
        super().__init__('stress_client')
        self.clients = {
            'status': self.create_client(Trigger, 'query_status'),
            'mode': self.create_client(Trigger, 'set_mode'),
            'task': self.create_client(Trigger, 'execute_task'),
        }
        self.pending = 0

    def hammer(self, rounds=3):
        for _ in range(rounds):
            for name, client in self.clients.items():
                if not client.wait_for_service(timeout_sec=1.0):
                    self.get_logger().error(f'{name} 不可用')
                    continue
                future = client.call_async(Trigger.Request())
                future.add_done_callback(lambda f, n=name: self.on_done(f, n))
                self.pending += 1
        self.get_logger().info(f'已发出 {self.pending} 个请求')

    def on_done(self, future, name):
        self.pending -= 1
        r = future.result()
        self.get_logger().info(f'[{name}] {r.message}，剩余 {self.pending}')

def main():
    rclpy.init()
    node = StressClient()
    node.hammer(3)          # 3 轮 × 3 服务 = 9 个并发请求
    while node.pending > 0:
        rclpy.spin_once(node, timeout_sec=0.05)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

#### 6.4 运行与观察

```bash
# 终端 1：启动服务端（多线程）
ros2 run py_pkg manager_server

# 终端 2：压测（9 个并发请求）
ros2 run py_pkg manager_stress

# 终端 3：监控
ros2 service list
ros2 service info /execute_task
```

**观察点**：9 个请求中，3 个 `execute_task`（各 3 秒）在可重入组 + 8 线程下**并发完成**（总耗时约 3 秒而非 9 秒），证明多线程 + 可重入组的并发能力。

#### 6.5 并发安全的注意事项

可重入组让回调并发后，**共享状态要加锁**（如 `self.mode` 被多个回调读写）：

```python
import threading
self.lock = threading.Lock()

def on_mode(self, request, response):
    with self.lock:          # 保护共享状态
        self.mode = 'running'
```

不加锁的并发读写会带来数据竞争（Python 因 GIL 部分缓解，C++ 必须加锁）。

### 七、常见问题排查

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 客户端一直等待 | 服务端没启动/没 spin | 启动服务端；确认服务端在 spin |
| `wait_for_service` 超时 | 服务名/类型不匹配 | `ros2 service list` 确认服务存在 |
| 请求超时（Timeout） | 服务端处理慢/网络慢 | 调大超时；检查服务端负载 |
| 并发请求被串行处理 | 用了互斥组或单线程执行器 | 可重入组 + 多线程执行器 |
| 回调并发但数据错乱 | 共享状态未加锁 | 用 `lock` 保护共享变量 |
| `future.get()` 抛异常 | 请求被取消/服务端异常 | 用 `future.done()` 判断后再取 |
| C++ 编译报 `callback_group` 参数错 | create_service 参数顺序错 | 按 `(类型, 服务名, 回调, QoS, 回调组)` 顺序 |

### 八、总结

本篇文章把服务通信推向工程级：理解了同步/异步的底层机制（伪同步本质）、并发请求与多请求处理、回调组（互斥/可重入）与多线程执行器、超时与指数退避重试、服务与 QoS 的关系，并用"高并发服务系统"实战验证了并发能力。

**关键要点回顾**：

1.  ROS2 的"同步"= `call_async` + `spin_until_future_complete`，本质是伪同步。
2.  异步调用用 `add_done_callback`，主循环不阻塞，支持多并发。
3.  互斥回调组串行、可重入回调组并发；可重入组必须配多线程执行器。
4.  服务调用必须设超时，配合指数退避重试，避免无限等待。
5.  并发回调访问共享状态必须加锁。
6.  服务默认 QoS 可靠传输，一般无需调整。

### 下一篇预告

下一篇进入**参数 Parameter 与 QoS 策略**：前半部分全面讲解参数系统——声明、读取、修改、回调、命令行、yaml 配置加载；后半部分深入 QoS——可靠性（RELIABLE/BEST_EFFORT）、历史（KEEP_LAST/KEEP_ALL）、深度、期限，以及跨话题 QoS 兼容性规则。参数与 QoS 是 ROS2 工程化配置的两大基石。
