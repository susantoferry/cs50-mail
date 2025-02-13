#!/bin/bash

# Install Python and pip
apt-get update && apt-get install -y python3 python3-pip

# Install dependencies
pip install -r requirements.txt

# Collect static files
python3.9 manage.py collectstatic --noinput