from django.urls import path, re_path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("login", views.login_view, name="login"),
    path("logout", views.logout_view, name="logout"),
    path("register", views.register, name="register"),

    # API Routes
    path("emails", views.compose, name="compose"),
    re_path(r"^emails/(?P<email_id>[0-9a-f]{24})$", views.email, name="email"),
    path("emails/<str:mailbox>", views.mailbox, name="mailbox"),
    re_path(r"^threads/(?P<thread_id>[0-9a-f]{32})$", views.thread, name="thread"),
    path("threads/<str:mailbox>", views.threads, name="threads"),
    re_path(r"^attachments/(?P<attachment_id>[0-9a-f]{24})$", views.attachment, name="attachment"),
]
