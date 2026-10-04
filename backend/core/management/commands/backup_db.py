"""Copies the SQLite database to a dated file in BACKUP_DIR. Safe while the app is running."""
import sqlite3
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.utils import timezone


class Command(BaseCommand):
    help = 'Back up the SQLite database to BACKUP_DIR and keep only the newest --keep copies.'

    def add_arguments(self, p):
        p.add_argument('--dir', default=None, help='Folder to write to (default: BACKUP_DIR).')
        p.add_argument('--keep', type=int, default=30, help='How many backups to keep (default: 30).')

    def handle(self, *a, **o):
        if connection.vendor != 'sqlite':
            raise CommandError('backup_db only copies SQLite databases. For PostgreSQL use pg_dump.')
        if o['keep'] < 1:
            raise CommandError('--keep must be at least 1.')
        folder = Path(o['dir'] or settings.BACKUP_DIR)
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / f'daftari-{timezone.localtime():%Y-%m-%d_%H%M%S}.sqlite3'
        connection.ensure_connection()
        # SQLite's online backup copies a consistent snapshot even if the server is writing at the same time.
        copy = sqlite3.connect(target)
        try:
            connection.connection.backup(copy)
        finally:
            copy.close()
        old = sorted(folder.glob('daftari-*.sqlite3'))[:-o['keep']]  # names sort oldest first
        for f in old:
            f.unlink()
        if o['verbosity']:  # the scheduled task runs with -v 0 under pythonw, which has no console to write to
            self.stdout.write(f'Backed up to {target}' + (f' (removed {len(old)} older)' if old else ''))
