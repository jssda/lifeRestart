# GAME ENGINE CORE

src/modules/ 是游戏逻辑核心, 所有模块由Life编排器协调.

## 模块关系

```
Life (编排器)
 ├── Property  ← 属性系统, 管理CHR/INT/STR/MNY/SPR等数值
 ├── Event     ← 事件系统, 条件触发+效果+分支
 ├── Talent    ← 天赋系统, 抽取+排他+替换+加权随机
 ├── Achievement ← 成就系统, 时机触发(START/TRAJECTORY/SUMMARY/END)
 └── Character ← 角色系统, 加权随机抽取+保底机制
```

## 关键模式

- **构造注入**: 每个模块构造器接收Life实例(`this.#system`), 通过`system.request(Module.XXX)`访问其他模块
- **条件DSL**: Event/Talent/Achievement的条件判断调用`system.check(condition)`, 底层走condition.js解析器
- **属性缩写**: Property.TYPES用3字母常量 (CHR=颜值, INT=智力, STR=体质, MNY=家境, SPR=快乐, LIF=生命)
- **数据克隆**: 跨模块传递数据用`system.clone()`深拷贝, 防止引用污染
- **全局事件**: Achievement达成时触发`$$event('achievement', data)`通知UI层

## 属性类型一览

| 缩写 | 含文 | 类型 |
|------|------|------|
| CHR | 颜值 | 本局 |
| INT | 智力 | 本局 |
| STR | 体质 | 本局 |
| MNY | 家境 | 本局 |
| SPR | 快乐 | 本局 |
| LIF | 生命 | 本局 |
| TLT | 天赋 | 本局 |
| EVT | 事件 | 本局 |
| HCHR/HINT/HSTR/HMNY/HSPR | 历史最高值 | 评算 |
| HAGE | 享年 | 评算 |
| SUM | 总评 | 评算 |
| ACHV | 成就记录 | 总计 |

## ANTI-PATTERNS
- 不直接修改模块的私有字段(`#xxx`), 全通过Life的公开API操作
- 不跨模块直接引用, 必须走`system.request()`或`system.function()`
