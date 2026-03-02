// ============================================================
//  E·BRAINS — Ennovyx AI Research Panel
//  Clean ChatGPT-style, light theme, streaming text effect
// ============================================================

let aiPanelOpen     = false;
let aiHistory       = [];
let aiLoading       = false;
let aiCreditsUsed   = 0;
let aiCreditsLimit  = 15;
let attachedDoc     = null; // { name, text }

// ── Firebase user ─────────────────────────────────────────────
function getUid() {
    try { const u = firebase.auth().currentUser; return u ? u.uid : null; }
    catch(e) { return null; }
}

// ── Load quota from server ────────────────────────────────────
async function loadBrainsUsage() {
    const uid = getUid();
    if (!uid) return;
    try {
        const r = await fetch(`/api/ai/usage?userId=${uid}`);
        const d = await r.json();
        aiCreditsUsed  = d.used  || 0;
        aiCreditsLimit = d.limit || 15;
        renderQuota();
    } catch(e) {}
}

function renderQuota() {
    const remaining = aiCreditsLimit - aiCreditsUsed;
    const el = document.getElementById('brains-usage-counter');
    const banner = document.getElementById('brains-limit-banner');

    if (el) {
        el.textContent = remaining <= 0 ? 'limit reached' : `${remaining} left`;
        el.className = 'brains-quota';
        if (remaining <= 3 && remaining > 0) el.classList.add('warn');
        if (remaining <= 0) el.classList.add('full');
    }

    if (banner) {
        if (remaining <= 0) {
            banner.className = 'brains-notice full';
            banner.innerHTML = '🚫 Daily limit reached. Resets in 24 hours.';
        } else if (remaining <= 3) {
            banner.className = 'brains-notice warn';
            banner.innerHTML = `⚠️ Only ${remaining} question${remaining===1?'':'s'} left today.`;
        } else {
            banner.className = 'brains-notice';
        }
    }
}

// ── Toggle panel ──────────────────────────────────────────────
function toggleAIPanel() {
    const panel = document.getElementById('ai-research-panel');
    const btn   = document.getElementById('ai-toggle-btn');
    if (!panel) {
        console.warn('e·brains: panel not found in DOM yet');
        return;
    }
    aiPanelOpen = !aiPanelOpen;
    const floatBtn = document.getElementById('ai-assistant-btn');
    if (aiPanelOpen) {
        panel.classList.remove('collapsed');
        if (btn) btn.innerHTML = '<span class="btn-pulse"></span>Close';
        if (floatBtn) floatBtn.style.display = 'none';
        loadBrainsUsage();
        setTimeout(() => document.getElementById('ai-query-input')?.focus(), 320);
    } else {
        panel.classList.add('collapsed');
        if (btn) btn.innerHTML = '<span class="btn-pulse"></span>e·brains';
        if (floatBtn) floatBtn.style.display = 'flex';
    }
}
// Expose immediately so onclick="" HTML attributes work before script end
window.toggleAIPanel = toggleAIPanel;

// ── Send message ──────────────────────────────────────────────
async function sendAIResearchMessage() {
    const inputEl = document.getElementById('ai-query-input');
    const query   = inputEl?.value.trim();
    if (!query || aiLoading) return;

    // Hard limit check client-side
    if (aiCreditsUsed >= aiCreditsLimit) {
        showToast('Daily limit reached. Come back tomorrow!', 'warn');
        return;
    }

    // Hide welcome screen
    document.getElementById('brains-welcome-screen')?.remove();

    // Build display text — append doc name if attached
    const displayText = attachedDoc
        ? query
        : query;

    // Append user bubble (with optional doc chip)
    appendUserMsg(query, attachedDoc?.name || null);
    inputEl.value = '';
    inputEl.style.height = 'auto';

    // Build message for API — inject doc text if attached
    let apiContent = query;
    if (attachedDoc) {
        const maxChars = 12000; // ~3000 tokens — safe limit
        const docSnippet = attachedDoc.text.slice(0, maxChars);
        apiContent = `I'm attaching a document for context.\n\n--- DOCUMENT: ${attachedDoc.name} ---\n${docSnippet}\n--- END DOCUMENT ---\n\nMy question: ${query}`;
    }

    aiHistory.push({ role: 'user', content: apiContent });
    showTyping();
    setLoading(true);

    try {
        const uid = getUid();
        const res = await fetch('/api/ai/research', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: aiHistory, userId: uid })
        });
        const data = await res.json();

        removeTyping();

        if (res.status === 429 && data.limitReached) {
            aiCreditsUsed = aiCreditsLimit;
            renderQuota();
            appendAssistantMsg('You\'ve reached your daily limit of 15 questions. Your quota resets every 24 hours. Come back tomorrow!');
            setLoading(false);
            return;
        }
        if (!res.ok) throw new Error(data.error || 'Server error');

        if (data.used  !== undefined) aiCreditsUsed  = data.used;
        if (data.limit !== undefined) aiCreditsLimit = data.limit;
        renderQuota();

        aiHistory.push({ role: 'assistant', content: data.answer });

        // Streaming typewriter effect
        appendAssistantMsgStream(data.answer);

        // Clear attachment after send
        clearAttachedDoc();

    } catch(err) {
        removeTyping();
        appendAssistantMsg('Something went wrong. Please check your connection and try again.');
    } finally {
        setLoading(false);
    }
}

