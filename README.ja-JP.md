[English](./README.md) | [中文](./README.zh-CN.md)

# S-Blog

> **免責事項**: 本システムのすべてのコードは AI によって生成されています。

**デモ:**
- [公式サイト](https://s-blog.me)
- [作者の個人サイト](https://s-blog.suzichen.me/)

React、Vite、TypeScript で構築されたモダンな静的ブログシステム。Rust ベースのビルドエンジンによりネイティブレベルのパフォーマンスを実現。

## 機能

- **技術スタック**: React 19, Vite, TypeScript, Rust (ビルドエンジン)
- **コンテンツ**: Markdown ベースの記事 (Hexo 互換 frontmatter)
- **機能**:
  - インスタント検索
  - アーカイブ (年/月)
  - タグとカテゴリー
  - 多言語サポート (英語、中国語、日本語)
  - EXIF メタデータ付きフォトアルバム
  - SEO (sitemap, RSS, Open Graph, JSON-LD)
- **スタイル**: Tailwind CSS によるクリーンなレスポンシブデザイン
- **パフォーマンス**: Rust 駆動のビルドパイプラインによる静的サイト生成

## クイックスタート

新しいブログを作成する最速の方法：

```bash
npm create s-blog@latest
```

> **ヒント:** `bunx create-s-blog my-blog` や `pnpm create s-blog my-blog` も使用可能です。

CLI がプロジェクトのセットアップをガイドします。初期化後：

```bash
cd my-blog
npm install
npm run dev
```

### 本番ビルド

```bash
npm run build
```

このコマンド一つで完全なパイプラインを処理します：
1. プリビルト App Shell のコピー
2. 記事マニフェスト生成と Markdown ファイルのコピー
3. アルバム写真の処理（サムネイル + EXIF 抽出）
4. SEO ページ、sitemap.xml、rss.xml、robots.txt の生成

出力は `dist/` 内の完全な静的サイトです。任意の静的ホスティングにデプロイできます。

### フレームワークの更新

```bash
npm update @s-blog/core @s-blog/engine
```

メンテナンスが必要なのはコンテンツファイル（`posts/`、`config.json`、`album.config.json`、`albums/`、`public/`）のみです。フレームワークの更新はパッケージマネージャーを通じて配信されます。

## アーキテクチャ

S-Blog は 3 つの npm パッケージとして公開されています：

| パッケージ | 用途 |
|-----------|------|
| `@s-blog/core` | プリビルト App Shell、UI コンポーネント、ルーティング、スタイル、JSON Schema |
| `@s-blog/engine` | Rust 駆動のビルドエンジン — Markdown パース、画像処理、SEO 生成、開発サーバー |
| `create-s-blog` | CLI スキャフォールディングツール — `npm create s-blog` |

プロジェクトにはコンテンツと設定のみを含みます：

```
my-blog/
├── posts/              # Markdown 記事
├── albums/             # フォトアルバム (オプション)
├── public/             # 静的アセット (logo, favicon)
├── config.json         # サイト設定
├── album.config.json   # アルバム設定
└── package.json
```

## 設定

### サイト設定 (`config.json`)

```json
{
  "title": "My Blog",
  "description": "A personal blog",
  "logo": "/logo.png",
  "favicon": "/favicon.ico",
  "siteUrl": "https://example.com",
  "author": "Your Name",
  "language": "en",
  "timezone": "Asia/Tokyo",
  "github": "https://github.com/username/repo"
}
```

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `title` | はい | サイトタイトル |
| `description` | はい | サイト説明 |
| `logo` | はい | ロゴ画像パス |
| `favicon` | はい | Favicon パス |
| `siteUrl` | いいえ | 本番 URL。SEO 機能（sitemap、RSS、Open Graph）に必要 |
| `author` | いいえ | 著者名。SEO メタデータに使用 |
| `language` | いいえ | デフォルト言語コード (`en`, `zh-CN`, `ja`)。i18n フォールバック動作に影響 |
| `timezone` | いいえ | IANA タイムゾーン（例：`Asia/Tokyo`）。CI でのビルド時に記事の日付を正確にする |
| `basePath` | いいえ | サブディレクトリデプロイパス（例：`/blog`）。デフォルトは `/` |
| `github` | いいえ | GitHub URL。設定するとページ右上に GitHub アイコンリンクを表示 |

### アルバム設定 (`album.config.json`)

```json
{
  "enabled": true,
  "albums": [
    { "dir": "travel-2024", "name": "2024 Travel", "cover": "cover.jpg" },
    { "dir": "日常", "cover": "best.jpg" }
  ]
}
```

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `enabled` | はい | アルバムモジュール全体のオン/オフ |
| `albums[].dir` | はい | `albums/` 下のディレクトリ名。英数字、ハイフン、アンダースコア、CJK 文字に対応 |
| `albums[].name` | いいえ | 表示名。デフォルトは `dir` |
| `albums[].cover` | いいえ | カバー写真のファイル名。デフォルトは最初の写真 |

## 記事の作成

`posts/` ディレクトリに Markdown ファイルを追加：

```yaml
---
title: 記事タイトル
date: 2024-01-01 12:00:00
tags: [Tech, React]
categories: [Programming]
preview: プレビュー用の短い説明。
---
```

### 多言語記事

ファイル名サフィックスを使って同じ記事の多言語版を公開：

```
posts/
├── About.md          # デフォルト（サイト言語または英語に対応）
├── About.zh-CN.md    # 中国語版
└── About.ja.md       # 日本語版
```

システムが利用可能な言語を自動検出し、ローカライズ版が利用できない場合はフォールバック通知を表示します。

## フォトアルバム

写真を `albums/{dirname}/` に配置。対応フォーマット：`.jpg`, `.jpeg`, `.png`, `.webp`, `.heic`

ビルドプロセスが自動的に：
- WebP サムネイル生成（最大 1080px）
- EXIF メタデータ抽出（カメラ、レンズ、絞り、シャッタースピード、ISO）
- JSON インデックスファイル生成

サムネイルはインクリメンタルに生成され、変更のない写真はスキップされます。

## SEO

`siteUrl` を設定すると、ビルド時に自動生成：

- **SEO HTML ページ** (`dist/post/*/index.html`) — Open Graph, Twitter Card, JSON-LD
- **sitemap.xml** — XML サイトマップ
- **rss.xml** — RSS 2.0 フィード
- **robots.txt** — クローラー指示

## コントリビューション

本プロジェクトは手動コーディングを厳格に禁止しています。すべてのコードは AI によって生成される必要があります。

## AI コントリビューター

- Gemini 3 Pro
- Gemini 3.1 Pro
- Claude Sonnet 4.5
- Claude Opus 4.5
- Claude Opus 4.6

## エージェントツール

- [Antigravity](https://antigravity.google/)
- [Kiro](https://kiro.dev/)
- [Gemini CLI](https://geminicli.com/)
- [Gemini CLI in Zed](https://zed.dev/acp/agent/gemini-cli)
- [Kiro CLI](https://kiro.dev/cli)
