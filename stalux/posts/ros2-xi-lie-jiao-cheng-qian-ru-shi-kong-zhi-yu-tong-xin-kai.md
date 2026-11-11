---
title: "ROS2系列教程：嵌入式控制与通信开发（原理+仿真）"
abbrlink: ros2-xi-lie-jiao-cheng-qian-ru-shi-kong-zhi-yu-tong-xin-kai
date: "2026-10-18 22:53:18"
categories:
    - "ROS2"
tags: []
desc: "本文是 ROS2 系列教程的第 32 篇：嵌入式控制与通信开发（原理+仿真）。第 31 篇我们搭好了实体机器人的硬件骨架。但硬件只是\"尸体\"…"
---
## 本文是 ROS2 系列教程的第 32 篇

> 本文是 ROS2 系列教程的第 32 篇：嵌入式控制与通信开发（原理+仿真）。第 31 篇我们搭好了实体机器人的硬件骨架。但硬件只是"尸体"，让它"活过来"需要软件：下位机的控制与通信程序、上位机的桥接与状态发布。本篇把第 31 篇的框架落实成完整可运行的代码：下位机协议栈、里程计解算、上位机串口桥、传感器数据接入，并用仿真环境验证上/下位机通信的可靠性。这是实体机器人"软硬结合"的关键一篇。

### 一、上下位机通信协议设计（原理）

#### 1.1 协议设计原则

嵌入式串口通信最容易出问题，协议设计要遵循几条原则：

1.  **有帧头帧尾**：接收方靠帧头定位一帧的起点。
2.  **有长度字段**：明确一帧有多少字节，防止粘包/半包。
3.  **有校验**：防止干扰导致的错误数据被执行。
4.  **定长优先**：定长帧解析简单可靠，变长帧复杂易错。

#### 1.2 推荐帧格式

采用"帧头(2B) + 命令(1B) + 长度(1B) + 数据(NB) + 校验(1B)"的通用格式：

```text
┌──────┬──────┬──────┬──────┬──────────┬────────┐
│ 0xAA │ 0x55 │ CMD  │ LEN  │ DATA     │ CRC8   │
│ 帧头1│ 帧头2│ 命令 │ 长度 │ 数据区    │ 校验   │
└──────┴──────┴──────┴──────┴──────────┴────────┘
```

命令定义（举例）：

| CMD | 方向 | 数据 | 说明 |
| --- | --- | --- | --- |
| 0x01 | 上位机→下位机 | float×2 (v, ω) | 设置目标速度 |
| 0x02 | 下位机→上位机 | float×2 (v, ω) | 回传实测速度 |
| 0x03 | 上位机→下位机 | uint8 (1/0) | 复位 / 使能电机 |
| 0x04 | 下位机→上位机 | float×3 (ax, ay, az) | 回传 IMU 数据 |
| 0x05 | 上位机→下位机 | uint8 (LED) | 控制指示灯 |

#### 1.3 校验算法（CRC8）

用简单的 CRC8 或异或校验。异或最简单，CRC8 更可靠。CRC8 实现：

```c
// crc8.c：CRC-8 校验（多项式 0x07，初值 0x00）
uint8_t crc8(const uint8_t *data, uint16_t len) {
    uint8_t crc = 0x00;
    for (uint16_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (uint8_t j = 0; j < 8; j++) {
            if (crc & 0x80) {
                crc = (uint8_t)((crc << 1) ^ 0x07);
            } else {
                crc <<= 1;
            }
        }
    }
    return crc;
}
```

### 二、下位机通信实现（STM32）

#### 2.1 串口接收状态机

串口数据是"流"式的，一帧可能分多次到达，必须用**状态机**逐字节解析：

