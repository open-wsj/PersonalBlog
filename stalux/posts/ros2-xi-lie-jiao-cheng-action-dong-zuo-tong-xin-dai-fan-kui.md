---
title: "ROS2系列教程：Action动作通信（带反馈长任务）"
abbrlink: ros2-xi-lie-jiao-cheng-action-dong-zuo-tong-xin-dai-fan-kui
date: "2026-09-05 15:48:29"
categories:
    - "ROS2"
tags: []
desc: "动作接口用.action文件定义，三部分用---# action/CountUntil.action —— 计数到目标值int32 target_number #…"
---
## 本文是 ROS2 系列教程的第 10 篇

> 本文是 ROS2 系列教程的第 10 篇：Action 动作通信——带反馈的长任务。话题是单向数据流，服务是一问一答，而机器人世界里还有一类需求：**“导航到目标点”“机械臂抓取物体”“执行建图”**——它们耗时长、需要进度反馈、还可能要中途取消。这就是动作（Action）的用武之地。本篇文章讲透 Goal/Feedback/Result 三通道模型，用 Python 与 C++ 实现动作服务端与客户端，掌握 `ros2 action` 命令，并完成三种通信方式的选型总结。

### 一、动作通信模型

#### 1.1 为什么需要 Action

用一个例子理解：让机器人"导航到厨房"。

-   **话题方案**：发一个目标点话题，然后就不知道了——没有完成确认，没有进度。
-   **服务方案**：调一个服务"导航到(厨房)"，服务端算完才返回——调用期间完全阻塞，无法取消，也没有中间反馈。
-   **动作方案**：客户端发目标 → 服务端持续回报"已走 30%、还有 5 米"→ 完成时返回最终结果 → 随时可取消。**完美契合**。

动作是为"**长任务 + 进度反馈 + 可取消**"设计的通信原语，是导航（Nav2）、机械臂（MoveIt2）等核心系统的标准接口。

#### 1.2 三通道模型

一个动作由**三个通道**组成（对应三个话题 + 一个服务）：

```text
客户端                                  服务端
  │  1. 发送目标 Goal ──────────────────▶  接受/拒绝目标
  │  2. ◀────────────── 持续反馈 Feedback  报告进度
  │  3. ◀────────────────── 最终结果 Result  任务完成
  │  4. 发送取消请求 Cancel ────────────▶  终止任务
```

| 通道 | 方向 | 内容 | 类比 |
| --- | --- | --- | --- |
| Goal | 客户端→服务端 | 任务目标（如目标坐标） | 下达任务 |
| Feedback | 服务端→客户端 | 进度信息（持续发送） | 汇报进度 |
| Result | 服务端→客户端 | 最终结果（一次） | 交付成果 |
| Cancel | 客户端→服务端 | 取消请求 | 中止任务 |

**实现上**：Goal 用服务传输（保证送达），Feedback/Result 用话题传输，Cancel 用服务——但用户不需要关心底层，API 已封装。

#### 1.3 动作接口定义（.action 文件）

动作接口用 `.action` 文件定义，三部分用 `---` 分隔：

```text
# action/CountUntil.action —— 计数到目标值
int32 target_number          # 目标（Goal）：要数到几
---
int32 current_number         # 结果（Result）：最终数到几
---
int32 current_number         # 反馈（Feedback）：当前数到几
```

定义在接口包里（如 `my_interfaces`），构建后生成对应语言的类型。

### 二、Python 动作服务端

#### 2.1 简单计数器动作服务端

用 ROS2 自带的 `example_interfaces/action/Fibonacci`（斐波那契数列）演示：

