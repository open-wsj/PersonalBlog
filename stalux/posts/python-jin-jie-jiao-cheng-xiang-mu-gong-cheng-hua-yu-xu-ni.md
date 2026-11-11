---
title: "Python进阶教程：项目工程化与虚拟环境"
abbrlink: python-jin-jie-jiao-cheng-xiang-mu-gong-cheng-hua-yu-xu-ni
date: "2026-08-23 16:36:12"
categories:
    - "Python"
tags: []
desc: "本篇介绍了虚拟环境、依赖管理、项目目录结构、.gitignore 规范等工程化基础。良好的工程习惯能让项目更易维护、协作和部署。下一篇将介绍自动化办公，用 Python 解放重复劳动。"
---
#### 目录

-   [Python进阶教程：项目工程化与虚拟环境](#Python_2)
-   -   [一、虚拟环境](#_6)
    -   [二、依赖管理](#_24)
    -   -   [2.1 requirements.txt](#21_requirementstxt_26)
        -   [2.2 依赖分组（生产/开发）](#22__36)
    -   [三、项目目录结构](#_50)
    -   [四、.gitignore 必备规则](#gitignore__72)
    -   [五、包管理进阶：pip 与 pipenv](#pip__pipenv_102)
    -   [六、使用第三方工具提升效率](#_118)
    -   -   [6.1 pyproject.toml 现代配置](#61_pyprojecttoml__120)
        -   [6.2 一键脚本](#62__141)
    -   [七、实战：搭建一个规范的项目](#_154)
    -   -   [项目初始化清单](#_179)
    -   [总结](#_189)

> 本文是 **Python 入门教程系列** 的第 15 篇（扩展篇）。前面学习了语法和库，本篇介绍如何把代码组织成**规范、可维护、可分享**的工程项目。

### 一、虚拟环境

不同项目依赖的库版本可能冲突，虚拟环境让每个项目**独立隔离**依赖：

```bash
# 创建虚拟环境（Python 3.3+ 内置）
python -m venv myenv

# 激活（Windows）
myenv\Scripts\activate

# 激活（macOS / Linux）
source myenv/bin/activate

# 退出
deactivate
```

### 二、依赖管理

#### 2.1 requirements.txt

```bash
# 导出当前环境依赖
pip freeze > requirements.txt

# 在新环境安装
pip install -r requirements.txt
```

#### 2.2 依赖分组（生产/开发）

```text
# requirements.txt（生产依赖）
flask==3.0.0
requests==2.31.0

# requirements-dev.txt（开发依赖）
-r requirements.txt
pytest==8.0.0
black==24.1.0
flake8==7.0.0
```

### 三、项目目录结构

```text
my_project/
├── README.md            # 项目说明
├── requirements.txt     # 依赖清单
├── .gitignore           # Git 忽略规则
├── setup.py / pyproject.toml  # 打包配置
├── src/
│   └── my_package/
│       ├── __init__.py
│       ├── main.py
│       ├── utils.py
│       └── models.py
├── tests/               # 测试目录
│   ├── __init__.py
│   ├── test_utils.py
│   └── test_models.py
├── docs/                # 文档
└── scripts/             # 辅助脚本
```

### 四、.gitignore 必备规则

```text
# Python 缓存与构建
__pycache__/
*.py[cod]
build/
dist/
*.egg-info/

# 虚拟环境
venv/
myenv/
.venv/

# 测试与覆盖率
.pytest_cache/
.coverage
htmlcov/

# IDE 与系统
.vscode/
.idea/
.DS_Store

# 敏感信息
.env
*.env
```

### 五、包管理进阶：pip 与 pipenv

```bash
# 查看已安装包
pip list

# 查看包信息
pip show requests

# 更新包
pip install --upgrade requests

# 卸载
pip uninstall requests
```

### 六、使用第三方工具提升效率

#### 6.1 pyproject.toml 现代配置

```toml
[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[project]
name = "my-project"
version = "0.1.0"
description = "一个示例项目"
requires-python = ">=3.9"
dependencies = [
    "flask>=3.0",
    "requests>=2.31",
]

[project.optional-dependencies]
dev = ["pytest", "black", "flake8"]
```

#### 6.2 一键脚本

```python
# scripts/setup.sh / setup.bat
# 一键创建虚拟环境并安装依赖

# Windows (setup.bat)
python -m venv myenv
call myenv\Scripts\activate.bat
pip install -r requirements.txt
echo 环境配置完成！
```

### 七、实战：搭建一个规范的项目

```text
# 步骤 1：创建目录结构
project_root/
├── requirements.txt
├── .gitignore
└── src/
    └── hello_cli/
        ├── __init__.py
        └── main.py

# 步骤 2：编写代码（src/hello_cli/main.py）
def main():
    print("Hello, Project!")

if __name__ == "__main__":
    main()

# 步骤 3：初始化 Git 并提交
git init
git add .
git commit -m "init project"
```

#### 项目初始化清单

-   [x]  创建虚拟环境
-   [x]  编写 requirements.txt
-   [x]  编写 .gitignore
-   [x]  建立 src / tests / docs 目录
-   [x]  初始化 Git 仓库
-   [x]  编写 README.md
-   [x]  首次提交代码

### 总结

本篇介绍了虚拟环境、依赖管理、项目目录结构、.gitignore 规范等工程化基础。良好的工程习惯能让项目更易维护、协作和部署。下一篇将介绍**自动化办公**，用 Python 解放重复劳动。
