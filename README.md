# 开发者工具箱 (Developer Toolbox)

本地优先的开发者工具箱 Web 应用。安静、克制、精致 —— 打开即用，没有横幅、教程和广告。

**文本对比 · JSON 格式化 · 文本工具 + 16 个开发小工具** —— 所有内容仅在浏览器本地处理。

## 隐私

- 无后端、无数据库、无账号系统
- 粘贴、输入、拖入的内容永不上传
- 无统计埋点、无跟踪、无第三方 API 调用
- 设置仅保存在本机 `localStorage`

## 功能

### 文本对比（Diff）
- 并排 / 行内两种模式，Apple 风格分段控件切换
- 输入即实时对比（220ms 防抖），无需点击「比较」
- 行级差异 + 字符级高亮（`"123456"` → `"123457"` 仅高亮 `6` → `7`）
- 差异统计：`+新增 −删除 ~修改`，点击可逐处浏览
- F7 / Shift+F7 在差异之间跳转，Ctrl/Cmd+Enter 刷新
- 忽略空白字符 · 忽略大小写 · 去除行首尾空格 · 隐藏未修改内容
- 交换两侧、拖放文件、分栏拖拽、滚动同步、可折叠侧边栏

### JSON 格式化
- 格式化（2/4 空格或 Tab）、压缩、键名排序、校验、复制
- 精确错误定位：`第 12 行，第 18 列：意外的符号 '}'`，并在编辑器内标记
- 输入时自动校验，状态栏显示键数量与行数

### 文本工具
- 整理：去除首尾空格、去除空行、去除重复行、每行去除首尾空格
- 转换：转为大写 / 小写、LF → CRLF、CRLF → LF
- 排序：升序 / 降序
- 实时字符 / 单词 / 行数统计；所有操作支持撤销

### 小工具（16 个）
| 工具 | 说明 |
| --- | --- |
| Base64 | 文本编解码 |
| Cron | 定时表达式解析（支持 6 字段）|
| Escape | 转义序列处理 |
| Hash | MD5 / SHA 摘要 |
| HTML | 格式化 / 预览 |
| JWT | 编解码与校验 |
| 行尾符 | LF / CRLF 检测与转换 |
| Markdown | 实时渲染阅读，**支持 Mermaid 图表**（流程图 / 时序图 / 甘特图，懒加载渲染，主题跟随，语法错误回退源码）|
| 密码 | 随机密码生成 |
| 二维码 | 文本 / 链接生成二维码 |
| 进制 | 二 / 八 / 十 / 十六进制转换 |
| 正则 | 实时匹配与高亮 |
| 时间戳 | Unix 时间戳与日期互转 |
| URL | 编解码与参数解析 |
| UUID | v4 批量生成 |
| YAML | 解析与格式化 |

移动端为「底栏 4 常用 + 更多菜单」布局，新增工具自动进入「更多」菜单。

## 技术栈

- React 18 + TypeScript + Vite 6
- CodeMirror 6（自研装饰层渲染 diff / 错误标记）
- jsdiff（行级 + 字符/词级差异）、marked + DOMPurify、Mermaid 12
- lucide-react 图标
- vite-plugin-pwa（可安装、离线可用、Service Worker）

构建分包：`index`（应用）/ `vendor`（三方）/ `codemirror`（编辑器）/ `mermaid`（按需懒加载，约 5MB，不进 PWA 预缓存）。

## 运行

```bash
npm install
npm run dev       # 开发模式 http://localhost:5173
npm run build     # 生产构建到 dist/（含 PWA）
npm run preview   # 预览构建产物 http://localhost:4173
npm run test      # vitest 单元测试
npm run typecheck # tsc --noEmit
npm run lint      # eslint
```

质量门禁：`npm run typecheck && npm run lint && npm run test`（125 用例）。

## 部署（Linux 免配置）

`deploy/` 内置零依赖发布方案，任意有 Python 3.6+ 或 Node.js 的服务器，解压一条命令即可运行：

```bash
tar -xzf DeveloperToolbox-server-YYYYMMDD.tar.gz
cd DeveloperToolbox-server-YYYYMMDD
chmod +x start.sh && ./start.sh     # 默认 0.0.0.0:8080，DEVELOPER_TOOLBOX_PORT 可覆盖
```

- `start.sh`：start / stop / restart / status / logs，PID 管理 + `/__health` 健康检查
- `server.py` / `server.mjs`：标准库静态服务器，SPA 回退、分层缓存、安全响应头、路径穿越防护
- 升级采用日期目录并行部署，回滚 = 切回旧目录

详见 `deploy/README.txt`。

## 快捷键

| 操作 | Windows / Linux | macOS |
| --- | --- | --- |
| 打开文件 | Ctrl+O | Cmd+O |
| 下一个 / 上一个差异 | F7 / Shift+F7 | F7 / Shift+F7 |
| 刷新对比 | Ctrl+Enter | Cmd+Enter |
| 编辑器内搜索 | Ctrl+F | Cmd+F |
| 撤销 / 重做 | Ctrl+Z / Ctrl+Shift+Z | Cmd+Z / Cmd+Shift+Z |
