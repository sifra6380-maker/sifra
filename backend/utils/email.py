import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from ..config import settings


async def send_email(to_email: str, subject: str, html_body: str):
    """Send an HTML email via SMTP."""
    message = MIMEMultipart("alternative")
    message["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM}>"
    message["To"] = to_email
    message["Subject"] = subject

    html_part = MIMEText(html_body, "html")
    message.attach(html_part)

    await aiosmtplib.send(
        message,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER,
        password=settings.SMTP_PASSWORD,
        start_tls=True,
    )


async def send_otp_email(to_email: str, otp: str, full_name: str):
    subject = "Verify Your SIFRA Account"
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
      <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1e3a5f; margin: 0;">SIFRA</h1>
          <p style="color: #666; margin: 5px 0 0;">Freelance Marketplace</p>
        </div>
        <h2 style="color: #1e3a5f;">Hi {full_name},</h2>
        <p style="color: #444;">Please verify your email address using the OTP below:</p>
        <div style="background: #f0f4ff; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2563eb;">{otp}</span>
        </div>
        <p style="color: #666; font-size: 14px;">This OTP expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">If you didn't create an account on SIFRA, you can safely ignore this email.</p>
      </div>
    </body>
    </html>
    """
    await send_email(to_email, subject, html)


async def send_reset_code_email(to_email: str, reset_code: str, full_name: str):
    subject = "Reset Your SIFRA Password"
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
      <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1e3a5f; margin: 0;">SIFRA</h1>
        </div>
        <h2 style="color: #1e3a5f;">Hi {full_name},</h2>
        <p style="color: #444;">You requested a password reset. Use the code below:</p>
        <div style="background: #fff4f4; border: 2px solid #ef4444; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #ef4444;">{reset_code}</span>
        </div>
        <p style="color: #666; font-size: 14px;">This code expires in <strong>15 minutes</strong>.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request a password reset, please ignore this email.</p>
      </div>
    </body>
    </html>
    """
    await send_email(to_email, subject, html)


async def send_application_notification_email(
    to_email: str, freelancer_name: str, task_title: str, task_id: str
):
    subject = f"New Application for: {task_title}"
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
      <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px;">
        <h1 style="color: #1e3a5f;">New Application Received</h1>
        <p style="color: #444;"><strong>{freelancer_name}</strong> applied for your task: <strong>{task_title}</strong></p>
        <a href="http://localhost:5173/tasks/{task_id}/applications"
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          View Application
        </a>
      </div>
    </body>
    </html>
    """
    await send_email(to_email, subject, html)
