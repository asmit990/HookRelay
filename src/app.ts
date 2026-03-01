import express from 'express';
import routes from './routes';
import { rateLimitMiddleware } from './middleware/ratelimit.middle';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimitMiddleware); // Apply global rate limit check

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api', routes);

export default app;