// ── Append user message ───────────────────────────────────────
function appendUserMsg(text, docName) {
    const area = document.getElementById('ai-messages-area');
    if (!area) return;
    const now = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    const g = document.createElement('div');
    g.className = 'brains-msg-group user';
    const docChip = docName
        ? `<div class="brains-doc-preview"><i class="fas fa-file-alt" style="font-size:11px"></i> ${escHtml(docName)}</div>`
        : '';
    g.innerHTML = `
        <div class="brains-bubble">${docChip}${escHtml(text)}</div>
        <div class="brains-msg-actions"><span class="brains-msg-time">${now}</span></div>`;
    area.appendChild(g);
    area.scrollTop = area.scrollHeight;
}

// ── Append assistant message (instant) ───────────────────────
function appendAssistantMsg(text) {
    const area = document.getElementById('ai-messages-area');
    if (!area) return;
    const now = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    const g = document.createElement('div');
    g.className = 'brains-msg-group assistant';
    const escaped = text.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    g.innerHTML = `
        <div class="brains-bubble">${formatMd(text)}</div>
        <div class="brains-msg-actions">
            <span class="brains-msg-time">${now}</span>
            <button class="brains-insert" onclick="insertToDoc(this)" data-text="${escaped}">↙ insert</button>
        </div>`;
    area.appendChild(g);
    area.scrollTop = area.scrollHeight;
    return g;
}

// ── Typewriter streaming effect ───────────────────────────────
function appendAssistantMsgStream(fullText) {
    const area = document.getElementById('ai-messages-area');
    if (!area) return;
    const now = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    const escaped = fullText.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const g = document.createElement('div');
    g.className = 'brains-msg-group assistant';
    g.innerHTML = `
        <div class="brains-bubble" id="streaming-bubble"></div>
        <div class="brains-msg-actions">
            <span class="brains-msg-time">${now}</span>
            <button class="brains-insert" onclick="insertToDoc(this)" data-text="${escaped}" style="opacity:0">↙ insert</button>
        </div>`;
    area.appendChild(g);
    area.scrollTop = area.scrollHeight;

    const bubble = g.querySelector('#streaming-bubble');
    const insertBtn = g.querySelector('.brains-insert');

    // Stream characters with slight randomness for natural feel
    let i = 0;
    const chars = fullText.split('');
    function tick() {
        if (i >= chars.length) {
            // Done — render final formatted version
            bubble.id = '';
            bubble.innerHTML = formatMd(fullText);
            insertBtn.style.opacity = '1';
            area.scrollTop = area.scrollHeight;
            return;
        }
        // Chunk 2-4 chars per frame for smooth speed
        const chunk = Math.floor(Math.random() * 3) + 2;
        i = Math.min(i + chunk, chars.length);
        bubble.textContent = fullText.slice(0, i);
        area.scrollTop = area.scrollHeight;
        // Slightly variable speed — faster for spaces, slower for punctuation
        const char = fullText[i-1];
        const delay = /[.!?]/.test(char) ? 60 : /[,;:]/.test(char) ? 30 : 8;
        setTimeout(tick, delay);
    }
    tick();
}

