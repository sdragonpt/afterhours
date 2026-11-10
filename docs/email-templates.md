# Emails do Afterhours (Supabase → Authentication → Emails → Templates)

Copia o **Subject** e o **Body** de cada um. `{{ .ConfirmationURL }}` é preenchido pelo Supabase.

---

## Confirm signup

**Subject:** `Confirma a tua conta no Afterhours 🌙`

**Body:**

```html
<div style="background:#0c0c0e;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:440px;margin:0 auto;background:#141417;border:2px solid #000;border-radius:24px;padding:28px;color:#f4f1ea">
    <p style="margin:0;font-size:40px;font-weight:900;letter-spacing:-1px;line-height:1">after<br>hours<span style="color:#d4ff3a">.</span></p>
    <p style="margin:24px 0 8px;font-size:20px;font-weight:700">Falta só um toque.</p>
    <p style="margin:0 0 24px;color:#a9a6af;font-size:15px;line-height:1.5">Confirma o teu email para entrares na malta. Abre o link no mesmo telemóvel onde criaste a conta.</p>
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#d4ff3a;color:#0c0c0e;border:2px solid #000;border-radius:999px;padding:14px 26px;font-weight:800;font-size:16px;text-decoration:none">Confirmar conta</a>
    <p style="margin:24px 0 0;color:#5d5b64;font-size:12px">Não foste tu? Ignora este email.</p>
  </div>
</div>
```

---

## Reset password

**Subject:** `Password nova no Afterhours`

**Body:**

```html
<div style="background:#0c0c0e;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:440px;margin:0 auto;background:#141417;border:2px solid #000;border-radius:24px;padding:28px;color:#f4f1ea">
    <p style="margin:0;font-size:40px;font-weight:900;letter-spacing:-1px;line-height:1">after<br>hours<span style="color:#d4ff3a">.</span></p>
    <p style="margin:24px 0 8px;font-size:20px;font-weight:700">Esqueceste-te da password?</p>
    <p style="margin:0 0 24px;color:#a9a6af;font-size:15px;line-height:1.5">Acontece aos melhores. Carrega no botão para escolheres uma nova. O link só funciona uma vez e expira em 1 hora.</p>
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#d4ff3a;color:#0c0c0e;border:2px solid #000;border-radius:999px;padding:14px 26px;font-weight:800;font-size:16px;text-decoration:none">Escolher password nova</a>
    <p style="margin:24px 0 0;color:#5d5b64;font-size:12px">Não pediste isto? Ignora este email, a tua password continua igual.</p>
  </div>
</div>
```
