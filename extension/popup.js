// ============================================================
// Emotion Detector - Popup
// ============================================================

"use strict";


// ------------------------------------------------------------
// Configuration
// ------------------------------------------------------------

const API_URL =
    "https://emotion-detection-browser-extention.vercel.app/analyze";


// ------------------------------------------------------------
// Emotion Configuration
// ------------------------------------------------------------

const EMOTIONS = {

    joy: {
        emoji: "😊",
        label: "Joy",
        className: "joy"
    },

    love: {
        emoji: "❤️",
        label: "Love",
        className: "love"
    },

    surprise: {
        emoji: "😲",
        label: "Surprise",
        className: "surprise"
    },

    sadness: {
        emoji: "😢",
        label: "Sadness",
        className: "sadness"
    },

    anger: {
        emoji: "😡",
        label: "Anger",
        className: "anger"
    },

    fear: {
        emoji: "😨",
        label: "Fear",
        className: "fear"
    },

    disgust: {
        emoji: "🤢",
        label: "Disgust",
        className: "disgust"
    },

    neutral: {
        emoji: "😐",
        label: "Neutral",
        className: "neutral"
    }
};


// ------------------------------------------------------------
// DOM
// ------------------------------------------------------------

const input =
    document.getElementById("inputText");

const analyzeButton =
    document.getElementById("analyzeBtn");

const buttonText =
    document.getElementById("buttonText");

const loader =
    document.getElementById("loader");

const resultContainer =
    document.getElementById("result");

const clearButton =
    document.getElementById("clearBtn");

const charCount =
    document.getElementById("charCount");


// ------------------------------------------------------------
// Character Counter
// ------------------------------------------------------------

input.addEventListener(
    "input",
    updateCharacterCount
);


function updateCharacterCount() {

    charCount.textContent =
        `${input.value.length} / 5000`;
}


// ------------------------------------------------------------
// Clear
// ------------------------------------------------------------

clearButton.addEventListener(
    "click",
    () => {

        input.value = "";

        updateCharacterCount();

        hideResult();

        input.focus();
    }
);


// ------------------------------------------------------------
// Analyze
// ------------------------------------------------------------

analyzeButton.addEventListener(
    "click",
    analyzeText
);


async function analyzeText() {

    const text =
        input.value.trim();

    if (!text) {

        showError(
            "Please enter some text to analyze."
        );

        return;
    }

    if (text.length < 3) {

        showError(
            "Please enter at least 3 characters."
        );

        return;
    }

    setLoading(true);

    hideResult();

    try {

        const response =
            await fetch(
                API_URL,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        text
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok || !data.success) {

            throw new Error(
                data.error ||
                "Unable to analyze text."
            );
        }


        displayResult(data);

    } catch (error) {

        console.error(
            "Emotion API error:",
            error
        );

        showError(
            error.message ||
            "Unable to connect to the emotion service."
        );

    } finally {

        setLoading(false);
    }
}


// ------------------------------------------------------------
// Display Result
// ------------------------------------------------------------

function displayResult(data) {

    const emotionKey =
        String(data.emotion)
            .toLowerCase();

    const emotion =
        EMOTIONS[emotionKey] || {

            emoji: "❓",

            label: data.emotion,

            className: "unknown"
        };


    const confidence =
        Math.round(
            Number(data.confidence || 0) * 100
        );


    let emotionRows = "";


    if (data.emotions) {

        const sorted =
            Object.entries(data.emotions)
                .sort(
                    ([, a], [, b]) => b - a
                );


        emotionRows =
            sorted
                .map(
                    ([name, score]) => {

                        const config =
                            EMOTIONS[name] || {
                                emoji: "❓",
                                label: name,
                                className: "unknown"
                            };

                        const percentage =
                            Math.round(
                                Number(score) * 100
                            );

                        return `
                            <div class="emotion-row">

                                <div class="emotion-name">

                                    <span>
                                        ${config.emoji}
                                    </span>

                                    <span>
                                        ${config.label}
                                    </span>

                                </div>

                                <div class="emotion-progress">

                                    <div
                                        class="
                                            emotion-progress-fill
                                            ${config.className}
                                        "
                                        style="
                                            width:
                                            ${percentage}%;
                                        "
                                    ></div>

                                </div>

                                <span class="emotion-value">
                                    ${percentage}%
                                </span>

                            </div>
                        `;
                    }
                )
                .join("");
    }


    resultContainer.innerHTML = `

        <div class="primary-result">

            <div
                class="
                    primary-emotion
                    ${emotion.className}
                "
            >
                ${emotion.emoji}
            </div>

            <div class="primary-info">

                <span class="result-label">
                    Detected Emotion
                </span>

                <strong>
                    ${escapeHTML(emotion.label)}
                </strong>

            </div>

            <div class="confidence">

                <span>
                    ${confidence}%
                </span>

                <small>
                    confidence
                </small>

            </div>

        </div>


        <div class="scores">

            <div class="scores-title">
                Emotion Distribution
            </div>

            ${emotionRows}

        </div>

        <div class="analyzed-text">

            <span>
                Analyzed text
            </span>

            <p>
                ${escapeHTML(data.text)}
            </p>

        </div>
    `;


    resultContainer.classList.remove(
        "hidden"
    );
}


// ------------------------------------------------------------
// Error
// ------------------------------------------------------------

function showError(message) {

    resultContainer.innerHTML = `

        <div class="error-box">

            <div class="error-icon">
                ⚠️
            </div>

            <div>

                <strong>
                    Analysis failed
                </strong>

                <p>
                    ${escapeHTML(message)}
                </p>

            </div>

        </div>
    `;


    resultContainer.classList.remove(
        "hidden"
    );
}


// ------------------------------------------------------------
// Loading
// ------------------------------------------------------------

function setLoading(isLoading) {

    analyzeButton.disabled =
        isLoading;

    loader.classList.toggle(
        "hidden",
        !isLoading
    );


    buttonText.textContent =
        isLoading
            ? "Analyzing..."
            : "Analyze Emotion";
}


// ------------------------------------------------------------
// Hide Result
// ------------------------------------------------------------

function hideResult() {

    resultContainer.classList.add(
        "hidden"
    );

    resultContainer.innerHTML = "";
}


// ------------------------------------------------------------
// HTML Escaping
// ------------------------------------------------------------

function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        String(value);

    return div.innerHTML;
}


// ------------------------------------------------------------
// Keyboard Shortcut
// ------------------------------------------------------------

input.addEventListener(
    "keydown",
    event => {

        if (
            event.ctrlKey &&
            event.key === "Enter"
        ) {

            analyzeText();
        }
    }
);


// Initial state
updateCharacterCount();