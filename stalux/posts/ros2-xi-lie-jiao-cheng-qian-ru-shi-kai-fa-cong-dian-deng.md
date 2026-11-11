---
title: "ROS2系列教程：嵌入式开发从点灯开始（原理）"
abbrlink: ros2-xi-lie-jiao-cheng-qian-ru-shi-kai-fa-cong-dian-deng
date: "2026-10-14 00:49:09"
categories:
    - "ROS2"
tags: []
desc: "本文是 ROS2 系列教程的第 26 篇：嵌入式开发从点灯开始（原理）。第 25 篇我们完成了 Nav2 导航阶段（21-25）的全部内容，前面的教程全都是在仿真环境里运行：Gazebo…"
---
## 本文是 ROS2 系列教程的第 26 篇

> 本文是 ROS2 系列教程的第 26 篇：嵌入式开发从点灯开始（原理）。第 25 篇我们完成了 Nav2 导航阶段（21-25）的全部内容，前面的教程全都是在仿真环境里运行：Gazebo 里的小车、RViz 里的模型，都是"虚拟的"。但真实的机器人要动起来，必须有硬件：单片机控制电机、传感器采集数据、串口与上位机通信。从本篇开始进入**硬件控制阶段**（第 26-30 篇），从嵌入式开发的最基础操作——“点灯”（GPIO 控制 LED）讲起，建立嵌入式开发的完整认知，为后续 MicroROS、ROS2-Control 打下基础。

### 一、为什么机器人需要嵌入式开发

#### 1.1 上位机与下位机的分工

一台完整的机器人，通常由两大部分组成：

-   **上位机**：性能更强的处理器，通常运行 Linux 和 ROS2，负责感知融合、路径规划、人机交互等"大脑级"工作。常见有树莓派、Jetson Nano、工控机、x86 迷你主机。
-   **下位机**：嵌入式微控制器（MCU），负责电机驱动、传感器采集、执行器等"肌肉级"工作。常见有 STM32、ESP32、Arduino。

为什么要分工？因为两者的强项完全不同：

| 对比项 | 上位机（Linux + ROS2） | 下位机（MCU） |
| --- | --- | --- |
| 计算能力 | 强，可跑复杂算法 | 弱，只适合简单逻辑 |
| 实时性 | 一般（非实时系统） | 强（可做硬实时控制） |
| 功耗 | 高 | 极低 |
| 启动时间 | 秒级 | 毫秒级 |
| 稳定性 | 依赖系统环境 | 极可靠，不易死机 |
| 成本 | 高 | 低 |

真实机器人常见的架构：上位机跑 ROS2，通过串口 / USB / CAN 与下位机通信，下位机直接控制电机和读取传感器。这种"大脑 + 肌肉"的分工，是机器人工程的主流做法。

#### 1.2 为什么从"点灯"开始

几乎所有嵌入式开发教程的第一个程序都是"点灯"（控制 LED 亮灭），原因很朴素：

1.  点灯用到了嵌入式开发最核心的资源：**GPIO（通用输入输出引脚）**。
2.  点灯的程序虽然简单，却覆盖了完整的开发流程：写代码 → 编译 → 下载（烧录）→ 运行 → 调试。
3.  任何复杂的机器人控制（电机 PWM、舵机、传感器读取），本质都是 GPIO 或基于 GPIO 扩展的外设操作。

可以说：**会点灯，就摸到了嵌入式的大门**。

### 二、认识单片机（MCU）

#### 2.1 单片机是什么

单片机（Microcontroller Unit，MCU）是把 CPU、内存、Flash 存储、各种外设（GPIO、定时器、串口、ADC 等）集成在一个芯片上的微型计算机。它不像电脑需要外接内存和硬盘，一个芯片就是一个完整的微型系统。

在 ROS2 机器人领域，最常见的有两类：

-   **STM32**：ARM Cortex-M 内核，性能和生态都非常优秀，是机器人底盘、机械臂控制器的主流选择。使用 C 语言 + HAL 库或 LL 库开发。
-   **ESP32**：集成了 Wi-Fi 和蓝牙，价格便宜，适合做无线通信节点（如遥控手柄、传感器节点）。支持 C/C++（ESP-IDF、Arduino）和 MicroPython。

