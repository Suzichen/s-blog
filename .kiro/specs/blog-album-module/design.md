# 设计文档：相册模块（blog-album-module）

## 概述

相册模块为现有 React + Vite + TypeScript 静态博客系统新增照片展示能力。整体设计遵循「零后端、纯静态」原则：构建时由 Node.js 脚本预处理照片（生成 WebP 缩略图、解析 EXIF、输出 JSON 索引），运行时前端直接读取静态 JSON 文件渲染页面，无需任何服务端逻辑，可部署到任意静态托管环境。

模块由三个层次组成：

1. **配置层**：`src/album.config.ts` — 功能开关与相册列表的唯一数据源
2. **构建层**：`scripts/generate-albums-data.ts` — 照片扫描、缩略图生成、EXIF 解析、JSON 输出
3. **前端层**：相册列表页、相册详情页、PhotoViewer 蒙层组件

设计风格定位为「高端、沉浸式」，与现有博客的简洁美学保持一致，同时在照片展示场景下提供更丰富的视觉体验。

---

## 架构

### 整体数据流

```mermaid
flowchart LR
    subgraph 构建时
        A[src/album.config.ts] --> B[generate-albums-data.ts]
        C[public/albums/{dirname}/*.jpg...] --> B
        B --> D[public/albums/{dirname}/thumbs/*.webp]
        B --> E[public/generated/albums-index.json]
        B --> F[public/generated/album-{dirname}.json]
    end

    subgraph 运行时
        E --> G[Albums 列表页 /albums]
        F --> H[Album 详情页 /albums/:dirname]
        H --> I[PhotoViewer 蒙层]
    end
```

### 目录结构（新增部分）

```
public/
  albums/
    {dirname}/          ← 原图（由作者手动放置）
      photo1.jpg
      photo2.jpg
      thumbs/           ← 缩略图（由构建脚本生成）
        photo1.webp
        photo2.webp
  generated/
    albums-index.json   ← 相册摘要列表
    album-{dirname}.json ← 单相册完整数据

src/
  album.config.ts       ← 相册配置（新增）
  types/
    album.ts            ← 相册相关 TypeScript 类型（新增）
  pages/
    Albums.tsx          ← 相册列表页（新增）
    AlbumDetail.tsx     ← 相册详情页（新增）
  components/
    PhotoViewer.tsx     ← 照片查看器蒙层（新增）
  hooks/
    useAlbums.ts        ← 加载 albums-index.json 的 hook（新增）
    useAlbum.ts         ← 加载 album-{dirname}.json 的 hook（新增）

scripts/
  generate-albums-data.ts ← 构建脚本（新增）
```

### 与现有系统的集成点

| 集成点 | 现有文件 | 变更方式 |
|--------|----------|----------|
| 路由注册 | `src/App.tsx` | 新增两条 `<Route>` |
| 导航栏链接 | `src/components/Layout.tsx` | 新增「相册」`<Link>`，条件渲染 |
| i18n 翻译 | `src/i18n.ts` | 新增 `nav.albums` 键 |
| 构建脚本 | `package.json` | 新增 `build:albums` 脚本 |

---

## 组件与接口

### 配置文件：`src/album.config.ts`

```typescript
export interface AlbumEntry {
  dir: string;       // 相对于 public/albums/ 的目录名，即 dirname
  name?: string;     // 可选显示名称
  cover?: string;    // 可选封面文件名
}

export interface AlbumConfig {
  enabled: boolean;
  albums: AlbumEntry[];
}

export const albumConfig: AlbumConfig = {
  enabled: true,
  albums: [
    // { dir: 'travel-2024', name: '2024 旅行', cover: 'cover.jpg' }
  ],
};
```

**Dirname 合法性规则**：仅允许小写字母、数字、连字符（`[a-z0-9-]+`），不允许空格或其他特殊字符。

---

### 构建脚本：`scripts/generate-albums-data.ts`

**主要职责**：

1. 读取 `albumConfig`
2. 若 `enabled=false`，输出空 `albums-index.json`，退出
3. 遍历 `albums` 数组，对每个条目：
   - 验证 dirname 合法性（正则 `^[a-z0-9-]+$`）
   - 验证目录存在性
   - 扫描照片文件（`.jpg/.jpeg/.png/.webp/.heic`，仅直接子文件）
   - 增量生成 WebP 缩略图（长边 ≤ 1080px）
   - 解析 EXIF 数据
   - 构建 `AlbumDetailJSON` 对象
