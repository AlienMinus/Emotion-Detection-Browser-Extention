import os
import logging
from typing import Any

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS


# ============================================================
# Configuration
# ============================================================

class Config:
    """Application configuration."""

    APP_NAME = "Emotion Detection API"
    VERSION = "1.0.0"

    MODEL = os.getenv(
        "HF_MODEL",
        "bhadresh-savani/distilbert-base-uncased-emotion"
    )

    HF_TOKEN = os.getenv("HF_TOKEN")

    HF_API_URL = (
        f"https://router.huggingface.co/"
        f"hf-inference/models/{MODEL}"
    )

    REQUEST_TIMEOUT = int(
        os.getenv("REQUEST_TIMEOUT", "30")
    )

    MAX_TEXT_LENGTH = int(
        os.getenv("MAX_TEXT_LENGTH", "5000")
    )

    ENVIRONMENT = os.getenv(
        "VERCEL_ENV",
        os.getenv("FLASK_ENV", "production")
    )


# ============================================================
# Logging
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

logger = logging.getLogger(__name__)


# ============================================================
# Flask Application
# ============================================================

app = Flask(__name__)

# Allow browser extension / frontend requests.
CORS(
    app,
    resources={
        r"/*": {
            "origins": "*"
        }
    }
)


# ============================================================
# Helper Functions
# ============================================================

def success_response(
    data: dict[str, Any],
    status_code: int = 200
):
    """
    Return a standardized successful API response.
    """

    return jsonify({
        "success": True,
        **data
    }), status_code


def error_response(
    message: str,
    status_code: int,
    error_code: str | None = None,
    details: Any = None
):
    """
    Return a standardized API error response.
    """

    response = {
        "success": False,
        "error": message
    }

    if error_code:
        response["code"] = error_code

    if details is not None:
        response["details"] = details

    return jsonify(response), status_code


def normalize_model_response(
    result: Any
) -> list[dict[str, Any]]:
    """
    Normalize different Hugging Face response formats.

    Supported formats:

    1.
    [
        {"label": "joy", "score": 0.99},
        {"label": "sadness", "score": 0.01}
    ]

    2.
    [
        [
            {"label": "joy", "score": 0.99},
            {"label": "sadness", "score": 0.01}
        ]
    ]

    Returns:
        List of emotion dictionaries.
    """

    if not result:
        raise ValueError("Model returned an empty response.")

    # Handle nested list response
    if (
        isinstance(result, list)
        and len(result) > 0
        and isinstance(result[0], list)
    ):
        result = result[0]

    if not isinstance(result, list):
        raise ValueError(
            "Unexpected model response format."
        )

    normalized = []

    for item in result:

        if not isinstance(item, dict):
            continue

        label = item.get("label")
        score = item.get("score")

        if label is None or score is None:
            continue

        try:
            score = float(score)
        except (TypeError, ValueError):
            continue

        normalized.append({
            "label": str(label),
            "score": score
        })

    if not normalized:
        raise ValueError(
            "Model response did not contain valid emotion scores."
        )

    return normalized


def analyze_emotion(text: str) -> dict[str, Any]:
    """
    Send text to Hugging Face and process the result.
    """

    if not Config.HF_TOKEN:
        raise RuntimeError(
            "HF_TOKEN environment variable is not configured."
        )

    headers = {
        "Authorization": f"Bearer {Config.HF_TOKEN}",
        "Content-Type": "application/json"
    }

    payload = {
        "inputs": text
    }

    try:

        response = requests.post(
            Config.HF_API_URL,
            headers=headers,
            json=payload,
            timeout=Config.REQUEST_TIMEOUT
        )

    except requests.exceptions.Timeout as exc:

        logger.error(
            "Hugging Face request timed out."
        )

        raise TimeoutError(
            "Hugging Face inference request timed out."
        ) from exc

    except requests.exceptions.RequestException as exc:

        logger.error(
            "Hugging Face connection failed: %s",
            exc
        )

        raise ConnectionError(
            "Unable to connect to Hugging Face."
        ) from exc

    # --------------------------------------------------------
    # HTTP error handling
    # --------------------------------------------------------

    if response.status_code != 200:

        try:
            error_data = response.json()
        except ValueError:
            error_data = response.text

        logger.error(
            "Hugging Face returned HTTP %s",
            response.status_code
        )

        raise RuntimeError(
            f"Hugging Face API returned status "
            f"{response.status_code}: {error_data}"
        )

    # --------------------------------------------------------
    # Parse response
    # --------------------------------------------------------

    try:
        result = response.json()
    except ValueError as exc:

        logger.error(
            "Hugging Face returned invalid JSON."
        )

        raise ValueError(
            "Invalid response received from Hugging Face."
        ) from exc

    # Hugging Face can sometimes return:
    #
    # {
    #     "error": "Model is loading..."
    # }
    #
    if isinstance(result, dict):

        if "error" in result:

            raise RuntimeError(
                str(result["error"])
            )

        # Some responses may contain a direct prediction
        if "label" in result and "score" in result:
            result = [result]

    # --------------------------------------------------------
    # Normalize model output
    # --------------------------------------------------------

    emotions = normalize_model_response(result)

    # Sort from highest to lowest confidence
    emotions.sort(
        key=lambda item: item["score"],
        reverse=True
    )

    # Highest-confidence emotion
    best = emotions[0]

    # Create simplified emotion-score mapping
    emotion_scores = {
        item["label"]: round(item["score"], 4)
        for item in emotions
    }

    return {
        "emotion": best["label"],
        "confidence": round(best["score"], 4),
        "emotions": emotion_scores,
        "predictions": [
            {
                "emotion": item["label"],
                "confidence": round(item["score"], 4)
            }
            for item in emotions
        ]
    }


