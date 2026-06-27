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
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            return this.config;
        }
        return this.cliConfig;
    }

    static buildPrompt(trajectoryHistory, summary, talents) {
        const PROP_LABELS = {
            CHR: '颜值', INT: '智力', STR: '体质',
            MNY: '家境', SPR: '快乐', LIF: '生命',
        };

        const formatEffect = (eff) => {
            if (!eff) return '';
            const parts = [];
            for (const k in eff) {
                const label = PROP_LABELS[k] || (k === 'RDM' ? '随机属性' : k);
                const v = eff[k];
                parts.push(`${label}${v > 0 ? '+' : ''}${v}`);
            }
            return parts.join('，');
        };

        const formatProperty = (p) => {
            if (!p) return '';
            return `颜值${p.CHR}/智力${p.INT}/体质${p.STR}/家境${p.MNY}/快乐${p.SPR}`;
        };

        const initialProperty = formatProperty(trajectoryHistory[0]?.property);

        const lines = trajectoryHistory.map(({age, content, property}) => {
            const events = content.map(c => {
                const change = formatEffect(c.effect);
                const base = c.type === 'TLT'
                    ? `天赋【${c.name}】发动：${c.description}`
                    : c.description + (c.postEvent ? `\n${c.postEvent}` : '');
                return change ? `${base}（${change}）` : base;
            }).join('；');
            const hasEffect = content.some(c => c.effect && Object.keys(c.effect).length > 0);
            const propStr = hasEffect ? `[${formatProperty(property)}] ` : '';
            return `${age}岁：${propStr}${events}`;
        });

        const talentList = Array.isArray(talents) && talents.length
            ? talents.map(t => {
                if (typeof t === 'object' && t) {
                    return `- 【${t.name}】${t.description || ''}`;
                }
                return `- 【${t}】`;
            }).join('\n')
            : '无';

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

        return `你是一位故事讲述者，现在要根据下面一个人的一生经历，用第二人称「你」扩写成一段连贯的人生故事。

以下素材是「你」的一生：初始属性、拥有的天赋、每年经历的事件、事件发生前的属性状态、以及每个事件带来的属性变化。请挑出其中值得讲的经历扩写成有画面感的故事，按年龄顺序自然推进。

要求：
1. 全程用「你」称呼主角，像在给主角讲述他自己的生平
2. 挑有转折、有变化、离谱或关键的事件重点扩写成丰满的故事；平淡无奇的年份直接跳过或一笔带过，不要逐年流水账
3. 自然融入每个事件带来的属性变化（例如颜值涨了、快乐跌了），让变化成为故事的一部分，不要生硬标注
4. 适度体现事件之间的因果和影响，但不必强行关联
5. 不要评判打分，不要总结评语，只讲故事
6. 篇幅适中，重点处写丰满，平淡处别注水

「你」的素材如下：

初始属性：${initialProperty}

天赋：
${talentList}

人生轨迹（年龄：[事件前属性] 事件 / 属性变化）：
${lines.join('\n')}

人生总评：${props}

请开始讲述「你」的故事：`;
    }

    // Web 版：流式调用，返回 AsyncGenerator
    static async *streamStory(trajectoryHistory, summary, talents, abortSignal) {
        const prompt = this.buildPrompt(trajectoryHistory, summary, talents);
        const cfg = this.getConfig();

        const response = await fetch(
            `${cfg.baseUrl.replace(/\/+$/,'')}/chat/completions`,
            {
                method: 'POST',
                signal: abortSignal,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cfg.apiKey}`,
                },
                body: JSON.stringify({
                    model: cfg.modelId,
                    messages: [{ role: 'user', content: prompt }],
                    stream: true,
                    max_tokens: 8000,
                    temperature: 0.9,
                    // 关闭思考模式，避免用户长时间等待
                    enable_thinking: false,
                    thinking: { type: 'disabled' },
                    // 兼容部分模型的重采样参数
                    chat_template_kwargs: { enable_thinking: false },
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
            `${cfg.baseUrl.replace(/\/+$/,'')}/chat/completions`,
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
                    temperature: 0.9,
                    enable_thinking: false,
                    thinking: { type: 'disabled' },
                    chat_template_kwargs: { enable_thinking: false },
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

    // 测试连接：调用 /models 检查 API 是否可用
    static async testConnection() {
        const cfg = this.getConfig();
        try {
            const response = await fetch(
                `${cfg.baseUrl.replace(/\/+$/,'')}/models`,
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
