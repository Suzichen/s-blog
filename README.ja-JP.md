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

## クイックスタート

新しいブログを作成する最速の方法：

```bash
npm create s-blog@latest
```

CLI がプロジェクトの設定をガイドします。初期化が完了したら：

```bash
cd my-blog
npm run dev
```

### フレームワークの更新

最新の機能とバグ修正を取得：

```bash
npm update @s-blog/core
```

ユーザーはコンテンツファイル（`src/posts/`、`src/config.ts`、`src/album.config.ts`、`public/albums/`）のみ管理します。フレームワークの更新は `@s-blog/core` パッケージを通じて配信されます。

### 手動インストール（代替方法）

手動で設定したい場合：

```bash
git clone https://github.com/Suzichen/s-blog.git
cd s-blog
npm install
npm run dev
```

### ビルド

本番環境用にビルドします：

```bash
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

## アルバムモジュール

ブログにはオプションのアルバム（フォトギャラリー）モジュールが含まれており、写真をアルバムごとに整理して表示できます。

### 設定

`src/album.config.ts` を編集してアルバムを管理します：

```typescript
export const albumConfig: AlbumConfig = {
  enabled: true,
  albums: [
    { dir: 'travel-2024', name: '2024 旅行', cover: 'cover.jpg' },
    { dir: '春', cover: 'sakura.jpg' }, // 日本語ディレクトリ名も可、name 未設定時はディレクトリ名を表示
  ],
};
```

- **enabled**：アルバムモジュール全体のオン/オフ切り替え
- **dir**：`public/albums/` 配下のディレクトリ名（文字・数字・ハイフン・アンダースコア；日本語等の Unicode 文字に対応；スペースやパス区切り文字は不可）
- **name**（オプション）：アルバムの表示名
- **cover**（オプション）：カバー写真のファイル名

### 写真の追加

写真を `public/albums/{dirname}/` に配置します：

```
public/albums/travel-2024/
  photo1.jpg
  photo2.png
  cover.jpg
```

対応フォーマット：`.jpg`、`.jpeg`、`.png`、`.webp`、`.heic`

### アルバムデータのビルド

```bash
npm run build:albums
```

このコマンドは以下を実行します：
1. 設定済みのアルバムディレクトリをスキャン
2. `thumbs/` サブディレクトリに WebP サムネイルを生成（長辺最大 1080px）
3. EXIF メタデータを抽出（カメラ機種、焦点距離、絞り、シャッタースピード、ISO）
4. `public/generated/` に JSON インデックスファイルを出力

サムネイルはインクリメンタルビルドに対応 — 変更のない写真はスキップされます。

## 貢献方法

このプロジェクトでは手動でのコーディングは禁止されています。すべてのコードは AI によって生成される必要があります。

## AI コントリビューター

- Gemini 3 Pro
- Gemini 3.1 Pro
- Claude Sonnet 4.5
- Claude Opus 4.6