```c
// protocol.c：串口接收状态机（STM32）
#include "protocol.h"
#include "crc8.h"

typedef enum {
    ST_WAIT_HEAD1,   // 等待帧头1 0xAA
    ST_WAIT_HEAD2,   // 等待帧头2 0x55
    ST_WAIT_CMD,     // 等待命令字节
    ST_WAIT_LEN,     // 等待长度字节
    ST_DATA,         // 接收数据区
    ST_CRC           // 等待校验字节
} rx_state_t;

static rx_state_t state = ST_WAIT_HEAD1;
static protocol_frame_t frame;
static uint8_t data_idx = 0;

// 串口中断里逐字节喂给状态机
void protocol_rx_byte(uint8_t byte) {
    switch (state) {
        case ST_WAIT_HEAD1:
            if (byte == 0xAA) state = ST_WAIT_HEAD2;
            break;
        case ST_WAIT_HEAD2:
            state = (byte == 0x55) ? ST_WAIT_CMD : ST_WAIT_HEAD1;
            break;
        case ST_WAIT_CMD:
            frame.cmd = byte;
            state = ST_WAIT_LEN;
            break;
        case ST_WAIT_LEN:
            frame.len = byte;
            data_idx = 0;
            state = (byte > 0) ? ST_DATA : ST_CRC;
            break;
        case ST_DATA:
            frame.data[data_idx++] = byte;
            if (data_idx >= frame.len) state = ST_CRC;
            break;
        case ST_CRC:
            frame.crc = byte;
            // 校验：CRC = crc8(cmd, len, data)
            if (frame.crc == compute_frame_crc(&frame)) {
                protocol_on_frame(&frame);   // 帧有效，回调处理
            }
            state = ST_WAIT_HEAD1;
            break;
    }
}
```

#### 2.2 串口中断接收（HAL）

```c
// 串口接收中断回调（HAL 库，接收一个字节触发）
void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart) {
    if (huart->Instance == USART1) {
        protocol_rx_byte(rx_buffer);        // 喂给状态机
        HAL_UART_Receive_IT(&huart1, &rx_buffer, 1);  // 重新开启接收
    }
}
```

要点：每次接收完必须重新调用 `HAL_UART_Receive_IT` 开启下一次接收（否则只收一字节）。

#### 2.3 帧处理回调

```c
// 收到有效帧后的处理
void protocol_on_frame(protocol_frame_t *f) {
    switch (f->cmd) {
        case CMD_SET_VEL: {   // 设置速度：float×2
            float v, w;
            memcpy(&v, &f->data[0], 4);
            memcpy(&w, &f->data[4], 4);
            target_v = v;
            target_w = w;
            break;
        }
        case CMD_ENABLE: {    // 使能电机
            motor_enable(f->data[0] != 0);
            break;
        }
        default:
            break;
    }
}
```

### 三、里程计解算（原理+实现）

#### 3.1 里程计原理

里程计（Odometry）根据轮子转过的角度估算机器人位姿（x, y, yaw）。对两轮差速：

```text
左右轮速度：v_l, v_r（由编码器测得）
机器人线速度：v = (v_l + v_r) / 2
机器人角速度：ω = (v_r - v_l) / L   （L=轮距）

位姿积分（每 dt 更新一次）：
x     += v × cos(yaw) × dt
y     += v × sin(yaw) × dt
yaw   += ω × dt
```

#### 3.2 下位机里程计实现

```c
// odometry.c：两轮差速里程计解算（下位机）
#include "odometry.h"
#include <math.h>

// 机器人参数（与 URDF 一致！）
#define WHEEL_RADIUS  0.0325f   // 轮半径 m
#define WHEEL_BASE    0.200f    // 轮距 m

static float pos_x = 0, pos_y = 0, yaw = 0;

// 每 10ms 调用一次，输入左右轮角速度（rad/s）
void odometry_update(float omega_left, float omega_right) {
    const float dt = 0.01f;

    // 左右轮线速度
    float v_l = omega_left * WHEEL_RADIUS;
    float v_r = omega_right * WHEEL_RADIUS;

    // 机器人线速度与角速度
    float v = (v_l + v_r) / 2.0f;
    float w = (v_r - v_l) / WHEEL_BASE;

    // 位姿积分
    yaw += w * dt;
    // yaw 归一化到 [-π, π]
    if (yaw > M_PI) yaw -= 2 * M_PI;
    if (yaw < -M_PI) yaw += 2 * M_PI;

    pos_x += v * cosf(yaw) * dt;
    pos_y += v * sinf(yaw) * dt;
}

// 供上位机查询
void odometry_get(float *x, float *y, float *yaw_out) {
    *x = pos_x;
    *y = pos_y;
    *yaw_out = yaw;
}
```

