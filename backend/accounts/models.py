from django.contrib.auth.models import AbstractUser
from django.db import models
STAFF_ROLES = ["doctor", "nurse", "receptionist", "lab", "pharmacist"]
class User(AbstractUser):
    ROLES = [("admin", "Admin"), ("doctor", "Doctor"), ("nurse", "Nurse"), ("receptionist", "Receptionist"),
             ("lab", "Lab Technician"), ("pharmacist", "Pharmacist"), ("patient", "Patient")]
    role = models.CharField(max_length=20, choices=ROLES, default="patient")
    phone = models.CharField(max_length=20, blank=True)
    specialization = models.CharField(max_length=120, blank=True)
    degrees = models.CharField(max_length=255, blank=True)
    def save(self, *a, **k):
        if self.is_superuser: self.role = "admin"
        super().save(*a, **k)