4. 汇总生成 `albums-index.json`
5. 为每个相册生成 `album-{dirname}.json`

**依赖库**：
- `sharp`：图像处理与缩略图生成（需新增依赖）
- `exifr`：EXIF 数据解析（需新增依赖）
- Node.js 内置：`fs`、`path`、`crypto`（用于文件变更检测）

**增量构建策略**：比较源文件的 `mtime`（最后修改时间）与目标缩略图文件的 `mtime`，若目标文件存在且 `mtime >= 源文件 mtime`，则跳过生成。

**错误处理策略**：
- dirname 非法 → `console.error` + 跳过，继续处理其他条目
- 目录不存在 → `console.warn` + 跳过，继续处理其他条目
- 单张照片缩略图生成失败 → `console.error` + 跳过该照片，继续处理其他照片
- EXIF 解析失败 → 所有字段设为 `null`，不中断流程

---

### 类型定义：`src/types/album.ts`

```typescript
export interface ExifData {
  cameraMake: string | null;
  cameraModel: string | null;
  focalLength: string | null;
  aperture: string | null;
  shutterSpeed: string | null;
  iso: string | null;
}

export interface PhotoItem {
  filename: string;
  thumbnailUrl: string;   // /albums/{dirname}/thumbs/{filename}.webp
  originalUrl: string;    // /albums/{dirname}/{filename}
  exif: ExifData;
}

export interface AlbumSummary {
  dirname: string;
  name: string;
  cover: string | null;   // 封面缩略图相对 URL，未配置时为 null
  photoCount: number;
}

export interface AlbumDetail {
  dirname: string;
  name: string;
  photos: PhotoItem[];
}
```

---

### 页面组件：`src/pages/Albums.tsx`

**职责**：相册列表页，路由 `/albums`

**行为**：
- 挂载时调用 `useAlbums()` hook 加载 `albums-index.json`
- 加载中：渲染 skeleton 占位卡片（3×2 网格）
- 加载失败：渲染错误提示
- 加载成功：渲染相册卡片网格

**布局**：
- 移动端（< 768px）：2 列网格
- 桌面端（≥ 768px）：3 列或更多列网格

**相册卡片内容**：封面图（`<img>` 懒加载）、相册名称、照片数量角标

---

### 页面组件：`src/pages/AlbumDetail.tsx`

**职责**：相册详情页，路由 `/albums/:dirname`

**行为**：
- 从路由参数获取 `dirname`
- 挂载时调用 `useAlbum(dirname)` hook 加载 `album-{dirname}.json`
- 加载中：渲染 skeleton 占位
- 加载失败：渲染错误提示
- 加载成功：渲染照片缩略图网格
- 点击缩略图：打开 `PhotoViewer`，传入照片列表和当前索引

**布局**：
- 移动端（< 768px）：2 列网格
- 桌面端（≥ 768px）：3 列或更多列网格

---

### 组件：`src/components/PhotoViewer.tsx`

**Props 接口**：

```typescript
interface PhotoViewerProps {
  photos: PhotoItem[];
  initialIndex: number;
  onClose: () => void;
}
```

**内部状态**：
- `currentIndex: number` — 当前显示的照片索引
- `imageLoaded: boolean` — 原图是否已加载完成

**行为**：
- 渲染全屏蒙层（`position: fixed, inset: 0`）
- 渐进式加载：先显示缩略图，原图加载完成后切换
- 键盘事件监听（`useEffect` 挂载/卸载）：`←` 上一张、`→` 下一张、`Esc` 关闭
- 打开时：`document.body.style.overflow = 'hidden'`
- 关闭时：`document.body.style.overflow = ''`
- 点击蒙层背景（非图片区域）关闭
- EXIF 展示：仅渲染非 `null` 字段

**EXIF 字段显示格式**：
- `cameraMake` + `cameraModel` 合并显示（如 `Sony ILCE-7M4`）
- `focalLength`：`{value}mm`
- `aperture`：`f/{value}`
- `shutterSpeed`：`{value}s`
- `iso`：`ISO {value}`

