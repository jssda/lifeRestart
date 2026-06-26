# THEME SYSTEM

src/ui/themes/ 实现双主题(default/cyber)的并行视图系统.

## 结构
```
themes/
 ├── themes.js      # 主题切换器视图 (radio选择)
 ├── loading.js     # 加载弹窗
 ├── message.js     # 消息弹窗
 ├── saveload.js    # 存档读档弹窗
 ├── default/       # 默认主题 (10视图+1popup)
 │   ├── main.js       # 主界面 (开始/成就/感谢/GitHub/Discord)
 │   ├── property.js   # 属性分配
 │   ├── talent.js     # 天赋选择
 │   ├── trajectory.js # 人生轨迹
 │   ├── summary.js    # 人生总评
 │   ├── achievement.js # 成就列表
 │   ├── celebrity.js  # 名人榜
 │   ├── mode.js       # 模式选择
 │   ├── thanks.js     # 感谢页 (default独有)
 │   └── popup/
 │       └── achievementPopup.js
 └── cyber/          # 赛博主题 (9视图+1popup, 无thanks)
     ├── main.js       # 主界面 (含背景缩放适配)
     ├── property.js   # 属性分配 (含进度条样式)
     ├── talent.js     # 天赋选择
     ├── trajectory.js # 人生轨迹
     ├── summary.js    # 人生总评
     ├── achievement.js # 成就列表
     ├── celebrity.js  # 名人榜
     ├── mode.js       # 模式选择
     └── popup/
         └── achievementPopup.js
```

## 关键模式

- **动态加载**: UIManager用`import.meta.glob('./themes/**/*.js')`按需加载视图类
- **并行目录**: default和cyber保持同名文件结构, 切换主题只改加载路径
- **LayaAir继承**: 每个视图类继承`ui.view.XxxUI`(来自layaUI.max.all.js自动生成)
- **视图生命周期**: `load()`(资源预载) -> `init(args)`(初始化) -> `show()`(展示) -> `close()`(关闭)
- **主题配置**: themes.js在localStorage存储主题偏好, 切换时重新加载所有视图

## ANTI-PATTERNS
- 新增视图必须在两个主题目录中各创建同名文件
- 不修改layaUI.max.all.js中的UI基类 (由LayaAir IDE生成)
- 不硬编码视图路径, 由UIManager.pages/popups映射表统一管理
