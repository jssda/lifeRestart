import LLMSummary from '../../modules/llmSummary.js';

// 纯 DOM overlay 视图，不经过 UIManager，由 summary.js 直接调用
export function showStoryOverlay({talents, trajectoryHistory, summary, enableExtend}) {
    let abortController = null;
    let chunkQueue = [];
    let flushTimer = null;
    let storyBox = null;
    let btnAbort = null;
    let btnRegenerate = null;

    const isCyber = $ui.theme === 'cyber';
    const bgColor = isCyber ? '#04131f' : '#222831';
    const accentColor = isCyber ? '#55fffe' : '#5865f2';

    // 创建 DOM overlay（半透明遮罩 + 居中面板，不遮挡 Summary 底层）
    const overlay = document.createElement('div');
    overlay.id = 'llm-story-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6); z-index: 10000;
        display: flex; flex-direction: column; align-items: center;
        padding: 20px; box-sizing: border-box;
    `;
    document.body.appendChild(overlay);

    // 标题
    const title = document.createElement('div');
    title.textContent = $lang.UI_Title_LLM_Story;
    title.style.cssText = `
        font-size: 28px; color: ${accentColor}; text-align: center;
        margin-bottom: 16px; letter-spacing: 4px; flex-shrink: 0;
        font-family: SimHei, 'Microsoft YaHei', sans-serif;
    `;
    overlay.appendChild(title);

    // 故事内容区域（可滚动）
    storyBox = document.createElement('div');
    storyBox.style.cssText = `
        width: 90%; max-width: 800px; flex: 1; overflow-y: auto; font-size: 16px;
        color: #eee; line-height: 1.8; padding: 16px;
        white-space: pre-wrap; word-break: break-all;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 8px; background: ${bgColor};
        font-family: SimHei, 'Microsoft YaHei', sans-serif;
    `;
    overlay.appendChild(storyBox);

    // 底部按钮栏
    const btnBar = document.createElement('div');
    btnBar.style.cssText = `
        display: flex; justify-content: center; gap: 16px;
        padding: 12px 0; flex-wrap: wrap; flex-shrink: 0;
    `;
    overlay.appendChild(btnBar);

    // "中断生成"按钮
    btnAbort = document.createElement('button');
    btnAbort.textContent = $lang.UI_LLM_Abort;
    btnAbort.style.cssText = `
        background: #eb3941; color: #fff; border: none;
        padding: 12px 28px; font-size: 16px; border-radius: 8px;
        cursor: pointer; transition: background 0.2s;
    `;
    btnAbort.onmouseover = () => btnAbort.style.background = '#ff0000';
    btnAbort.onmouseout = () => btnAbort.style.background = '#eb3941';
    btnAbort.onclick = () => abortStream();
    btnBar.appendChild(btnAbort);

    // "重新生成"按钮（初始隐藏）
    btnRegenerate = document.createElement('button');
    btnRegenerate.textContent = $lang.UI_LLM_Regenerate;
    btnRegenerate.style.cssText = `
        background: ${accentColor}; color: #fff; border: none;
        padding: 12px 28px; font-size: 16px; border-radius: 8px;
        cursor: pointer; display: none; transition: background 0.2s;
    `;
    btnRegenerate.onclick = () => startStream();
    btnBar.appendChild(btnRegenerate);

    // "复制内容"按钮（初始隐藏，生成完成后显示）
    const btnCopy = document.createElement('button');
    btnCopy.textContent = $lang.UI_LLM_Copy;
    btnCopy.style.cssText = `
        background: #8764de; color: #fff; border: none;
        padding: 12px 28px; font-size: 16px; border-radius: 8px;
        cursor: pointer; display: none; transition: background 0.2s;
    `;
    btnCopy.onmouseover = () => btnCopy.style.background = '#9774ee';
    btnCopy.onmouseout = () => btnCopy.style.background = '#8764de';
    btnCopy.onclick = () => {
        const text = storyBox.textContent;
        navigator.clipboard.writeText(text).then(() => {
            btnCopy.textContent = $lang.UI_LLM_Copied;
            setTimeout(() => { btnCopy.textContent = $lang.UI_LLM_Copy; }, 2000);
        }).catch(() => {
            // 降级方案
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            btnCopy.textContent = $lang.UI_LLM_Copied;
            setTimeout(() => { btnCopy.textContent = $lang.UI_LLM_Copy; }, 2000);
        });
    };
    btnBar.appendChild(btnCopy);

    // "下载 Markdown"按钮（初始隐藏，生成完成后显示）
    const btnDownload = document.createElement('button');
    btnDownload.textContent = $lang.UI_LLM_Download;
    btnDownload.style.cssText = `
        background: #f59e0b; color: #fff; border: none;
        padding: 12px 28px; font-size: 16px; border-radius: 8px;
        cursor: pointer; display: none; transition: background 0.2s;
    `;
    btnDownload.onmouseover = () => btnDownload.style.background = '#d97706';
    btnDownload.onmouseout = () => btnDownload.style.background = '#f59e0b';
    btnDownload.onclick = () => {
        const text = storyBox.textContent;
        const date = new Date();
        const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        const md = `# 人生故事\n\n> 由人生重开模拟器生成 | ${dateStr}\n\n---\n\n${text}\n`;
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `人生故事_${dateStr}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    btnBar.appendChild(btnDownload);

    // "关闭"按钮
    const btnClose = document.createElement('button');
    btnClose.textContent = $lang.UI_LLM_Close;
    btnClose.style.cssText = `
        background: #28b070; color: #fff; border: none;
        padding: 12px 28px; font-size: 16px; border-radius: 8px;
        cursor: pointer; transition: background 0.2s;
    `;
    btnClose.onmouseover = () => btnClose.style.background = '#00cc55';
    btnClose.onmouseout = () => btnClose.style.background = '#28b070';
    btnClose.onclick = () => closeOverlay();
    btnBar.appendChild(btnClose);

    // "AI设置"按钮（初始隐藏，未配置时显示）
    const btnSettings = document.createElement('button');
    btnSettings.textContent = $lang.UI_LLM_Settings;
    btnSettings.style.cssText = `
        background: #8764de; color: #fff; border: none;
        padding: 12px 28px; font-size: 16px; border-radius: 8px;
        cursor: pointer; display: none; transition: background 0.2s;
    `;
    btnSettings.onclick = () => {
        closeOverlay();
        showSettingsOverlay();
    };
    btnBar.appendChild(btnSettings);

    function closeOverlay() {
        if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
        if (abortController) { abortController.abort(); abortController = null; }
        if (overlay.parentNode) overlay.remove();
    }

    function abortStream() {
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
    }

    function flushQueue() {
        if (chunkQueue.length === 0) return;
        const batch = chunkQueue.splice(0);
        storyBox.textContent += batch.join('');
        storyBox.scrollTop = storyBox.scrollHeight;
    }

    function onStreamComplete() {
        if (flushTimer) { clearInterval(flushTimer); flushTimer = null; flushQueue(); }
        btnAbort.style.display = 'none';
        btnRegenerate.style.display = 'inline-block';
        btnCopy.style.display = 'inline-block';
        btnDownload.style.display = 'inline-block';
    }

    async function startStream() {
        if (!LLMSummary.isConfigured()) {
            storyBox.textContent = $lang.UI_LLM_Not_Configured;
            btnAbort.style.display = 'none';
            btnRegenerate.style.display = 'none';
            btnSettings.style.display = 'inline-block';
            return;
        }

        abortController = new AbortController();
        storyBox.textContent = '正在连接 AI 服务...\n\n';
        chunkQueue = [];
        btnAbort.style.display = 'inline-block';
        btnRegenerate.style.display = 'none';
        btnSettings.style.display = 'none';
        btnCopy.style.display = 'none';
        btnDownload.style.display = 'none';

        flushTimer = setInterval(flushQueue, 30);

        try {
            const stream = LLMSummary.streamStory(
                trajectoryHistory,
                summary,
                talents,
                abortController.signal,
            );

            for await (const chunk of stream) {
                chunkQueue.push(chunk);
            }
            // 如果没有收到任何 chunk
            if (storyBox.textContent === '正在连接 AI 服务...\n\n') {
                storyBox.textContent = 'AI 服务返回了空内容，请检查模型配置或重试。';
            }
            onStreamComplete();
        } catch (e) {
            // 停止 flushTimer 以确保错误信息能显示
            if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
            if (e.name === 'AbortError') {
                storyBox.textContent += '\n\n[已中断生成]';
            } else if (e.message?.includes('Failed to fetch') || e.message?.includes('ERR_FAILED')) {
                storyBox.textContent = '连接 AI 服务失败。可能原因：\n\n' +
                    '1. CORS 跨域限制 — 浏览器不允许直接访问该 API\n' +
                    '   解决：换用支持 CORS 的 API（如 DeepSeek），\n' +
                    '   或使用本地 Ollama (http://localhost:11434/v1)\n\n' +
                    '2. API 地址不正确 — 请检查 Base URL 是否包含 /v1\n' +
                    '   例如：https://api.deepseek.com/v1\n\n' +
                    '3. API Key 无效或网络不通\n\n' +
                    '错误详情：' + e.message;
            } else {
                storyBox.textContent += `\n\n[生成失败: ${e.message}]`;
            }
            onStreamComplete();
        }
    }

    startStream();
}

// LLM 设置弹窗 — 纯 DOM overlay
export function showSettingsOverlay() {
    const isCyber = $ui.theme === 'cyber';
    const bgColor = isCyber ? '#04131f' : '#222831';
    const accentColor = isCyber ? '#55fffe' : '#5865f2';

    const overlay = document.createElement('div');
    overlay.id = 'llm-settings-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.7); z-index: 10001;
        display: flex; align-items: center; justify-content: center;
    `;
    document.body.appendChild(overlay);

    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const panel = document.createElement('div');
    panel.style.cssText = `
        background: ${bgColor};
        border: 1px solid rgba(255,255,255,0.3);
        border-radius: 12px; padding: 24px; width: 460px;
        max-height: 80vh; box-sizing: border-box;
        color: #eee; font-family: SimHei, 'Microsoft YaHei', sans-serif;
    `;
    overlay.appendChild(panel);

    const title = document.createElement('div');
    title.textContent = $lang.UI_LLM_Settings;
    title.style.cssText = `
        font-size: 22px; text-align: center; margin-bottom: 20px;
        color: ${accentColor}; letter-spacing: 2px;
    `;
    panel.appendChild(title);

    function createInputGroup(label, placeholder, value, type) {
        const group = document.createElement('div');
        group.style.cssText = `margin-bottom: 16px;`;

        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.style.cssText = `display: block; font-size: 14px; margin-bottom: 6px; color: #aaa;`;
        group.appendChild(labelEl);

        const input = document.createElement('input');
        input.type = type;
        input.value = value || '';
        input.placeholder = placeholder;
        input.style.cssText = `
            width: 100%; padding: 10px 12px; font-size: 14px;
            background: rgba(255,255,255,0.1); color: #eee;
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 6px; box-sizing: border-box; outline: none;
        `;
        input.onfocus = () => input.style.borderColor = accentColor;
        input.onblur = () => input.style.borderColor = 'rgba(255,255,255,0.2)';
        group.appendChild(input);

        return group;
    }

    const baseUrlGroup = createInputGroup(
        $lang.UI_LLM_Base_URL,
        $lang.UI_LLM_Base_URL_Hint,
        LLMSummary.config.baseUrl,
        'text'
    );
    panel.appendChild(baseUrlGroup);

    const apiKeyGroup = createInputGroup(
        $lang.UI_LLM_API_Key,
        'sk-...',
        LLMSummary.config.apiKey,
        'password'
    );
    panel.appendChild(apiKeyGroup);

    const modelIdGroup = createInputGroup(
        $lang.UI_LLM_Model_ID,
        'deepseek-chat',
        LLMSummary.config.modelId,
        'text'
    );
    panel.appendChild(modelIdGroup);

    const testResult = document.createElement('div');
    testResult.style.cssText = `text-align: center; margin-top: 8px; font-size: 14px; min-height: 20px;`;

    const btnBar = document.createElement('div');
    btnBar.style.cssText = `display: flex; justify-content: center; gap: 12px; margin-top: 20px;`;
    panel.appendChild(btnBar);

    const btnTest = document.createElement('button');
    btnTest.textContent = $lang.UI_LLM_Test_Connection;
    btnTest.style.cssText = `background: #8764de; color: #fff; border: none; padding: 10px 20px; font-size: 14px; border-radius: 6px; cursor: pointer;`;
    btnTest.onclick = async () => {
        LLMSummary.config.baseUrl = baseUrlGroup.querySelector('input').value;
        LLMSummary.config.apiKey = apiKeyGroup.querySelector('input').value;
        const ok = await LLMSummary.testConnection();
        testResult.textContent = ok ? $lang.UI_LLM_Connection_Success : $lang.UI_LLM_Connection_Failed;
        testResult.style.color = ok ? '#28b070' : '#eb3941';
    };
    btnBar.appendChild(btnTest);

    const btnSave = document.createElement('button');
    btnSave.textContent = $lang.UI_LLM_Save;
    btnSave.style.cssText = `background: #28b070; color: #fff; border: none; padding: 10px 20px; font-size: 14px; border-radius: 6px; cursor: pointer;`;
    btnSave.onclick = () => {
        LLMSummary.config.baseUrl = baseUrlGroup.querySelector('input').value;
        LLMSummary.config.apiKey = apiKeyGroup.querySelector('input').value;
        LLMSummary.config.modelId = modelIdGroup.querySelector('input').value;
        overlay.remove();
    };
    btnBar.appendChild(btnSave);

    const btnCancel = document.createElement('button');
    btnCancel.textContent = $lang.UI_LLM_Cancel;
    btnCancel.style.cssText = `background: #eb3941; color: #fff; border: none; padding: 10px 20px; font-size: 14px; border-radius: 6px; cursor: pointer;`;
    btnCancel.onclick = () => overlay.remove();
    btnBar.appendChild(btnCancel);

    panel.appendChild(testResult);
}
