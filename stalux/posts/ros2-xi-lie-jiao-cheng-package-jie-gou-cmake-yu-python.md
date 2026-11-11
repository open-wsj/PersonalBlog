---
title: "ROS2系列教程：package结构（CMake与Python两种包）"
abbrlink: ros2-xi-lie-jiao-cheng-package-jie-gou-cmake-yu-python
date: "2026-09-03 15:40:31"
categories:
    - "ROS2"
tags: []
desc: "ROS2 内置的std_msgs覆盖常见场景，但你的业务数据（比如\"机器人位姿 + 置信度 + 时间戳\"）往往是组合结构。这时需要自定义消息类型——定义一个.msg文件，rosidl…"
---
## 本文是 ROS2 系列教程的第 4 篇

> 本文是 ROS2 系列教程的第 4 篇：package 结构剖析（CMake 与 Python 两种包）。上一篇我们创建了两个包，但只是"会跑"；本篇把包的每一块骨头拆开看：`package.xml` 每个字段的含义、`CMakeLists.txt` 与 `setup.py` 的配置细节、自定义消息/服务接口包（`.msg`/`.srv`）的定义与生成，以及两种包类型的完整对比。学完本篇，你能看懂任何开源 ROS2 包的目录结构，也能正确声明依赖、定义自己的接口。

### 一、package.xml：包的身份证

#### 1.1 最小完整示例

`package.xml` 是**每个 ROS2 包都必须有**的清单文件，描述包的元数据与依赖。一个完整的 `package.xml` 长这样：

```xml
<?xml version="1.0"?>
<?xml-model href="http://download.ros.org/schema/package_format3.xsd" schematypens="http://www.w3.org/2001/XMLSchema"?>
<package format="3">
  <!-- 基本信息 -->
  <name>my_pkg</name>
  <version>0.1.0</version>
  <description>一个示例包</description>
  <maintainer email="you@example.com">Your Name</maintainer>
  <license>Apache-2.0</license>

  <!-- 依赖声明（五种） -->
  <buildtool_depend>ament_cmake</buildtool_depend>     <!-- 构建工具 -->
  <depend>rclcpp</depend>                              <!-- 构建+运行时依赖 -->
  <build_depend>sensor_msgs</build_depend>             <!-- 仅构建时依赖 -->
  <exec_depend>launch_ros</exec_depend>               <!-- 仅运行时依赖 -->
  <test_depend>ament_lint_auto</test_depend>          <!-- 测试依赖 -->

  <!-- 导出（可省略） -->
  <export>
    <build_type>ament_cmake</build_type>
  </export>
</package>
```

#### 1.2 五种依赖类型详解

| 标签 | 含义 | 何时使用 |
| --- | --- | --- |
| `<buildtool_depend>` | 构建工具本身 | 几乎都是 `ament_cmake` 或 `ament_python` |
| `<depend>` | 构建 + 运行时都需要 | 最常用，如 `rclcpp`、`rclpy`、`std_msgs` |
| `<build_depend>` | 仅编译时需要 | 只在头文件/编译期用到的库 |
| `<exec_depend>` | 仅运行时需要 | 如 launch 文件依赖、Python 包 |
| `<test_depend>` | 测试时依赖 | `ament_lint_auto` 等 |

**最佳实践**：拿不准时统一用 `<depend>`，它等价于同时声明 build + exec 依赖，最保险。

#### 1.3 format 属性：3 与 2 的区别

```xml
<package format="3">
```

-   `format="2"`：最常用，支持 `<depend>`。
-   `format="3"`：额外支持 `<member_of_group>`（把包归入组，如 `rosidl_interface_packages`），用于接口包。
-   `format="1"`：老格式，只有 build/exec 两种依赖，新包不要用。

**接口包（定义 .msg/.srv 的包）必须用 format 3**，并在 export 里声明组：

```xml
<export>
  <build_type>ament_cmake</build_type>
  <member_of_group>rosidl_interface_packages</member_of_group>
</export>
```

### 二、Python 包结构详解

#### 2.1 完整目录树

```text
py_pkg/
├── package.xml            # 包清单（build_type = ament_python）
├── setup.py               # 构建配置（核心）
├── setup.cfg              # 安装路径配置
├── resource/
│   └── py_pkg             # ament 索引标记（内容可空）
├── test/
│   ├── test_copyright.py
│   ├── test_flake8.py
│   └── test_pep257.py
└── py_pkg/                # Python 源码目录（与包同名）
    ├── __init__.py
    └── my_node.py         # 节点实现
```