// ── Insert into doc ───────────────────────────────────────────
function insertToDoc(btn) {
    const rawText = btn.dataset.text;
    const editor  = document.getElementById('editor-content-editable');
    if (!editor) return;
    editor.focus();
    const p = document.createElement('p');
    p.style.cssText = 'margin:8px 0;padding:12px 16px;background:#f5f5ff;border-left:3px solid #6366f1;border-radius:0 8px 8px 0;color:#1e1e3f;font-size:14px;line-height:1.6;';
    p.innerText = rawText;
    editor.appendChild(p);
    editor.scrollTop = editor.scrollHeight;
    const orig = btn.textContent;
    btn.textContent = '✓ done';
    btn.style.color = '#22c55e';
    setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 2000);
    if (typeof saveActiveDocument === 'function') saveActiveDocument();
}

// ── Quick prompts ─────────────────────────────────────────────
function sendQuickPrompt(text) {
    if (!aiPanelOpen) toggleAIPanel();
    setTimeout(() => {
        const inp = document.getElementById('ai-query-input');
        if (!inp) return;
        inp.value = text + ' ';
        inp.focus();
        inp.setSelectionRange(inp.value.length, inp.value.length);
        autoResizeAIInput(inp);
    }, 340);
}

// ── Typing indicator ──────────────────────────────────────────
function showTyping() {
    const area = document.getElementById('ai-messages-area');
    if (!area) return;
    const el = document.createElement('div');
    el.className = 'brains-msg-group assistant';
    el.id = 'brains-typing';
    el.innerHTML = '<div class="brains-typing-bubble"><span></span><span></span><span></span></div>';
    area.appendChild(el);
    area.scrollTop = area.scrollHeight;
}
function removeTyping() {
    document.getElementById('brains-typing')?.remove();
}

// ── Loading ───────────────────────────────────────────────────
function setLoading(v) {
    aiLoading = v;
    const btn = document.getElementById('ai-send-btn');
    const inp = document.getElementById('ai-query-input');
    if (btn) btn.disabled = v;
    if (inp) inp.disabled = v;
}

// ── Input helpers ─────────────────────────────────────────────
function autoResizeAIInput(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}
function handleAIInputKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAIResearchMessage(); }
}

// ── Doc attachment ────────────────────────────────────────────
function triggerBrainsAttach() {
    document.getElementById('brains-file-input')?.click();
}

async function handleBrainsAttach(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';
    const ext = file.name.split('.').pop().toLowerCase();

    try {
        let text = '';
        if (ext === 'txt') {
            text = await file.text();
        } else if (ext === 'html' || ext === 'htm') {
            const raw = await file.text();
            const tmp = document.createElement('div');
            tmp.innerHTML = raw;
            text = tmp.innerText;
        } else if (ext === 'pdf') {
            showToast('PDF: copy-paste the text for now. Full PDF support coming soon.', 'info');
            return;
        } else if (ext === 'docx' || ext === 'doc') {
            if (typeof mammoth === 'undefined') {
                await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js');
            }
            const buf = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer: buf });
            text = result.value || '';
        } else {
            showToast('Unsupported file. Try .txt, .docx, or .html', 'warn');
            return;
        }

        if (!text.trim()) { showToast('File appears empty.', 'warn'); return; }

        attachedDoc = { name: file.name, text };
        const chip = document.getElementById('brains-attached-chip');
        const nameEl = document.getElementById('brains-attached-name');
        if (chip) chip.style.display = 'flex';
        if (nameEl) nameEl.textContent = file.name;
        document.getElementById('ai-query-input')?.focus();
        showToast(`📎 ${file.name} attached`, 'ok');

    } catch(err) {
        showToast('Could not read file. Try saving as .txt', 'warn');
    }
}

function removeAttachedDoc() {
    attachedDoc = null;
    const chip = document.getElementById('brains-attached-chip');
    if (chip) chip.style.display = 'none';
}
function clearAttachedDoc() {
    attachedDoc = null;
    const chip = document.getElementById('brains-attached-chip');
    if (chip) chip.style.display = 'none';
}

