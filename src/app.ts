import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';

dotenv.config();

const PORT = process.env.PORT || 3002;

const app = express();

app.use(cors());
app.use(bodyParser.json());

import routes from './routes';

app.use('/api', routes);

app.listen(PORT, (() => {
  console.log(`Listening on port ${PORT}`);
}))