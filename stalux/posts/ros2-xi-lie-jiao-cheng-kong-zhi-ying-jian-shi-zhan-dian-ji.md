---
title: "ROS2系列教程：控制硬件实战（电机驱动，原理）"
abbrlink: ros2-xi-lie-jiao-cheng-kong-zhi-ying-jian-shi-zhan-dian-ji
date: "2026-10-14 00:50:45"
categories:
    - "ROS2"
tags: []
desc: "/ real_motor_hw.cpp：真实电机硬件接口（串口/MicroROS 连接下位机）public:// 声明关节及其接口// 基类解析 URDF 的 <ros2_control> 配置//…"
---
## 本文是 ROS2 系列教程的第 29 篇

> 本文是 ROS2 系列教程的第 29 篇：控制硬件实战（电机驱动，原理）。第 28 篇我们理解了 ros2_control 的架构，但"关节命令"到"电机转动"之间还有最后一步：硬件驱动。本篇深入电机驱动的原理：直流电机的 H 桥驱动与 PWM 调速、编码器测速原理、PID 闭环控制，并给出完整的代码实现，最后把它们接到 ros2_control 的硬件接口上，让机器人真正"动起来"。

### 一、直流电机驱动原理

#### 1.1 直流电机怎么转

直流电机（DC Motor）通电就会转，转速与电压成正比：电压越高转越快，反向电压反转。看似简单，但直接控制电机有三个问题：

1.  **电流方向**：改变方向需要换向（H 桥）。
2.  **调速精度**：电压不能随意连续变化，需要用 PWM。
3.  **电流保护**：电机启动电流很大（堵转电流可达额定电流数倍），直接接 GPIO 会烧毁单片机引脚。

所以电机不能直接接 MCU 引脚，必须经过**电机驱动模块**。

#### 1.2 H 桥原理

H 桥（H-Bridge）是控制电机方向的标准电路，名字来自它的形状像字母 H：4 个开关（三极管/MOSFET）控制电机的两个接线端。

```text
    VCC
   /    \
  S1     S2
   |      |
  M+----M-（电机）
   |      |
  S3     S4
   \    /
    GND
```

-   S1+S4 导通：电流从左到右，电机正转。
-   S2+S3 导通：电流从右到左，电机反转。
-   全部断开：电机自由停止（滑行）。
-   S1+S2 同时导通：刹车（短路电机两端）。

常用的 H 桥驱动芯片：L298N（经典，压降大）、TB6612FNG（效率高，机器人常用）、DRV8833（小型化）。TB6612 是目前两轮小车的主流选择。

#### 1.3 PWM 调速原理

PWM（脉冲宽度调制）通过改变方波的**占空比**控制平均电压，从而控制转速：

```text
占空比 100%：▉▉▉▉▉▉▉▉▉▉  →  全速
占空比  50%：▉▉▉▉▉▉▉▉░░░░  →  半速（平均电压一半）
占空比  20%：▉▉▉▉░░░░░░░░  →  低速
```

频率通常 10-20kHz（听不见的频段），STM32 的定时器 PWM 输出或 ESP32 的 LEDC 都支持。电机实际感受到的是平均电压：`V_avg = Vcc × 占空比`。

#### 1.4 完整控制组合

电机控制 = H 桥管方向（2 个引脚：IN1/IN2）+ PWM 管速度（1 个引脚：PWM）：

```text
MCU GPIO_IN1 ──┐
MCU GPIO_IN2 ──┼── TB6612 ── 电机
MCU PWM_PIN  ──┘
```

| IN1 | IN2 | PWM | 电机行为 |
| --- | --- | --- | --- |
| 0 | 0 | × | 停止（滑行） |
| 1 | 0 | 占空比 | 正转，速度=占空比 |
| 0 | 1 | 占空比 | 反转，速度=占空比 |
| 1 | 1 | × | 刹车 |

### 二、编码器测速原理

#### 2.1 为什么需要编码器

电机转多快、轮子转了几圈，单片机需要知道——否则就是"开环控制"：命令 50% 占空比，实际可能因负载、电池电压而偏快或偏慢。**编码器（Encoder）** 就是给电机装"眼睛"，测量真实转速，实现闭环控制。

#### 2.2 增量式编码器原理

机器人最常用的是**霍尔编码器**（增量式）：电机轴上带磁环（多个磁极），霍尔传感器检测磁场变化，每转过一个磁极输出一个脉冲。常见编码器：13PPR（每转 13 脉冲）、2 相输出（A/B 相）。