// ── Markdown formatter ────────────────────────────────────────
function formatMd(text) {
    const lines = text
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .split('\n');
    let html = '';
    let inUl = false;
    for (let line of lines) {
        // Bold + italic inline
        line = line
            .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
            .replace(/\*(.*?)\*/g,'<em>$1</em>')
            .replace(/`(.*?)`/g,'<code>$1</code>');
        if (/^[\-\*] /.test(line)) {
            if (!inUl) { html += '<ul>'; inUl = true; }
            html += `<li>${line.replace(/^[\-\*] /,'')}</li>`;
        } else {
            if (inUl) { html += '</ul>'; inUl = false; }
            if (line.trim() === '') { html += '<br>'; }
            else { html += `<p>${line}</p>`; }
        }
    }
    if (inUl) html += '</ul>';
    return html;
}

function escHtml(t) {
    return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type) {
    const colors = { warn:'#d97706', ok:'#059669', info:'#6366f1' };
    const n = document.createElement('div');
    n.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
        background:#1f2937;color:#f9fafb;padding:10px 18px;border-radius:10px;
        z-index:99999;font-size:13px;font-family:Inter,sans-serif;
        box-shadow:0 8px 24px rgba(0,0,0,0.2);white-space:nowrap;
        border-left:3px solid ${colors[type]||'#6366f1'};`;
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(()=>n.remove(), 3500);
}

function loadScript(src) {
    return new Promise((res,rej)=>{
        const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;
        document.head.appendChild(s);
    });
}

// ── Email helpers (called from settings.js) ───────────────────
async function registerEmailSchedule(enabled, time) {
    try {
        const user = firebase.auth().currentUser;
        if (!user) return;
        await fetch('/api/email/register-schedule', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ uid:user.uid, email:user.email,
                name: user.displayName||user.email.split('@')[0], time:time||'08:00', enabled })
        });
    } catch(e) {}
}

async function sendTestEmailViaServer() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) { showToast('Please log in first.','warn'); return; }
        const r = await fetch('/api/email/send-summary', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ to:user.email,
                userName: user.displayName||user.email.split('@')[0],
                date: new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'}),
                tasks:[], events:[], documents:[], notes:[]
            })
        });
        const d = await r.json();
        showToast(d.success ? '✅ Test email sent!' : '❌ '+(d.error||'Failed'), d.success?'ok':'warn');
    } catch(e) { showToast('❌ Could not reach email server.','warn'); }
}

// ── Document import (library Import button) ───────────────────
function openImportModal() {
    document.getElementById('import-modal-overlay')?.classList.add('show');
    setupDropZone();
}
function closeImportModal() {
    document.getElementById('import-modal-overlay')?.classList.remove('show');
}
document.addEventListener('click', e => {
    const overlay = document.getElementById('import-modal-overlay');
    if (overlay && e.target === overlay) closeImportModal();
});
function setupDropZone() {
    const zone = document.getElementById('import-drop-zone');
    if (!zone || zone._set) return; zone._set = true;
    zone.addEventListener('dragover', e=>{e.preventDefault();zone.classList.add('dragover')});
    zone.addEventListener('dragleave', ()=>zone.classList.remove('dragover'));
    zone.addEventListener('drop', e=>{
        e.preventDefault(); zone.classList.remove('dragover');
        const f = e.dataTransfer.files[0]; if(f) processImportedFile(f);
    });
}
async function handleImportFile(event) {
    const f = event.target.files[0]; if(!f) return;
    processImportedFile(f); event.target.value='';
}
async function processImportedFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    closeImportModal();
    const doc = {id:'new', title:file.name.replace(/\.[^.]+$/,''), content:'', date:new Date()};
    if (ext==='txt') {
        const t = await file.text();
        doc.content = t.split('\n').map(l=>`<p>${l||'&nbsp;'}</p>`).join('');
        openImportedDoc(doc);
    } else if (ext==='html'||ext==='htm') {
        const t = await file.text();
        const m = t.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        doc.content = m?m[1]:t; openImportedDoc(doc);
    } else if (ext==='docx'||ext==='doc') {
        if(typeof mammoth==='undefined') await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js');
        try {
            const r = await mammoth.convertToHtml({arrayBuffer: await file.arrayBuffer()});
            doc.content = r.value||'<p>Could not extract content.</p>';
            openImportedDoc(doc);
        } catch(e) { showToast('Could not read .docx — try .txt','warn'); }
    } else { showToast('Unsupported file. Try .docx, .txt, .html','warn'); }
}
function openImportedDoc(doc) {
    if(typeof documentsArray!=='undefined') documentsArray.unshift(doc);
    if(typeof openDocumentEditor==='function') {
        openDocumentEditor('new');
        setTimeout(()=>{
            const ed=document.getElementById('editor-content-editable');
            const nm=document.getElementById('current-document-name-input');
            if(ed) ed.innerHTML=doc.content;
            if(nm) nm.value=doc.title;
        },150);
    }
}
async function importGoogleDoc() {
    const url = document.getElementById('import-gdoc-url')?.value.trim();
    if(!url||!url.includes('docs.google.com')){showToast('Paste a valid Google Docs link','warn');return;}
    const m=url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if(!m){showToast('Could not find doc ID','warn');return;}
    closeImportModal();
    openImportedDoc({id:'new',title:'Google Doc Import',date:new Date(),
        content:`<div style="background:#fffbeb;border:1px solid #fde68a;padding:16px;border-radius:8px;font-size:13px;color:#856404;">
        <strong>To import your Google Doc:</strong><br><br>
        1. In Google Docs: <strong>File → Download → Web Page (.html)</strong><br>
        2. Extract the zip then Import the .html file<br>
        <em>Doc ID: ${m[1]}</em></div>`});
}

// ── Expose globals ────────────────────────────────────────────
Object.assign(window, {
    toggleAIPanel, sendAIResearchMessage, sendQuickPrompt,
    insertToDoc, handleAIInputKey, autoResizeAIInput,
    triggerBrainsAttach, handleBrainsAttach, removeAttachedDoc,
    openImportModal, closeImportModal, handleImportFile, importGoogleDoc,
    registerEmailSchedule, sendTestEmailViaServer
});

// ============================================================
//  E·BRAINS FULL PAGE — SuperAgents-style layout
//  Two states: welcome (hero+input) → chat (messages+input)
// ============================================================

let apHistory   = [];
let apLoading   = false;
let apAttached  = null;
let apInChat    = false; // tracks whether we're in chat state

// ── Quota display ─────────────────────────────────────────────
function apRenderQuota() {
    const remaining = aiCreditsLimit - aiCreditsUsed;
    ['ai-page-quota-counter', 'ai-page-quota-counter-chat'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = remaining <= 0 ? 'Limit reached' : `${remaining} left today`;
        el.className = 'ebr-quota';
        if (remaining <= 3 && remaining > 0) el.classList.add('warn');
        if (remaining <= 0) el.classList.add('full');
    });
    // Notices
    ['ai-page-notice', 'ai-page-notice-chat'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (remaining <= 0) {
            el.className = 'ebr-limit-notice full';
            el.textContent = '🚫 Daily limit reached. Resets in 24 hours.';
        } else if (remaining <= 3) {
            el.className = 'ebr-limit-notice warn';
            el.textContent = `⚠️ Only ${remaining} question${remaining===1?'':'s'} left today.`;
        } else {
            el.className = 'ebr-limit-notice';
        }
    });
}

// Called when tab opens
function apOnTabOpen() {
    loadBrainsUsage().then(() => apRenderQuota());
    // Focus the right input
    const inp = document.getElementById(apInChat ? 'ai-page-input-chat' : 'ai-page-input');
    if (inp) setTimeout(() => inp.focus(), 120);
}

// ── Switch to chat state ───────────────────────────────────────
function apEnterChat() {
    if (apInChat) return;
    apInChat = true;
    const welcome = document.getElementById('ai-page-welcome');
    const chatEl  = document.getElementById('ebr-chat-state');
    if (welcome) welcome.style.display = 'none';
    if (chatEl)  { chatEl.style.display = 'flex'; chatEl.style.flexDirection = 'column'; }
    // sync quota
    apRenderQuota();
}

// ── Get the right input ────────────────────────────────────────
function apGetInput() {
    return document.getElementById(apInChat ? 'ai-page-input-chat' : 'ai-page-input');
}
function apGetSendBtn() {
    return document.getElementById(apInChat ? 'ai-page-send-btn-chat' : 'ai-page-send-btn');
}

// ── Send ──────────────────────────────────────────────────────
async function apSend() {
    const inputEl = apGetInput();
    const query   = inputEl?.value.trim();
    if (!query || apLoading) return;

    if (aiCreditsUsed >= aiCreditsLimit) {
        showToast('Daily limit reached. Come back tomorrow!', 'warn');
        return;
    }

    // On first message, switch to chat state
    apEnterChat();

    // Small delay to let DOM switch
    await new Promise(r => setTimeout(r, 30));

    const msgArea = document.getElementById('ai-page-messages');

    apAppendUser(query, apAttached?.name || null, msgArea);
    if (inputEl) { inputEl.value = ''; inputEl.style.height = 'auto'; }

    let apiContent = query;
    if (apAttached) {
        apiContent = `I'm attaching a document for context.\n\n--- DOCUMENT: ${apAttached.name} ---\n${apAttached.text.slice(0,12000)}\n--- END DOCUMENT ---\n\nMy question: ${query}`;
    }
    apHistory.push({ role:'user', content:apiContent });
    apShowTyping(msgArea);
    apSetLoading(true);

    try {
        const res  = await fetch('/api/ai/research', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ messages:apHistory, userId:getUid() })
        });
        const data = await res.json();
        apRemoveTyping();

        if (res.status === 429 && data.limitReached) {
            aiCreditsUsed = aiCreditsLimit;
            renderQuota(); apRenderQuota();
            apAppendAssistant("Daily limit reached. Resets in 24 hours.", msgArea);
            return;
        }
        if (!res.ok) throw new Error(data.error || 'Server error');

        if (data.used  !== undefined) aiCreditsUsed  = data.used;
        if (data.limit !== undefined) aiCreditsLimit = data.limit;
        renderQuota(); apRenderQuota();

        apHistory.push({ role:'assistant', content:data.answer });
        apStream(data.answer, msgArea);
        apClearAttached();
    } catch(err) {
        apRemoveTyping();
        apAppendAssistant('Something went wrong. Please check your connection and try again.', msgArea);
    } finally {
        apSetLoading(false);
    }
}

