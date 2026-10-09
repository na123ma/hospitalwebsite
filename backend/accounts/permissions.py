from rest_framework.permissions import BasePermission, SAFE_METHODS
class IsAdminRole(BasePermission):
    def has_permission(self, r, v): return r.user.is_authenticated and r.user.role == "admin"
class RoleAccess(BasePermission):
    """View declares read_roles / write_roles; admin is not auto-granted clinical access."""
    def has_permission(self, r, v):
        roles = v.read_roles if r.method in SAFE_METHODS else v.write_roles
        return r.user.is_authenticated and r.user.role in roles
