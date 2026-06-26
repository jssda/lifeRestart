import { showSettingsOverlay } from '../llmStoryView.js';

export default class CyberMain extends ui.view.CyberTheme.CyberMainUI {
    constructor() {
        super();
        this.btnRemake.on(Laya.Event.CLICK, this, ()=>$ui.switchView(UI.pages.MODE));
        this.btnAchievement.on(Laya.Event.CLICK, this, ()=>$ui.switchView(UI.pages.ACHIEVEMENT));
        this.btnThanks.on(Laya.Event.CLICK, this, ()=>$ui.switchView(UI.pages.THANKS));
        this.btnGithub.on(Laya.Event.CLICK, this, goto, ['github']);
        this.btnDiscord.on(Laya.Event.CLICK, this, goto, ['discord']);
        this.btnThemes.on(Laya.Event.CLICK, this, ()=>$ui.showDialog(UI.pages.THEMES));
        this.btnSaveLoad.on(Laya.Event.CLICK, this, ()=>$ui.showDialog(UI.pages.SAVELOAD));
        this.on(Laya.Event.RESIZE, this, () => {
            const scale = Math.max(
                this.width / this.imgBg.width,
                this.height / this.imgBg.height
            );
            this.imgBg.scale(scale, scale);
        });
    }

    static load() {
        return [
            "fonts/方正像素12.ttf",
            "images/atlas/images/accessories.atlas",
            "images/atlas/images/border.atlas",
            "images/atlas/images/button.atlas",
            "images/atlas/images/icons.atlas",
            "images/atlas/images/progress.atlas",
            "images/atlas/images/slider.atlas",
        ]
    }

    #llmSettingsBtn = null;

    init() {
        this.banner.visible =
        this.btnDiscord.visible =
        this.btnAchievement.visible =
        this.btnThanks.visible = !!core.times;

        // 添加 AI 设置 DOM 按钮
        if (!this.#llmSettingsBtn) {
            const btn = document.createElement('button');
            btn.textContent = $lang.UI_LLM_Settings;
            btn.style.cssText = `
                position: fixed; top: 15px; right: 15px; z-index: 9999;
                background: rgba(85,255,254,0.15); color: #55fffe; border: 1px solid #55fffe;
                padding: 8px 16px; font-size: 14px; border-radius: 6px;
                cursor: pointer; font-family: SimHei, 'Microsoft YaHei', sans-serif;
                backdrop-filter: blur(4px); transition: all 0.2s;
            `;
            btn.onmouseover = () => { btn.style.background = 'rgba(85,255,254,0.3)'; };
            btn.onmouseout = () => { btn.style.background = 'rgba(85,255,254,0.15)'; };
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