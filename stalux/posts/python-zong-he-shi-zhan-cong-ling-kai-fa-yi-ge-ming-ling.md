---
title: "Python综合实战：从零开发一个命令行工具"
abbrlink: python-zong-he-shi-zhan-cong-ling-kai-fa-yi-ge-ming-ling
date: "2026-08-25 14:10:18"
categories:
    - "Python"
tags: []
desc: "的收官实战篇（第 20 篇）。前 19 篇学习了语法、库、工程化等知识，本篇把它们串起来，从零开发一个。"
---
#### 目录

-   [Python综合实战：从零开发一个命令行工具](#Python_2)
-   -   [一、项目目标](#_6)
    -   [二、项目结构](#_15)
    -   [三、核心逻辑（core.py）](#corepy_31)
    -   [四、命令行入口（cli.py）](#clipy_73)
    -   [五、支持 python -m 运行](#_python_m__123)
    -   [六、打包安装（pyproject.toml）](#pyprojecttoml_133)
    -   [七、编写测试](#_159)
    -   [八、完整使用演示](#_184)
    -   [系列完结](#_207)

> 本文是 **Python 入门教程系列** 的收官实战篇（第 20 篇）。前 19 篇学习了语法、库、工程化等知识，本篇把它们串起来，从零开发一个**可发布的命令行工具**。

### 一、项目目标

开发一个命令行工具 `fileman`，功能：

-   统计目录下文件数量与大小
-   按扩展名分类整理文件
-   支持命令行参数
-   可安装到系统全局使用

### 二、项目结构

```text
fileman/
├── fileman/
│   ├── __init__.py
│   ├── __main__.py      # 支持 python -m fileman
│   ├── cli.py           # 命令行入口
│   └── core.py          # 核心逻辑
├── tests/
│   └── test_core.py
├── pyproject.toml
├── README.md
└── .gitignore
```

### 三、核心逻辑（core.py）

```python
# fileman/core.py
from pathlib import Path
from collections import Counter

def scan_directory(path):
    """扫描目录，返回文件统计信息"""
    root = Path(path)
    if not root.exists():
        raise FileNotFoundError(f"目录不存在：{path}")

    files = [f for f in root.rglob("*") if f.is_file()]
    total_size = sum(f.stat().st_size for f in files)
    ext_counter = Counter(f.suffix.lower() or "(无扩展名)" for f in files)

    return {
        "total_files": len(files),
        "total_size": total_size,
        "top_extensions": ext_counter.most_common(5),
    }

def organize_files(source, target):
    """按扩展名整理文件到子目录"""
    src = Path(source)
    dst = Path(target)
    moved = 0

    for file in src.iterdir():
        if not file.is_file():
            continue
        ext = file.suffix.lstrip(".").lower() or "other"
        target_dir = dst / ext
        target_dir.mkdir(parents=True, exist_ok=True)
        new_path = target_dir / file.name
        file.rename(new_path)
        moved += 1

    return moved
```

### 四、命令行入口（cli.py）

```python
# fileman/cli.py
import argparse
from .core import scan_directory, organize_files

def format_size(size):
    """格式化文件大小"""
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}TB"

def main():
    parser = argparse.ArgumentParser(
        prog="fileman",
        description="文件管理命令行工具",
)
    sub = parser.add_subparsers(dest="command")

    # scan 子命令
    p_scan = sub.add_parser("scan", help="扫描目录统计")
    p_scan.add_argument("path", help="要扫描的目录")

    # organize 子命令
    p_org = sub.add_parser("organize", help="按类型整理文件")
    p_org.add_argument("source", help="源目录")
    p_org.add_argument("-o", "--output", default="organized", help="目标目录")

    args = parser.parse_args()

    if args.command == "scan":
        info = scan_directory(args.path)
        print(f"文件总数：{info["total_files"]}")
        print(f"总大小：{format_size(info["total_size"])}")
        print("扩展名统计：")
        for ext, count in info["top_extensions"]:
            print(f"  {ext}: {count} 个")
    elif args.command == "organize":
        moved = organize_files(args.source, args.output)
        print(f"已整理 {moved} 个文件到 {args.output}/ 目录")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
```

### 五、支持 python -m 运行

```python
# fileman/__main__.py
from .cli import main

if __name__ == "__main__":
    main()
```

### 六、打包安装（pyproject.toml）

```toml
[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[project]
name = "fileman"
version = "0.1.0"
description = "文件管理命令行工具"
requires-python = ">=3.8"

[project.scripts]
fileman = "fileman.cli:main"
```

```bash
# 安装到系统（全局可用 fileman 命令）
pip install -e .

# 直接使用
fileman scan .
fileman organize ~/Downloads
```

### 七、编写测试

```python
# tests/test_core.py
import pytest
from fileman.core import organize_files
import tempfile
from pathlib import Path

def test_organize_files():
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "src"
        dst = Path(tmp) / "dst"
        src.mkdir()
        (src / "a.txt").write_text("hello")
        (src / "b.jpg").write_bytes(b"123")

        moved = organize_files(str(src), str(dst))
        assert moved == 2
        assert (dst / "txt" / "a.txt").exists()
        assert (dst / "jpg" / "b.jpg").exists()
```

运行：`pytest tests/ -v`

### 八、完整使用演示

```bash
# 1. 扫描目录
$ fileman scan ~/Downloads
文件总数：125
总大小：2.3GB
扩展名统计：
  .jpg: 45 个
  .pdf: 30 个
  .zip: 20 个
  .docx: 15 个
  (无扩展名): 15 个

# 2. 整理文件
$ fileman organize ~/Downloads -o ~/Organized
已整理 125 个文件到 ~/Organized/ 目录

# 3. 效果
$ ls ~/Organized
jpg/  pdf/  zip/  docx/  other/
```

### 系列完结

至此，**Python 入门教程系列 20 篇**全部完成！

| 阶段 | 篇目 |
| --- | --- |
| 入门 | 1-4：语法、OOP、文件、标准库 |
| 进阶 | 5-10：网络、并发、数据库、数据分析、Web、调试 |
| 深入 | 11-14：正则、异步、装饰器、测试 |
| 工程 | 15-16：工程化、自动化办公 |
| 扩展 | 17-19：机器学习、算法、Git |
| 实战 | 20：命令行工具全流程 |

接下来的学习建议：

1.  找真实项目练手，把本系列技术用起来
2.  参与开源项目，阅读优秀代码
3.  持续输出学习笔记，巩固知识
4.  关注新技术方向（AI、大数据、云原生）

感谢你一路读到这里，祝你编程之路越走越远！
