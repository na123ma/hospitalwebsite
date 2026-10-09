from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views
router = DefaultRouter(); router.register("users", views.UserViewSet, basename="users")
urlpatterns = [path("login/", views.LoginView.as_view()), path("refresh/", TokenRefreshView.as_view()),
    path("register/", views.RegisterPatientView.as_view()), path("setup-admin/", views.SetupAdminView.as_view()),
    path("me/", views.MeView.as_view()), path("directory/", views.DirectoryView.as_view()),
    path("", include(router.urls))]
