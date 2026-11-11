---
title: 这个博客是怎么搭起来的
abbrlink: build-my-blog
date: "2026-11-11 21:20:00"
updated: "2026-11-11 21:20:00"
tags:
    - Astro
    - EdgeOne
    - Waline
categories:
    - 技术
desc: 从 Astro 主题到 EdgeOne Pages 部署，再到自建 Waline 评论，记录这个博客的完整搭建过程。
---

## 整体结构

这个博客是纯静态站点，没有自己的服务器：

```text
Markdown 文章
   ↓  Astro 构建
静态 HTML（dist/）
   ↓  Git push
EdgeOne Pages 自动构建并部署
   ↓  评论请求
Waline 服务（Vercel） → Neon Postgres
```

写作只需要新建 Markdown 文件，提交推送后自动上线。

## 一、用 Astro + Stalux 建站

主题是 [Stalux](https://github.com/xingwangzhe/stalux)，基于 Astro 构建，自带暗色玻璃风格、全文搜索、标签分类、RSS 和文章目录。

本地开发用 Bun：

```bash
git clone https://gitee.com/open-zynq/personal-blog.git
cd personal-blog
bun install
bun run dev
```

文章放在 `stalux/posts/`，站点信息在 `stalux/config/` 下的几个 YAML 文件里，改配置不用碰代码。

## 二、部署到 EdgeOne Pages

在 EdgeOne Makers 里导入 Gitee 仓库，构建配置：

| 项 | 值 |
| --- | --- |
| 框架预设 | Astro |
| 根目录 | `./` |
| 输出目录 | `dist` |
| 安装命令 | `bun install` |
| 构建命令 | `bun run styles:build && bunx --bun astro build` |

之后每次推送到 `main`，EdgeOne 都会自动重新构建，几十秒就能上线。

## 三、评论：Waline + Neon

静态站点自己存不了评论，所以单独部署了一个 Waline 服务：

1. Neon 建一个免费 Postgres 数据库，导入官方 `waline.pgsql` 建表
2. Vercel 用 Waline 的 `example` 模板建项目，配置数据库环境变量
3. 博客的 `comment.yml` 填入服务地址，开启评论

```yaml
id: comment
enabled: true
waline:
    serverURL: https://your-waline.vercel.app
    lang: zh-CN
    login: "enable"
```

## 四、日常写作

新增文章只需要一个 Markdown 文件：

```markdown
---
title: 文章标题
abbrlink: my-post
date: "2026-11-11 21:00:00"
tags: [标签]
categories: [分类]
desc: 一句话摘要
---

正文……
```

日期必须补零，否则时区解析会出问题。写完提交推送即可，构建、搜索索引、RSS 都会自动更新。

## 小结

整套东西全部在免费额度内：EdgeOne Pages 免费版、Vercel Hobby、Neon 免费数据库。成本是零，维护成本也很低——大部分时间只需要写 Markdown。
