from django.contrib import admin

from . import models

for m in (models.Worker, models.Day, models.Expense, models.ExpenseCategory, models.Shortage, models.Advance,
          models.SalaryRun, models.AuditLog, models.Settings, models.LeaveRecord, models.DailyPayment):
    admin.site.register(m)
