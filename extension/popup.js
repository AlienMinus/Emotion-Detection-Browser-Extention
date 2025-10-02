document.getElementById('analyzeBtn').addEventListener('click', async () => {
  const inputText = document.getElementById('inputText').value;

  const response = await fetch('http://localhost:5000/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: inputText })
  });

  const result = await response.json();

  const emojiMap = {
    "joy": "😊",
    "anger": "😡",
    "sadness": "😢",
    "fear": "😨",
    "surprise": "😲",
    "love": "❤️",
    "disgust": "🤢",
    "neutral": "😐"
  };

  const emoji = emojiMap[result.emotion.toLowerCase()] || "❓";

  document.getElementById('result').innerHTML = `
    <p><strong>Emotion:</strong> ${result.emotion} ${emoji}</p>
    <p><strong>Confidence:</strong> ${Math.round(result.confidence * 100)}%</p>
  `;
});
