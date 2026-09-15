// ENVIO DE EMAIL DE AVISO (usado por el tunel de cloudflare)
// Los datos SMTP se leen de configs.json -> tunnel.mail
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const configsPath = path.join(__dirname, './../configs.json');

function mailConfig() {
  try {
    const configs = JSON.parse(fs.readFileSync(configsPath, 'utf8'));
    return (configs.tunnel && configs.tunnel.mail) ? configs.tunnel.mail : null;
  } catch (err) {
    return null;
  }
}

function saveMailConfig(mail) {
  const configs = JSON.parse(fs.readFileSync(configsPath, 'utf8'));
  if (!configs.tunnel) configs.tunnel = {};
  configs.tunnel.mail = {
    host: mail.host || 'smtp.gmail.com',
    port: mail.port != null ? Number(mail.port) : 465,
    secure: mail.secure != null ? mail.secure : true,
    user: String(mail.user || '').trim(),
    pass: String(mail.pass || ''),
    to: String(mail.to || '').trim()
  };
  fs.writeFileSync(configsPath, JSON.stringify(configs, null, '\t'));
  return configs.tunnel.mail;
}

function mailConfigPublic() {
  const m = mailConfig();
  return m ? { user: m.user || '', to: m.to || '' } : { user: '', to: '' };
}

async function sendEmail({ subject, text }) {
  const mail = mailConfig();
  if (!mail || !mail.user || !mail.pass || !mail.to) {
    console.log('[tunnel] No hay configuracion de correo (tunnel.mail) en configs.json. No se envio email.');
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: mail.host || 'smtp.gmail.com',
    port: Number(mail.port || 465),
    secure: mail.secure != null ? mail.secure : true,
    auth: { user: mail.user, pass: mail.pass }
  });

  try {
    await transporter.sendMail({
      from: `"Servidor ACAPE" <${mail.user}>`,
      to: mail.to,
      subject: subject || 'Aviso del servidor ACAPE',
      text: text || ''
    });
  } catch (err) {
    console.log('[tunnel] Error enviando el email:', err.message);
    return false;
  } finally {
    try { transporter.close(); } catch (e) {}
  }
  return true;
}

sendEmail.saveConfig = saveMailConfig;
sendEmail.getConfig = mailConfigPublic;

module.exports = sendEmail;