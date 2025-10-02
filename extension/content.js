const API_URL = 'http://localhost:5000/analyze';

const emojiMap = {
  joy: "😊", anger: "😡", sadness: "😢", fear: "😨",
  surprise: "😲", love: "❤️", disgust: "🤢", neutral: "😐"
};

// Instead of Set, we tag processed elements
async function analyzeEmotion(text) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    return await response.json();
  } catch (e) {
    console.error("API error:", e);
    return null;
  }
}

function injectEmotion(el, emotion, emoji, confidence) {
  // Avoid duplicate insertion
  if (el.querySelector('.emotion-result')) return;

  const div = document.createElement('div');
  div.className = 'emotion-result';
  div.style.cssText = `
    margin-top: 5px;
    padding: 4px 8px;
    border-radius: 6px;
    background-color: rgba(0, 0, 0, 0.75);
    font-family: 'Orbitron', sans-serif;
    font-size: 13px;
    font-weight: bold;
    color: #00f6ff;
    display: inline-block;
    width: fit-content;
  `;
  div.textContent = `Emotion: ${emotion} ${emoji} | Confidence: ${Math.round(confidence * 100)}%`;
  el.appendChild(div);
  el.setAttribute('data-processed', 'true');
}

// 🌍 Site configurations
const siteSelectors = [
  {
    name: 'Twitter',
    match: /twitter\.com|x\.com/,
    selector: 'article',
    getText: el => el.querySelector('div[data-testid="tweetText"]')?.innerText,
    getTarget: el => el.querySelector('div[data-testid="tweetText"]')?.parentElement || el
  },
  {
    name: 'Reddit',
    match: /reddit\.com/,
    selector: '.md',
    getText: el => el.innerText,
    getTarget: el => el
  },
  {
    name: 'Facebook',
    match: /facebook\.com/,
    selector: '.userContent',
    getText: el => el.innerText,
    getTarget: el => el
  },
  {
    name: 'YouTube',
    match: /youtube\.com/,
    selector: 'ytd-comment-thread-renderer',
    getText: el => el.querySelector('#content-text')?.innerText,
    getTarget: el => el.querySelector('#content-text')?.parentElement || el
  },
  {
    name: 'LinkedIn',
    match: /linkedin\.com/,
    selector: '.feed-shared-update-v2',
    getText: el => el.innerText,
    getTarget: el => el
  }
];

function detectSite() {
  const currentURL = window.location.href;
  return siteSelectors.find(site => site.match.test(currentURL));
}

async function processElements(site) {
  const elements = document.querySelectorAll(site.selector);

  for (const el of elements) {
    if (el.getAttribute('data-processed') === 'true') continue;

    const text = site.getText(el);
    const target = site.getTarget(el);

    if (text && text.length > 10 && target) {
      const result = await analyzeEmotion(text);
      if (result?.emotion) {
        const emoji = emojiMap[result.emotion.toLowerCase()] || "❓";
        injectEmotion(target, result.emotion, emoji, result.confidence);
      }
    }
  }
}

// ⏱️ Run scan every 3 seconds
const activeSite = detectSite();
if (activeSite) {
  setInterval(() => processElements(activeSite), 3000);
}
