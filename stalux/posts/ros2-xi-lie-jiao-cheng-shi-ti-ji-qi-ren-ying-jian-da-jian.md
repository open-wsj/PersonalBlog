---
title: "ROS2系列教程：实体机器人硬件搭建（原理）"
abbrlink: ros2-xi-lie-jiao-cheng-shi-ti-ji-qi-ren-ying-jian-da-jian
date: "2026-10-18 22:52:57"
categories:
    - "ROS2"
tags: []
desc: "本文是 ROS2 系列教程的第 31 篇：实体机器人硬件搭建（原理）。第 26-30 篇我们打通了硬件控制全链路：电机、舵机、传感器、MicroROS、ROS2-Control…"
---
## 本文是 ROS2 系列教程的第 31 篇

> 本文是 ROS2 系列教程的第 31 篇：实体机器人硬件搭建（原理）。第 26-30 篇我们打通了硬件控制全链路：电机、舵机、传感器、MicroROS、ROS2-Control。但那些都是在"零件"层面。本篇开始进入**实体机器人阶段（31-34）**：把前面所有的零件组装成一台能跑、能感知、能建图导航的真机器人。本篇聚焦硬件搭建的完整原理：总体架构、选型、电气连接、电源管理、车架结构，并给出计算与调试方法，为第 32-34 篇的软件开发打基础。

### 一、实体机器人总体架构

#### 1.1 经典两轮差速小车的组成

一台能跑 ROS2 的最小实体机器人（两轮差速小车）由以下部分组成：

| 模块 | 组成 | 作用 |
| --- | --- | --- |
| 车架 | 底盘板、连接件、轮子 | 承载所有部件 |
| 动力 | 直流减速电机 ×2、编码器、电机驱动（TB6612） | 驱动车轮、测速 |
| 下位机 | STM32 / ESP32 | 电机闭环控制、传感器采集 |
| 上位机 | 树莓派 / Jetson Nano | 运行 ROS2、建图导航 |
| 电源 | 锂电池、稳压模块 | 供电 |
| 感知 | 激光雷达、IMU、超声波 | 环境感知 |
| 通信 | USB 串口、Wi-Fi | 上/下位机通信 |

经典数据流：

```text
激光雷达 ─┐
IMU ──────┼→ 上位机(ROS2) ──/cmd_vel──→ 下位机(STM32) ──PWM──→ 电机驱动 ──→ 电机
超声波 ───┘        ↑                                              │
                /odom ◄──── 编码器测速 ── 下位机闭环 ────────────────┘
```

#### 1.2 为什么选两轮差速

两轮差速（2WD）是最适合入门和学习的底盘构型：

| 底盘类型 | 优点 | 缺点 | 适合 |
| --- | --- | --- | --- |
| 两轮差速 | 结构简单、成本低、控制成熟 | 只能原地旋转和前后走 | 入门、室内、教学 |
| 四轮差速 | 负载大、越野 | 转向需要滑移 | 室外 |
| 麦克纳姆轮 | 全向移动、可横移 | 贵、控制复杂、效率低 | 竞赛、仓储 |
| 阿克曼转向 | 接近真车 | 结构复杂、不能原地转 | 室外车模 |

两轮差速的运动学模型（第 13 篇讲过）：给线速度 v 和角速度 ω，换算左右轮速：

```text
v_left  = (v - ω × L/2) / r
v_right = (v + ω × L/2) / r
其中 L=轮距，r=轮半径
```

#### 1.3 上下位机分工再明确

-   **上位机（树莓派/Jetson）**：跑 ROS2、SLAM、Nav2。算力强但功耗高（5V 2-3A）。
-   **下位机（STM32）**：电机闭环、编码器、超声波等实时性要求高的任务。功耗低、实时性强。
-   **分界点**：所有"控制周期 ≤ 10ms"的任务放下位机，其余放上位机。

### 二、硬件选型（原理与要点）

#### 2.1 电机选型

