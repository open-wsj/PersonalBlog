---
title: "ROS2系列教程：工作空间与colcon构建"
abbrlink: ros2-xi-lie-jiao-cheng-gong-zuo-kong-jian-yu-colcon-gou-jian
date: "2026-09-03 15:40:10"
categories:
    - "ROS2"
tags: []
desc: "本篇文章把 ROS2 从\"脚本\"提升到了\"工程\"：理解了工作空间四目录结构、package 的概念与两种构建类型（ament_python / ament_cmake），掌握了 colcon…"
---
## 本文是 ROS2 系列教程的第 3 篇

> 本文是 ROS2 系列教程的第 3 篇：工作空间与 colcon 构建。前两篇我们认识了节点与 ROS 图，并运行了最简节点，但那些脚本还只是"散装"的。本篇文章将建立 ROS2 工程的**标准骨架**：工作空间（Workspace）、功能包（Package）与构建工具 colcon。学完本篇，你就能创建自己的 ROS2 包并用 `ros2 run` 正式运行，为后续话题、服务等通信篇目铺好工程基础。C++ 与 Python 两种包的构建方式都会讲到。

### 一、为什么要工作空间与 colcon

#### 1.1 从散装脚本到工程化

想象你写了 10 个节点脚本，散落在不同目录：有的用绝对路径引用，有的依赖别人手动 `export PYTHONPATH`，有的改了代码却不生效……这就是"散装"开发。ROS2 用三件套解决这个问题：

-   **工作空间（Workspace）**：所有包的统一存放目录，包含 `src/build/install/log` 四个子目录。
-   **功能包（Package）**：ROS2 的最小可复用单元，包含代码、依赖描述（package.xml）、构建规则（CMakeLists.txt 或 setup.py）。
-   **colcon**：ROS2 的官方构建工具，负责编译、安装、生成环境变量。

一句话概括：**工作空间管目录，package 管单元，colcon 管构建**。三者配合，让"克隆一个包 → 构建 → 运行"成为标准动作。

#### 1.2 工作空间的四目录结构

```text
ros2_ws/                # 工作空间（名字可自定义，习惯用 ros2_ws）
├── src/                # 源代码目录：放所有 package 源码
├── build/              # 构建中间产物（自动生成，别手动改）
├── install/            # 安装结果：可执行文件、库、Python 包（source 这里）
└── log/                # 构建日志（自动生成）
```

四个目录的分工极其清晰：

| 目录 | 内容 | 是否手工维护 | 说明 |
| --- | --- | --- | --- |
| `src` | 各 package 源码 | 是 | 你唯一需要写代码的地方 |
| `build` | CMake 中间文件、对象文件 | 否 | `colcon build` 自动生成 |
| `install` | 编译安装后的产物 | 否 | 必须 `source install/setup.bash` 才能用 |
| `log` | 构建与运行日志 | 否 | 排障时查看 |

**关键认知**：ROS2 不会自动"看到" `src` 下的包，必须经过 `colcon build` 把包安装到 `install` 目录，再 `source install/setup.bash` 加载环境，`ros2 run` 才能找到你的可执行文件。

#### 1.3 colcon 与旧工具对比

ROS1 时代构建工具是 `catkin_make`/`catkin_tools`，ROS2 官方推荐 **colcon**。三者的核心差异：

| 特性 | catkin_make | catkin_tools | colcon（推荐） |
| --- | --- | --- | --- |
| 增量构建 | 支持 | 支持 | 支持（默认） |
| 只构建指定包 | 需 `-DCATKIN_WHITELIST_PACKAGES` | `--pkg` | `--packages-select` |
| 多语言混合 | 一般 | 一般 | 好（CMake/Python/setuptools 统一） |
| 日志管理 | 单日志 | 分包日志 | 分包日志 |
| 与 ROS2 契合 | 否 | 否 | 是（官方推荐） |

colcon 是 CMake、Python setuptools、ament 等构建系统的统一前端：它检测每个包的类型，自动选择底层构建工具，对外只暴露一致的命令行接口。

### 二、创建第一个工作空间

#### 2.1 初始化工作空间

