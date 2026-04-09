# 需求文档

## 简介

本文档描述为现有 React + Vite + TypeScript 静态博客系统新增「相册模块」功能的需求。

相册模块允许博客作者将照片按相册组织，通过构建脚本在本地预处理照片（生成缩略图、解析 EXIF 数据、输出 JSON 索引），前端以纯静态方式展示相册列表与相册详情，并支持点击缩略图以蒙层方式查看原图。整个流程无需后端服务，可部署到任意静态托管环境。

---

## 词汇表

- **Album_Module**：本次新增的相册功能整体，包含构建脚本、配置、前端页面三部分。
- **Build_Script**：运行于 Node.js 环境的构建脚本（`scripts/generate-albums-data.ts`），负责扫描照片目录、生成缩略图、解析 EXIF、输出 JSON 索引文件。
- **Album_Config**：相册模块的配置对象，定义于 `src/album.config.ts`，包含功能开关与相册列表。
- **Album**：一个相册条目，包含照片源目录路径，以及可选的显示名称和封面照片文件名。
- **Dirname**：相册目录路径（`dir` 字段）的文件夹名，作为相册的唯一标识符，用于路由参数和 JSON 文件命名。Dirname 不允许包含空格或特殊字符。
- **Photo**：相册中的单张照片，具有原图文件、缩略图文件和 EXIF 元数据。
- **Thumbnail**：由 Build_Script 生成的 WebP 格式缩略图，长边不超过 1080px。
- **EXIF_Data**：从照片文件中解析的元数据，包含相机型号、焦距、光圈、快门速度、ISO。
- **Albums_Index**：Build_Script 生成的 `public/generated/albums-index.json`，包含所有相册的摘要信息。
- **Album_Detail_JSON**：Build_Script 为每个相册生成的 `public/generated/album-{dirname}.json`，包含该相册所有照片的完整信息。
- **Albums_List_Page**：路由 `/albums` 对应的前端页面，展示所有相册的列表。
- **Album_Detail_Page**：路由 `/albums/:dirname` 对应的前端页面，展示单个相册的所有缩略图。
- **Photo_Viewer**：点击缩略图后弹出的蒙层组件，用于展示原图或高质量大图。
- **SPA_Router**：现有的 React Router DOM v7 路由系统。

---

## 照片目录约定

照片原图放在 `public/albums/{dirname}/` 下，缩略图由 Build_Script 生成后输出到 `public/albums/{dirname}/thumbs/`，JSON 索引输出到 `public/generated/`。原图和缩略图均可通过静态 URL 直接访问，Vite 构建时直接复制到 dist，无需额外配置，与现有 `public/` 目录约定一致。

---

## 需求

### 需求 1：相册配置

**用户故事：** 作为博客作者，我希望通过配置文件集中管理相册模块的开关和相册列表，以便灵活控制功能的启用状态和相册内容。

#### 验收标准

1. THE Album_Module SHALL 从 `src/album.config.ts` 中读取 `albumConfig` 对象作为唯一配置来源。
2. THE Album_Config SHALL 包含一个布尔类型字段 `enabled`，用于控制相册模块是否启用。
3. THE Album_Config SHALL 包含一个 `albums` 数组，数组中每个条目包含以下字段：
   - `dir`：字符串（必填），照片源目录相对于 `public/albums/` 的路径；`dir` 的文件夹名即为该相册的 Dirname（唯一标识符），不允许包含空格或其他特殊字符
   - `name`：字符串（可选），相册显示名称；不填时前端直接显示 Dirname
   - `cover`：字符串（可选），封面照片的文件名（须为该相册目录内的文件）
4. WHEN `albumConfig.enabled` 为 `false` 时，THE Build_Script SHALL 跳过所有照片处理并输出空的索引文件。
5. IF `albums` 数组中某条目的 `dir` 目录不存在，THEN THE Build_Script SHALL 输出警告信息并跳过该条目，不中断整体构建流程。
6. IF `albums` 数组中某条目的 `dir` 文件夹名包含空格或其他特殊字符，THEN THE Build_Script SHALL 输出错误信息并跳过该条目，不中断整体构建流程。

---

### 需求 2：构建脚本——照片扫描与缩略图生成

