"""Shared utilities: configuration loading, logging, seeding, timing."""

from __future__ import annotations

import functools
import logging
import random
import time
from pathlib import Path
from typing import Any, Callable, TypeVar

import numpy as np
import yaml

F = TypeVar("F", bound=Callable[..., Any])

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "config" / "config.yaml"


def load_config(config_path: Path | str | None = None) -> dict[str, Any]:
    """Load YAML configuration from disk.

    Args:
        config_path: Path to config file. Defaults to ``config/config.yaml``.

    Returns:
        Parsed configuration dictionary.
    """
    path = Path(config_path) if config_path else DEFAULT_CONFIG_PATH
    with path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def setup_logging(level: str | None = None, log_format: str | None = None) -> logging.Logger:
    """Configure root logger using config defaults.

    Args:
        level: Log level name (e.g. ``INFO``). Falls back to config value.
        log_format: Log format string. Falls back to config value.

    Returns:
        Configured root logger.
        
    Note:
        Uses force=True to prevent duplicate handlers on repeated calls
        (e.g., Streamlit reruns). This is safe for CLI scripts and dashboards.
    """
    config = load_config()
    log_cfg = config.get("logging", {})
    resolved_level = (level or log_cfg.get("level", "INFO")).upper()
    resolved_format = log_format or log_cfg.get(
        "format", "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )

    logging.basicConfig(level=getattr(logging, resolved_level), format=resolved_format, force=True)
    return logging.getLogger("fraud_detection")


def set_seed(seed: int | None = None) -> int:
    """Set random seeds for reproducibility across libraries.

    Args:
        seed: Random seed. Falls back to ``project.random_state`` in config.

    Returns:
        The seed value that was applied.
    """
    config = load_config()
    resolved_seed = seed if seed is not None else config["project"]["random_state"]
    random.seed(resolved_seed)
    np.random.seed(resolved_seed)
    return resolved_seed


def timer(func: F) -> F:
    """Decorator that logs elapsed wall-clock time for a function call."""

    @functools.wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        logger = logging.getLogger("fraud_detection")
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        logger.info("%s completed in %.2fs", func.__name__, elapsed)
        return result

    return wrapper  # type: ignore[return-value]


def resolve_path(relative_path: str) -> Path:
    """Resolve a project-relative path to an absolute Path."""
    return PROJECT_ROOT / relative_path
