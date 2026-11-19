import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Solo desarrollo: recibe capturas del juego y las guarda en shots/.
export default defineConfig({
  plugins: [{
    name: 'yugure-shots',
    configureServer(server) {
      server.middlewares.use('/__shot', (req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          const { name, data } = JSON.parse(body);
          fs.mkdirSync('shots', { recursive: true });
          fs.writeFileSync(path.join('shots', path.basename(name)), Buffer.from(String(data).split(',')[1], 'base64'));
          res.end('ok');
        });
      });
    },
  }],
});
