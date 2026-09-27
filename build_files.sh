#!/bin/bash
set -e

# Vercel's Python is externally managed (PEP 668), so install into a
# throwaway virtual environment instead of the system Python.
python3 -m venv /tmp/build-venv
/tmp/build-venv/bin/pip install -r requirements.txt

# Collect static files. This never touches the database, so fall back to a
# placeholder URI if MONGODB_URI isn't available at build time.
MONGODB_URI="${MONGODB_URI:-mongodb://localhost}" \
    /tmp/build-venv/bin/python manage.py collectstatic --noinput
