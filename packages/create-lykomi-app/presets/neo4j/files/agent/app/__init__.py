"""Agent app package.

`.env` is loaded HERE, in the package initializer, because it has to happen
before any module that reads configuration is imported — and importing a
submodule runs this file first. Calling `load_dotenv()` inside `main.py` looks
equivalent and is not: `from .agent import get_agent` at the top of that file
has already pulled in the whole import graph by the time the call is reached.
"""

from dotenv import load_dotenv

load_dotenv()
