from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('pacientes', '0010_merge_20260716_2031'),
    ]

    operations = [
        migrations.AddField(
            model_name='medico',
            name='sede',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='medicos',
                to='pacientes.sede',
            ),
        ),
        migrations.AddField(
            model_name='cita',
            name='sede',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                to='pacientes.sede',
            ),
        ),
    ]