机器人电机选择的核心参数：

| 参数 | 说明 | 选择要点 |
| --- | --- | --- |
| 减速比 | 电机转速 vs 输出转速 | 小车常用 1:30 ~ 1:90 |
| 额定电压 | 常见 3.7V/6V/12V | 与电池电压匹配 |
| 额定转速 | 输出轴 RPM | 小车 100-300 RPM 合适 |
| 扭矩 | 决定爬坡/加速能力 | 越大越有力 |
| 编码器 | 每转脉冲数（PPR） | 至少 11-13 PPR，配 4 倍频 |

**选型计算示例**：目标最高速度 0.5 m/s，轮径 65mm（半径 0.0325m）：

```text
轮子转速 = v / (2πr) = 0.5 / (2 × 3.14 × 0.0325) ≈ 2.45 转/秒 ≈ 147 RPM

电机（减速前）转速 = 147 × 减速比
选 1:30 减速比 → 电机 ≈ 4410 RPM（合理，常见 3000-12000 RPM 电机）

所需扭矩估算（车重 1kg，摩擦系数 0.3，加速度 1m/s²）：
F = m×a + μ×m×g = 1×1 + 0.3×1×9.8 ≈ 3.94 N
每轮扭矩 = F×r / 2 / 效率 ≈ 3.94×0.0325/2/0.6 ≈ 0.107 N·m
```

结论：选择 12V、减速比 1:30、额定转速 ~5000RPM、扭矩 ≥ 0.15 N·m、带编码器的直流减速电机。

#### 2.2 上位机选型

| 平台 | 优点 | 缺点 | 建议 |
| --- | --- | --- | --- |
| 树莓派 4B/5 | 生态好、教程多、便宜 | 算力一般、散热 | 入门首选 |
| Jetson Nano/Orin | GPU 算力强 | 贵、功耗高 | 视觉项目 |
| 工控机 | 稳定、接口全 | 大、贵 | 工业 |

运行 ROS2 Humble 至少需要：4GB 内存、16GB 存储、支持 USB3.0（接激光雷达）。

#### 2.3 激光雷达选型

| 型号 | 测距 | 频率 | 特点 |
| --- | --- | --- | --- |
| RPLIDAR A1 | 12m | 5.5Hz | 最经典，性价比高 |
| YDLIDAR X4 | 10m | 6-7Hz | 国产，性价比高 |
| RPLIDAR A2/A3 | 12-25m | 8-16Hz | 精度更高 |
| Livox Mid-360 | 40m | 10Hz | 3D 雷达，贵 |

入门选 RPLIDAR A1 或 YDLIDAR X4 即可满足室内 SLAM。

#### 2.4 电源选型

| 电池 | 电压 | 优点 | 缺点 |
| --- | --- | --- | --- |
| 18650 锂电（2S/3S） | 7.4/11.1V | 便宜、容量大 | 需要保护板 |
| 航模锂电 LiPo | 7.4-11.1V | 放电猛 | 娇贵、怕过放 |
| 磷酸铁锂 | 6.4-9.6V | 安全、寿命长 | 电压低 |

**电源架构**（关键）：

```text
锂电池（11.1V）
    ├── 降压模块 → 12V/5A → 电机驱动（电机供电）
    ├── 降压模块 → 5V/3A → 树莓派（上位机）
    └── 降压模块 → 5V/1A → STM32 + 传感器
```

注意：电机启动电流大，**电机供电必须与逻辑供电隔离**（至少分开走线、电容滤波），否则电机一启动上位机就复位。

### 三、电气连接与布线（原理）

#### 3.1 接线规范

实体机器人接线是"细节决定成败"的环节，规范如下：

1.  **电源线粗、信号线细**：电机线用 20AWG 以上，信号线 26-28AWG。
2.  **共地**：所有模块 GND 必须连在一起（否则通信不稳定）。
3.  **上下位机串口交叉**：上位机 TX → 下位机 RX，上位机 RX → 下位机 TX，共地。
4.  **屏蔽与隔离**：电机线与传感器线分开走，避免干扰；长线用双绞或屏蔽线。
5.  **防反接**：电源入口加防反接二极管或防反接模块。

