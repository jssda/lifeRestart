import LLMSummary from '../../../modules/llmSummary.js';
import { showStoryOverlay, showSettingsOverlay } from '../llmStoryView.js';

export default class Summary extends ui.view.DefaultTheme.SummaryUI {
    constructor() {
        super();
        this.listSummary.renderHandler = Laya.Handler.create(this, this.renderSummary, null, false);
        this.listSelectedTalents.renderHandler = Laya.Handler.create(this, this.renderTalent, null, false);
        this.btnAgain.on(Laya.Event.CLICK, this, this.onAgain);
    }

    #selectedTalent;
    #enableExtend;
    #talents;
    #domBtns = [];

    onAgain() {
        core.talentExtend(this.#selectedTalent);
        core.times ++;
        $ui.switchView(UI.pages.MAIN);
    }

    onGenerateStory() {
        if (!LLMSummary.isConfigured()) {
            $$event('message', ['M_LLMNotConfigured']);
            showSettingsOverlay();
            return;
        }
        showStoryOverlay({
            talents: this.#talents,
            trajectoryHistory: core.trajectoryHistory,
            summary: core.summary,
            enableExtend: this.#enableExtend,
        });
    }

    onLLMSettings() {
        showSettingsOverlay();
    }

    init({talents, enableExtend}) {
        const {summary, lastExtendTalent} = core;
        this.#enableExtend = enableExtend;
        this.#talents = talents;

        // 添加 DOM 按钮
        this.#addDomButtons();

        this.listSummary.array = [
            [core.PropertyTypes.HCHR, $lang.UI_Property_Charm],
            [core.PropertyTypes.HINT, $lang.UI_Property_Intelligence],
            [core.PropertyTypes.HSTR, $lang.UI_Property_Strength],
            [core.PropertyTypes.HMNY, $lang.UI_Property_Money],
            [core.PropertyTypes.HSPR, $lang.UI_Property_Spirit],
            [core.PropertyTypes.HAGE, $lang.UI_Final_Age],
            [core.PropertyTypes.SUM, $lang.UI_Total_Judge],
        ].map(([type, key]) => {
            const data = summary[type];
            return {
                label: `${key}${$lang.UI_Colon} ${data.value} ${$lang[data.judge]}`,
                grade: data.grade,
            }
        });

        talents.sort(({id:a, grade:ag}, {id:b, grade:bg},)=>{
            if(a == lastExtendTalent) return -1;
            if(b == lastExtendTalent) return 1;
            return bg - ag;
        });
        if(this.#enableExtend) {
            this.#selectedTalent = talents[0].id;
        } else {
            this.#selectedTalent = lastExtendTalent;
        }
        this.listSelectedTalents.array = talents;
    }
    renderSummary(box) {
        const {label, grade} = box.dataSource;
        box.label = label;
        $_.deepMapSet(box, $ui.common.summary[grade]);
    }
    renderTalent(box) {
        const dataSource = box.dataSource;
        box.label = $_.format($lang.F_TalentSelection, dataSource);
        const style = $ui.common.card[dataSource.grade];
        $_.deepMapSet(box, dataSource.id == this.#selectedTalent? style.selected: style.normal);
        box.getChildByName('blank').pause = dataSource.id != this.#selectedTalent;
        box.off(Laya.Event.CLICK, this, this.onSelectTalent);
        box.on(Laya.Event.CLICK, this, this.onSelectTalent, [dataSource.id]);
    }

    onSelectTalent(talentId) {
        if(!this.#enableExtend) {
            return $$event('message', ['M_DisableExtendTalent']);
        }
        if(talentId == this.#selectedTalent) {
            this.#selectedTalent = null;
        } else {
            this.#selectedTalent = talentId;
        }

        this.listSelectedTalents.refresh();
    }

    #addDomButtons() {
        // 清除旧按钮
        this.#domBtns.forEach(b => b.remove());
        this.#domBtns = [];

        // "生成人生故事"按钮
        const btnStory = document.createElement('button');
        btnStory.textContent = $lang.UI_Generate_Story;
        btnStory.style.cssText = `
            position: fixed; top: 15px; left: 15px; z-index: 9999;
            background: rgba(88,101,242,0.9); color: #fff; border: none;
            padding: 8px 16px; font-size: 14px; border-radius: 6px; cursor: pointer;
            font-family: SimHei, 'Microsoft YaHei', sans-serif; backdrop-filter: blur(4px);
            transition: background 0.2s;
        `;
        btnStory.onmouseover = () => btnStory.style.background = 'rgba(17,96,176,0.9)';
        btnStory.onmouseout = () => btnStory.style.background = 'rgba(88,101,242,0.9)';
        btnStory.onclick = () => this.onGenerateStory();
        document.body.appendChild(btnStory);
        this.#domBtns.push(btnStory);

        // "AI设置"按钮
        const btnSettings = document.createElement('button');
        btnSettings.textContent = $lang.UI_LLM_Settings;
        btnSettings.style.cssText = `
            position: fixed; top: 15px; right: 15px; z-index: 9999;
            background: rgba(135,100,222,0.9); color: #fff; border: none;
            padding: 8px 16px; font-size: 14px; border-radius: 6px; cursor: pointer;
            font-family: SimHei, 'Microsoft YaHei', sans-serif; backdrop-filter: blur(4px);
            transition: background 0.2s;
        `;
        btnSettings.onmouseover = () => btnSettings.style.background = 'rgba(151,116,238,0.9)';
        btnSettings.onmouseout = () => btnSettings.style.background = 'rgba(135,100,222,0.9)';
        btnSettings.onclick = () => this.onLLMSettings();
        document.body.appendChild(btnSettings);
        this.#domBtns.push(btnSettings);
    }

    close() {
        this.#domBtns.forEach(b => b.remove());
        this.#domBtns = [];
    }
}