[English](./README.md) | [日本語](./README.ja-JP.md)

# S-Blog

> **声明**：此系统的所有代码均系 AI 生成。

**演示站点:**
- [官方站点](https://s-blog.me)
- [作者个人站点](https://s-blog.suzichen.me/)

这是一个基于 React、Vite 和 TypeScript 构建的现代化静态博客系统。

## 特性

- **技术栈**: React 19, Vite, TypeScript
- **内容管理**: 基于 Markdown 的文章编写（兼容 Hexo Frontmatter）
- **特性**:
  - 即时搜索
  - 文章归档（年/月）
  - 标签与分类
  - 多语言支持
- **样式**: 整洁、响应式的设计
- **性能**: 文章数据静态生成，加载迅速

## 快速开始

创建新博客的最快方式：

```bash
npm create s-blog@latest
```

> **提示：** 如果你使用 bun 环境，请直接使用 `bunx create-s-blog my-blog`，后续在命令中用 `bun` 替代 `npm` 即可。

CLI 会引导你完成项目设置。初始化完成后：

```bash
cd my-blog
npm run dev
```

### 更新框架

获取最新功能和修复：

```bash
npm update @s-blog/core
```

你只需维护内容层文件（`src/posts/`、`src/config.ts`、`src/album.config.ts`、`public/albums/`），框架更新通过 `@s-blog/core` 包自动交付。

### 手动安装（备选方案）

如果你更喜欢手动设置：

```bash
git clone https://github.com/Suzichen/s-blog.git
cd s-blog
npm install
npm run dev
```

### 构建部署

构建生产环境代码：

```bash
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
- **timezone**（可选）: IANA 时区标识符（如：`Asia/Shanghai`、`Asia/Tokyo`）。如果你的博客文章是在特定时区编写的，而你使用 CI（如 GitHub Actions，默认为 UTC）构建网站，此配置可以确保文章日期在构建时被正确处理，避免日期因时区差异而偏差一天。

### SEO 功能

当配置了 `siteUrl` 后，构建过程会自动生成：

- **SEO HTML 文件**（`dist/post/*.html`）- 包含完整 meta 标签、Open Graph 标签、Twitter Cards 和 JSON-LD 结构化数据的搜索引擎友好页面
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
# date: 2026-01-01 12:00:00+00:00 # 允许绕过全局配置并单独声明时区。
tags: [技术, React]
categories: [编程]
preview: 文章预览内容...
---
```

## 相册模块

博客包含一个可选的相册模块，可以按相册组织和展示照片。

### 配置

编辑 `src/album.config.ts` 来管理相册：

```typescript
export const albumConfig: AlbumConfig = {
  enabled: true,
  albums: [
    { dir: 'travel-2024', name: '2024 旅行', cover: 'cover.jpg' },
    { dir: '做饭', cover: 'braised-pork.jpg' }, // 支持中文目录名，未设置 name 时显示目录名
  ],
};
```

- **enabled**：开启/关闭整个相册模块
- **dir**：`public/albums/` 下的目录名（支持字母、数字、连字符、下划线；支持中文等 Unicode 字符；不允许空格或路径分隔符）
- **name**（可选）：相册显示名称
- **cover**（可选）：封面照片文件名

### 添加照片

将照片放入 `public/albums/{dirname}/` 目录：

```
public/albums/travel-2024/
  photo1.jpg
  photo2.png
  cover.jpg
```

支持格式：`.jpg`、`.jpeg`、`.png`、`.webp`、`.heic`

### 构建相册数据

```bash
npm run build:albums
```

此命令会：
1. 扫描已配置的相册目录
2. 在 `thumbs/` 子目录中生成 WebP 缩略图（长边不超过 1080px）
3. 提取 EXIF 元数据（相机型号、焦距、光圈、快门速度、ISO）
4. 在 `public/generated/` 中输出 JSON 索引文件

缩略图支持增量构建——未修改的照片会自动跳过。

## 如何贡献

本项目严禁手工编码，所有代码必须由 AI 生成。

## AI 贡献者

- Gemini 3 Pro
- Gemini 3.1 Pro
- Claude Sonnet 4.5
- Claude Opus 4.6
