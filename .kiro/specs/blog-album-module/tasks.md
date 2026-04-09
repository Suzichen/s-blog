# 实现计划：相册模块（blog-album-module）

## 概述

按照「配置层 → 构建层 → 类型与 Hook → 前端页面 → 集成接入 → 文档」的顺序逐步实现相册模块，每一步均可独立验证，最终将所有部分串联为完整功能。

## 任务

- [ ] 1. 安装依赖并配置构建环境
  - 在 `package.json` 中新增 `sharp`、`exifr` 为生产依赖，`vitest`、`fast-check`、`@vitest/coverage-v8` 为开发依赖
  - 在 `package.json` 的 `scripts` 中新增 `"build:albums": "npx tsx scripts/generate-albums-data.ts"` 和 `"test": "vitest run"`
  - 新增 `vitest.config.ts`，配置测试环境（`jsdom`）及测试文件匹配规则
  - _需求：2.1_

- [ ] 2. 创建配置文件与类型定义
  - [ ] 2.1 创建 `src/album.config.ts`，导出 `AlbumEntry`、`AlbumConfig` 接口及 `albumConfig` 对象（`enabled: true`，`albums: []`）
    - _需求：1.1、1.2、1.3_
  - [ ] 2.2 创建 `src/types/album.ts`，定义 `ExifData`、`PhotoItem`、`AlbumSummary`、`AlbumDetail` 四个接口
    - _需求：3.2、4.2、4.4_

- [ ] 3. 实现构建脚本纯函数
  - [ ] 3.1 在 `scripts/generate-albums-data.ts` 中实现以下纯函数并导出：
    - `isValidDirname(s: string): boolean` — 正则 `^[a-z0-9-]+$` 验证
    - `isPhotoFile(filename: string): boolean` — 扩展名大小写不敏感匹配
    - `calculateThumbnailSize(w: number, h: number): { width: number; height: number }` — 长边 ≤ 1080px，等比缩放，不放大
    - `parseExif(rawExif: Record<string, unknown> | null): ExifData` — 映射六个字段，缺失时为 `null`
    - `buildAlbumSummary(entry: AlbumEntry, photos: string[], thumbsDir: string): AlbumSummary` — 构建摘要对象
    - _需求：1.6、2.3、2.6、3.2、3.3、4.2_
  - [ ]* 3.2 为属性 1 编写属性测试：`isValidDirname` 对任意含非法字符字符串返回 `false`
    - **属性 1：Dirname 非法字符验证的完备性**
    - **验证：需求 1.6**
    - 测试文件：`scripts/__tests__/generate-albums-data.test.ts`
  - [ ]* 3.3 为属性 2 编写属性测试：`isPhotoFile` 仅识别合法扩展名
    - **属性 2：照片文件扩展名过滤的正确性**
    - **验证：需求 2.3**
    - 测试文件：`scripts/__tests__/generate-albums-data.test.ts`
  - [ ]* 3.4 为属性 3 编写属性测试：`calculateThumbnailSize` 长边约束与等比缩放
    - **属性 3：缩略图长边约束**
    - **验证：需求 2.6**
    - 测试文件：`scripts/__tests__/generate-albums-data.test.ts`
  - [ ]* 3.5 为属性 4 编写属性测试：`parseExif` 输出始终包含六个字段
    - **属性 4：EXIF 字段完整映射**
    - **验证：需求 3.2、3.3**
    - 测试文件：`scripts/__tests__/generate-albums-data.test.ts`
  - [ ]* 3.6 为属性 5 编写属性测试：`AlbumDetail` JSON 往返等价性
    - **属性 5：JSON 往返等价性**
    - **验证：需求 4.6**
    - 测试文件：`scripts/__tests__/generate-albums-data.test.ts`
  - [ ]* 3.7 为属性 6 编写属性测试：`buildAlbumSummary` 摘要信息正确性
    - **属性 6：相册摘要信息正确性**
    - **验证：需求 4.2**
    - 测试文件：`scripts/__tests__/generate-albums-data.test.ts`

