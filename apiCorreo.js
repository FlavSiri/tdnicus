
const express = require('express');
const Imap = require('imap');

const app = express();
app.use(express.json());

app.post('/leer', (req, res) => {
  const { user, password, host } = req.body;

  if (!user || !password || !host) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  const imap = new Imap({
    user,
    password,
    host,
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  });

  imap.once('ready', () => {
    imap.openBox('INBOX', true, (err, box) => {
      if (err) return res.status(500).json({ error: 'No se pudo abrir INBOX' });

      imap.search(['ALL'], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error al buscar correos' });

        if (!results || results.length === 0) {
          imap.end();
          return res.json({ mensajes: [] });
        }

        const fetch = imap.fetch(results.slice(-5), {
          bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)',
          struct: true
        });

        const mensajes = [];

        fetch.on('message', (msg) => {
          msg.on('body', (stream) => {
            let buffer = '';
            stream.on('data', (chunk) => buffer += chunk.toString('utf8'));
            stream.on('end', () => {
              const parsed = Imap.parseHeader(buffer);
              mensajes.push({
                asunto: parsed.subject?.[0] || '',
                de: parsed.from?.[0] || '',
                fecha: parsed.date?.[0] || ''
              });
            });
          });
        });

        fetch.once('end', () => {
          imap.end();
          res.json({ mensajes });
        });
      });
    });
  });

  imap.once('error', (err) => {
    res.status(500).json({ error: 'Fallo de conexión', detalle: err.message });
  });

  imap.connect();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ API activa en el puerto ${PORT}`);
});