**关键点**：里程计参数（轮半径、轮距）必须与 URDF/控制器配置一致，否则建图和导航会"漂"。这就是为什么第 28 篇 diff_drive_controller 里要配 `wheel_radius` 和 `wheel_separation`——下位机用它算里程计，上位机用它算控制，两边必须统一。

#### 3.3 上位机里程计发布（完整版）

第 31 篇的串口桥只发了速度，这里补全为完整位姿：

```python
# odom_bridge.py：完整里程计发布（位姿 + 协方差）
import rclpy
import serial
import struct
from rclpy.node import Node
from nav_msgs.msg import Odometry
from geometry_msgs.msg import Quaternion
from std_msgs.msg import Header
import math

class OdomBridge(Node):
    def __init__(self):
        super().__init__('odom_bridge')
        self.ser = serial.Serial('/dev/ttyUSB0', 115200, timeout=0.02)
        self.pub = self.create_publisher(Odometry, '/odom', 10)
        self.timer = self.create_timer(0.02, self.tick)  # 50Hz

    def quat_from_yaw(self, yaw):
        # yaw → 四元数（ROS2 消息需要四元数）
        return Quaternion(
            x=0.0, y=0.0,
            z=math.sin(yaw / 2.0),
            w=math.cos(yaw / 2.0))

    def tick(self):
        # 读下位机里程计帧（CMD=0x02：x, y, yaw 三个 float）
        buf = self.ser.read(18)
        if len(buf) != 18:
            return
        head, cmd = struct.unpack('>HB', buf[:3])
        if head != 0xAA55 or cmd != 0x02:
            return
        x, y, yaw = struct.unpack('>3f', buf[3:15])
        crc_ok = (buf[15] == (struct.calcsize('>HB3f') and 0))  # 简化为示例

        odom = Odometry()
        odom.header = Header(stamp=self.get_clock().now().to_msg(),
                             frame_id='odom')
        odom.child_frame_id = 'base_link'
        odom.pose.pose.position.x = x
        odom.pose.pose.position.y = y
        odom.pose.pose.orientation = self.quat_from_yaw(yaw)
        # 简化协方差（实际应按编码器噪声标定）
        odom.pose.covariance[0] = 0.001
        odom.pose.covariance[7] = 0.001
        odom.pose.covariance[35] = 0.01
        self.pub.publish(odom)

def main(args=None):
    rclpy.init(args=args)
    node = OdomBridge()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

### 四、示例 1：仿真验证通信可靠性（gazebo + 真机协议）

在真机调试之前，先用仿真验证协议正确性。思路：在 Gazebo 仿真底盘上运行与真机**完全相同的协议逻辑**，验证协议解析无 bug。

```python
# fake_mcu.py：仿真下位机（模拟 STM32 的协议行为）
# 在 Gazebo 仿真的 /odom 基础上，按协议格式通过虚拟串口回传
import rclpy
import struct
import math
from rclpy.node import Node
from nav_msgs.msg import Odometry

class FakeMcu(Node):
    """仿真下位机：订阅仿真 /odom，按协议组帧（不接真实串口，仅演示协议正确性）"""

    def __init__(self):
        super().__init__('fake_mcu')
        self.odom_sub = self.create_subscription(
            Odometry, '/odom', self.on_odom, 10)

    def on_odom(self, msg):
        # 与真实下位机相同的组帧逻辑
        yaw = 2 * math.atan2(msg.pose.pose.orientation.z,
                             msg.pose.pose.orientation.w)
        data = struct.pack('>3f', msg.pose.pose.position.x,
                           msg.pose.pose.position.y, yaw)
        frame = struct.pack('>HBB', 0xAA55, 0x02, len(data)) + data
        # 校验（与下位机 crc8 一致，此处用异或简化演示）
        crc = 0
        for b in data:
            crc ^= b
        frame += bytes([crc])
        # 真实工程：写入串口 self.ser.write(frame)
        self.get_logger().debug(f'frame: {frame.hex()}')

    def spin_check(self):
        pass