- [ ] 4. 实现构建脚本主流程
  - [ ] 4.1 在 `scripts/generate-albums-data.ts` 中实现主函数：读取 `albumConfig`，若 `enabled=false` 则输出空 `albums-index.json` 并退出
    - _需求：1.4、4.1、4.5_
  - [ ] 4.2 实现相册目录遍历：验证 dirname 合法性（非法则 `console.error` + 跳过）、验证目录存在性（不存在则 `console.warn` + 跳过）、扫描直接子文件中的照片
    - _需求：1.5、1.6、2.2、2.4_
  - [ ] 4.3 实现增量缩略图生成：比较源文件与目标文件 `mtime`，跳过未修改文件；调用 `sharp` 生成 WebP 缩略图（`fit: 'inside', withoutEnlargement: true`）；单张失败时 `console.error` + 跳过
    - _需求：2.5、2.6、2.7、2.8_
  - [ ] 4.4 实现 EXIF 解析：调用 `exifr` 解析原图，捕获异常后所有字段设为 `null`，调用 `parseExif` 映射结果
    - _需求：3.1、3.2、3.3_
  - [ ] 4.5 实现 JSON 文件输出：为每个相册生成 `album-{dirname}.json`，汇总生成 `albums-index.json`，确保 `public/generated/` 目录存在
    - _需求：4.1、4.2、4.3、4.4、4.5_
  - [ ]* 4.6 为构建脚本主流程编写单元测试（mock 文件系统）：`enabled=false` 输出空数组、目录不存在时输出警告并跳过、增量构建跳过未修改文件
    - 测试文件：`scripts/__tests__/generate-albums-data.test.ts`
    - _需求：1.4、1.5、2.7_

- [ ] 5. 检查点——确保所有测试通过
  - 运行 `npx vitest run`，确保所有测试通过，如有问题请向用户说明。

- [ ] 6. 实现前端类型、Hook 与 i18n
  - [ ] 6.1 在 `src/i18n.ts` 中为 `en`、`zh`、`ja` 三种语言新增 `nav.albums` 翻译键（分别为 `"Albums"`、`"相册"`、`"アルバム"`）
    - _需求：5.5_
  - [ ] 6.2 创建 `src/hooks/useAlbums.ts`，实现 `useAlbums()` hook：`fetch('/generated/albums-index.json')`，管理 `loading`/`error`/`albums` 状态
    - _需求：6.1、6.4、6.5_
  - [ ] 6.3 创建 `src/hooks/useAlbum.ts`，实现 `useAlbum(dirname)` hook：`fetch('/generated/album-${dirname}.json')`，管理 `loading`/`error`/`album` 状态
    - _需求：7.1、7.3、7.4_
  - [ ]* 6.4 为属性 9 编写属性测试：i18n `nav.albums` 翻译键完备性
    - **属性 9：i18n 相册链接翻译完备性**
    - **验证：需求 5.5**
    - 测试文件：`src/i18n.test.ts`

- [ ] 7. 实现 PhotoViewer 组件
  - [ ] 7.1 创建 `src/components/PhotoViewer.tsx`：全屏蒙层、渐进式图片加载（先缩略图后原图）、EXIF 信息展示（仅非 `null` 字段）、上一张/下一张导航按钮
    - _需求：8.1、8.2、8.3、8.4、8.5_
  - [ ] 7.2 在 `PhotoViewer.tsx` 中实现 `navigatePhoto(index, direction, total)` 纯函数（边界保护），并通过 `useEffect` 绑定键盘事件（`←`/`→`/`Esc`）、打开时禁止背景滚动、点击蒙层背景关闭
    - _需求：8.6、8.7、8.8、8.9、8.10_
  - [ ]* 7.3 为属性 7 编写属性测试：PhotoViewer EXIF 条件渲染
    - **属性 7：PhotoViewer EXIF 条件渲染**
    - **验证：需求 8.4**
    - 测试文件：`src/components/__tests__/PhotoViewer.test.tsx`
  - [ ]* 7.4 为属性 8 编写属性测试：`navigatePhoto` 键盘导航索引正确性
    - **属性 8：键盘导航索引正确性**
    - **验证：需求 8.8、8.9**
    - 测试文件：`src/components/__tests__/PhotoViewer.test.tsx`
  - [ ]* 7.5 为 PhotoViewer 编写单元测试：Esc 键关闭、点击背景关闭、打开时 `body.overflow=hidden`
    - 测试文件：`src/components/__tests__/PhotoViewer.test.tsx`
    - _需求：8.6、8.7、8.10_