# ============================================================
# Routes
# ============================================================

@app.route("/", methods=["GET"])
def home():
    """
    API information endpoint.
    """

    return success_response({
        "service": Config.APP_NAME,
        "version": Config.VERSION,
        "status": "online",
        "model": Config.MODEL,
        "environment": Config.ENVIRONMENT,
        "endpoints": {
            "home": "/",
            "health": "/health",
            "analyze": "/analyze"
        }
    })


@app.route("/health", methods=["GET"])
def health():
    """
    Health-check endpoint.

    This endpoint intentionally does not contact
    Hugging Face so that it remains lightweight.
    """

    return success_response({
        "service": Config.APP_NAME,
        "status": "healthy",
        "model": Config.MODEL,
        "huggingface_configured": bool(
            Config.HF_TOKEN
        )
    })


@app.route("/analyze", methods=["POST"])
def analyze():
    """
    Analyze the emotion of submitted text.
    """

    # --------------------------------------------------------
    # Validate Content-Type / JSON
    # --------------------------------------------------------

    if not request.is_json:

        return error_response(
            message="Request must use Content-Type: application/json.",
            status_code=415,
            error_code="INVALID_CONTENT_TYPE"
        )

    data = request.get_json(silent=True)

    if not isinstance(data, dict):

        return error_response(
            message="Invalid JSON request body.",
            status_code=400,
            error_code="INVALID_JSON"
        )

    # --------------------------------------------------------
    # Extract text
    # --------------------------------------------------------

    text = data.get("text")

    if text is None:

        return error_response(
            message="The 'text' field is required.",
            status_code=400,
            error_code="MISSING_TEXT"
        )

    if not isinstance(text, str):

        return error_response(
            message="The 'text' field must be a string.",
            status_code=400,
            error_code="INVALID_TEXT_TYPE"
        )

    text = text.strip()

    # --------------------------------------------------------
    # Empty text
    # --------------------------------------------------------

    if not text:

        return error_response(
            message="Text cannot be empty.",
            status_code=400,
            error_code="EMPTY_TEXT"
        )

    # --------------------------------------------------------
    # Maximum text length
    # --------------------------------------------------------

    if len(text) > Config.MAX_TEXT_LENGTH:

        return error_response(
            message=(
                f"Text exceeds the maximum allowed "
                f"length of {Config.MAX_TEXT_LENGTH} characters."
            ),
            status_code=413,
            error_code="TEXT_TOO_LONG"
        )

    # --------------------------------------------------------
    # Run emotion analysis
    # --------------------------------------------------------

    try:

        result = analyze_emotion(text)

        return success_response({
            "text": text,
            **result
        })

    except TimeoutError as exc:

        return error_response(
            message=str(exc),
            status_code=504,
            error_code="MODEL_TIMEOUT"
        )

    except ConnectionError as exc:

        return error_response(
            message=str(exc),
            status_code=502,
            error_code="MODEL_CONNECTION_ERROR"
        )

    except RuntimeError as exc:

        error_message = str(exc)

        # Don't expose HF token or sensitive internals.
        logger.error(
            "Model runtime error: %s",
            error_message
        )

        return error_response(
            message="Emotion model inference failed.",
            status_code=502,
            error_code="MODEL_ERROR"
        )

    except ValueError as exc:

        logger.error(
            "Model response error: %s",
            exc
        )

        return error_response(
            message="Invalid response received from emotion model.",
            status_code=502,
            error_code="INVALID_MODEL_RESPONSE"
        )

    except Exception:

        logger.exception(
            "Unexpected error during emotion analysis."
        )

        return error_response(
            message="Internal server error.",
            status_code=500,
            error_code="INTERNAL_ERROR"
        )


# ============================================================
# Global Error Handlers
# ============================================================

@app.errorhandler(404)
def not_found(error):

    return error_response(
        message="Endpoint not found.",
        status_code=404,
        error_code="NOT_FOUND"
    )


@app.errorhandler(405)
def method_not_allowed(error):

    return error_response(
        message="HTTP method not allowed.",
        status_code=405,
        error_code="METHOD_NOT_ALLOWED"
    )


@app.errorhandler(500)
def internal_server_error(error):

    logger.exception(
        "Unhandled Flask error."
    )

    return error_response(
        message="Internal server error.",
        status_code=500,
        error_code="INTERNAL_ERROR"
    )


# ============================================================
# Local Development
# ============================================================

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=int(
            os.getenv("PORT", "5000")
        ),
        debug=os.getenv(
            "FLASK_DEBUG",
            "false"
        ).lower() == "true"
    )