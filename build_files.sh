#!/bin/bash
set -e

# Vercel's Python is externally managed (PEP 668), so install into a
# throwaway virtual environment instead of the system Python.
python3 -m venv /tmp/build-venv
/tmp/build-venv/bin/pip install -r requirements.txt

# Collect static files
/tmp/build-venv/bin/python manage.py collectstatic --noinput
