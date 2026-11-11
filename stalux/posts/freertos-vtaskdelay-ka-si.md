---
title: "freertos vTaskDelay卡死"
abbrlink: freertos-vtaskdelay-ka-si
date: "2023-05-03 19:05:59"
categories:
    - "嵌入式"
tags: []
desc: "解决办法，改成在main方法中创建任务，调用vTaskDelay工作正常，我用的是nuvoton的库，所以可能与sdk移植有关系，反正问题就是这么解决的，希望能帮到同路者…"
---
在开始任务中使用动态方法创建任务后，在任务中调用vTaskDelay卡死，然后排查问题，定时器工作正常，如果不使用vTaskDelay也可以一直运行。

       解决办法，改成在main方法中创建任务，调用vTaskDelay工作正常，我用的是nuvoton的库，所以可能与sdk移植有关系，反正问题就是这么解决的，希望能帮到同路者。
