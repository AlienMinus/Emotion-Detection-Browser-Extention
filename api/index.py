import os
import requests

from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

MODEL = "bhadresh-savani/distilbert-base-uncased-emotion"
HF_API_URL = f"https://router.huggingface.co/hf-inference/models/{MODEL}"


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "online",
        "service": "Emotion Detection API",
        "version": "1.0.0",
        "model": MODEL,
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

    hf_token = os.environ.get("HF_TOKEN")

    if not hf_token:
        return jsonify({
            "error": "HF_TOKEN is not configured"
        }), 500

    headers = {
        "Authorization": f"Bearer {hf_token}",
        "Content-Type": "application/json"
    }

    payload = {
        "inputs": text
    }

    try:

        response = requests.post(
            HF_API_URL,
            headers=headers,
            json=payload,
            timeout=30
        )

        if response.status_code != 200:
            return jsonify({
                "error": "Hugging Face inference failed",
                "status_code": response.status_code,
                "details": response.text
            }), 502

        result = response.json()

        # Text classification normally returns:
        # [
        #   {"label": "...", "score": ...},
        #   ...
        # ]

        if not result:
            return jsonify({
                "error": "Empty model response"
            }), 502

        # Get highest-confidence emotion
        best_result = max(
            result,
            key=lambda x: x.get("score", 0)
        )

        emotion = best_result["label"]
        score = best_result["score"]

        return jsonify({
            "emotion": emotion,
            "confidence": round(score, 3),
            "text": text
        })

    except requests.exceptions.Timeout:

        return jsonify({
            "error": "Hugging Face request timed out"
        }), 504

    except requests.exceptions.RequestException as e:

        return jsonify({
            "error": "Failed to contact Hugging Face",
            "details": str(e)
        }), 502

    except Exception as e:

        return jsonify({
            "error": "Internal server error",
            "details": str(e)
        }), 500


if __name__ == "__main__":
    app.run(
        debug=True,
        port=5000
    )