```text
磁环：N-S-N-S-N-S...（每转 13 对磁极）
A 相：▂▅▂▅▂▅▂▅▂▅▂▅▂▅   （方波，13 脉冲/转）
B 相：▅▂▅▂▅▂▅▂▅▂▅▂▅▂   （与 A 相差 90°）
```

A/B 两相的作用：

-   **计数**：统计 A 相脉冲数，乘以每转脉冲数即可得转角。
-   **辨向**：根据 A/B 相相位差判断正反转（A 领先 B 为正转，反之反转）。
-   **倍频**：4 倍频技术（检测 A/B 的上升沿和下降沿）把分辨率提高 4 倍。

#### 2.3 测速公式

```text
轮子角速度 ω = 脉冲计数 / (每转脉冲数 × 采样周期)

示例：每转 13 脉冲 × 4 倍频 = 52 计数/转
100ms 采样周期内计数 26：
ω = 26 / (52 × 0.1) = 5 转/秒 = 5 × 2π = 31.4 rad/s
```

若已知轮子半径 r，线速度 `v = ω × r`——这正是 diff_drive_controller 需要的 `wheel/velocity` 状态。

#### 2.4 外部中断计数（STM32 示例）

编码器脉冲用**外部中断**计数（不能用轮询，否则丢脉冲）：

```c
// 编码器计数（STM32 HAL 库，PA0/PA1 接 A/B 相）
volatile int32_t encoder_count = 0;

// 定时器/外部中断回调：A 相上升沿触发
void EXTI0_IRQHandler(void) {
    if (__HAL_GPIO_EXTI_GET_IT(GPIO_PIN_0)) {
        __HAL_GPIO_EXTI_CLEAR_IT(GPIO_PIN_0);
        // 根据 B 相电平判断方向
        if (HAL_GPIO_ReadPin(GPIOA, GPIO_PIN_1)) {
            encoder_count++;   // 正转
        } else {
            encoder_count--;   // 反转
        }
    }
}
```

更专业的做法是用 STM32 定时器的**编码器模式**（硬件自动计数，不占用 CPU），这里只展示原理。

### 三、示例 1：TB6612 电机驱动（STM32 HAL）

#### 3.1 硬件接线

以两轮差速小车为例，TB6612 驱动两路电机：

```text
STM32          TB6612          电机
PA6(PWM)   →  PWMA           → M1A ┐
PA7(PWM)   →  PWMB              M1B ┘ 左电机
PA4(IN1)   →  AIN1
PA5(IN2)   →  AIN2
PB0(IN3)   →  BIN1
PB1(IN4)   →  BIN2
PA8        →  STBY（必须拉高，否则芯片不工作）
```

#### 3.2 驱动代码

```c
// motor_driver.c：TB6612 电机驱动（STM32 HAL）
#include "main.h"

// 电机引脚宏定义（根据实际接线修改）
#define MOTOR_L_IN1  HAL_GPIO_WritePin(GPIOA, GPIO_PIN_4, ...)
#define MOTOR_L_IN2  HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, ...)
#define MOTOR_R_IN3  HAL_GPIO_WritePin(GPIOB, GPIO_PIN_0, ...)
#define MOTOR_R_IN4  HAL_GPIO_WritePin(GPIOB, GPIO_PIN_1, ...)

// 速度范围 -100 ~ +100（负值反转）
void motor_left_set_speed(int speed) {
    speed = (speed > 100) ? 100 : (speed < -100) ? -100 : speed;
    if (speed > 0) {
        MOTOR_L_IN1(1); MOTOR_L_IN2(0);      // 正转
        __HAL_TIM_SET_COMPARE(&htim2, TIM_CHANNEL_1, (uint32_t)(speed * 8.0));
    } else if (speed < 0) {
        MOTOR_L_IN1(0); MOTOR_L_IN2(1);      // 反转
        __HAL_TIM_SET_COMPARE(&htim2, TIM_CHANNEL_1, (uint32_t)((-speed) * 8.0));
    } else {
        MOTOR_L_IN1(0); MOTOR_L_IN2(0);      // 停止
        __HAL_TIM_SET_COMPARE(&htim2, TIM_CHANNEL_1, 0);
    }
}

void motor_right_set_speed(int speed) {
    speed = (speed > 100) ? 100 : (speed < -100) ? -100 : speed;
    if (speed > 0) {
        MOTOR_R_IN3(1); MOTOR_R_IN4(0);
        __HAL_TIM_SET_COMPARE(&htim3, TIM_CHANNEL_1, (uint32_t)(speed * 8.0));
    } else if (speed < 0) {
        MOTOR_R_IN3(0); MOTOR_R_IN4(1);
        __HAL_TIM_SET_COMPARE(&htim3, TIM_CHANNEL_1, (uint32_t)((-speed) * 8.0));
    } else {
        MOTOR_R_IN3(0); MOTOR_R_IN4(0);
        __HAL_TIM_SET_COMPARE(&htim3, TIM_CHANNEL_1, 0);
    }
}

// 初始化：PWM 定时器 + 方向引脚
void motor_init(void) {
    // 使能 STBY（TB6612 芯片使能）
    HAL_GPIO_WritePin(GPIOA, GPIO_PIN_8, GPIO_PIN_SET);
    // 启动 PWM 通道
    HAL_TIM_PWM_Start(&htim2, TIM_CHANNEL_1);
    HAL_TIM_PWM_Start(&htim3, TIM_CHANNEL_1);
    motor_left_set_speed(0);
    motor_right_set_speed(0);
}
```

