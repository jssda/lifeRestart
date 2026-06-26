# CLI VERSION (REPL)

repl/ 是独立的Node CLI版本, 与Web版共享核心逻辑但UI完全独立.

## 结构
```
repl/
 ├── index.js   # CLI入口, polyfill localStorage, 接入stdin/stdout
 └── app.js     # 完整REPL游戏循环 (867行)
```

## 关键模式

- **REPL命令**: /remake(重开), /select(选天赋), /unselect(取消), /allocate(分配属性), /next(继续), /auto(自动播放), /exit(退出), /help(帮助)
- **游戏状态机**: TALENT -> PROPERTY -> TRAJECTORY -> SUMMARY -> (循环)
- **ANSI终端样式**: 用`\x1B[94m`(蓝) `\x1B[95m`(紫) `\x1B[93m`(黄) 显示天赋等级
- **localStorage polyfill**: 用JSON文件(`__localStorage.json`)模拟浏览器localStorage
- **共享核心**: `import Life from '../src/modules/life.js'` 使用同一游戏引擎

## 配置同步问题

`repl/app.js`中约130行游戏配置(talentConfig/propertyConfig/characterConfig/judge表)与`src/index.js`完全重复. 修改配置必须同步两处.

## ANTI-PATTERNS
- 不在repl/中引入任何LayaAir或浏览器API依赖
- 不修改全局$$event系统的实现(与Web版共用, 但repl中achievement回调只输出文字)
- CLI版不支持i18n切换, 固定zh-cn