#### 3.2 完整接线清单（示例）

```text
电源：
  11.1V 电池 → 电源开关 → 分线排
    ├─→ 5V/5A 降压 → 树莓派 5V/GND
    ├─→ 5V/2A 降压 → STM32 5V + 传感器 VCC
    └─→ 12V 直供 → TB6612 VM（电机电源）

下位机（STM32）：
  PA0/PA1 → 左电机编码器 A/B
  PB6/PB7 → 右电机编码器 A/B（或用定时器编码器模式）
  PA6/PA7 → TB6612 PWMA/PWMB
  PA4/PA5 → TB6612 AIN1/AIN2
  PB0/PB1 → TB6612 BIN1/BIN2
  PA8     → TB6612 STBY
  PA9/PA10→ 串口1 → 树莓派 UART（115200）

上位机（树莓派）：
  GPIO14/15 → 串口 → STM32
  USB0      → RPLIDAR A1
  I2C       → IMU（可选）

雷达：
  RPLIDAR → 5V/GND + USB
```

#### 3.3 电流估算（防电源不足）

总电流估算（满载）：

```text
树莓派 4B：       ~1.2A（峰值 2.5A）
STM32 + 传感器：  ~0.3A
激光雷达：        ~0.4A
电机（2 个堵转）： 2 × 1.5A = 3A
合计：            ~5A（峰值）

电池容量建议：≥ 5000mAh（2S/3S），续航 1-2 小时
降压模块额定：电机路 ≥ 5A，逻辑路 ≥ 3A
```

### 四、示例 1：车架与结构设计（原理）

#### 4.1 车架结构要点

1.  **重心低**：电池放最底层，重心尽量贴近地面，转弯更稳。
2.  **重心居中**：电池、上位机尽量居中对称，避免偏载导致跑偏。
3.  **轮距与轴距**：轮距越宽越稳但转弯半径越大；两轮小车通常轮距 = 车宽的 60-70%。
4.  **驱动轮与万向轮**：两轮差速需要配 1-2 个万向轮（牛眼轮/万向球）做支撑。
5.  **模块固定**：减震（雷达、IMU 用硅胶垫），防松动（螺丝胶）。

#### 4.2 建模辅助（可选）

可以用 FreeCAD/Onshape 建 3D 模型验证干涉，也可以用简单画图工具画布线图。实体搭建前先画一张"俯视布局图"，标注每个模块位置和走线，能省大量返工。

### 五、示例 2：下位机固件框架（原理）

下位机 STM32 固件采用"定时中断 + 状态机"结构，主循环处理通信，定时中断处理控制：

