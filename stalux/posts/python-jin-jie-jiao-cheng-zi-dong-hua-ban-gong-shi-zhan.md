---
title: "Python进阶教程：自动化办公实战"
abbrlink: python-jin-jie-jiao-cheng-zi-dong-hua-ban-gong-shi-zhan
date: "2026-08-23 16:36:48"
categories:
    - "Python"
tags: []
desc: "这篇Python办公自动化教程介绍了几个常用库的实战应用，包括：openpyxl处理Excel（读取/写入/合并）、python-docx操作Word文档、pdfplumber提取PDF文本…"
---
#### 目录

-   [Python进阶教程：自动化办公实战](#Python_2)
-   -   [一、办公自动化常用库](#_6)
    -   [二、Excel 处理（openpyxl）](#Excel_openpyxl_19)
    -   -   [2.1 读取 Excel](#21__Excel_21)
        -   [2.2 写入 Excel](#22__Excel_42)
    -   [三、批量处理：合并多个 Excel](#_Excel_72)
    -   [四、Word 文档处理](#Word__96)
    -   [五、PDF 文本提取](#PDF__122)
    -   [六、批量文件处理](#_138)
    -   [七、实战：自动生成成绩单报告](#_156)
    -   [总结](#_188)

> 本文是 **Python 入门教程系列** 的第 16 篇（扩展篇）。Python 最接地气的应用场景之一就是**自动化办公**，本篇用实战演示如何用 Python 处理 Excel、Word、PDF 和批量文件。

### 一、办公自动化常用库

| 库 | 用途 |
| --- | --- |
| openpyxl | 读写 Excel（.xlsx） |
| pandas | 数据分析 + Excel 处理 |
| python-docx | 操作 Word 文档 |
| PyPDF2 / pdfplumber | 处理 PDF |
| Pillow | 图像处理 |
| pathlib / shutil | 文件与目录操作 |

安装：`pip install openpyxl python-docx pdfplumber pillow`

### 二、Excel 处理（openpyxl）

#### 2.1 读取 Excel

```python
import openpyxl

# 打开工作簿
wb = openpyxl.load_workbook("sales.xlsx")
ws = wb.active

# 读取单元格
print(ws["A1"].value)
print(ws.cell(row=2, column=1).value)

# 遍历所有行
for row in ws.iter_rows(min_row=1, values_only=True):
    print(row)

# 获取行列数
print(ws.max_row, ws.max_column)
```

#### 2.2 写入 Excel

```python
import openpyxl

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "成绩表"

# 写入表头
headers = ["姓名", "语文", "数学", "英语"]
ws.append(headers)

# 写入数据
students = [
    ("张三", 90, 85, 92),
    ("李四", 78, 95, 88),
    ("王五", 85, 90, 86),
]
for stu in students:
    ws.append(stu)

from openpyxl.styles import Font
ws["A1"].font = Font(bold=True)
ws.column_dimensions["A"].width = 12

wb.save("output.xlsx")
print("保存成功")
```

### 三、批量处理：合并多个 Excel

```python
import openpyxl
import glob

def merge_excels(pattern, output):
    """合并多个 Excel 文件"""
    wb_out = openpyxl.Workbook()
    ws_out = wb_out.active

    for file in glob.glob(pattern):
        wb = openpyxl.load_workbook(file)
        ws = wb.active
        print(f"处理：{file}")
        for row in ws.iter_rows(values_only=True):
            ws_out.append(row)

    wb_out.save(output)
    print(f"已合并到 {output}")

# merge_excels("data/*.xlsx", "merged.xlsx")
```

### 四、Word 文档处理

```python
from docx import Document

# 创建文档
doc = Document()
doc.add_heading("工作报告", level=1)
doc.add_paragraph("这是第一段内容。")
doc.add_paragraph("这是第二段内容。")

# 添加表格
table = doc.add_table(rows=3, cols=2)
table.cell(0, 0).text = "项目"
table.cell(0, 1).text = "进度"
table.cell(1, 0).text = "开发"
table.cell(1, 1).text = "80%"

doc.save("report.docx")

# 读取文档
doc2 = Document("report.docx")
for para in doc2.paragraphs:
    print(para.text)
```

### 五、PDF 文本提取

```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    print(f"共 {len(pdf.pages)} 页")
    text = pdf.pages[0].extract_text()
    print(text[:200])

    table = pdf.pages[0].extract_table()
    if table:
        for row in table:
            print(row)
```

### 六、批量文件处理

```python
from pathlib import Path
import shutil

src = Path("downloads")
dst = Path("organized")

for file in src.iterdir():
    if file.is_file():
        ext = file.suffix.lstrip(".") or "other"
        target_dir = dst / ext
        target_dir.mkdir(parents=True, exist_ok=True)
        shutil.move(str(file), str(target_dir / file.name))
        print(f"移动 {file.name} -> {ext}/" )
```

### 七、实战：自动生成成绩单报告

```python
import openpyxl
from docx import Document

def generate_report(excel_file, output_docx):
    """从 Excel 读取成绩，生成 Word 报告"""
    wb = openpyxl.load_workbook(excel_file)
    ws = wb.active

    doc = Document()
    doc.add_heading("学生成绩报告", level=1)

    total = 0
    count = 0
    for row in ws.iter_rows(min_row=2, values_only=True):
        name, chinese, math, english = row
        avg = (chinese + math + english) / 3
        total += avg
        count += 1
        doc.add_paragraph(f"{name}：平均分 {avg:.1f}")

    if count:
        doc.add_paragraph(f"全班平均分：{total/count:.1f}")

    doc.save(output_docx)
    print(f"报告已生成：{output_docx}")

# generate_report("scores.xlsx", "report.docx")
```

### 总结

本篇演示了用 openpyxl 处理 Excel、python-docx 处理 Word、pdfplumber 提取 PDF、以及批量文件整理，并实现了一个 Excel 到 Word 的自动化报告生成器。办公自动化的核心是**用代码替代重复劳动**，建议从自己日常最繁琐的任务开始实践。
