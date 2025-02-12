#!/bin/bash

# Install dependencies
pip3 install -r requirements.txt

# Run makemigrations
python3 manage.py makemigrations

# Apply migrations
python3 manage.py migrate