def main(args=None):
    rclpy.init(args=args)
    node = FakeMcu()
    rclpy.spin(node)
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**验证方法**：在 Gazebo 里让车走一段已知路径，对比 `fake_mcu` 组帧数据与真机下位机输出格式是否一致。一致 → 协议可靠，可放心接真机。

### 五、示例 2：IMU 数据接入与融合

#### 5.1 下位机回传 IMU

```c
// 下位机：定时（50Hz）把 IMU 数据组帧回传
void send_imu_frame(void) {
    int16_t accel[3], gyro[3];
    mpu6050_read(accel, gyro);

    uint8_t data[12];
    // 转成 float 并打包
    float ax = accel[0] / 16384.0f * 9.81f;
    float ay = accel[1] / 16384.0f * 9.81f;
    float az = accel[2] / 16384.0f * 9.81f;
    memcpy(&data[0], &ax, 4);
    memcpy(&data[4], &ay, 4);
    memcpy(&data[8], &az, 4);

    protocol_send(CMD_IMU, data, 12);   // 组帧 + 串口发送
}
```

#### 5.2 上位机发布 IMU 并融合到里程计

EKF（扩展卡尔曼滤波）融合轮式里程计 + IMU 是标准做法。ROS2 用 `robot_localization` 包：

```yaml
# ekf.yaml：robot_localization 配置（融合 odom + imu）
ekf_filter_node:
  ros__parameters:
    frequency: 50.0
    two_d_mode: true          # 2D 机器人
    publish_tf: true
    odom0: /odom              # 轮式里程计（输入）
    odom0_config: [true, true, false,    # x, y, z
                   false, false, false,  # roll, pitch, yaw
                   false, false, false,  # vx, vy, vz
                   false, false, false,  # wx, wy, wz
                   false, false, false]
    imu0: /imu/data_raw       # IMU（输入）
    imu0_config: [false, false, false,
                  true, true, true,      # roll, pitch, yaw 用 IMU
                  false, false, false,
                  false, false, false,
                  false, false, false]
    imu0_remove_gravitational_acceleration: true
    odom0_differential: false
```

```bash
# 启动 EKF 融合
ros2 run robot_localization ekf_node --ros-args \
  -r __node:=ekf_filter_node \
  --params-file ekf.yaml

# 融合后的位姿话题
ros2 topic echo /odometry/filtered
```

融合效果：轮式里程计提供短期位置，IMU 提供姿态，长期位置不会因打滑而完全丢失。**注意**：IMU 提供 yaw 后，与轮式里程计的 yaw 要统一方向约定（都是逆时针为正）。

### 六、示例 3：传感器数据汇聚节点

把下位机回传的所有传感器数据汇聚成 ROS2 话题，供上层使用：

