// ==UserScript==
// @name                Instagram Download Button
// @name:zh-TW          Instagram 下載器
// @name:zh-CN          Instagram 下载器
// @name:ja             Instagram ダウンローダー
// @name:ko             Instagram 다운로더
// @name:es             Descargador de Instagram
// @name:fr             Téléchargeur Instagram
// @name:hi             इंस्टाग्राम डाउनलोडर
// @name:ru             Загрузчик Instagram
// @namespace           https://github.com/hfming225/Instagram_Download_Button
// @version             1.18.1
// @compatible          chrome
// @description         Add the download button and the open button to download or open profile picture and media in the posts, stories, and highlights in Instagram
// @description:zh-TW   在Instagram頁面加入下載按鈕與開啟按鈕，透過這些按鈕可以下載或開啟大頭貼與貼文、限時動態、Highlight中的照片或影片
// @description:zh-CN   在Instagram页面加入下载按钮与开启按钮，透过这些按钮可以下载或开启大头贴与贴文、限时动态、Highlight中的照片或影片
// @description:ja      メディアをダウンロードまたは開くためのボタンを追加します
// @description:ko      미디어를 다운로드하거나 여는 버튼을 추가합니다
// @description:es      Agregue botones para descargar o abrir medios
// @description:fr      Ajoutez des boutons pour télécharger ou ouvrir des médias
// @description:hi      मीडिया को डाउनलोड या खोलने के लिए बटन जोड़ें।
// @description:ru      Добавьте кнопки для загрузки или открытия медиа
// @author              ZhiYu
// @match               https://www.instagram.com/*
// @icon                https://www.google.com/s2/favicons?sz=64&domain=instagram.com
// @run-at              document-idle
// @grant               GM_xmlhttpRequest
// @grant               unsafeWindow
// @connect             www.instagram.com
// @connect             i.instagram.com
// @connect             *.instagram.com
// @connect             *.cdninstagram.com
// @connect             *.fbcdn.net
// @updateURL           https://raw.githubusercontent.com/hfming225/Instagram_Download_Button/master/instagram-dl.user.js
// @downloadURL         https://raw.githubusercontent.com/hfming225/Instagram_Download_Button/master/instagram-dl.user.js
// @homepageURL         https://github.com/hfming225/Instagram_Download_Button
// @license             MIT
// ==/UserScript==

// Injection uses a MutationObserver. A 1s timer remains as a backup for SPA route changes.

