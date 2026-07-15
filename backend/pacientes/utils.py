from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.core.mail import send_mail
from django.conf import settings

class TokenGenerator(PasswordResetTokenGenerator):
    pass

token_generator = TokenGenerator()

def generar_token_recuperacion(user):
    """Genera un token para recuperar contraseña"""
    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
    token = token_generator.make_token(user)
    return uidb64, token

def verificar_token(uidb64, token):
    """Verifica que el token sea válido"""
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        from django.contrib.auth.models import User
        user = User.objects.get(pk=uid)
    except:
        return None
    
    if token_generator.check_token(user, token):
        return user
    return None

def enviar_email_recuperacion(user, uidb64, token):
    """Envía email con link de recuperación"""
    link = f"http://localhost:3000/reset-password?uidb64={uidb64}&token={token}"
    asunto = "Recuperar contraseña - SaludAgendaX"
    mensaje = f"""
    Hola {user.first_name},
    
    Has solicitado recuperar tu contraseña. Haz clic en el siguiente link:
    
    {link}
    
    Este link expira en 24 horas.
    
    Si no solicitaste esto, ignora este email.
    
    SaludAgendaX
    """
    
    send_mail(asunto, mensaje, settings.DEFAULT_FROM_EMAIL, [user.email])