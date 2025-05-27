const express = require('express');
const Imap = require('imap');
const { simpleParser } = require('mailparser');

const app = express();
app.use(express.json());

app.post('/leer', async (req, res) => {
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

  const obtenerMensajes = () => new Promise((resolve, reject) => {
    const mensajes = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err, box) => {
        if (err) return reject(new Error('No se pudo abrir INBOX'));

        imap.search(['ALL'], (err, results) => {
          if (err) return reject(new Error('Error al buscar correos'));

          if (!results || results.length === 0) {
            imap.end();
            return resolve([]);
          }

          const fetch = imap.fetch(results.slice(-5), {
            bodies: '',
            struct: true
          });

          const tareas = [];

          fetch.on('message', (msg) => {
            let buffer = '';

            msg.on('body', (stream) => {
              stream.on('data', chunk => buffer += chunk.toString('utf8'));
              stream.on('end', () => {});
            });

            msg.once('end', () => {
              const tarea = simpleParser(buffer)
                .then(parsed => {
                  mensajes.push({
                    asunto: parsed.subject || '',
                    de: parsed.from?.text || '',
                    fecha: parsed.date || '',
                    html: parsed.html || '',
                    texto: parsed.text || ''
                  });
                });
              tareas.push(tarea);
            });
          });

          fetch.once('end', async () => {
            await Promise.all(tareas);
            imap.end();
            resolve(mensajes);
          });
        });
      });
    });

    imap.once('error', (err) => {
      reject(new Error('Fallo de conexión: ' + err.message));
    });

    imap.connect();
  });

  try {
    const mensajes = await obtenerMensajes();
    res.json({ mensajes });
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ API activa en el puerto ${PORT}`);
});
