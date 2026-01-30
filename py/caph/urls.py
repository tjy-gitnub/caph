from django.urls import path

from . import views

urlpatterns = [
    path('', views.chatpage),
    path('isready',views.ready),
    path('guide',views.guidepage),
    path('tool/run_cmd', views.run_cmd),
    path('tool/open_url', views.open_url),
]