```bash
# 创建工作空间骨架（只需 src 目录，其余自动生成）
mkdir -p ~/ros2_ws/src
cd ~/ros2_ws

# 在工作空间内编译（src 为空也能构建，生成 build/install/log）
colcon build

# 查看生成的结构
ls -la
```

此时会看到自动生成的 `build/`、`install/`、`log/` 三个目录。`colcon build` 默认会递归扫描 `src` 下的所有 package 并逐个构建。

#### 2.2 source 环境变量

构建完成后，必须加载安装环境，命令才能找到包：

```bash
source /opt/ros/humble/setup.bash     # 系统级 ROS2 基础环境
source ~/ros2_ws/install/setup.bash   # 工作空间级环境（覆盖/追加）
```

**注意顺序**：先 source 系统基础环境，再 source 自己的工作空间。为了让每次打开终端都自动加载，把这两行写入 `~/.bashrc`：

```bash
echo 'source /opt/ros/humble/setup.bash' >> ~/.bashrc
echo 'source ~/ros2_ws/install/setup.bash' >> ~/.bashrc
source ~/.bashrc
```

`install/setup.bash` 本质上是在 PATH、PYTHONPATH、AMENT_PREFIX_PATH、LD_LIBRARY_PATH 等环境变量中追加本工作空间的路径。**理解这一点对排障至关重要**：如果 `ros2 run` 报"找不到包"，十有八九是没 source 或 source 顺序错了。

#### 2.3 环境变量速查

```bash
# 查看当前已加载的所有 ROS2 包路径
echo $AMENT_PREFIX_PATH

# 查看可执行文件搜索路径（应包含 install 目录）
echo $PATH

# 查看 Python 模块搜索路径（应包含 install 下的 Python 包）
echo $PYTHONPATH

# 查看 ROS2 发行版
echo $ROS_DISTRO        # 输出 humble
```

### 三、创建 Python 功能包

#### 3.1 用 ros2 pkg create 创建

ROS2 提供了标准脚手架命令，不要手动手写包结构（容易出错）：

```bash
cd ~/ros2_ws/src

# 创建 Python 包
ros2 pkg create py_demo \
  --build-type ament_python \
  --node-name py_talker \
  --license Apache-2.0 \
  --maintainer-name your_name \
  --maintainer-email your@email.com \
  --description "A Python demo package"
```

生成的目录结构：

```text
py_demo/
├── package.xml          # 包元数据：名称、依赖、版本、许可
├── setup.py             # Python 包构建配置（entry_points 是关键）
├── setup.cfg            # 安装路径配置
├── resource/py_demo     # ament 索引标记文件
├── test/                # 测试目录（test_copyright.py 等）
└── py_demo/             # Python 源码包（与包同名）
    └── __init__.py
```

#### 3.2 理解 setup.py 的 entry_points

Python 包的"可执行入口"由 `setup.py` 的 `entry_points` 定义，这是 `ros2 run` 能找到命令的关键：

```python
from setuptools import setup
import os
from glob import glob

package_name = 'py_demo'

setup(
    name=package_name,
    version='0.0.0',
    packages=[package_name],
    data_files=[
        # 把 launch 文件、config 安装到共享目录（后面篇章用）
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        (os.path.join('share', package_name, 'launch'), glob('launch/*.launch.py')),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='your_name',
    maintainer_email='your@email.com',
    description='A Python demo package',
    license='Apache-2.0',
    entry_points={
        'console_scripts': [
            # 格式：命令名 = 模块路径:函数名
            'py_talker = py_demo.py_talker:main',
            'py_listener = py_demo.py_listener:main',
        ],
    },
)
```

**核心规则**：`entry_points` 里的每一行 `cmd = module:func` 定义了一个命令行命令。`ros2 run py_demo py_talker` 就是执行 `py_demo.py_talker` 模块里的 `main()` 函数。

#### 3.3 编写节点并构建

在 `py_demo/py_talker.py` 中写入：

