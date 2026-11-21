---
title: "CameraX 双流水线：让预览和推理互不拖累"
abbrlink: camerax-shuang-liu-shui-xian-yu-tui-li-jie-ou
date: "2026-11-21 10:20:00"
categories:
    - "Android"
tags: ["CameraX", "ncnn", "Android", "实时推理"]
desc: "相机预览要 30fps 才跟手，端侧推理可能一帧要 346ms。把两者放在同一条流水线里，结果一定是互相拖累。这篇讲 CameraX 的 Preview + ImageAnalysis 双流水线怎么搭、帧怎么丢、坐标怎么对、以及实测出来的那些坑。"
---

## 一、问题：预览和推理的节奏天生不一样

一个端侧检测 App 的直觉写法是：拿到相机帧 → 预处理 → 推理 → 画框 → 显示。听起来合理，跑起来会发现两个数字根本对不上：

| 环节 | 节奏 |
| --- | --- |
| 预览 | 30 fps，每帧 33ms |
| ncnn 推理（CPU 4 线程） | 每帧约 346ms，≈ 2.9 fps |

两者相差一个数量级。如果串成一条链路，会发生三件事：

1.  **预览被拖慢到 2.9 fps**，画面卡成幻灯片；
2.  **帧在队列里越积越多**，画面延迟越来越大，动一下手要等半秒才看到；
3.  **推理处理的永远是几百毫秒前的旧帧**，检测框和当前画面错位。

结论很明确：**预览和推理必须是两条独立的通路，各自有各自的节奏**。

先看整体结构：

![CameraX 双流水线结构图：Preview 流走零拷贝 Surface 到系统合成，ImageAnalysis 流做 ncnn 推理并叠加检测框](/images/android/camerax-dual-pipeline.png)

图中两条线都从同一个相机出发，但之后完全分开：

-   **预览通路**：`Preview` → 零拷贝 `Surface` → `SurfaceFlinger` 合成 → 屏幕刷新（60/120Hz）；
-   **推理通路**：`ImageAnalysis` → ncnn 推理（CPU×4，慢）→ `Overlay` 叠加，**只画检测框**。

两条通路共享「同源帧」，但**互不等待**。这是整个设计的核心。

## 二、CameraX 为什么天然支持这种拆分

CameraX 的 `UseCase` 模型就是为多消费者设计的。绑定的时候：

```kotlin
val preview = Preview.Builder()
    .setTargetResolution(Size(1280, 720))
    .build()
    .also { it.setSurfaceProvider(previewView.surfaceProvider) }

val analysis = ImageAnalysis.Builder()
    .setTargetResolution(Size(640, 640))
    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
    .build()
    .also { it.setAnalyzer(cameraExecutor, analyzer) }

cameraProvider.bindToLifecycle(
    lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis
)
```

绑定之后，CameraX 在底层做了一件很关键的事：**同一路相机输出被分发给两个 Surface**，`Preview` 的那个直接给 `SurfaceView`/`TextureView`，不需要经过 CPU 拷贝；`ImageAnalysis` 的那个才需要把数据搬到内存里做后续处理。

这就是图里「同源帧、两条独立通路」的来源——不是我们自己去拷贝两份，而是 CameraX 在 HAL 和 Surface 层面就分发好了。

一个常见的误解是「`Preview` 和 `ImageAnalysis` 用不同的分辨率会得到两路不同的取景」。不会——它们对应的是同一帧的两个输出格式/尺寸，场景内容一致，只是采样尺寸不同。这对后续坐标映射很重要。

## 三、预览通路：零拷贝是关键

预览要流畅，唯一的要求是**不要碰像素数据**。

`Preview` 的 `SurfaceProvider` 拿到的是一个可以直接显示的画面。如果你的代码里出现了 `ImageProxy.toBitmap()` 然后画到自定义 View 上，那就等于把 GPU 的工作搬到了 CPU：

-   每帧一次 YUV → RGB 转换；
-   每帧一次全尺寸 Bitmap 分配；
-   主线程或渲染线程额外做一次绘制。

这三个动作在 1080p 下就足以把帧率压到 15fps 以下，还会带来频繁 GC。**预览就让它走 `Preview`，不要自己画**。

如果确实需要在预览上叠加东西（检测框、准星、遮罩），正确做法是**在上面盖一层透明的 View 或 Compose Canvas**，只画那几个矩形，而不是复制整帧画面。

## 四、推理通路：慢是可以接受的，只要不拖累预览

推理端的设计目标不是「快」，而是「**无论多慢都不影响预览，并且永远处理最新的帧**」。

### 4.1 背压策略：KEEP_ONLY_LATEST

`ImageAnalysis` 提供两种背压策略：

| 策略 | 行为 | 适用 |
| --- | --- | --- |
| `STRATEGY_BLOCK_PRODUCER` | 队列满了就阻塞相机，不丢帧 | 每一帧都必须处理（如录像编码、逐帧保存） |
| `STRATEGY_KEEP_ONLY_LATEST` | 只保留最新一帧，旧的直接丢掉 | 实时检测、预览类任务 |

