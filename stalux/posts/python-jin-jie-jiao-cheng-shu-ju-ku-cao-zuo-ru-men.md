---
title: "Python进阶教程：数据库操作入门"
abbrlink: python-jin-jie-jiao-cheng-shu-ju-ku-cao-zuo-ru-men
date: "2026-08-17 21:53:56"
categories:
    - "Python"
tags: []
desc: "数据库（Database）是有组织存储数据的仓库，支持高效增删改查（CRUD）。SQLite：轻量级，单文件…"
---
#### 目录

-   [Python进阶教程：数据库操作入门](#Python_2)
-   -   [一、什么是数据库](#_6)
    -   [二、SQL 基础](#SQL__16)
    -   [三、SQLite：内置数据库](#SQLite_40)
    -   [四、参数化查询防注入](#_74)
    -   [五、ORM 简介](#ORM__96)
    -   [六、实战：学生成绩管理系统](#_132)
    -   [总结](#_180)

> 本文是 **Python 入门教程系列** 的第 7 篇。前面介绍了并发编程，本篇讲解 Python 中**数据库操作**，以 SQLite 和 MySQL 为例。

### 一、什么是数据库

数据库（Database）是**有组织存储数据的仓库**，支持高效增删改查（CRUD）。常用关系型数据库：

-   **SQLite**：轻量级，单文件，适合学习和小型应用
-   **MySQL / MariaDB**：最流行的开源数据库
-   **PostgreSQL**：功能强大的开源数据库

关系型数据库用 **SQL（结构化查询语言）** 操作数据。

### 二、SQL 基础

```sql
-- 建表
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    age INTEGER,
    email TEXT UNIQUE
);

-- 插入
INSERT INTO users (name, age, email) VALUES ("Alice", 20, "alice@example.com");

-- 查询
SELECT * FROM users WHERE age > 18;

-- 更新
UPDATE users SET age = 21 WHERE name = "Alice";

-- 删除
DELETE FROM users WHERE id = 1;
```

### 三、SQLite：内置数据库

Python 自带 sqlite3 模块，无需安装任何东西：

```python
import sqlite3

# 连接（文件不存在会自动创建）
conn = sqlite3.connect("demo.db")
cursor = conn.cursor()

# 建表
cursor.execute("""
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score REAL
)
""")

# 插入数据
cursor.execute("INSERT INTO students (name, score) VALUES (?, ?)", ("张三", 88.5))
cursor.execute("INSERT INTO students (name, score) VALUES (?, ?)", ("李四", 92.0))
conn.commit()

# 查询
cursor.execute("SELECT * FROM students")
for row in cursor.fetchall():
    print(row)

# 关闭连接
conn.close()
```

### 四、参数化查询防注入

**永远不要**用字符串拼接 SQL，应使用参数化查询防止 SQL 注入：

```python
import sqlite3

conn = sqlite3.connect("demo.db")
cursor = conn.cursor()

# 错误示范（有注入风险）
# name = input("输入姓名：")
# cursor.execute(f"SELECT * FROM students WHERE name = '{name}'")

# 正确做法：占位符 ?
name = "张三"
cursor.execute("SELECT * FROM students WHERE name = ?", (name,))
print(cursor.fetchall())

conn.close()
```

### 五、ORM 简介

直接写 SQL 较繁琐，实际项目常用 **ORM（对象关系映射）**，如 SQLAlchemy：

```python
# pip install sqlalchemy
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()

class Student(Base):
    __tablename__ = "students_orm"
    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False)
    score = Column(Float)

# 连接数据库
engine = create_engine("sqlite:///orm_demo.db")
Base.metadata.create_all(engine)

# 增删改查
Session = sessionmaker(bind=engine)
session = Session()

student = Student(name="王五", score=95.5)
session.add(student)
session.commit()

result = session.query(Student).filter(Student.score > 90).all()
for s in result:
    print(s.name, s.score)

session.close()
```

### 六、实战：学生成绩管理系统

综合运用所学知识，实现一个简单的学生成绩管理：

```python
import sqlite3

class ScoreManager:
    def __init__(self, db="scores.db"):
        self.conn = sqlite3.connect(db)
        self.cursor = self.conn.cursor()
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                score REAL
            )
        """)
        self.conn.commit()

    def add(self, name, score):
        self.cursor.execute("INSERT INTO students (name, score) VALUES (?, ?)", (name, score))
        self.conn.commit()
        print(f"添加成功：{name} {score}分")

    def list_all(self):
        self.cursor.execute("SELECT * FROM students")
        for row in self.cursor.fetchall():
            print(row)

    def top(self, n=3):
        self.cursor.execute("SELECT * FROM students ORDER BY score DESC LIMIT ?", (n,))
        for row in self.cursor.fetchall():
            print(f"高分榜：{row}")

    def close(self):
        self.conn.close()

# 使用示例
mgr = ScoreManager()
mgr.add("张三", 88.5)
mgr.add("李四", 92.0)
mgr.add("王五", 95.5)
mgr.list_all()
mgr.top(2)
mgr.close()
```

### 总结

本篇介绍了 SQL 基础、SQLite 内置数据库、参数化查询防注入、ORM 概念，并用学生成绩管理系统串联实战。下一篇将介绍**数据分析入门**（NumPy 与 Pandas），敬请期待！