还有一类特殊的存在：**Arduino**。Arduino 严格说是"单片机 + 开发板 + 简化框架"的完整生态，封装极简，初学者最容易上手，很多 ROS 机器人项目（如 TurtleBot 的电机板）也用 Arduino。

#### 2.2 开发板与芯片的关系

开发板（如 STM32F103C8T6 最小系统板、ESP32-DevKitC）是在芯片周围加上电源电路、晶振、USB 接口、调试接口等，方便我们直接使用。开发时我们面对的是"板子"，但编程时操作的是"芯片内部的寄存器与外设"。

一个典型的 STM32 最小系统板包含：

| 组成部分 | 作用 |
| --- | --- |
| STM32 芯片 | 核心处理单元 |
| 晶振 | 提供时钟基准 |
| USB 接口 | 供电 + 下载程序 + 虚拟串口 |
| 复位按键 | 复位程序 |
| BOOT 跳线 | 选择启动模式 |
| LED（通常 PC13 或 PA1） | 点灯实验的标准对象 |

#### 2.3 开发流程总览

不管用哪家芯片，嵌入式开发流程都一样：

```text
编写代码（C/C++/MicroPython）
    ↓
编译（把源码变成机器码）
    ↓
烧录（把机器码下载进芯片 Flash）
    ↓
运行（上电后从 Flash 执行程序）
    ↓
调试（串口打印、调试器断点）
```

对应到工具上：STM32 用 STM32CubeIDE 或 VS Code + arm-none-eabi-gcc，ESP32 用 ESP-IDF 或 Arduino IDE，MicroPython 用 Thonny。

### 三、GPIO 与点灯原理

#### 3.1 GPIO 是什么

GPIO（General Purpose Input/Output，通用输入输出）是单片机上最基础也最重要的引脚资源。每个 GPIO 引脚都可以配置为：

-   **输出模式**：引脚输出高电平（如 3.3V）或低电平（0V），用来驱动 LED、继电器、蜂鸣器。
-   **输入模式**：读取引脚电平（高或低），用来读取按键、传感器开关信号。
-   **复用功能**：引脚被分配给串口、SPI、I2C、PWM 定时器等外设使用。

点灯实验，就是把某个引脚配置为**推挽输出**，然后交替输出高低电平，LED 就闪烁了。

#### 3.2 LED 与限流电阻

LED（发光二极管）是有极性的元件：长脚是阳极（接正极），短脚是阴极（接负极或地）。LED 导通电压约 1.8-2.2V，工作电流约 5-20mA。如果直接接 3.3V 电源，电流过大，LED 会烧毁，所以**必须串联一个限流电阻**（通常 220Ω-1kΩ）。

电路很简单：

```text
GPIO 引脚 ----[限流电阻 R]----|>|---- GND
                              LED（阳极朝 GPIO 侧）
```

电阻阻值计算：`R = (Vcc - Vled) / I`，例如 3.3V 供电、LED 压降 2V、电流 10mA：`R = (3.3 - 2) / 0.01 = 130Ω`，取常见值 220Ω 即可。

#### 3.3 点灯的完整逻辑

```text
初始化 GPIO（使能时钟、配置模式为输出、设置速度）
    ↓
循环：
    输出高电平（LED 亮）
    延时 500ms
    输出低电平（LED 灭）
    延时 500ms
```

这段逻辑，无论是 STM32 的 HAL 库、ESP32 的 Arduino 框架还是 MicroPython，都是一样的，只是 API 不同。

### 四、示例 1：STM32 寄存器版点灯（原理级）

在理解 HAL 库之前，先看**寄存器版**——直接操作芯片寄存器，这是最底层、最能理解原理的方式。以 STM32F103（Cortex-M3）为例，LED 接在 PC13 引脚（很多最小系统板板载 LED 就是 PC13）。

STM32 的 GPIO 操作分三步：使能 GPIOC 时钟 → 配置 PC13 为输出 → 写数据寄存器。

