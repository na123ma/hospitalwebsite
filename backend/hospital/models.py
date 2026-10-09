from django.conf import settings
from django.db import models
U = settings.AUTH_USER_MODEL
class Appointment(models.Model):
    patient = models.ForeignKey(U, on_delete=models.CASCADE, related_name="appointments")
    doctor = models.ForeignKey(U, on_delete=models.CASCADE, related_name="doctor_appointments")
    scheduled_at = models.DateTimeField()
    reason = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, default="waiting")  # waiting / in_consultation / completed / cancelled
    token_number = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
class LabOrder(models.Model):
    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, related_name="lab_orders")
    requested_by = models.ForeignKey(U, on_delete=models.PROTECT)
    test_name = models.CharField(max_length=120)
    status = models.CharField(max_length=20, default="ordered")  # ordered / sample_collected / processing / completed
    result = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)
class Medicine(models.Model):
    name = models.CharField(max_length=120, unique=True)
    stock = models.PositiveIntegerField(default=0)
    reorder_level = models.PositiveIntegerField(default=20)
    expiry_date = models.DateField(null=True, blank=True)
class Prescription(models.Model):
    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, related_name="prescriptions")
    doctor = models.ForeignKey(U, on_delete=models.PROTECT)
    medicine = models.ForeignKey(Medicine, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(default=1)
    dose = models.CharField(max_length=120)
    dispensed = models.BooleanField(default=False)
class Bed(models.Model):
    ward = models.CharField(max_length=60)
    number = models.CharField(max_length=20)
    status = models.CharField(max_length=20, default="available")  # available / occupied / cleaning
    class Meta: unique_together = [("ward", "number")]
class Invoice(models.Model):
    patient = models.ForeignKey(U, on_delete=models.CASCADE, related_name="invoices")
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, default="unpaid")  # unpaid / paid
    created_at = models.DateTimeField(auto_now_add=True)