**用户故事：** 作为博客作者，我希望运行一条命令就能自动扫描照片目录并生成 WebP 缩略图，以便前端可以快速加载照片列表。

#### 验收标准

1. THE `package.json` SHALL 包含一个 `build:albums` 脚本，其命令为 `npx tsx scripts/generate-albums-data.ts`。
2. WHEN 执行 `build:albums` 时，THE Build_Script SHALL 读取 `src/album.config.ts` 中的 `albumConfig` 配置。
3. WHEN 扫描相册目录时，THE Build_Script SHALL 识别扩展名为 `.jpg`、`.jpeg`、`.png`、`.webp`、`.heic` 的文件作为照片。
4. WHEN 扫描相册目录时，THE Build_Script SHALL 只扫描该目录的直接子文件，不递归扫描子目录。
5. WHEN 处理每张照片时，THE Build_Script SHALL 在该相册目录下的 `thumbs/` 子目录中生成对应的 WebP 格式缩略图。
6. THE Build_Script SHALL 生成的缩略图长边不超过 1080px，短边按原始宽高比等比缩放。
7. WHEN 目标缩略图文件已存在且源文件未修改时，THE Build_Script SHALL 跳过该照片的缩略图生成，以提升增量构建效率。
8. IF 单张照片的缩略图生成失败，THEN THE Build_Script SHALL 记录错误信息并继续处理其余照片。

---

### 需求 3：构建脚本——EXIF 数据解析

**用户故事：** 作为博客读者，我希望在查看照片时能看到拍摄参数，以便了解照片的拍摄背景。

#### 验收标准

1. WHEN 处理每张照片时，THE Build_Script SHALL 尝试从原图文件中解析 EXIF 元数据。
2. THE Build_Script SHALL 解析并存储以下 EXIF 字段（如存在）：
   - `cameraMake`：相机品牌
   - `cameraModel`：相机型号
   - `focalLength`：焦距（单位：mm）
   - `aperture`：光圈值（f/N 格式）
   - `shutterSpeed`：快门速度（如 `1/250`）
   - `iso`：ISO 感光度
3. IF 某张照片不包含 EXIF 数据或某字段缺失，THEN THE Build_Script SHALL 将对应字段设为 `null`，不中断构建流程。

---

### 需求 4：构建脚本——JSON 索引文件生成

**用户故事：** 作为前端页面，我需要读取结构化的 JSON 数据来渲染相册列表和相册详情，以便实现纯静态部署。

#### 验收标准

1. WHEN 构建完成时，THE Build_Script SHALL 在 `public/generated/` 目录下生成 `albums-index.json` 文件。
2. THE `albums-index.json` SHALL 包含所有相册的摘要信息数组，每项包含：`dirname`、`name`（未配置时等于 `dirname`）、`cover`（封面缩略图相对 URL）、`photoCount`（照片总数）。
3. WHEN 构建完成时，THE Build_Script SHALL 为每个相册在 `public/generated/` 目录下生成独立的 `album-{dirname}.json` 文件。
4. THE `album-{dirname}.json` SHALL 包含该相册的完整信息：`dirname`、`name`（未配置时等于 `dirname`），以及 `photos` 数组，每张照片包含：`filename`、`thumbnailUrl`（缩略图相对 URL）、`originalUrl`（原图相对 URL）、`exif`（EXIF 数据对象）。
5. THE Build_Script SHALL 确保 `public/generated/` 目录在输出前已存在，若不存在则自动创建。
6. FOR ALL 有效的 `album-{dirname}.json` 文件，解析后再序列化所得结果 SHALL 与原文件内容等价（JSON 往返属性）。

---

### 需求 5：前端路由集成

**用户故事：** 作为博客读者，我希望通过导航栏访问相册页面，以便与访问归档页面一样自然流畅。

#### 验收标准

1. THE SPA_Router SHALL 注册路由 `/albums`，对应 Albums_List_Page 组件。
2. THE SPA_Router SHALL 注册路由 `/albums/:dirname`，对应 Album_Detail_Page 组件。
3. THE Album_Module SHALL 在现有导航栏中新增「相册」链接，位置与「归档」链接同级。
4. WHERE `albumConfig.enabled` 为 `false` 时，THE Album_Module SHALL 隐藏导航栏中的「相册」链接，并在访问 `/albums` 或 `/albums/:dirname` 时重定向至首页。
5. THE 导航栏「相册」链接 SHALL 支持 i18next 多语言，在 `en`、`zh`、`ja` 三种语言下分别显示对应译文。

