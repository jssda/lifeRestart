# LLM 人生故事生成功能 — 实施规格书

## 一、概述

在"人生重开模拟器"（lifeRestart）中，当人生结束并显示总评（Summary）后，新增一个"生成人生故事"按钮。点击后调用用户配置的 LLM API（OpenAI-compatible），基于完整的人生轨迹数据，流式生成不少于5000字的人生故事，以逐字弹出（SSE 风格）的方式展示。

Web 版用 DOM overlay 实现（项目已有先例：saveload.js 的 btnBackup）；CLI 版直接终端流式输出。

## 二、新增/修改文件清单

### 新增文件
1. `src/modules/llmSummary.js` — LLM 调用核心模块（纯逻辑，Web/CLI 共用）
2. `src/ui/themes/llmStoryView.js` — 人生故事 DOM overlay 视图（两个主题共用）
3. `src/ui/themes/llmSettings.js` — LLM 设置弹窗（DOM overlay，两个主题共用）

### 修改文件
4. `src/modules/life.js` — 新增 trajectoryHistory 收集器
5. `src/ui/themes/default/summary.js` — 新增"生成人生故事"按钮
6. `src/ui/themes/cyber/summary.js` — 同上
7. `src/ui/views.js` — 新增 LLM_STORY 页面路由 + LLM_SETTINGS 弹窗路由
8. `src/i18n/zh-cn.js` — 新增翻译文本
9. `src/i18n/en-us.js` — 新增翻译文本
10. `repl/app.js` — CLI 版新增 /story 命令 + LLM 流式输出 + .env 支持

## 三、各文件详细规格

### 3.1 `src/modules/life.js` — 轨迹历史收集

在 Life 类中新增：

```js
// 新增私有字段
#trajectoryHistory = [];

// 新增 getter
get trajectoryHistory() {
    return this.#trajectoryHistory;
}
```

在 `next()` 方法中（约第134行），在 `const content = [talentContent, eventContent].flat();` 之后追加：

```js
this.#trajectoryHistory.push({ age, content });
```

注意：`trajectoryHistory` 应在 `start()` 调用时清空（因为 start 是新一轮游戏的开始）。在 `start()` 方法中追加：

```js
this.#trajectoryHistory = [];
```

### 3.2 `src/modules/llmSummary.js` — LLM 调用模块

完整代码如下：

```js
export default class LLMSummary {

    static config = {
        get baseUrl()  { return localStorage.getItem('llm_baseUrl') || ''; },
        set baseUrl(v) { localStorage.setItem('llm_baseUrl', v); },
        get apiKey()   { return localStorage.getItem('llm_apiKey') || ''; },
        set apiKey(v)  { localStorage.setItem('llm_apiKey', v); },
        get modelId()  { return localStorage.getItem('llm_modelId') || 'deepseek-chat'; },
        set modelId(v) { localStorage.setItem('llm_modelId', v); },
    }

    // CLI 版配置：从环境变量或 .env 文件读取
    static cliConfig = {
        baseUrl: '',
        apiKey: '',
        modelId: 'deepseek-chat',
    };

    static isConfigured() {
        const cfg = this.getConfig();
        return cfg.baseUrl && cfg.apiKey;
    }

    // 根据运行环境返回配置（Web 用 localStorage，CLI 用 cliConfig）
    static getConfig() {
        // 如果在浏览器环境，用 localStorage
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            return this.config;
        }
        return this.cliConfig;
    }

    static buildPrompt(trajectoryHistory, summary, talents) {
        const lines = trajectoryHistory.map(({age, content}) => {
            const events = content.map(c => {
                if (c.type === 'TLT') return `天赋【${c.name}】发动：${c.description}`;
                if (c.type === 'EVT') return c.description + (c.postEvent ? `\n${c.postEvent}` : '');
                return c.description || '';
            }).join('；');
            return `${age}岁：${events}`;
        });

        const talentNames = Array.isArray(talents)
            ? talents.map(t => t.name || t).join('、')
            : '';

        const pt = summary;
        const props = [
            `颜值${pt.HCHR.value}（${pt.HCHR.judge}）`,
            `智力${pt.HINT.value}（${pt.HINT.judge}）`,
            `体质${pt.HSTR.value}（${pt.HSTR.judge}）`,
            `家境${pt.HMNY.value}（${pt.HMNY.judge}）`,
            `快乐${pt.HSPR.value}（${pt.HSPR.judge}）`,
            `享年${pt.HAGE.value}（${pt.HAGE.judge}）`,
            `总评${pt.SUM.value}（${pt.SUM.judge}）`,
        ].join('，');

        return `你是一位文学大师，擅长以细腻笔触书写人生故事。

