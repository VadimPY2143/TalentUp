import logging
import logging.handlers
from pathlib import Path

log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)

logger = logging.getLogger("moodshare")
logger.setLevel(logging.DEBUG)

detailed_formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

simple_formatter = logging.Formatter(
    '%(levelname)s - %(message)s'
)

file_handler = logging.handlers.RotatingFileHandler(
    log_dir / "app.log",
    maxBytes=10485760,
    backupCount=5
)
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(detailed_formatter)

console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(simple_formatter)

logger.addHandler(file_handler)
logger.addHandler(console_handler)

__all__ = ["logger"]
