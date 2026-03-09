import shutil
import datetime
import os

# Backup database
timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
shutil.copy2('database.db', f'backups/database_{timestamp}.db')

# Backup uploads
shutil.make_archive(f'backups/uploads_{timestamp}', 'zip', 'uploads')

print(f"Backup completed: {timestamp}")