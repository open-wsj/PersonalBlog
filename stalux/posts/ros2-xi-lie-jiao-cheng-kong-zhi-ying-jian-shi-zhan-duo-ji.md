---
title: "ROS2系列教程：控制硬件实战（舵机与传感器，原理）"
abbrlink: ros2-xi-lie-jiao-cheng-kong-zhi-ying-jian-shi-zhan-duo-ji
date: "2026-10-18 22:52:31"
categories:
    - "ROS2"
tags: []
desc: "本阶段（第 26-30 篇）我们打通了机器人硬件全链路篇主题核心收获26嵌入式点灯GPIO 本质，嵌入式开发流程27MicroROSMCU 直接成为 ROS2…"
---
## 本文是 ROS2 系列教程的第 30 篇

> 本文是 ROS2 系列教程的第 30 篇：控制硬件实战（舵机与传感器，原理）。第 29 篇我们打通了电机驱动全链路（H 桥、PWM、编码器、PID、ros2_control 硬件接口）。但机器人除了电机还需要"关节"（舵机）和"感知"（传感器）。本篇讲透舵机的控制原理（PWM 与角度映射、总线舵机）和常用传感器的接入原理（IMU、超声波、红外、激光雷达、摄像头），给出代码示例，并完成**硬件控制阶段（26-30）的收官**。

### 一、舵机控制原理

#### 1.1 舵机是什么

舵机（Servo）是能精确控制角度的执行器，广泛用于机械臂关节、云台、转向机构。它内部集成了：直流电机 + 减速齿轮组 + 电位器（角度反馈）+ 控制电路。给一个 PWM 信号，它就转到指定角度并保持。

```text
PWM 信号 → 控制电路 → 比较角度误差 → 驱动电机 → 减速齿轮 → 输出轴
                    ↑_________________电位器反馈_______________|
```

舵机内部是一个天然的闭环系统：你给目标角度，它自己闭环跟踪。这就是为什么舵机只需要一根信号线，而电机需要编码器+PID。

#### 1.2 角度与 PWM 的映射

普通模拟舵机（如 SG90）用 20ms 周期（50Hz）的 PWM 控制，占空比决定角度：

```text
0.5ms   →  0°（最小角度）
1.0ms   →  45°
1.5ms   →  90°（中位）
2.0ms   →  135°
2.5ms   →  180°（最大角度）
```

关键点：

-   频率固定 **50Hz（周期 20ms）**，变化的是**高电平脉宽**（0.5-2.5ms）。
-   不同舵机脉宽范围不同，需按型号校准。
-   **舵机不能长时间堵转**（到极限位置还持续给信号会烧毁）。

#### 1.3 STM32 定时器 PWM 控制舵机

用 STM32 定时器产生 50Hz PWM，通过调节 CCR 值改变脉宽：

```c
// servo.c：STM32 HAL 库控制舵机（TIM1 CH1，PE9）
#include "main.h"

// 初始化：定时器频率 1MHz（计数周期），ARR=19999 → 20ms 周期（50Hz）
void servo_init(void) {
    HAL_TIM_PWM_Start(&htim1, TIM_CHANNEL_1);
    servo_set_angle(90);   // 先回中位
}

// 设置舵机角度：0~180 度 → 脉宽 0.5~2.5ms
void servo_set_angle(uint8_t angle) {
    if (angle > 180) angle = 180;
    // 脉宽(us) = 500 + angle * (2500-500)/180 = 500 + angle * 11.11
    // CCR 值 = 脉宽(us)（因为定时器是 1MHz，1 计数 = 1us）
    uint32_t pulse_us = 500 + (uint32_t)(angle * 11.11f);
    __HAL_TIM_SET_COMPARE(&htim1, TIM_CHANNEL_1, pulse_us);
}
```

#### 1.4 ESP32 Arduino 控制舵机

ESP32 用 Servo 库或 LEDC 实现，代码更简洁：

```cpp
// ESP32 Arduino：控制舵机（使用内置 Servo 库）
#include <ESP32Servo.h>

Servo myservo;

void setup() {
    myservo.attach(13, 500, 2500);  // GPIO13，脉宽 0.5~2.5ms
    myservo.write(90);              // 回中位
    delay(1000);
}

void loop() {
    // 0° → 180° → 0° 来回摆动
    for (int angle = 0; angle <= 180; angle += 2) {
        myservo.write(angle);
        delay(15);
    }
    delay(500);
    for (int angle = 180; angle >= 0; angle -= 2) {
        myservo.write(angle);
        delay(15);
    }
    delay(500);
}
```

#### 1.5 总线舵机（进阶）

