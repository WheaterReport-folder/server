import { Router } from 'express';
import { pool } from '../db.js';

export const devicesRouter = Router();

devicesRouter.post('/devices', async (req, res, next) => {
  try {
    const { deviceId, fcmToken, platform } = req.body;
    if (!deviceId || !fcmToken || !platform) {
      return res
        .status(400)
        .json({ error: 'deviceId, fcmToken, platform은 필수입니다.' });
    }

    const result = await pool.query(
      `INSERT INTO devices (device_id, fcm_token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (device_id)
       DO UPDATE SET fcm_token = $2, platform = $3, updated_at = now()
       RETURNING id, device_id`,
      [deviceId, fcmToken, platform],
    );

    res.json({ id: result.rows[0].id, deviceId: result.rows[0].device_id });
  } catch (err) {
    next(err);
  }
});