图里那句 `KEEP_ONLY_LATEST: 推理跟不上就丢帧，预览始终是最新画面` 就是这个选择。

它还顺带解决了延迟累积问题：如果队列保留 10 帧，推理 346ms 一帧，那第 10 帧被处理时已经是 3.5 秒前的画面，检测框会严重滞后。**实时视觉任务里，「处理一帧旧的」还不如「跳过它去处理新的」**。

### 4.2 分析器必须自己保证线程模型

`setAnalyzer(executor, analyzer)` 里传入的 `executor` 决定了回调在哪个线程执行。实践中要遵守三条：

1.  **用单线程 executor**，不要用主线程，也不要用共享线程池。推理是重 CPU 任务，多线程调度只会带来抖动。
2.  **处理完必须 `imageProxy.close()`**，否则相机拿不到 buffer，预览会直接卡死。用 `try/finally` 包起来。
3.  **不要把 `ImageProxy` 传到别的线程慢慢处理**。`ImageProxy` 对应的是底层 buffer，close 之后就失效了。需要异步处理时必须先把数据拷贝出来（或者用 `imageProxy.image` 的 `acquireNextImage` 机制），并在拷贝完成后再 close。

一个典型的分析器骨架：

```kotlin
private val cameraExecutor = Executors.newSingleThreadExecutor()

private val analyzer = ImageAnalysis.Analyzer { imageProxy ->
    try {
        // 1. 只做必要的格式转换，尽量复用 buffer
        val input = preprocessor.convert(imageProxy)

        // 2. 推理（阻塞 300ms 左右，但在独立线程里，不影响预览）
        val boxes = detector.detect(input)

        // 3. 结果投递到 UI 线程画框
        overlayView.post { overlayView.updateBoxes(boxes) }
    } finally {
        imageProxy.close()   // 必须！否则画面会卡住
    }
}
```

`overlayView.post` 而不是直接调用，是因为分析线程不是 UI 线程；更新 View 必须回到主线程。

### 4.3 346ms 一帧意味着什么

按 2.9 fps 的推理速度，每秒只处理不到 3 帧。这带来两个必须接受的现实：

-   **检测框会「跳」**。相邻两次检测间隔 300 多毫秒，物体在画面里已经移动了一段距离。
-   **不能对每一帧做后处理**（跟踪、平滑）。要做平滑，只能基于「上一次的框 + 时间差」做插值或简单跟踪，而不是假设帧率是 30fps。

如果业务要求更连贯的框，常见手段是：

1.  **降低推理分辨率**（640×640 或更小），这是最直接的提速；
2.  **减小模型**（换更轻的骨干、量化 INT8）；
3.  **跳帧推理 + 光流/跟踪插值**（如 KCF、ByteTrack），用轻量跟踪补足帧率差；
4.  **GPU/NPU 后端**（ncnn 的 Vulkan 后端、NNAPI），但要处理兼容性和精度回退。

## 五、叠加层：只画框，不碰画面

图里 `Overlay 叠加` 标注了「只画检测框」，这是刻意的设计约束。

错误做法是把检测框画到预览的 Bitmap 上再显示——这又回到了整帧拷贝的老路。正确做法是**独立的透明覆盖层**：

```kotlin
class OverlayView(context: Context) : View(context) {
    private var boxes: List<RectF> = emptyList()
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 4f
        color = Color.GREEN
    }

    fun updateBoxes(newBoxes: List<RectF>) {
        boxes = newBoxes
        invalidate()          // 只重绘这一层
    }

    override fun onDraw(canvas: Canvas) {
        boxes.forEach { canvas.drawRect(it, paint) }
    }
}
```

配合 `FrameLayout` 或 `Box` 把 `PreviewView` 和 `OverlayView` 叠起来即可。叠加层只做「几个矩形的绘制」，成本几乎为零，而且可以独立于预览帧率刷新。

## 六、坐标怎么对：这是最容易错的一步

检测框画歪，90% 是坐标系统一没做好。这里有**三套坐标**：

1.  **模型输入坐标**：比如 640×640，原点左上；
2.  **`ImageAnalysis` 帧坐标**：比如 640×480，且可能被旋转 90°/270°；
3.  **`PreviewView` 显示坐标**：屏幕上的实际像素，还涉及 `scaleType`（`FILL_CENTER` 会裁剪）。

正确的映射顺序是：

```
模型输出（640×640，归一化）
  → 乘以原图尺寸，还原到 ImageAnalysis 帧坐标
  → 应用 rotationDegrees 旋转校正
  → 按 PreviewView 的 scaleType 做缩放与偏移（考虑裁剪）
  → OverlayView 坐标
```

两个最常踩的点：