- [ ] 8. 实现相册列表页与详情页
  - [ ] 8.1 创建 `src/pages/Albums.tsx`：调用 `useAlbums()`，渲染加载占位（skeleton）、错误提示、相册卡片网格（封面图懒加载、相册名称、照片数量）；移动端 2 列、桌面端 3 列
    - _需求：6.1、6.2、6.3、6.4、6.5、6.6、6.7_
  - [ ] 8.2 创建 `src/pages/AlbumDetail.tsx`：从路由参数获取 `dirname`，调用 `useAlbum(dirname)`，渲染加载占位、错误提示、缩略图网格；点击缩略图打开 `PhotoViewer`；移动端 2 列、桌面端 3 列
    - _需求：7.1、7.2、7.3、7.4、7.5、7.6、7.7_
  - [ ]* 8.3 为 Albums 页编写单元测试：加载中显示 skeleton、加载失败显示错误
    - 测试文件：`src/pages/__tests__/Albums.test.tsx`
    - _需求：6.4、6.5_
  - [ ]* 8.4 为 AlbumDetail 页编写单元测试：点击缩略图打开 PhotoViewer
    - 测试文件：`src/pages/__tests__/AlbumDetail.test.tsx`
    - _需求：7.7_

- [ ] 9. 集成路由与导航栏
  - [ ] 9.1 修改 `src/App.tsx`：导入 `Albums`、`AlbumDetail`、`albumConfig`、`Navigate`，新增 `/albums` 和 `/albums/:dirname` 两条路由（`enabled=false` 时重定向至 `/`）
    - _需求：5.1、5.2、5.4_
  - [ ] 9.2 修改 `src/components/Layout.tsx`：导入 `albumConfig`，在导航栏中条件渲染「相册」`<Link>`（`albumConfig.enabled` 为 `true` 时显示）
    - _需求：5.3、5.4_
  - [ ]* 9.3 为路由集成编写单元测试：`enabled=false` 时访问 `/albums` 重定向至首页
    - 测试文件：`src/App.test.tsx`
    - _需求：5.4_

- [ ] 10. 检查点——确保所有测试通过
  - 运行 `npx vitest run`，确保所有测试通过，如有问题请向用户说明。

- [ ] 11. 更新文档
  - [ ] 11.1 在 `README.md`、`README.zh-CN.md`、`README.ja-JP.md` 中各新增「相册模块」章节，说明配置方式与 `build:albums` 命令用法
    - _需求：9.1_
  - [ ] 11.2 在 `src/posts/About.md` 末尾追加相册功能说明章节，包含配置文件示例、`build:albums` 命令说明、照片目录结构示例
    - _需求：9.2、9.3_

- [ ] 12. 最终检查点——确保所有测试通过
  - 运行 `npx vitest run`，确保所有测试通过，如有问题请向用户说明。

## 备注

- 标有 `*` 的子任务为可选项，可跳过以加快 MVP 交付
- 每个任务均引用了具体需求条款，便于追溯
- 检查点确保每个阶段的增量验证
- 属性测试验证通用正确性，单元测试验证具体场景
- 实现时所有代码示例均使用 TypeScript