传统舵机每路一个 PWM 引脚，舵机多了引脚不够。**总线舵机**（如串行总线舵机 LX-16A、SCS15）通过串口/半双工总线级联，用 ID 寻址，一根线控制多个舵机：

```text
总线舵机特点：
- 串口通信（UART），可级联 253 个
- 反馈角度、温度、电压（还能"感知"自己）
- 可设置速度、模式
```

这是机械臂（第 35-40 篇 MoveIt2 实战）常用的舵机方案，ROS2 侧通过 `dynamixel_sdk` 类库封装控制。

### 二、IMU 传感器接入（原理）

#### 2.1 IMU 是什么

IMU（惯性测量单元）集成了加速度计 + 陀螺仪（+ 磁力计），测量：

| 传感器 | 测量 | 用途 |
| --- | --- | --- |
| 加速度计 | 三轴加速度 | 计算倾角、检测运动 |
| 陀螺仪 | 三轴角速度 | 计算姿态变化率 |
| 磁力计（可选） | 三轴磁场 | 航向角（指南针） |

常见芯片：MPU6050（入门）、ICM-20948（高性能）、BMI088（机器人主流）。通信接口：I2C 或 SPI。

#### 2.2 姿态解算原理

陀螺仪积分得角度，但会**漂移**（误差累积）；加速度计能直接得倾角但不适合动态（振动干扰大）。所以要用**数据融合**：互补滤波或卡尔曼滤波。

互补滤波（简单有效）：

```text
角度 = 0.98 × (上一角度 + 陀螺仪角速度 × dt) + 0.02 × 加速度计角度
```

陀螺仪负责"短期准确"，加速度计负责"长期纠偏"。

#### 2.3 MPU6050 读取示例（STM32 I2C）

```c
// mpu6050.c：读取加速度和陀螺仪原始数据（I2C）
#include "main.h"

#define MPU6050_ADDR  0xD0   // I2C 地址（AD0=0 时）
#define PWR_MGMT_1    0x6B
#define ACCEL_XOUT_H  0x3B
#define GYRO_XOUT_H   0x43

// 初始化：退出休眠模式
void mpu6050_init(void) {
    uint8_t data = 0x00;
    HAL_I2C_Mem_Write(&hi2c1, MPU6050_ADDR, PWR_MGMT_1, 1, &data, 1, 100);
}

// 读三轴加速度 + 三轴陀螺仪
void mpu6050_read(int16_t *accel, int16_t *gyro) {
    uint8_t buf[14];
    HAL_I2C_Mem_Read(&hi2c1, MPU6050_ADDR, ACCEL_XOUT_H, 1, buf, 14, 100);
    for (int i = 0; i < 6; i++) {
        int16_t v = (int16_t)((buf[i*2] << 8) | buf[i*2+1]);
        if (i < 3) accel[i] = v; else gyro[i-3] = v;
    }
}
```

#### 2.4 ROS2 侧：IMU 数据发布（Python）

下位机通过串口把 IMU 原始数据发给上位机，上位机用 `imu_filter_madgwick` 或直接发布 sensor_msgs/Imu：

```python
# imu_publisher.py：把串口 IMU 数据发布为 ROS2 Imu 消息
import rclpy
import serial
import struct
from rclpy.node import Node
from sensor_msgs.msg import Imu
from std_msgs.msg import Header

class ImuPublisher(Node):
    def __init__(self):
        super().__init__('imu_publisher')
        self.pub = self.create_publisher(Imu, '/imu/data_raw', 10)
        self.ser = serial.Serial('/dev/ttyUSB1', 115200, timeout=0.1)
        self.timer = self.create_timer(0.02, self.tick)  # 50Hz

    def tick(self):
        # 读串口帧（简化：固定格式 6 个 int16）
        line = self.ser.readline()
        if len(line) < 12:
            return
        ax, ay, az, gx, gy, gz = struct.unpack('<6h', line[:12])

        msg = Imu()
        msg.header = Header()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = 'base_link'
        # 加速度单位换算：原始值 / 16384 (±2g 量程)
        msg.linear_acceleration.x = ax / 16384.0 * 9.81
        msg.linear_acceleration.y = ay / 16384.0 * 9.81
        msg.linear_acceleration.z = az / 16384.0 * 9.81
        # 角速度：原始值 / 131 (±250°/s 量程)，转 rad/s
        msg.angular_velocity.x = gx / 131.0 * 3.14159 / 180.0
        msg.angular_velocity.y = gy / 131.0 * 3.14159 / 180.0
        msg.angular_velocity.z = gz / 131.0 * 3.14159 / 180.0
        self.pub.publish(msg)

def main(args=None):
    rclpy.init(args=args)
    node = ImuPublisher()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

IMU 数据在机器人中的作用：里程计融合（轮式里程计 + IMU 姿态）、机器人直立平衡、AMCL 初始姿态。

### 三、距离传感器接入（原理）

#### 3.1 超声波传感器（HC-SR04）

原理：发射超声波，测回波时间，距离 = 声速 × 时间 / 2。

```text
触发引脚（TRIG）：给 10us 高电平
回波引脚（ECHO）：输出高电平，宽度 = 往返时间
距离(cm) = 回波时间(us) / 58
```

```c
// hc_sr04.c：STM32 读取距离（溢出捕获测回波脉宽）
#include "main.h"

