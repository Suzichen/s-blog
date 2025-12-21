[English](./README.md) | [中文](./README.zh-CN.md)

# Suzic ブログシステム

> **免責事項**：このシステムのすべてのコードは AI によって生成されました。

[デモ](https://s-blog.suzichen.me/)

React、Vite、TypeScript で構築されたモダンな静的ブログシステムです。

## 特徴

- **技術スタック**: React 19, Vite, TypeScript
- **コンテンツ管理**: Markdown ベースの記事作成（Hexo 互換の Frontmatter）
- **機能**:
  - インスタント検索
  - アーカイブ（年/月）
  - タグとカテゴリー
  - 多言語対応
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

- **title**: サイトタイトル
- **description**: サイト説明文
- **logo**: ロゴ画像のパス
- **favicon**: ファビコンのパス
- **siteUrl**（オプション）: 本番環境の URL（例：`https://s-blog.suzichen.me`）
  - SEO 機能に必要（sitemap.xml、RSS フィード、Open Graph タグなど）
  - 設定しない場合、URL 依存の SEO 機能はスキップされます
- **author**（オプション）: SEO メタデータ用の著者名
- **language**（オプション）: デフォルト言語コード（例：`en`、`zh-CN`、`ja`）

### SEO 機能

`siteUrl` を設定すると、ビルドプロセスで自動生成されます：

- **SEO HTML ファイル**（`dist/post/*.html`）- メタタグ、Open Graph タグ、Twitter Cards、JSON-LD 構造化データを含む検索エンジンフレンドリーなページ
- **sitemap.xml** - 検索エンジン用の XML サイトマップ
- **rss.xml** - RSS 2.0 フィード
- **robots.txt** - Web クローラー向けの指示

## 記事の執筆

`src/posts` ディレクトリに Markdown ファイルを追加してください。
ファイルの先頭には Frontmatter を含める必要があります：

```yaml
---
title: 記事のタイトル
date: 2024-01-01 12:00:00
tags: [Tech, React]
categories: [プログラミング]
preview: 記事のプレビュー...
---
```

## 貢献方法

このプロジェクトでは手動でのコーディングは禁止されています。すべてのコードは AI によって生成される必要があります。

## AI コントリビューター

- Gemini 3 Pro
- Claude Sonnet 4.5