(function () {
    'use strict';

    // Page-context fetch so cookies and same-origin /api calls keep working
    // when Tampermonkey runs the script outside the page world (@grant not none).
    function pageFetch(input, init) {
        const page = (typeof unsafeWindow !== 'undefined' && unsafeWindow && unsafeWindow.fetch) ? unsafeWindow : window;
        return page.fetch.call(page, input, init);
    }


    // =================
    // =    Options    =
    // =================
    // Old method is faster than new method, but not work or unable get highest resolution media sometime
    const disableNewUrlFetchMethod = false;
    const prefetchAndAttachLink = false; // prefetch and add link into the button elements
    const hoverToFetchAndAttachLink = true;  // fetch and add link when hover the button
    const replaceJpegWithJpg = false;
    // === File name placeholders ===
    // %id% : the poster id
    // %datetime% : the media upload time
    // %medianame% : the original media file name
    // %postId% : the post id
    // %mediaIndex% : the media index in multiple-media posts
    const postFilenameTemplate = '%id%-%datetime%-%medianame%';
    const storyFilenameTemplate = postFilenameTemplate;
    // === Datetime placeholders ===
    // %y%: year (4 digits)
    // %m%: month (01-12)
    // %d%: day (01-31)
    // %H%: hour (00-23)
    // %M%: min (00-59)
    // %S%: sec (00-59)
    const datetimeTemplate = '%y%%m%%d%_%H%%M%%S%';
    // ==================

    const postIdPattern = /^\/p\/([^/]+)\//;
    const postUrlPattern = /instagram\.com\/p\/[\w-]+\//;

    const WEB_APP_ID = '936619743392459';
    const SAVE_ICON_SELECTORS = [
        'polygon[points="20 21 12 13.44 4 21 4 3 20 3 20 21"]',
        'path[d="M20 22a.999.999 0 0 1-.687-.273L12 14.815l-7.313 6.912A1 1 0 0 1 3 21V3a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1Z"]'
    ];
    const SAVE_LABEL = /^(save|saved|unsave|remove|收藏|取消收藏|儲存|已儲存|保存|取消保存|移除)$/i;

    function clickCarouselControl(direction) {
        const legacyClass = direction === 'next' ? '_9zm2' : '_9zm0';
        const legacy = document.getElementsByClassName(legacyClass);
        if (legacy.length > 0) {
            legacy[0].click();
            return;
        }
        const labelRe = direction === 'next'
            ? /^(next|go forward|下一張|下一個|下一步)$/i
            : /^(previous|go back|back|上一張|上一個|上一步)$/i;
        const buttons = document.querySelectorAll('button, [role="button"]');
        for (let i = 0; i < buttons.length; i++) {
            const el = buttons[i];
            const label = (el.getAttribute('aria-label') || '') + ' ' + ((el.querySelector('svg') && el.querySelector('svg').getAttribute('aria-label')) || '');
            if (labelRe.test(label.trim())) {
                el.click();
                return;
            }
        }
    }

    function iconLabel(svg) {
        if (!svg) return '';
        const own = svg.getAttribute('aria-label') || '';
        const title = svg.querySelector('title');
        return (own + ' ' + (title ? title.textContent : '')).trim();
    }

    function isSaveIcon(svg) {
        if (!svg || svg.closest('.custom-btn')) return false;
        if (SAVE_LABEL.test(iconLabel(svg))) return true;
        for (let i = 0; i < SAVE_ICON_SELECTORS.length; i++) {
            if (svg.querySelector(SAVE_ICON_SELECTORS[i]) || (svg.matches && svg.matches(SAVE_ICON_SELECTORS[i]))) return true;
        }
        return false;
    }

    function closestControl(node) {
        return node && node.closest ? node.closest('button, [role="button"]') : null;
    }

    function findSaveButtons(root) {
        const found = [];
        const seen = new Set();
        const push = (btn) => {
            if (!btn || seen.has(btn) || btn.closest('.custom-btn') || btn.closest('[data-igdl-story]') || btn.closest('.igdl-action-cluster')) return;
            seen.add(btn);
            found.push(btn);
        };
        root.querySelectorAll('svg').forEach((svg) => {
            if (isSaveIcon(svg)) push(closestControl(svg));
        });

        // Action row with counts (like / comment / repost / share) and an icon-only bookmark on the right.
        // Runs per post so a recognized bookmark on one article does not skip the others.
        const scopes = root.querySelectorAll('article, main, [role="dialog"]');
        scopes.forEach((scope) => {
            if ([...seen].some((btn) => scope.contains(btn))) return;
            const buttons = [...scope.querySelectorAll('button, [role="button"]')].filter((btn) => {
                return btn.querySelector('svg') && !btn.closest('.custom-btn');
            });
            if (buttons.length < 3) return;
            const withCount = buttons.filter((btn) => /\d/.test((btn.innerText || '').trim()) && (btn.innerText || '').trim().length < 16);
            if (!withCount.length) return;
            const iconOnly = buttons.filter((btn) => !/\d/.test((btn.innerText || '').trim()));
            if (!iconOnly.length) return;
            iconOnly.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
            push(iconOnly[iconOnly.length - 1]);
        });
        return found;
    }

    function templateMetrics(templateBtn, options) {
        const svg = templateBtn && templateBtn.querySelector('svg');
        const cs = templateBtn ? getComputedStyle(templateBtn) : null;
        const opt = options || {};
        let size = 24;
        if (!opt.forceSize && svg) {
            const rect = svg.getBoundingClientRect();
            if (rect.width >= 20 && rect.width <= 28) size = Math.round(rect.width);
        }
        if (opt.forceSize) size = opt.forceSize;
        let pad = 8;
        if (cs) {
            const top = parseFloat(cs.paddingTop);
            if (!isNaN(top) && top >= 0 && top <= 12) pad = top;
        }
        if (opt.padding != null) pad = opt.padding;
        const color = opt.color || (svg ? getComputedStyle(svg).color : (cs ? cs.color : 'currentColor'));
        return { padding: pad + 'px', size: size, strokeWidth: '2', color: color || 'currentColor' };
    }

    function buildIcon(kind, metrics) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const size = String(metrics.size || 24);
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        svg.style.cssText = 'width:' + size + 'px;height:' + size + 'px;min-width:' + size + 'px;min-height:' + size + 'px;max-width:none;display:block;overflow:visible;flex:0 0 auto;';
        // Glyphs span about the same box as the native bookmark (x 4–20, y 3–21).
        const paths = kind === 'download'
            ? ['M12 3.5v11', 'M7 11l5 5 5-5', 'M4.5 20.5h15']
            : ['M14 4h6v6', 'M20 4L10 14', 'M10 5H6.2A1.2 1.2 0 0 0 5 6.2v11.6A1.2 1.2 0 0 0 6.2 19h11.6a1.2 1.2 0 0 0 1.2-1.2V14'];
        paths.forEach((d) => {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', 'currentColor');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(path);
        });
        return svg;
    }

    function createCustomBtn(kind, templateBtn, options) {
        const metrics = templateMetrics(templateBtn, options);
        const btn = document.createElement('div');
        btn.className = 'custom-btn ' + (kind === 'download' ? 'download-btn' : 'newtab-btn');
        btn.setAttribute('role', 'button');
        btn.setAttribute('tabindex', '0');
        const label = kind === 'download' ? 'Download' : 'Open in new tab';
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title', label);
        btn.style.cssText = [
            'display:inline-flex',
            'align-items:center',
            'justify-content:center',
            'align-self:center',
            'flex:0 0 auto',
            'box-sizing:content-box',
            'margin:0',
            'border:0',
            'background:transparent',
            'cursor:pointer',
            'line-height:0',
            'vertical-align:middle',
            'z-index:2',
            'color:' + (metrics.color || 'currentColor'),
            'padding:' + metrics.padding,
            'width:' + metrics.size + 'px',
            'height:' + metrics.size + 'px',
            'min-width:' + metrics.size + 'px',
            'min-height:' + metrics.size + 'px'
        ].join(';');
        btn.appendChild(buildIcon(kind, metrics));
        btn.addEventListener('click', onClickHandler);
        if (hoverToFetchAndAttachLink) btn.addEventListener('mouseenter', onMouseInHandler);
        return btn;
    }

    function pairButtons(templateBtn, options) {
        return [createCustomBtn('newtab', templateBtn, options), createCustomBtn('download', templateBtn, options)];
    }

    function attachPrefetch(buttons) {
        if (!prefetchAndAttachLink) return;
        buttons.forEach((btn) => onMouseInHandler({ currentTarget: btn }));
    }

    function isRowFlex(el) {
        if (!el) return false;
        const cs = getComputedStyle(el);
        const display = cs.display;
        if (display !== 'flex' && display !== 'inline-flex') return false;
        return cs.flexDirection === 'row' || cs.flexDirection === 'row-reverse';
    }

    function findHorizontalActionRow(saveBtn) {
        let node = saveBtn.parentElement;
        let fallback = null;
        for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
            if (node === document.body || node === document.documentElement) break;
            const buttons = [...node.querySelectorAll('button, [role="button"]')].filter((btn) => {
                return btn.querySelector('svg') && !btn.closest('.custom-btn') && !btn.closest('.igdl-action-cluster');
            });
            const hasCount = buttons.some((btn) => /\d/.test((btn.innerText || '').trim()));
            if (hasCount && buttons.length >= 3) {
                if (isRowFlex(node)) return node;
                fallback = fallback || node;
            }
        }
        return fallback || saveBtn.parentElement;
    }

    function injectBeforeSave(saveBtn) {
        if (!saveBtn || saveBtn.closest('.igdl-action-cluster') || saveBtn.closest('[data-igdl-story]')) return;
        const row = findHorizontalActionRow(saveBtn);
        if (!row) return;
        let slot = saveBtn;
        while (slot.parentElement && slot.parentElement !== row) slot = slot.parentElement;
        const cluster = document.createElement('div');
        cluster.className = 'igdl-action-cluster';
        cluster.style.cssText = 'display:inline-flex;flex-flow:row nowrap;align-items:center;justify-content:flex-end;width:max-content;max-width:none;flex:0 0 auto;align-self:center;margin:0;';
        row.insertBefore(cluster, slot);
        const [newtabBtn, downloadBtn] = pairButtons(saveBtn, { forceSize: 24 });
        cluster.append(newtabBtn, downloadBtn, saveBtn);
        if (slot !== saveBtn && slot.childElementCount === 0) slot.remove();
        attachPrefetch([newtabBtn, downloadBtn]);
    }

    function looksLikeProgressRow(el) {
        const kids = [...el.children].filter((kid) => !kid.classList.contains('igdl-story-tools') && !kid.classList.contains('custom-btn'));
        if (kids.length < 1 || kids.length > 40) return false;
        const rects = kids.map((kid) => kid.getBoundingClientRect());
        if (rects.some((rect) => rect.width < 16 || rect.height < 1.5 || rect.height > 8)) return false;
        const parent = el.getBoundingClientRect();
        if (parent.width < 140) return false;
        const sum = rects.reduce((total, rect) => total + rect.width, 0);
        return sum >= parent.width * 0.6;
    }

    function headerControls(viewer) {
        const bounds = viewer.getBoundingClientRect();
        return [...viewer.querySelectorAll('button, [role="button"]')].filter((btn) => {
            if (btn.closest('.custom-btn, .igdl-story-tools')) return false;
            if (!btn.querySelector('svg')) return false;
            const rect = btn.getBoundingClientRect();
            if (rect.width < 8 || rect.height < 8 || rect.width > 72 || rect.height > 72) return false;
            return rect.top >= bounds.top - 2 && rect.top < bounds.top + 96;
        });
    }

    function findStoryViewers() {
        const viewers = [];
        const seen = new Set();
        const nodes = document.querySelectorAll('div');
        for (let i = 0; i < nodes.length; i++) {
            const row = nodes[i];
            if (row.childElementCount < 1 || row.childElementCount > 40) continue;
            if (row.closest('.custom-btn, .igdl-story-tools')) continue;
            if (!looksLikeProgressRow(row)) continue;
            const rowTop = row.getBoundingClientRect().top;
            let node = row.parentElement;
            for (let depth = 0; node && depth < 10 && node !== document.body; depth++, node = node.parentElement) {
                const rect = node.getBoundingClientRect();
                if (rect.height < 280 || rect.width < 180) continue;
                if (rowTop - rect.top > 48) continue;
                if (!headerControls(node).length) continue;
                if (!seen.has(node)) {
                    seen.add(node);
                    viewers.push(node);
                }
                break;
            }
        }
        return viewers;
    }

    function injectStoryIntoViewer(viewer) {
        if (!viewer || viewer.querySelector('.igdl-story-tools')) {
            if (viewer) viewer.setAttribute('data-igdl-story', '1');
            return;
        }
        const controls = headerControls(viewer);
        if (!controls.length) return;
        controls.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
        const menu = controls[controls.length - 1];
        const parent = menu.parentElement;
        if (!parent) return;
        const parentStyle = getComputedStyle(parent);
        if (parentStyle.display === 'flex' || parentStyle.display === 'inline-flex') {
            if (parentStyle.flexDirection === 'column') parent.style.flexDirection = 'row';
            if (parentStyle.flexWrap === 'wrap') parent.style.flexWrap = 'nowrap';
            parent.style.alignItems = 'center';
        }
        viewer.setAttribute('data-igdl-story', '1');
        const tools = document.createElement('span');
        tools.className = 'igdl-story-tools';
        tools.style.cssText = 'display:inline-flex;flex-flow:row nowrap;align-items:center;flex:0 0 auto;margin-left:12px;color:#fff;position:relative;z-index:6;';
        const [newtabBtn, downloadBtn] = pairButtons(menu, { forceSize: 24, color: '#fff', padding: 8 });
        newtabBtn.style.color = '#fff';
        downloadBtn.style.color = '#fff';
        tools.append(newtabBtn, downloadBtn);
        menu.insertAdjacentElement('afterend', tools);
        attachPrefetch([newtabBtn, downloadBtn]);
    }

    function injectStoryFallback() {
        if (document.querySelector('.igdl-story-tools, .igdl-story-fallback')) return;
        const bar = document.createElement('div');
        bar.className = 'igdl-story-fallback';
        bar.setAttribute('data-igdl-story', '1');
        bar.style.cssText = 'position:fixed;top:56px;right:16px;z-index:100000;display:flex;flex-flow:row nowrap;align-items:center;color:#fff;background:rgba(0,0,0,0.45);border-radius:8px;';
        const [newtabBtn, downloadBtn] = pairButtons(null, { forceSize: 24, color: '#fff', padding: 8 });
        newtabBtn.style.color = '#fff';
        downloadBtn.style.color = '#fff';
        bar.append(newtabBtn, downloadBtn);
        document.body.appendChild(bar);
        attachPrefetch([newtabBtn, downloadBtn]);
    }

    let storyMisses = 0;
    function clearInjected() {
        document.querySelectorAll('.igdl-action-cluster').forEach((cluster) => {
            const save = [...cluster.children].find((el) => !el.classList.contains('custom-btn'));
            if (save && cluster.parentElement) cluster.parentElement.insertBefore(save, cluster);
            cluster.remove();
        });
        document.querySelectorAll('.custom-btn, .igdl-story-fallback, .igdl-story-tools').forEach((node) => node.remove());
        document.querySelectorAll('[data-igdl-story]').forEach((node) => node.removeAttribute('data-igdl-story'));
    }

    function scanUi() {
        if (!document.body) return;
        const curUrl = location.href;
        if (preUrl !== curUrl) {
            clearInjected();
            storyUrlCache.clear();
            storyMisses = 0;
            preUrl = curUrl;
        }

        const viewers = findStoryViewers();
        viewers.forEach(injectStoryIntoViewer);
        const storyPage = location.pathname.indexOf('/stories/') !== -1;
        if (viewers.length) {
            document.querySelectorAll('.igdl-story-fallback').forEach((node) => node.remove());
            storyMisses = 0;
        } else if (storyPage) {
            storyMisses += 1;
            if (storyMisses >= 4) injectStoryFallback();
        }
        if (storyPage) return;

        findSaveButtons(document).forEach(injectBeforeSave);

        if (!storyPage && document.querySelector('header section svg circle')) {
            const header = document.querySelector('header');
            if (header && !header.querySelector('.custom-btn') && document.getElementsByClassName('custom-btn').length === 0) {
                addCustomBtn(document.querySelector('header section svg circle'), 'inherit', append2Header);
            }
        }
    }

    let scanScheduled = false;
    function scheduleScan() {
        if (scanScheduled) return;
        scanScheduled = true;
        setTimeout(() => {
            scanScheduled = false;
            try { scanUi(); } catch (err) { console.log('scanUi', err); }
        }, 80);
    }

    const uiObserver = new MutationObserver((mutations) => {
        for (let i = 0; i < mutations.length; i++) {
            const target = mutations[i].target;
            if (target && target.closest && (target.closest('.custom-btn') || target.closest('.igdl-story-fallback'))) return;
        }
        scheduleScan();
    });
    uiObserver.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('popstate', scheduleScan);
    const pushState = history.pushState;
    const replaceState = history.replaceState;
    history.pushState = function () {
        const result = pushState.apply(this, arguments);
        scheduleScan();
        return result;
    };
    history.replaceState = function () {
        const result = replaceState.apply(this, arguments);
        scheduleScan();
        return result;
    };
    scheduleScan();
    // Backup for SPA route changes that do not mutate the observed tree immediately.
    setInterval(scheduleScan, 1000);

    function append2Header(node, btn) {
        node.parentNode.parentNode.parentNode.appendChild(btn);
    }

    function addCustomBtn(node, iconColor, appendNode) {
        const template = closestControl(node);
        const [newtabBtn, downloadBtn] = pairButtons(template);
        if (iconColor === 'white') {
            newtabBtn.style.color = 'white';
            downloadBtn.style.color = 'white';
        }
        appendNode(node, newtabBtn);
        appendNode(node, downloadBtn);
        attachPrefetch([newtabBtn, downloadBtn]);
    }

    var preUrl = '';

    document.addEventListener('keydown', keyDownHandler);

    function keyDownHandler(event) {
        if (window.location.href === 'https://www.instagram.com/') return;

        const mockEventTemplate = {
            stopPropagation: function () { },
            preventDefault: function () { }
        };

        if (event.altKey && (event.code === 'KeyK' || event.key == 'k')) {
            let buttons = document.getElementsByClassName('download-btn');
            if (buttons.length > 0) {
                let mockEvent = { ...mockEventTemplate };
                mockEvent.currentTarget = buttons[buttons.length - 1];
                if (prefetchAndAttachLink || hoverToFetchAndAttachLink) onMouseInHandler(mockEvent);
                onClickHandler(mockEvent);
            }
        }
        if (event.altKey && (event.code === 'KeyI' || event.key == 'i')) {
            let buttons = document.getElementsByClassName('newtab-btn');
            if (buttons.length > 0) {
                let mockEvent = { ...mockEventTemplate };
                mockEvent.currentTarget = buttons[buttons.length - 1];
                if (prefetchAndAttachLink || hoverToFetchAndAttachLink) onMouseInHandler(mockEvent);
                onClickHandler(mockEvent);
            }
        }

        if (event.altKey && (event.code === 'KeyL' || event.key == 'l')) {
            clickCarouselControl('next');
        }

        if (event.altKey && (event.code === 'KeyJ' || event.key == 'j')) {
            clickCarouselControl('prev');
        }
    }

    function onClickHandler(e) {
        // handle button click
        let target = e.currentTarget;
        e.stopPropagation();
        e.preventDefault();
        if (window.location.pathname.includes('stories') || (target.closest && target.closest('[data-igdl-story], .igdl-story-tools, .igdl-story-fallback'))) {
            storyOnClicked(target);
        } else if (document.querySelector('header') && document.querySelector('header').contains(target) && !(target.closest && target.closest('[data-igdl-story]'))) {
            profileOnClicked(target);
        } else {
            postOnClicked(target);
        }
    }

    function onMouseInHandler(e) {
        let target = e.currentTarget;
        if (!prefetchAndAttachLink && !hoverToFetchAndAttachLink) return;
        if (window.location.pathname.includes('stories') || (target.closest && target.closest('[data-igdl-story], .igdl-story-tools, .igdl-story-fallback'))) {
            storyOnMouseIn(target);
        } else if (document.querySelector('header') && document.querySelector('header').contains(target) && !(target.closest && target.closest('[data-igdl-story]'))) {
            profileOnMouseIn(target);
        } else {
            postOnMouseIn(target);
        }
    }

    // ================================
    // ====        Profile         ====
    // ================================
    function profileOnMouseIn(target) {
        let url = profileGetUrl(target);
        target.setAttribute('href', url);
    }

    function profileOnClicked(target) {
        // extract profile picture url and download or open it
        let url = profileGetUrl(target);

        if (url.length > 0) {
            // check url
            if (target.getAttribute('class').includes('download-btn')) {
                // generate filename
                const filename = document.querySelector('header h2').textContent;
                downloadResource(url, filename);
            } else {
                // open url in new tab
                openResource(url);
            }
        }
    }

    function profileGetUrl(target) {
        let img = document.querySelector('header img');
        let url = img.getAttribute('src');
        return url;
    }

    // ================================
    // ====         Post           ====
    // ================================
    async function postOnMouseIn(target) {
        let articleNode = postGetArticleNode(target);
        let { url } = await postGetUrl(target, articleNode);
        target.setAttribute('href', url);
    }

    async function postOnClicked(target) {
        try {
            // extract url from target post and download or open it
            let articleNode = postGetArticleNode(target);
            let { url, mediaIndex } = await postGetUrl(target, articleNode);

            // download or open media url
            if (url.length > 0) {
                // check url
                if (target.getAttribute('class').includes('download-btn')) {
                    let mediaName = url
                        .split('?')[0]
                        .split('\\')
                        .pop()
                        .split('/')
                        .pop();
                    mediaName = mediaName.substring(0, mediaName.lastIndexOf('.'));
                    let datetime = new Date(articleNode.querySelector('time').getAttribute('datetime'));
                    let posterName = articleNode.querySelector('header a') || findPostName(articleNode);
                    posterName = posterName.getAttribute('href').replace(/\//g, '');
                    let postId = findPostId(articleNode);
                    let filename = filenameFormat(postFilenameTemplate, posterName, datetime, mediaName, postId, mediaIndex);
                    downloadResource(url, filename);
                } else {
                    // open url in new tab
                    openResource(url);
                }
            }
        } catch (e) {
            console.log(`Uncatched in postOnClicked(): ${e}\n${e.stack}`);
            return null;
        }
    }

    function postGetArticleNode(target) {
        let articleNode = target;
        while (articleNode && articleNode.tagName !== 'ARTICLE' && articleNode.tagName !== 'MAIN') {
            articleNode = articleNode.parentNode;
        }
        return articleNode;
    }

    async function postGetUrl(target, articleNode) {
        // meta[property="og:video"]
        let list = articleNode.querySelectorAll('li[style][class]');
        let url = null;
        let mediaIndex = 0;
        if (list.length === 0) {
            // single img or video
            if (!disableNewUrlFetchMethod) url = await getUrlFromInfoApi(articleNode);
            if (url === null) {
                let videoElem = articleNode.querySelector('video');
                if (videoElem) {
                    // media type is video
                    url = videoElem.getAttribute('src');
                    if (videoElem.hasAttribute('videoURL')) {
                        url = videoElem.getAttribute('videoURL');
                    } else if (url === null || url.includes('blob')) {
                        url = await fetchVideoURL(articleNode, videoElem);
                    }
                } else if (articleNode.querySelector('article  div[role] div > img')) {
                    // media type is image
                    url = articleNode.querySelector('article  div[role] div > img').getAttribute('src');
                } else {
                    console.log('Err: not find media at handle post single');
                }
            }
        } else {
            // multiple imgs or videos
            const postView = location.pathname.startsWith('/p/');
            let dotsElements = [...articleNode.querySelectorAll(`div._acnb`)];
            mediaIndex = [...dotsElements].reduce((result, element, index) => (element.classList.length === 2 ? index : result), null);
            if (mediaIndex === null) throw 'Cannot find the media index';

            if (!disableNewUrlFetchMethod) url = await getUrlFromInfoApi(articleNode, mediaIndex);
            if (url === null) {
                const listElements = [...articleNode.querySelectorAll(`:scope > div > div:nth-child(${postView ? 1 : 2}) > div > div:nth-child(1) ul li[style*="translateX"]`)];
                const listElementWidth = Math.max(...listElements.map(element => element.clientWidth));

                const positionsMap = listElements.reduce((result, element) => {
                    const position = Math.round(Number(element.style.transform.match(/-?(\d+)/)[1]) / listElementWidth);
                    return { ...result, [position]: element };
                }, {});

                const node = positionsMap[mediaIndex];
                if (node.querySelector('video')) {
                    // media type is video
                    let videoElem = node.querySelector('video');
                    url = videoElem.getAttribute('src');
                    if (videoElem.hasAttribute('videoURL')) {
                        url = videoElem.getAttribute('videoURL');
                    } else if (url === null || url.includes('blob')) {
                        url = await fetchVideoURL(articleNode, videoElem);
                    }
                } else if (node.querySelector('img')) {
                    // media type is image
                    url = node.querySelector('img').getAttribute('src');
                }
            }
        }
        return { url, mediaIndex };
    }

    function findHighlightsIndex() {
        let currentDivProgressbarDiv = document.querySelector('div[style^="transform"]').parentElement;
        let progressbarRootDiv = currentDivProgressbarDiv.parentElement;
        let progressbarDivs = progressbarRootDiv.children;
        return Array.from(progressbarDivs).indexOf(currentDivProgressbarDiv);
    }

    let infoCache = {}; // key: media id, value: info json
    let mediaIdCache = {}; // key: post id, value: media id
    async function getUrlFromInfoApi(articleNode, mediaIdx = 0) {
        // return media url if found else return null
        // fetch flow:
        //	 1. find post id
        //   2. use step1 post id to send request to get post page
        //   3. find media id from the reponse text of step2
        //   4. find app id in clicked page
        //   5. send info api request with media id and app id
        //   6. get media url from response json
        try {
            const appIdPattern = /"X-IG-App-ID":"([\d]+)"/;
            const mediaIdPattern = /instagram:\/\/media\?id=(\d+)|["' ]media_id["' ]:["' ](\d+)["' ]/;
            function findAppId() {
                let bodyScripts = document.querySelectorAll("body > script");
                for (let i = 0; i < bodyScripts.length; ++i) {
                    let match = bodyScripts[i].text.match(appIdPattern);
                    if (match) return match[1];
                }
                console.log("Cannot find app id");
                return null;
            }

            async function findMediaId(mediaIdx) {
                // method 4
                function method4(mediaIdx) {
                    let href = window.location.href;
                    // let match = document.body.innerHTML.match(/"id":"(\d+_\d+)"/);
                    let matchs = [...document.body.innerHTML.matchAll(/"id":"(\d+_\d+)"/g)];
                    if (href.includes('stories') && matchs.length > mediaIdx) return matchs[mediaIdx][1];
                    return null;
                }

                // method 1: extract from url.
                function method1() {
                    let href = window.location.href;
                    let match = href.match(/www.instagram.com\/stories\/[^\/]+\/(\d+)/);
                    if (!href.includes('highlights') && match) return match[1];
                    return null;
                }

                // method 3
                async function method3() {
                    let postId = await findPostId(articleNode);
                    if (!postId) {
                        return null;
                    }

                    if (!(postId in mediaIdCache)) {
                        let postUrl = `https://www.instagram.com/p/${postId}/`;
                        let resp = await pageFetch(postUrl);
                        let text = await resp.text();
                        let idMatch = text ? text.match(mediaIdPattern) : [];
                        let mediaId = null;
                        for (let i = 0; i < idMatch.length; ++i) {
                            if (idMatch[i]) mediaId = idMatch[i];
                        }
                        if (!mediaId) return null;
                        mediaIdCache[postId] = mediaId;
                    }
                    return mediaIdCache[postId];
                }

                function method2() {
                    let scriptJson = document.querySelectorAll('script[type="application/json"]');
                    for (let i = 0; i < scriptJson.length; i++) {
                        let match = scriptJson[i].text.match(/"pk":"(\d+)","id":"[\d_]+"/);
                        if (match) {
                            if (!window.location.href.includes('highlights')) {
                                return match[1];
                            }
                            let matchs = Array.from(scriptJson[i].text.matchAll(/"pk":"(\d+)","id":"[\d_]+"/g), match => match[1]);
                            const matchIndex = findHighlightsIndex();
                            if (matchs.length > matchIndex) {
                                return matchs[matchIndex];
                            }
                        }
                    }
                    return null;
                }

                return method1() || await method3() || method2();
            }

            function getImgOrVedioUrl(item) {
                if ("video_versions" in item) {
                    return item.video_versions[0].url;
                } else {
                    return item.image_versions2.candidates[0].url;
                }
            }

            let appId = findAppId();
            if (!appId) return null;
            let headers = {
                method: 'GET',
                headers: {
                    Accept: '*/*',
                    'X-IG-App-ID': appId
                },
                credentials: 'include',
                mode: 'cors'
            };

            let mediaId = await findMediaId(mediaIdx);
            if (!mediaId) {
                console.log("Cannot find media id");
                return null;
            }
            if (!(mediaId in infoCache)) {
                let url = 'https://i.instagram.com/api/v1/media/' + mediaId + '/info/';
                let resp = await pageFetch(url, headers);
                if (resp.status !== 200) {
                    console.log(`Fetch info API failed with status code: ${resp.status}`);
                    console.log(`context: ${JSON.stringify(await resp.json(), space=2)}`);
                    return null;
                }
                let respJson = await resp.json();
                infoCache[mediaId] = respJson;
            }
            let infoJson = infoCache[mediaId];
            if ('carousel_media' in infoJson.items[0]) {
                // multi-media post
                return getImgOrVedioUrl(infoJson.items[0].carousel_media[mediaIdx]);
            } else {
                // single media post
                return getImgOrVedioUrl(infoJson.items[0]);
            }
        } catch (e) {
            console.log(`Uncatched in getUrlFromInfoApi(): ${e}\n${e.stack}`);
            return null;
        }
    }

    function findPostName(articleNode) {
        // this grabs the username link that is visually in the author's post comment below the media 
        // 'article section' includes the likes section and comment box
        // '+ * a' pulls the first element after the section that contains a link (comment box doesn't)
        // '[href^="/"][href$="/"]' requires the href attribute to begin and end with a slash to match a username
        let imgNoCanvas = articleNode.querySelector('article section + * a[href^="/"][href$="/"]');
        if (imgNoCanvas) {
            return imgNoCanvas;
        }

        // videos are handled differently
        let imgAlt = articleNode.querySelector('canvas ~ * img');
        if (imgAlt) {
            imgAlt = imgAlt.getAttribute('alt');
            let links = articleNode.querySelectorAll('a');
            for (let i = 0; i < links.length; i++) {
                const posterName = links[i].getAttribute('href').replace(/\//g, '');
                if (imgAlt.includes(posterName)) {
                    return links[i];
                }
            }
        } else {
            // first H2 with a direction set
            const el = document.querySelector('h2[dir]');
            return el.innerText;
        }
    }

    function findPostId(articleNode) {
        let aNodes = articleNode.querySelectorAll('a');
        for (let i = 0; i < aNodes.length; ++i) {
            let link = aNodes[i].getAttribute('href');
            if (link) {
                let match = link.match(postIdPattern);
                if (match) return match[1];
            }
        }
        return null;
    }

    async function fetchVideoURL(articleNode, videoElem) {
        let poster = videoElem.getAttribute('poster');
        let timeNodes = articleNode.querySelectorAll('time');
        // special thanks 孙年忠 (https://greasyfork.org/en/scripts/406535-instagram-download-button/discussions/120159)
        let posterUrl = timeNodes[timeNodes.length - 1].parentNode.parentNode.href;
        const posterPattern = /\/([^\/?]*)\?/;
        let posterMatch = poster.match(posterPattern);
        let postFileName = posterMatch[1];
        let resp = await pageFetch(posterUrl);
        let content = await resp.text();
        // special thanks to 孙年忠 for the pattern (https://greasyfork.org/zh-TW/scripts/406535-instagram-download-button/discussions/116675)
        const pattern = new RegExp(`${postFileName}.*?video_versions.*?url":("[^"]*")`, 's');
        let match = content.match(pattern);
        let videoUrl = JSON.parse(match[1]);
        videoUrl = videoUrl.replace(/^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/?\n]+)/g, 'https://scontent.cdninstagram.com');
        videoElem.setAttribute('videoURL', videoUrl);
        return videoUrl;
    }

    // ================================
    // ====   Story & Highlight    ====
    // ================================
    async function storyOnMouseIn(target) {
        const sectionNode = storyGetSectionNode(target);
        const url = await storyGetUrl(target, sectionNode);
        if (url) target.setAttribute('href', url);
    }

    async function storyOnClicked(target) {
        try {
            const sectionNode = storyGetSectionNode(target) || document.querySelector('section') || document.body;
            const url = await storyGetUrl(target, sectionNode);
            if (!url) {
                console.log('Story media URL not found');
                return;
            }
            if (target.getAttribute('class').includes('download-btn')) {
                let mediaName = url.split('?')[0].split('\\').pop().split('/').pop();
                mediaName = mediaName.substring(0, mediaName.lastIndexOf('.'));
                const timeEl = sectionNode.querySelector && sectionNode.querySelector('time');
                const datetime = timeEl ? new Date(timeEl.getAttribute('datetime')) : new Date();
                let posterName = 'unknown';
                const posterNameHeader = sectionNode.querySelector && sectionNode.querySelector('header a');
                if (posterNameHeader) {
                    posterName = posterNameHeader.getAttribute('href').replace(/\//g, '');
                }
                if (!posterName || posterName === 'unknown') {
                    const match = window.location.pathname.match(/\/stories\/([^/]+)/);
                    if (match) posterName = match[1];
                }
                if (!posterName || posterName === 'unknown' || posterName === 'highlights') {
                    const identity = storyIdentityFromRoot(sectionNode);
                    if (identity && identity.username) posterName = identity.username;
                }
                const filename = filenameFormat(storyFilenameTemplate, posterName, datetime, mediaName);
                downloadResource(url, filename);
            } else {
                openResource(url);
            }
        } catch (e) {
            console.log(`Uncatched in storyOnClicked(): ${e}\n${e.stack}`);
        }
    }

    function storyGetSectionNode(target) {
        const marked = target && target.closest && target.closest('[data-igdl-story]');
        if (marked) return marked;
        let sectionNode = target;
        while (sectionNode && sectionNode.tagName !== 'SECTION') {
            sectionNode = sectionNode.parentNode;
        }
        if (sectionNode) return sectionNode;
        return document.querySelector('[data-igdl-story]') || document.querySelector('[role="dialog"]') || document.querySelector('section');
    }

    let cachedAppId = null;
    function getAppId() {
        if (cachedAppId) return cachedAppId;
        const patterns = [/"X-IG-App-ID":"(\d+)"/, /"appId":"(\d+)"/, /"appId":(\d{10,})/];
        const scripts = document.querySelectorAll('script');
        for (let i = 0; i < scripts.length; i++) {
            const text = scripts[i].textContent || '';
            if (text.length < 20) continue;
            for (let p = 0; p < patterns.length; p++) {
                const match = text.match(patterns[p]);
                if (match) {
                    cachedAppId = match[1];
                    return cachedAppId;
                }
            }
        }
        cachedAppId = WEB_APP_ID;
        return cachedAppId;
    }

    function igRequestHeaders(hasBody) {
        const headers = {
            Accept: '*/*',
            'X-IG-App-ID': getAppId(),
            'X-ASBD-ID': '359341',
            'X-IG-WWW-Claim': '0',
            'X-Requested-With': 'XMLHttpRequest'
        };
        const csrf = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
        if (csrf) headers['X-CSRFToken'] = decodeURIComponent(csrf[1]);
        if (hasBody) headers['Content-Type'] = 'application/x-www-form-urlencoded';
        return headers;
    }

    async function igFetchJson(url, options) {
        const method = (options && options.method) || 'GET';
        const body = options && options.body;
        try {
            const resp = await pageFetch(url, {
                method: method,
                credentials: 'include',
                headers: igRequestHeaders(!!body),
                body: body ? body.toString() : undefined
            });
            if (!resp.ok) {
                console.log(`IG API ${resp.status} ${url}`);
                return null;
            }
            return await resp.json();
        } catch (e) {
            console.log(`IG API error ${url}: ${e}`);
            return null;
        }
    }

    function bestItemUrl(item) {
        if (!item) return null;
        if (item.video_versions && item.video_versions.length) {
            const best = item.video_versions.reduce((a, b) => ((b.width || 0) > (a.width || 0) ? b : a));
            if (best && best.url && !String(best.url).startsWith('blob:')) return best.url;
        }
        const candidates = item.image_versions2 && item.image_versions2.candidates;
        if (candidates && candidates.length) {
            const best = candidates.reduce((a, b) => ((b.width || 0) > (a.width || 0) ? b : a));
            if (best && best.url && !String(best.url).startsWith('blob:')) return best.url;
        }
        return null;
    }

    function storyProgressIndex(root) {
        const scope = root || document.querySelector('[data-igdl-story]') || document;
        const divs = scope.querySelectorAll ? scope.querySelectorAll('div') : [];
        for (let i = 0; i < divs.length; i++) {
            if (!looksLikeProgressRow(divs[i])) continue;
            const kids = [...divs[i].children];
            for (let k = 0; k < kids.length; k++) {
                const fill = kids[k].firstElementChild;
                const parentW = kids[k].getBoundingClientRect().width || 1;
                const fillW = fill ? fill.getBoundingClientRect().width : 0;
                if (!fill || fillW < parentW - 1) return k;
            }
            return Math.max(0, kids.length - 1);
        }
        return 0;
    }

    function storyIdentityFromRoot(root) {
        if (!root || !root.querySelectorAll) return null;
        const links = root.querySelectorAll('a[href]');
        for (let i = 0; i < links.length; i++) {
            const href = links[i].getAttribute('href') || '';
            const story = href.match(/^\/stories\/([^/]+)\/(\d+)/);
            if (story && story[1] !== 'highlights') return { username: story[1], mediaId: story[2] };
            const highlight = href.match(/^\/stories\/highlights\/([^/]+)/);
            if (highlight) return { highlightId: highlight[1] };
        }
        for (let i = 0; i < links.length; i++) {
            const href = links[i].getAttribute('href') || '';
            const user = href.match(/^\/([A-Za-z0-9._]+)\/?$/);
            if (user && !/^(explore|reels|direct|accounts|stories|p)$/.test(user[1])) {
                return { username: user[1], mediaId: null };
            }
        }
        return null;
    }

    const userIdCache = {};
    async function usernameToId(username) {
        if (!username || username === 'highlights') return null;
        if (userIdCache[username]) return userIdCache[username];
        const data = await igFetchJson('https://www.instagram.com/api/v1/users/web_profile_info/?username=' + encodeURIComponent(username));
        const id = data && data.data && data.data.user && data.data.user.id;
        if (id) userIdCache[username] = String(id);
        return userIdCache[username] || null;
    }

    function pickReelItem(reel) {
        const items = reel && reel.items;
        if (!items || !items.length) return null;
        const mediaInUrl = location.pathname.match(/\/stories\/(?!highlights\/)[^/]+\/(\d+)/);
        if (mediaInUrl) {
            const id = mediaInUrl[1];
            const hit = items.find((item) => String(item.pk) === id || String(item.id || '').split('_')[0] === id);
            if (hit) return hit;
        }
        let index = storyProgressIndex();
        if (index < 0 || index >= items.length) index = 0;
        return items[index];
    }

    const storyUrlCache = new Map();
    async function fetchCurrentStoryUrl(root) {
        const viewer = root || document.querySelector('[data-igdl-story]');
        const fromDom = storyIdentityFromRoot(viewer);
        const index = storyProgressIndex(viewer);
        const cacheKey = location.pathname + '|' + index + '|' + (fromDom ? (fromDom.mediaId || fromDom.highlightId || fromDom.username || '') : '');
        if (storyUrlCache.has(cacheKey)) return storyUrlCache.get(cacheKey);

        const userStory = location.pathname.match(/^\/stories\/([^/]+)\/(\d+)\/?/);
        const highlight = location.pathname.match(/^\/stories\/highlights\/([^/]+)\/?/);
        const userOnly = location.pathname.match(/^\/stories\/([^/]+)\/?$/);
        let url = null;
        const mediaFromPath = userStory && userStory[1] !== 'highlights' ? userStory[2] : (fromDom && fromDom.mediaId);
        const userFromPath = userStory && userStory[1] !== 'highlights' ? userStory[1] : (userOnly && userOnly[1] !== 'highlights' ? userOnly[1] : (fromDom && fromDom.username));

        if (mediaFromPath) {
            const info = await igFetchJson('https://www.instagram.com/api/v1/media/' + mediaFromPath + '/info/');
            url = info && info.items && info.items[0] ? bestItemUrl(info.items[0]) : null;
        }

        if (!url) {
            let reelId = null;
            let mediaId = mediaFromPath || null;
            if (highlight) {
                reelId = 'highlight:' + highlight[1];
            } else if (fromDom && fromDom.highlightId) {
                reelId = 'highlight:' + fromDom.highlightId;
            } else if (userFromPath) {
                reelId = await usernameToId(userFromPath);
            }
            if (reelId) {
                const loggedIn = /(?:^|;\s*)sessionid=/.test(document.cookie);
                let data = null;
                if (loggedIn) {
                    const body = new URLSearchParams();
                    body.set('reel_ids', JSON.stringify([reelId]));
                    if (mediaId) body.set('media_id', mediaId);
                    data = await igFetchJson('https://www.instagram.com/api/v1/feed/reels_media/', { method: 'POST', body: body });
                }
                if (!data) {
                    const query = new URLSearchParams();
                    query.set('reel_ids', reelId);
                    if (mediaId) query.set('media_id', mediaId);
                    data = await igFetchJson('https://www.instagram.com/api/v1/feed/reels_media/?' + query.toString());
                }
                const reel = data && data.reels && (data.reels[reelId] || Object.values(data.reels)[0]);
                url = bestItemUrl(pickReelItem(reel));
            }
        }

        if (url) storyUrlCache.set(cacheKey, url);
        return url;
    }

    function domStoryUrl(root) {
        if (!root || !root.querySelector) return null;
        const videos = root.querySelectorAll('video');
        for (let i = 0; i < videos.length; i++) {
            const src = videos[i].currentSrc || videos[i].getAttribute('src') || '';
            if (src && !src.startsWith('blob:')) return src;
            const source = videos[i].querySelector('source');
            if (source && source.src && !source.src.startsWith('blob:')) return source.src;
        }
        let best = null;
        let bestArea = 0;
        root.querySelectorAll('img').forEach((img) => {
            const rect = img.getBoundingClientRect();
            const area = rect.width * rect.height;
            if (rect.width < 200 || area <= bestArea) return;
            const src = img.currentSrc || img.getAttribute('src') || '';
            if (!src || src.startsWith('blob:') || src.startsWith('data:')) return;
            best = src;
            bestArea = area;
        });
        return best;
    }

    async function storyGetUrl(target, sectionNode) {
        let url = null;
        if (!disableNewUrlFetchMethod) {
            url = await fetchCurrentStoryUrl(sectionNode);
            if (!url) url = await getUrlFromInfoApi(target);
        }
        if (url && !String(url).startsWith('blob:')) return url;
        const root = (sectionNode && sectionNode.querySelector) ? sectionNode : document;
        return domStoryUrl(root);
    }

    function filenameFormat(template, id, datetime, medianame, postId = +new Date(), mediaIndex = '0') {
        let filename = template;
        filename = filename.replace(/%id%/g, id);
        filename = filename.replace(/%datetime%/g, datetimeFormat(datetimeTemplate, datetime));
        filename = filename.replace(/%medianame%/g, medianame);
        filename = filename.replace(/%postId%/g, postId);
        filename = filename.replace(/%mediaIndex%/g, mediaIndex);
        return filename;
    }

    function datetimeFormat(template, datetime) {
        let datetimeStr = template;
        datetimeStr = datetimeStr.replace(/%y%/g, datetime.getFullYear());
        datetimeStr = datetimeStr.replace(/%m%/g, fillZero((datetime.getMonth() + 1).toString()));
        datetimeStr = datetimeStr.replace(/%d%/g, fillZero(datetime.getDate().toString()));
        datetimeStr = datetimeStr.replace(/%H%/g, fillZero(datetime.getHours().toString()));
        datetimeStr = datetimeStr.replace(/%M%/g, fillZero(datetime.getMinutes().toString()));
        datetimeStr = datetimeStr.replace(/%S%/g, fillZero(datetime.getSeconds().toString()));
        return datetimeStr;
    }

    function fillZero(str) {
        if (str.length === 1) {
            return '0' + str;
        }
        return str;
    }

    function openResource(url) {
        // open url in new tab
        var a = document.createElement('a');
        a.href = url;
        a.setAttribute('target', '_blank');
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    function forceDownload(blob, filename, extension) {
        // ref: https://stackoverflow.com/questions/49474775/chrome-65-blocks-cross-origin-a-download-client-side-workaround-to-force-down
        var a = document.createElement('a');
        if (replaceJpegWithJpg) extension = extension.replace('jpeg', 'jpg');
        a.download = filename + '.' + extension;
        a.href = blob;
        // For Firefox https://stackoverflow.com/a/32226068
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    // Current blob size limit is around 500MB for browsers
    function downloadResource(url, filename) {
        if (url.startsWith('blob:')) {
            forceDownload(url, filename, 'mp4');
            return;
        }
        console.log(`Dowloading ${url}`);
        // ref: https://stackoverflow.com/questions/49474775/chrome-65-blocks-cross-origin-a-download-client-side-workaround-to-force-down
        if (!filename) {
            filename = url
                .split('\\')
                .pop()
                .split('/')
                .pop();
        }
        const saveBlob = (blob) => {
            const extension = (blob.type || 'application/octet-stream').split('/').pop();
            const blobUrl = window.URL.createObjectURL(blob);
            forceDownload(blobUrl, filename, extension);
        };
        pageFetch(url, {
            headers: new Headers({
                Origin: location.origin,
            }),
            mode: 'cors',
        })
            .then(response => {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.blob();
            })
            .then(saveBlob)
            .catch(e => {
                if (typeof GM_xmlhttpRequest !== 'function') {
                    console.error(e);
                    return;
                }
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    responseType: 'blob',
                    onload: (r) => {
                        if (r.status >= 200 && r.status < 300 && r.response) saveBlob(r.response);
                        else console.error('GM download failed', r.status, e);
                    },
                    onerror: (err) => console.error(err || e)
                });
            });
    }
})();
