import LLMSummary from '../../../modules/llmSummary.js';
import { showStoryOverlay, showSettingsOverlay } from '../llmStoryView.js';

export default class CyberSummary extends ui.view.CyberTheme.CyberSummaryUI {
    constructor() {
        super();
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

        const gradeFilters = $ui.common.filter;
        const gradeColors = $ui.common.grade;

        const age = summary[core.PropertyTypes.HAGE];
        this.labAge.text = ''+age.value;
        this.labAgeJudge.text = age.judge;
        this.labAgeJudge.color = gradeColors[age.grade];

        const sum = summary[core.PropertyTypes.SUM];
        this.labTotal.text = ''+sum.value;
        this.labTotalJudge.text = sum.judge;
        this.labTotalJudge.color = gradeColors[sum.grade];

        const chr = summary[core.PropertyTypes.HCHR];
        this.labCharm.text = ''+chr.value;
        this.prgCharm.value = chr.progress;
        this.labCharmJudge.text = chr.judge;
        this.labCharmJudge.color = gradeColors[chr.grade];
        this.boxCharmGrade.colorFilter = gradeFilters[chr.grade];

        const int = summary[core.PropertyTypes.HINT];
        this.labIntelligence.text = ''+int.value;
        this.prgIntelligence.value = int.progress;
        this.labIntelligenceJudge.text = int.judge;
        this.labIntelligenceJudge.color = gradeColors[int.grade];
        this.boxIntelligenceGrade.colorFilter = gradeFilters[int.grade];

        const str = summary[core.PropertyTypes.HSTR];
        this.labStrength.text = ''+str.value;
        this.prgStrength.value = str.progress;
        this.labStrengthJudge.text = str.judge;
        this.labStrengthJudge.color = gradeColors[str.grade];
        this.boxStrengthGrade.colorFilter = gradeFilters[str.grade];

        const mny = summary[core.PropertyTypes.HMNY];
        this.labMoney.text = ''+mny.value;
        this.prgMoney.value = mny.progress;
        this.labMoneyJudge.text = mny.judge;
        this.labMoneyJudge.color = gradeColors[mny.grade];
        this.boxMoneyGrade.colorFilter = gradeFilters[mny.grade];

        const spr = summary[core.PropertyTypes.HSPR];
        this.labSpirit.text = ''+spr.value;
        this.prgSpirit.value = spr.progress;
        this.labSpiritJudge.text = spr.judge;
        this.labSpiritJudge.color = gradeColors[spr.grade];
        this.boxSpiritGrade.colorFilter = gradeFilters[spr.grade];

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

    renderTalent(box) {
        const dataSource = box.dataSource;

        const labTitle = box.getChildByName("labTitle");
        const grade1 = box.getChildByName("grade1");
        const grade2 = box.getChildByName("grade2");
        const grade3 = box.getChildByName("grade3");
        const labDescription = box.getChildByName("labDescription");
        const selected = box.getChildByName("selected");
        const unselected = box.getChildByName("unselected");

        labTitle.text = dataSource.name;
        labDescription.text = dataSource.description;
        switch (dataSource.grade) {
            case 1:
                grade1.visible = true;
                grade2.visible = false;
                grade3.visible = false;
                break;
            case 2:
                grade1.visible = false;
                grade2.visible = true;
                grade3.visible = false;
                break;
            case 3:
                grade1.visible = false;
                grade2.visible = false;
                grade3.visible = true;
                break;
            default:
                grade1.visible = false;
                grade2.visible = false;
                grade3.visible = false;
                break;
        }

        selected.visible = dataSource.id == this.#selectedTalent;
        unselected.visible = !selected.visible;
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
        this.#domBtns.forEach(b => b.remove());
        this.#domBtns = [];

        const btnStory = document.createElement('button');
        btnStory.textContent = $lang.UI_Generate_Story;
        btnStory.style.cssText = `
            position: fixed; top: 15px; left: 15px; z-index: 9999;
            background: rgba(85,255,254,0.15); color: #55fffe;
            border: 1px solid #55fffe; padding: 8px 16px; font-size: 14px;
            border-radius: 6px; cursor: pointer; font-family: SimHei, 'Microsoft YaHei', sans-serif;
            backdrop-filter: blur(4px); transition: all 0.2s;
        `;
        btnStory.onmouseover = () => btnStory.style.background = 'rgba(85,255,254,0.3)';
        btnStory.onmouseout = () => btnStory.style.background = 'rgba(85,255,254,0.15)';
        btnStory.onclick = () => this.onGenerateStory();
        document.body.appendChild(btnStory);
        this.#domBtns.push(btnStory);

        const btnSettings = document.createElement('button');
        btnSettings.textContent = $lang.UI_LLM_Settings;
        btnSettings.style.cssText = `
            position: fixed; top: 15px; right: 15px; z-index: 9999;
            background: rgba(177,124,255,0.15); color: #b17cff; border: 1px solid #b17cff;
            padding: 8px 16px; font-size: 14px; border-radius: 6px; cursor: pointer;
            font-family: SimHei, 'Microsoft YaHei', sans-serif; backdrop-filter: blur(4px);
            transition: all 0.2s;
        `;
        btnSettings.onmouseover = () => btnSettings.style.background = 'rgba(177,124,255,0.3)';
        btnSettings.onmouseout = () => btnSettings.style.background = 'rgba(177,124,255,0.15)';
        btnSettings.onclick = () => this.onLLMSettings();
        document.body.appendChild(btnSettings);
        this.#domBtns.push(btnSettings);
    }

    close() {
        this.#domBtns.forEach(b => b.remove());
        this.#domBtns = [];
    }
}