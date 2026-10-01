from django.conf import settings
from django.db import models

SECTIONS = ['banda', 'mgahawa']
SECTION_CHOICES = [('banda', 'Banda (stall)'), ('mgahawa', 'Mgahawa (restaurant)')]
DEFAULT_RULES = {
    'permission': {'cut': True, 'pay': False},
    'holiday': {'cut': False, 'pay': False},
    'dayoff': {'cut': False, 'pay': False},
}


class Stamped(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, editable=False,
        on_delete=models.SET_NULL, related_name='+')

    class Meta:
        abstract = True


class Settings(Stamped):
    """Single row (pk=1): change floats and how special days count for pay."""
    float_banda = models.BigIntegerField(default=50000)
    float_mgahawa = models.BigIntegerField(default=80000)
    rules = models.JSONField(default=dict)

    class Meta:
        verbose_name_plural = 'settings'

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1, defaults={'rules': DEFAULT_RULES})
        if not obj.rules:
            obj.rules = DEFAULT_RULES
        return obj

    def float_for(self, section):
        return self.float_banda if section == 'banda' else self.float_mgahawa


class ExpenseCategory(Stamped):
    key = models.SlugField(unique=True)
    name_sw = models.CharField(max_length=60)
    name_en = models.CharField(max_length=60)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ['id']
        verbose_name_plural = 'expense categories'

    def __str__(self):
        return self.name_en


class Worker(Stamped):
    ROLES = [('keshia', 'Cashier'), ('mpishi', 'Cook'), ('mhudumu', 'Waiter'), ('mwingine', 'Other')]
    PAY = [('daily', 'Daily rate'), ('monthly', 'Monthly salary')]
    name = models.CharField(max_length=120)
    role = models.CharField(max_length=12, choices=ROLES)
    phone = models.CharField(max_length=30, blank=True)
    pay_type = models.CharField(max_length=8, choices=PAY)
    rate = models.BigIntegerField()
    day_off = models.PositiveSmallIntegerField(
        default=1, null=True, blank=True, help_text='0=Sunday ... 6=Saturday; null means no weekly day off')
    joined_on = models.DateField()
    active = models.BooleanField(default=True)
    removed_on = models.DateField(null=True, blank=True)
    removed_reason = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class LeaveRecord(Stamped):
    TYPES = [('permission', 'Permission'), ('holiday', 'Holiday')]
    worker = models.ForeignKey(Worker, on_delete=models.CASCADE, related_name='leaves')
    kind = models.CharField(max_length=12, choices=TYPES)
    start = models.DateField()
    end = models.DateField()
    reason = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['-start']


class Day(Stamped):
    date = models.DateField(unique=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    visited = models.JSONField(default=list)

    class Meta:
        ordering = ['-date']

    @property
    def closed(self):
        return self.closed_at is not None


class DaySection(Stamped):
    day = models.ForeignKey(Day, on_delete=models.CASCADE, related_name='sections')
    section = models.CharField(max_length=8, choices=SECTION_CHOICES)
    cash = models.BigIntegerField(default=0)
    mobile = models.BigIntegerField(default=0)
    cashier = models.ForeignKey(Worker, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    counted = models.BigIntegerField(null=True, blank=True)
    float_amount = models.BigIntegerField(null=True, blank=True)
    difference = models.BigIntegerField(null=True, blank=True, help_text='Frozen when the day is closed')

    class Meta:
        unique_together = [('day', 'section')]


class Attendance(Stamped):
    STATUS = [('present', 'Present'), ('late', 'Late'), ('absent', 'Absent')]
    worker = models.ForeignKey(Worker, on_delete=models.CASCADE, related_name='attendance')
    date = models.DateField()
    status = models.CharField(max_length=8, choices=STATUS)

    class Meta:
        unique_together = [('worker', 'date')]


class Delivery(Stamped):
    METHODS = [('cash', 'Cash'), ('mobile', 'Mobile money')]
    day = models.ForeignKey(Day, on_delete=models.CASCADE, related_name='deliveries')
    worker = models.ForeignKey(Worker, on_delete=models.PROTECT, related_name='deliveries')
    section = models.CharField(max_length=8, choices=SECTION_CHOICES)
    amount = models.BigIntegerField()
    method = models.CharField(max_length=6, choices=METHODS)
    handed_in = models.BooleanField(default=False)
    handed_in_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['id']


class Expense(Stamped):
    FROM = [('droo', 'Till'), ('simu', 'Mobile money'), ('other', 'Other')]
    date = models.DateField()
    category = models.ForeignKey(ExpenseCategory, on_delete=models.PROTECT, related_name='expenses')
    amount = models.BigIntegerField()
    reason = models.CharField(max_length=200)
    paid_from = models.CharField(max_length=6, choices=FROM)
    section = models.CharField(max_length=8, choices=SECTION_CHOICES, blank=True)

    class Meta:
        ordering = ['-date', '-id']


class Advance(Stamped):
    worker = models.ForeignKey(Worker, on_delete=models.CASCADE, related_name='advances')
    date = models.DateField()
    amount = models.BigIntegerField()

    class Meta:
        ordering = ['date', 'id']


class Shortage(Stamped):
    SOURCES = [('cash_count', 'Cash count'), ('manual', 'Written by manager')]
    STATUS = [('applied', 'Applied'), ('waived', 'Waived')]
    worker = models.ForeignKey(Worker, on_delete=models.CASCADE, related_name='shortages')
    date = models.DateField()
    amount = models.BigIntegerField()
    section = models.CharField(max_length=8, choices=SECTION_CHOICES, blank=True)
    source = models.CharField(max_length=12, choices=SOURCES)
    reason = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=8, choices=STATUS, default='applied')

    class Meta:
        ordering = ['date', 'id']


class SalaryRun(Stamped):
    month = models.CharField(max_length=7, unique=True, help_text='yyyy-mm')
    approved_at = models.DateTimeField(null=True, blank=True)
    rules = models.JSONField(default=dict)


class SalaryLine(Stamped):
    run = models.ForeignKey(SalaryRun, on_delete=models.CASCADE, related_name='lines')
    worker = models.ForeignKey(Worker, on_delete=models.PROTECT, related_name='salary_lines')
    base = models.BigIntegerField()
    advances = models.BigIntegerField()
    shortages = models.BigIntegerField()
    net = models.BigIntegerField()
    stats = models.JSONField(default=dict)
    paid = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [('run', 'worker')]


class AuditLog(models.Model):
    at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='+')
    action = models.CharField(max_length=60)
    target = models.CharField(max_length=80, blank=True)
    detail = models.JSONField(default=dict)

    class Meta:
        ordering = ['-at']