---

### 需求 6：相册列表页（`/albums`）

**用户故事：** 作为博客读者，我希望在相册列表页看到所有相册的封面和名称，以便快速浏览并选择感兴趣的相册。

#### 验收标准

1. WHEN 用户访问 `/albums` 时，THE Albums_List_Page SHALL 从 `public/generated/albums-index.json` 加载相册索引数据。
2. THE Albums_List_Page SHALL 以网格布局展示所有相册，每个相册卡片包含：封面缩略图、相册名称、照片数量。
3. WHEN 用户点击相册卡片时，THE Albums_List_Page SHALL 导航至对应的 `/albums/:dirname` 页面。
4. WHILE 数据加载中，THE Albums_List_Page SHALL 展示加载状态占位符（skeleton 或 loading 提示）。
5. IF 加载 `albums-index.json` 失败，THEN THE Albums_List_Page SHALL 展示错误提示信息。
6. THE Albums_List_Page SHALL 在移动端（视口宽度 < 768px）下自适应为单列或双列网格布局。
7. THE Albums_List_Page SHALL 在桌面端（视口宽度 ≥ 768px）下展示三列或更多列的网格布局。

---

### 需求 7：相册详情页（`/albums/:dirname`）

**用户故事：** 作为博客读者，我希望在相册详情页看到该相册的所有照片缩略图，以便浏览整个相册的内容。

#### 验收标准

1. WHEN 用户访问 `/albums/:dirname` 时，THE Album_Detail_Page SHALL 从 `public/generated/album-{dirname}.json` 加载该相册的完整数据。
2. THE Album_Detail_Page SHALL 以瀑布流或均匀网格布局展示该相册所有照片的缩略图。
3. WHILE 数据加载中，THE Album_Detail_Page SHALL 展示加载状态占位符。
4. IF 加载 `album-{dirname}.json` 失败或 Dirname 不存在，THEN THE Album_Detail_Page SHALL 展示错误提示信息。
5. THE Album_Detail_Page SHALL 在移动端下自适应为两列网格布局。
6. THE Album_Detail_Page SHALL 在桌面端下展示三列或更多列的网格布局。
7. WHEN 用户点击任意缩略图时，THE Album_Detail_Page SHALL 打开 Photo_Viewer 并展示该照片。

---

### 需求 8：照片查看器（Photo Viewer）

**用户故事：** 作为博客读者，我希望点击缩略图后能以蒙层方式查看原图及拍摄参数，以便获得沉浸式的照片浏览体验。

#### 验收标准

1. WHEN Photo_Viewer 打开时，THE Photo_Viewer SHALL 以全屏蒙层方式覆盖页面，背景为半透明深色遮罩。
2. THE Photo_Viewer SHALL 在蒙层中居中展示当前照片的原图（`originalUrl`）。
3. WHILE 原图加载中，THE Photo_Viewer SHALL 展示缩略图作为占位预览（渐进式加载）。
4. THE Photo_Viewer SHALL 展示当前照片的 EXIF 数据（相机型号、焦距、光圈、快门速度、ISO），仅展示非 `null` 的字段。
5. THE Photo_Viewer SHALL 提供「上一张」和「下一张」导航控件，允许用户在相册内切换照片。
6. WHEN 用户点击蒙层背景区域时，THE Photo_Viewer SHALL 关闭。
7. WHEN 用户按下键盘 `Escape` 键时，THE Photo_Viewer SHALL 关闭。
8. WHEN 用户按下键盘左方向键时，THE Photo_Viewer SHALL 切换至上一张照片。
9. WHEN 用户按下键盘右方向键时，THE Photo_Viewer SHALL 切换至下一张照片。
10. WHILE Photo_Viewer 处于打开状态，THE Photo_Viewer SHALL 禁止页面背景滚动。

---

### 需求 9：文档更新

**用户故事：** 作为博客系统的使用者，我希望在项目文档中找到相册模块的使用说明，以便快速上手配置和使用该功能。

#### 验收标准