#### 2.2 setup.py 逐字段

```python
from setuptools import setup
from glob import glob
import os

package_name = 'py_pkg'

setup(
    name=package_name,                                  # 包名，必须与目录同名
    version='0.0.0',                                    # 版本号
    packages=[package_name],                            # Python 包列表（源码目录）
    data_files=[                                        # 数据/资源文件安装位置
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),              # ament 索引（必须）
        ('share/' + package_name, ['package.xml']),     # 包清单（必须）
        (os.path.join('share', package_name, 'launch'), # launch 文件（可选）
            glob('launch/*.launch.py')),
        (os.path.join('share', package_name, 'config'), # 配置文件（可选）
            glob('config/*.yaml')),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='your_name',
    maintainer_email='you@example.com',
    description='Python 示例包',
    license='Apache-2.0',
    entry_points={
        'console_scripts': [
            'my_node = py_pkg.my_node:main',            # 命令名 = 模块:函数
        ],
    },
)
```

**四个必须**：`name` 与目录同名、`packages` 含源码目录、`data_files` 含 ament 索引与 package.xml、`entry_points` 定义可执行命令。缺任何一个，`ros2 run` 都可能失败。

#### 2.3 setup.cfg：安装路径

```ini
[develop]
script_dir=$base/lib/py_pkg
[install]
install_scripts=$base/lib/py_pkg
```

这个文件把脚本安装到 `lib/<包名>/` 目录，`ros2 run` 才能找到。**一般照抄即可，不要乱改**。

### 三、CMake 包结构详解

#### 3.1 完整目录树

```text
cpp_pkg/
├── package.xml            # 包清单（build_type = ament_cmake）
├── CMakeLists.txt         # 构建规则（核心）
├── include/cpp_pkg/       # 公共头文件（按约定与包同名）
│   └── my_node.hpp
├── src/
│   ├── my_node.cpp        # 节点实现
│   └── main.cpp           # 入口
├── launch/                # launch 文件（需在 CMakeLists 安装）
├── config/                # 配置文件
└── msg/ srv/ action/      # 接口定义目录（本包定义接口时）
```

#### 3.2 CMakeLists.txt 逐段

```cmake
cmake_minimum_required(VERSION 3.8)
project(cpp_pkg)                    # 项目名 = 包名

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# 找依赖：用到几个找几个，保持最小化
find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(std_msgs REQUIRED)     # 用到标准消息时

# 生成库（可选，模块化时用）
add_library(cpp_pkg_core
  src/my_node.cpp
)
target_include_directories(cpp_pkg_core PUBLIC
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
  $<INSTALL_INTERFACE:include>)
ament_target_dependencies(cpp_pkg_core rclcpp std_msgs)

# 生成可执行文件
add_executable(my_node src/main.cpp)
target_link_libraries(my_node cpp_pkg_core)   # 链接自己的库
ament_target_dependencies(my_node rclcpp std_msgs)

# 安装：可执行文件、头文件、launch、config（缺一不可）
install(TARGETS my_node cpp_pkg_core
  EXPORT export_${PROJECT_NAME}
  ARCHIVE DESTINATION lib
  LIBRARY DESTINATION lib
  RUNTIME DESTINATION lib/${PROJECT_NAME}
)
install(DIRECTORY include/ DESTINATION include)
install(DIRECTORY launch DESTINATION share/${PROJECT_NAME})
install(DIRECTORY config DESTINATION share/${PROJECT_NAME})

ament_package()
```

**最容易踩的三个坑**：

1.  忘写 `install(TARGETS ...)` → `ros2 run` 找不到命令。
2.  忘写 `ament_target_dependencies` → 编译报"找不到头文件/链接错误"。
3.  忘写 `find_package(std_msgs)` 却在代码里 `#include "std_msgs/msg/string.hpp"` → 编译报错。

#### 3.3 头文件与源文件分离

工程化项目推荐把实现放库、入口放 main：

```cpp
// include/cpp_pkg/my_node.hpp
#pragma once
#include "rclcpp/rclcpp.hpp"

class MyNode : public rclcpp::Node
{
public:
  MyNode();
private:
  rclcpp::TimerBase::SharedPtr timer_;
};
```