// ── Append user bubble ─────────────────────────────────────────
function apAppendUser(text, docName, area) {
    const now = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    const g = document.createElement('div');
    g.className = 'ebr-msg user';
    const chip = docName ? `<div style="display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.2);border-radius:7px;padding:4px 9px;margin-bottom:6px;font-size:11px;"><i class="fas fa-file-alt" style="font-size:10px"></i>${escHtml(docName)}</div>` : '';
    g.innerHTML = `<div class="ebr-bubble">${chip}${escHtml(text)}</div>
        <div class="ebr-msg-meta"><span class="ebr-time">${now}</span></div>`;
    area.appendChild(g); area.scrollTop = area.scrollHeight;
}

// ── Append assistant (instant, for errors) ─────────────────────
function apAppendAssistant(text, area) {
    const now = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    const escaped = text.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const g = document.createElement('div');
    g.className = 'ebr-msg assistant';
    g.innerHTML = `<div class="ebr-bubble">${formatMd(text)}</div>
        <div class="ebr-msg-meta"><span class="ebr-time">${now}</span>
        <button class="ebr-insert" onclick="apInsertToDoc(this)" data-text="${escaped}">↙ insert</button></div>`;
    area.appendChild(g); area.scrollTop = area.scrollHeight;
}

// ── Streaming typewriter ────────────────────────────────────────
function apStream(fullText, area) {
    const now = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    const escaped = fullText.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const g = document.createElement('div');
    g.className = 'ebr-msg assistant';
    g.innerHTML = `<div class="ebr-bubble" id="ebr-stream-bubble"></div>
        <div class="ebr-msg-meta"><span class="ebr-time">${now}</span>
        <button class="ebr-insert" onclick="apInsertToDoc(this)" data-text="${escaped}" style="opacity:0">↙ insert</button></div>`;
    area.appendChild(g); area.scrollTop = area.scrollHeight;

    const bubble = g.querySelector('#ebr-stream-bubble');
    const btn    = g.querySelector('.ebr-insert');
    let i = 0;
    function tick() {
        if (i >= fullText.length) {
            bubble.id=''; bubble.innerHTML=formatMd(fullText);
            btn.style.opacity='1'; area.scrollTop=area.scrollHeight; return;
        }
        i = Math.min(i + Math.floor(Math.random()*3)+2, fullText.length);
        bubble.textContent = fullText.slice(0,i);
        area.scrollTop = area.scrollHeight;
        const c = fullText[i-1];
        setTimeout(tick, /[.!?]/.test(c)?55:/[,;:]/.test(c)?28:7);
    }
    tick();
}

