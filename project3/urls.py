"""project3 URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/3.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.contrib.staticfiles.views import serve
from django.urls import include, path, re_path

urlpatterns = [
    path('admin/', admin.site.urls),
    # Serve static files from the apps even with DEBUG off, so local runserver
    # works without it. On Vercel, /static/ is routed to the static build instead.
    re_path(r'^static/(?P<path>.*)$', serve, {'insecure': True}),
    path('', include('mail.urls'))
]