```python
# py_pkg/py_action_server.py —— Python 动作服务端
import rclpy
import time
from rclpy.node import Node
from rclpy.action import ActionServer
from example_interfaces.action import Fibonacci

class FibonacciServer(Node):
    def __init__(self):
        super().__init__('fibonacci_server')
        # 创建动作服务端：动作类型 + 动作名 + 三个回调
        self.action_server = ActionServer(
            self,
            Fibonacci,
            'fibonacci',
            self.execute_callback)   # 执行回调（核心）
        self.get_logger().info('动作服务端就绪: /fibonacci')

    def execute_callback(self, goal_handle):
        # 1. 接受目标
        self.get_logger().info(f'收到目标: {goal_handle.request.order}')
        feedback_msg = Fibonacci.Feedback()

        # 2. 计算斐波那契数列，持续发反馈
        sequence = [0, 1]
        for i in range(1, goal_handle.request.order):
            sequence.append(sequence[i] + sequence[i-1])
            feedback_msg.sequence = sequence
            goal_handle.publish_feedback(feedback_msg)   # 发反馈
            time.sleep(0.5)                              # 模拟耗时

        # 3. 完成：返回结果
        goal_handle.succeed()
        result = Fibonacci.Result()
        result.sequence = sequence
        return result

def main():
    rclpy.init()
    node = FibonacciServer()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**服务端三个关键回调**：

1.  **execute_callback**：收到目标后执行（可同步写耗时逻辑，执行器会调度）。
2.  **publish_feedback**：随时发布进度。
3.  **succeed()/abort()**：标记任务成功/失败，然后返回 Result。

#### 2.2 支持取消的动作服务端

```python
# py_pkg/cancellable_server.py —— 可取消的动作服务端
import rclpy, time
from rclpy.node import Node
from rclpy.action import ActionServer, CancelResponse, GoalResponse
from example_interfaces.action import Fibonacci

class CancellableServer(Node):
    def __init__(self):
        super().__init__('cancellable_server')
        self.action_server = ActionServer(
            self, Fibonacci, 'fibonacci',
            execute_callback=self.execute_callback,
            goal_callback=self.goal_callback,        # 目标接受回调
            cancel_callback=self.cancel_callback,    # 取消回调
        )

    def goal_callback(self, goal_request):
        # 可在此校验目标：拒绝非法目标
        self.get_logger().info(f'收到目标 order={goal_request.order}')
        if goal_request.order <= 0:
            self.get_logger().warn('拒绝非法目标（order<=0）')
            return GoalResponse.REJECT
        return GoalResponse.ACCEPT

    def cancel_callback(self, goal_handle):
        self.get_logger().info('收到取消请求，同意取消')
        return CancelResponse.ACCEPT

    def execute_callback(self, goal_handle):
        feedback_msg = Fibonacci.Feedback()
        sequence = [0, 1]
        for i in range(1, goal_handle.request.order):
            # 检查是否被取消
            if goal_handle.is_cancel_requested:
                goal_handle.canceled()              # 标记取消
                self.get_logger().info('任务已取消')
                return Fibonacci.Result()           # 返回空结果
            sequence.append(sequence[i] + sequence[i-1])
            feedback_msg.sequence = sequence
            goal_handle.publish_feedback(feedback_msg)
            time.sleep(0.5)
        goal_handle.succeed()
        result = Fibonacci.Result()
        result.sequence = sequence
        return result

def main():
    rclpy.init()
    node = CancellableServer()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**取消处理三步**：

1.  `cancel_callback` 决定是否同意取消（返回 `CancelResponse.ACCEPT`）。
2.  执行循环里用 `goal_handle.is_cancel_requested` 检查是否被请求取消。
3.  同意后调 `goal_handle.canceled()` 标记状态并返回。

### 三、Python 动作客户端

#### 3.1 基础客户端

```python
# py_pkg/py_action_client.py —— Python 动作客户端
import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient
from example_interfaces.action import Fibonacci

class FibonacciClient(Node):
    def __init__(self):
        super().__init__('fibonacci_client')
        # 创建动作客户端
        self.action_client = ActionClient(self, Fibonacci, 'fibonacci')

    def send_goal(self, order):
        # 1. 等待服务端
        self.action_client.wait_for_server()
        # 2. 构造目标
        goal_msg = Fibonacci.Goal()
        goal_msg.order = order
        self.get_logger().info(f'发送目标: order={order}')
        # 3. 发送目标（异步），注册反馈回调
        self.send_goal_future = self.action_client.send_goal_async(
            goal_msg, feedback_callback=self.feedback_callback)
        # 4. 目标被接受后，再请求结果
        self.send_goal_future.add_done_callback(self.goal_response_callback)

    def feedback_callback(self, feedback_msg):
        # 进度反馈（服务端 publish_feedback 时触发）
        fb = feedback_msg.feedback
        self.get_logger().info(f'进度: {list(fb.sequence)}')

    def goal_response_callback(self, future):
        goal_handle = future.result()
        if not goal_handle.accepted:
            self.get_logger().error('目标被拒绝')
            return
        self.get_logger().info('目标已接受，等待结果...')
        # 5. 请求结果（异步）
        self.get_result_future = goal_handle.get_result_async()
        self.get_result_future.add_done_callback(self.result_callback)

    def result_callback(self, future):
        result = future.result().result
        self.get_logger().info(f'最终结果: {list(result.sequence)}')
        # 关闭节点
        rclpy.shutdown()

def main():
    rclpy.init()
    node = FibonacciClient()
    node.send_goal(10)      # 数到 10
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**客户端四步流程**：

1.  `send_goal_async(目标, feedback_callback)` 发送目标。
2.  目标响应回调里检查 `accepted`（被接受/拒绝）。
3.  接受后 `get_result_async()` 请求最终结果。
4.  `result_callback` 拿到最终结果。

#### 3.2 可取消客户端

```python
# py_pkg/cancellable_client.py —— 可取消客户端
import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient
from example_interfaces.action import Fibonacci
import threading, time

