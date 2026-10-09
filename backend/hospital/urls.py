from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views as v
r = DefaultRouter()
for p, vs in [("appointments", v.AppointmentVS), ("lab-orders", v.LabVS), ("medicines", v.MedicineVS),
              ("prescriptions", v.PrescriptionVS), ("beds", v.BedVS), ("invoices", v.InvoiceVS)]:
    r.register(p, vs, basename=p)
urlpatterns = [path("stats/", v.StatsView.as_view()), path("", include(r.urls))]