---

### 自定义 Hook：`src/hooks/useAlbums.ts`

```typescript
interface UseAlbumsResult {
  albums: AlbumSummary[];
  loading: boolean;
  error: string | null;
}

function useAlbums(): UseAlbumsResult
```

内部使用 `fetch('/generated/albums-index.json')` 加载数据，管理 `loading`/`error` 状态。

---

### 自定义 Hook：`src/hooks/useAlbum.ts`

```typescript
interface UseAlbumResult {
  album: AlbumDetail | null;
  loading: boolean;
  error: string | null;
}

function useAlbum(dirname: string): UseAlbumResult
```

内部使用 `fetch(\`/generated/album-\${dirname}.json\`)` 加载数据。

---

### 路由与导航变更

**`src/App.tsx` 新增路由**：

```tsx
import Albums from './pages/Albums';
import AlbumDetail from './pages/AlbumDetail';
import { albumConfig } from './album.config';

// 在 Routes 内新增：
<Route path="/albums" element={albumConfig.enabled ? <Albums /> : <Navigate to="/" replace />} />
<Route path="/albums/:dirname" element={albumConfig.enabled ? <AlbumDetail /> : <Navigate to="/" replace />} />
```

**`src/components/Layout.tsx` 导航栏变更**：

```tsx
import { albumConfig } from '../album.config';

// 在 nav 内条件渲染：
{albumConfig.enabled && (
  <Link to="/albums" className="text-secondary font-medium hover:text-primary transition-colors">
    {t('nav.albums')}
  </Link>
)}
```

**`src/i18n.ts` 新增翻译键**：

```typescript
// en
"nav": { "albums": "Albums" }

// zh
"nav": { "albums": "相册" }

// ja
"nav": { "albums": "アルバム" }
```

---

## 数据模型

### `public/generated/albums-index.json`

```json
[
  {
    "dirname": "travel-2024",
    "name": "2024 旅行",
    "cover": "/albums/travel-2024/thumbs/cover.webp",
    "photoCount": 42
  }
]
```

- `cover` 为封面缩略图的相对 URL；若未配置 `cover` 字段，则取第一张照片的缩略图 URL；若相册为空，则为 `null`

### `public/generated/album-{dirname}.json`

```json
{
  "dirname": "travel-2024",
  "name": "2024 旅行",
  "photos": [
    {
      "filename": "DSC_0001.jpg",
      "thumbnailUrl": "/albums/travel-2024/thumbs/DSC_0001.webp",
      "originalUrl": "/albums/travel-2024/DSC_0001.jpg",
      "exif": {
        "cameraMake": "Sony",
        "cameraModel": "ILCE-7M4",
        "focalLength": "35",
        "aperture": "1.8",
        "shutterSpeed": "1/250",
        "iso": "400"
      }
    }
  ]
}
```

- EXIF 字段均为字符串或 `null`
- `thumbnailUrl` 格式：`/albums/{dirname}/thumbs/{basename}.webp`
- `originalUrl` 格式：`/albums/{dirname}/{filename}`

### 缩略图生成规则

| 源图尺寸 | 缩略图尺寸 |
|----------|------------|
| 4000×3000（横向） | 1080×810 |
| 3000×4000（纵向） | 810×1080 |
| 1000×800（已小于限制） | 1000×800（不放大） |
| 1080×1080（正方形） | 1080×1080 |

规则：`sharp().resize(1080, 1080, { fit: 'inside', withoutEnlargement: true }).webp()`

---

## 正确性属性

*属性（Property）是在系统所有有效执行中都应成立的特征或行为——本质上是对系统应做什么的形式化陈述。属性是人类可读规范与机器可验证正确性保证之间的桥梁。*

本模块中，构建脚本的数据转换逻辑（文件名过滤、缩略图尺寸约束、EXIF 字段映射、JSON 序列化）以及前端的渲染逻辑（EXIF 条件渲染、键盘导航索引计算）均具有明确的输入/输出关系，适合属性测试。

---

### 属性 1：Dirname 非法字符验证的完备性