class CancellableClient(Node):
    def __init__(self):
        super().__init__('cancellable_client')
        self.action_client = ActionClient(self, Fibonacci, 'fibonacci')
        self.goal_handle = None

    def send_goal(self, order):
        self.action_client.wait_for_server()
        goal_msg = Fibonacci.Goal()
        goal_msg.order = order
        future = self.action_client.send_goal_async(
            goal_msg, feedback_callback=self.feedback_callback)
        future.add_done_callback(self.on_goal_response)

    def feedback_callback(self, feedback_msg):
        self.get_logger().info(f'进度: {list(feedback_msg.feedback.sequence)}')

    def on_goal_response(self, future):
        self.goal_handle = future.result()
        if not self.goal_handle.accepted:
            self.get_logger().error('目标被拒绝')
            return
        self.get_logger().info('目标已接受，2 秒后取消...')
        # 2 秒后发起取消
        timer = threading.Timer(2.0, self.cancel_goal)
        timer.start()

    def cancel_goal(self):
        self.get_logger().info('发送取消请求...')
        cancel_future = self.goal_handle.cancel_goal_async()
        cancel_future.add_done_callback(self.on_cancel_done)

    def on_cancel_done(self, future):
        cancel_response = future.result()
        if len(cancel_response.goals_canceling) > 0:
            self.get_logger().info('取消成功')
        else:
            self.get_logger().warn('取消未生效')

def main():
    rclpy.init()
    node = CancellableClient()
    node.send_goal(10)
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

### 四、C++ 动作服务端与客户端

#### 4.1 C++ 动作服务端

```cpp
// cpp_pkg/src/action_server.cpp
#include "rclcpp/rclcpp.hpp"
#include "rclcpp_action/rclcpp_action.hpp"
#include "example_interfaces/action/fibonacci.hpp"
#include <chrono>
#include <memory>

using Fibonacci = example_interfaces::action::Fibonacci;
using GoalHandleFibonacci = rclcpp_action::ServerGoalHandle<Fibonacci>;

class FibonacciServer : public rclcpp::Node
{
public:
  FibonacciServer() : Node("fibonacci_server_cpp")
  {
    action_server_ = rclcpp_action::create_server<Fibonacci>(
      this, "fibonacci",
      std::bind(&FibonacciServer::handle_goal, this, std::placeholders::_1, std::placeholders::_2),
      std::bind(&FibonacciServer::handle_cancel, this, std::placeholders::_1),
      std::bind(&FibonacciServer::handle_accepted, this, std::placeholders::_1));
    RCLCPP_INFO(this->get_logger(), "动作服务端就绪");
  }

private:
  // 目标回调：校验并决定接受/拒绝
  rclcpp_action::GoalResponse handle_goal(
    const rclcpp_action::GoalUUID& uuid,
    std::shared_ptr<const Fibonacci::Goal> goal)
  {
    RCLCPP_INFO(this->get_logger(), "收到目标 order=%d", goal->order);
    if (goal->order <= 0) return rclcpp_action::GoalResponse::REJECT;
    return rclcpp_action::GoalResponse::ACCEPT;
  }

  // 取消回调
  rclcpp_action::CancelResponse handle_cancel(
    const std::shared_ptr<GoalHandleFibonacci> goal_handle)
  {
    RCLCPP_INFO(this->get_logger(), "收到取消请求");
    return rclcpp_action::CancelResponse::ACCEPT;
  }

  // 接受后：开线程执行（不能阻塞回调）
  void handle_accepted(const std::shared_ptr<GoalHandleFibonacci> goal_handle)
  {
    std::thread(std::bind(&FibonacciServer::execute, this, goal_handle)).detach();
  }

  // 执行逻辑
  void execute(const std::shared_ptr<GoalHandleFibonacci> goal_handle)
  {
    auto feedback = std::make_shared<Fibonacci::Feedback>();
    auto result = std::make_shared<Fibonacci::Result>();
    std::vector<int> seq{0, 1};
    for (int i = 1; i < goal_handle->get_goal()->order; i++) {
      seq.push_back(seq[i] + seq[i-1]);
      feedback->sequence = seq;
      goal_handle->publish_feedback(feedback);
      std::this_thread::sleep_for(std::chrono::milliseconds(500));
    }
    goal_handle->succeed();
    result->sequence = seq;
    goal_handle->publish_result(result);
  }

  rclcpp_action::Server<Fibonacci>::SharedPtr action_server_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<FibonacciServer>());
  rclcpp::shutdown();
  return 0;
}
```