注意：`speed * 8.0` 是把 -100~100 映射到定时器计数范围（8 位 PWM 是 0-255，100 × 2.55 ≈ 255，取 8 是近似）。实际工程应按 `TIM_Period` 精确映射。

#### 3.3 ESP32 Arduino 版本（对比）

```cpp
// ESP32 Arduino：TB6612 驱动（LEDC PWM 通道）
#define PWMA 25
#define AIN1 26
#define AIN2 27
#define STBY 14

void motorInit() {
    pinMode(PWMA, OUTPUT);
    pinMode(AIN1, OUTPUT);
    pinMode(AIN2, OUTPUT);
    pinMode(STBY, OUTPUT);
    digitalWrite(STBY, HIGH);
    ledcSetup(0, 20000, 8);   // 通道 0，20kHz，8 位分辨率
    ledcAttachPin(PWMA, 0);
}

void motorSetSpeed(int speed) {  // -100 ~ 100
    if (speed > 0) {
        digitalWrite(AIN1, HIGH);
        digitalWrite(AIN2, LOW);
    } else if (speed < 0) {
        digitalWrite(AIN1, LOW);
        digitalWrite(AIN2, HIGH);
    } else {
        digitalWrite(AIN1, LOW);
        digitalWrite(AIN2, LOW);
    }
    ledcWrite(0, abs(speed) * 255 / 100);
}

void setup() {
    motorInit();
}

void loop() {
    motorSetSpeed(50);   // 50% 速度正转
    delay(2000);
    motorSetSpeed(0);    // 停止
    delay(1000);
    motorSetSpeed(-50);  // 50% 速度反转
    delay(2000);
}
```

### 四、示例 2：PID 闭环控制（原理+代码）

#### 4.1 为什么需要 PID

开环给 50% 占空比，实际转速可能只有目标的一半（电池电压下降、负载增加）。**PID（比例-积分-微分）控制器**根据误差实时调整输出，让实际转速快速、准确地跟上目标：

```text
误差 e(t) = 目标转速 - 实际转速
输出 u(t) = Kp × e(t) + Ki × ∫e(t)dt + Kd × de(t)/dt
```

-   **P（比例）**：误差越大输出越大，快速逼近。但单独用 P 会有稳态误差（到达目标附近后输出不足以维持）。
-   **I（积分）**：累加历史误差，消除稳态误差。但过大容易超调振荡。
-   **D（微分）**：预测误差变化趋势，抑制超调。但会放大噪声。

#### 4.2 位置式 PID（C 语言实现）

```c
// pid.c：位置式 PID 控制器
typedef struct {
    float kp, ki, kd;
    float integral;
    float last_error;
    float out_min, out_max;   // 输出限幅
    float integral_limit;     // 积分限幅（防积分饱和）
} PID_t;

void pid_init(PID_t *pid, float kp, float ki, float kd) {
    pid->kp = kp; pid->ki = ki; pid->kd = kd;
    pid->integral = 0;
    pid->last_error = 0;
    pid->out_min = -100; pid->out_max = 100;
    pid->integral_limit = 50;
}

float pid_update(PID_t *pid, float target, float actual) {
    float error = target - actual;
    // 积分项（带限幅，防积分饱和）
    pid->integral += error;
    if (pid->integral > pid->integral_limit) pid->integral = pid->integral_limit;
    if (pid->integral < -pid->integral_limit) pid->integral = -pid->integral_limit;
    // 微分项
    float derivative = error - pid->last_error;
    pid->last_error = error;
    // 输出 = P + I + D
    float output = pid->kp * error + pid->ki * pid->integral + pid->kd * derivative;
    // 输出限幅
    if (output > pid->out_max) output = pid->out_max;
    if (output < pid->out_min) output = pid->out_min;
    return output;
}
```

