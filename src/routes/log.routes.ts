import { Router } from 'express';
import { getAllLogs, getLogsForWebhook } from '../controllers/log.controller';
import { authMiddleware } from '../middleware/auth.middlerware';

const router = Router();

router.use(authMiddleware);

router.get('/', getAllLogs);

router.get('/:webhook_id', getLogsForWebhook);

export default router;
