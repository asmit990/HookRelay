"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboard = getDashboard;
exports.triggerEvent = triggerEvent;
const dashboard_service_1 = require("../services/dashboard.service");
async function getDashboard(req, res) {
    try {
        const userId = req.userId;
        const stats = await (0, dashboard_service_1.getDashboardStats)(userId);
        return res.status(200).json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        console.error('[getDashboard] error:', error);
        return res.status(500).json({
            success: false,
            error: 'SERVER_ERROR',
            message: 'Something went wrong'
        });
    }
}
async function triggerEvent(req, res) {
    res.status(200).json({ success: true, message: "Event triggered" });
}