```cpp
// src/my_node.cpp
#include "cpp_pkg/my_node.h
pp"
#include <chrono>

MyNode::MyNode() : Node("my_node")
{
  timer_ = this->create_wall_timer(
    std::chrono::seconds(1),
    [this]() { RCLCPP_INFO(this->get_logger(), "tick"); });
}
```

```cpp
// src/main.cpp
#include "cpp_pkg/my_node.hpp"
#include "rclcpp/rclcpp.hpp"

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<MyNode>());
  rclcpp::shutdown();
  return 0;
}
```

这样"库 + 薄入口"的结构便于单元测试与复用，是大型项目的标准组织方式。

### 四、自定义接口包：msg / srv

#### 4.1 为什么要自定义接口

ROS2 内置的 `std_msgs`、`sensor_msgs`、`geometry_msgs` 覆盖常见场景，但你的业务数据（比如"机器人位姿 + 置信度 + 时间戳"）往往是组合结构。这时需要**自定义消息类型**——定义一个 `.msg` 文件，rosidl 工具会自动生成对应语言的类型代码。

#### 4.2 创建接口包

接口包通常是独立的纯接口包（不放实现），因为它会被多个包依赖：

```bash
ros2 pkg create my_interfaces \
  --build-type ament_cmake \
  --license Apache-2.0 \
  --maintainer-name your_name \
  --maintainer-email you@example.com \
  --description "Custom interfaces"
```

#### 4.3 定义 .msg 文件

在 `my_interfaces/msg/` 目录创建 `RobotStatus.msg`：

```text
# msg/RobotStatus.msg —— 自定义消息
string robot_name          # 字符串字段
float32 battery_level      # 浮点字段（0.0 ~ 1.0）
int32 status_code          # 整数状态码
builtin_interfaces/Time stamp   # 嵌套内置类型
```

**消息类型映射表**（.msg 写法 → C++ 类型 → Python 类型）：

| .msg 写法 | C++ 类型 | Python 类型 |
| --- | --- | --- |
| `bool` | `bool` | `bool` |
| `int8/16/32/64` | `int8_t` 等 | `int` |
| `float32/float64` | `float/double` | `float` |
| `string` | `std::string` | `str` |
| `string[]` | `std::vector<std::string>` | `list` |
| `builtin_interfaces/Time` | `builtin_interfaces::msg::Time` | `Time` |
| `geometry_msgs/Pose` | `geometry_msgs::msg::Pose` | `Pose` |

**规则**：字段名小写下划线；数组用 `[]` 后缀；嵌套类型写 `包名/类型名`。

#### 4.4 定义 .srv 文件

在 `my_interfaces/srv/` 创建 `SetSpeed.srv`（`---` 分隔请求与响应）：

```text
# 请求部分
float64 target_speed
bool   is_emergency_stop

---
# 响应部分
bool     success
string   message
```

#### 4.5 修改 CMakeLists.txt 启用接口生成

接口包的 `CMakeLists.txt` 需要添加 rosidl 相关配置：

```cmake
find_package(rosidl_default_generators REQUIRED)
find_package(builtin_interfaces REQUIRED)

# 声明接口文件（msg 与 srv 分开列）
set(msg_files
  "msg/RobotStatus.msg"
)
set(srv_files
  "srv/SetSpeed.srv"
)

# 生成接口（核心命令）
rosidl_generate_interfaces(${PROJECT_NAME}
  ${msg_files}
  ${srv_files}
  DEPENDENCIES builtin_interfaces
)

# 接口包不需要普通可执行文件，直接 ament_package
ament_package()
```

package.xml 也要加依赖：

```xml
<depend>rosidl_default_generators</depend>
<depend>builtin_interfaces</depend>
<member_of_group>rosidl_interface_packages</member_of_group>
```

#### 4.6 在代码中使用自定义消息

**C++**：

```cpp
#include "my_interfaces/msg/robot_status.hpp"
#include "my_interfaces/srv/set_speed.hpp"

// 使用消息
my_interfaces::msg::RobotStatus status;
status.robot_name = "turtlebot";
status.battery_level = 0.85f;
```

**Python**：

```python
from my_interfaces.msg import RobotStatus
from my_interfaces.srv import SetSpeed

status = RobotStatus()
status.robot_name = "turtlebot"
status.battery_level = 0.85
```

#### 4.7 接口命令速查

```bash
# 查看系统所有可用接口类型
ros2 interface list

# 查看某个消息/服务的定义
ros2 interface show my_interfaces/msg/RobotStatus
ros2 interface show my_interfaces/srv/SetSpeed

# 查看消息包含的字段
ros2 interface proto my_interfaces/msg/RobotStatus
```

