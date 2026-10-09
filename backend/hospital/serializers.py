from rest_framework import serializers
from .models import *
nm = lambda u: (u.get_full_name() or u.username) if u else ""
class AppointmentS(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField(); doctor_name = serializers.SerializerMethodField()
    estimated_wait_min = serializers.SerializerMethodField()
    class Meta:
        model = Appointment; fields = "__all__"; read_only_fields = ["token_number", "created_at", "patient"]
    def get_patient_name(self, o): return nm(o.patient)
    def get_doctor_name(self, o): return nm(o.doctor)
    def get_estimated_wait_min(self, o):
        """Baseline heuristic (patients ahead x 10 min); swap for an ML model later."""
        if o.status != "waiting": return None
        return Appointment.objects.filter(doctor=o.doctor, scheduled_at__date=o.scheduled_at.date(),
            status__in=["waiting", "in_consultation"], token_number__lt=o.token_number).count() * 10
class LabS(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    class Meta: model = LabOrder; fields = "__all__"; read_only_fields = ["requested_by"]
    def get_patient_name(self, o): return nm(o.appointment.patient)
class MedicineS(serializers.ModelSerializer):
    low_stock = serializers.SerializerMethodField()
    class Meta: model = Medicine; fields = "__all__"
    def get_low_stock(self, o): return o.stock <= o.reorder_level
class PrescriptionS(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source="medicine.name", read_only=True)
    patient_name = serializers.SerializerMethodField()
    class Meta: model = Prescription; fields = "__all__"; read_only_fields = ["doctor", "dispensed"]
    def get_patient_name(self, o): return nm(o.appointment.patient)
class BedS(serializers.ModelSerializer):
    class Meta: model = Bed; fields = "__all__"
class InvoiceS(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    class Meta: model = Invoice; fields = "__all__"; read_only_fields = ["created_at"]
    def get_patient_name(self, o): return nm(o.patient)
