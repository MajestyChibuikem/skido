import logging
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s — %(message)s',
)

from app import create_app  # noqa: E402

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5001, use_reloader=False)
