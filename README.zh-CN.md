# Suzic 的博客系统

> **声明**：此系统的所有代码均系 AI 生成。

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

- 网站标题
- 描述
- Logo 和 Favicon 路径

## 撰写文章

在 `src/posts` 目录下添加 Markdown 文件即可。
文件头部需要包含 Frontmatter 信息：

```yaml
---
title: 我的文章标题
date: 2024-01-01 12:00:00
tags: [技术, React]
categories: [编程]
---
```
