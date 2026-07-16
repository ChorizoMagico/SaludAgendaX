# Generado a mano (sin acceso a Django en este entorno para correr
# `makemigrations`), siguiendo el mismo formato que las migraciones
# anteriores del proyecto (ver 0008_paciente_telefono.py).
#
# NOTA (conexion FE-BE, punto 1 — login/registro de médico y
# administrativo):
# - Medico gana `num_documento` (para poder loguearse con cédula, igual que
#   Paciente), `telefono`, `estado` y `motivo_rechazo` (flujo de
#   autorización por superadministrador).
# - Se crea el modelo Administrativo, que antes no existía: un
#   administrativo era solo un django User con is_staff/grupo
#   'administrativo' sin ningún dato propio ni forma de autorregistrarse.
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('pacientes', '0008_paciente_telefono'),
    ]

    operations = [
        migrations.AddField(
            model_name='medico',
            name='num_documento',
            field=models.CharField(blank=True, max_length=30, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='medico',
            name='telefono',
            field=models.CharField(blank=True, max_length=30, default=''),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='medico',
            name='estado',
            field=models.CharField(
                choices=[
                    ('pendiente', 'Pendiente de autorización'),
                    ('aprobado', 'Aprobado'),
                    ('rechazado', 'Rechazado'),
                ],
                default='aprobado',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='medico',
            name='motivo_rechazo',
            field=models.CharField(blank=True, max_length=255, default=''),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='medico',
            name='estado',
            field=models.CharField(
                choices=[
                    ('pendiente', 'Pendiente de autorización'),
                    ('aprobado', 'Aprobado'),
                    ('rechazado', 'Rechazado'),
                ],
                default='pendiente',
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name='Administrativo',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('num_documento', models.CharField(max_length=30, unique=True)),
                ('telefono', models.CharField(blank=True, max_length=30)),
                ('cargo', models.CharField(blank=True, max_length=100)),
                ('activo', models.BooleanField(default=False)),
                (
                    'estado',
                    models.CharField(
                        choices=[
                            ('pendiente', 'Pendiente de autorización'),
                            ('aprobado', 'Aprobado'),
                            ('rechazado', 'Rechazado'),
                        ],
                        default='pendiente',
                        max_length=20,
                    ),
                ),
                ('motivo_rechazo', models.CharField(blank=True, max_length=255)),
                ('usuario', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'administrativo',
            },
        ),
    ]
