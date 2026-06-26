# PROJECT KNOWLEDGE BASE

**Generated:** 2026-06-26
**Commit:** 17c4d90
**Branch:** main

## OVERVIEW
LayaAir人生重开模拟器, JS ES Modules, Vite构建, 双入口(Web浏览器 + Node CLI)

## STRUCTURE
```
lifeRestart/
├── src/              # 主源码 (modules=游戏引擎, ui=LayaAir界面, functions=工具)
├── repl/             # CLI版本, 独立App类, 共享modules核心
├── data/             # XLSX游戏数据源 (需xlsx2json转JSON)
├── public/           # 静态资源 (libs/laya=引擎库, images=图片, data=生成JSON)
├── laya/             # LayaAir IDE项目 (导出到src/ui + public/images)
├── design/           # 设计素材 (PNG, XD, Sketch)
├── template/         # GitHub Pages Jekyll站点 (部署目标)
└── index.html        # Web入口 (加载Laya引擎脚本 + src/index.js ESM)
```

## WHERE TO LOOK
| 任务 | 位置 | 备注 |
|------|------|------|
| 游戏引擎核心 | src/modules/ | Life为编排器, 5个子模块 |
| 界面管理 | src/ui/uiManager.js | 视图/弹窗/对话三层架构 |
| 主题系统 | src/ui/themes/ | default/cyber并行目录, 动态加载 |
| 条件解析DSL | src/functions/condition.js | 自定义表达式解析器 |
| 国际化 | src/i18n/ | zh-cn.js, en-us.js |
| CLI版本 | repl/app.js | 完整REPL游戏循环 |
| 游戏数据 | data/*.xlsx -> public/data/*.json | v-transform转换 |
| LayaAir IDE导出 | laya/.laya | codeExportPath=src/ui, resExportPath=public/images |

## CODE MAP
| 符号 | 类型 | 位置 | 角色 |
|------|------|------|------|
| App | class | src/app.js | Web版入口, LayaAir初始化+i18n+UI启动 |
| App | class | repl/app.js | CLI版入口, REPL命令循环 |
| Life | class | src/modules/life.js | 核心编排器, 管理Property/Event/Talent/Achievement/Character |
| Property | class | src/modules/property.js | 属性系统 (CHR/INT/STR/MNY/SPR等) |
| Event | class | src/modules/event.js | 事件系统, 条件触发+效果 |
| Talent | class | src/modules/talent.js | 天赋系统, 抽取+替换+排他 |
| Achievement | class | src/modules/achievement.js | 成就系统 |
| Character | class | src/modules/character.js | 角色系统 |
| UIManager | class | src/ui/uiManager.js | 视图/对话/弹窗三层UI管理 |
| condition | module | src/functions/condition.js | 条件DSL解析 (>/<, ?, !, &, |) |

## CONVENTIONS
- `"type": "module"` ESM项目, jsconfig指向ESNext/ES6
- 构建输出到 `template/public/` (非标准dist/)
- 数据需先转: `pnpm xlsx2json` 将XLSX转为JSON才能运行
- 全局事件: `$$on`/`$$off`/`$$event` 挂在globalThis上, 非模块导出
- 全局工具: `$_` = util, `$lang` = i18n, `$ui` = UIManager, `core` = Life
- 测试文件用 `.spec.js` 后缀, 与源码同目录
- 主题视图用 `import.meta.glob('./themes/**/*.js')` 动态加载

## ANTI-PATTERNS (THIS PROJECT)
- 不修改 `public/libs/laya/` 下的引擎库文件
- 不修改 `src/ui/layaUI.max.all.js` (LayaAir IDE自动生成)
- 不修改 `src/@types/LayaAir.d.ts` (自动生成类型定义)
- 配置在 `src/index.js` 和 `repl/app.js` 中重复 (~130行), 改一处需同步另一处
- Dockerfile用yarn而项目用pnpm (不一致)

## UNIQUE STYLES
- LayaAir游戏引擎: 非标准Web框架, 用`Laya.*` API代替DOM操作
- 双应用模式: 同一核心逻辑, 两个完全独立的App类(无共享基类)
- 条件DSL: 自定义表达式语法 (>? <! &= |) 用于事件/天赋条件判断
- 属性类型用缩写常量: CHR=颜值, INT=智力, STR=体质, MNY=家境, SPR=快乐

## COMMANDS
```bash
pnpm install                  # 安装依赖
pnpm xlsx2json                # 转换XLSX数据到JSON (必须在dev/build之前)
pnpm dev                      # Vite开发服务器 (localhost:5173)
pnpm build                    # 生产构建 (输出到template/public/)
pnpm test                     # Vitest测试
node repl                     # CLI版本游戏
```

## NOTES
- CI不运行测试, 仅install+xlsx2json+build+deploy
- .vscode/launch.json指向不存在的/test目录
- dependabot.yml的package-ecosystem为空
- 仅1个测试文件 (condition.spec.js), 游戏逻辑模块无测试
- `public/data/` 是gitignored的生成目录