### 五、两种包类型全面对比

| 维度 | ament_python | ament_cmake |
| --- | --- | --- |
| 构建配置 | `setup.py` | `CMakeLists.txt` |
| 语言 | Python | C/C++ |
| 构建速度 | 快（复制） | 慢（编译） |
| 改代码生效 | `--symlink-install` 后免构建 | 必须重新 build |
| 性能 | 较低 | 高 |
| 适合场景 | 原型、脚本、快速迭代 | 性能敏感、实时控制、复杂算法 |
| 接口包支持 | 一般不用于定义接口 | 必须（rosidl 依赖 CMake） |
| 单元测试 | pytest | gtest |
| 依赖声明 | 同一 package.xml | 同一 package.xml |

**关键结论**：

1.  **接口包只能用 ament_cmake 定义**（rosidl 生成器依赖 CMake），Python 包可以消费接口但不能定义。
2.  一个工作空间可以混合两种包，colcon 自动识别各自构建方式。
3.  代码要跨语言复用时，接口定义放独立接口包，业务实现再分语言包。

### 六、实战：接口包 + 双语言消费者

#### 6.1 完整演练

```bash
# 1. 创建接口包
cd ~/ros2_ws/src
ros2 pkg create my_interfaces --build-type ament_cmake \
  --license Apache-2.0 --maintainer-name you --maintainer-email you@example.com --description "Custom interfaces"

# 2. 写入 msg/RobotStatus.msg（见 4.3）
# 3. 写入 srv/SetSpeed.srv（见 4.4）
# 4. 按 4.5 修改 CMakeLists.txt 与 package.xml

# 5. 构建接口包
cd ~/ros2_ws
colcon build --packages-select my_interfaces
source install/setup.bash

# 6. 验证接口可用
ros2 interface show my_interfaces/msg/RobotStatus
```

#### 6.2 用命令行发一个自定义话题（无代码验证）

```bash
# 发布自定义消息（需要提供完整字段值）
ros2 topic pub /robot_status my_interfaces/msg/RobotStatus \
  "{robot_name: 'turtle', battery_level: 0.9, status_code: 1, stamp: {sec: 0, nanosec: 0}}" --rate 1

# 另开终端订阅查看
ros2 topic echo /robot_status
```

如果终端能正常收发你的自定义消息，说明接口包定义、生成、环境加载全部正确——这是最快的"接口自检"方式。

#### 6.3 常见接口错误排查

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `ros2 interface show` 找不到 | 接口包没构建或没 source | `colcon build` + `source install/setup.bash` |
| 编译报 `No such file or directory` | include 路径错 | C++ 用 `包名/msg/文件名.hpp` 全路径 |
| 运行时 `ImportError: No module named 'my_interfaces'` | Python 环境没加载 | 确认 source 了 install 目录 |
| 消息字段名对不上 | .msg 命名规范 | 字段一律小写下划线，重建接口包 |

### 七、总结

本篇文章拆解了 ROS2 包的完整结构：`package.xml` 的五种依赖声明、Python 包 `setup.py` 的四个必须配置、CMake 包 `CMakeLists.txt` 的三个易错点、自定义接口（`.msg`/`.srv`）的定义与生成流程，以及两种包类型的选型对比。

**关键要点回顾**：

1.  `package.xml` 是包的必要身份证，依赖不确定时统一用 `<depend>`。
2.  Python 包四必须：`name`、`packages`、`data_files`（ament 索引+package.xml）、`entry_points`。
3.  CMake 包三易错：忘 `install(TARGETS)`、忘 `ament_target_dependencies`、忘 `find_package`。
4.  自定义接口用独立接口包（ament_cmake + format 3 + `rosidl_generate_interfaces`），支持跨语言消费。
5.  `.msg`/`.srv` 字段小写下划线，`---` 分隔服务请求响应。
6.  接口自检最快方式：`ros2 interface show` + `ros2 topic pub/echo`。

### 下一篇预告

下一篇正式进入 ROS2 通信核心：**话题 Topic 通信（上）——发布者与订阅者**。我们将深入话题机制（Publish/Subscribe 模型、去中心化发现、QoS 匹配），用 Python 与 C++ 各写一个发布者/订阅者对，理解 `create_publisher`、`create_subscription` 与回调机制，并掌握 `ros2 topic` 全套调试命令。
