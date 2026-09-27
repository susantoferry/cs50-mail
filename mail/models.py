import re
import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    pass


# Types the browser can show without running scripts. Text is always served as
# text/plain, so HTML or SVG uploaded as text shows as source, never as a page.
PREVIEW_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp", "application/pdf"}
PREVIEW_PREFIXES = ("text/", "audio/", "video/")


class Attachment(models.Model):
    uploader = models.ForeignKey("User", on_delete=models.CASCADE, related_name="attachments")
    filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=255)
    size = models.PositiveIntegerField()
    data = models.BinaryField()

    def previewable(self):
        return self.content_type in PREVIEW_TYPES or self.content_type.startswith(PREVIEW_PREFIXES)

    def serialize(self):
        return {
            "id": str(self.id),
            "filename": self.filename,
            "content_type": self.content_type,
            "size": self.size,
            "previewable": self.previewable()
        }


def new_thread_id():
    return uuid.uuid4().hex


def normalize_subject(subject):
    """Subject without any leading "Re:"/"Fwd:" prefixes, used to title threads."""
    return re.sub(r"^(\s*(re|fwd?)\s*:\s*)+", "", subject, flags=re.IGNORECASE).strip()


class Email(models.Model):
    user = models.ForeignKey("User", on_delete=models.CASCADE, related_name="emails")
    sender = models.ForeignKey("User", on_delete=models.PROTECT, related_name="emails_sent")
    recipients = models.ManyToManyField("User", related_name="emails_received")
    subject = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    read = models.BooleanField(default=False)
    archived = models.BooleanField(default=False)
    attachments = models.ManyToManyField("Attachment", blank=True, related_name="emails")
    # Shared by an email and all its replies; each user's copies carry the same id
    thread_id = models.CharField(max_length=32, default=new_thread_id, db_index=True)

    def serialize(self):
        return {
            "id": str(self.id),
            "thread_id": self.thread_id,
            "sender": self.sender.email,
            "recipients": [user.email for user in self.recipients.all()],
            "subject": self.subject,
            "body": self.body,
            "timestamp": self.timestamp.strftime("%b %d %Y, %I:%M %p"),
            "read": self.read,
            "archived": self.archived,
            "attachments": [attachment.serialize() for attachment in self.attachments.defer("data")]
        }