```c
// main.c 框架：下位机固件主循环（伪代码 + 关键逻辑）
#include "main.h"
#include "motor_driver.h"
#include "encoder.h"
#include "pid.h"
#include "protocol.h"

// 全局变量
volatile float target_v = 0, target_w = 0;  // 目标线速度/角速度
volatile float current_v = 0, current_w = 0;

// 10ms 控制定时器中断：速度闭环
void HAL_TIM_PeriodElapsedCallback(TIM_HandleTypeDef *htim) {
    if (htim->Instance == TIM6) {
        // 1. 编码器测速 → 计算实际线/角速度
        float v_left = encoder_speed(ENC_LEFT);    // rad/s
        float v_right = encoder_speed(ENC_RIGHT);
        current_v = (v_left + v_right) * WHEEL_RADIUS / 2.0;
        current_w = (v_right - v_left) * WHEEL_RADIUS / WHEEL_BASE;

        // 2. 逆运动学：目标线/角速度 → 左右轮速
        float wl = (target_v - target_w * WHEEL_BASE / 2.0) / WHEEL_RADIUS;
        float wr = (target_v + target_w * WHEEL_BASE / 2.0) / WHEEL_RADIUS;

        // 3. PID 闭环 → PWM
        motor_left_set_speed((int)pid_update(&pid_l, wl, v_left));
        motor_right_set_speed((int)pid_update(&pid_r, wr, v_right));
    }
}

// 主循环：处理串口协议帧
int main(void) {
    HAL_Init();
    SystemClock_Config();
    MX_GPIO_Init();
    MX_TIM6_Init();      // 10ms 控制定时器
    MX_USART1_UART_Init();
    motor_init();
    HAL_TIM_Base_Start_IT(&htim6);   // 启动控制定时器

    protocol_frame_t frame;
    while (1) {
        // 解析串口帧（协议见第 29 篇：帧头+命令+校验）
        if (protocol_parse(&frame) == PROTOCOL_OK) {
            switch (frame.cmd) {
                case CMD_SET_VEL:   // 设置目标速度
                    target_v = frame.f32[0];
                    target_w = frame.f32[1];
                    break;
                case CMD_GET_ODOM:  // 上位机查询里程计
                    protocol_send_odom(current_v, current_w);
                    break;
                case CMD_RESET:     // 复位
                    __NVIC_SystemReset();
                    break;
            }
        }
    }
}
```

这个框架体现了下位机的核心原则：**控制（中断）+ 通信（主循环）分离**，保证实时性。

### 六、示例 3：上位机串口通信节点（Python）

上位机用 ROS2 节点与下位机通信：订阅 `/cmd_vel` 打包发送，读取里程计回传发布 `/odom`：

```python
# serial_bridge.py：上位机-下位机串口桥（ROS2 节点）
import rclpy
import serial
import struct
from rclpy.node import Node
from geometry_msgs.msg import Twist
from nav_msgs.msg import Odometry
from std_msgs.msg import Header

class SerialBridge(Node):
    FRAME_HEAD = 0xAA55

    def __init__(self):
        super().__init__('serial_bridge')
        # 串口配置（与下位机一致）
        self.ser = serial.Serial('/dev/ttyUSB0', 115200, timeout=0.02)
        # 订阅速度指令
        self.cmd_sub = self.create_subscription(
            Twist, '/cmd_vel', self.on_cmd_vel, 10)
        # 发布里程计
        self.odom_pub = self.create_publisher(Odometry, '/odom', 10)
        self.timer = self.create_timer(0.02, self.read_odom)  # 50Hz

    def on_cmd_vel(self, msg: Twist):
        # 打包：帧头(2B) + 命令(1B) + 数据(8B float×2) + 校验(1B)
        data = struct.pack('>2ff', msg.linear.x, msg.angular.z)
        checksum = 0
        for b in data:
            checksum ^= b
        frame = struct.pack('>HB', self.FRAME_HEAD, 0x01) + data + bytes([checksum])
        self.ser.write(frame)

    def read_odom(self):
        # 读下位机回传帧（简化：固定格式）
        buf = self.ser.read(15)
        if len(buf) != 15:
            return
        head, cmd = struct.unpack('>HB', buf[:3])
        if head != self.FRAME_HEAD or cmd != 0x02:
            return
        v, w = struct.unpack('>2f', buf[3:11])
        # 发布里程计（简化：仅速度，实际工程应积分位姿）
        odom = Odometry()
        odom.header = Header()
        odom.header.stamp = self.get_clock().now().to_msg()
        odom.header.frame_id = 'odom'
        odom.child_frame_id = 'base_link'
        odom.twist.twist.linear.x = v
        odom.twist.twist.angular.z = w
        self.odom_pub.publish(odom)

def main(args=None):
    rclpy.init(args=args)
    node = SerialBridge()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**验证链路**：

```bash
# 终端 1：启动串口桥
ros2 run robot_bringup serial_bridge.py