#### 4.3 速度闭环主循环

把编码器测速和 PID 结合，形成一个 10ms 周期的速度闭环：

```c
// speed_control.c：电机速度闭环
#include "pid.h"
#include "encoder.h"
#include "motor_driver.h"

PID_t pid_left, pid_right;
volatile float target_speed = 0.0;   // 目标速度（rad/s），外部设置

// 定时器中断：每 10ms 执行一次速度闭环
void HAL_TIM_PeriodElapsedCallback(TIM_HandleTypeDef *htim) {
    if (htim->Instance == TIM6) {   // 10ms 定时器
        // 1. 读取编码器计算实际速度（每转脉冲数 × 4 倍频）
        float actual_left = encoder_get_speed_rads(ENC_LEFT);   // rad/s
        float actual_right = encoder_get_speed_rads(ENC_RIGHT);

        // 2. PID 计算 PWM 输出（-100 ~ 100）
        int out_left  = (int)pid_update(&pid_left, target_speed, actual_left);
        int out_right = (int)pid_update(&pid_right, target_speed, actual_right);

        // 3. 写入电机
        motor_left_set_speed(out_left);
        motor_right_set_speed(out_right);
    }
}
```

#### 4.4 调参经验（重要）

| 现象 | 处理 |
| --- | --- |
| 响应慢、误差大 | 增大 Kp |
| 震荡、电机嗡嗡响 | 减小 Kp，增大 Kd |
| 稳态误差（始终差一点） | 增大 Ki |
| 超调大、来回冲 | 减小 Ki，增大 Kd |
| 积分饱和（长时间回不来） | 加积分限幅（如上代码） |

常用起步参数：`Kp=1.0, Ki=0.1, Kd=0.0`，再按现象微调。真实工程多使用**增量式 PID**（输出增量而非绝对值）或速度环+电流环双环，原理相同。

### 五、示例 3：把电机接到 ros2_control 硬件接口

第 28 篇的仿真硬件（mock_components）换成真实电机，只需实现一个**自定义 Hardware Interface**。它继承 `hardware_interface::SystemInterface`，核心实现 `read()`（读编码器）和 `write()`（写 PWM）。

#### 5.1 自定义硬件接口（C++）

```cpp
// real_motor_hw.cpp：真实电机硬件接口（串口/MicroROS 连接下位机）
#include <hardware_interface/system_interface.hpp>
#include <hardware_interface/handle.hpp>
#include <rclcpp/rclcpp.hpp>

namespace my_robot_hw {

class RealMotorHW : public hardware_interface::SystemInterface {
public:
  // 声明关节及其接口
  hardware_interface::CallbackReturn on_init(
      const hardware_interface::HardwareInfo &info) override {
    // 基类解析 URDF 的 <ros2_control> 配置
    if (SystemInterface::on_init(info) != hardware_interface::CallbackReturn::SUCCESS) {
      return hardware_interface::CallbackReturn::ERROR;
    }
    // 打开串口（伪代码，实际用 serial 库）
    // serial_.open(info_.hardware_parameters["port"], 115200);
    RCLCPP_INFO(rclcpp::get_logger("RealMotorHW"), "hardware init ok");
    return hardware_interface::CallbackReturn::SUCCESS;
  }

  // 导出状态接口（编码器读数）
  std::vector<hardware_interface::StateInterface> export_state_interfaces() override {
    std::vector<hardware_interface::StateInterface> state_interfaces;
    for (const auto &joint : info_.joints) {
      state_interfaces.emplace_back(joint.name, "position", &position_[joint.name]);
      state_interfaces.emplace_back(joint.name, "velocity", &velocity_[joint.name]);
    }
    return state_interfaces;
  }

  // 导出命令接口（PWM/速度命令）
  std::vector<hardware_interface::CommandInterface> export_command_interfaces() override {
    std::vector<hardware_interface::CommandInterface> command_interfaces;
    for (const auto &joint : info_.joints) {
      command_interfaces.emplace_back(joint.name, "velocity", &velocity_cmd_[joint.name]);
    }
    return command_interfaces;
  }

  // 读状态：从串口获取编码器数据
  hardware_interface::return_type read(
      const rclcpp::Time &, const rclcpp::Duration &) override {
    // 伪代码：解析下位机回传的编码器帧
    // frame = serial_read_line();
    // position_[joint] = parse_position(frame);
    // velocity_[joint] = parse_velocity(frame);
    return hardware_interface::return_type::OK;
  }

  // 写命令：把速度命令发给下位机
  hardware_interface::return_type write(
      const rclcpp::Time &, const rclcpp::Duration &) override {
    // 伪代码：拼接命令帧发送
    // char buf[64];
    // snprintf(buf, 64, "CMD:VEL:%.3f", velocity_cmd_["wheel_left_joint"]);
    // serial_write(buf);
    return hardware_interface::return_type::OK;
  }

private:
  std::map<std::string, double> position_;
  std::map<std::string, double> velocity_;
  std::map<std::string, double> velocity_cmd_;
};

}  // namespace my_robot_hw

#include "pluginlib/class_list_macros.hpp"
PLUGINLIB_EXPORT_CLASS(my_robot_hw::RealMotorHW, hardware_interface::SystemInterface)
```

