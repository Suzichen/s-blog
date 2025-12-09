# Suzic ブログシステム

> **免責事項**：このシステムのすべてのコードは AI によって生成されました。

React、Vite、TypeScript で構築されたモダンな静的ブログシステムです。

## 特徴

- **技術スタック**: React 19, Vite, TypeScript
- **コンテンツ管理**: Markdown ベースの記事作成（Hexo 互換の Frontmatter）
- **デザイン**: シンプルでレスポンシブなデザイン
- **パフォーマンス**: 記事データの静的生成による高速な読み込み

## 使い方

### 前提条件

- Node.js (v18 以上推奨)
- Yarn または npm

### インストール

```bash
yarn install
# または
npm install
```

### 開発モード

開発サーバーを起動します：

```bash
yarn dev
# または
npm run dev
```

### ビルド

本番環境用にビルドします：

```bash
yarn build
# または
npm run build
```

## 設定

サイトの設定は `src/config.ts` で変更できます：

- サイトタイトル
- 説明文
- ロゴとファビコンのパス

## 記事の執筆

`src/posts` ディレクトリに Markdown ファイルを追加してください。
ファイルの先頭には Frontmatter を含める必要があります：

```yaml
---
title: 記事のタイトル
date: 2024-01-01 12:00:00
tags: [Tech, React]
categories: [プログラミング]
---
```
