import os
from pathlib import Path

from dotenv import load_dotenv
from inference_sdk import InferenceHTTPClient

load_dotenv(Path(__file__).resolve().parent / ".env")

api_key = os.getenv("ROBOFLOW_API_KEY")

if not api_key:
    raise SystemExit("ERROR: ROBOFLOW_API_KEY is missing from backend/.env")

image_path = input("Enter the full path to a pothole image: ").strip().strip('"')

if not Path(image_path).is_file():
    raise SystemExit("ERROR: Image file not found.")

client = InferenceHTTPClient(
    api_url="https://serverless.roboflow.com",
    api_key=api_key,
)

model_id = "s-workspace-cojhy/pothole-detection-yolo-8j0qo-14-yolo26s-t1"

try:
    result = client.infer(image_path, model_id=model_id)

    print("\nSUCCESS: Roboflow returned a response.")
    print("Model:", model_id)
    print("Predictions:", len(result.get("predictions", [])))

    for prediction in result.get("predictions", []):
        print(
            prediction.get("class", "unknown"),
            f"{prediction.get('confidence', 0):.1%} confidence",
        )

except Exception as exc:
    print("\nRoboflow request failed:")
    print(type(exc).__name__, str(exc))