#### 5.2 插件声明与配置

```xml
<!-- real_motor_hw_plugin.xml -->
<library path="real_motor_hw">
  <class name="my_robot_hw/RealMotorHW"
         type="my_robot_hw::RealMotorHW"
         base_class_type="hardware_interface::SystemInterface"/>
</library>
```

URDF 中替换仿真插件：

```xml
<ros2_control name="RealMotor" type="system">
  <hardware>
    <plugin>my_robot_hw/RealMotorHW</plugin>
    <param name="port">/dev/ttyUSB0</param>
    <param name="baud">115200</param>
  </hardware>
  <joint name="wheel_left_joint">
    <command_interface name="velocity"/>
    <state_interface name="position"/>
    <state_interface name="velocity"/>
  </joint>
  <joint name="wheel_right_joint">
    <command_interface name="velocity"/>
    <state_interface name="position"/>
    <state_interface name="velocity"/>
  </joint>
</ros2_control>
```

**换硬件只改一处**：把 `<plugin>` 从 `mock_components/GenericSystem` 换成 `my_robot_hw/RealMotorHW`，控制器和上层导航代码一行都不用改。这就是第 28 篇说的"硬件抽象"的兑现。

### 六、下位机端串口协议实现（原理）

硬件接口通过串口与下位机通信，需要一个简单的帧协议。推荐"帧头 + 数据 + 校验"格式：

```text
帧格式：0xAA 0x55 | CMD(1B) | DATA_LEN(1B) | DATA(nB) | CHECKSUM(1B)

下位机接收（STM32 串口中断 + 状态机解析）：
0xAA 0x55 | 0x01(设速度) | 0x08 | 左轮速度(4B float) | 右轮速度(4B float) | 校验和
```

校验和 = 数据区所有字节异或，接收端重算比对，防止干扰帧误执行。这是"上位机大脑 + 下位机肌肉"的标准通信范式。

### 七、常见问题与排障

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 电机不转 | STBY 未拉高 / 电源不足 / PWM 未启动 | 检查 STBY、外接电源、HAL_TIM_PWM_Start |
| 电机只会一个方向转 | IN1/IN2 逻辑反 | 交换 IN1/IN2 接线或代码 |
| 电机嗡嗡响但不转 | 占空比太低 / 频率不合适 | 提高 PWM 频率到 10-20kHz，占空比加死区 |
| 编码器读数不动 | 编码器电源未接 / 引脚中断未配置 | 检查编码器 VCC、EXTI 配置 |
| PID 一直震荡 | Kp 过大 / Kd 过小 | 减小 Kp 增大 Kd，先 P 后 I 再 D 顺序调参 |
| 硬件接口 read 报错 | 串口未打开 / 波特率不匹配 | 检查串口权限 `sudo chmod 666 /dev/ttyUSB0` 与波特率 |

### 八、小结与下一篇预告

**本篇核心**：

1.  电机控制 = H 桥（方向）+ PWM（速度），TB6612 是主流驱动方案。
2.  编码器（A/B 相）是电机的"眼睛"：计数 + 辨向 + 4 倍频，实现速度反馈。
3.  PID 闭环把开环"盲控"变成"精准跟踪"，P 快速逼近、I 消除误差、D 抑制超调。
4.  ros2_control 硬件接口 = 读编码器（read）+ 写 PWM（write），换硬件只换 plugin。

至此电机驱动全链路打通。下一篇（第 30 篇）进入 **控制硬件实战（舵机与传感器，原理）**：讲舵机（PWM 控制、SG90/串行总线舵机）、常用传感器（IMU、超声波、红外、激光雷达）的 ROS2 接入原理，并完成硬件控制阶段（26-30）的收官。敬请期待。
