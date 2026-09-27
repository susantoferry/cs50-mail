import json
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.db import IntegrityError
from django.http import JsonResponse
from django.shortcuts import HttpResponse, HttpResponseRedirect, render
from django.urls import reverse
from django.utils.http import content_disposition_header
from django.views.decorators.clickjacking import xframe_options_sameorigin
from django.views.decorators.csrf import csrf_exempt

from .models import User, Email, Attachment, new_thread_id, normalize_subject

MAX_ATTACHMENTS_SIZE = 4 * 1024 * 1024


def index(request):

    # Authenticated users view their inbox
    if request.user.is_authenticated:
        return render(request, "mail/inbox.html")

    # Everyone else is prompted to sign in
    else:
        return HttpResponseRedirect(reverse("login"))


@csrf_exempt
@login_required
def compose(request):

    # Composing a new email must be via POST
    if request.method != "POST":
        return JsonResponse({"error": "POST request required."}, status=400)

    # Accept JSON, or multipart form data when files are attached
    if request.content_type == "multipart/form-data":
        data = request.POST
        files = request.FILES.getlist("attachments")
    else:
        data = json.loads(request.body)
        files = []

    # Check attachment sizes (Vercel rejects request bodies over 4.5 MB)
    if sum(file.size for file in files) > MAX_ATTACHMENTS_SIZE:
        return JsonResponse({
            "error": "Attachments must be 4 MB or less in total.",
            "status": 400
        }, status=400)

    # Check recipient emails
    emails = [email.strip() for email in data.get("recipients", "").split(",")]
    if emails == [""]:
        return JsonResponse({
            "error": "At least one recipient required."
        }, status=400)

    # Convert email addresses to users
    recipients = []
    for email in emails:
        try:
            user = User.objects.get(email=email)
            recipients.append(user)
        except User.DoesNotExist:
            return JsonResponse({
                "error": f"User with email {email} does not exist.",
                "status": 400
            }, status=400)

    # Get contents of email
    subject = data.get("subject", "")
    body = data.get("body", "")

    # A reply joins the thread it answers, but only a thread the sender is in
    thread_id = data.get("thread_id", "")
    if not thread_id or not Email.objects.filter(user=request.user, thread_id=thread_id).exists():
        thread_id = new_thread_id()

    # Store each attachment once and share it between every copy of the email
    attachments = [
        Attachment.objects.create(
            uploader=request.user,
            filename=file.name,
            content_type=file.content_type or "application/octet-stream",
            size=file.size,
            data=file.read()
        )
        for file in files
    ]

    # Create one email for each recipient, plus sender
    users = set()
    users.add(request.user)
    users.update(recipients)
    for user in users:
        email = Email(
            user=user,
            sender=request.user,
            subject=subject,
            body=body,
            read=user == request.user,
            thread_id=thread_id
        )
        email.save()
        for recipient in recipients:
            email.recipients.add(recipient)
        email.attachments.add(*attachments)
        email.save()

    return JsonResponse({"message": "Email sent successfully.","status": 201}, status=201)


@login_required
def mailbox(request, mailbox):

    # Filter emails returned based on mailbox
    if mailbox == "inbox":
        emails = Email.objects.filter(
            user=request.user, recipients=request.user, archived=False
        )
    elif mailbox == "sent":
        emails = Email.objects.filter(
            user=request.user, sender=request.user
        )
    elif mailbox == "archive":
        emails = Email.objects.filter(
            user=request.user, recipients=request.user, archived=True
        )
    else:
        return JsonResponse({"error": "Invalid mailbox."}, status=400)

    # Return emails in reverse chronologial order
    emails = emails.order_by("-timestamp").all()
    return JsonResponse([email.serialize() for email in emails], safe=False)


def mailbox_filter(request, mailbox):
    """Filter for the emails that make a thread show up in the given mailbox."""
    if mailbox == "inbox":
        return {"user": request.user, "recipients": request.user, "archived": False}
    if mailbox == "sent":
        return {"user": request.user, "sender": request.user}
    if mailbox == "archive":
        return {"user": request.user, "recipients": request.user, "archived": True}
    return None