-   **`imageProxy.imageInfo.rotationDegrees` 不能忽略**。竖屏手机后置相机通常输出 90° 旋转的画面，不处理的话框会整体转 90°。
-   **`PreviewView` 的 `scaleType` 默认是 `FILL_CENTER`**，会按比例放大并裁剪边缘。如果 Overlay 只按「预览尺寸 / 分析尺寸」简单缩放，框会整体偏移。要拿 `PreviewView` 实际的 `width/height` 和画面宽高比算实际显示区域（可能有黑边或裁剪）。

一个实用技巧：`PreviewView` 提供了 `getOutputTransform()`（配合 `PreviewView.ImplementationMode.COMPATIBLE`），可以直接把 `ImageAnalysis` 的源矩形映射到显示坐标，比自己手算可靠。

## 七、实测数据与调优记录

这台设备上的基线数据：

| 指标 | 数值 |
| --- | --- |
| 预览帧率 | 30 fps（稳定） |
| 推理耗时 | 346 ms/帧 |
| 推理帧率 | ≈ 2.9 fps |
| 推理线程 | CPU × 4 |
| 输入尺寸 | 640×640 |

几个调优动作和效果：

1.  **先确认瓶颈在推理而不是取帧**。把分析器改成「取帧后立刻 close，不做任何处理」，如果预览 30fps 且分析回调频率也正常，说明瓶颈确实在模型。如果此时就掉帧，问题在格式转换或线程配置。
2.  **关掉不必要的格式转换**。`ImageAnalysis` 默认输出 YUV_420_888，ncnn 一般要 RGB。能直接把 YUV 拆成三通道喂进去，就省掉一次全尺寸转换；实测能省 20~30ms。
3.  **复用输入 buffer**。每帧 `Bitmap.create()` 会让 GC 频繁触发，改成预分配、每帧 `copyPixelsFromBuffer` 复用。
4.  **推理线程数不要开满**。4 线程是这台机器的甜点；开到 8 线程反而因为调度和内存带宽争抢变慢，还会和渲染线程抢 CPU 导致预览抖动。
5.  **INT8 量化**。模型量化后单帧从 346ms 降到约 120ms，精度损失在可接受范围内（需要用自己的验证集确认，不要只看论文数字）。

## 八、常见坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 预览卡死不动 | 分析器没调 `imageProxy.close()` | `try/finally` 里 close |
| 预览只有几帧每秒 | 用了 BLOCK 策略或分析器阻塞了相机线程 | 改 `KEEP_ONLY_LATEST`，分析放独立线程 |
| 检测框整体旋转 | 忽略 `rotationDegrees` | 映射时应用旋转 |
| 检测框偏移、缩放不对 | `PreviewView` 的 `FILL_CENTER` 裁剪未考虑 | 用 `getOutputTransform()` 或按实际显示区域算 |
| 框比画面滞后半秒 | 队列累积旧帧 | `KEEP_ONLY_LATEST` |
| 频繁 GC、帧率抖动 | 每帧新建 Bitmap / 数组 | 预分配复用 |
| 推理时预览掉帧 | 线程数过多，抢了渲染 CPU | 限制推理线程数 |
| 切换前后摄后崩溃 | 分析器里持有旧 `ImageProxy` | close 后再丢弃，不跨生命周期保存 |
| 屏幕熄灭再亮起后无预览 | 未绑定生命周期或相机被占用 | 用 `bindToLifecycle`，处理好 `onResume` |

## 九、这套结构能推广到哪

「快通路 + 慢通路 + 只叠加轻量结果」是端侧视觉任务的通用范式，不限于检测：

-   **分割**：慢通路输出 mask，叠加层画半透明色块；
-   **姿态估计**：慢通路出关键点，叠加层画骨架线；
-   **OCR**：慢通路出文字框，叠加层画框 + 文本；
-   **超分/去噪**：慢通路处理整帧，但通常要改成「处理一帧、复用几帧」的节奏。

判断标准很简单：**慢通路的输出能否用很少的绘制量表达出来**。能，就用叠加层；不能（比如要替换整幅画面），就必须换架构——通常是 GPU 渲染管线，而不是 CPU 拷贝。

## 十、总结

-   预览要 30fps，推理可能只有 3fps，**两条通路必须解耦**，不能串成一条链。
-   CameraX 的 `UseCase` 模型天然支持多消费者：`Preview` 拿零拷贝 Surface，`ImageAnalysis` 拿可分析帧，同源不同路。
-   预览通路的核心是**不要碰像素**；叠加检测框用独立透明 View，只画矩形。
-   推理通路的核心是 `STRATEGY_KEEP_ONLY_LATEST` + 独立单线程 + 必须 `close()`；实时任务里丢帧比积压更正确。
-   坐标映射要过三套坐标系，`rotationDegrees` 和 `PreviewView` 的 `scaleType` 是两个高频错误点。
-   346ms 的推理速度下，检测框天然会跳；想连贯就降分辨率、量化、或加轻量跟踪，而不是硬提帧率。
-   「快通路 + 慢通路 + 轻量叠加」是可推广到分割、姿态、OCR 的通用结构。