```python
# py_demo/py_talker.py
import rclpy
from rclpy.node import Node

class PyTalker(Node):
    def __init__(self):
        super().__init__('py_talker')
        self.timer = self.create_timer(1.0, self.tick)
        self.count = 0

    def tick(self):
        self.count += 1
        self.get_logger().info(f'Hello from py_talker #{self.count}')

def main():
    rclpy.init()
    node = PyTalker()
    rclpy.spin(nod
e)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

构建与运行：

```bash
cd ~/ros2_ws
colcon build --packages-select py_demo
source install/setup.bash
ros2 run py_demo py_talker
```

看到每秒打印 `Hello from py_talker #N` 即成功。`--packages-select` 只构建指定包，大型工作空间下比全量构建快得多。

### 四、创建 C++ 功能包

#### 4.1 创建 ament_cmake 包

```bash
cd ~/ros2_ws/src

ros2 pkg create cpp_demo \
  --build-type ament_cmake \
  --node-name cpp_talker \
  --license Apache-2.0 \
  --maintainer-name your_name \
  --maintainer-email your@email.com \
  --description "A C++ demo package"
```

C++ 包的结构：

```text
cpp_demo/
├── package.xml              # 依赖声明（这里会加 rclcpp）
├── CMakeLists.txt           # 构建规则（核心）
├── include/cpp_demo/        # 头文件目录
└── src/
    └── cpp_talker.cpp       # 源文件
```

#### 4.2 理解 CMakeLists.txt

C++ 包的一切构建规则都在 `CMakeLists.txt` 里，核心四段：

```cmake
cmake_minimum_required(VERSION 3.8)
project(cpp_demo)

# 1. 启用编译器特性
if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# 2. 查找依赖（rclcpp 是基础库，必须声明）
find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)

# 3. 生成可执行文件：目标名 + 源文件
add_executable(cpp_talker src/cpp_talker.cpp)

# 4. 链接依赖库 + 安装（缺一不可）
ament_target_dependencies(cpp_talker rclcpp)
install(TARGETS cpp_talker
  DESTINATION lib/${PROJECT_NAME})

ament_package()
```

**注意**：如果不写 `install(TARGETS ...)`，即使构建成功，`ros2 run` 也找不到可执行文件——因为产物没被安装到 `install` 目录。

#### 4.3 编写节点并构建

`src/cpp_talker.cpp`：

```cpp
// src/cpp_talker.cpp
#include "rclcpp/rclcpp.hpp"
#include <chrono>

class CppTalker : public rclcpp::Node
{
public:
  CppTalker() : Node("cpp_talker"), count_(0)
  {
    timer_ = this->create_wall_timer(
      std::chrono::seconds(1),
      std::bind(&CppTalker::tick, this));
  }

private:
  void tick()
  {
    count_++;
    RCLCPP_INFO(this->get_logger(), "Hello from cpp_talker #%ld", count_);
  }

  rclcpp::TimerBase::SharedPtr timer_;
  long count_;
};

int main(int argc, char** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<CppTalker>());
  rclcpp::shutdown();
  return 0;
}
```

构建运行：

```bash
cd ~/ros2_ws
colcon build --packages-select cpp_demo
source install/setup.bash
ros2 run cpp_demo cpp_talker
```

注意 C++ 与 Python 构建的差异：C++ 需要**编译**（耗时几秒到几十秒），Python 是**复制**（几乎瞬时）。所以改 C++ 代码必须重新 build，改 Python 代码同样要 build（虽然快），但可以用 `--symlink-install` 让 Python 包以软链接方式安装。

### 五、colcon 常用选项精讲

#### 5.1 --packages-select：只构建指定包

```bash
# 只构建两个指定包
colcon build --packages-select py_demo cpp_demo

# 忽略某些包（构建除 test_pkg 外的所有包）
colcon build --packages-ignore test_pkg
```

大型工作空间（几十个包）时，全量构建一次可能好几分钟，用 `--packages-select` 精准构建改动的包能大幅提速。

#### 5.2 --symlink-install：Python 开发神器

```bash
colcon build --symlink-install
```

这个选项让 Python 包以**软链接**方式安装到 `install` 目录：改完代码**不用重新 build**，直接运行即是新代码。C++ 包不受影响（仍要编译）。Python 开发强烈建议加这个选项。

#### 5.3 --cmake-args 与 --event-handlers

```bash
# 向底层 CMake 传递参数（比如 Debug 编译）
colcon build --cmake-args -DCMAKE_BUILD_TYPE=Debug

# 只显示错误信息（减少刷屏）
colcon build --event-handlers console_direct+ 2>&1 | grep -i error
```

