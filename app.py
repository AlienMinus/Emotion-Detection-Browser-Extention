from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import pipeline

app = Flask(__name__)
CORS(app)

# Load the emotion classification pipeline
emotion_classifier = pipeline("text-classification", model="bhadresh-savani/distilbert-base-uncased-emotion")

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    text = data.get("text", "")
    if not text:
        return jsonify({'error': 'No text provided'}), 400

    result = emotion_classifier(text)[0]
    emotion = result["label"]
    score = result["score"]

    return jsonify({
        'emotion': emotion,
        'confidence': round(score, 3),
        'text': text
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