```c
// 寄存器版点灯：直接操作 STM32F103 寄存器
#include "stm32f10x.h"

// 简化的寄存器地址定义（实际工程在头文件中已定义）
// RCC 时钟控制寄存器
#define RCC_APB2ENR  (*(volatile unsigned int *)0x40021018)
// GPIOC 相关寄存器
#define GPIOC_CRH    (*(volatile unsigned int *)0x40011004) // 配置寄存器高
#define GPIOC_ODR    (*(volatile unsigned int *)0x4001100C) // 输出数据寄存器

// 简易延时（不精确，仅示意）
void delay(volatile unsigned int n) {
    while (n--) { __asm volatile("nop"); }
}

int main(void) {
    // 1. 使能 GPIOC 时钟（RCC_APB2ENR 的 bit4 = IOPCEN）
    RCC_APB2ENR |= (1 << 4);

    // 2. 配置 PC13 为推挽输出，最大速度 2MHz
    // PC13 属于 CRH（引脚 8-15），每引脚占 4 位
    // 模式位(MODE)=0b10(输出2MHz)，配置位(CNF)=0b00(推挽输出)
    GPIOC_CRH &= ~(0xF << (4 * (13 - 8)));   // 先清空 PC13 的 4 位配置
    GPIOC_CRH |=  (0x2 << (4 * (13 - 8)));   // 设为推挽输出

    while (1) {
        GPIOC_ODR |=  (1 << 13);  // PC13 输出高电平，LED 灭（板载 LED 低电平点亮）
        delay(500000);
        GPIOC_ODR &= ~(1 << 13);  // PC13 输出低电平，LED 亮
        delay(500000);
    }
}
```

这段代码的价值在于：它展示了 GPIO 控制的**三个本质步骤**——使能时钟、配置模式、读写数据。HAL 库不过是把这些操作封装成了更友好的函数。

### 五、示例 2：STM32 HAL 库点灯（工程级）

寄存器直接操作虽然原理清晰，但工程开发中我们使用 HAL 库（Hardware Abstraction Layer），它把寄存器操作封装成函数，可读性和可移植性更好。这是目前 STM32 开发的主流方式。

```c
// STM32 HAL 库点灯（CubeMX 生成的工程，仅保留核心逻辑）
#include "main.h"

// 延时 500ms
void delay_ms(uint32_t ms) {
    HAL_Delay(ms);
}

int main(void) {
    // 1. 初始化系统时钟（CubeMX 自动生成 SystemClock_Config）
    HAL_Init();
    SystemClock_Config();

    // 2. 初始化 GPIO（CubeMX 生成的 MX_GPIO_Init）
    MX_GPIO_Init();
    // 内部实现大致是：
    // __HAL_RCC_GPIOC_CLK_ENABLE();           // 使能时钟
    // GPIO_InitStruct.Pin = GPIO_PIN_13;
    // GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;  // 推挽输出
    // GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
    // HAL_GPIO_Init(GPIOC, &GPIO_InitStruct);

    while (1) {
        HAL_GPIO_WritePin(GPIOC, GPIO_PIN_13, GPIO_PIN_RESET); // 低电平，LED 亮
        delay_ms(500);
        HAL_GPIO_WritePin(GPIOC, GPIO_PIN_13, GPIO_PIN_SET);   // 高电平，LED 灭
        delay_ms(500);
    }
}
```

对比寄存器版可以看出：HAL 库把"使能时钟 + 配置模式 + 读写数据"封装成了 `HAL_GPIO_Init` 和 `HAL_GPIO_WritePin`，逻辑完全一样，但代码更清晰、跨芯片移植更容易（换芯片只需重新配置，不用重写逻辑）。

### 六、示例 3：ESP32 Arduino 点灯（C++ 风格）

ESP32 是 ROS2 机器人项目中很常见的无线节点。用 Arduino 框架开发时，代码风格是 C++，API 极其简洁，`digitalWrite` 一行就能控制引脚。

```cpp
// ESP32 Arduino 框架点灯（Arduino IDE 或 PlatformIO）
// LED 接 GPIO2（很多 ESP32 开发板板载 LED 在 GPIO2）
#define LED_PIN 2

void setup() {
    // 配置 GPIO2 为输出模式
    pinMode(LED_PIN, OUTPUT);
    // 初始化串口，便于调试
    Serial.begin(115200);
    Serial.println("ESP32 LED blink start");
}

void loop() {
    // 输出高电平，LED 亮
    digitalWrite(LED_PIN, HIGH);
    delay(500);   // 延时 500ms

    // 输出低电平，LED 灭
    digitalWrite(LED_PIN, LOW);
    delay(500);
}
```

