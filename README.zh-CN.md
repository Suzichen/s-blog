[English](./README.md) | [日本語](./README.ja-JP.md)

# Suzic 的博客系统

> **声明**：此系统的所有代码均系 AI 生成。

[在线预览](https://s-blog.suzichen.me/)

这是一个基于 React、Vite 和 TypeScript 构建的现代化静态博客系统。

## 特性

- **技术栈**: React 19, Vite, TypeScript
- **内容管理**: 基于 Markdown 的文章编写（兼容 Hexo Frontmatter）
- **样式**: 整洁、响应式的设计
- **性能**: 文章数据静态生成，加载迅速

## 使用指南

### 前置要求

- Node.js (建议 v18+)
- Yarn 或 npm

### 安装依赖

```bash
yarn install
# 或
npm install
```

### 开发模式

启动开发服务器：

```bash
yarn dev
# 或
npm run dev
```

### 构建部署

构建生产环境代码：

```bash
yarn build
# 或
npm run build
```

## 配置

站点配置位于 `src/config.ts` 文件中，可以修改：

- **title**: 网站标题
- **description**: 网站描述
- **logo**: Logo 图片路径
- **favicon**: Favicon 路径
- **siteUrl**（可选）: 生产环境 URL（例如：`https://s-blog.suzichen.me`）
  - SEO 功能必需，如 sitemap.xml、RSS 订阅、Open Graph 标签
  - 如不设置，依赖 URL 的 SEO 功能将自动跳过
- **author**（可选）: 作者名称，用于 SEO 元数据
- **language**（可选）: 默认语言代码（如：`en`、`zh-CN`、`ja`）

### SEO 功能

当配置了 `siteUrl` 后，构建过程会自动生成：

- **SEO HTML 文件**（`dist/posts/*.html`）- 包含完整 meta 标签、Open Graph 标签、Twitter Cards 和 JSON-LD 结构化数据的搜索引擎友好页面
- **sitemap.xml** - 搜索引擎站点地图
- **rss.xml** - RSS 2.0 订阅源
- **robots.txt** - 网络爬虫指令

## 撰写文章

在 `src/posts` 目录下添加 Markdown 文件即可。
文件头部需要包含 Frontmatter 信息：

```yaml
---
title: 我的文章标题
date: 2024-01-01 12:00:00
tags: [技术, React]
categories: [编程]
preview: 文章预览内容...
---
```

## 如何贡献

本项目严禁手工编码，所有代码必须由 AI 生成。

## AI 贡献者

- Gemini 3 Pro
