///* required imports *\\\
import express from 'express';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet'
import catchError from './Utils/catchError.js';
import HandleError from './Utils/handleError.js';

///* custom imports *\\\
import authRouter from './Routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

///* required app uses *\\\
const app = express();
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(morgan('dev'));
app.use(cors());
app.use(helmet());

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'trusted-scripts.com'],
    },
  })
);

///* custom app uses *\\\
app.use('/api/auth', authRouter);


//* test health/alive *\\
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

app.use('*', (req, res, next) => {
	return next(new HandleError('Invalid route', 404));
});

///* catching every error automatically *\\\
app.use(catchError);

export default app;
