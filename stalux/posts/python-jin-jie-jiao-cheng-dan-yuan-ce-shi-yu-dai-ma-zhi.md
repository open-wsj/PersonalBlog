---
title: "Python进阶教程：单元测试与代码质量"
abbrlink: python-jin-jie-jiao-cheng-dan-yuan-ce-shi-yu-dai-ma-zhi
date: "2026-08-22 00:01:18"
categories:
    - "Python"
tags: []
desc: "本篇介绍了 unittest 与 pytest 两大测试框架、Mock 模拟外部依赖、以及 flake8/black/mypy/coverage 等代码质量工具，并为计算器类编写了完整测试…"
---
#### 目录

-   [Python进阶教程：单元测试与代码质量](#Python_2)
-   -   [一、为什么需要测试](#_6)
    -   [二、unittest 基础](#unittest__14)
    -   [三、setUp 与 tearDown](#setUp__tearDown_45)
    -   [四、pytest：更简洁的框架](#pytest_73)
    -   [五、Mock：模拟外部依赖](#Mock_107)
    -   [六、代码质量工具](#_129)
    -   -   [6.1 代码风格检查](#61__131)
        -   [6.2 覆盖率统计](#62__147)
    -   [七、实战：为工具类编写测试](#_159)
    -   [总结](#_203)

> 本文是 **Python 入门教程系列** 的第 14 篇（扩展篇）。上一篇讲解了装饰器与生成器，本篇介绍如何用**单元测试**保障代码质量。

### 一、为什么需要测试

随着代码规模增长，手动验证越来越不可靠。自动化测试能：

-   快速回归：改动代码后立即发现是否破坏原有功能
-   驱动设计：写测试时倒逼代码结构清晰
-   保障重构：放心地优化代码而不怕改坏

### 二、unittest 基础

unittest 是 Python 内置测试框架：

```python
import unittest

def add(a, b):
    return a + b

def divide(a, b):
    if b == 0:
        raise ValueError("除数不能为零")
    return a / b

class TestMath(unittest.TestCase):
    def test_add(self):
        self.assertEqual(add(1, 2), 3)
        self.assertEqual(add(-1, 1), 0)

    def test_divide(self):
        self.assertEqual(divide(10, 2), 5)
        with self.assertRaises(ValueError):
            divide(10, 0)

if __name__ == "__main__":
    unittest.main()
```

运行：`python -m unittest test_math.py`

### 三、setUp 与 tearDown

```python
import unittest

class TestDatabase(unittest.TestCase):
    def setUp(self):
        """每个测试前执行"""
        self.data = {"name": "Alice", "age": 20}

    def tearDown(self):
        """每个测试后执行"""
        self.data.clear()

    def test_data(self):
        self.assertEqual(self.data["name"], "Alice")

    @classmethod
    def setUpClass(cls):
        """整个测试类执行前运行一次"""
        print("开始测试")

    @classmethod
    def tearDownClass(cls):
        """整个测试类执行后运行一次"""
        print("测试结束")
```

### 四、pytest：更简洁的框架

pytest 语法更简洁，是社区主流（`pip install pytest`）：

```python
# test_calculator.py
import pytest

def add(a, b):
    return a + b

def test_add_positive():
    assert add(1, 2) == 3

def test_add_negative():
    assert add(-1, -2) == -3

# 参数化测试
@pytest.mark.parametrize("a,b,expected", [
    (1, 2, 3),
    (0, 0, 0),
    (-5, 5, 0),
])
def test_add_param(a, b, expected):
    assert add(a, b) == expected

# 异常断言
def test_add_raises():
    with pytest.raises(TypeError):
        add("1", 2)
```

运行：`pytest test_calculator.py -v`

### 五、Mock：模拟外部依赖

测试中经常需要模拟网络、数据库等外部依赖：

```python
from unittest.mock import Mock, patch

def get_user_data(api):
    """从 API 获取用户数据（依赖外部服务）"""
    resp = api.get("/users/1")
    return resp.json()["name"]

def test_get_user_data():
    # 创建一个 Mock API
    mock_api = Mock()
    mock_api.get.return_value.json.return_value = {"name": "Alice"}

    result = get_user_data(mock_api)
    assert result == "Alice"
    mock_api.get.assert_called_with("/users/1")
```

### 六、代码质量工具

#### 6.1 代码风格检查

```bash
# 安装
pip install flake8 black mypy

# 检查代码风格
flake8 my_module.py

# 自动格式化
black my_module.py

# 类型检查
mypy my_module.py
```

#### 6.2 覆盖率统计

```bash
# 安装
pip install coverage

# 统计测试覆盖率
coverage run -m pytest
coverage report  # 查看报告
coverage html    # 生成 HTML 报告
```

### 七、实战：为工具类编写测试

```python
# calculator.py
class Calculator:
    def add(self, a, b):
        return a + b

    def subtract(self, a, b):
        return a - b

    def multiply(self, a, b):
        return a * b

    def divide(self, a, b):
        if b == 0:
            raise ValueError("不能除以零")
        return a / b
```

```python
# test_calculator.py
import pytest
from calculator import Calculator

@pytest.fixture
def calc():
    """测试夹具：为每个测试提供实例"""
    return Calculator()

def test_add(calc):
    assert calc.add(2, 3) == 5

def test_subtract(calc):
    assert calc.subtract(10, 4) == 6

def test_divide(calc):
    assert calc.divide(8, 2) == 4

def test_divide_by_zero(calc):
    with pytest.raises(ValueError):
        calc.divide(1, 0)
```

### 总结

本篇介绍了 unittest 与 pytest 两大测试框架、Mock 模拟外部依赖、以及 flake8/black/mypy/coverage 等代码质量工具，并为计算器类编写了完整测试。养成写测试的习惯，是成为专业开发者的重要一步。
