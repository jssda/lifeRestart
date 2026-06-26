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
        const lines = trajectoryHistory.map(({age, content}) => {
            const events = content.map(c => {
                if (c.type === 'TLT') return `天赋【${c.name}】发动：${c.description}`;
                if (c.type === 'EVT') return c.description + (c.postEvent ? `\n${c.postEvent}` : '');
                return c.description || '';
            }).join('；');
            return `${age}岁：${events}`;
        });

        const talentNames = Array.isArray(talents)
            ? talents.map(t => typeof t === 'object' ? t.name : t).join('、')
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
                    temperature: 0.8,
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
                    temperature: 0.8,
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
