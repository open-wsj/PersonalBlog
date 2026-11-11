---
title: "Python进阶教程：Web开发入门（Flask）"
abbrlink: python-jin-jie-jiao-cheng-web-kai-fa-ru-men-flask
date: "2026-08-19 13:22:07"
categories:
    - "Python"
tags: []
desc: "简单：一个文件即可启动 Web 服务灵活：可以自由选择组件生态好：文档丰富，社区庞大本篇介绍了 Flask 的路由、模板、表单处理和 JSON API，并用待办清单应用串联实战…"
---
#### 目录

-   [Python进阶教程：Web开发入门（Flask）](#PythonWebFlask_2)
-   -   [一、Flask 简介](#Flask__6)
    -   [二、第一个 Flask 应用](#_Flask__16)
    -   [三、路由与参数](#_31)
    -   [四、模板渲染](#_57)
    -   [五、处理表单数据](#_91)
    -   [六、JSON API](#JSON_API_108)
    -   [七、实战：待办清单 Web 应用](#_Web__134)
    -   [总结](#_187)

> 本文是 **Python 入门教程系列** 的第 9 篇。前面介绍了数据分析，本篇介绍用 **Flask** 框架快速搭建 Web 应用。

### 一、Flask 简介

Flask 是 Python 最流行的轻量级 Web 框架：

-   **简单**：一个文件即可启动 Web 服务
-   **灵活**：可以自由选择组件
-   **生态好**：文档丰富，社区庞大

安装：`pip install flask`

### 二、第一个 Flask 应用

```python
from flask import Flask

app = Flask(__name__)

@app.route("/")
def home():
    return "<h1>Hello, Flask!</h1>"

if __name__ == "__main__":
    app.run(debug=True)  # 启动，访问 http://127.0.0.1:5000
```

### 三、路由与参数

```python
from flask import Flask

app = Flask(__name__)

# 普通路由
@app.route("/about")
def about():
    return "关于页面"

# 动态参数
@app.route("/user/<name>")
def user(name):
    return f"<h1>欢迎，{name}！</h1>"

# 指定请求方法
@app.route("/login", methods=["GET", "POST"])
def login():
    return "登录页面"

if __name__ == "__main__":
    app.run(debug=True)
```

### 四、模板渲染

模板让你在 HTML 中嵌入 Python 变量和逻辑（Jinja2 模板引擎）：

```python
from flask import Flask, render_template

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("index.html", title="首页", items=["Python", "Flask", "Web"])

if __name__ == "__main__":
    app.run(debug=True)
```

配套模板文件 `templates/index.html`：

```html
<!DOCTYPE html>
<html>
<head><title>{{ title }}</title></head>
<body>
    <h1>{{ title }}</h1>
    <ul>
        {% for item in items %}
        <li>{{ item }}</li>
        {% endfor %}
    </ul>
</body>
</html>
```

### 五、处理表单数据

```python
from flask import Flask, request

app = Flask(__name__)

@app.route("/submit", methods=["POST"])
def submit():
    name = request.form.get("name")
    email = request.form.get("email")
    return f"收到：{name}（{email}）"

if __name__ == "__main__":
    app.run(debug=True)
```

### 六、JSON API

现代 Web 应用前后端分离，后端只需返回 JSON：

```python
from flask import Flask, jsonify, request

app = Flask(__name__)

users = [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]

@app.route("/api/users", methods=["GET"])
def get_users():
    return jsonify(users)

@app.route("/api/users", methods=["POST"])
def add_user():
    data = request.get_json()
    new_id = max(u["id"] for u in users) + 1
    users.append({"id": new_id, "name": data.get("name")})
    return jsonify(users[-1]), 201

if __name__ == "__main__":
    app.run(debug=True)
```

### 七、实战：待办清单 Web 应用

综合运用所学知识，做一个简单的待办清单应用：

```python
from flask import Flask, render_template, request, redirect, url_for

app = Flask(__name__)
todos = []  # 内存存储，重启会清空

@app.route("/")
def index():
    return render_template("todos.html", todos=todos)

@app.route("/add", methods=["POST"])
def add():
    text = request.form.get("text", "").strip()
    if text:
        todos.append({"id": len(todos) + 1, "text": text, "done": False})
    return redirect(url_for("index"))

@app.route("/done/<int:todo_id>")
def done(todo_id):
    for t in todos:
        if t["id"] == todo_id:
            t["done"] = True
    return redirect(url_for("index"))

if __name__ == "__main__":
    app.run(debug=True)
```

```html
<!-- templates/todos.html -->
<!DOCTYPE html>
<html>
<body>
    <h1>待办清单</h1>
    <form method="post" action="/add">
        <input type="text" name="text" placeholder="输入待办事项">
        <button type="submit">添加</button>
    </form>
    <ul>
        {% for t in todos %}
        <li>{{ "✅" if t.done else "⬜" }} {{ t.text }}
            {% if not t.done %}<a href="/done/{{ t.id }}">完成</a>{% endif %}
        </li>
        {% endfor %}
    </ul>
</body>
</html>
```

### 总结

本篇介绍了 Flask 的路由、模板、表单处理和 JSON API，并用待办清单应用串联实战。下一篇将介绍**调试与性能优化**，为系列收官，敬请期待！
