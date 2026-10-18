import calendar
from datetime import date

from django.db import migrations, models

# Monthly salaries now run from the day each worker started (12 March to 11 April, paid on 12 April) and are
# approved one worker at a time on their pay day, so a salary line carries its own pay month and approval
# instead of belonging to a calendar month's list. Lines approved before this keep their calendar month.


def lines_from_runs(apps, schema_editor):
    SalaryLine = apps.get_model('core', 'SalaryLine')
    for ln in SalaryLine.objects.select_related('run'):
        y, m = (int(x) for x in ln.run.month.split('-'))
        ln.month = ln.run.month
        ln.period_start = date(y, m, 1)
        ln.period_end = date(y, m, calendar.monthrange(y, m)[1])
        ln.approved_at = ln.run.approved_at or ln.run.created_at
        ln.rules = ln.run.rules
        ln.save(update_fields=['month', 'period_start', 'period_end', 'approved_at', 'rules'])


def runs_from_lines(apps, schema_editor):
    SalaryLine = apps.get_model('core', 'SalaryLine')
    SalaryRun = apps.get_model('core', 'SalaryRun')
    for month in SalaryLine.objects.values_list('month', flat=True).distinct():
        lines = SalaryLine.objects.filter(month=month)
        first = lines.order_by('approved_at').first()
        run = SalaryRun.objects.create(month=month, approved_at=lines.order_by('-approved_at').first().approved_at,
                                       rules=first.rules, created_by=first.created_by)
        lines.update(run=run)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0007_attendance_first'),
    ]

    operations = [
        migrations.AddField(
            model_name='worker',
            name='monthly_since',
            field=models.DateField(blank=True, null=True, help_text='Set when a daily-paid worker moves to a monthly salary: pay months then run from this day'),
        ),
        migrations.AddField(
            model_name='salaryline',
            name='month',
            field=models.CharField(db_index=True, default='', max_length=7, help_text='yyyy-mm of the pay day: the salary list it is on'),
            preserve_default=False,
        ),
        migrations.AddField(model_name='salaryline', name='period_start', field=models.DateField(null=True)),
        migrations.AddField(model_name='salaryline', name='period_end', field=models.DateField(null=True)),
        migrations.AddField(model_name='salaryline', name='approved_at', field=models.DateTimeField(null=True)),
        migrations.AddField(
            model_name='salaryline',
            name='rules',
            field=models.JSONField(default=dict, help_text='The special-day rules it was worked out with'),
        ),
        # nullable first, so stepping back can re-add it empty and fill it before it is required again
        migrations.AlterField(
            model_name='salaryline',
            name='run',
            field=models.ForeignKey(null=True, on_delete=models.deletion.CASCADE, related_name='lines', to='core.salaryrun'),
        ),
        migrations.RunPython(lines_from_runs, runs_from_lines),
        migrations.AlterUniqueTogether(name='salaryline', unique_together=set()),
        migrations.RemoveField(model_name='salaryline', name='run'),
        migrations.DeleteModel(name='SalaryRun'),
        migrations.AlterField(model_name='salaryline', name='period_start', field=models.DateField()),
        migrations.AlterField(
            model_name='salaryline',
            name='period_end',
            field=models.DateField(help_text='The last day paid for: the end of the pay month, or the last day worked'),
        ),
        migrations.AlterField(model_name='salaryline', name='approved_at', field=models.DateTimeField()),
        migrations.AlterModelOptions(name='salaryline', options={'ordering': ['period_start', 'id']}),
        migrations.AlterUniqueTogether(name='salaryline', unique_together={('worker', 'period_start')}),
    ]
