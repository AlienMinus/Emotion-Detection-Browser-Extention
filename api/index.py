from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Don't load the model during application startup.
emotion_classifier = None


def get_emotion_classifier():
    global emotion_classifier

    if emotion_classifier is None:
        from transformers import pipeline

        emotion_classifier = pipeline(
            "text-classification",
            model="bhadresh-savani/distilbert-base-uncased-emotion"
        )

    return emotion_classifier


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "online",
        "service": "Emotion Analysis API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "analyze": "/analyze"
        }
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": "emotion-api"
    }), 200


@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json(silent=True) or {}

    text = data.get("text", "").strip()

    if not text:
        return jsonify({
            "error": "No text provided"
        }), 400

    try:
        classifier = get_emotion_classifier()

        result = classifier(text)[0]

        emotion = result["label"]
        score = result["score"]

        return jsonify({
            "emotion": emotion,
            "confidence": round(score, 3),
            "text": text
        })

    except Exception as e:
        return jsonify({
            "error": "Emotion model failed",
            "details": str(e)
        }), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)