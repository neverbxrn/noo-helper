// ==UserScript==
// @name         Noo-School Читаемость Задач + Супер-Настройки (Alt+S)
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  Шрифт Montserrat, ползунок интервалов, умный прозрачный плавающий ответ, стрелочки навигации, умный Enter и сброс на R
// @author       You
// @match        https://noo-school.ru/assigned-works/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // --- Загрузка настроек из localStorage ---
    const settings = {
        spacingLevel: parseInt(localStorage.getItem('noo_spacing_level') ?? '6', 10), // от 0 до 10
        autofocus: localStorage.getItem('noo_autofocus') !== 'false',
        smartEnter: localStorage.getItem('noo_smart_enter') !== 'false',
        resetKeyR: localStorage.getItem('noo_reset_r') !== 'false',
        stickyAnswer: localStorage.getItem('noo_sticky_answer') !== 'false',
        arrowNav: localStorage.getItem('noo_arrow_nav') !== 'false'
    };

    // Базовые статические стили
    const baseCss = `
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');

        /* Жесткий фикс шрифта Montserrat */
        .task-view__question .quill-editor,
        .task-view__question .ql-container,
        .task-view__question .ql-editor,
        .task-view__question .ql-editor * {
            font-family: 'Montserrat', system-ui, -apple-system, sans-serif !important;
        }

        /* Умное следование поля ответа (Режим ожидания) */
        body.noo-enable-sticky .task-view__answer {
            position: sticky;
            bottom: 20px;
            z-index: 998;
            transition: background-color 0.2s ease;
        }

        /* Состояние, когда поле «летит» вместе с пользователем */
        body.noo-enable-sticky .task-view__answer.noo-sticking {
            background: transparent !important;
            background-color: transparent !important;
            border: none !important;
            box-shadow: none !important;
            pointer-events: none; /* Пропускаем клики сквозь прозрачные пустоты */
        }

        /* Скрываем заголовки и подсказки только во время полета, чтобы они не накладывались на текст */
        body.noo-enable-sticky .task-view__answer.noo-sticking .task-answer-container__title,
        body.noo-enable-sticky .task-view__answer.noo-sticking .form-input__label {
            opacity: 0 !important;
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
        }

        /* Выделяем исключительно контейнер инпута во время полета, сохраняя его родную тему */
        body.noo-enable-sticky .task-view__answer.noo-sticking .form-input__input-container {
            pointer-events: auto; /* Возвращаем кликабельность инпуту */
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25) !important;
            border-radius: 8px !important;
        }

        /* Стили для модального окна настроек (Alt+S) */
        #noo-settings-modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ffffff;
            color: #333333;
            padding: 22px;
            border-radius: 14px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.18);
            z-index: 999999;
            font-family: 'Montserrat', sans-serif;
            width: 350px;
            display: none;
            border: 1px solid #e2e8f0;
        }
        #noo-settings-modal h3 {
            margin-top: 0;
            margin-bottom: 18px;
            font-size: 18px;
            font-weight: 700;
            color: #1a202c;
        }
        .noo-setting-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 14px;
        }
        .noo-setting-item-vertical {
            display: flex;
            flex-direction: column;
            margin-bottom: 16px;
        }
        .noo-slider-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        }
        .noo-setting-item label, .noo-slider-header label {
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            user-select: none;
            color: #4a5568;
        }
        .noo-setting-item input[type="checkbox"] {
            cursor: pointer;
            width: 18px;
            height: 18px;
            flex-shrink: 0;
        }
        .noo-setting-item-vertical input[type="range"] {
            width: 100%;
            cursor: pointer;
            margin-top: 4px;
        }
        #noo-slider-value {
            font-weight: 700;
            color: #007bff;
            background: #e6f0ff;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 13px;
        }
        #noo-settings-close {
            margin-top: 10px;
            width: 100%;
            padding: 10px;
            background: #007bff;
            color: #fff;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
            font-family: 'Montserrat', sans-serif;
            transition: background 0.2s;
        }
        #noo-settings-close:hover {
            background: #0056b3;
        }
    `;

    function injectBaseStyles() {
        if (typeof GM_addStyle !== 'undefined') {
            GM_addStyle(baseCss);
        } else {
            const style = document.createElement('style');
            style.textContent = baseCss;
            document.head.appendChild(style);
        }
    }

    // Динамическое обновление CSS на основе положения ползунка интервалов
    function updateDynamicStyles() {
        let styleEl = document.getElementById('noo-dynamic-styles');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'noo-dynamic-styles';
            document.head.appendChild(styleEl);
        }

        let dynamicCss = '';
        if (settings.spacingLevel > 0) {
            const lineHeight = (1.3 + (settings.spacingLevel * 0.07)).toFixed(2);
            const marginBottom = (settings.spacingLevel * 2.5).toFixed(1) + 'px';

            dynamicCss = `
                .task-view__question .ql-editor p {
                    line-height: ${lineHeight} !important;
                    margin-bottom: ${marginBottom} !important;
                }
                .task-view__question .ql-editor p:last-child {
                    margin-bottom: 0 !important;
                }
            `;
        }
        styleEl.textContent = dynamicCss;
    }

    function updateStickyClass() {
        if (settings.stickyAnswer) {
            document.body.classList.add('noo-enable-sticky');
        } else {
            document.body.classList.remove('noo-enable-sticky');
            const answer = document.querySelector('.task-view__answer');
            if (answer) answer.classList.remove('noo-sticking');
        }
    }

    // Умное отслеживание положения поля ответа через IntersectionObserver
    let scrollObserver = null;
    function initStickyObserver() {
        if (!settings.stickyAnswer) {
            if (scrollObserver) scrollObserver.disconnect();
            return;
        }

        const answer = document.querySelector('.task-view__answer');
        if (!answer) return;

        // Создаем невидимый маркер прямо перед блоком ответа
        let sentinel = document.getElementById('noo-answer-sentinel');
        if (!sentinel) {
            sentinel = document.createElement('div');
            sentinel.id = 'noo-answer-sentinel';
            sentinel.style.cssText = 'position:absolute; height:1px; width:1px; pointer-events:none; background:transparent;';
            answer.parentNode.insertBefore(sentinel, answer);
        }

        if (scrollObserver) scrollObserver.disconnect();

        scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                // Если маркер виден — мы в самом низу, поле должно встать на родное место
                if (entry.isIntersecting) {
                    answer.classList.remove('noo-sticking');
                } else {
                    // Если маркер ниже экрана — пользователь читает задание, поле должно плыть
                    if (entry.boundingClientRect.top > 0) {
                        answer.classList.add('noo-sticking');
                    } else {
                        answer.classList.remove('noo-sticking');
                    }
                }
            });
        }, { threshold: 0 });

        scrollObserver.observe(sentinel);
    }

    if (document.head) {
        injectBaseStyles();
    } else {
        const observer = new MutationObserver((mutations, obs) => {
            if (document.head) {
                injectBaseStyles();
                obs.disconnect();
            }
        });
        observer.observe(document.documentElement, { childList: true });
    }

    // --- Создание интерфейса окна настроек ---
    function createSettingsModal() {
        if (document.getElementById('noo-settings-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'noo-settings-modal';
        modal.innerHTML = `
            <h3>Настройки скрипта</h3>
            <div class="noo-setting-item-vertical">
                <div class="noo-slider-header">
                    <label for="noo-slider-spacing">Интервалы текста</label>
                    <span id="noo-slider-value">${settings.spacingLevel === 0 ? '0 (Выкл)' : settings.spacingLevel}</span>
                </div>
                <input type="range" id="noo-slider-spacing" min="0" max="10" step="1" value="${settings.spacingLevel}">
            </div>
            <div class="noo-setting-item">
                <label for="noo-toggle-sticky">Плавающее прозрачное поле</label>
                <input type="checkbox" id="noo-toggle-sticky" ${settings.stickyAnswer ? 'checked' : ''}>
            </div>
            <div class="noo-setting-item">
                <label for="noo-toggle-arrows">Навигация стрелочками (← / →)</label>
                <input type="checkbox" id="noo-toggle-arrows" ${settings.arrowNav ? 'checked' : ''}>
            </div>
            <div class="noo-setting-item">
                <label for="noo-toggle-autofocus">Автофокус на поле ввода</label>
                <input type="checkbox" id="noo-toggle-autofocus" ${settings.autofocus ? 'checked' : ''}>
            </div>
            <div class="noo-setting-item">
                <label for="noo-toggle-enter">Умный Enter (Ввод/Далее)</label>
                <input type="checkbox" id="noo-toggle-enter" ${settings.smartEnter ? 'checked' : ''}>
            </div>
            <div class="noo-setting-item">
                <label for="noo-toggle-r">Сброс задания на кнопку R</label>
                <input type="checkbox" id="noo-toggle-r" ${settings.resetKeyR ? 'checked' : ''}>
            </div>
            <button id="noo-settings-close">Закрыть</button>
        `;
        document.body.appendChild(modal);

        // --- Обработчики изменения значений ---
        const slider = document.getElementById('noo-slider-spacing');
        const sliderVal = document.getElementById('noo-slider-value');
        slider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            settings.spacingLevel = val;
            sliderVal.textContent = val === 0 ? '0 (Выкл)' : val;
            localStorage.setItem('noo_spacing_level', val);
            updateDynamicStyles();
        });

        document.getElementById('noo-toggle-sticky').addEventListener('change', (e) => {
            settings.stickyAnswer = e.target.checked;
            localStorage.setItem('noo_sticky_answer', settings.stickyAnswer);
            updateStickyClass();
            initStickyObserver();
        });
        document.getElementById('noo-toggle-arrows').addEventListener('change', (e) => {
            settings.arrowNav = e.target.checked;
            localStorage.setItem('noo_arrow_nav', settings.arrowNav);
        });
        document.getElementById('noo-toggle-autofocus').addEventListener('change', (e) => {
            settings.autofocus = e.target.checked;
            localStorage.setItem('noo_autofocus', settings.autofocus);
        });
        document.getElementById('noo-toggle-enter').addEventListener('change', (e) => {
            settings.smartEnter = e.target.checked;
            localStorage.setItem('noo_smart_enter', settings.smartEnter);
        });
        document.getElementById('noo-toggle-r').addEventListener('change', (e) => {
            settings.resetKeyR = e.target.checked;
            localStorage.setItem('noo_reset_r', settings.resetKeyR);
        });

        document.getElementById('noo-settings-close').addEventListener('click', toggleModal);
    }

    function toggleModal() {
        const modal = document.getElementById('noo-settings-modal');
        if (!modal) return;
        modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
    }

    // --- Умный автофокус ---
    function focusAnswerInput() {
        if (!settings.autofocus) return;
        const input = document.querySelector('.task-view__answer input:not([disabled])');
        if (input) {
            input.focus();
        }
    }

    const pageObserver = new MutationObserver(() => {
        focusAnswerInput();
        initStickyObserver();
    });

    document.addEventListener('DOMContentLoaded', () => {
        createSettingsModal();
        updateDynamicStyles();
        updateStickyClass();
        initStickyObserver();
        pageObserver.observe(document.body, { childList: true, subtree: true });
        focusAnswerInput();
    });

    if (document.body) {
        updateDynamicStyles();
        updateStickyClass();
        initStickyObserver();
    }

    // --- Обработка горячих клавиш ---
    document.addEventListener('keydown', function(event) {
        // Открытие меню настроек: Alt + S (или Alt + Ы)
        if (event.altKey && (event.code === 'KeyS')) {
            event.preventDefault();
            createSettingsModal();
            toggleModal();
            return;
        }

        const activeEl = document.activeElement;
        const isInsideAnswer = activeEl && activeEl.closest('.task-view__answer');
        const isInputDisabled = activeEl ? activeEl.hasAttribute('disabled') : false;

        const isTyping = activeEl && !isInputDisabled && (
            activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.isContentEditable
        );

        // --- ОБРАБОТКА СТРЕЛОЧЕК НАВИГАЦИИ ---
        if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && settings.arrowNav) {
            if (isTyping) return;

            const actionContainer = document.querySelector('.task-view__action-buttons');
            const elements = actionContainer ? actionContainer.querySelectorAll('button, a') : document.querySelectorAll('.v-button__button, button, a');

            let prevButton = null;
            let nextButton = null;

            for (let el of elements) {
                const text = el.textContent.trim().toLowerCase();
                if (text.includes('следующий вопрос') || text.includes('далее')) {
                    nextButton = el;
                } else if (text.includes('предыдущий вопрос') || text.includes('назад') || text.includes('вернуться')) {
                    prevButton = el;
                }
            }

            if (event.key === 'ArrowRight' && nextButton) {
                event.preventDefault();
                nextButton.click();
            } else if (event.key === 'ArrowLeft' && prevButton) {
                event.preventDefault();
                prevButton.click();
            }
        }

        // --- ОБРАБОТКА ENTER ---
        if (event.key === 'Enter' && settings.smartEnter) {
            const shouldProcessEnter = isInsideAnswer || !activeEl || !isTyping;
            if (!shouldProcessEnter) return;

            const actionContainer = document.querySelector('.task-view__action-buttons');
            if (!actionContainer) return;

            const elements = actionContainer.querySelectorAll('button, a');
            let checkButton = null;
            let nextButton = null;

            for (let el of elements) {
                const text = el.textContent.trim().toLowerCase();
                if (text === 'проверить задание') {
                    checkButton = el;
                } else if (text === 'следующий вопрос') {
                    nextButton = el;
                }
            }

            if (checkButton) {
                event.preventDefault();
                checkButton.click();
            } else if (nextButton) {
                event.preventDefault();
                nextButton.click();
            }
        }

        // --- ОБРАБОТКА СБРОСА (Клавиша R) ---
        if (event.code === 'KeyR' && settings.resetKeyR) {
            if (isTyping) return;

            const actionContainer = document.querySelector('.task-view__action-buttons');
            if (!actionContainer) return;

            const elements = actionContainer.querySelectorAll('button, a');
            let resetButton = null;

            for (let el of elements) {
                if (el.textContent.trim().toLowerCase() === 'перерешать') {
                    resetButton = el;
                    break;
                }
            }

            if (resetButton) {
                event.preventDefault();
                resetButton.click();

                const input = document.querySelector('.task-view__answer input');
                if (input) {
                    input.value = '';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }

                setTimeout(focusAnswerInput, 50);
            }
        }
    });
})();