*对于任意* 包含空格或非 `[a-z0-9-]` 字符的 dirname 字符串，构建脚本的 dirname 验证函数 SHALL 返回「非法」结果，不允许任何此类 dirname 通过验证。

**验证：需求 1.6**

---

### 属性 2：照片文件扩展名过滤的正确性

*对于任意* 文件名列表，照片识别函数 SHALL 仅将扩展名为 `.jpg`、`.jpeg`、`.png`、`.webp`、`.heic`（大小写不敏感）的文件识别为照片，其余文件均被过滤掉。

**验证：需求 2.3**

---

### 属性 3：缩略图长边约束

*对于任意* 尺寸的源图片（宽度和高度均为正整数），生成的缩略图 SHALL 满足：长边（`max(width, height)`）不超过 1080px，且短边按原始宽高比等比缩放（不放大小于 1080px 的图片）。

**验证：需求 2.6**

---

### 属性 4：EXIF 字段完整映射

*对于任意* 包含部分或全部 EXIF 字段的照片元数据对象，EXIF 解析函数 SHALL 输出包含 `cameraMake`、`cameraModel`、`focalLength`、`aperture`、`shutterSpeed`、`iso` 六个字段的对象，每个字段的值为对应 EXIF 值的字符串表示，或在原始数据中不存在时为 `null`。

**验证：需求 3.2、3.3**

---

### 属性 5：JSON 往返等价性

*对于任意* 有效的 `AlbumDetail` 对象，将其序列化为 JSON 字符串后再反序列化，所得对象 SHALL 与原始对象在结构和值上完全等价（字段名、字段值、嵌套结构均一致）。

**验证：需求 4.6**

---

### 属性 6：相册摘要信息正确性

*对于任意* 相册配置条目（包含 `dir`、可选 `name`、可选 `cover`）和对应的照片文件列表，构建脚本生成的 `AlbumSummary` 对象 SHALL 满足：`dirname` 等于 `dir` 的文件夹名，`name` 等于配置的 `name` 或在未配置时等于 `dirname`，`photoCount` 等于识别到的照片文件数量。

**验证：需求 4.2**

---

### 属性 7：PhotoViewer EXIF 条件渲染

*对于任意* `ExifData` 对象（其中任意字段可为 `null` 或非 `null` 字符串），PhotoViewer 组件 SHALL 仅渲染值为非 `null` 的字段，不渲染任何值为 `null` 的字段。

**验证：需求 8.4**

---

### 属性 8：键盘导航索引正确性

*对于任意* 长度为 N（N ≥ 2）的照片列表和当前索引 i（0 ≤ i < N），PhotoViewer 的键盘导航逻辑 SHALL 满足：
- 当 i > 0 时，按左方向键后当前索引变为 i - 1
- 当 i < N - 1 时，按右方向键后当前索引变为 i + 1
- 当 i = 0 时，按左方向键不改变索引（边界保护）
- 当 i = N - 1 时，按右方向键不改变索引（边界保护）

**验证：需求 8.8、8.9**

---

### 属性 9：i18n 相册链接翻译完备性

*对于任意* 支持的语言代码（`en`、`zh`、`ja`），i18n 系统 SHALL 为 `nav.albums` 键返回非空的翻译字符串，不返回键名本身或空字符串。

**验证：需求 5.5**

---

## 错误处理

### 构建脚本错误处理

| 错误场景 | 处理方式 | 退出码 |
|----------|----------|--------|
| `albumConfig.enabled = false` | 输出空 `albums-index.json`，正常退出 | 0 |
| dirname 包含非法字符 | `console.error` + 跳过该条目 | 0 |
| 相册目录不存在 | `console.warn` + 跳过该条目 | 0 |
| 单张照片缩略图生成失败 | `console.error` + 跳过该照片 | 0 |
| EXIF 解析失败 | 所有字段设为 `null`，继续 | 0 |
| `public/generated/` 目录不存在 | 自动创建（`fs.mkdirSync({ recursive: true })`） | — |

所有错误均不中断整体构建流程，脚本始终以退出码 0 正常退出（除非发生无法恢复的系统级错误）。

### 前端错误处理