在 PlatformIO 工程中，还可以用 C++ 类封装 LED，方便复用：

```cpp
// led.hpp：可复用的 LED 类
#ifndef LED_HPP
#define LED_HPP

#include <Arduino.h>

class Led {
public:
    Led(uint8_t pin, bool active_high = true)
        : pin_(pin), active_high_(active_high) {}

    void init() {
        pinMode(pin_, OUTPUT);
        off();
    }

    void on()  { digitalWrite(pin_, active_high_ ? HIGH : LOW); }
    void off() { digitalWrite(pin_, active_high_ ? LOW : HIGH); }
    void toggle() {
        digitalWrite(pin_, !digitalRead(pin_));
    }

private:
    uint8_t pin_;
    bool active_high_;
};

// main.cpp
Led led(2);          // GPIO2 上接 LED，高电平点亮
int state = 0;

void setup() {
    led.init();
}

void loop() {
    state = !state;
    if (state) led.on(); else led.off();
    delay(500);
}
#endif
```

这个类的价值在于：`init/on/off/toggle` 的接口设计，和后面 ROS2 驱动里"控制 LED/指示灯的节点"接口天然一致——机器人上层只关心"开/关/翻转"，不关心具体引脚。

### 七、示例 4：MicroPython 点灯（Python 风格）

MicroPython 让 Python 直接运行在单片机上，语法简单，非常适合快速原型验证。ESP32 和部分 STM32 都支持 MicroPython。

```python
# MicroPython 点灯（Thonny 编辑器运行，ESP32 为例）
from machine import Pin
from time import sleep

# 配置 GPIO2 为输出模式
led = Pin(2, Pin.OUT)

print("MicroPython LED blink start")

while True:
    led.value(1)   # 输出高电平，LED 亮
    sleep(0.5)     # 延时 500ms
    led.value(0)   # 输出低电平，LED 灭
    sleep(0.5)
```

MicroPython 还有更"Python 风格"的写法，用定时器和回调：

```python
from machine import Pin, Timer

led = Pin(2, Pin.OUT)

def blink(timer):
    led.toggle()   # 翻转电平

# 创建定时器，每 500ms 触发一次回调
timer = Timer(0)
timer.init(period=500, mode=Timer.PERIODIC, callback=blink)
```

注意：回调里不要做耗时操作（如 sleep），否则会阻塞其他任务。这种"定时器回调"的思想，和 ROS2 里 `create_timer` 定时器极其相似——理解一个，另一个就通了。

对于 ROS2 开发者来说，MicroPython 是理解"Python 在硬件上怎么跑"的最快路径，适合做传感器快速验证。

### 八、串口与调试（嵌入式开发必备技能）

#### 8.1 串口是什么

串口（UART）是嵌入式最常用的调试和通信手段：单片机把调试信息通过串口发送给电脑，电脑用串口助手或 `minicom` 查看。在 ROS2 机器人里，串口也是上位机与下位机通信的主要方式（下一阶段会大量使用）。

串口通信的核心参数：

| 参数 | 常见值 | 说明 |
| --- | --- | --- |
| 波特率 | 115200 | 每秒传输的比特数，两端必须一致 |
| 数据位 | 8 | 每个字节 8 位数据 |
| 停止位 | 1 | 帧结束标志 |
| 校验位 | None | 一般不使用 |

#### 8.2 串口打印调试信息

STM32 HAL 库重定向 printf 到串口：

```c
// 重定向 printf 到 USART1（需要先初始化 USART1）
#include <stdio.h>

int __io_putchar(int ch) {
    // 向 USART1 发送一个字节（HAL 库方式）
    HAL_UART_Transmit(&huart1, (uint8_t *)&ch, 1, 100);
    return ch;
}

// 使用示例
int main(void) {
    HAL_Init();
    SystemClock_Config();
    MX_GPIO_Init();
    MX_USART1_UART_Init();
    __HAL_UART_ENABLE_IT(&huart1, UART_IT_RXNE); // 使能接收中断（可选）

    int count = 0;
    while (1) {
        printf("hello from stm32, count=%d\r\n", count++);
        HAL_Delay(1000);
    }
}
```

MicroPython 就简单得多，直接用 `print`：