**C++ 关键差异**：`handle_accepted` 里必须**开新线程**执行任务（不能阻塞执行器回调线程）；三个回调分别对应 Goal 接受、取消、执行。

#### 4.2 C++ 动作客户端

```cpp
// cpp_pkg/src/action_client.cpp
#include "rclcpp/rclcpp.hpp"
#include "rclcpp_action/rclcpp_action.hpp"
#include "example_interfaces/action/fibonacci.hpp"

using Fibonacci = example_interfaces::action::Fibonacci;

class FibonacciClient : public rclcpp::Node
{
public:
  FibonacciClient() : Node("fibonacci_client_cpp")
  {
    client_ = rclcpp_action::create_client<Fibonacci>(this, "fibonacci");
  }

  void send_goal(int order)
  {
    // 1. 等服务端
    if (!client_->wait_for_action_server()) {
      RCLCPP_ERROR(this->get_logger(), "动作服务端不可用");
      return;
    }
    // 2. 构造目标
    auto goal = Fibonacci::Goal();
    goal.order = order;
    // 3. 发送目标（异步），注册反馈与响应回调
    auto send_goal_options = rclcpp_action::Client<Fibonacci>::SendGoalOptions();
    send_goal_options.goal_response_callback =
      std::bind(&FibonacciClient::goal_response_callback, this, std::placeholders::_1);
    send_goal_options.feedback_callback =
      std::bind(&FibonacciClient::feedback_callback, this,
                std::placeholders::_1, std::placeholders::_2);
    send_goal_options.result_callback =
      std::bind(&FibonacciClient::result_callback, this, std::placeholders::_1);
    client_->async_send_goal(goal, send_goal_options);
  }

private:
  void goal_response_callback(const GoalHandleFibonacci::SharedPtr& goal_handle)
  {
    if (!goal_handle) {
      RCLCPP_ERROR(this->get_logger(), "目标被拒绝");
    } else {
      RCLCPP_INFO(this->get_logger(), "目标已接受");
    }
  }

  void feedback_callback(GoalHandleFibonacci::SharedPtr,
                         const std::shared_ptr<const Fibonacci::Feedback> feedback)
  {
    RCLCPP_INFO(this->get_logger(), "进度: %zu 项", feedback->sequence.size());
  }

  void result_callback(const GoalHandleFibonacci::WrappedResult& result)
  {
    if (result.code == rclcpp_action::ResultCode::SUCCEEDED) {
      RCLCPP_INFO(this->get_logger(), "任务成功");
    }
  }

  rclcpp_action::Client<Fibonacci>::SharedPtr client_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  auto node = std::make_shared<FibonacciClient>();
  node->send_goal(10);
  rclcpp::spin(node);
  rclcpp::shutdown();
  return 0;
}
```

### 五、自定义动作接口实战

#### 5.1 定义动作接口

在 `my_interfaces` 包加 `action/NavigateTo.action`：

```text
# action/NavigateTo.action
float32 x              # 目标 x 坐标
float32 y              # 目标 y 坐标
---
bool     reached       # 是否到达
float32 final_distance # 最终距离
---
float32 distance_left  # 剩余距离
float32 speed          # 当前速度
```

修改 `CMakeLists.txt`：

```cmake
set(action_files
  "action/NavigateTo.action"
)
rosidl_generate_interfaces(${PROJECT_NAME}
  ${msg_files}
  ${srv_files}
  ${action_files}       # 加入动作文件
  DEPENDENCIES builtin_interfaces
)
```

重建并验证：

```bash
colcon build --packages-select my_interfaces
source install/setup.bash
ros2 interface show my_interfaces/action/NavigateTo
```

#### 5.2 导航动作服务端（模拟）

