from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User
class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, required=False)
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "phone", "role",
                  "specialization", "degrees", "is_active", "password"]
    def validate(self, attrs):
        role = attrs.get("role", self.instance.role if self.instance else None)
        doctor_details_changed = self.instance is None or any(
            field in attrs for field in ("role", "specialization", "degrees"))
        if role == "doctor" and doctor_details_changed:
            missing = [field for field in ("specialization", "degrees")
                       if not attrs.get(field, getattr(self.instance, field, "")).strip()]
            if missing:
                raise serializers.ValidationError({field: "This field is required for doctors." for field in missing})
        if role and role != "doctor" and "role" in attrs:
            attrs["specialization"] = ""
            attrs["degrees"] = ""
        return attrs
    def create(self, d):
        pw = d.pop("password", None)
        if not pw: raise serializers.ValidationError({"password": "Password is required."})
        u = User(**d); u.set_password(pw); u.save(); return u
    def update(self, inst, d):
        pw = d.pop("password", None)
        for k, v in d.items(): setattr(inst, k, v)
        if pw: inst.set_password(pw)
        inst.save(); return inst
class LoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
