(async function () {
    "use strict";

    /* =====================================================================
       Session Launcher v3.1 (Unified Merge)
       - Per-template Title Patterns & Live Previews
       - Single "Launch" dialog (variables + title + icon + extra notes)
       - Destination picker with live search, "active note" destination
       - UI tree-safe atomic note creation & state-preserving menu
       ===================================================================== */

    const APP = {
        title: "_Session Launcher Config_",
        label: "sessionLauncherConfig",
        version: 3,
        styleId: "session-launcher-styles"
    };

    const ICON_RE = /^bx[sl]?-[a-z0-9-]+$/i;
    const NO_COLOR = "#cccccc";
    const DEFAULT_TITLE_PATTERN = "{{date}} {{time}} - {{caption}}";

    const DEFAULTS = [
        { key: "learning", caption: "Learning session", titlePattern: DEFAULT_TITLE_PATTERN, parentId: "root", icon: "bx-book", noteIcon: "bx-book", titleColor: "#ff9800", attributes: "", template: "<h2>Goal</h2><p>What do I want to learn?</p>", openAfter: true },
        { key: "capture", caption: "Quick capture", titlePattern: DEFAULT_TITLE_PATTERN, parentId: "root", icon: "bx-brain", noteIcon: "bx-brain", titleColor: "#4caf50", attributes: "", template: "<p></p><h2>Follow-up</h2><p></p>", openAfter: true },
        { key: "question", caption: "Question", titlePattern: DEFAULT_TITLE_PATTERN, parentId: "root", icon: "bx-target-lock", noteIcon: "bx-target-lock", titleColor: "#324ccd", attributes: "#question", template: "<h2>Question</h2><p></p><h2>Context</h2><p></p>", openAfter: true },
        { key: "idea", caption: "Idea", titlePattern: DEFAULT_TITLE_PATTERN, parentId: "root", icon: "bx-bulb", noteIcon: "bx-bulb", titleColor: "#26a69a", attributes: "", template: "<h2>Idea</h2><p></p>", openAfter: true },
        { key: "playbook", caption: "Playbook entry", titlePattern: DEFAULT_TITLE_PATTERN, parentId: "root", icon: "bx-code-alt", noteIcon: "bx-code-alt", titleColor: "#9c27b0", attributes: "#guide", template: "<h2>Purpose: {{prompt:Tool Name}}</h2><p></p>", openAfter: true }
    ];

    /* ---------------------------------------------------------------------
       Utils
       --------------------------------------------------------------------- */

    const Utils = {
        esc: function (val) {
            return String(val === undefined || val === null ? "" : val)
                .replace(/&/g, "&amp;").replace(/</g, "&lt;")
                .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        },
        search: function (val) {
            let str = String(val || "").toLowerCase();
            try { str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) { /* ignore */ }
            return str.replace(/[^a-z0-9]/g, "");
        },
        pad: function (n) { return String(n).padStart(2, "0"); },
        clone: function (v) { return JSON.parse(JSON.stringify(v)); },
        key: function () { return "c_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7); },
        color: function (val) {
            const map = { orange: "#ff9800", green: "#4caf50", turquoise: "#26a69a", violet: "#9c27b0", purple: "#9c27b0", blue: "#2196f3", red: "#f44336", yellow: "#ffc107" };
            const s = String(val || "").trim();
            if (map[s.toLowerCase()]) return map[s.toLowerCase()];
            return /^#[0-9a-f]{6}$/i.test(s) ? s : NO_COLOR;
        },
        clean: function (actions) {
            return actions.map(function (a) {
                const o = {};
                Object.keys(a).forEach(function (k) { if (k.charAt(0) !== "_") o[k] = a[k]; });
                return o;
            });
        },
        stamp: function () {
            const d = new Date();
            return d.getFullYear() + "-" + Utils.pad(d.getMonth() + 1) + "-" + Utils.pad(d.getDate()) + " " + Utils.pad(d.getHours()) + "-" + Utils.pad(d.getMinutes()) + "-" + Utils.pad(d.getSeconds());
        },
        now: function () {
            const d = new Date();
            const p = Utils.pad;
            const date = p(d.getDate()) + "." + p(d.getMonth() + 1);
            const time = p(d.getHours()) + ":" + p(d.getMinutes());
            return {
                date: date,
                time: time,
                datetime: date + " " + time,
                isodate: d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()),
                year: String(d.getFullYear()),
                month: p(d.getMonth() + 1),
                day: p(d.getDate()),
                weekday: d.toLocaleDateString(undefined, { weekday: "long" }),
                timestamp: String(Date.now())
            };
        },
        debounce: function (fn, ms) {
            let t = null;
            return function () {
                const args = arguments;
                clearTimeout(t);
                t = setTimeout(function () { fn.apply(null, args); }, ms);
            };
        }
    };

    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            try {
                const ta = document.createElement("textarea");
                ta.value = text;
                ta.style.cssText = "position:fixed;opacity:0";
                document.body.appendChild(ta);
                ta.select();
                const ok = document.execCommand("copy");
                document.body.removeChild(ta);
                return ok;
            } catch (e2) { return false; }
        }
    }

    /* ---------------------------------------------------------------------
       HTML sanitizer
       --------------------------------------------------------------------- */

    const ALLOWED_TAGS = new Set(["a", "b", "blockquote", "br", "code", "div", "em", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "li", "mark", "ol", "p", "pre", "s", "span", "strike", "strong", "sub", "sup", "table", "tbody", "td", "th", "thead", "tr", "u", "ul"]);
    const DROP_TAGS = new Set(["script", "style", "iframe", "object", "embed", "link", "meta", "template", "noscript", "svg", "math", "form"]);
    const ALLOWED_STYLES = new Set(["color", "background-color", "text-align", "font-weight", "font-style", "text-decoration"]);

    function cleanStyle(style) {
        return String(style || "").split(";").map(function (decl) {
            const i = decl.indexOf(":");
            if (i < 0) return "";
            const prop = decl.slice(0, i).trim().toLowerCase();
            const val = decl.slice(i + 1).trim();
            return (ALLOWED_STYLES.has(prop) && /^[#a-z0-9(),.\s%-]+$/i.test(val)) ? prop + ": " + val : "";
        }).filter(Boolean).join("; ");
    }

    function sanitizeHtml(html) {
        const doc = new DOMParser().parseFromString("<body>" + String(html || "") + "</body>", "text/html");

        (function walk(parent) {
            Array.from(parent.childNodes).forEach(function (node) {
                if (node.nodeType === 3) return;
                if (node.nodeType !== 1) { parent.removeChild(node); return; }

                const tag = node.tagName.toLowerCase();
                if (DROP_TAGS.has(tag)) { parent.removeChild(node); return; }
                walk(node);

                if (tag === "font") {
                    const span = doc.createElement("span");
                    const col = node.getAttribute("color");
                    if (col && /^[#a-z0-9(),.\s%-]+$/i.test(col)) span.setAttribute("style", "color: " + col);
                    while (node.firstChild) span.appendChild(node.firstChild);
                    parent.replaceChild(span, node);
                    return;
                }
                if (!ALLOWED_TAGS.has(tag)) {
                    while (node.firstChild) parent.insertBefore(node.firstChild, node);
                    parent.removeChild(node);
                    return;
                }

                Array.from(node.attributes).forEach(function (attr) {
                    const name = attr.name.toLowerCase();
                    if (name === "class" || name === "title") return;
                    if ((name === "colspan" || name === "rowspan") && /^\d+$/.test(attr.value)) return;
                    if (name === "href" && tag === "a" && /^(https?:|mailto:|#|\/)/i.test(attr.value.trim())) return;
                    if (name === "style") {
                        const s = cleanStyle(attr.value);
                        if (s) node.setAttribute("style", s); else node.removeAttribute("style");
                        return;
                    }
                    node.removeAttribute(attr.name);
                });
            });
        })(doc.body);

        return doc.body.innerHTML;
    }

    function hasVisibleContent(html) {
        const d = document.createElement("div");
        d.innerHTML = html || "";
        return !!d.textContent.trim() || !!d.querySelector("hr,table");
    }

    /* ---------------------------------------------------------------------
       Styles (always refreshed, so editing the script takes effect)
       --------------------------------------------------------------------- */

    const CSS = `
        @keyframes slIn { from { opacity: 0; transform: scale(.975) translateY(8px) } to { opacity: 1; transform: none } }
        .sl-panel { animation: slIn .2s cubic-bezier(.16,1,.3,1) }
        .sl-panel.sl-noanim { animation: none }
        .sl-scroll::-webkit-scrollbar { width: 6px; height: 6px }
        .sl-scroll::-webkit-scrollbar-thumb { background: var(--main-border-color, rgba(128,128,128,.4)); border-radius: 20px }
        .sl-modal h3 { font-size: 17px; font-weight: 650 }
        .sl-label { display: block; font-weight: 600; margin: 12px 0 6px }
        .sl-card { border: 1px solid var(--main-border-color, rgba(128,128,128,.3)); border-radius: 11px; padding: 14px 16px; margin-bottom: 14px; background: rgba(128,128,128,.045) }
        .sl-card-title { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; opacity: .55; margin: 0 0 10px }
        .sl-card-title span { text-transform: none; letter-spacing: 0; font-weight: 400 }

        .sl-input { box-sizing: border-box; border: 1px solid var(--main-border-color, rgba(128,128,128,.4)); background: var(--active-item-background-color, rgba(128,128,128,.07)); color: inherit; border-radius: 8px; transition: border-color .15s, box-shadow .15s, background .15s }
        .sl-input:focus { outline: none; border-color: var(--main-text-color, #111); box-shadow: 0 0 0 3px rgba(128,128,128,.22); background: transparent }
        .sl-btn { border: 1px solid var(--main-border-color, rgba(128,128,128,.35)); background: transparent; color: inherit; border-radius: 9px; cursor: pointer; transition: background .15s, border-color .15s, opacity .15s }
        .sl-btn:hover { background: var(--active-item-background-color, rgba(128,128,128,.13)); border-color: var(--main-text-color, #777) }
        .sl-btn:focus-visible, .sl-icon:focus-visible, .sl-item:focus-visible { outline: 2px solid var(--main-text-color, #888); outline-offset: 1px }
        .sl-primary { background: var(--main-text-color, #222); color: var(--main-background-color, #fff); font-weight: 600; border-color: transparent }
        .sl-primary:hover { background: var(--main-text-color, #222); opacity: .88; border-color: transparent }
        .sl-primary[disabled] { opacity: .5; cursor: default }
        .sl-icon { padding: 8px; border: 1px solid transparent; background: transparent; color: inherit; border-radius: 8px; cursor: pointer; opacity: .75; display: grid; place-items: center }
        .sl-icon:hover { opacity: 1; background: rgba(128,128,128,.18) }
        .sl-delete:hover { color: #e74c3c; background: rgba(220,53,69,.14) }

        .sl-head { display: flex; align-items: baseline; justify-content: space-between; margin: 0 4px 12px }
        .sl-head b { font-size: 15px; letter-spacing: .01em }
        .sl-head span { font-size: 12px; opacity: .55 }
        .sl-searchbar { position: relative; margin-bottom: 14px }
        .sl-searchbar > i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); opacity: .5; pointer-events: none; font-size: 18px }
        .sl-searchbar > input { width: 100%; padding: 12px 14px 12px 42px; border-radius: 10px }

        .sl-row { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; position: relative }
        .sl-row.sl-dragging { opacity: .4 }
        .sl-row.sl-drop-before::before, .sl-row.sl-drop-after::after { content: ""; position: absolute; left: 0; right: 0; height: 3px; border-radius: 3px; background: var(--main-text-color, #111) }
        .sl-row.sl-drop-before::before { top: -6px }
        .sl-row.sl-drop-after::after { bottom: -6px }
        
        .sl-order-ctrls { display: flex; flex-direction: column; align-items: center; gap: 2px; opacity: 0.3; transition: opacity .15s; margin-right: 2px; }
        .sl-row:hover .sl-order-ctrls, .sl-row.kbf .sl-order-ctrls { opacity: 1; }
        .sl-move-btn { background: transparent; border: none; color: inherit; cursor: pointer; padding: 2px; border-radius: 4px; display: grid; place-items: center; opacity: .7; }
        .sl-move-btn:hover { background: rgba(128,128,128,.2); opacity: 1; }
        .sl-move-btn svg { width: 14px; height: 14px; }
        .sl-grip { cursor: grab; display: grid; place-items: center; opacity: .6; padding: 2px; }

        .sl-main { position: relative; flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 16px; text-align: left; overflow: hidden }
        .sl-main::before { content: ""; position: absolute; left: 0; top: 11px; bottom: 11px; width: 3px; border-radius: 0 3px 3px 0; background: var(--sl-accent, transparent); opacity: .85 }
        .sl-main:hover, .sl-row.kbf .sl-main { border-color: var(--sl-accent, var(--main-text-color, #777)); background: rgba(128,128,128,.12); background: color-mix(in srgb, var(--sl-accent, #888) 13%, transparent) }
        .sl-row.kbf .sl-main { box-shadow: 0 0 0 1px var(--sl-accent, transparent) }
        .sl-tile { width: 38px; height: 38px; flex-shrink: 0; display: grid; place-items: center; border-radius: 10px; font-size: 21px; color: var(--sl-accent, inherit); background: rgba(128,128,128,.15); background: color-mix(in srgb, var(--sl-accent, #888) 16%, transparent) }
        .sl-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1 }
        .sl-text b { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
        .sl-text small { display: flex; align-items: center; gap: 5px; opacity: .62; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
        .sl-num, .sl-kbd { font-size: 10px; line-height: 1; border: 1px solid var(--main-border-color, rgba(128,128,128,.5)); border-radius: 4px; padding: 2px 5px; background: rgba(128,128,128,.1) }
        .sl-num { opacity: .6; flex-shrink: 0 }
        .sl-num:empty { display: none }
        .sl-warn { color: #e67e22; opacity: 1 !important }

        .sl-actions { display: flex; gap: 1px; opacity: 0; transition: opacity .15s }
        .sl-row:hover .sl-actions, .sl-row.kbf .sl-actions, .sl-row:focus-within .sl-actions { opacity: 1 }
        @media (hover: none) { .sl-actions, .sl-order-ctrls { opacity: 1; } }

        .sl-hints { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 14px; margin: 8px 0 12px; font-size: 11px; opacity: .6 }
        .sl-hints span { display: inline-flex; align-items: center; gap: 4px }
        .sl-foot { display: flex; gap: 8px; border-top: 1px solid var(--main-border-color, #777); padding-top: 14px }
        .sl-foot .sl-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 14px }
        .sl-empty { text-align: center; padding: 34px 10px; opacity: .65 }
        .sl-empty i { display: block; font-size: 34px; margin-bottom: 8px; opacity: .7 }

        .sl-item { width: 34px; height: 34px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: inherit; cursor: pointer; font-size: 17px; transition: background .12s, transform .12s }
        .sl-item:hover { background: var(--active-item-background-color, rgba(128,128,128,.14)); transform: scale(1.08) }
        .sl-item.active { border-color: var(--main-text-color, #111); background: rgba(128,128,128,.22) }
        .sl-ip-name { margin-top: 6px; min-height: 14px; font-size: 11px; font-family: monospace; opacity: .6 }
        .sl-result { padding: 8px 10px; border-radius: 8px; cursor: pointer; border: 1px solid transparent }
        .sl-result:hover, .sl-result.sl-sel { background: rgba(128,128,128,.14); border-color: var(--main-border-color, rgba(128,128,128,.4)) }

        .sl-toolbar button { padding: 4px 8px; background: transparent; color: inherit; border: 1px solid transparent; border-radius: 5px; cursor: pointer }
        .sl-toolbar button:hover { background: rgba(128,128,128,.18) }
        .sl-toolbar label { display: flex; align-items: center; gap: 4px; font-size: 12px }
        .sl-color { appearance: none; -webkit-appearance: none; padding: 0; border: 1px solid var(--main-border-color, #888); cursor: pointer; border-radius: 8px }
        .sl-color::-webkit-color-swatch-wrapper { padding: 0 }
        .sl-color::-webkit-color-swatch { border: 0; border-radius: 7px }
        .sl-modal summary { cursor: pointer; font-weight: 600; margin: 4px 0 8px }

        @media (prefers-reduced-motion: reduce) { .sl-panel, .sl-btn, .sl-item, .sl-actions, .sl-grip, .sl-input { animation: none !important; transition: none !important } }
        @media (max-width: 600px) {
            .sl-panel { padding: 16px 12px !important; width: 96vw !important }
            .sl-main { padding: 8px 10px 8px 14px; gap: 10px }
            .sl-icon { padding: 5px !important }
            .sl-hints, .sl-num, .sl-foot .sl-label-text { display: none !important }
            .sl-grip { display: none !important; }
            .sl-order-ctrls { flex-direction: row; margin-right: 6px; gap: 4px; }
            .sl-move-btn { padding: 8px; }
            .sl-move-btn svg { width: 18px; height: 18px; }
        }
    `;

    (function injectStyles() {
        let el = document.getElementById(APP.styleId);
        if (!el) {
            el = document.createElement("style");
            el.id = APP.styleId;
            document.head.appendChild(el);
        }
        el.textContent = CSS;
    })();

    function svg(body) {
        return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + body + "</svg>";
    }

    const ICON = {
        settings: svg('<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>'),
        edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L8 18l-4 1 1-4z"/>'),
        copy: svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>'),
        trash: svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 16H6L5 6"/>'),
        plus: svg('<path d="M12 5v14M5 12h14"/>'),
        up: svg('<path d="M12 19V5M5 12l7-7 7 7"/>'),
        down: svg('<path d="M12 5v14M5 12l7 7 7-7"/>'),
        grip: svg('<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>')
    };

    /* ---------------------------------------------------------------------
       Icons
       --------------------------------------------------------------------- */

    const IconService = {
        legacy: { file: "bx-file", book: "bx-book", zap: "bx-zap", bulb: "bx-bulb", code: "bx-code-alt", star: "bx-star", check: "bx-check-square", target: "bx-target-lock" },
        get: function (val) {
            if (!val) return "bx-file";
            const s = String(val);
            if (this.legacy[s]) return this.legacy[s];
            return ICON_RE.test(s) ? s : "bx-file";
        },
        discover: function () {
            if (window.__slIconCache && window.__slIconCache.length) return window.__slIconCache;
            const skip = /^bx-(spin|flip-|rotate-|burst|flashing|tada|fade-|fw$|xs$|sm$|md$|lg$|border|pull-)/;
            const found = {};
            try {
                for (let i = 0; i < document.styleSheets.length; i++) {
                    try {
                        const rules = document.styleSheets[i].cssRules || [];
                        for (let j = 0; j < rules.length; j++) {
                            const sel = rules[j].selectorText;
                            if (!sel) continue;
                            const m = sel.match(/\.bx[sl]?-[a-z0-9-]+/g) || [];
                            for (let k = 0; k < m.length; k++) {
                                const cls = m[k].substring(1);
                                if (!skip.test(cls)) found[cls] = true;
                            }
                        }
                    } catch (e) { /* cross-origin sheet */ }
                }
            } catch (e) { /* ignore */ }

            let list = Object.keys(found).sort();
            if (list.length < 30) {
                list = ["bx-file", "bx-book", "bx-zap", "bx-bulb", "bx-code-alt", "bx-star", "bx-check-square", "bx-target-lock", "bx-calendar", "bx-folder", "bx-cog", "bx-user", "bx-time", "bx-link", "bx-bookmark", "bx-award", "bx-briefcase", "bx-layer", "bx-terminal", "bx-brain"];
            }
            window.__slIconCache = list;
            return list;
        }
    };

    const ALL_ICONS = IconService.discover();
    const ICON_INDEX = ALL_ICONS.map(function (c) { return { c: c, s: Utils.search(c) }; });

    /* ---------------------------------------------------------------------
       Backend helpers (Mix of Frontend/Backend for UI safety)
       --------------------------------------------------------------------- */

    const Backend = {
        readContent: function (noteId) {
            return api.runOnBackend(function (id) {
                const n = api.getNote(id);
                if (!n) return null;
                const c = n.getContent();
                return typeof c === "string" ? c : String(c);
            }, [noteId]);
        },
        writeContent: function (noteId, content) {
            return api.runOnBackend(function (id, value) {
                const n = api.getNote(id);
                if (n) n.setContent(value);
            }, [noteId, content]);
        },
        createNote: async function (p) {
            // Frontend creation ensures the UI tree updates instantly without reloading
            const res = await api.createNote(p.parentId, {
                title: p.title,
                content: p.content,
                type: p.type || "text",
                mime: p.mime
            });
            const noteId = res.note.noteId;
            
            if (p.attrs && p.attrs.length) {
                await api.runOnBackend(function (id, attrs) {
                    const n = api.getNote(id);
                    if (!n) return;
                    attrs.forEach(function (a) {
                        try {
                            if (a.type === "relation") n.setRelation(a.name, a.value);
                            else n.setLabel(a.name, a.value);
                        } catch (e) { /* skip malformed attribute */ }
                    });
                }, [noteId, p.attrs]);
            }
            return { noteId: noteId, title: res.note.title };
        },
        ensureLabel: function (noteId, name) {
            return api.runOnBackend(function (id, labelName) {
                const n = api.getNote(id);
                if (n && !n.hasLabel(labelName)) n.setLabel(labelName, "");
            }, [noteId, name]);
        },
        describe: function (ids) {
            return api.runOnBackend(function (list) {
                const out = {};
                list.forEach(function (id) {
                    try {
                        const n = api.getNote(id);
                        out[id] = (n && !n.isDeleted) ? { title: n.title } : null;
                    } catch (e) { out[id] = null; }
                });
                return out;
            }, [ids]);
        },
        searchNotes: function (query) {
            return api.runOnBackend(function (q) {
                const safe = String(q || "").replace(/["\\]/g, " ").trim();
                const seen = {};
                const out = [];

                function add(n) {
                    if (!n || seen[n.noteId]) return;
                    seen[n.noteId] = true;
                    const names = [];
                    let cur = n;
                    let guard = 0;
                    while (cur && guard++ < 15) {
                        const parents = cur.getParentNotes ? cur.getParentNotes() : [];
                        cur = parents && parents.length ? parents[0] : null;
                        if (cur && cur.noteId !== "root") names.unshift(cur.title);
                    }
                    out.push({ noteId: n.noteId, title: n.title, path: names.join(" / ") });
                }

                if (!safe) {
                    const root = api.getNote("root");
                    if (root) root.getChildNotes().slice(0, 40).forEach(add);
                    return out;
                }
                if (/^[A-Za-z0-9_]{4,32}$/.test(safe)) {
                    try { add(api.getNote(safe)); } catch (e) { /* not an id */ }
                }
                try {
                    api.searchForNotes('note.title *=* "' + safe + '"').slice(0, 60).forEach(add);
                } catch (e) { /* ignore */ }

                const low = safe.toLowerCase();
                out.sort(function (a, b) {
                    const sa = a.title.toLowerCase().indexOf(low) === 0 ? 0 : 1;
                    const sb = b.title.toLowerCase().indexOf(low) === 0 ? 0 : 1;
                    return sa - sb;
                });
                return out.slice(0, 30);
            }, [query]);
        }
    };

    /* ---------------------------------------------------------------------
       Config repository
       --------------------------------------------------------------------- */

    const Repo = {
        noteId: null,
        actions: [],

        serialize: function (list) {
            return JSON.stringify({ version: APP.version, actions: Utils.clean(list) }, null, 2);
        },
        migrate: function (data) {
            const list = Array.isArray(data) ? data : (data && data.actions);
            if (!Array.isArray(list)) throw new Error("Configuration has no actions array.");
            return list.map(function (item) { return Object.assign({}, item); });
        },
        validate: function (list) {
            if (!Array.isArray(list)) throw new Error("Templates must be an array.");
            const seen = {};
            list.forEach(function (item, i) {
                if (!item || typeof item !== "object") throw new Error("Invalid template " + (i + 1) + ".");
                item.caption = String(item.caption || "").trim();
                if (!item.caption) throw new Error("Template " + (i + 1) + " has no name.");
                item.parentId = String(item.parentId || "").trim();
                if (!item.parentId) throw new Error('"' + item.caption + '" has no destination.');

                item.key = item.key ? String(item.key) : "";
                if (!item.key || seen[item.key]) item.key = Utils.key();
                seen[item.key] = true;

                item.icon = IconService.get(item.icon);
                item.noteIcon = ICON_RE.test(item.noteIcon || "") ? item.noteIcon : "";
                item.titleColor = Utils.color(item.titleColor);
                item.titlePattern = String(item.titlePattern || "").trim() || DEFAULT_TITLE_PATTERN;
                item.attributes = String(item.attributes || "");
                item.template = sanitizeHtml(item.template || "");
                item.openAfter = item.openAfter !== false;
            });
            return list;
        },

        init: async function () {
            let found = [];
            try { found = await api.searchForNotes("#" + APP.label); } catch (e) { /* ignore */ }
            if (!found.length) found = await api.searchForNotes('note.title = "' + APP.title + '"');

            if (!found.length) {
                const res = await Backend.createNote({
                    parentId: "root",
                    title: APP.title,
                    type: "code",
                    mime: "application/json",
                    content: this.serialize(DEFAULTS),
                    attrs: [{ type: "label", name: APP.label, value: "" }]
                });
                this.noteId = res.noteId;
                this.actions = this.validate(Utils.clone(DEFAULTS));
                return;
            }

            this.noteId = found[0].noteId;
            await Backend.ensureLabel(this.noteId, APP.label);

            let raw = "";
            try {
                raw = await Backend.readContent(this.noteId);
                const parsed = this.validate(this.migrate(JSON.parse(raw)));
                this.actions = parsed;
                if (this.serialize(parsed) !== String(raw).trim()) await this.save();
            } catch (error) {
                if (raw && String(raw).trim()) {
                    try {
                        await Backend.createNote({
                            parentId: this.noteId,
                            title: "Unreadable config backup " + Utils.stamp(),
                            type: "code",
                            mime: "application/json",
                            content: raw
                        });
                    } catch (e) { /* ignore */ }
                }
                api.showError("Config could not be read (" + error.message + "). A copy was saved under the config note; using defaults.");
                this.actions = this.validate(Utils.clone(DEFAULTS));
            }
        },
        save: async function () {
            await Backend.writeContent(this.noteId, this.serialize(this.validate(this.actions)));
        },
        backup: async function () {
            await Backend.createNote({
                parentId: this.noteId,
                title: "Backup " + Utils.stamp(),
                type: "code",
                mime: "application/json",
                content: this.serialize(this.actions)
            });
        }
    };

    /* ---------------------------------------------------------------------
       Variables
       --------------------------------------------------------------------- */

    const VAR_SRC = "\\{\\{\\s*([A-Za-z]+)(?::([^}]*))?\\s*\\}\\}";

    function parsePromptSpec(arg) {
        const clean = String(arg || "").replace(/&nbsp;/gi, " ").replace(/<[^>]*>/g, "");
        const i = clean.indexOf("|");
        return {
            name: (i < 0 ? clean : clean.slice(0, i)).trim(),
            def: i < 0 ? "" : clean.slice(i + 1).trim()
        };
    }

    const Variables = {
        prompts: function (text) {
            const re = new RegExp(VAR_SRC, "g");
            const out = [];
            const seen = {};
            let m;
            while ((m = re.exec(String(text || ""))) !== null) {
                if (m[1] !== "prompt") continue;
                const spec = parsePromptSpec(m[2]);
                if (spec.name && !seen[spec.name]) {
                    seen[spec.name] = true;
                    out.push(spec);
                }
            }
            return out;
        },
        apply: function (text, answers, ctx, isHtml) {
            const re = new RegExp(VAR_SRC, "g");
            return String(text || "").replace(re, function (match, name, arg) {
                if (name === "prompt") {
                    const spec = parsePromptSpec(arg);
                    if (!spec.name) return match;
                    const has = Object.prototype.hasOwnProperty.call(answers, spec.name);
                    const val = has ? answers[spec.name] : spec.def;
                    return isHtml ? Utils.esc(val) : String(val);
                }
                if (name === "caption") return isHtml ? Utils.esc(ctx.caption || "") : String(ctx.caption || "");
                if (name === "activeNote") return isHtml ? Utils.esc(ctx.activeTitle) : ctx.activeTitle;
                if (name === "activeNoteLink") {
                    if (!isHtml) return ctx.activeTitle;
                    return ctx.activeId ? '<a class="reference-link" href="#root/' + Utils.esc(ctx.activeId) + '">' + Utils.esc(ctx.activeTitle) + "</a>" : "";
                }
                if (Object.prototype.hasOwnProperty.call(ctx.now, name)) return ctx.now[name];
                return match;
            });
        }
    };

    function getContext() {
        let active = null;
        try { active = api.getActiveContextNote(); } catch (e) { /* ignore */ }
        return {
            now: Utils.now(),
            activeTitle: active ? active.title : "",
            activeId: active ? active.noteId : ""
        };
    }

    function parseAttributes(text) {
        const out = [];
        String(text || "").split(/\r?\n/).forEach(function (line) {
            const parts = [];
            let cur = "";
            let q = null;
            for (let i = 0; i < line.length; i++) {
                const ch = line.charAt(i);
                if (q) { if (ch === q) q = null; cur += ch; }
                else if (ch === '"' || ch === "'") { q = ch; cur += ch; }
                else if (ch === ",") { parts.push(cur); cur = ""; }
                else cur += ch;
            }
            parts.push(cur);

            parts.forEach(function (part) {
                let s = part.trim();
                if (!s) return;
                const isRelation = s.charAt(0) === "~";
                if (s.charAt(0) === "#" || isRelation) s = s.substring(1);
                const pos = s.indexOf("=");
                const name = (pos < 0 ? s : s.substring(0, pos)).trim();
                let val = pos < 0 ? "" : s.substring(pos + 1).trim();
                if (val.length > 1 && (val.charAt(0) === '"' || val.charAt(0) === "'") && val.charAt(val.length - 1) === val.charAt(0)) {
                    val = val.substring(1, val.length - 1);
                }
                if (name && /^[\w:.-]+$/.test(name)) {
                    out.push({ type: isRelation ? "relation" : "label", name: name, value: val });
                }
            });
        });
        return out;
    }

    /* ---------------------------------------------------------------------
       Modal system
       --------------------------------------------------------------------- */

    function openModal(cfg) {
        return new Promise(function (resolve) {
            const prevActive = document.activeElement;
            const cancelVal = ("cancelValue" in cfg) ? cfg.cancelValue : null;
            let settled = false;
            let busy = false;
            let cleanup = null;

            const $w = $((
                '<div class="sl-modal" style="position:fixed;inset:0;z-index:10005;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.65);backdrop-filter:blur(3px)">' +
                '<section class="sl-panel" role="dialog" aria-modal="true" aria-label="' + Utils.esc(cfg.title) + '" style="background:var(--main-background-color,#fff);color:var(--main-text-color,#111);padding:22px 26px;border-radius:13px;width:' + (cfg.width || "700px") + ';max-width:95vw;max-height:90vh;border:1px solid var(--main-border-color,#777);box-shadow:0 25px 60px rgba(0,0,0,.4);display:flex;flex-direction:column">' +
                '<h3 style="margin:0 0 16px">' + Utils.esc(cfg.title) + "</h3>" +
                '<div class="sl-scroll sl-content" style="overflow:auto;margin-bottom:16px;padding:2px 6px 2px 2px">' + cfg.content + "</div>" +
                '<div style="display:flex;justify-content:flex-end;gap:10px;padding-top:14px;border-top:1px solid var(--main-border-color,#777)">' +
                (cfg.noCancel ? "" : '<button type="button" class="sl-btn sl-cancel" style="padding:10px 18px">' + Utils.esc(cfg.cancelText || "Cancel") + "</button>") +
                '<button type="button" class="sl-btn sl-primary sl-ok" style="padding:10px 18px">' + Utils.esc(cfg.okText || "OK") + "</button>" +
                "</div></section></div>"
            ).trim());

            const $ok = $w.find(".sl-ok");

            function finish(val) {
                if (settled) return;
                settled = true;
                try { if (cleanup) cleanup(); } catch (e) { /* ignore */ }
                $w.remove();
                try { if (prevActive && prevActive.focus) prevActive.focus(); } catch (e) { /* ignore */ }
                resolve(val);
            }

            async function submit() {
                if (busy || settled) return;
                busy = true;
                $ok.prop("disabled", true);
                try {
                    const r = cfg.validate ? await cfg.validate($w) : true;
                    if (r !== false && r !== undefined) { finish(r); return; }
                } catch (err) {
                    api.showError(err && err.message ? err.message : String(err));
                }
                busy = false;
                $ok.prop("disabled", false);
            }

            $("body").append($w);
            if (cfg.mount) cleanup = cfg.mount($w, finish) || null;

            $w.on("keydown", function (e) {
                e.stopPropagation(); 
                if (e.key === "Escape") { e.preventDefault(); finish(cancelVal); return; }
                if (e.key === "Enter") {
                    const t = e.target;
                    const plainInput = t.tagName === "INPUT" && t.type !== "color" && t.type !== "checkbox";
                    if (e.ctrlKey || e.metaKey || plainInput) { e.preventDefault(); submit(); return; }
                }
                if (e.key === "Tab") {
                    const f = $w.find('button:not([disabled]),input,textarea,select,summary,[contenteditable="true"]').filter(":visible").toArray();
                    if (!f.length) return;
                    const first = f[0];
                    const last = f[f.length - 1];
                    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
                }
            });

            $w.find(".sl-cancel").on("click", function () { finish(cancelVal); });
            $ok.on("click", submit);

            setTimeout(function () {
                const $auto = $w.find("[data-autofocus]").first();
                ($auto.length ? $auto : $w.find("input,button").first()).focus();
            }, 30);
        });
    }

    /* ---------------------------------------------------------------------
       Icon picker
       --------------------------------------------------------------------- */

    function createIconPicker($host, opts) {
        const LIMIT = 150;
        let current = opts.selected || "";

        $host.html(
            '<input type="text" class="sl-input sl-ip-q" placeholder="Search icons…" style="width:100%;padding:8px;margin-bottom:8px">' +
            '<div class="sl-scroll sl-ip-grid" style="display:flex;flex-wrap:wrap;gap:2px;max-height:150px;overflow:auto;padding:8px;border:1px solid var(--main-border-color,#777);border-radius:8px"></div>' +
            '<div class="sl-ip-name"></div>'
        );
        const $q = $host.find(".sl-ip-q");
        const $grid = $host.find(".sl-ip-grid");
        const $name = $host.find(".sl-ip-name");
        function showName(txt) { $name.text(txt || "no icon"); }

        function btn(cls, inner, title) {
            return '<button type="button" class="sl-item' + (cls === current ? " active" : "") + '" data-class="' + Utils.esc(cls) + '" title="' + Utils.esc(title || cls) + '">' + inner + "</button>";
        }

        function render() {
            const q = Utils.search($q.val());
            const matches = [];
            for (let i = 0; i < ICON_INDEX.length && matches.length <= LIMIT; i++) {
                if (!q || ICON_INDEX[i].s.indexOf(q) !== -1) matches.push(ICON_INDEX[i].c);
            }
            const shown = matches.slice(0, LIMIT);
            let html = "";
            if (opts.allowNone) html += btn("", '<i class="bx bx-minus"></i>', "Default / none");
            if (current && !q && shown.indexOf(current) < 0) html += btn(current, '<i class="bx ' + Utils.esc(current) + '"></i>');
            shown.forEach(function (c) { html += btn(c, '<i class="bx ' + Utils.esc(c) + '"></i>'); });
            if (matches.length > LIMIT) html += '<div style="width:100%;text-align:center;opacity:.6;padding:8px;font-size:12px">Showing the first ' + LIMIT + " - type to narrow the search.</div>";
            else if (!shown.length) html += '<div style="width:100%;text-align:center;opacity:.6;padding:12px">No icons found.</div>';
            $grid.html(html);
        }

        $q.on("input", render);
        $grid.on("mouseover", ".sl-item", function () { showName($(this).attr("data-class")); });
        $grid.on("mouseleave", function () { showName(current); });
        $grid.on("click", ".sl-item", function () {
            current = $(this).attr("data-class") || "";
            showName(current);
            $grid.find(".sl-item").removeClass("active");
            $(this).addClass("active");
            if (opts.onChange) opts.onChange(current);
        });
        render();
        showName(current);

        return { get: function () { return current; } };
    }

    /* ---------------------------------------------------------------------
       Rich-text mini toolbar
       --------------------------------------------------------------------- */

    function buildToolbarHtml() {
        return '<div class="sl-toolbar" style="display:flex;flex-wrap:wrap;align-items:center;gap:5px;padding:7px;margin-bottom:10px;border:1px solid var(--main-border-color,#777);border-radius:6px">' +
            '<button type="button" data-cmd="formatBlock" data-val="H2"><b>H2</b></button>' +
            '<button type="button" data-cmd="formatBlock" data-val="P">P</button>' +
            '<button type="button" data-cmd="bold"><b>B</b></button>' +
            '<button type="button" data-cmd="italic"><i>I</i></button>' +
            '<button type="button" data-cmd="underline"><u>U</u></button>' +
            '<button type="button" data-cmd="insertUnorderedList">• List</button>' +
            '<button type="button" data-cmd="insertOrderedList">1. List</button>' +
            '<button type="button" data-cmd="removeFormat">Clear</button>' +
            '<label>Text <input class="sl-font sl-color" type="color" value="#0000ff" style="width:26px;height:22px"></label>' +
            '<label>Highlight <input class="sl-highlight sl-color" type="color" value="#ffff00" style="width:26px;height:22px"></label>' +
            "</div>";
    }

    function bindToolbar($toolbar, editor) {
        let saved = null;

        function save() {
            const sel = window.getSelection();
            if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) saved = sel.getRangeAt(0).cloneRange();
        }
        function restore() {
            editor.focus();
            if (saved) {
                try {
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(saved);
                } catch (e) { /* ignore */ }
            }
        }
        function exec(cmd, val) {
            restore();
            try { document.execCommand("styleWithCSS", false, true); } catch (e) { /* ignore */ }
            const ok = document.execCommand(cmd, false, val || null);
            save();
            return ok;
        }

        document.addEventListener("selectionchange", save);

        $toolbar.find("button").on("mousedown", function (e) { e.preventDefault(); save(); })
            .on("click", function () { exec($(this).attr("data-cmd"), $(this).attr("data-val")); });
        $toolbar.find(".sl-font").on("input change", function () { exec("foreColor", this.value); });
        $toolbar.find(".sl-highlight").on("input change", function () {
            if (!exec("hiliteColor", this.value)) exec("backColor", this.value);
        });

        $(editor).on("paste", function (e) {
            const cd = (e.originalEvent || e).clipboardData || window.clipboardData;
            if (!cd) return;
            e.preventDefault();
            document.execCommand("insertText", false, cd.getData("text/plain"));
        });

        return function cleanup() { document.removeEventListener("selectionchange", save); };
    }

    /* ---------------------------------------------------------------------
       Destination picker
       --------------------------------------------------------------------- */

    async function pickDestination(opts) {
        opts = opts || {};
        let selected = null;
        let token = 0;
        let items = [];

        const content =
            '<input data-autofocus type="text" class="sl-input sl-dp-q" placeholder="Search notes by title, or paste a Note ID…" autocomplete="off" style="width:100%;padding:11px">' +
            (opts.allowActive ? '<button type="button" class="sl-btn sl-dp-active" style="margin-top:10px;padding:9px 12px;width:100%;text-align:left"><i class="bx bx-pointer"></i> Always use the <b>active note</b> at launch time</button>' : "") +
            '<div class="sl-scroll sl-dp-list" style="margin-top:10px;max-height:300px;min-height:80px;overflow:auto"></div>';

        return openModal({
            title: opts.title || "Choose destination",
            width: "560px",
            okText: "Select",
            content: content,
            mount: function ($w, finish) {
                const $list = $w.find(".sl-dp-list");

                function render() {
                    if (!items.length) { $list.html('<div style="text-align:center;opacity:.6;padding:20px">No notes found.</div>'); return; }
                    $list.html(items.map(function (it) {
                        return '<div class="sl-result' + (selected && selected.noteId === it.noteId ? " sl-sel" : "") + '" data-id="' + Utils.esc(it.noteId) + '">' +
                            '<b><i class="bx bx-file"></i> ' + Utils.esc(it.title) + "</b>" +
                            '<small style="display:block;opacity:.6;margin-left:20px">' + Utils.esc(it.path || "root") + "</small></div>";
                    }).join(""));
                }

                async function run(q) {
                    const t = ++token;
                    let res = [];
                    try { res = await Backend.searchNotes(q); } catch (e) { /* ignore */ }
                    if (t !== token) return;
                    items = res || [];
                    selected = items.length ? items[0] : null;
                    render();
                }

                function findItem(id) {
                    for (let i = 0; i < items.length; i++) if (items[i].noteId === id) return items[i];
                    return null;
                }

                const debounced = Utils.debounce(run, 180);
                $w.find(".sl-dp-q").on("input", function () { debounced(this.value); });
                $w.find(".sl-dp-q").on("keydown", function (e) {
                    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
                    e.preventDefault();
                    if (!items.length) return;
                    let idx = selected ? items.indexOf(selected) : -1;
                    idx = e.key === "ArrowDown" ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1);
                    selected = items[idx];
                    render();
                    const el = $list.find(".sl-sel")[0];
                    if (el) el.scrollIntoView({ block: "nearest" });
                });
                $list.on("click", ".sl-result", function () { selected = findItem($(this).attr("data-id")); render(); });
                $list.on("dblclick", ".sl-result", function () {
                    const it = findItem($(this).attr("data-id"));
                    if (it) finish({ id: it.noteId, title: it.title });
                });
                $w.find(".sl-dp-active").on("click", function () { finish({ id: "@active", title: "Active note (at launch)" }); });

                run("");
            },
            validate: function () {
                if (!selected) { api.showError("Select a note first."); return false; }
                return { id: selected.noteId, title: selected.title };
            }
        });
    }

    /* ---------------------------------------------------------------------
       Template editor dialog
       --------------------------------------------------------------------- */

    async function showEditorDialog(existing) {
        const a = existing || {};
        const dest = { id: a.parentId || "", title: a._parentTitle || "" };
        let launchPicker = null;
        let notePicker = null;

        function destText() {
            if (dest.id === "@active") return "Active note (at launch)";
            return dest.id ? (dest.title || dest.id) : "No destination chosen";
        }

        const content =
            '<div class="sl-card"><div class="sl-card-title">Basics</div>' +
            '<label class="sl-label" style="margin-top:0">Button name</label>' +
            '<input data-autofocus id="sl-caption" class="sl-input" value="' + Utils.esc(a.caption || "") + '" style="width:100%;padding:11px">' +
            '<label class="sl-label">Title format <small style="font-weight:400;opacity:.6">- pattern for the new note\'s title</small></label>' +
            '<input id="sl-title-pattern" class="sl-input" value="' + Utils.esc(a.titlePattern || DEFAULT_TITLE_PATTERN) + '" style="width:100%;padding:10px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px"><small id="sl-title-preview" style="font-weight:600;opacity:.85"></small>' +
            '<small style="opacity:.5">{{caption}} {{date}} {{time}} {{weekday}} {{year}} {{month}} {{day}} {{prompt:Name}}</small></div>' +
            '<label class="sl-label">Destination <small style="font-weight:400;opacity:.6">- where new notes are created</small></label>' +
            '<div style="display:flex;gap:8px;align-items:stretch">' +
            '<div id="sl-dest" class="sl-input" style="flex:1;padding:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div>' +
            '<button type="button" class="sl-btn sl-dest-btn" style="padding:10px 16px">Browse…</button></div></div>' +
            '<div class="sl-card"><div class="sl-card-title">Appearance</div>' +
            '<div style="display:flex;gap:18px;flex-wrap:wrap">' +
            '<div style="flex:1;min-width:240px"><b>Launcher icon</b><div class="sl-pick-launch" style="margin-top:6px"></div></div>' +
            '<div style="flex:1;min-width:240px"><b>Note icon</b><div class="sl-pick-note" style="margin-top:6px"></div></div>' +
            '<div><b>Color</b><br><input id="sl-color" class="sl-color" type="color" value="' + Utils.color(a.titleColor) + '" style="width:44px;height:44px;margin-top:6px"></div></div></div>' +
            '<div class="sl-card"><div class="sl-card-title">Content</div>' +
            '<label class="sl-label" style="margin-top:0">Default attributes <small style="font-weight:400;opacity:.6">- one per line: #label, #label=value, ~relation=noteId</small></label>' +
            '<textarea id="sl-attrs" class="sl-input" style="width:100%;min-height:55px;padding:10px;font-family:monospace">' + Utils.esc(a.attributes || "") + "</textarea>" +
            '<label class="sl-label">Template <small style="font-weight:400;opacity:.6">- {{date}} {{time}} {{datetime}} {{isodate}} {{weekday}} {{activeNote}} {{activeNoteLink}} {{prompt:Name}} {{prompt:Name|default}}</small></label>' +
            buildToolbarHtml() +
            '<div id="sl-editor" contenteditable="true" class="sl-input sl-scroll" style="min-height:170px;max-height:32vh;overflow:auto;padding:14px"></div>' +
            '<label style="display:flex;gap:8px;align-items:center;margin-top:14px"><input type="checkbox" id="sl-open"' + (a.openAfter === false ? "" : " checked") + "> Open the new note after creating it</label></div>";

        return openModal({
            title: a.key ? "Edit Template" : "New Template",
            width: "780px",
            okText: "Save",
            content: content,
            mount: function ($w) {
                $w.find("#sl-dest").text(destText());

                function updateTitlePreview() {
                    const pattern = $w.find("#sl-title-pattern").val() || DEFAULT_TITLE_PATTERN;
                    const demo = {};
                    Variables.prompts(pattern).forEach(function (pr) { demo[pr.name] = "[" + pr.name + "]"; });
                    const demoCtx = { now: Utils.now(), caption: $w.find("#sl-caption").val() || "Template name", activeTitle: "[active note]", activeId: "" };
                    $w.find("#sl-title-preview").text("Preview: " + Variables.apply(pattern, demo, demoCtx, false));
                }
                $w.find("#sl-title-pattern, #sl-caption").on("input", updateTitlePreview);
                updateTitlePreview();

                launchPicker = createIconPicker($w.find(".sl-pick-launch"), { selected: IconService.get(a.icon) });
                notePicker = createIconPicker($w.find(".sl-pick-note"), { selected: a.noteIcon || "", allowNone: true });

                const editor = $w.find("#sl-editor")[0];
                editor.innerHTML = sanitizeHtml(a.template || "");

                $w.find(".sl-dest-btn").on("click", async function () {
                    const picked = await pickDestination({ allowActive: true });
                    if (picked) {
                        dest.id = picked.id;
                        dest.title = picked.title;
                        $w.find("#sl-dest").text(destText());
                    }
                });

                return bindToolbar($w.find(".sl-toolbar"), editor);
            },
            validate: function ($w) {
                const caption = String($w.find("#sl-caption").val() || "").trim();
                if (!caption) { api.showError("Button name is required."); return false; }
                if (!dest.id) { api.showError("Choose a destination first."); return false; }
                return {
                    caption: caption,
                    titlePattern: String($w.find("#sl-title-pattern").val() || "").trim() || DEFAULT_TITLE_PATTERN,
                    parentId: dest.id,
                    icon: launchPicker.get() || "bx-file",
                    noteIcon: notePicker.get(),
                    titleColor: $w.find("#sl-color").val(),
                    attributes: $w.find("#sl-attrs").val(),
                    template: sanitizeHtml($w.find("#sl-editor").html()),
                    openAfter: $w.find("#sl-open").prop("checked")
                };
            }
        });
    }

    /* ---------------------------------------------------------------------
       Launch dialog: variables + title + icon + extra notes in ONE step
       --------------------------------------------------------------------- */

    async function showLaunchDialog(action, ctx, prompts, destTitle) {
        const titleTpl = action.titlePattern || DEFAULT_TITLE_PATTERN;
        const defaults = {};
        prompts.forEach(function (p) { defaults[p.name] = p.def; });

        let noteIcon = action.noteIcon || "";
        let titleDirty = false;

        const promptHtml = prompts.map(function (p, i) {
            return '<label style="display:block;margin-bottom:12px;font-weight:600">' + Utils.esc(p.name) +
                '<input ' + (i === 0 ? "data-autofocus " : "") + 'class="sl-input sl-prompt" data-key="' + Utils.esc(p.name) + '" value="' + Utils.esc(p.def) + '" style="display:block;width:100%;padding:10px;margin-top:5px;font-weight:400"></label>';
        }).join("");

        const content =
            (promptHtml ? '<div class="sl-card"><div class="sl-card-title">Details</div>' + promptHtml + "</div>" : "") +
            '<div class="sl-card"><div class="sl-card-title">Note</div>' +
            '<div style="display:flex;gap:10px;align-items:center;margin-bottom:6px">' +
            '<div id="sl-preview" style="font-size:24px;width:44px;text-align:center"><i class="bx ' + Utils.esc(noteIcon || "bx-file") + '"></i></div>' +
            '<input ' + (promptHtml ? "" : "data-autofocus ") + 'id="sl-title" class="sl-input" value="' + Utils.esc(Variables.apply(titleTpl, defaults, ctx, false)) + '" style="flex:1;padding:11px">' +
            '<input id="sl-launch-color" class="sl-color" type="color" value="' + Utils.color(action.titleColor) + '" style="width:44px;height:44px"></div>' +
            '<small style="display:block;opacity:.65;margin:0 0 12px 54px"><i class="bx bx-folder"></i> ' + Utils.esc(destTitle) + "</small>" +
            '<details><summary>Change note icon</summary><div class="sl-pick-note"></div></details></div>' +
            '<div class="sl-card"><div class="sl-card-title">Additional notes <span>(optional, appended to the template)</span></div>' +
            buildToolbarHtml() +
            '<div id="sl-extra" contenteditable="true" class="sl-input sl-scroll" style="min-height:140px;max-height:34vh;overflow:auto;padding:14px"></div></div>' +
            '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="sl-open"' + (action.openAfter === false ? "" : " checked") + "> Open the new note after creating it</label>" +
            '<small style="display:block;opacity:.5;margin-top:8px">Ctrl+Enter creates the note</small>';

        return openModal({
            title: "Launch: " + action.caption,
            width: "720px",
            okText: "Create note",
            content: content,
            mount: function ($w) {
                const $title = $w.find("#sl-title");
                const collect = function () {
                    const o = {};
                    $w.find(".sl-prompt").each(function () { o[$(this).attr("data-key")] = $(this).val(); });
                    return o;
                };

                $w.find(".sl-prompt").on("input", function () {
                    if (!titleDirty) $title.val(Variables.apply(titleTpl, collect(), ctx, false));
                });
                $title.on("input", function () { titleDirty = true; });

                $w.find(".sl-prompt").on("keydown", function (e) {
                    if (e.key !== "Enter" || e.ctrlKey || e.metaKey) return;
                    const $all = $w.find(".sl-prompt");
                    const i = $all.index(this);
                    if (i < $all.length - 1) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        $all.eq(i + 1).focus();
                    }
                });

                createIconPicker($w.find(".sl-pick-note"), {
                    selected: noteIcon,
                    allowNone: true,
                    onChange: function (v) {
                        noteIcon = v;
                        $w.find("#sl-preview i").attr("class", "bx " + (v || "bx-file"));
                    }
                });

                return bindToolbar($w.find(".sl-toolbar"), $w.find("#sl-extra")[0]);
            },
            validate: function ($w) {
                const title = String($w.find("#sl-title").val() || "").trim();
                if (!title) { api.showError("Title is required."); return false; }
                const answers = {};
                $w.find(".sl-prompt").each(function () { answers[$(this).attr("data-key")] = $(this).val(); });
                return {
                    title: title,
                    color: $w.find("#sl-launch-color").val(),
                    noteIcon: ICON_RE.test(noteIcon || "") ? noteIcon : "",
                    answers: answers,
                    extra: sanitizeHtml($w.find("#sl-extra").html()),
                    open: $w.find("#sl-open").prop("checked")
                };
            }
        });
    }

    /* ---------------------------------------------------------------------
       Export / import / confirm dialogs
       --------------------------------------------------------------------- */

    function showExportDialog() {
        const json = Repo.serialize(Repo.actions);
        return openModal({
            title: "Export configuration",
            width: "650px",
            noCancel: true,
            okText: "Done",
            content: '<textarea readonly class="sl-input" style="width:100%;height:300px;padding:10px;font-family:monospace">' + Utils.esc(json) + "</textarea>" +
                '<div style="margin-top:10px"><button type="button" class="sl-btn sl-copy" style="padding:8px 14px">Copy to clipboard</button></div>',
            mount: function ($w) {
                $w.find(".sl-copy").on("click", async function () {
                    const ok = await copyText(json);
                    api.showMessage(ok ? "Copied to clipboard." : "Copy failed - select the text manually.");
                });
            }
        });
    }

    function showImportDialog() {
        return openModal({
            title: "Import configuration",
            width: "650px",
            okText: "Import",
            content: '<p style="margin-top:0">A backup of the current configuration is created first (as a child of the config note).</p>' +
                '<label style="display:block;margin-bottom:10px">Mode <select id="sl-import-mode" class="sl-input" style="padding:6px;margin-left:8px"><option value="replace">Replace everything</option><option value="merge">Add to existing templates</option></select></label>' +
                '<textarea data-autofocus id="sl-import-data" class="sl-input" style="width:100%;height:250px;padding:10px;font-family:monospace"></textarea>',
            validate: function ($w) {
                try {
                    const raw = JSON.parse($w.find("#sl-import-data").val());
                    return { mode: $w.find("#sl-import-mode").val(), actions: Repo.validate(Repo.migrate(raw)) };
                } catch (error) {
                    api.showError("Invalid configuration: " + error.message);
                    return false;
                }
            }
        });
    }

    function confirmDelete(caption) {
        return openModal({
            title: "Delete template",
            width: "420px",
            okText: "Delete",
            content: "<p>Delete “" + Utils.esc(caption) + "”? This cannot be undone.</p>"
        });
    }

    /* ---------------------------------------------------------------------
       Main menu
       --------------------------------------------------------------------- */

    function buildMainMenu(actions, ui, firstOpen) {
        return new Promise(function (resolve) {
            let done = false;
            let kb = 0;
            let dragKey = null;

            const rows = actions.map(function (item) {
                const folderIcon = item.parentId === "@active" ? "bx-pointer" : "bx-folder";
                return '<div class="sl-row" draggable="true" data-key="' + Utils.esc(item.key) + '" data-search="' + Utils.search(item.caption + " " + item._parentTitle) + '" style="--sl-accent:' + Utils.color(item.titleColor) + '">' +
                    '<div class="sl-order-ctrls">' +
                    '<button type="button" class="sl-move-btn sl-move-up" title="Move Up">' + ICON.up + '</button>' +
                    '<span class="sl-grip" title="Drag to reorder (or Alt+↑/↓)">' + ICON.grip + '</span>' +
                    '<button type="button" class="sl-move-btn sl-move-down" title="Move Down">' + ICON.down + '</button>' +
                    '</div>' +
                    '<button type="button" class="sl-btn sl-main">' +
                    '<span class="sl-tile"><i class="bx ' + Utils.esc(IconService.get(item.icon)) + '"></i></span>' +
                    '<span class="sl-text"><b>' + Utils.esc(item.caption) + "</b>" +
                    '<small class="' + (item._missing ? "sl-warn" : "") + '"><i class="bx ' + folderIcon + '"></i>' + Utils.esc(item._parentTitle) + "</small></span>" +
                    '<span class="sl-num"></span></button>' +
                    '<div class="sl-actions">' +
                    '<button type="button" class="sl-icon sl-config" title="Change destination">' + ICON.settings + "</button>" +
                    '<button type="button" class="sl-icon sl-edit" title="Edit">' + ICON.edit + "</button>" +
                    '<button type="button" class="sl-icon sl-clone" title="Duplicate">' + ICON.copy + "</button>" +
                    '<button type="button" class="sl-icon sl-delete" title="Delete">' + ICON.trash + "</button></div></div>";
            }).join("");

            const empty = '<div class="sl-empty"><i class="bx bx-layer-plus"></i>No templates yet.<br>Create your first one below.</div>';
            const kbd = function (t) { return '<span class="sl-kbd">' + t + "</span>"; };

            const $w = $((
                '<div class="sl-overlay" style="position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.62)">' +
                '<section class="sl-panel' + (firstOpen ? "" : " sl-noanim") + '" role="dialog" aria-modal="true" aria-label="Session launcher" style="width:min(680px,96vw);max-height:90vh;display:flex;flex-direction:column;padding:20px 22px 22px;background:var(--main-background-color,#fff);color:var(--main-text-color,#111);border-radius:14px;border:1px solid var(--main-border-color,#777);box-shadow:0 25px 60px rgba(0,0,0,.4)">' +
                '<div class="sl-head"><b>Session Launcher</b><span>' + actions.length + (actions.length === 1 ? " template" : " templates") + "</span></div>" +
                '<div class="sl-searchbar"><i class="bx bx-search"></i><input id="sl-search" class="sl-input" placeholder="Search templates and folders…" autocomplete="off"></div>' +
                '<div class="sl-list sl-scroll" style="overflow:auto;flex:1;min-height:60px;padding:2px 2px 2px 0">' + (rows || empty) + "</div>" +
                '<div class="sl-hints"><span>' + kbd("↑") + kbd("↓") + " navigate</span><span>" + kbd("Enter") + " launch</span><span>" + kbd("Alt") + kbd("1–9") + " quick launch</span><span>" + kbd("Alt") + kbd("↑") + kbd("↓") + " reorder</span><span>" + kbd("Esc") + " close</span></div>" +
                '<div class="sl-foot">' +
                '<button type="button" class="sl-btn sl-primary sl-new" style="flex:1">' + ICON.plus + " New Template</button>" +
                '<button type="button" class="sl-btn sl-export" title="Export configuration">' + ICON.up + '<span class="sl-label-text">Export</span></button>' +
                '<button type="button" class="sl-btn sl-import" title="Import configuration">' + ICON.down + '<span class="sl-label-text">Import</span></button>' +
                '<button type="button" class="sl-btn sl-close">Close</button></div></section></div>'
            ).trim());

            $("body").append($w);

            const $search = $w.find("#sl-search");
            const $list = $w.find(".sl-list");

            function visibleRows() { return $w.find(".sl-row:visible"); }

            function updateFocus(scroll) {
                const $vis = visibleRows();
                $w.find(".sl-row").removeClass("kbf");
                $w.find(".sl-num").text("");
                $vis.each(function (i) { if (i < 9) $(this).find(".sl-num").text(i + 1); });
                if (!$vis.length) return;
                if (kb < 0) kb = 0;
                if (kb >= $vis.length) kb = $vis.length - 1;
                const el = $vis.eq(kb).addClass("kbf")[0];
                if (scroll !== false && el) el.scrollIntoView({ block: "nearest" });
            }

            function applyFilter() {
                const q = Utils.search($search.val());
                $w.find(".sl-row").each(function () {
                    $(this).toggle(String($(this).attr("data-search")).indexOf(q) !== -1);
                });
            }

            function finalize(val) {
                if (done) return;
                done = true;
                const $focused = visibleRows().eq(kb);
                ui.query = $search.val();
                ui.scroll = $list.scrollTop();
                if ($focused.length) ui.focusKey = $focused.attr("data-key");
                $(document).off("keydown.sl");
                $w.remove();
                resolve(val);
            }

            function keyOf(el) { return $(el).closest(".sl-row").attr("data-key"); }

            if (ui.query) { $search.val(ui.query); applyFilter(); }
            if (ui.focusKey) {
                visibleRows().each(function (i) { if ($(this).attr("data-key") === ui.focusKey) kb = i; });
            }
            $list.scrollTop(ui.scroll || 0);

            $search.on("input", function () { applyFilter(); kb = 0; updateFocus(); });

            $(document).on("keydown.sl", function (e) {
                if ($(".sl-modal").length) return; 
                const $vis = visibleRows();

                if (e.key === "Escape") {
                    e.preventDefault();
                    if ($search.val()) { $search.val(""); applyFilter(); kb = 0; updateFocus(); }
                    else finalize(null);
                    return;
                }
                if (e.altKey && /^Digit[1-9]$/.test(e.code)) {
                    const n = parseInt(e.code.charAt(5), 10) - 1;
                    if ($vis.length > n) { e.preventDefault(); finalize({ type: "LAUNCH", key: $vis.eq(n).attr("data-key") }); }
                    return;
                }
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const dir = e.key === "ArrowDown" ? 1 : -1;
                    if (e.altKey) {
                        if ($vis.length) finalize({ type: "MOVE_BY", key: $vis.eq(kb).attr("data-key"), delta: dir });
                    } else {
                        kb += dir;
                        updateFocus();
                    }
                    return;
                }
                if (e.key === "Enter" && $vis.length && !$(e.target).closest("button").length) {
                    e.preventDefault();
                    finalize({ type: "LAUNCH", key: $vis.eq(kb).attr("data-key") });
                }
            });

            function clearDrag() { $w.find(".sl-row").removeClass("sl-drop-before sl-drop-after sl-dragging"); }
            function isAfter(el, e) {
                const r = el.getBoundingClientRect();
                return e.originalEvent.clientY > r.top + r.height / 2;
            }
            $w.on("dragstart", ".sl-row", function (e) {
                dragKey = $(this).attr("data-key");
                $(this).addClass("sl-dragging");
                e.originalEvent.dataTransfer.effectAllowed = "move";
                try { e.originalEvent.dataTransfer.setData("text/plain", dragKey); } catch (err) { /* ignore */ }
            });
            $w.on("dragover", ".sl-row", function (e) {
                e.preventDefault();
                const after = isAfter(this, e);
                $w.find(".sl-row").removeClass("sl-drop-before sl-drop-after");
                $(this).addClass(after ? "sl-drop-after" : "sl-drop-before");
            });
            $w.on("dragend", clearDrag);
            $w.on("drop", ".sl-row", function (e) {
                e.preventDefault();
                const after = isAfter(this, e);
                const to = $(this).attr("data-key");
                clearDrag();
                if (dragKey && dragKey !== to) finalize({ type: "MOVE", from: dragKey, to: to, after: after });
            });

            $w.on("click", ".sl-move-up", function (e) {
                e.stopPropagation();
                finalize({ type: "MOVE_BY", key: keyOf(this), delta: -1 });
            });
            $w.on("click", ".sl-move-down", function (e) {
                e.stopPropagation();
                finalize({ type: "MOVE_BY", key: keyOf(this), delta: 1 });
            });

            $w.on("mousedown", function (e) { if (e.target === $w[0]) finalize(null); });
            $w.on("click", ".sl-main", function () { finalize({ type: "LAUNCH", key: keyOf(this) }); });
            $w.on("click", ".sl-edit", function () { finalize({ type: "EDIT", key: keyOf(this) }); });
            $w.on("click", ".sl-clone", function () { finalize({ type: "CLONE", key: keyOf(this) }); });
            $w.on("click", ".sl-config", function () { finalize({ type: "CONFIG", key: keyOf(this) }); });
            $w.on("click", ".sl-delete", async function () {
                const key = keyOf(this);
                const a = actions.filter(function (x) { return x.key === key; })[0];
                if (await confirmDelete(a ? a.caption : "this template")) finalize({ type: "DELETE", key: key });
            });
            $w.find(".sl-new").on("click", function () { finalize({ type: "CREATE" }); });
            $w.find(".sl-close").on("click", function () { finalize(null); });
            $w.find(".sl-export").on("click", function () { showExportDialog(); });
            $w.find(".sl-import").on("click", async function () {
                const result = await showImportDialog();
                if (result) finalize({ type: "IMPORT", mode: result.mode, actions: result.actions });
            });

            setTimeout(function () { $search.focus(); updateFocus(); }, 30);
        });
    }

    /* ---------------------------------------------------------------------
       Launch workflow
       --------------------------------------------------------------------- */

    async function resolveParent(action) {
        if (action.parentId === "@active") {
            let active = null;
            try { active = api.getActiveContextNote(); } catch (e) { /* ignore */ }
            if (!active) { api.showError("No active note to create the new note under."); return null; }
            return { id: active.noteId, title: active.title };
        }
        const info = await Backend.describe([action.parentId]);
        if (info[action.parentId]) return { id: action.parentId, title: info[action.parentId].title };

        api.showMessage("Destination missing - choose a new one.");
        const picked = await pickDestination({ allowActive: true, title: "Destination missing - choose a new one" });
        if (!picked) return null;
        action.parentId = picked.id;
        await Repo.save();
        return resolveParent(action);
    }

    async function executeLaunchWorkflow(action) {
        const parent = await resolveParent(action);
        if (!parent) return false;

        const ctx = getContext();
        ctx.caption = action.caption;
        const prompts = Variables.prompts((action.titlePattern || DEFAULT_TITLE_PATTERN) + " " + action.template + " " + action.attributes);

        const opts = await showLaunchDialog(action, ctx, prompts, parent.title);
        if (!opts) return false;

        let content = Variables.apply(action.template, opts.answers, ctx, true);
        if (hasVisibleContent(opts.extra)) content += opts.extra;

        const attrs = [];
        if (opts.color && opts.color.toLowerCase() !== NO_COLOR) attrs.push({ type: "label", name: "color", value: opts.color });
        if (opts.noteIcon) attrs.push({ type: "label", name: "iconClass", value: "bx " + opts.noteIcon });
        parseAttributes(Variables.apply(action.attributes, opts.answers, ctx, false)).forEach(function (a) { attrs.push(a); });

        const created = await Backend.createNote({ parentId: parent.id, title: opts.title, content: content, type: "text", attrs: attrs });
        api.showMessage('Created "' + created.title + '"');

        if (opts.open) {
            try { api.activateNote(created.noteId); } catch (e) { /* the note is created anyway */ }
        }
        return true;
    }

    /* ---------------------------------------------------------------------
       Orchestration
       --------------------------------------------------------------------- */

    function findAction(key) {
        for (let i = 0; i < Repo.actions.length; i++) if (Repo.actions[i].key === key) return Repo.actions[i];
        return null;
    }

    function moveAction(fromKey, toKey, after) {
        const arr = Repo.actions;
        const from = arr.findIndex(function (a) { return a.key === fromKey; });
        if (from < 0 || fromKey === toKey) return false;
        const item = arr.splice(from, 1)[0];
        const to = arr.findIndex(function (a) { return a.key === toKey; });
        if (to < 0) { arr.splice(from, 0, item); return false; }
        arr.splice(after ? to + 1 : to, 0, item);
        return true;
    }

    async function refreshParentTitles() {
        const ids = [];
        Repo.actions.forEach(function (a) { if (a.parentId !== "@active" && ids.indexOf(a.parentId) < 0) ids.push(a.parentId); });
        const info = ids.length ? await Backend.describe(ids) : {};
        Repo.actions.forEach(function (a) {
            if (a.parentId === "@active") { a._parentTitle = "Active note (at launch)"; a._missing = false; }
            else {
                const d = info[a.parentId];
                a._parentTitle = d ? d.title : "⚠ Missing destination";
                a._missing = !d;
            }
        });
    }

    async function handleResult(result, ui) {
        switch (result.type) {
            case "MOVE":
                if (moveAction(result.from, result.to, result.after)) await Repo.save();
                ui.focusKey = result.from;
                break;

            case "MOVE_BY": {
                const arr = Repo.actions;
                const i = arr.findIndex(function (a) { return a.key === result.key; });
                const j = i + result.delta;
                if (i >= 0 && j >= 0 && j < arr.length) {
                    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
                    await Repo.save();
                }
                ui.focusKey = result.key;
                break;
            }

            case "DELETE":
                Repo.actions = Repo.actions.filter(function (x) { return x.key !== result.key; });
                ui.focusKey = null;
                await Repo.save();
                break;

            case "CLONE": {
                const src = findAction(result.key);
                if (src) {
                    const copy = Utils.clone(Utils.clean([src])[0]);
                    copy.key = Utils.key();
                    copy.caption = src.caption + " (Copy)";
                    Repo.actions.splice(Repo.actions.indexOf(src) + 1, 0, copy);
                    ui.focusKey = copy.key;
                    await Repo.save();
                }
                break;
            }

            case "CONFIG": {
                const a = findAction(result.key);
                const picked = a ? await pickDestination({ allowActive: true }) : null;
                if (a && picked) { a.parentId = picked.id; await Repo.save(); }
                break;
            }

            case "CREATE": {
                const data = await showEditorDialog({});
                if (data) {
                    const item = Object.assign({ key: Utils.key() }, data);
                    Repo.actions.push(item);
                    ui.focusKey = item.key;
                    await Repo.save();
                }
                break;
            }

            case "EDIT": {
                const a = findAction(result.key);
                if (a) {
                    const data = await showEditorDialog(a);
                    if (data) { Object.assign(a, data); await Repo.save(); }
                }
                break;
            }

            case "IMPORT":
                await Repo.backup();
                Repo.actions = result.mode === "merge"
                    ? Repo.validate(Repo.actions.concat(result.actions))
                    : result.actions;
                await Repo.save();
                api.showMessage("Configuration imported; previous configuration backed up.");
                break;
        }
    }

    try {
        await Repo.init();

        const ui = { query: "", scroll: 0, focusKey: null };
        let firstOpen = true;

        while (true) {
            await refreshParentTitles();
            const result = await buildMainMenu(Repo.actions, ui, firstOpen);
            firstOpen = false;
            if (!result) return;

            if (result.type === "LAUNCH") {
                const action = findAction(result.key);
                if (action) {
                    ui.focusKey = action.key;
                    try {
                        if (await executeLaunchWorkflow(action)) return;
                    } catch (error) {
                        console.error("Session Launcher launch error:", error);
                        api.showError("Could not create the note: " + (error.message || String(error)));
                    }
                }
                continue;
            }

            try {
                await handleResult(result, ui);
            } catch (error) {
                console.error("Session Launcher action error:", error);
                api.showError("Action failed: " + (error.message || String(error)));
            }
        }
    } catch (error) {
        console.error("Session Launcher Error:", error);
        api.showError("Session Launcher Error: " + (error.message || String(error)));
    }
})();