float hc_sr04_read_distance_cm(void) {
    // 1. TRIG 给 10us 高电平触发
    HAL_GPIO_WritePin(TRIG_GPIO_Port, TRIG_Pin, GPIO_PIN_SET);
    delay_us(10);
    HAL_GPIO_WritePin(TRIG_GPIO_Port, TRIG_Pin, GPIO_PIN_RESET);

    // 2. 测量 ECHO 高电平时间（用定时器输入捕获）
    // 伪代码：启动捕获，等待上升沿开始计数，下降沿停止
    uint32_t pulse_us = measure_echo_pulse_us();  // 输入捕获实现

    // 3. 换算距离：1us ≈ 0.017cm（声速 340m/s）
    return pulse_us / 58.0f;
}
```

局限：测量范围 2-400cm，精度受温度影响，对斜面/软表面不稳定。

#### 3.2 红外传感器（避障）

红外避障传感器（如 TCRT5000、红外光电开关）原理：发射红外光，障碍物反射后接收管检测。输出是**数字开关量**（有/无障碍），适合简单的沿墙避障，不提供距离数值。

```c
// 读取红外避障传感器：返回 1=有障碍，0=无障碍
uint8_t ir_obstacle_detect(void) {
    // 传感器输出接 GPIO（开漏，需要上拉）
    return HAL_GPIO_ReadPin(IR_GPIO_Port, IR_Pin) == GPIO_PIN_RESET ? 1 : 0;
}
```

#### 3.3 激光雷达（LiDAR）

激光雷达（如 RPLIDAR A1、YDLIDAR X4）通过旋转激光束扫描周围环境，输出极坐标距离点集。它比超声波/红外精确得多，是 SLAM（第 21 篇）和导航（第 24 篇）的核心传感器。

接入方式：USB 串口 + 官方驱动（rplidar_ros），发布 `sensor_msgs/LaserScan`：

```bash
# 启动 RPLIDAR 驱动（发布 /scan）
ros2 launch rplidar_ros view_rplidar_a1_launch.py

# 查看激光数据
ros2 topic echo /scan --once
# 输出 angle_min/angle_max/ranges 数组

# RViz 可视化
rviz2 -d rplidar_ros/rviz/view_rplidar_a1.rviz
```

LaserScan 消息核心字段：

```text
header.frame_id: laser（坐标系）
angle_min / angle_max / angle_increment：角度范围与步进
range_min / range_max：有效距离范围
ranges[]：每个角度的距离值（米）
```

### 四、摄像头接入（原理）

#### 4.1 摄像头在 ROS2 中的角色

摄像头是机器人最重要的感知传感器：目标检测、视觉导航、人机交互。在 ROS2 中通过 `usb_cam`（USB 摄像头）或 `v4l2_camera`（Linux 原生）驱动，发布 `sensor_msgs/Image` 和 `sensor_msgs/CameraInfo`。

```bash
# 启动 USB 摄像头驱动
ros2 run usb_cam usb_cam_node_exe --ros-args \
  -p video_device:=/dev/video0 \
  -p image_width:=640 -p image_height:=480 \
  -p framerate:=30

# 查看图像话题
ros2 topic list | grep camera
# /image_raw /camera_info ...

# RViz 查看实时画面
rviz2  # 添加 Image 显示，选择 /image_raw
```

#### 4.2 图像话题与 YOLO 视觉示例

订阅图像做目标检测是经典应用：

```python
# detect.py：订阅摄像头图像做简单颜色检测（OpenCV）
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image
from cv_bridge import CvBridge
import cv2
import numpy as np