以下是一个人的一生经历，请根据这些经历，写一篇不少于5000字的人生故事。
要求：
1. 以第三人称叙事，文笔优美，有情感深度
2. 按人生阶段自然展开：幼年、少年、青年、中年、老年
3. 对关键事件进行详细描写和情感解读，不要简单罗列
4. 体现人物性格、命运转折、内心挣扎
5. 结尾要有哲理性的反思

这个人的一生经历如下：
天赋：${talentNames}
人生轨迹：
${lines.join('\n')}
人生总评：${props}

请开始书写这个人的人生故事：`;
    }

    // Web 版：流式调用，返回 AsyncGenerator
    static async *streamStory(trajectoryHistory, summary, talents) {
        const prompt = this.buildPrompt(trajectoryHistory, summary, talents);
        const cfg = this.getConfig();

        const response = await fetch(
            `${cfg.baseUrl}/v1/chat/completions`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cfg.apiKey}`,
                },
                body: JSON.stringify({
                    model: cfg.modelId,
                    messages: [{ role: 'user', content: prompt }],
                    stream: true,
                    max_tokens: 8000,
                    temperature: 0.8,
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`LLM API 错误: ${response.status} ${errorText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.startsWith('data:')) continue;
                const data = line.slice(5).trim();
                if (data === '[DONE]') return;
                try {
                    const json = JSON.parse(data);
                    const content = json.choices?.[0]?.delta?.content;
                    if (content) yield content;
                } catch (e) {
                    // 跳过无法解析的行
                }
            }
        }
    }

    // CLI 版：流式调用，每 chunk 调用 onChunk 回调
    static async streamStoryForCLI(trajectoryHistory, summary, talents, onChunk) {
        const prompt = this.buildPrompt(trajectoryHistory, summary, talents);
        const cfg = this.getConfig();

        const response = await fetch(
            `${cfg.baseUrl}/v1/chat/completions`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cfg.apiKey}`,
                },
                body: JSON.stringify({
                    model: cfg.modelId,
                    messages: [{ role: 'user', content: prompt }],
                    stream: true,
                    max_tokens: 8000,
                    temperature: 0.8,
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`LLM API 错误: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.startsWith('data:')) continue;
                const data = line.slice(5).trim();
                if (data === '[DONE]') break;
                try {
                    const json = JSON.parse(data);
                    const content = json.choices?.[0]?.delta?.content;
                    if (content) {
                        fullText += content;
                        onChunk(content);
                    }
                } catch (e) {}
            }
        }
        return fullText;
    }

    // 测试连接：调用 /v1/models 检查 API 是否可用
    static async testConnection() {
        const cfg = this.getConfig();
        try {
            const response = await fetch(
                `${cfg.baseUrl}/v1/models`,
                {
                    headers: {
                        'Authorization': `Bearer ${cfg.apiKey}`,
                    },
                }
            );
            return response.ok;
        } catch (e) {
            return false;
        }
    }
}
```

### 3.3 `src/ui/themes/llmStoryView.js` — 人生故事 DOM overlay 视图

此文件两个主题共用。不继承 LayaAir UI 基类，而是直接操作 DOM overlay。

关键实现要点：
- 创建一个全屏 DOM overlay（参考 saveload.js btnBackup 的做法）
- 背景颜色根据当前主题动态切换：cyber 用 `#04131f`，dark 用 `#222831`
- 标题 "人生故事"
- 故事内容区域：`div` + `overflow-y: auto` + `white-space: pre-wrap` + `line-height: 1.8`
- 流式追加文字：用缓冲队列 + `setInterval(30ms)` 批量追加到 `innerHTML`，实现"逐字弹出但不会太快"的效果
- 自动滚动到底部：每次追加后 `storyBox.scrollTop = storyBox.scrollHeight`
- 底部按钮栏：[中断生成] [重新生成] [再来一次(关闭overlay回到summary)]
- [中断生成] 按钮在流式进行时显示，完成后隐藏
- [重新生成] 按钮在完成后显示，点击重新调用 LLM
- [再来一次] 按钮始终显示，关闭 overlay
- 使用 AbortController 支持中断请求
- 错误处理：API 错误时显示错误信息，仍然显示关闭按钮

代码中需要 import LLMSummary：
```js
import LLMSummary from '../../modules/llmSummary.js';
```

注意：这个视图类需要被 UIManager 的 `import.meta.glob('./themes/**/*.js')` 扫描到，所以文件路径和命名必须符合 `./themes/${className}.js` 的模式。在 views.js 中路由映射为 `'llmStoryView'`（不带目录前缀）。

### 3.4 `src/ui/themes/llmSettings.js` — LLM 设置弹窗

此文件两个主题共用。DOM overlay 弹窗。

关键实现要点：
- 全屏半透明 overlay（参考 saveload.js 的 btnBackup 样式）
- 白色/浅色表单面板居中显示（宽500px，圆角）
- 三个输入框：Base URL、API Key、Model ID
- Base URL 预填提示："例如: https://api.deepseek.com"
- API Key 输入框 type="password"
- Model ID 预填 "deepseek-chat"
- [测试连接] 按钮：调用 LLMSummary.testConnection()，显示成功/失败
- [保存] 按钮：写入 localStorage，关闭弹窗
- [取消] 按钮：关闭弹窗不保存
- 从 localStorage 初始读取已有值填入输入框

代码中需要 import LLMSummary：
```js
import LLMSummary from '../../modules/llmSummary.js';
```

在 views.js 中路由映射为弹窗 `'llmSettings'`。

### 3.5 `src/ui/themes/default/summary.js` — 新增按钮

在 constructor 中新增：
```js
// 动态创建"生成人生故事"按钮（因为 LayaAir IDE 的 UI 基类中没有这个按钮）
import LLMSummary from '../../modules/llmSummary.js';

const btnStory = new runtime.ScaleButton();
btnStory.label = $lang.UI_Generate_Story;
btnStory.defaultColor = '#5865f2';
btnStory.defaultStroke = '#eeeeee';
btnStory.defaultLabel = '#eeeeee';
btnStory.hoverColor = '#1160b0';
btnStory.hoverStroke = '#eeeeee';
btnStory.hoverLabel = '#eeeeee';
btnStory.lineWidth = 0;
btnStory.radius = 4;
btnStory.width = 300;
btnStory.height = 60;
btnStory.centerX = 0;
// 位置：放在 listSummary 下方
btnStory.top = ...;  // 需要根据实际 UI 布局调整
this.addChild(btnStory);
btnStory.on(Laya.Event.CLICK, this, this.onGenerateStory);
```

新增方法：
```js
onGenerateStory() {
    if (!LLMSummary.isConfigured()) {
        $$event('message', ['M_LLMNotConfigured']);
        return;
    }
    $ui.switchView(UI.pages.LLM_STORY, {
        talents: this.#talents 当前已选天赋列表,
        trajectoryHistory: core.trajectoryHistory,
        summary: core.summary,
        enableExtend: this.#enableExtend,
    });
}
```

注意：需要把 `#talents` 传递给 llmStoryView。当前 init 方法接收 `{talents, enableExtend}` 参数，talents 存在 init 的局部使用中但没有存到实例字段。需要新增 `#talents` 私有字段保存。

同样需要在 constructor 中新增"AI 设置"按钮，或者在 init 时检查是否配置了 LLM，如果没配置则显示提示。

更简洁的做法：在 summary.js 的 init 方法中动态创建两个按钮：
- "生成人生故事" 按钮 → 切换到 LLM_STORY 页面
- 如果未配置 LLM，点击时弹出 LLM_SETTINGS 设置弹窗

### 3.6 `src/ui/themes/cyber/summary.js` — 同上

与 default 版相同的逻辑，但按钮样式使用 cyber 主题的颜色：
```js
btnStory.defaultColor = '#55fffe';
btnStory.hoverColor = '#55fffe';
// 等等，参考 cyber 主题的按钮样式
```

同样需要新增 `#talents` 私有字段和 `onGenerateStory` 方法。

### 3.7 `src/ui/views.js` — 路由变更

在 pages 对象中新增：
```js
LLM_STORY: 'LLM_STORY',
```

在 popups 对象中新增：
```js
LLM_SETTINGS: 'POPUP_LLM_SETTINGS',
```

在 cyber 的 pages 映射中新增：
```js
[pages.LLM_STORY]: 'llmStoryView',
```

在 cyber 的 popups 映射中新增：
```js
[popups.LLM_SETTINGS]: 'llmSettings',
```

在 dark 的 pages 映射中新增：
```js
[pages.LLM_STORY]: 'llmStoryView',
```

在 dark 的 popups 映射中新增：
```js
[popups.LLM_SETTINGS]: 'llmSettings',
```

注意：llmStoryView 和 llmSettings 是两个主题共用的文件（因为 DOM overlay 不依赖主题），所以两个主题映射到同一个文件名。

### 3.8 `src/i18n/zh-cn.js` — 新增翻译

在现有对象中追加：
```js
UI_Generate_Story: '生成人生故事',
UI_Title_LLM_Story: '人生故事',
UI_LLM_Not_Configured: '请先在设置中配置 AI 服务',
UI_LLM_Generating: '正在生成...',
UI_LLM_Settings: 'AI 设置',
UI_LLM_Base_URL: '服务地址',
UI_LLM_API_Key: 'API 密钥',
UI_LLM_Model_ID: '模型名称',
UI_LLM_Test_Connection: '测试连接',
UI_LLM_Save: '保存',
UI_LLM_Cancel: '取消',
UI_LLM_Connection_Success: '连接成功！',
UI_LLM_Connection_Failed: '连接失败，请检查配置',
UI_LLM_Abort: '中断生成',
UI_LLM_Regenerate: '重新生成',
UI_LLM_Close: '再来一次',
M_LLMNotConfigured: ['UI_LLM_Not_Configured'],
UI_LLM_Base_URL_Hint: '例如: https://api.deepseek.com',
```

### 3.9 `src/i18n/en-us.js` — 新增翻译

```js
UI_Generate_Story: 'Generate Life Story',
UI_Title_LLM_Story: 'Life Story',
UI_LLM_Not_Configured: 'Please configure AI service in settings first',
UI_LLM_Generating: 'Generating...',
UI_LLM_Settings: 'AI Settings',
UI_LLM_Base_URL: 'Base URL',
UI_LLM_API_Key: 'API Key',
UI_LLM_Model_ID: 'Model ID',
UI_LLM_Test_Connection: 'Test Connection',
UI_LLM_Save: 'Save',
UI_LLM_Cancel: 'Cancel',
UI_LLM_Connection_Success: 'Connection successful!',
UI_LLM_Connection_Failed: 'Connection failed, please check settings',
UI_LLM_Abort: 'Abort',
UI_LLM_Regenerate: 'Regenerate',
UI_LLM_Close: 'Play Again',
M_LLMNotConfigured: ['UI_LLM_Not_Configured'],
UI_LLM_Base_URL_Hint: 'e.g. https://api.deepseek.com',
```

### 3.10 `repl/app.js` — CLI 版改动

#### 3.10.1 新增 import

在文件顶部（约第8行之后）新增：
```js
import LLMSummary from '../src/modules/llmSummary.js';
```

#### 3.10.2 加载 .env 配置

在 App 构造函数中或在 `initial()` 方法中，读取项目启动目录下的 `.env` 文件：
```js
// 在 constructor 或 initial 中
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

const envPath = `${__dirname}/../.env`;  // 项目根目录的 .env
if (existsSync(envPath)) {
    const envContent = await readFile(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        switch (key.trim()) {
            case 'LLM_BASE_URL':
                LLMSummary.cliConfig.baseUrl = value;
                break;
            case 'LLM_API_KEY':
                LLMSummary.cliConfig.apiKey = value;
                break;
            case 'LLM_MODEL_ID':
                LLMSummary.cliConfig.modelId = value;
                break;
        }
    });
}

// 也可以从环境变量读取（优先级高于 .env）
if (process.env.LLM_BASE_URL) LLMSummary.cliConfig.baseUrl = process.env.LLM_BASE_URL;
if (process.env.LLM_API_KEY) LLMSummary.cliConfig.apiKey = process.env.LLM_API_KEY;
if (process.env.LLM_MODEL_ID) LLMSummary.cliConfig.modelId = process.env.LLM_MODEL_ID;
```

注意：repl/app.js 的 constructor 不是 async 的，initial() 是 async 的。所以 .env 加载应该在 initial() 中。

#### 3.10.3 新增 /story 命令

在 repl() 方法的 switch 中新增：
```js
case 'st':
case 'story':
case '/story':
    return this.generateStory();
```

在 help() 中追加 story 命令的帮助信息。

#### 3.10.4 新增 generateStory() 方法

```js
async generateStory() {
    if (!LLMSummary.isConfigured()) {
        return '请先配置 LLM：\n' +
               '  在项目根目录创建 .env 文件：\n' +
               '    LLM_BASE_URL=https://api.deepseek.com\n' +
               '    LLM_API_KEY=sk-xxx\n' +
               '    LLM_MODEL_ID=deepseek-chat\n' +
               '  或设置环境变量后启动';
    }
    if (this.#step !== this.Steps.SUMMARY) {
        return '只有在人生总结阶段才能生成人生故事';
    }

    this.output('\n正在生成人生故事...\n');

    try {
        const fullText = await LLMSummary.streamStoryForCLI(
            this.#life.trajectoryHistory,
            this.#life.summary,
            Array.from(this.#talentSelected),
            (chunk) => this.output(chunk)
        );
        this.output('\n\n故事生成完毕。键入 /next 开始新人生\n', true);
        return fullText;
    } catch (e) {
        this.output(`\n生成失败: ${e.message}\n`, true);
        return `生成失败: ${e.message}`;
    }
}
```

注意：generateStory 是 async 方法，但 repl() 是同步的。需要调整 repl/io 的处理逻辑以支持 async 命令。

查看 repl/app.js 的 io() 方法（约258行）：
```js
io(input, output, exit) {
    this.#output = output
    this.#exit = exit
    input(command => {
        const ret = this.repl(command)
        if (!ret) return
        if (typeof ret == 'string') return this.output(ret, true)
        if (Array.isArray(ret)) return this.output(...ret)
        const { message, isRepl } = ret
        return this.output(message, isRepl)
    })
}
```

需要修改为支持 async 返回值：
```js
input(async command => {
    const ret = await this.repl(command)
    // ...existing handling...
})
```

并让 repl() 方法也支持 async：
```js
async repl(command) {
    command = command.split(/\s+/)
    switch (command.shift()) {
        // ...existing cases...
        case 'st':
        case 'story':
        case '/story':
            return this.generateStory()
        // ...
    }
}
```

这样 generateStory() 返回的 Promise 会被 await。

## 四、重要约束

1. **不修改** `public/libs/laya/` 下的引擎库文件
2. **不修改** `src/ui/layaUI.max.all.js`（LayaAir IDE 自动生成）
3. **不修改** `src/@types/LayaAir.d.ts`（自动生成类型定义）
4. DOM overlay 的 z-index 要高于 LayaAir Canvas（10000+）
5. llmStoryView.js 和 llmSettings.js 必须放在 `src/ui/themes/` 目录下，这样 UIManager 的 `import.meta.glob('./themes/**/*.js')` 能扫描到
6. 两个主题（default/cyber）的 summary.js 都需要改，逻辑相同但按钮样式不同
7. 项目的 `"type": "module"` 是 ESM，所有 import/export 使用 ESM 语法
8. localStorage 在 CLI 版中已经被 polyfill（repl/index.js），但 LLMSummary 的 CLI 版应该用 cliConfig 而不是 localStorage

## 五、测试要点

1. 不配置 LLM 时，点击"生成人生故事"应该弹出提示"请先配置"
2. 配置 LLM 后点击，应该弹出 overlay 开始流式输出
3. 流式输出过程中点击"中断"应该停止生成
4. 生成完成后"重新生成"按钮应该可点击
5. "再来一次"按钮关闭 overlay 回到 summary 页
6. AI 设置弹窗保存后，下次打开应回显之前的值
7. 测试连接按钮应该正确返回成功/失败
8. CLI 版 /story 命令在未配置时应返回提示
9. CLI 版 /story 命令在非 SUMMARY 状态时应返回提示
10. 跨域问题：如果 API 不支持 CORS，Web 版会报错，需要友好提示

## 六、项目现有代码参考

- DOM overlay 先例：`src/ui/themes/saveload.js` 的 `btnBackup.onclick`（约64-127行）
- 动态创建按钮先例：`src/ui/runtime.js` 的 `runtime.ScaleButton` 类
- UIManager 视图加载机制：`src/ui/uiManager.js` 的 `import.meta.glob('./themes/**/*.js')`
- 路由映射：`src/ui/views.js` 的 pages/popups 映射表
- 全局变量：`core`(Life实例)、`$ui`(UIManager实例)、`$lang`(i18n)、`$_`(util)
- 全局事件系统：`$$on`/`$$off`/`$$event`
