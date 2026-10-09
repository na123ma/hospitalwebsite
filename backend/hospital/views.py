from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.models import User
from accounts.permissions import RoleAccess, IsAdminRole
from .models import *
from .serializers import *
class Base(viewsets.ModelViewSet):
    permission_classes = [RoleAccess]
    patient_field = None   # patients only see rows linked to themselves
    def get_queryset(self):
        qs = self.queryset.order_by("-id")
        if self.request.user.role == "patient":
            return qs.filter(**{self.patient_field: self.request.user}) if self.patient_field else qs.none()
        return qs
class AppointmentVS(Base):
    queryset = Appointment.objects.select_related("patient", "doctor"); serializer_class = AppointmentS
    patient_field = "patient"
    read_roles = ["patient", "receptionist", "doctor", "nurse", "admin"]
    write_roles = ["patient", "receptionist", "doctor"]
    def get_queryset(self):
        qs = super().get_queryset()
        return qs.filter(doctor=self.request.user) if self.request.user.role == "doctor" else qs
    @transaction.atomic
    def perform_create(self, s):
        u = self.request.user
        patient = u if u.role == "patient" else User.objects.filter(pk=self.request.data.get("patient"), role="patient").first()
        if not patient: raise ValidationError({"patient": "Select a registered patient."})
        day = s.validated_data["scheduled_at"].date()
        last = Appointment.objects.select_for_update().filter(doctor=s.validated_data["doctor"], scheduled_at__date=day).aggregate(m=Max("token_number"))["m"] or 0
        s.save(patient=patient, token_number=last + 1)
class LabVS(Base):
    queryset = LabOrder.objects.select_related("appointment__patient"); serializer_class = LabS
    patient_field = "appointment__patient"
    read_roles = ["patient", "doctor", "lab", "nurse"]; write_roles = ["doctor", "lab"]
    def perform_create(self, s):
        if self.request.user.role != "doctor": raise ValidationError("Only doctors request tests.")
        s.save(requested_by=self.request.user)
class MedicineVS(Base):
    queryset = Medicine.objects.all(); serializer_class = MedicineS
    read_roles = ["pharmacist", "doctor", "admin"]; write_roles = ["pharmacist", "admin"]
class PrescriptionVS(Base):
    queryset = Prescription.objects.select_related("appointment__patient", "medicine"); serializer_class = PrescriptionS
    patient_field = "appointment__patient"
    read_roles = ["patient", "doctor", "pharmacist"]; write_roles = ["doctor"]
    def perform_create(self, s): s.save(doctor=self.request.user)
    @action(detail=True, methods=["post"])
    def dispense(self, r, pk=None):
        if r.user.role != "pharmacist": return Response({"detail": "Pharmacists only."}, status=403)
        with transaction.atomic():
            p = Prescription.objects.select_for_update().get(pk=pk); m = Medicine.objects.select_for_update().get(pk=p.medicine_id)
            if p.dispensed: return Response({"detail": "Already dispensed."}, status=400)
            if m.stock < p.quantity: return Response({"detail": f"Only {m.stock} in stock."}, status=400)
            m.stock -= p.quantity; m.save(); p.dispensed = True; p.save()
        return Response(PrescriptionS(p).data)
    def get_permissions(self):
        return [RoleAccess()] if self.action != "dispense" else [__import__("rest_framework").permissions.IsAuthenticated()]
class BedVS(Base):
    queryset = Bed.objects.all(); serializer_class = BedS
    read_roles = ["nurse", "admin", "receptionist", "doctor"]; write_roles = ["nurse", "admin"]
class InvoiceVS(Base):
    queryset = Invoice.objects.select_related("patient"); serializer_class = InvoiceS
    patient_field = "patient"
    read_roles = ["patient", "receptionist", "admin"]; write_roles = ["receptionist", "admin"]
class StatsView(APIView):
    permission_classes = [IsAdminRole]
    def get(self, r):
        t = timezone.localdate()
        return Response({"patients": User.objects.filter(role="patient").count(),
            "staff": User.objects.exclude(role__in=["patient", "admin"]).count(),
            "appointments_today": Appointment.objects.filter(scheduled_at__date=t).count(),
            "waiting_now": Appointment.objects.filter(status="waiting").count(),
            "pending_labs": LabOrder.objects.exclude(status="completed").count(),
            "low_stock": [m.name for m in Medicine.objects.all() if m.stock <= m.reorder_level],
            "beds_available": Bed.objects.filter(status="available").count(), "beds_total": Bed.objects.count(),
            "unpaid_invoices": Invoice.objects.filter(status="unpaid").count()})