```python
from machine import Pin, UART
import time

uart = UART(1, baudrate=115200)  # 初始化串口
led = Pin(2, Pin.OUT)

while True:
    led.toggle()
    uart.write("led toggled\r\n")   # 发送到串口
    print("count:", time.ticks_ms())  # print 也会走 REPL 串口
    time.sleep(1)
```

**调试铁律**：嵌入式程序"看不到运行状态"，串口打印是观察程序行为的眼睛。遇到问题先加打印，再定位。

#### 8.3 常见串口问题

-   波特率不匹配：电脑显示乱码。检查两端波特率是否一致。
-   串口号不对：Windows 下需要安装 CH340/CP2102 驱动，查看设备管理器确定串口号。
-   TX/RX 接反：下位机 TX 接上位机 RX，下位机 RX 接上位机 TX，交叉连接。
-   共地：两个设备必须共地（GND 相连），否则通信不稳定。

### 九、嵌入式与 ROS2 的关系

#### 9.1 嵌入式在 ROS2 生态中的位置

ROS2 本身运行在 Linux 上位机上，但 ROS2 机器人离不开嵌入式：

```text
ROS2 上位机（大脑）
    ↕ 串口 / USB / CAN / Wi-Fi
嵌入式 MCU（肌肉）
    ↕ GPIO / PWM / ADC / 串口
电机、舵机、传感器（肢体）
```

嵌入式负责最底层的"电"的层面：给电机 PWM 信号、读编码器计数、采集 IMU 数据。ROS2 负责"信息"的层面：状态估计、路径规划、任务调度。

#### 9.2 上位机如何"指挥"下位机

最常见的模式是**串口协议**：上位机通过串口发送命令帧（如 `"CMD:FORWARD:SPEED=0.5"`），下位机解析后执行电机控制；下位机定时回传传感器数据帧（如 `"SENSOR:ENCODER=1234"`）。后面第 29-30 篇会详细实现这套协议。

#### 9.3 MicroROS 预告

ROS2 官方提供了 **MicroROS** 方案：让 MCU 也能直接作为 ROS2 节点（通过串口/USB 与上位机的 micro-ROS Agent 桥接）。这样下位机可以直接发布/订阅话题，不用自己写协议。这是第 27 篇的主题，本篇先打好嵌入式基础。

### 十、常见问题与排障

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 程序烧录不进芯片 | 未进 Boot 模式 / 驱动未装 / 接线错误 | 检查 BOOT0 跳线、安装驱动、检查 SWD/USB 接线 |
| 下载成功但 LED 不亮 | 引脚配错 / LED 极性接反 / 未使能时钟 | 核对原理图引脚、调换 LED 方向、检查时钟使能代码 |
| 串口乱码 | 波特率不一致 | 两端统一 115200 |
| 编译报错 undefined reference | 链接库缺失 | 检查 Makefile/CMake 是否正确链接 HAL 库 |
| 程序运行不稳定、偶尔复位 | 电源供电不足 / 干扰 | 外部供电（勿只靠 USB）、加滤波电容 |
| 寄存器操作没反应 | 时钟未使能就操作外设 | 先使能对应外设时钟再配置寄存器 |

### 十一、小结与下一篇预告

**本篇核心**：

1.  机器人 = 上位机（ROS2）+ 下位机（MCU）分工协作，嵌入式负责最底层的电机、传感器控制。
2.  点灯是嵌入式开发的"Hello World"，本质是 GPIO 的时钟使能 → 模式配置 → 电平输出三步。
3.  四种点灯方式：STM32 寄存器版（原理）、STM32 HAL 库（工程）、ESP32 Arduino（C++ 风格）、MicroPython（Python 风格），逻辑完全一致，只是 API 不同。
4.  串口是嵌入式调试的必备手段，也是后续上位机/下位机通信的基础，务必掌握波特率、接线、乱码排查。

至此 **硬件控制阶段（26-30）正式开启**。下一篇（第 27 篇）进入 **MicroROS 接入（原理+仿真）**：让单片机直接变成 ROS2 节点，用 ROS2 的话题和服务去控制 LED、读取传感器。我们会先用仿真环境跑通 MicroROS 完整流程，再为真机接入做准备。嵌入式 + ROS2 的奇妙组合，即将展开。