# 终端 2：发速度指令，观察电机是否转
ros2 topic pub /cmd_vel geometry_msgs/msg/Twist \
  "{linear: {x: 0.1}, angular: {z: 0.0}}" --once

# 终端 3：查看里程计（轮子转起来 /odom 才有数据）
ros2 topic echo /odom
```

### 七、示例 4：整机启动流程与调试（launch）

实体机器人调试要"分层验证"：先硬件后软件，先单模块后整机。

#### 7.1 分层调试顺序

```text
第 1 层 电源：各模块电压正常，指示灯亮
第 2 层 下位机：串口打印正常，电机能转，编码器有读数
第 3 层 通信：上位机 serial_bridge 能收发，ros2 topic 有数据
第 4 层 传感器：雷达 /scan 正常，IMU /imu 正常
第 5 层 建图导航：SLAM 建图、Nav2 导航
```

#### 7.2 一键启动 launch

```python
# robot_bringup.launch.py：整机启动（串口桥 + 雷达 + 底盘状态）
from launch import LaunchDescription
from launch_ros.actions import Node

def generate_launch_description():
    return LaunchDescription([
        # 串口桥（上/下位机通信）
        Node(package='robot_bringup', executable='serial_bridge.py',
             output='screen'),
        # 激光雷达驱动
        Node(package='rplidar_ros', executable='rplidar_composition',
             parameters=[{'serial_port': '/dev/ttyUSB1',
                          'frame_id': 'laser',
                          'angle_compensate': True}],
             output='screen'),
        # 发布 TF（odom → base_link → laser）
        Node(package='tf2_ros', executable='static_transform_publisher',
             arguments=['0', '0', '0.1', '0', '0', '0',
                        'base_link', 'laser']),
        # 底盘状态发布（/odom 已在串口桥里）
    ])
```

启动后检查：

```bash
ros2 launch robot_bringup robot_bringup.launch.py
# 验证话题
ros2 topic list
# 应看到：/cmd_vel /odom /scan /tf ...
# 验证 TF 树
ros2 run tf2_tools view_frames  # 生成 frames.pdf 检查坐标系
```

### 八、常见问题与排障

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 上位机反复重启 | 电源不足/电机干扰 | 电机与逻辑供电隔离，加大电容，单独供电 |
| 电机不动但代码正常 | STBY 没拉高/电源没接电机路 | 检查 TB6612 STBY 与 VM 电压 |
| 车轮方向相反 | 电机接线/编码器方向不一致 | 软件里反转 IN 引脚或统一方向 |
| 车跑偏（直行走弧线） | 左右轮速不等/机械不对称 | 用 PID 速度闭环，检查轮胎气压/磨损 |
| 串口乱码 | 波特率不一致/共地缺失 | 统一 115200，检查 GND 连接 |
| 雷达扫描有盲区 | 雷达安装位置遮挡 | 雷达装在最高点，避开云台/支架遮挡 |
| 上电瞬间 USB 掉设备 | 电流冲击 | 加缓启动（软启动模块），或先上逻辑电再上动力电 |
| WiFi 丢包 | 信号干扰/天线位置 | 天线垂直朝上，避开金属遮挡 |

### 九、小结与下一篇预告

**本篇核心**：

1.  实体机器人 = 车架 + 动力（电机/编码器/驱动）+ 下位机 + 上位机 + 电源 + 感知。
2.  选型三要素：电机（减速比/扭矩/编码器）、上位机（算力 vs 功耗）、电源（电流估算与隔离）。
3.  电气规范：共地、电源隔离、信号线分离、防反接——细节决定稳定性。
4.  调试方法论：分层验证（电源→下位机→通信→传感器→整机），用 launch 一键启动。

至此实体机器人的"骨架"搭好了。下一篇（第 32 篇）进入 **嵌入式控制与通信开发（原理+仿真）**：把第 31 篇的硬件框架落实成完整代码——下位机协议栈实现、里程计发布、传感器数据融合，并在仿真环境里验证上/下位机通信的可靠性。敬请期待。
