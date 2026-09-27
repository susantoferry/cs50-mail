# CS50 Mail

A single-page email client built with Django and JavaScript for CS50's Web Programming with Python and JavaScript (Project 3). Users can register, send emails to other registered users, and read, archive, and reply to messages in their inbox.

Data is stored in **MongoDB** (MongoDB Atlas) using the official [`django-mongodb-backend`](https://www.mongodb.com/docs/languages/python/django-mongodb/current/).

## Requirements

- Python 3.10 or newer (tested with 3.12)
- A MongoDB Atlas account (the free M0 tier is enough)

## 1. Get the code and install dependencies

```sh
git clone https://github.com/susantoferry/cs50-mail.git
cd cs50-mail

```

Create and activate a virtual environment:

**macOS / Linux**

```sh
python3 -m venv .venv
source .venv/bin/activate
```

**Windows**

```sh
python -m venv .venv
.venv\Scripts\activate
```

Then install the dependencies (same on every OS):

```sh
pip install -r requirements.txt
```

Once the virtual environment is active, `python` points to the environment's Python on every OS, so the rest of this guide uses `python`. Activate it again in each new terminal before running `python manage.py`. To leave it, run `deactivate`.

## 2. Set up MongoDB Atlas

1. Sign in at [cloud.mongodb.com](https://cloud.mongodb.com) and create a free **M0** cluster.
2. **Security → Database Access**: add a database user with a password. Letters and numbers only are easiest, because characters such as `@ : / ?` must be URL-encoded in the connection string.
3. **Security → Network Access**: add your current IP address. If you deploy to a host with changing IP addresses (such as Vercel), also allow `0.0.0.0/0`.
4. On your cluster, click **Connect → Drivers** and copy the connection string. It looks like this:

   ```
   mongodb+srv://<username>:<db_password>@<cluster-host>/?appName=<app-name>
   ```

## 3. Configure the connection

Create a `.env` file in the project root (next to `manage.py`) by copying the example:

```sh
cp .env.example .env        # Windows: copy .env.example .env
```

Open `.env` and paste your connection string, replacing `<db_password>` with the real password:

```
MONGODB_URI='mongodb+srv://myuser:mypassword@cluster0.abc123.mongodb.net/?appName=Cluster0'
```

`settings.py` loads this file automatically. `.env` is listed in `.gitignore`, so never commit it. The database name defaults to `mail`; set `MONGODB_NAME` in `.env` to use a different one.

## 4. Create the database collections

```sh
python manage.py migrate
python manage.py createsuperuser   # optional, for /admin
```

## 5. Run the app

```sh
python manage.py runserver
```

Open <http://127.0.0.1:8000>, register an account, and start sending emails. Register a second account to have someone to send to. Press **Ctrl + C** to stop the server.

## API routes

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/emails/<mailbox>` | List emails in `inbox`, `sent`, or `archive` |
| `GET` | `/emails/<email_id>` | Get one email |
| `PUT` | `/emails/<email_id>` | Update `read` and/or `archived` |
| `POST` | `/emails` | Send an email (`recipients`, `subject`, `body`) |

Email IDs are MongoDB ObjectIds (24-character hex strings), for example `6ab7f1817acafbb15e2da838`.

## Project structure

```
mail/               Django app: models, views, templates, static JS/CSS
mail/migrations/    Migrations for the mail app
mongo_migrations/   MongoDB versions of Django's admin, auth, and contenttypes migrations
project3/           Project settings, URLs, and app configs for MongoDB
```

## Changing the models

Because the database is MongoDB, Django's built-in apps use migrations stored in `mongo_migrations/` instead of their defaults. After editing `mail/models.py`, run:

```sh
python manage.py makemigrations mail
python manage.py migrate
```

New models should not set `id = models.BigAutoField(...)`. The default primary key is `ObjectIdAutoField`.

## Deploying to Vercel

- In the Vercel project settings, add `MONGODB_URI` under **Environment Variables**. The `.env` file is not deployed.
- In Atlas **Network Access**, allow `0.0.0.0/0`.
- Django 5.2 requires Python 3.10+, so make sure the Python runtime in `vercel.json` is not `python3.9`.

## Troubleshooting

| Error | Fix |
| --- | --- |
| `ModuleNotFoundError: No module named 'django'` | The virtual environment is not active. Run `source .venv/bin/activate` (Windows: `.venv\Scripts\activate`). |
| `KeyError: 'MONGODB_URI'` | `.env` is missing or is not next to `manage.py`. |
| `bad auth : authentication failed` | Wrong username or password in `.env`. Reset the password under **Database Access** and update `.env`. |
| `ServerSelectionTimeoutError` | Your IP is not allowed. Add it under **Network Access** in Atlas. |