// ── Insert to doc ──────────────────────────────────────────────
function apInsertToDoc(btn) {
    const editor = document.getElementById('editor-content-editable');
    if (!editor) { showToast('Open a document first.','info'); return; }
    editor.focus();
    const p = document.createElement('p');
    p.style.cssText = 'margin:8px 0;padding:12px 16px;background:#f5f5ff;border-left:3px solid #6366f1;border-radius:0 8px 8px 0;color:#1e1e3f;font-size:14px;line-height:1.6;';
    p.innerText = btn.dataset.text;
    editor.appendChild(p); editor.scrollTop=editor.scrollHeight;
    btn.textContent='✓ inserted'; btn.style.color='#22c55e';
    setTimeout(()=>{ btn.textContent='↙ insert'; btn.style.color=''; }, 2000);
    if (typeof saveActiveDocument==='function') saveActiveDocument();
}

// ── Quick prompts from cards ────────────────────────────────────
function apPageQuickPrompt(text) {
    const inp = document.getElementById('ai-page-input');
    if (!inp) return;
    inp.value = text + ' ';
    inp.focus();
    apResize(inp);
}

// ── Typing indicator ───────────────────────────────────────────
function apShowTyping(area) {
    const el = document.createElement('div');
    el.className='ebr-msg assistant'; el.id='ebr-typing-ind';
    el.innerHTML='<div class="ebr-typing"><span></span><span></span><span></span></div>';
    area.appendChild(el); area.scrollTop=area.scrollHeight;
}
function apRemoveTyping() { document.getElementById('ebr-typing-ind')?.remove(); }

