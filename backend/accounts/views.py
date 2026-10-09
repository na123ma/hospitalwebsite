from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import User, STAFF_ROLES
from .serializers import UserSerializer, LoginSerializer
from .permissions import IsAdminRole
class LoginView(TokenObtainPairView): serializer_class = LoginSerializer
class RegisterPatientView(APIView):
    permission_classes = [AllowAny]
    def post(self, r):
        s = UserSerializer(data=r.data); s.is_valid(raise_exception=True)
        return Response(UserSerializer(s.save(role="patient")).data, status=201)
class SetupAdminView(APIView):
    """One-time admin registration: only works while no admin exists."""
    permission_classes = [AllowAny]
    def get(self, r): return Response({"needs_admin": not User.objects.filter(role="admin").exists()})
    def post(self, r):
        if User.objects.filter(role="admin").exists():
            return Response({"detail": "An admin already exists."}, status=403)
        s = UserSerializer(data=r.data); s.is_valid(raise_exception=True)
        return Response(UserSerializer(s.save(role="admin", is_staff=True)).data, status=201)
class MeView(APIView):
    def get(self, r): return Response(UserSerializer(r.user).data)
class DirectoryView(APIView):
    """id + name lists for dropdowns. Patient list is hidden from patients."""
    def get(self, r):
        role = r.query_params.get("role", "doctor")
        if role == "patient" and r.user.role == "patient": return Response([])
        return Response([{"id": u.id, "name": u.get_full_name() or u.username}
                         for u in User.objects.filter(role=role, is_active=True)])
class UserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = UserSerializer
    def get_queryset(self):
        qs = User.objects.all().order_by("-id"); role = self.request.query_params.get("role")
        return qs.filter(role=role) if role else qs
    def perform_create(self, s):
        role = self.request.data.get("role")
        if role not in STAFF_ROLES:
            raise ValidationError({"role": f"Admin can create: {', '.join(STAFF_ROLES)}. Patients self-register."})
        s.save(role=role)
    def perform_update(self, s):
        role = s.validated_data.get("role")
        if role is not None and role not in STAFF_ROLES:
            raise ValidationError({"role": f"Admin can assign: {', '.join(STAFF_ROLES)}."})
        s.save()
    def destroy(self, r, *a, **k):
        if self.get_object() == r.user: return Response({"detail": "You cannot delete yourself."}, status=400)
        return super().destroy(r, *a, **k)