1. THE Album_Module SHALL 在 `README.md`、`README.zh-CN.md`、`README.ja-JP.md` 三份文档中各新增一节，说明相册模块的配置方式和 `build:albums` 命令的使用方法。
2. THE Album_Module SHALL 在 `src/posts/About.md` 中追加一节，说明相册功能的用法及工作原理，不单独新建 post 文件。
3. THE `src/posts/About.md` 中新增的章节 SHALL 包含：配置文件示例、`build:albums` 命令说明、照片目录结构示例。

---

## 验收测试标准

本章节定义各模块的具体可执行测试用例，作为功能验收的依据。

---

### T1：构建脚本测试

#### T1.1 正常流程

**前置条件：**
- `src/album.config.ts` 中配置一个相册，`dir` 指向 `public/albums/test-album`
- `public/albums/test-album/` 目录下存放 3 张 JPEG 照片：`a.jpg`、`b.jpg`、`c.jpg`
- `public/albums/test-album/thumbs/` 目录不存在或为空

**执行步骤：**
1. 运行 `npm run build:albums`

**预期结果：**
- `public/albums/test-album/thumbs/` 目录下生成 `a.webp`、`b.webp`、`c.webp` 三个缩略图文件
- 每个缩略图文件的长边不超过 1080px
- `public/generated/albums-index.json` 存在，且包含一条记录，其 `dirname` 为 `test-album`，`photoCount` 为 `3`
- `public/generated/album-test-album.json` 存在，且 `photos` 数组长度为 `3`，每项包含 `filename`、`thumbnailUrl`、`originalUrl`、`exif` 字段

#### T1.2 增量构建

**前置条件：** T1.1 已成功执行，缩略图已存在

**执行步骤：**
1. 记录 `public/albums/test-album/thumbs/a.webp` 的文件修改时间
2. 不修改任何源照片，再次运行 `npm run build:albums`

**预期结果：**
- `a.webp`、`b.webp`、`c.webp` 的文件修改时间与第一次运行后相同（未被重新生成）
- 脚本正常退出，无错误输出

#### T1.3 缺失目录

**前置条件：**
- `src/album.config.ts` 中配置一个相册，`dir` 指向 `public/albums/nonexistent-album`
- `public/albums/nonexistent-album/` 目录不存在

**执行步骤：**
1. 运行 `npm run build:albums`

**预期结果：**
- 脚本输出包含针对 `nonexistent-album` 的警告信息（如 `[WARN]` 或 `warning`）
- 脚本正常退出，退出码为 `0`，不抛出未捕获异常
- `public/generated/albums-index.json` 存在，但不包含 `nonexistent-album` 的条目

#### T1.4 `enabled=false`

**前置条件：**
- `src/album.config.ts` 中 `enabled` 设为 `false`

**执行步骤：**
1. 运行 `npm run build:albums`

**预期结果：**
- `public/generated/albums-index.json` 存在，内容为空数组 `[]`
- 不生成任何 `album-{dirname}.json` 文件
- 不生成任何缩略图文件

#### T1.5 EXIF 缺失

**前置条件：**
- `public/albums/test-album/` 目录下存放一张不含 EXIF 数据的 JPEG 照片（如纯色图片）

**执行步骤：**
1. 运行 `npm run build:albums`

**预期结果：**
- 脚本正常完成，不报错
- 对应照片在 `album-test-album.json` 中的 `exif` 对象所有字段均为 `null`（即 `cameraMake: null`、`cameraModel: null` 等）

---

### T2：JSON 结构测试

#### T2.1 `albums-index.json` 结构验证

**执行步骤：**
1. 运行 `npm run build:albums`（至少一个相册已配置且目录存在）
2. 读取并解析 `public/generated/albums-index.json`

**预期结果：**
- 文件为合法 JSON，顶层为数组
- 数组中每个元素包含以下字段且类型正确：
  - `dirname`：字符串，与配置中 `dir` 的文件夹名一致
  - `name`：字符串，配置了 `name` 时等于配置值，未配置时等于 `dirname`
  - `cover`：字符串（相对 URL）或 `null`（未配置封面时）
  - `photoCount`：非负整数，等于该相册目录下识别到的照片数量

#### T2.2 `album-{dirname}.json` 结构验证

**执行步骤：**
1. 运行 `npm run build:albums`
2. 读取并解析 `public/generated/album-{dirname}.json`（以实际 dirname 替换）

