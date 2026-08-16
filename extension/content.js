// ============================================================
// Emotion Detector - Content Script
// ============================================================

(() => {
    "use strict";

    // --------------------------------------------------------
    // Configuration
    // --------------------------------------------------------

    const API_URL =
        "https://emotion-detection-browser-extention.vercel.app/analyze";

    const MIN_TEXT_LENGTH = 10;
    const MAX_TEXT_LENGTH = 5000;

    const processedElements = new WeakSet();
    const analyzedTexts = new Map();

    // Prevent excessive API requests
    const CACHE_LIMIT = 100;

    // --------------------------------------------------------
    // Emotion Configuration
    // --------------------------------------------------------

    const emotionMap = {
        joy: {
            emoji: "😊",
            color: "#72d45c",
            label: "Joy"
        },

        love: {
            emoji: "❤️",
            color: "#ff5c8a",
            label: "Love"
        },

        surprise: {
            emoji: "😲",
            color: "#63c7ff",
            label: "Surprise"
        },

        sadness: {
            emoji: "😢",
            color: "#5b9cff",
            label: "Sadness"
        },

        anger: {
            emoji: "😡",
            color: "#ed3c55",
            label: "Anger"
        },

        fear: {
            emoji: "😨",
            color: "#a879e8",
            label: "Fear"
        },

        disgust: {
            emoji: "🤢",
            color: "#8bc34a",
            label: "Disgust"
        },

        neutral: {
            emoji: "😐",
            color: "#aeb8c4",
            label: "Neutral"
        }
    };

    // --------------------------------------------------------
    // Utility Functions
    // --------------------------------------------------------

    function normalizeText(text) {
        return text
            .replace(/\s+/g, " ")
            .trim();
    }


    function truncateText(text) {
        return text.length > MAX_TEXT_LENGTH
            ? text.substring(0, MAX_TEXT_LENGTH)
            : text;
    }


    function getEmotionConfig(emotion) {
        const key = String(emotion || "").toLowerCase();

        return (
            emotionMap[key] || {
                emoji: "❓",
                color: "#00d9ff",
                label: emotion || "Unknown"
            }
        );
    }


    // --------------------------------------------------------
    // API
    // --------------------------------------------------------

    async function analyzeEmotion(text) {

        const normalizedText = truncateText(
            normalizeText(text)
        );

        if (normalizedText.length < MIN_TEXT_LENGTH) {
            return null;
        }

        // Return cached result
        if (analyzedTexts.has(normalizedText)) {
            return analyzedTexts.get(normalizedText);
        }

        try {

            const response = await fetch(API_URL, {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    text: normalizedText
                })
            });

            if (!response.ok) {
                console.error(
                    "Emotion API error:",
                    response.status
                );

                return null;
            }

            const result = await response.json();

            if (!result.success || !result.emotion) {
                console.error(
                    "Invalid emotion API response:",
                    result
                );

                return null;
            }

            // Cache result
            analyzedTexts.set(
                normalizedText,
                result
            );

            // Keep cache bounded
            if (analyzedTexts.size > CACHE_LIMIT) {
                const firstKey =
                    analyzedTexts.keys().next().value;

                analyzedTexts.delete(firstKey);
            }

            return result;

        } catch (error) {

            console.error(
                "Failed to connect to Emotion API:",
                error
            );

            return null;
        }
    }


    // --------------------------------------------------------
    // UI
    // --------------------------------------------------------

    function createEmotionBadge(result) {

        const config = getEmotionConfig(
            result.emotion
        );

        const confidence =
            Math.round(
                Number(result.confidence || 0) * 100
            );

        const container =
            document.createElement("div");

        container.className =
            "emotion-detector-container";

        // Shadow DOM prevents website CSS interference
        const shadow =
            container.attachShadow({
                mode: "open"
            });

        const wrapper =
            document.createElement("div");

        wrapper.innerHTML = `
            <style>

                :host {
                    all: initial;
                }

                .emotion-card {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;

                    margin-top: 7px;
                    padding: 6px 10px;

                    border-radius: 999px;

                    background:
                        rgba(8, 12, 18, 0.96);

                    border:
                        1px solid ${config.color};

                    box-shadow:
                        0 0 8px
                        ${config.color}55;

                    color: #ffffff;

                    font-family:
                        Arial,
                        Helvetica,
                        sans-serif;

                    font-size: 12px;

                    font-weight: 600;

                    line-height: 1;

                    white-space: nowrap;

                    cursor: default;

                    user-select: none;
                }

                .emoji {
                    font-size: 16px;
                }

                .emotion {
                    color: ${config.color};
                }

                .confidence {
                    color: #c8d0d8;
                    font-weight: 500;
                }

                .separator {
                    color: #56616d;
                }

            </style>

            <div class="emotion-card">

                <span class="emoji">
                    ${config.emoji}
                </span>

                <span class="emotion">
                    ${config.label}
                </span>

                <span class="separator">
                    •
                </span>

                <span class="confidence">
                    ${confidence}%
                </span>

            </div>
        `;

        shadow.appendChild(wrapper);

        return container;
    }


    function injectEmotion(
        target,
        result
    ) {

        if (!target || !result) {
            return;
        }

        // Prevent duplicates
        if (
            target.querySelector(
                ".emotion-detector-container"
            )
        ) {
            return;
        }

        const badge =
            createEmotionBadge(result);

        target.appendChild(badge);
    }


    // --------------------------------------------------------
    // Site Configurations
    // --------------------------------------------------------

    const siteConfigurations = [

        {
            name: "X / Twitter",

            match:
                /twitter\.com|x\.com/i,

            selector:
                'article',

            getText(article) {

                return (
                    article.querySelector(
                        '[data-testid="tweetText"]'
                    )?.innerText || ""
                );
            },

            getTarget(article) {

                return (
                    article.querySelector(
                        '[data-testid="tweetText"]'
                    )?.parentElement || null
                );
            }
        },


        {
            name: "Reddit",

            match:
                /reddit\.com/i,

            selector:
                'shreddit-post, [data-testid="post-container"]',

            getText(element) {

                return (
                    element.querySelector(
                        '[data-testid="post-content"]'
                    )?.innerText ||
                    element.innerText ||
                    ""
                );
            },

            getTarget(element) {

                return (
                    element.querySelector(
                        '[data-testid="post-content"]'
                    ) || element
                );
            }
        },


        {
            name: "Facebook",

            match:
                /facebook\.com/i,

            selector:
                '[data-ad-preview="message"], .userContent',

            getText(element) {

                return element.innerText || "";
            },

            getTarget(element) {

                return element;
            }
        },


        {
            name: "YouTube",

            match:
                /youtube\.com/i,

            selector:
                'ytd-comment-thread-renderer',

            getText(element) {

                return (
                    element.querySelector(
                        '#content-text'
                    )?.innerText || ""
                );
            },

            getTarget(element) {

                return (
                    element.querySelector(
                        '#content-text'
                    )?.parentElement || null
                );
            }
        },


        {
            name: "LinkedIn",

            match:
                /linkedin\.com/i,

            selector:
                '.feed-shared-update-v2',

            getText(element) {

                return (
                    element.querySelector(
                        '.feed-shared-text'
                    )?.innerText ||
                    element.innerText ||
                    ""
                );
            },

            getTarget(element) {

                return element;
            }
        }
    ];


    // --------------------------------------------------------
    // Site Detection
    // --------------------------------------------------------

    function detectSite() {

        return siteConfigurations.find(
            site =>
                site.match.test(
                    window.location.href
                )
        );
    }


    // --------------------------------------------------------
    // Process Element
    // --------------------------------------------------------

    async function processElement(
        element,
        site
    ) {

        if (!element || processedElements.has(element)) {
            return;
        }

        processedElements.add(element);

        const text =
            normalizeText(
                site.getText(element)
            );

        const target =
            site.getTarget(element);

        if (
            !text ||
            text.length < MIN_TEXT_LENGTH ||
            !target
        ) {
            return;
        }

        const result =
            await analyzeEmotion(text);

        if (result) {

            injectEmotion(
                target,
                result
            );
        }
    }


    // --------------------------------------------------------
    // Scan Page
    // --------------------------------------------------------

    async function scanPage(site) {

        const elements =
            document.querySelectorAll(
                site.selector
            );

        // Process sequentially to avoid
        // flooding the API
        for (const element of elements) {

            await processElement(
                element,
                site
            );
        }
    }


    // --------------------------------------------------------
    // Dynamic Page Observer
    // --------------------------------------------------------

    function observePage(site) {

        let scanTimeout = null;

        const observer =
            new MutationObserver(() => {

                clearTimeout(scanTimeout);

                scanTimeout =
                    setTimeout(() => {

                        scanPage(site);

                    }, 1000);
            });

        observer.observe(
            document.body,
            {
                childList: true,
                subtree: true
            }
        );
    }


    // --------------------------------------------------------
    // Initialize
    // --------------------------------------------------------

    function initialize() {

        const activeSite =
            detectSite();

        if (!activeSite) {
            return;
        }

        console.log(
            `[Emotion Detector] ${activeSite.name} detected.`
        );

        scanPage(activeSite);

        observePage(activeSite);
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize
        );

    } else {

        initialize();
    }

})();