| 错误场景 | 处理方式 |
|----------|----------|
| `albums-index.json` 加载失败 | 展示错误提示文本，不崩溃 |
| `album-{dirname}.json` 加载失败 | 展示错误提示文本，不崩溃 |
| dirname 不存在（404） | 展示错误提示文本 |
| 图片加载失败 | 显示占位图或降级处理 |
| `albumConfig.enabled = false` 时访问相册路由 | 重定向至首页 `/` |

---

## 测试策略

### 双轨测试方法

本模块采用「单元/属性测试 + 集成测试」双轨策略：

- **属性测试**：验证纯函数逻辑的通用正确性（文件名过滤、尺寸计算、EXIF 映射、JSON 序列化、导航索引计算、EXIF 渲染过滤）
- **单元测试（示例）**：验证特定场景的具体行为（enabled=false、目录不存在、加载状态、错误状态、键盘关闭等）
- **集成测试**：验证构建脚本端到端流程（实际文件系统操作、缩略图生成、JSON 文件输出）

### 属性测试配置

**推荐库**：[fast-check](https://github.com/dubzzz/fast-check)（TypeScript 原生支持，与 Vitest 集成良好）

每个属性测试最少运行 **100 次迭代**。

标注格式：`// Feature: blog-album-module, Property {N}: {property_text}`

#### 属性测试列表

| 属性 | 测试文件 | 测试目标 |
|------|----------|----------|
| 属性 1 | `scripts/__tests__/generate-albums-data.test.ts` | `isValidDirname(s)` 函数 |
| 属性 2 | `scripts/__tests__/generate-albums-data.test.ts` | `isPhotoFile(filename)` 函数 |
| 属性 3 | `scripts/__tests__/generate-albums-data.test.ts` | `calculateThumbnailSize(w, h)` 函数 |
| 属性 4 | `scripts/__tests__/generate-albums-data.test.ts` | `parseExif(rawExif)` 函数 |
| 属性 5 | `scripts/__tests__/generate-albums-data.test.ts` | `AlbumDetail` 序列化/反序列化 |
| 属性 6 | `scripts/__tests__/generate-albums-data.test.ts` | `buildAlbumSummary(entry, photos)` 函数 |
| 属性 7 | `src/components/__tests__/PhotoViewer.test.tsx` | `PhotoViewer` EXIF 渲染逻辑 |
| 属性 8 | `src/components/__tests__/PhotoViewer.test.tsx` | `navigatePhoto(index, direction, total)` 函数 |
| 属性 9 | `src/i18n.test.ts` | i18n `nav.albums` 翻译键 |

### 单元测试列表（示例）

| 测试场景 | 测试文件 |
|----------|----------|
| `enabled=false` 输出空数组 | `scripts/__tests__/generate-albums-data.test.ts` |
| 目录不存在时输出警告并跳过 | `scripts/__tests__/generate-albums-data.test.ts` |
| 增量构建跳过未修改文件 | `scripts/__tests__/generate-albums-data.test.ts` |
| Albums 页加载中显示 skeleton | `src/pages/__tests__/Albums.test.tsx` |
| Albums 页加载失败显示错误 | `src/pages/__tests__/Albums.test.tsx` |
| AlbumDetail 页点击缩略图打开 PhotoViewer | `src/pages/__tests__/AlbumDetail.test.tsx` |
| PhotoViewer Esc 键关闭 | `src/components/__tests__/PhotoViewer.test.tsx` |
| PhotoViewer 点击背景关闭 | `src/components/__tests__/PhotoViewer.test.tsx` |
| PhotoViewer 打开时 body overflow=hidden | `src/components/__tests__/PhotoViewer.test.tsx` |
| `enabled=false` 时路由重定向至首页 | `src/App.test.tsx` |

### 集成测试列表

| 测试场景 | 测试文件 |
|----------|----------|
| 正常流程：扫描目录、生成缩略图、输出 JSON | `scripts/__tests__/integration.test.ts` |
| EXIF 解析：含 EXIF 照片的字段提取 | `scripts/__tests__/integration.test.ts` |
| JSON 文件结构验证（T2.1、T2.2） | `scripts/__tests__/integration.test.ts` |

### 测试运行命令

```bash
# 单次运行（CI 环境）
npx vitest run

# 监听模式（开发环境）
npx vitest
```