```python
# py_pkg/nav_action_server.py —— 模拟导航动作
import rclpy, math, time
from rclpy.node import Node
from rclpy.action import ActionServer
from my_interfaces.action import NavigateTo

class NavServer(Node):
    def __init__(self):
        super().__init__('nav_server')
        self.action_server = ActionServer(
            self, NavigateTo, 'navigate_to', self.execute_callback)
        self.get_logger().info('导航动作服务端就绪')

    def execute_callback(self, goal_handle):
        goal = goal_handle.request
        self.get_logger().info(f'导航到 ({goal.x}, {goal.y})')
        feedback = NavigateTo.Feedback()
        # 模拟：机器人从 (0,0) 以 1m/s 直线运动
        total = math.sqrt(goal.x**2 + goal.y**2)
        distance_left = total
        while distance_left > 0.05:
            distance_left -= 0.2
            feedback.distance_left = max(distance_left, 0.0)
            feedback.speed = 1.0
            goal_handle.publish_feedback(feedback)
            time.sleep(0.2)
        goal_handle.succeed()
        result = NavigateTo.Result()
        result.reached = True
        result.final_distance = 0.0
        return result

def main():
    rclpy.init()
    node = NavServer()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

#### 5.3 命令行调用动作

```bash
# 查看动作列表
ros2 action list
ros2 action list -t

# 查看动作类型信息
ros2 action info /navigate_to

# 发送动作目标（命令行）
ros2 action send_goal /navigate_to my_interfaces/action/NavigateTo \
  "{x: 5.0, y: 3.0}"

# 带反馈显示
ros2 action send_goal /navigate_to my_interfaces/action/NavigateTo \
  "{x: 5.0, y: 3.0}" --feedback

# 显示动作接口
ros2 interface show my_interfaces/action/NavigateTo
```

**注意**：命令行 `ros2 action send_goal` 会阻塞等待结果；`--feedback` 显示实时反馈；Ctrl+C 可取消。

### 六、三种通信方式选型总结

| 维度 | 话题 Topic | 服务 Service | 动作 Action |
| --- | --- | --- | --- |
| 通信模式 | 单向流 | 请求-应答 | 目标-反馈-结果 |
| 是否阻塞 | 否 | 客户端等待 | 客户端异步 |
| 进度反馈 | 无 | 无 | **有** |
| 取消支持 | 不适用 | 无 | **有** |
| 适用任务 | 持续数据 | 即时问答 | **长任务** |
| 典型场景 | 传感器、指令 | 查询、设置 | 导航、抓取、建图 |
| 接口定义 | .msg | .srv | .action（3段） |
| 底层实现 | 话题 | 服务 | 话题+服务组合 |

**选型口诀**：

```text
持续流动 → 话题
一问一答 → 服务
长任务+进度+可取消 → 动作
```

**动作的使用误区**：

1.  别用动作做毫秒级操作（开销大，杀鸡用牛刀）。
2.  别在 execute_callback 里做无限循环（要有退出条件与取消检查）。
3.  客户端别忘记注册 feedback_callback 和 result_callback。

### 七、总结

本篇文章完整覆盖了动作通信：理解了三通道模型与适用场景、动作接口定义（.action 三段式），用 Python 与 C++ 实现了动作服务端（含可取消版本）与客户端（含取消流程），实战了自定义导航动作，掌握了 `ros2 action` 命令行工具，并完成了话题/服务/动作三大通信方式的选型总结。

**关键要点回顾**：

1.  动作 = Goal（目标）+ Feedback（反馈）+ Result（结果）+ Cancel（取消）。
2.  `.action` 文件三段式定义接口，放在接口包的 `action/` 目录。
3.  服务端核心：execute_callback + publish_feedback + succeed()/canceled()。
4.  取消三步：cancel_callback 同意 → is_cancel_requested 检查 → canceled() 标记。
5.  客户端四步：send_goal_async → goal_response_callback → get_result_async → result_callback。
6.  C++ 服务端要在 handle_accepted 里开线程执行任务，避免阻塞执行器。
7.  长任务带反馈可取消用动作；持续数据用话题；即时问答用服务。

### 下一篇预告

下一篇进入 **launch 文件与多节点启动**：手动开几十个终端运行节点太原始了。本篇文章讲透 launch——用 Python 编写 launch 文件启动多节点、传递参数、设置条件与复用、包含其他 launch 文件，掌握 `ros2 launch` 命令与 launch 调试技巧。学完你就能一键启动整个机器人系统。
