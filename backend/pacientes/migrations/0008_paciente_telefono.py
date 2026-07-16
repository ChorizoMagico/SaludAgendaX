# Generado a mano (sin acceso a Django en este entorno para correr
# `makemigrations`), siguiendo el mismo formato que las migraciones
# anteriores del proyecto.
#
# NOTA (conexion FE-BE): agrega la columna `telefono` a Paciente. El
# frontend siempre pedía este dato en el registro, pero se perdía porque
# el modelo no tenía dónde guardarlo.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pacientes', '0007_configuracionglobal_feriado_sede'),
    ]

    operations = [
        migrations.AddField(
            model_name='paciente',
            name='telefono',
            field=models.CharField(blank=True, max_length=30, default=''),
            preserve_default=False,
        ),
    ]