#### 5.4 常见构建问题速查

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `Package 'xxx' not found` | 缺依赖未安装 | `sudo apt install ros-humble-xxx` |
| `ros2 run` 找不到包 | 没 source install | `source install/setup.bash` |
| `ros2 run` 找不到命令 | entry_points 未配/未重新 build | 检查 setup.py 或 CMakeLists 的 install |
| 改了 Python 不生效 | 没重新 build | `colcon build --packages-select 包名` 或加 `--symlink-install` |
| `Command 'colcon' not found` | 没装 colcon | `sudo apt install python3-colcon-common-extensions` |
| 构建报 CMake 缓存混乱 | 缓存脏 | 删除 `build/` 与 `install/` 对应包目录后重 build |

### 六、实战：一个包含双语言包的工作空间

#### 6.1 完整演练流程

```bash
# 1. 创建并初始化工作空间
mkdir -p ~/ros2_ws/src && cd ~/ros2_ws

# 2. 创建 Python 包 + C++ 包
cd src
ros2 pkg create py_demo --build-type ament_python --node-name py_talker --license Apache-2.0 --maintainer-name you --maintainer-email you@example.com --description "py demo"
ros2 pkg create cpp_demo --build-type ament_cmake --node-name cpp_talker --license Apache-2.0 --maintainer-name you --maintainer-email you@example.com --description "cpp demo"
cd ..

# 3. 按上文补全 py_talker.py 与 cpp_talker.cpp 内容

# 4. 全量构建（加 symlink 方便 Python 调试）
colcon build --symlink-install

# 5. source 环境
source install/setup.bash

# 6. 双语言节点同时跑
ros2 run py_demo py_talker &   # Python 节点
ros2 run cpp_demo cpp_talker   # C++ 节点
```

运行后 `ros2 node list` 应能看到两个节点同时在线，证明工作空间、双包、双语言全部打通。

#### 6.2 查看构建产物

```bash
# 查看包是否被 ament 索引
ros2 pkg list | grep -E 'py_demo|cpp_demo'

# 查看包信息
ros2 pkg prefix py_demo          # 包安装位置
ros2 pkg executables py_demo     # 包内可执行命令

# 查看包依赖树
ros2 pkg xml py_demo             # 打印 package.xml
```

#### 6.3 工作空间的管理建议

1.  **每个包只做一件事**：话题包、服务包、工具包分开，方便复用。
2.  **package.xml 依赖要写全**：缺依赖在别的机器上构建直接失败。
3.  **launch 文件放 `launch/` 目录**：并在 `setup.py`/`CMakeLists.txt` 中安装（第 11 篇详讲）。
4.  **版本控制**：`build/`、`install/`、`log/` 加入 `.gitignore`，只提交 `src/`。

### 七、总结

本篇文章把 ROS2 从"脚本"提升到了"工程"：理解了工作空间四目录结构、package 的概念与两种构建类型（ament_python / ament_cmake），掌握了 colcon 的完整用法，并通过一个双语言实战工作空间验证了全链路。

**关键要点回顾**：

1.  工作空间 = `src`（源码）+ `build`/`install`/`log`（自动生成），构建后必须 `source install/setup.bash`。
2.  `ros2 pkg create` 是创建包的唯一推荐方式，别手写包结构。
3.  Python 包核心在 `setup.py` 的 `entry_points`；C++ 包核心在 `CMakeLists.txt` 的 `add_executable + install(TARGETS)`。
4.  `colcon build --packages-select 包名` 精准构建；`--symlink-install` 让 Python 改完即用。
5.  排障第一招：确认 `source` 顺序与环境变量 `AMENT_PREFIX_PATH`。

### 下一篇预告

下一篇深入 **package 结构剖析**：逐字段讲解 `package.xml` 与 `CMakeLists.txt`/`setup.py` 的每个配置项，介绍自定义消息/服务接口包（`ament_cmake` 的 `.msg`/`.srv` 定义与生成），并对比 CMake 与 Python 两种包的异同。学完你能看懂任何开源 ROS2 包的目录结构，也知道如何正确声明依赖。