// ── Loading ────────────────────────────────────────────────────
function apSetLoading(v) {
    apLoading = v;
    ['ai-page-send-btn','ai-page-send-btn-chat'].forEach(id => {
        const b = document.getElementById(id); if(b) b.disabled=v;
    });
    const inp = apGetInput(); if(inp) inp.disabled=v;
}

// ── Input resize + key ─────────────────────────────────────────
function apResize(el) {
    el.style.height='auto';
    el.style.height=Math.min(el.scrollHeight,160)+'px';
}
function apResizeChat(el) { apResize(el); }
function apHandleKey(e) { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();apSend();} }
function apHandleKeyChat(e) { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();apSend();} }

// ── Attachment ─────────────────────────────────────────────────
async function apHandleAttach(event) {
    const file=event.target.files[0]; if(!file) return;
    event.target.value='';
    const ext=file.name.split('.').pop().toLowerCase();
    try {
        let text='';
        if(ext==='txt'){ text=await file.text(); }
        else if(ext==='html'||ext==='htm'){ const t=document.createElement('div'); t.innerHTML=await file.text(); text=t.innerText; }
        else if(ext==='docx'||ext==='doc'){
            if(typeof mammoth==='undefined') await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js');
            text=(await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value||'';
        } else { showToast('Try .txt, .docx, or .html','warn'); return; }
        if(!text.trim()){ showToast('File appears empty.','warn'); return; }
        apAttached={name:file.name,text};
        // Show chip in both states
        ['ai-page-attached-chip','ai-page-attached-chip-chat'].forEach(id=>{
            const c=document.getElementById(id); if(c) c.style.display='inline-flex';
        });
        ['ai-page-attached-name','ai-page-attached-name-chat'].forEach(id=>{
            const n=document.getElementById(id); if(n) n.textContent=file.name;
        });
        apGetInput()?.focus();
        showToast(`📎 ${file.name} attached`,'ok');
    } catch(err){ showToast('Could not read file.','warn'); }
}
function apRemoveAttached(){
    apAttached=null;
    ['ai-page-attached-chip','ai-page-attached-chip-chat'].forEach(id=>{
        const c=document.getElementById(id); if(c) c.style.display='none';
    });
}
function apClearAttached(){
    apAttached=null;
    ['ai-page-attached-chip','ai-page-attached-chip-chat'].forEach(id=>{
        const c=document.getElementById(id); if(c) c.style.display='none';
    });
}

// ── Expose ─────────────────────────────────────────────────────
Object.assign(window, {
    apSend, apHandleKey, apHandleKeyChat, apResize, apResizeChat,
    apPageQuickPrompt, apHandleAttach, apRemoveAttached,
    apInsertToDoc, apOnTabOpen
});