class ColorDetect(Node):
    def __init__(self):
        super().__init__('color_detect')
        self.bridge = CvBridge()
        self.sub = self.create_subscription(
            Image, '/image_raw', self.on_image, 10)

    def on_image(self, msg):
        cv_img = self.bridge.imgmsg_to_cv2(msg, 'bgr8')
        hsv = cv2.cvtColor(cv_img, cv2.COLOR_BGR2HSV)
        # 红色范围检测
        mask = cv2.inRange(hsv, (0, 100, 100), (10, 255, 255))
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            largest = max(contours, key=cv2.contourArea)
            x, y, w, h = cv2.boundingRect(largest)
            self.get_logger().info(f'red target at ({x},{y}) size {w}x{h}')

def main(args=None):
    rclpy.init(args=args)
    node = ColorDetect()
    rclpy.spin(node)
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

视觉在实体机器人（第 31-34 篇）和机械臂（第 35-40 篇）中会大量使用。

### 五、传感器数据汇总与滤波（原理）

#### 5.1 传感器融合思想

单传感器都有缺陷：轮式里程计会打滑漂移、IMU 会积分漂移、激光雷达有噪点。机器人用**传感器融合**取长补短：

```text
轮式里程计（短期准）+ IMU（姿态稳）+ 激光雷达（定位准）
    ↓ 融合算法（EKF / 粒子滤波）
机器人位姿估计（x, y, yaw）
```

第 23 篇的 AMCL 就是基于粒子滤波的融合定位，第 31-34 篇实体机器人会实战组合这些传感器。

#### 5.2 简单滤波：滑动平均

对传感器原始数据做滑动平均，抑制噪声：

```c
// moving_average.c：滑动平均滤波（窗口 10）
#define WINDOW 10

float buf[WINDOW];
int idx = 0;
float sum = 0;
int filled = 0;

float moving_average(float sample) {
    if (filled == WINDOW) sum -= buf[idx];
    buf[idx] = sample;
    sum += sample;
    idx = (idx + 1) % WINDOW;
    filled = (filled < WINDOW) ? filled + 1 : WINDOW;
    return sum / filled;
}
```

滤波后的数据再进 ROS2，能显著提升后续算法稳定性。

### 六、常见问题与排障

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 舵机抖动/乱转 | 频率不对 / 供电不足 | 确认 50Hz，舵机独立供电（不能和 MCU 共电源） |
| 舵机转不到 180° | 脉宽范围不准 | 按型号调 0.5-2.5ms 范围（用 `attach(pin, 500, 2500)`） |
| IMU 数据乱跳 | 量程/换算不对 / 未滤波 | 检查量程配置，加互补滤波 |
| IMU 角度缓慢漂移 | 陀螺仪零偏 | 静止校准零偏，定期重置 |
| 超声波读数为 0 | 回波测量超时 | 增加超时判断（>38ms 视为无效） |
| 摄像头画面卡顿 | USB 带宽 / 分辨率太高 | 降低分辨率或帧率（640×480@30） |
| /scan 数据为空 | 雷达被遮挡 / 串口权限 | 检查遮挡、`sudo chmod 666 /dev/ttyUSB*` |

### 七、硬件控制阶段总结（26-30 收官）

**本阶段（第 26-30 篇）我们打通了机器人硬件全链路**：

| 篇 | 主题 | 核心收获 |
| --- | --- | --- |
| 26 | 嵌入式点灯 | GPIO 本质，嵌入式开发流程 |
| 27 | MicroROS | MCU 直接成为 ROS2 节点 |
| 28 | ROS2-Control | 关节控制的标准框架 |
| 29 | 电机驱动 | H桥/PWM/编码器/PID/硬件接口 |
| 30 | 舵机与传感器 | 舵机、IMU、测距、视觉接入 |

至此，从"电"的层面（GPIO、PWM、串口）到"信息"的层面（ROS2 话题、控制框架、传感器数据），机器人硬件部分全部打通。

### 八、小结与下一篇预告

**本篇核心**：

1.  舵机：PWM 脉宽映射角度（0.5-2.5ms → 0-180°），内部自带闭环，总线舵机可级联。
2.  IMU：加速度计+陀螺仪，互补滤波融合姿态，ROS2 里发布 sensor_msgs/Imu。
3.  测距三件套：超声波（时间测距）、红外（开关量）、激光雷达（极坐标点云，SLAM 核心）。
4.  摄像头：usb_cam 驱动 → /image_raw → OpenCV 视觉处理。

至此 **硬件控制阶段（26-30）全部收官**。下一篇开始进入 **实体机器人阶段（31-34）**：第 31 篇「实体机器人硬件搭建（原理）」——把前面所有的"零件"（底盘、电机、传感器、上位机、电池）组装成一台能跑的真机器人，讲解硬件选型、电气连接、电源管理、车架结构等实战知识。从"纸上谈兵"到"真机实战"，最激动人心的阶段即将开始！
