from django.db import migrations

# The close-day wizard now starts with attendance, and daily pay comes after expenses (only for workers present or late):
#   old: 0 Mauzo, 1 Matumizi, 2 Malipo, 3 Hesabu ya pesa, 4 Mahudhurio, 5 Funga siku
#   new: 0 Mahudhurio, 1 Mauzo, 2 Matumizi, 3 Malipo, 4 Hesabu ya pesa, 5 Funga siku
OLD_TO_NEW = {0: 1, 1: 2, 2: 3, 3: 4, 4: 0, 5: 5}
NEW_TO_OLD = {new: old for old, new in OLD_TO_NEW.items()}


def renumber(mapping):
    def run(apps, schema_editor):
        Day = apps.get_model('core', 'Day')
        for day in Day.objects.all():
            if not day.visited:
                continue
            day.visited = sorted({mapping[i] for i in day.visited if i in mapping})
            day.save(update_fields=['visited'])
    return run


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_date_indexes'),
    ]

    operations = [
        migrations.RunPython(renumber(OLD_TO_NEW), renumber(NEW_TO_OLD)),
    ]