@login_required
def threads(request, mailbox):

    # A thread is listed in a mailbox if any of its emails belongs there
    filters = mailbox_filter(request, mailbox)
    if filters is None:
        return JsonResponse({"error": "Invalid mailbox."}, status=400)
    thread_ids = set(Email.objects.filter(**filters).values_list("thread_id", flat=True))

    # Summarise each thread from all of the user's emails in it
    grouped = {}
    for email in Email.objects.filter(user=request.user, thread_id__in=thread_ids).order_by("timestamp"):
        grouped.setdefault(email.thread_id, []).append(email)

    summaries = []
    for thread_id, emails in grouped.items():
        latest = emails[-1]
        senders = []
        for email in emails:
            if email.sender.email not in senders:
                senders.append(email.sender.email)
        summaries.append({
            "thread_id": thread_id,
            "subject": normalize_subject(emails[0].subject) or "(no subject)",
            "senders": senders,
            "recipients": [user.email for user in latest.recipients.all()],
            "count": len(emails),
            "body": latest.body,
            "timestamp": latest.timestamp.strftime("%b %d %Y, %I:%M %p"),
            "read": all(email.read for email in emails),
            "has_attachments": any(email.attachments.exists() for email in emails),
            "_sort": latest.timestamp
        })

    # Most recently active threads first
    summaries.sort(key=lambda summary: summary.pop("_sort"), reverse=True)
    return JsonResponse(summaries, safe=False)


@csrf_exempt
@login_required
def thread(request, thread_id):

    emails = Email.objects.filter(user=request.user, thread_id=thread_id).order_by("timestamp")
    if not emails.exists():
        return JsonResponse({"error": "Thread not found."}, status=404)

    # Return every message in the thread, oldest first
    if request.method == "GET":
        return JsonResponse({
            "thread_id": thread_id,
            "subject": normalize_subject(emails[0].subject) or "(no subject)",
            "emails": [email.serialize() for email in emails]
        })

    # Mark the whole thread read or archived
    elif request.method == "PUT":
        data = json.loads(request.body)
        if data.get("read") is not None:
            emails.update(read=data["read"])
        if data.get("archived") is not None:
            emails.update(archived=data["archived"])
        return HttpResponse(status=204)

    else:
        return JsonResponse({
            "error": "GET or PUT request required."
        }, status=400)


@csrf_exempt
@login_required
def email(request, email_id):

    # Query for requested email
    try:
        email = Email.objects.get(user=request.user, pk=email_id)
    except Email.DoesNotExist:
        return JsonResponse({"error": "Email not found."}, status=404)

    # Return email contents
    if request.method == "GET":
        return JsonResponse(email.serialize())

    # Update whether email is read or should be archived
    elif request.method == "PUT":
        data = json.loads(request.body)
        if data.get("read") is not None:
            email.read = data["read"]
        if data.get("archived") is not None:
            email.archived = data["archived"]
        email.save()
        return HttpResponse(status=204)

    # Email must be via GET or PUT
    else:
        return JsonResponse({
            "error": "GET or PUT request required."
        }, status=400)


@login_required
@xframe_options_sameorigin
def attachment(request, attachment_id):

    # Only people who have an email containing the attachment may download it
    attachment = Attachment.objects.filter(pk=attachment_id, emails__user=request.user).first()
    if attachment is None:
        return JsonResponse({"error": "Attachment not found."}, status=404)

    # ?inline=1 shows the file in the browser, but only for types that can't run
    # scripts; anything else (e.g. HTML, SVG) is always downloaded
    inline = request.GET.get("inline") == "1" and attachment.previewable()
    content_type = attachment.content_type
    if inline and content_type.startswith("text/"):
        content_type = "text/plain; charset=utf-8"

    response = HttpResponse(bytes(attachment.data), content_type=content_type)
    response["Content-Disposition"] = content_disposition_header(not inline, attachment.filename)
    return response


def login_view(request):
    if request.method == "POST":

        # Attempt to sign user in
        email = request.POST["email"]
        password = request.POST["password"]
        user = authenticate(request, username=email, password=password)
        print(user)
        # Check if authentication successful
        if user is not None:
            login(request, user)
            return HttpResponseRedirect(reverse("index"))
        else:
            return render(request, "mail/login.html", {
                "message": "Invalid email and/or password."
            })
    else:
        return render(request, "mail/login.html")


def logout_view(request):
    logout(request)
    return HttpResponseRedirect(reverse("index"))


def register(request):
    if request.method == "POST":
        email = request.POST["email"]

        # Ensure password matches confirmation
        password = request.POST["password"]
        confirmation = request.POST["confirmation"]
        if password != confirmation:
            return render(request, "mail/register.html", {
                "message": "Passwords must match."
            })

        # Attempt to create new user
        try:
            user = User.objects.create_user(email, email, password)
            user.save()
        except IntegrityError as e:
            print(e)
            return render(request, "mail/register.html", {
                "message": "Email address already taken."
            })
        login(request, user)
        return HttpResponseRedirect(reverse("index"))
    else:
        return render(request, "mail/register.html")
