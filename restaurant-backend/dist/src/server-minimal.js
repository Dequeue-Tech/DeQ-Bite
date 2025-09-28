"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        message: 'Minimal server is running'
    });
});
app.get('/test', (_req, res) => {
    res.status(200).json({
        message: '✅ Minimal test route working!',
        version: 'minimal-v1'
    });
});
app.get('/', (_req, res) => {
    res.status(200).json({
        message: 'Welcome to the minimal API',
        version: 'minimal-v1'
    });
});
exports.default = app;
//# sourceMappingURL=server-minimal.js.map