```python
# sensor_aggregator.py：传感器数据汇聚（超声波 + 电量 + 状态）
import rclpy
import serial
import struct
from rclpy.node import Node
from sensor_msgs.msg import Range
from std_msgs.msg import Float32, Bool

class SensorAggregator(Node):
    def __init__(self):
        super().__init__('sensor_aggregator')
        self.ser = serial.Serial('/dev/ttyUSB0', 115200, timeout=0.02)
        # 发布超声波距离（传感器消息标准格式）
        self.sonar_pub = self.create_publisher(Range, '/sonar_front', 10)
        # 发布电池电压
        self.volt_pub = self.create_publisher(Float32, '/battery_voltage', 10)
        self.timer = self.create_timer(0.1, self.tick)  # 10Hz

    def tick(self):
        # 读下位机传感器帧（简化：CMD=0x06，超声 float + 电压 float）
        buf = self.ser.read(14)
        if len(buf) != 14:
            return
        head, cmd = struct.unpack('>HB', buf[:3])
        if head != 0xAA55 or cmd != 0x06:
            return
        dist, voltage = struct.unpack('>2f', buf[3:11])

        # 发布超声波（Range 消息：传感器锥形探测范围）
        r = Range()
        r.header.stamp = self.get_clock().now().to_msg()
        r.header.frame_id = 'sonar_link'
        r.radiation_type = Range.ULTRASOUND
        r.field_of_view = 0.52          # 30° 锥角（弧度）
        r.min_range = 0.02
        r.max_range = 4.0
        r.range = dist
        self.sonar_pub.publish(r)

        # 发布电压
        v = Float32()
        v.data = voltage
        self.volt_pub.publish(v)

def main(args=None):
    rclpy.init(args=args)
    node = SensorAggregator()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

**低电量保护**：上位机订阅 `/battery_voltage`，低于阈值时发布 `robot_status/emergency_stop`，或者直接关断动力——这是实体机器人的安全底线。

### 七、通信可靠性工程实践

#### 7.1 丢帧与重试

-   上位机发指令默认**不需要应答**（速度指令是"最新值覆盖"语义），但关键指令（复位、使能）需要确认帧。
-   下位机 50Hz 回传状态，上位机若 1 秒没收到任何帧 → 判断下位机掉线 → 停止电机（安全）。

```python
# 掉线保护（在串口桥里加超时判断）
class SerialBridge:
    def __init__(self):
        ...
        self.last_frame_time = 0.0
        self.watchdog = self.create_timer(0.5, self.watchdog_check)

    def watchdog_check(self):
        now = self.get_clock().now().nanoseconds / 1e9
        if now - self.last_frame_time > 1.0:
            self.get_logger().error('MCU offline! stopping motors')
            # 发布零速度（安全停车）
            twist = Twist()
            self.on_cmd_vel(twist)
```

#### 7.2 波特率与缓冲区

-   115200 波特率：约 11500 字节/秒，50Hz × 18 字节 × 2（收发）≈ 1800 字节/秒，余量充足。
-   上位机串口读缓冲区建议 256 字节以上；下位机环形缓冲区 128 字节。

#### 7.3 电磁干扰防护

-   电机线用双绞线，远离串口线。
-   串口加磁环（或换 USB-TTL 隔离模块）。
-   地线星形连接（各模块独立回地，避免地环路）。

### 八、常见问题与排障

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 收不到完整帧 | 状态机 bug / 串口配置错误 | 串口调试助手先验证帧格式，再查状态机 |
| 偶发校验失败 | 电磁干扰 / 波特率漂移 | 双绞线、磁环、降低波特率试 |
| 里程计漂移 | 轮距/轮径参数不准 | 实测轮径（转 N 圈测距离），标定参数 |
| 里程计方向反 | 编码器方向约定不一致 | 统一"左轮正转=前进"约定，软件反转 |
| IMU yaw 跳变 | 角度归一化错误 | yaw 归一到 [-π, π] |
| 电机命令滞后 | 通信频率太低 | 上位机发送频率提到 20-50Hz |
| 上位机一启动电机猛转 | 默认命令未初始化 | 启动时先发一次零速度，再进主循环 |

### 九、小结与下一篇预告

**本篇核心**：

1.  通信协议三要素：帧头 + 长度 + 校验（CRC8），用状态机解析字节流。
2.  下位机三件套：串口状态机 + 里程计解算 + IMU 回传，10ms 控制环内完成。
3.  上位机两桥：串口桥（/cmd_vel ↔ 协议帧）+ 传感器汇聚（Range/电压）。
4.  可靠性工程：掉线看门狗、低电量保护、电磁防护、参数标定。

至此实体机器人"软硬结合"完成：能接收指令、能上报状态、能算里程计。下一篇（第 33 篇）进入 **上位机建图与导航（原理综合）**：把第 21-25 篇的 SLAM 和 Nav2 能力部署到实体机器人上——真机建图流程、坐标系校准、Nav2 参数整定、首次自主导航，完成"从仿真到真机"的跨越。敬请期待。
