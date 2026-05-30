// ==UserScript==
// @name         Noo-School Читаемость Задач + Автофокус Enter + Сброс на R
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  Интервалы текста, шрифт Montserrat (жесткий фикс), умный Enter, автофокус и сброс задания кнопкой R
// @author       You
// @match        https://noo-school.ru/assigned-works/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Настройки отображения текста:
    const LINE_HEIGHT = "1.8";
    const PARAGRAPH_GAP = "14px";

    // Жестко прописываем Montserrat для всего содержимого редактора внутри вопроса
    const css = `
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');

        /* Принудительно ставим шрифт для самого редактора и абсолютно всех вложенных тегов */
        .task-view__question .quill-editor,
        .task-view__question .ql-container,
        .task-view__question .ql-editor,
        .task-view__question .ql-editor * {
            font-family: 'Montserrat', system-ui, -apple-system, sans-serif !important;
        }

        /* Настраиваем интервалы для абзацев */
        .task-view__question .ql-editor p {
            line-height: ${LINE_HEIGHT} !important;
            margin-bottom: ${PARAGRAPH_GAP} !important;
        }

        /* Убираем отступ у последнего абзаца */
        .task-view__question .ql-editor p:last-child {
            margin-bottom: 0 !important;
        }
    `;

    function injectStyles() {
        if (typeof GM_addStyle !== 'undefined') {
            GM_addStyle(css);
        } else {
            const style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);
        }
    }

    if (document.head) {
        injectStyles();
    } else {
        const observer = new MutationObserver((mutations, obs) => {
            if (document.head) {
                injectStyles();
                obs.disconnect();
            }
        });
        observer.observe(document.documentElement, { childList: true });
    }

    // --- Функция для поиска и фокуса на поле ответа ---
    function focusAnswerInput() {
        const input = document.querySelector('.task-view__answer input:not([disabled])');
        if (input) {
            input.focus();
        }
    }

    // --- Наблюдатель за сменой вопросов (для автофокуса) ---
    const pageObserver = new MutationObserver(() => {
        focusAnswerInput();
    });

    document.addEventListener('DOMContentLoaded', () => {
        pageObserver.observe(document.body, { childList: true, subtree: true });
        focusAnswerInput();
    });

    // --- Логика горячих клавиш ---
    document.addEventListener('keydown', function(event) {
        const activeEl = document.activeElement;

        // Проверяем состояние фокуса
        const isInsideAnswer = activeEl && activeEl.closest('.task-view__answer');
        const isInputDisabled = activeEl ? activeEl.hasAttribute('disabled') : false;

        // Флаг: пишет ли пользователь прямо сейчас в активном текстовом поле
        const isTyping = activeEl && !isInputDisabled && (
            activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.isContentEditable
        );

        // --- ОБРАБОТКА ENTER ---
        if (event.key === 'Enter') {
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

            // Если кнопка проверки есть — отправляем ответ
            if (checkButton) {
                event.preventDefault();
                checkButton.click();
            }
            // Если кнопки проверки нет, но есть кнопка далее — переключаем вопрос
            else if (nextButton) {
                event.preventDefault();
                nextButton.click();
            }
        }

        // --- ОБРАБОТКА БЫСТРОГО СБРОСА (Клавиша R / К) ---
        if (event.code === 'KeyR') {
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