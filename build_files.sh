#!/bin/bash

# Ensure Python and pip are available
export PATH="/vercel/.python/bin:$PATH"

# Upgrade pip and install dependencies
python3 -m ensurepip --default-pip
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt

# Collect static files
python3 manage.py collectstatic --noinput