**预期结果：**
- 文件为合法 JSON，顶层为对象
- 对象包含以下字段：
  - `dirname`：字符串
  - `name`：字符串
  - `photos`：数组，长度与 `photoCount` 一致
- `photos` 数组中每个元素包含：
  - `filename`：字符串，照片文件名
  - `thumbnailUrl`：字符串，以 `/albums/{dirname}/thumbs/` 开头的相对路径
  - `originalUrl`：字符串，以 `/albums/{dirname}/` 开头的相对路径
  - `exif`：对象，包含 `cameraMake`、`cameraModel`、`focalLength`、`aperture`、`shutterSpeed`、`iso` 六个字段，每个字段为字符串或 `null`

#### T2.3 JSON 往返属性

**执行步骤：**
1. 读取 `public/generated/album-{dirname}.json` 的原始文本
2. 执行 `JSON.parse` 解析为对象
3. 执行 `JSON.stringify(parsed, null, 2)` 序列化回字符串（或与原文件相同的格式化参数）

**预期结果：**
- 序列化结果与原始文件内容等价（字段顺序、数值精度、字符串内容均一致）

---

### T3：前端路由测试

#### T3.1 访问 `/albums` 渲染列表页

**前置条件：** `albumConfig.enabled` 为 `true`，`albums-index.json` 已生成

**执行步骤：**
1. 启动开发服务器（`npm run dev`）
2. 浏览器访问 `http://localhost:{port}/albums`

**预期结果：**
- 页面正常渲染，不出现空白或路由 404
- 页面中可见相册卡片列表（或加载占位符）
- 导航栏中「相册」链接处于激活状态

#### T3.2 访问 `/albums/{dirname}` 渲染详情页

**前置条件：** `albumConfig.enabled` 为 `true`，对应 `album-{dirname}.json` 已生成

**执行步骤：**
1. 启动开发服务器
2. 浏览器访问 `http://localhost:{port}/albums/{dirname}`（以实际 dirname 替换）

**预期结果：**
- 页面正常渲染，展示该相册的缩略图网格（或加载占位符）
- 页面标题或面包屑显示相册名称

#### T3.3 `enabled=false` 时重定向

**前置条件：** `albumConfig.enabled` 为 `false`

**执行步骤：**
1. 启动开发服务器
2. 浏览器访问 `http://localhost:{port}/albums`

**预期结果：**
- 页面自动重定向至首页（`/`）
- 导航栏中不显示「相册」链接

---

### T4：Photo Viewer 测试

#### T4.1 点击缩略图打开蒙层

**前置条件：** 已进入某相册详情页，页面已加载缩略图列表

**执行步骤：**
1. 点击任意一张缩略图

**预期结果：**
- 页面出现全屏半透明深色蒙层
- 蒙层中居中展示该照片（缩略图占位或原图）
- 蒙层外的页面内容不可交互

#### T4.2 键盘 `Esc` 关闭

**前置条件：** Photo_Viewer 已打开

**执行步骤：**
1. 按下键盘 `Escape` 键

**预期结果：**
- 蒙层关闭，页面恢复正常状态
- 页面背景恢复可滚动

#### T4.3 键盘左右方向键切换照片

**前置条件：** Photo_Viewer 已打开，当前相册包含至少 3 张照片，当前显示第 2 张

**执行步骤：**
1. 按下键盘右方向键
2. 按下键盘左方向键

**预期结果：**
- 按右方向键后，蒙层中切换至第 3 张照片
- 按左方向键后，蒙层中切换回第 2 张照片

#### T4.4 点击蒙层背景关闭

**前置条件：** Photo_Viewer 已打开

**执行步骤：**
1. 点击蒙层背景区域（照片以外的半透明遮罩区域）

**预期结果：**
- 蒙层关闭，页面恢复正常状态

#### T4.5 打开时页面背景不可滚动

**前置条件：** 相册详情页内容足够长，页面可滚动

**执行步骤：**
1. 点击缩略图打开 Photo_Viewer
2. 尝试滚动页面（鼠标滚轮或触摸滑动）

**预期结果：**
- 页面背景不发生滚动
- Photo_Viewer 蒙层内容（如有滚动需求）可正常滚动
