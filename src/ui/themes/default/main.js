import { showSettingsOverlay } from '../llmStoryView.js';

export default class Main extends ui.view.DefaultTheme.MainUI {
    constructor() {
        super();
        this.btnRemake.on(Laya.Event.CLICK, this, ()=>$ui.switchView(UI.pages.MODE));
        this.btnAchievement.on(Laya.Event.CLICK, this, ()=>$ui.switchView(UI.pages.ACHIEVEMENT));
        this.btnThanks.on(Laya.Event.CLICK, this, ()=>$ui.switchView(UI.pages.THANKS));
        this.btnGithub.on(Laya.Event.CLICK, this, goto, ['github']);
        this.btnDiscord.on(Laya.Event.CLICK, this, goto, ['discord']);
        this.btnThemes.on(Laya.Event.CLICK, this, ()=>$ui.showDialog(UI.pages.THEMES));
        this.btnSaveLoad.on(Laya.Event.CLICK, this, ()=>$ui.showDialog(UI.pages.SAVELOAD));
    }

    static load() {
        return [
            "images/atlas/images/icons.atlas",
        ]
    }

    #llmSettingsBtn = null;

    init() {
        this.banner.visible =
        this.btnDiscord.visible =
        this.btnAchievement.visible =
        this.btnThanks.visible = !!core.times;
        const text = this.labSubTitle.text;
        this.labSubTitle.text = ' ';
        this.labSubTitle.text = text;

        // 添加 AI 设置 DOM 按钮
        if (!this.#llmSettingsBtn) {
            const btn = document.createElement('button');
            btn.textContent = $lang.UI_LLM_Settings;
            btn.style.cssText = `
                position: fixed; top: 15px; right: 15px; z-index: 9999;
                background: rgba(88,101,242,0.9); color: #fff; border: none;
                padding: 8px 16px; font-size: 14px; border-radius: 6px;
                cursor: pointer; font-family: SimHei, 'Microsoft YaHei', sans-serif;
                backdrop-filter: blur(4px); transition: background 0.2s;
            `;
            btn.onmouseover = () => btn.style.background = 'rgba(17,96,176,0.9)';
            btn.onmouseout = () => btn.style.background = 'rgba(88,101,242,0.9)';
            btn.onclick = () => showSettingsOverlay();
            document.body.appendChild(btn);
            this.#llmSettingsBtn = btn;
        }
        this.#llmSettingsBtn.style.display = 'block';
    }

    close() {
        if (this.#llmSettingsBtn) {
            this.#llmSettingsBtn.style.display = 'none';
        }
    }
}