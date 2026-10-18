(async function () {
    "use strict";

    const APP = {
        title: "_Session Launcher Config_",
        version: 2,
        styleId: "session-launcher-styles"
    };

    const DEFAULTS = [
        { key: "learning", caption: "Learning session", parentId: "root", icon: "bx-book", noteIcon: "bx-book", titleColor: "#ff9800", attributes: "", template: "<h2>Goal</h2><p>What do I want to learn?</p>" },
        { key: "capture", caption: "Quick capture", parentId: "root", icon: "bx-zap", noteIcon: "bx-zap", titleColor: "#4caf50", attributes: "", template: "<p></p><h2>Follow-up</h2><p></p>" },
        { key: "question", caption: "Question", parentId: "root", icon: "bx-target-lock", noteIcon: "bx-target-lock", titleColor: "#324ccd", attributes: "#question", template: "<h2>Question</h2><p></p><h2>Context</h2><p></p>" },
        { key: "idea", caption: "Idea", parentId: "root", icon: "bx-bulb", noteIcon: "bx-bulb", titleColor: "#26a69a", attributes: "", template: "<h2>Idea</h2><p></p>" },
        { key: "playbook", caption: "Playbook entry", parentId: "root", icon: "bx-code-alt", noteIcon: "bx-code-alt", titleColor: "#9c27b0", attributes: "#guide", template: "<h2>Purpose: {{prompt:Tool Name}}</h2><p></p>" }
    ];

    const Utils = {
        esc: function (val) {
            return String(val === undefined || val === null ? "" : val)
                .replace(/&/g, "&amp;").replace(/</g, "&lt;")
                .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        },
        regex: function (val) {
            return String(val).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        },
        search: function (val) {
            let str = String(val || "").toLowerCase();
            try { str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (error) {}
            return str.replace(/[^a-z0-9]/g, "");
        },
        pad: function (num) { 
            return String(num).padStart(2, "0"); 
        },
        clone: function (val) { 
            return JSON.parse(JSON.stringify(val)); 
        },
        key: function () {
            return "c_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
        },
        color: function (val) {
            const map = {
                orange: "#ff9800", green: "#4caf50", turquoise: "#26a69a",
                violet: "#9c27b0", purple: "#9c27b0", blue: "#2196f3",
                red: "#f44336", yellow: "#ffc107"
            };
            const cleanVal = String(val || "").trim();
            if (map[cleanVal.toLowerCase()]) return map[cleanVal.toLowerCase()];
            return /^#[0-9a-f]{6}$/i.test(cleanVal) ? cleanVal : "#cccccc";
        },
        copy: function (target, source) {
            for (const k in source) {
                if (Object.prototype.hasOwnProperty.call(source, k)) target[k] = source[k];
            }
            return target;
        },
        clean: function (actions) {
            const out = [];
            for (let i = 0; i < actions.length; i++) {
                const item = {};
                for (const k in actions[i]) {
                    if (Object.prototype.hasOwnProperty.call(actions[i], k) && k.charAt(0) !== "_") {
                        item[k] = actions[i][k];
                    }
                }
                out.push(item);
            }
            return out;
        },
        now: function () {
            const d = new Date();
            return {
                date: Utils.pad(d.getDate()) + "." + Utils.pad(d.getMonth() + 1),
                time: Utils.pad(d.getHours()) + ":" + Utils.pad(d.getMinutes()),
                year: String(d.getFullYear()),
                month: Utils.pad(d.getMonth() + 1),
                day: Utils.pad(d.getDate()),
                weekday: d.toLocaleDateString(undefined, { weekday: "long" }),
                datetime: Utils.pad(d.getDate()) + "." + Utils.pad(d.getMonth() + 1) + " " + Utils.pad(d.getHours()) + ":" + Utils.pad(d.getMinutes()),
                timestamp: String(Date.now())
            };
        }
    };

    function injectStyles() {
        if (document.getElementById(APP.styleId)) return;
        const styleEl = document.createElement("style");
        styleEl.id = APP.styleId;
        styleEl.textContent = `
            @keyframes slIn { from { opacity: 0; transform: scale(.975) translateY(8px) } to { opacity: 1; transform: none } }
            .sl-panel { animation: slIn .2s cubic-bezier(.16,1,.3,1) }
            .sl-scroll::-webkit-scrollbar { width: 6px; height: 6px }
            .sl-scroll::-webkit-scrollbar-thumb { background: var(--main-border-color, rgba(128,128,128,.4)); border-radius: 20px }
            .sl-input { box-sizing: border-box; border: 1px solid var(--main-border-color, rgba(128,128,128,.4)); background: var(--active-item-background-color, rgba(128,128,128,.07)); color: inherit }
            .sl-input:focus { outline: none; border-color: var(--main-text-color, #111); box-shadow: 0 0 0 3px var(--active-item-background-color, rgba(128,128,128,.15)); background: transparent }
            .sl-btn { border: 1px solid var(--main-border-color, rgba(128,128,128,.35)); background: transparent; color: inherit; border-radius: 9px; cursor: pointer; transition: .15s }
            .sl-btn:hover, .sl-row.kbf .sl-main { background: var(--active-item-background-color, rgba(128,128,128,.13)); border-color: var(--main-text-color, #777) }
            .sl-primary { background: var(--main-text-color, #222); color: var(--main-background-color, #fff); font-weight: 600 }
            .sl-primary:hover { background: var(--main-text-color, #222); opacity: .88 }
            .sl-icon { padding: 8px; border: 1px solid transparent; background: transparent; color: inherit; border-radius: 7px; cursor: pointer; opacity: .7 }
            .sl-icon:hover { opacity: 1; background: var(--active-item-background-color, rgba(128,128,128,.15)) }
            .sl-delete:hover { color: #e74c3c; background: rgba(220,53,69,.12) }
            .sl-item { width: 32px; height: 32px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: inherit; cursor: pointer }
            .sl-item:hover { background: var(--active-item-background-color, rgba(128,128,128,.12)); transform: scale(1.08) }
            .sl-item.active { border-color: var(--main-text-color, #111); background: var(--active-item-background-color, rgba(128,128,128,.2)) }
            .sl-over { box-shadow: inset 0 0 0 2px var(--main-text-color, #111); border-radius: 9px }
            .sl-toolbar button { padding: 4px 8px; background: transparent; color: inherit; border: 1px solid transparent; border-radius: 4px; cursor: pointer }
            .sl-toolbar button:hover { background: var(--active-item-background-color, rgba(128,128,128,.15)) }
            .sl-color { appearance: none; -webkit-appearance: none; padding: 0; border: 1px solid var(--main-border-color, #888) }
            .sl-color::-webkit-color-swatch-wrapper { padding: 0 }
            .sl-color::-webkit-color-swatch { border: 0; border-radius: 5px }
            @media(prefers-reduced-motion: reduce) { .sl-panel, .sl-btn, .sl-item { animation: none !important; transition: none !important } }
        `;
        document.head.appendChild(styleEl);
    }
    injectStyles();

    function createSvg(body) {
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
    }
    
    const ICON = {
        settings: createSvg('<circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.2 4.2l2.9 2.9M16.9 16.9l2.9 2.9M1 12h4M19 12h4M4.2 19.8l2.9-2.9M16.9 7.1l2.9-2.9"/>'),
        edit: createSvg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L8 18l-4 1 1-4z"/>'),
        copy: createSvg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>'),
        trash: createSvg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 16H6L5 6"/>'),
        plus: createSvg('<path d="M12 5v14M5 12h14"/>'),
        up: createSvg('<path d="M12 19V5M5 12l7-7 7 7"/>'),
        down: createSvg('<path d="M12 5v14M5 12l7 7 7-7"/>'),
        grip: createSvg('<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>')
    };

    const IconService = {
        legacy: { file: "bx-file", book: "bx-book", zap: "bx-zap", bulb: "bx-bulb", code: "bx-code-alt", star: "bx-star", check: "bx-check-square", target: "bx-target-lock" },
        get: function (val) {
            if (!val) return "bx-file";
            return String(val).indexOf("bx-") === 0 ? val : (this.legacy[val] || "bx-file");
        },
        discover: function () {
            const found = {};
            try {
                for (let i = 0; i < document.styleSheets.length; i++) {
                    try {
                        const rules = document.styleSheets[i].cssRules || [];
                        for (let j = 0; j < rules.length; j++) {
                            if (!rules[j].selectorText) continue;
                            const matches = rules[j].selectorText.match(/\.bx-[a-z0-9-]+/g) || [];
                            for (let k = 0; k < matches.length; k++) {
                                const cls = matches[k].substring(1);
                                found[cls] = true;
                            }
                        }
                    } catch (error) {}
                }
            } catch (error) {}
            
            const results = Object.keys(found).sort();
            return results.length ? results : ["bx-file", "bx-book", "bx-zap", "bx-bulb", "bx-code-alt", "bx-star", "bx-check-square", "bx-target-lock", "bx-calendar", "bx-folder", "bx-cog", "bx-user", "bx-time", "bx-link", "bx-bookmark", "bx-award", "bx-briefcase", "bx-layer", "bx-terminal"];
        }
    };
    
    const ALL_ICONS = IconService.discover();

    const Repo = {
        note: null,
        actions: [],
        serialize: function (actionsList) {
            return JSON.stringify({ version: APP.version, actions: Utils.clean(actionsList) }, null, 2);
        },
        migrate: function (data) {
            const actionsList = Array.isArray(data) ? data : (data && data.actions);
            if (!Array.isArray(actionsList)) throw new Error("Configuration has no actions array.");
            
            const out = [];
            for (let i = 0; i < actionsList.length; i++) {
                const item = {};
                Utils.copy(item, actionsList[i]);
                item.icon = IconService.get(item.icon);
                item.titleColor = Utils.color(item.titleColor);
                out.push(item);
            }
            return out;
        },
        validate: function (actionsList) {
            const seen = {};
            if (!Array.isArray(actionsList)) throw new Error("Templates must be an array.");
            
            for (let i = 0; i < actionsList.length; i++) {
                const item = actionsList[i];
                if (!item || typeof item !== "object") throw new Error("Invalid template " + (i + 1) + ".");
                if (!String(item.caption || "").trim()) throw new Error("Template " + (i + 1) + " has no name.");
                if (!String(item.parentId || "").trim()) throw new Error('"' + item.caption + '" has no destination.');
                
                if (!item.key || seen[item.key]) item.key = Utils.key();
                seen[item.key] = true;
                
                item.icon = IconService.get(item.icon);
                item.noteIcon = item.noteIcon || "";
                item.titleColor = Utils.color(item.titleColor);
                item.attributes = item.attributes || "";
                item.template = item.template || "";
            }
            return actionsList;
        },
        init: async function () {
            const notes = await api.searchForNotes(`note.title = "${APP.title}"`);
            if (notes.length) {
                this.note = notes[0];
                try {
                    const content = await api.runOnBackend(function(id) {
                        const backendNote = api.getNote(id);
                        return backendNote ? backendNote.getContent() : "";
                    }, [this.note.noteId]);
                    
                    this.actions = this.validate(this.migrate(JSON.parse(content)));
                    await this.save();
                } catch (error) {
                    api.showError("Config load failed: " + error.message);
                    this.actions = Utils.clone(DEFAULTS);
                }
            } else {
                const roots = await api.searchForNotes("note.isRoot = true");
                const rootId = roots.length ? roots[0].noteId : "root";
                const res = await api.createNote(rootId, {
                    title: APP.title, 
                    type: "code", 
                    mime: "application/json", 
                    content: this.serialize(DEFAULTS)
                });
                this.note = res.note;
                this.actions = Utils.clone(DEFAULTS);
            }
        },
        save: async function () {
            const data = this.serialize(this.validate(this.actions));
            await api.runOnBackend(function(id, value) {
                const backendNote = api.getNote(id);
                if (backendNote) backendNote.setContent(value);
            }, [this.note.noteId, data]);
        },
        backup: async function () {
            const roots = await api.searchForNotes("note.isRoot = true");
            const d = new Date();
            const stamp = d.getFullYear() + "-" + Utils.pad(d.getMonth() + 1) + "-" + Utils.pad(d.getDate()) + " " + Utils.pad(d.getHours()) + "-" + Utils.pad(d.getMinutes()) + "-" + Utils.pad(d.getSeconds());
            
            await api.createNote(roots.length ? roots[0].noteId : "root", {
                title: "_Session Launcher Backup_ " + stamp,
                type: "code",
                mime: "application/json",
                content: this.serialize(this.actions)
            });
        }
    };

    const Variables = {
        prompts: function (text) {
            const regex = /\{\{prompt:(.*?)\}\}/g;
            const out = [];
            const seen = {};
            let match;
            
            while ((match = regex.exec(String(text || ""))) !== null) {
                const val = match[1].trim();
                if (val && !seen[val]) {
                    seen[val] = true;
                    out.push(val);
                }
            }
            return out;
        },
        apply: function (text, answers, isHtml) {
            const timeData = Utils.now();
            let result = String(text || "");
            
            result = result.replace(/\{\{date\}\}/g, timeData.date).replace(/\{\{time\}\}/g, timeData.time)
                .replace(/\{\{year\}\}/g, timeData.year).replace(/\{\{month\}\}/g, timeData.month)
                .replace(/\{\{day\}\}/g, timeData.day).replace(/\{\{weekday\}\}/g, timeData.weekday)
                .replace(/\{\{datetime\}\}/g, timeData.datetime).replace(/\{\{timestamp\}\}/g, timeData.timestamp);
                
            for (const key in answers) {
                if (Object.prototype.hasOwnProperty.call(answers, key)) {
                    const value = isHtml ? Utils.esc(answers[key]) : String(answers[key]);
                    result = result.replace(new RegExp("\\{\\{prompt:" + Utils.regex(key) + "\\}\\}", "g"), value);
                }
            }
            return result;
        }
    };

    async function applyAttributes(text, noteId) {
        if (!String(text || "").trim()) return;
        const list = String(text).split(/[\n,]+/).map(x => x.trim()).filter(x => x);
        
        await api.runOnBackend(function(id, attrs) {
            const backendNote = api.getNote(id);
            if (!backendNote) return;
            
            for (let i = 0; i < attrs.length; i++) {
                try {
                    const attr = attrs[i];
                    const isRelation = attr.charAt(0) === "~";
                    const cleanAttr = (attr.charAt(0) === "#" || isRelation) ? attr.substring(1) : attr;
                    const pos = cleanAttr.indexOf("=");
                    
                    const name = (pos < 0 ? cleanAttr : cleanAttr.substring(0, pos)).trim();
                    const val = pos < 0 ? "" : cleanAttr.substring(pos + 1).trim();
                    
                    if (name) {
                        if (isRelation) backendNote.setRelation(name, val);
                        else backendNote.setLabel(name, val);
                    }
                } catch (e) {
                    // Ignore single malformed attributes
                }
            }
        }, [noteId, list]);
    }

    function generateModal(config) {
        return new Promise(function(resolve) {
            const prevActiveElement = document.activeElement;
            let settled = false;
            let cleanupFn = null;
            const cancelVal = ("cancelValue" in config) ? config.cancelValue : null;
            
            const htmlString = `
                <div style="position:fixed;inset:0;z-index:10005;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.65);backdrop-filter:blur(3px)">
                    <section class="sl-panel" role="dialog" aria-modal="true" style="background:var(--main-background-color,#fff);color:var(--main-text-color,#111);padding:24px 28px;border-radius:13px;width:${config.width || "700px"};max-width:95vw;max-height:90vh;border:1px solid var(--main-border-color,#777);box-shadow:0 25px 60px rgba(0,0,0,.4);display:flex;flex-direction:column">
                        <h3 style="margin:0 0 20px">${Utils.esc(config.title)}</h3>
                        <div class="sl-scroll sl-content" style="overflow:auto;margin-bottom:20px;padding-right:6px">${config.content}</div>
                        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:14px;border-top:1px solid var(--main-border-color,#777)">
                            ${config.noCancel ? "" : `<button class="sl-btn sl-cancel" style="padding:10px 18px">${Utils.esc(config.cancelText || "Cancel")}</button>`}
                            <button class="sl-btn sl-primary sl-ok" style="padding:10px 18px">${Utils.esc(config.okText || "OK")}</button>
                        </div>
                    </section>
                </div>`;
                
            const $wrapper =$(htmlString);
            
            function finishDialog(returnVal) {
                if (settled) return;
                settled = true;
                if (cleanupFn) {
                    try { cleanupFn(); } catch (error) {}
                }
                $wrapper.fadeOut(120, function() {$wrapper.remove();
                    try { if (prevActiveElement && prevActiveElement.focus) prevActiveElement.focus(); } catch (error) {}
                    resolve(returnVal);
                });
            }
            
            $("body").append($wrapper);$wrapper.on("keydown", function(e) {
                if (e.key === "Escape") {
                    e.preventDefault();
                    finishDialog(cancelVal);
                    return;
                }
                if (e.key === "Tab") {
                    const $focusable =$wrapper.find('button,input,textarea,[contenteditable="true"],[tabindex]').filter(":visible");
                    const firstEl = $focusable[0];
                    const lastEl = $focusable[$focusable.length - 1];
                    if (e.shiftKey && document.activeElement === firstEl) {
                        e.preventDefault();
                        lastEl.focus();
                    } else if (!e.shiftKey && document.activeElement === lastEl) {
                        e.preventDefault();
                        firstEl.focus();
                    }
                }
            });
            
            $wrapper.find(".sl-cancel").on("click", () => finishDialog(cancelVal));
            
            $wrapper.find(".sl-ok").on("click", async function() {
                try {
                    const validationResult = config.validate ? await config.validate($wrapper) : true;
                    if (validationResult !== false && validationResult !== undefined) {
                        finishDialog(validationResult);
                    }
                } catch (error) {
                    api.showError(error.message || String(error));
                }
            });
            
            if (config.mount) {
                cleanupFn = config.mount($wrapper, finishDialog) || null;
            }
            
            setTimeout(() => {
                const $autoFocus =$wrapper.find("[data-autofocus]").first();
                ($autoFocus.length ? $autoFocus :$wrapper.find("input,button").first()).focus();
            }, 30);
        });
    }

    function buildPickerHtml(selectedClass, prefix) {
        let buttonsHtml = "";
        for (let i = 0; i < ALL_ICONS.length; i++) {
            const cls = ALL_ICONS[i];
            const isActive = cls === selectedClass ? " active" : "";
            buttonsHtml += `<button type="button" class="sl-item ${prefix}-item${isActive}" data-class="${Utils.esc(cls)}" data-search="${Utils.search(cls)}" title="${Utils.esc(cls)}"><i class="bx ${Utils.esc(cls)}"></i></button>`;
        }
        
        return `
            <div>
                <input class="sl-input ${prefix}-search" placeholder="Search icons..." style="width:100%;padding:8px;margin-bottom:8px;border-radius:6px">
                <div class="sl-scroll" style="display:flex;flex-wrap:wrap;gap:2px;max-height:140px;overflow:auto;padding:8px;border:1px solid var(--main-border-color,#777);border-radius:6px">
                    <button type="button" class="sl-item ${prefix}-item${!selectedClass ? " active" : ""}" data-class="" data-search="defaultnone"><i class="bx bx-minus"></i></button>
                    ${buttonsHtml}
                    <div class="${prefix}-empty" style="display:none;width:100%;text-align:center;padding:15px">No icons found.</div>
                </div>
            </div>`;
    }

    function bindPickerEvents($wrapper, prefix, callback) {$wrapper.find(`.${prefix}-search`).on("input", function() {
            const query = Utils.search($(this).val());
            let visibleCount = 0;
            
            $wrapper.find(`.${prefix}-item`).each(function() {
                const isMatch = String($(this).data("search") || "").indexOf(query) !== -1;
                $(this).toggle(isMatch);
                if (isMatch) visibleCount++;
            });
            
            $wrapper.find(`.${prefix}-empty`).toggle(visibleCount === 0);
        });
        
        $wrapper.find(`.${prefix}-item`).on("click", function() {
            $wrapper.find(`.${prefix}-item`).removeClass("active");
            $(this).addClass("active");
            if (callback) callback($(this).data("class") || "");
        });
    }

    function buildToolbarHtml() {
        return `
            <div class="sl-toolbar" style="display:flex;flex-wrap:wrap;gap:5px;padding:7px;margin-bottom:10px;border:1px solid var(--main-border-color,#777);border-radius:6px">
                <button data-cmd="formatBlock" data-val="H2"><b>H2</b></button>
                <button data-cmd="formatBlock" data-val="P">P</button>
                <button data-cmd="bold"><b>B</b></button>
                <button data-cmd="italic"><i>I</i></button>
                <button data-cmd="underline"><u>U</u></button>
                <button data-cmd="insertUnorderedList">• List</button>
                <button data-cmd="insertOrderedList">1. List</button>
                <button data-cmd="removeFormat">Clear</button>
                <label>Text <input class="sl-font sl-color" type="color" value="#0000ff"></label>
                <label>Highlight <input class="sl-highlight sl-color" type="color" value="#ffff00"></label>
            </div>`;
    }

    function bindToolbarEvents($wrapper, editorElement) {
        let savedRange = null;
        
        function saveSelection() {
            const selection = window.getSelection();
            if (selection && selection.rangeCount && editorElement.contains(selection.anchorNode)) {
                savedRange = selection.getRangeAt(0).cloneRange();
            }
        }
        
        function restoreSelection() {
            editorElement.focus();
            if (savedRange) {
                try {
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(savedRange);
                } catch (error) {}
            }
        }
        
        document.addEventListener("selectionchange", saveSelection);
        
        $wrapper.find(".sl-toolbar button").on("mousedown", function(e) {
            e.preventDefault();
            saveSelection();
        }).on("click", function() {
            restoreSelection();
            document.execCommand($(this).data("cmd"), false, $(this).data("val") || null);
            saveSelection();
        });
        
        $wrapper.find(".sl-font").on("input change", function() {
            restoreSelection();
            document.execCommand("foreColor", false, this.value);
        });
        
        $wrapper.find(".sl-highlight").on("input change", function() {
            restoreSelection();
            if (!document.execCommand("hiliteColor", false, this.value)) {
                document.execCommand("backColor", false, this.value);
            }
        });
        
        return function cleanup() {
            document.removeEventListener("selectionchange", saveSelection);
        };
    }

    async function promptForDestination() {
        let query = await api.showPromptDialog({ title: "Find Destination", message: "Type a folder title or paste a Note ID:", defaultValue: "" });
        if (!String(query || "").trim()) return null;
        
        query = String(query).trim();
        let notes = await api.searchForNotes(query);
        
        if (!notes.length && query.length > 5) {
            const direct = await api.getNote(query);
            if (direct) notes = [direct];
        }
        
        if (!notes.length) {
            api.showError("No notes found.");
            return null;
        }
        
        if (notes.length === 1) return notes[0];
        
        const itemsList = [];
        for (let i = 0; i < notes.length && i < 20; i++) {
            itemsList.push({ key: notes[i].noteId, caption: notes[i].title });
        }
        
        const picked = await api.pickSingleItem({ title: "Multiple notes found", placeholder: "Select destination...", items: itemsList });
        if (!picked) return null;
        
        for (let i = 0; i < notes.length; i++) {
            if (notes[i].noteId === picked.key) return notes[i];
        }
        return null;
    }

    async function showVariablesDialog(promptsList) {
        let contentHtml = "";
        for (let i = 0; i < promptsList.length; i++) {
            contentHtml += `
                <label style="display:block;margin-bottom:14px;font-weight:600">${Utils.esc(promptsList[i])}
                    <input class="sl-input sl-prompt" data-key="${Utils.esc(promptsList[i])}" style="display:block;width:100%;padding:10px;margin-top:5px">
                </label>`;
        }
        
        return generateModal({
            title: "Template Variables",
            content: contentHtml,
            width: "450px",
            okText: "Continue",
            validate: function($wrapper) {
                const answers = {};
                $wrapper.find(".sl-prompt").each(function() {
                    answers[$(this).data("key")] = $(this).val();
                });
                return answers;
            }
        });
    }

    async function showEditorDialog(actionConfig) {
        const action = actionConfig || {};
        const contentHtml = `
            <label>Button Name</label>
            <input data-autofocus id="sl-caption" class="sl-input" value="${Utils.esc(action.caption || "")}" style="width:100%;padding:11px;margin:6px 0 18px">
            <div style="display:flex;gap:15px">
                <div style="flex:1"><b>Launcher icon</b>${buildPickerHtml(IconService.get(action.icon), "launchicon")}</div>
                <div style="flex:1"><b>Note icon</b>${buildPickerHtml(action.noteIcon || "", "noteicon")}</div>
                <div><b>Color</b><br><input id="sl-color" class="sl-color" type="color" value="${Utils.color(action.titleColor)}" style="width:44px;height:44px;margin-top:8px"></div>
            </div>
            <label style="display:block;margin-top:18px">Default attributes</label>
            <textarea id="sl-attrs" class="sl-input" style="width:100%;min-height:55px;padding:10px">${Utils.esc(action.attributes || "")}</textarea>
            <label style="display:block;margin-top:18px">Template content — {{date}}, {{time}}, {{prompt:Name}}</label>
            ${buildToolbarHtml()}
            <div id="sl-editor" contenteditable="true" class="sl-input sl-scroll" style="min-height:180px;max-height:35vh;overflow:auto;padding:14px">${action.template || ""}</div>
        `;
        
        return generateModal({
            title: action.key ? "Edit Template" : "New Template",
            content: contentHtml,
            okText: "Save",
            mount: function($wrapper) {
                bindPickerEvents($wrapper, "launchicon");
                bindPickerEvents($wrapper, "noteicon");
                return bindToolbarEvents($wrapper,$wrapper.find("#sl-editor")[0]);
            },
            validate: function($wrapper) {
                const captionVal = String($wrapper.find("#sl-caption").val() || "").trim();
                if (!captionVal) {
                    api.showError("Button name is required.");
                    return false;
                }
                return {
                    caption: captionVal,
                    icon: $wrapper.find(".launchicon-item.active").data("class") || "bx-file",
                    noteIcon: $wrapper.find(".noteicon-item.active").data("class") || "",
                    titleColor: $wrapper.find("#sl-color").val(),
                    attributes: $wrapper.find("#sl-attrs").val(),
                    template: $wrapper.find("#sl-editor").html().trim()
                };
            }
        });
    }

    async function showLaunchConfirmDialog(action, computedTitle) {
        let activeIcon = action.noteIcon || "";
        
        const contentHtml = `
            <div style="display:flex;gap:10px;align-items:center;margin-bottom:18px">
                <div id="sl-preview" style="font-size:24px;width:44px;text-align:center">
                    <i class="bx ${Utils.esc(activeIcon || "bx-file")}"></i>
                </div>
                <input data-autofocus id="sl-title" class="sl-input" value="${Utils.esc(computedTitle)}" style="flex:1;padding:11px">
                <input id="sl-launch-color" class="sl-color" type="color" value="${Utils.color(action.titleColor)}" style="width:44px;height:44px">
            </div>
            <b>Customize note icon</b>
            ${buildPickerHtml(activeIcon, "launchnote")}`;
            
        return generateModal({
            title: "Launch: " + action.caption,
            width: "580px",
            okText: "Continue",
            content: contentHtml,
            mount: function($wrapper) {
                bindPickerEvents($wrapper, "launchnote", function(val) {
                    activeIcon = val;
                    $wrapper.find("#sl-preview i").attr("class", "bx " + (val || "bx-file"));
                });
            },
            validate: function($wrapper) {
                const titleVal = String($wrapper.find("#sl-title").val() || "").trim();
                if (!titleVal) {
                    api.showError("Title is required.");
                    return false;
                }
                return {
                    title: titleVal,
                    color: $wrapper.find("#sl-launch-color").val(),
                    noteIcon: activeIcon
                };
            }
        });
    }

    async function showAdditionalNotesDialog() {
        return generateModal({
            title: "Additional Notes",
            width: "750px",
            cancelText: "Skip",
            cancelValue: "",
            okText: "Append & Finish",
            content: `
                <p>Optional text will be appended to the template.</p>
                ${buildToolbarHtml()}
                <div id="sl-extra" contenteditable="true" class="sl-input sl-scroll" style="min-height:220px;max-height:40vh;overflow:auto;padding:14px"></div>`,
            mount: function($wrapper) {
                return bindToolbarEvents($wrapper,$wrapper.find("#sl-extra")[0]);
            },
            validate: function($wrapper) {
                return $wrapper.find("#sl-extra").html() || "";
            }
        });
    }

    function buildMainMenu(actionsList) {
        return new Promise(function(resolve) {
            let rowsHtml = "";
            let isDone = false;
            let keyboardIndex = 0;
            let draggedKey = null;
            
            for (let i = 0; i < actionsList.length; i++) {
                const item = actionsList[i];
                rowsHtml += `
                    <div class="sl-row" draggable="true" data-key="${Utils.esc(item.key)}" data-search="${Utils.search(item.caption + " " + item._parentTitle)}" style="display:flex;gap:7px;margin-bottom:9px">
                        <span class="sl-grip" style="cursor:grab;align-self:center">${ICON.grip}</span>
                        <button class="sl-btn sl-main" data-key="${Utils.esc(item.key)}" style="flex:1;padding:11px;text-align:left">
                            <i class="bx ${Utils.esc(IconService.get(item.icon))}" style="font-size:20px;color:${Utils.color(item.titleColor)};margin-right:10px"></i>
                            <b>${Utils.esc(item.caption)}</b>
                            <small style="display:block;margin-left:31px;opacity:.6"><i class="bx bx-folder"></i> ${Utils.esc(item._parentTitle)}</small>
                        </button>
                        <button class="sl-icon sl-config" data-key="${Utils.esc(item.key)}" title="Destination">${ICON.settings}</button>
                        <button class="sl-icon sl-edit" data-key="${Utils.esc(item.key)}" title="Edit">${ICON.edit}</button>
                        <button class="sl-icon sl-clone" data-key="${Utils.esc(item.key)}" title="Duplicate">${ICON.copy}</button>
                        <button class="sl-icon sl-delete" data-key="${Utils.esc(item.key)}" title="Delete">${ICON.trash}</button>
                    </div>`;
            }
            
            const $wrapper =$(`
                <div style="position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.62)">
                    <section class="sl-panel" role="dialog" aria-modal="true" style="width:min(680px,96vw);max-height:90vh;display:flex;flex-direction:column;padding:22px;background:var(--main-background-color,#fff);color:var(--main-text-color,#111);border-radius:14px">
                        <input id="sl-search" class="sl-input" placeholder="Search templates and folders..." style="padding:13px;margin-bottom:16px">
                        <div class="sl-list sl-scroll" style="overflow:auto;flex:1">${rowsHtml}</div>
                        <small style="text-align:center;opacity:.5;margin:10px">↑ ↓ Navigate • Enter Launch • Esc Close</small>
                        <div style="display:flex;gap:8px;border-top:1px solid var(--main-border-color,#777);padding-top:14px">
                            <button class="sl-btn sl-new" style="flex:1;padding:11px">${ICON.plus} New Template</button>
                            <button class="sl-btn sl-export" title="Export">${ICON.up}</button>
                            <button class="sl-btn sl-import" title="Import">${ICON.down}</button>
                            <button class="sl-btn sl-close" style="padding:11px 18px">Close</button>
                        </div>
                    </section>
                </div>`);
                
            $("body").append($wrapper);
            
            function finalizeMenu(returnVal) {
                if (isDone) return;
                isDone = true;
                $(document).off("keydown.sl");
                $wrapper.fadeOut(100, function() {$wrapper.remove();
                    resolve(returnVal);
                });
            }
            
            function updateFocus() {
                const $visibleRows =$wrapper.find(".sl-row:visible");
                $wrapper.find(".sl-row").removeClass("kbf");
                if (!$visibleRows.length) return;
                if (keyboardIndex < 0) keyboardIndex = 0;
                if (keyboardIndex >= $visibleRows.length) keyboardIndex =$visibleRows.length - 1;
                $visibleRows.eq(keyboardIndex).addClass("kbf")[0].scrollIntoView({ block: "nearest" });
            }
            
            $wrapper.find("#sl-search").on("input", function() {
                const query = Utils.search($(this).val());$wrapper.find(".sl-row").each(function() {
                    const isMatch = String($(this).data("search")).indexOf(query) !== -1;
                    $(this).toggle(isMatch);
                });
                keyboardIndex = 0;
                updateFocus();
            });
            
            $(document).on("keydown.sl", function(e) {
                const $visibleRows =$wrapper.find(".sl-row:visible");
                if (e.key === "Escape") {
                    finalizeMenu(null);
                } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    keyboardIndex++;
                    updateFocus();
                } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    keyboardIndex--;
                    updateFocus();
                } else if (e.key === "Enter" && $visibleRows.length) {
                    e.preventDefault();
                    $visibleRows.eq(keyboardIndex).find(".sl-main").click();
                }
            });
            
            $wrapper.find(".sl-row")
                .on("dragstart", function(e) {
                    draggedKey = $(this).data("key");
                    e.originalEvent.dataTransfer.effectAllowed = "move";
                })
                .on("dragover", function(e) {
                    e.preventDefault();
                    $(this).addClass("sl-over");
                })
                .on("dragleave dragend", function() {
                    $(this).removeClass("sl-over");
                })
                .on("drop", function(e) {
                    e.preventDefault();
                    finalizeMenu({ type: "SWAP", from: draggedKey, to: $(this).data("key") });
                });
                
            $wrapper.find(".sl-main").on("click", function() { finalizeMenu({ type: "LAUNCH", key: $(this).data("key") }); });
            $wrapper.find(".sl-new").on("click", function() { finalizeMenu({ type: "CREATE" }); });
            $wrapper.find(".sl-edit").on("click", function() { finalizeMenu({ type: "EDIT", key: $(this).data("key") }); });
            $wrapper.find(".sl-clone").on("click", function() { finalizeMenu({ type: "CLONE", key: $(this).data("key") }); });
            $wrapper.find(".sl-config").on("click", function() { finalizeMenu({ type: "CONFIG", key: $(this).data("key") }); });
            
            $wrapper.find(".sl-delete").on("click", async function() {
                const key = $(this).data("key");
                const confirmDelete = await generateModal({
                    title: "Confirm",
                    width: "400px",
                    okText: "Delete",
                    content: "<p>Delete this template? This cannot be undone.</p>"
                });
                if (confirmDelete) finalizeMenu({ type: "DELETE", key: key });
            });
            
            $wrapper.find(".sl-export").on("click", function() {
                generateModal({
                    title: "Export Configuration",
                    width: "650px",
                    noCancel: true,
                    okText: "Done",
                    content: `<textarea readonly class="sl-input" style="width:100%;height:300px;padding:10px;font-family:monospace">${Utils.esc(Repo.serialize(Repo.actions))}</textarea>`
                });
            });
            
            $wrapper.find(".sl-import").on("click", async function() {
                const importedData = await generateModal({
                    title: "Import Configuration",
                    width: "650px",
                    okText: "Import",
                    content: `
                        <p>A synchronized backup will be created first.</p>
                        <textarea data-autofocus id="sl-import-data" class="sl-input" style="width:100%;height:250px;padding:10px;font-family:monospace"></textarea>`,
                    validate: function($dialog) {
                        try {
                            const rawData = JSON.parse($dialog.find("#sl-import-data").val());
                            return Repo.validate(Repo.migrate(rawData));
                        } catch (error) {
                            api.showError("Invalid configuration: " + error.message);
                            return false;
                        }
                    }
                });
                if (importedData) finalizeMenu({ type: "IMPORT", data: importedData });
            });
            
            $wrapper.find(".sl-close").on("click", function() { finalizeMenu(null); });
            
            setTimeout(function() {
                $wrapper.find("#sl-search").focus();
                updateFocus();
            }, 30);
        });
    }

    function findActionByKey(key) {
        for (let i = 0; i < Repo.actions.length; i++) {
            if (Repo.actions[i].key === key) return Repo.actions[i];
        }
        return null;
    }

    async function executeLaunchWorkflow(action) {
        let parentNote = await api.getNote(action.parentId);
        
        if (!parentNote) {
            api.showMessage("Destination missing. Choose a new one.");
            const newTarget = await promptForDestination();
            if (!newTarget) return false;
            
            action.parentId = newTarget.noteId;
            await Repo.save();
            parentNote = newTarget;
        }
        
        const timeContext = Utils.now();
        let computedTitle = timeContext.date + " " + timeContext.time + " - " + action.caption;
        const requiredPrompts = Variables.prompts(computedTitle + " " + action.template);
        let answers = {};
        
        if (requiredPrompts.length) {
            answers = await showVariablesDialog(requiredPrompts);
            if (!answers) return false;
        }
        
        computedTitle = Variables.apply(computedTitle, answers, false);
        let finalContent = Variables.apply(action.template, answers, true);
        
        const launchOptions = await showLaunchConfirmDialog(action, computedTitle);
        if (!launchOptions) return false;
        
        const extraNotes = await showAdditionalNotesDialog();
        if (extraNotes && String(extraNotes).trim() !== "<br>" && String(extraNotes).trim() !== "<div><br></div>") {
            finalContent += "\n<br>\n" + extraNotes;
        }
        
        const creationResult = await api.createNote(parentNote.noteId, {
            title: launchOptions.title,
            content: finalContent,
            type: "text"
        });
        
        if (launchOptions.color && launchOptions.color !== "#cccccc") {
            await applyAttributes("#color=" + launchOptions.color, creationResult.note.noteId);
        }
        if (launchOptions.noteIcon) {
            await applyAttributes("#iconClass=bx " + launchOptions.noteIcon, creationResult.note.noteId);
        }
        if (action.attributes) {
            await applyAttributes(action.attributes, creationResult.note.noteId);
        }
        
        api.showMessage('Successfully created "' + creationResult.note.title + '"');
        return true;
    }

    try {
        await Repo.init();

        while (true) {
            for (let i = 0; i < Repo.actions.length; i++) {
                const parentNode = await api.getNote(Repo.actions[i].parentId);
                Repo.actions[i]._parentTitle = parentNode ? parentNode.title : "⚠ Missing Destination";
            }

            const actionResult = await buildMainMenu(Repo.actions);
            if (!actionResult) return; // Exit loop if user closes menu

            if (actionResult.type === "SWAP") {
                let fromIndex = -1;
                let toIndex = -1;
                
                for (let i = 0; i < Repo.actions.length; i++) {
                    if (Repo.actions[i].key === actionResult.from) fromIndex = i;
                    if (Repo.actions[i].key === actionResult.to) toIndex = i;
                }
                
                if (fromIndex >= 0 && toIndex >= 0) {
                    const temp = Repo.actions[fromIndex];
                    Repo.actions[fromIndex] = Repo.actions[toIndex];
                    Repo.actions[toIndex] = temp;
                    await Repo.save();
                }
            } else if (actionResult.type === "DELETE") {
                Repo.actions = Repo.actions.filter(x => x.key !== actionResult.key);
                await Repo.save();
            } else if (actionResult.type === "CLONE") {
                const sourceAction = findActionByKey(actionResult.key);
                if (sourceAction) {
                    const clonedData = Utils.clone(Utils.clean([sourceAction])[0]);
                    clonedData.key = Utils.key();
                    clonedData.caption = sourceAction.caption + " (Copy)";
                    Repo.actions.push(clonedData);
                    await Repo.save();
                }
            } else if (actionResult.type === "CONFIG") {
                const actionToConfig = findActionByKey(actionResult.key);
                const newTarget = await promptForDestination();
                if (actionToConfig && newTarget) {
                    actionToConfig.parentId = newTarget.noteId;
                    await Repo.save();
                }
            } else if (actionResult.type === "CREATE") {
                const newConfigData = await showEditorDialog({});
                if (newConfigData) {
                    const newTarget = await promptForDestination();
                    if (newTarget) {
                        const newAction = { key: Utils.key(), parentId: newTarget.noteId };
                        Utils.copy(newAction, newConfigData);
                        Repo.actions.push(newAction);
                        await Repo.save();
                    }
                }
            } else if (actionResult.type === "EDIT") {
                const actionToEdit = findActionByKey(actionResult.key);
                if (actionToEdit) {
                    const updatedData = await showEditorDialog(actionToEdit);
                    if (updatedData) {
                        Utils.copy(actionToEdit, updatedData);
                        await Repo.save();
                    }
                }
            } else if (actionResult.type === "IMPORT") {
                await Repo.backup();
                Repo.actions = Repo.validate(Utils.clone(actionResult.data));
                await Repo.save();
                api.showMessage("Configuration imported; previous configuration backed up.");
            } else if (actionResult.type === "LAUNCH") {
                const actionToLaunch = findActionByKey(actionResult.key);
                if (actionToLaunch) {
                    const isFinished = await executeLaunchWorkflow(actionToLaunch);
                    if (isFinished) return; // Exit loop upon successful creation
                }
            }
        }
    } catch (error) {
        console.error("Session Launcher Error:", error);
        api.showError("Session Launcher Error: " + (error.message || String(error)));
    }
})();